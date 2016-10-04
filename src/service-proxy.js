const http = require('http');
const https = require('https');
const {EventEmitter} = require('events');

class ServiceProxy extends EventEmitter {
    constructor({ssl = null, services = {}} = {}) {
        super();

        this._server = null;
        this._services = services;
        this._ssl = ssl;
        this._connectionsCount = 0;
        this.on('connection', this._onConnection.bind(this));

        const server = this._server = this._createServer((req, res) => {
            var url = req.url.slice(1).split('/');
            var serviceName = url[0];

            if (! (serviceName in this._services)) {
                res.writeHead(404, 'Service not found');
                res.end('Service not found');
                return;
            }

            var serviceSocket = this._services[serviceName].socket;

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
            var url = req.url.slice(1).split('/');
            var serviceName = url[0];

            if (! (serviceName in this._services)) {
                res.writeHead(404, 'Service not found');
                res.end('Service not found');
                return;
            }

            var serviceSocket = this._services[serviceName].socket;

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

                // Write HTTP response first
                socket.write(
                    Object.keys(proxyRes.headers).reduce(function (head, key) {
                        var value = proxyRes.headers[key];

                        if (!Array.isArray(value)) {
                            head.push(key + ': ' + value);
                            return head;
                        }

                        for (var i = 0; i < value.length; i++) {
                            head.push(key + ': ' + value[i]);
                        }
                        return head;
                    }, ['HTTP/1.1 101 Switching Protocols'])
                    .join('\r\n') + '\r\n\r\n'
                );

                proxySocket.pipe(socket).pipe(proxySocket);
            });

            if (upgradeHead.length) {
                socket.unshift(upgradeHead);
            }
            proxyReq.end();
            socket.on('close', () => {
                console.log('TEHRE CLOSED');
                this._disconnected();
            });

            this._connected();
        });
    }

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
