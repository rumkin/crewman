'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const connect = require('connect');
const hall = require('hall');
const httpAuthPayload = require('http-auth-payload');
const qs = require('querystring');
const {EventEmitter} = require('events');

class Crewman extends EventEmitter {
    constructor({dir = process.cwd(), ssl = null, common = {}, services = {}} = {}) {
        super();

        this.dir = dir;
        this._ssl = ssl;
        this._common = common;
        this._connectionsCount = 0;

        const router = hall();
        const urls = new Map();

        _.forOwn(services, (service_, name) => {
            const service = this.normalizeService(service_);
            const url = service.hasOwnProperty('url')
                ? service.url
                : '/' + name;

            if (urls.has(url)) {
                throw new Error(`Url ${url} is listening by ${urls.get(url)}`);
            }

            urls.set(url, name);

            const queue = this.getOrderedAuth(name, service);
            const parser = new hall.RouteParser(url + '/*tail');

            router.all(parser, (req, res, next) => {
                Promise.reduce(queue, (status, auth) => {
                    if (status) {
                        return status;
                    }

                    return auth(req, res);
                }, false)
                .then((status) => {
                    if (! status) {
                        if (service.authOnly !== false) {
                            res.statusCode = 403;
                            res.statusText = 'Access forbidden';
                            res.end('Access forbidden');

                            return;
                        }

                        delete req.headers['x-user'];
                    }

                    var serviceSocket = service.socket;

                    var headers = Object.assign({}, req.headers, {
                        'x-forwarded-for': req.headers.host,
                        'x-origin-url': req.url,
                        'x-origin-url-prefix': req.url.slice(-req.params.tail.length),
                        'x-origin-url-postfix': req.params.tail,
                    });

                    var proxyReq = http.request({
                        path: '/' + req.params.tail,
                        method: req.method,
                        socketPath: serviceSocket,
                        headers,
                    });

                    proxyReq.on('response', (proxyRes) => {
                        res.writeHead(proxyRes.statusCode, proxyRes.statusText, proxyRes.headers);
                        proxyRes.pipe(res);
                    });

                    proxyReq.on('error', (error) => {
                        console.error(error);
                        res.end('Error');
                    });


                    req.pipe(proxyReq);

                    res.socket.on('close', () => {
                        this._disconnected();
                    });

                    this._connected();
                })
                .catch(next);
            });
        });

        const app = connect()
        .use(httpAuthPayload)
        .use(router)
        .use((req, res) => {
            res.statusCode = 404;
            res.statusText = 'Nothing found';
            res.end('Nothing found');
        })
        .use((err, req, res) => {
            res.statusCode = 500;
            res.statusText = 'Server error';
            res.end('Server error');
            console.error(error);
        });

        this._app = app;
        this._server = this.createServer(app);
        this.on('connection', (conn) => this._onConnection(conn));
    }

    get ssl() {
        return this._ssl;
    }

    get app() {
        return this._app;
    }

    get server() {
        return this._server;
    }

    normalizeService(service) {
        return service;
    }

    createServer(fn) {
        if (this.ssl) {
            return https.createServer(this.ssl, fn);
        }
        else {
            return http.createServer(fn);
        }
    }

    getOrderedAuth(name, service) {
        const common = this._common;
        let order;

        if (service.hasOwnProperty('order')) {
            order = service.order;
        }
        else {
            order = common.order;
        }


        if (! order) {
            return [];
        }

        let auth = Object.assign({}, common.auth, service.auth);
        let result = order.reduce((result, authName) => {
            if (! auth.hasOwnProperty(authName)) {
                throw new Error(
                    `Invalid auth "${authName}" for service "${name}"`
                );
            }

            let item = auth[authName];
            let factory = this._loadAuthModule(item.use || authName);

            if (typeof factory !== 'function') {
                throw new Error('Factory is not a function');
            }

            result.push(factory(item, this));

            return result;
        }, []);

        return result;
    }

    _loadAuthModule(name, dir = '.') {
        if (name.match(/^\.{1,2}\//)) {
            return require(path.resolve(dir, name));
        }

        let localModule = path.join(__dirname, 'auth', name + '.js');

        if (fs.existsSync(localModule)) {
            return require(localModule);
        }
        else {
            return require(name);
        }
    }

    _onConnection(conn) {
        this._server._events.connection.call(this._server, conn);
    }

    _connected() {
        this._connectionsCount += 1;
        this.emit('connected');
    }

    _disconnected() {
        this._connectionsCount -= 1;
        this.emit('disconnected');
    }

    get connectionsCount() {
        return this._connectionsCount;
    }

    start() {
        if (this._interval) {
            throw new Error('Crewman alredy started');
        }

        this._interval = setInterval(() => {}, 1000);
    }

    stop() {
        if (this.connectionsCount < 1) {
            this._stop();
            return;
        }

        this.on('disconnect', () => {
            if (this.connectionsCount < 1) {
                this._stop();
            }
        });
    }

    _stop() {
        clearInterval(this._interval);
        this._interval = null;
    }
}

module.exports = Crewman;
