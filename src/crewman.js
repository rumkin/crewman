'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const connect = require('connect');
const Route = require('route-parser');
const httpAuthPayload = require('http-auth-payload');
// const qs = require('querystring');
const URL = require('url');
const {EventEmitter} = require('events');

class Crewman extends EventEmitter {
    constructor({dir = process.cwd(), ssl = null, common = {}, services = {}} = {}) {
        super();

        this.dir = dir;
        this._ssl = ssl;
        this._common = common;
        this._connectionsCount = 0;

        const urls = new Map();
        const routes = new Map();

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
            routes.set(new Route(url), {service, queue});
        });

        let router = (req, res, next) => {
            let params, service, queue;
            for (let route of routes.keys()) {
                params = route.match(req.url);
                if (params) {
                    req.params = params;

                    let bind = routes.get(route);
                    service = bind.service;
                    queue = bind.queue;

                    break;
                }
            }

            if (! params) {
                next();
                return;
            }

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

                let proxyReq = this._createProxyRequest(req, service);

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
        };

        const onEnd = (req, res) => {
            res.statusCode = 404;
            res.statusText = 'Nothing found';
            res.end('Nothing found');
        };

        const onError = (err, req, res) => {
            res.statusCode = 500;
            res.statusText = 'Server error';
            res.end('Server error');
            console.error(err);
        };

        const app = connect()
        .use(httpAuthPayload)
        .use(router)
        .use(onEnd)
        .use(onError);

        const server = this.createServer(app);

        server.on('upgrade', (req, socket, upgradeHead) => {
            if (req.method !== 'GET' || !req.headers.upgrade) {
                socket.end();
                return;
            }

            if (req.headers.upgrade.toLowerCase() !== 'websocket') {
                socket.end();
                return;
            }

            let params, service, queue;
            for (let route of routes.keys()) {
                params = route.match(req.url);
                if (params) {
                    req.params = params;

                    let bind = routes.get(route);
                    service = bind.service;
                    queue = bind.queue;

                    break;
                }
            }

            const {query} = URL.parse(req.url, {query: true});

            req.auth = httpAuthPayload.parse(query.__AUTH__ || '');

            let res = new http.ServerResponse(req);
            res.assignSocket(socket);
            res.upgradeHead = upgradeHead;
            res._writeHead = res.writeHead;
            res.writeHead = function(status, text, headers) {
                this._writeHead(status, text, headers);
                if (! this._headerSent && status === 101) {
                    this._send('');
                }
            };

            if (! params) {
                onEnd(req, res);
                return;
            }

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

                let proxyReq = this._createProxyRequest(req, service);

                proxyReq.on('error', () => socket.end());
                proxyReq.on('response', function (res) {
                    // if upgrade event isn't going to happen, close the socket
                    if (! res.upgrade) {
                        socket.end();
                    }
                });

                proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
                    proxySocket.on('error', () => socket.end());
                    socket.on('error', () => proxySocket.end());

                    res.writeHead(101, 'Switching Protocols', proxyRes.headers);
                    res.detachSocket(socket);

                    proxySocket.pipe(socket).pipe(proxySocket);
                });

                if (upgradeHead.length) {
                    socket.unshift(upgradeHead);
                }

                proxyReq.end();
                socket.on('close', () => {
                    this._disconnected();
                });

                this._connected();
            })
            .catch((err) => onError(err, req, res));
        });

        this._server = server;
        this._app = app;
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

    _createProxyRequest(req, service) {
        const tail = req.params.tail || '/';

        const headers = Object.assign({}, req.headers, {
            'x-forwarded-for': req.headers.host,
            'x-origin-url': req.url,
            'x-origin-url-prefix': req.url.slice(-tail.length),
            'x-origin-url-postfix': tail,
        });

        const subPath = tail;
        if (service.hasOwnProperty('path')) {
            if (service.overridePath) {
                subPath = service.path;
            }
            else {
                subPath = service.path + subPath;
            }
        }

        const params = {
            path: subPath,
            method: req.method,
            headers,
        };

        if (service.hasOwnProperty('socket')) {
            params.socketPath = service.socket;
        }
        else {
            params.hostname = service.hostname;
            params.port = service.port;
        }

        return http.request(params);
    }
}

module.exports = Crewman;
