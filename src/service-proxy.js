const http = require('http');
const https = require('https');
const {EventEmitter} = require('events');
const _ = require('lodash');
const path = require('path');

class ServiceProxy extends EventEmitter {
    constructor({ssl = null, global = {}, services = {}} = {}) {
        super();

        this._server = null;
        // this._auth = {};
        this._services = new Map();
        this._ssl = ssl;
        this._connectionsCount = 0;

        this.addService(null, global);
        this.addServices(services);

        this.on('connection', this._onConnection.bind(this));

        const server = this._server = this._createServer((req, res) => {
            var url = req.url.slice(1).split('/');
            var serviceName = url[0];

            if (! this._services.has(serviceName)) {
                res.writeHead(404, 'Service not found');
                res.end('Service not found');
                return;
            }

            var serviceSocket = this._services.get(serviceName).socket;

            var headers = Object.assign({}, req.headers, {
                'x-forwarded-for': req.headers.host,
                'x-origin-url': req.url,
            });

            var proxyReq = http.request({
                path: '/' + url.slice(1).join('/'),
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
        });

        server.on('upgrade', (req, socket, upgradeHead) => {
            var res = new http.ServerResponse(req);
            res.assignSocket(socket);
            res.upgradeHead = upgradeHead;
            res._writeHead = res.writeHead;
            res.writeHead = function(status, text, headers) {
                this._writeHead(status, text, headers);
                if (! this._headerSent && status === 101) {
                    this._send('');
                }
            };

            var url = req.url.slice(1).split('/');
            var serviceName = url[0];

            if (! this._services.has(serviceName)) {
                res.writeHead(404, 'Service not found');
                res.end('Service not found');
                return;
            }

            var serviceSocket = this._services.get(serviceName).socket;

            if (req.method !== 'GET' || !req.headers.upgrade) {
                socket.end();
                return;
            }

            if (req.headers.upgrade.toLowerCase() !== 'websocket') {
                socket.end();
                return;
            }

            var proxyReq = http.request({
                path: req.url,
                method: req.method,
                socketPath: serviceSocket,
                headers: req.headers,
            });

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
        });
    }

    addServices(services) {
        Object.getOwnPropertyNames(services)
        .forEach((name) => this.addService(name, services[name]));
        return this;
    }

    addService(name, service) {
        if (this.hasService(name)) {
            throw new Error('Service already exitst');
        }

        this._services.set(name, _.merge({}, service));

        return this;
    }

    hasService(name) {
        return this._services.has(name);
    }

    getService(name) {
        if (! this.hasService(name)) {
            throw new Error(`Service "${name}" not found`);
        }

        return this._services.get(name);
    }

    findService(name) {
        return this._services.get(name);
    }

    removeService(name) {
        if (this.hasService(name)) {
            this._services.delete(name);
        }

        return this;
    }

    getOrderedAuth(name) {
        var service = this.getService(name);
        var global = this.getService(null);

        if (service._auth) {
            return service._auth;
        }

        var order;

        if (service.hasOwnProperty('order')) {
            order = service.authOrder;
        }
        else {
            order = global.authOrder;
        }

        if (! order) {
            return () => {};
        }

        var auth = Object.assign({}, global.auth, service.auth);

        var result = order.reduce((result, authName) => {
            if (! auth.hasOwnProperty(authName)) {
                throw new Error(`Invalid auth "${authName}" for service "${name}"`);
            }

            var item = auth[authName];
            var factory;

            if (item.use.match(/^\.\//)) {
                let authPath = path.resolve(this.dir, item.use);
                factory = require(authPath);
            }
            else {
                factory = require(auth.use);
            }

            result.push(authMethod);

            return result;
        }, []);

        service._auth = result;

        return result;
    }

    // addAuth(name, auth) {
    //     this._auth[name] = _.merge({}, auth);
    // }

    _createServer(fn) {
        if (this._ssl) {
            return https.createServer(this._ssl, fn);
        }
        else {
            return http.createServer(fn);
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
}

module.exports = ServiceProxy;
