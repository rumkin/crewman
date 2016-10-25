const assert = require('assert');
const fetch = require('node-fetch');
const Crewman = require('..');
const http = require('http');
const net = require('net');
const fs = require('fs');
const URPC = require('urpc');
const ws = require('ws');

describe('Crewman', () => {
    let crewman;
    let server;
    const services = {};
    const echoSocket = '/tmp/service.sock';
    const urpcPort = 44466;
    const wsPort = 44467;

    // Configure unix socket echo server
    before(() => {
        let service = http.createServer((req, res) => {
            req.pipe(res);
        });

        if (fs.existsSync(echoSocket)) {
            fs.unlinkSync(echoSocket);
        }

        service.listen(echoSocket);
        services.echo = service;
    });

    // Configure tcp socket echo server
    before(() => {
        let service = http.createServer((req, res) => {
            req.pipe(res);
        });

        service.listen();
        services.httpEcho = service;
    });

    // Configure web socket echo server
    before(() => {
        const service = new ws.Server({
            port: wsPort
        });

        service.on('connection', (conn) => {
            conn.on('message', (message) => {
                conn.send(message);
            });
        });

        services.wsEcho = service;
    });

    // Configure URPC auth server
    before(() => {
        const service = new ws.Server({
            port: urpcPort
        });

        class WebSocketRPC extends URPC.Server {
            constructor(options) {
                options.connectEvent = 'connection';
                super(options);
            }

            onConnect(socket) {
                var client = this.client(new URPC.Tunnel({
                    channel: socket,
                    onMessage: JSON.parse,
                    onSend: JSON.stringify,
                }));

                this.emit('client', client);
            }
        }

        new WebSocketRPC({
            connection: service,
            onCall(method, args) {
                if (method !== 'auth') {
                    throw new URPC.Error('invalid_method');
                }

                const {headers} = args[0];

                return headers.authorization === 'bearer 12345';
            },
        });

        services.urpc = service;
    });

    it('Should instantiate', () => {
        crewman = new Crewman({
            dir: process.cwd(),
            common: {
                auth: {
                    bearer: {
                        token: '12345',
                    },
                    urpc: {
                        url: `ws://localhost:${urpcPort}`,
                        headers: ['authorization'],
                    },
                    cors: {
                        origins: '*.local',
                    }
                },
                order: ['bearer'],
            },
            services: {
                echo: {
                    order: ['cors', 'bearer'],
                    socket: echoSocket,
                },

                'http-echo': {
                    order: ['bearer'],
                    host: 'localhost',
                    port: services.httpEcho.address().port,
                },

                'ws-echo': {
                    order: ['bearer'],
                    host: 'localhost',
                    port: wsPort,
                },

                urpc: {
                    order: ['urpc'],
                    socket: echoSocket,
                },
            },
        });

        server = net.createServer((connection) => {
            crewman.emit('connection', connection);
        });

        server.listen();
    });

    it('Should pass echo request with bearer auth to socket service', () => {
        const port = server.address().port;
        const url = `http://localhost:${port}/echo`;
        const body = 'hello';
        return fetch(url, {
            method: 'POST',
            headers: {
                authorization: 'bearer 12345',
            },
            body,
        })
        .then((res) => {
            assert.equal(res.status, 200, 'Status is 200');
            return res.text();
        })
        .then((text) => {
            assert.equal(text, body, `Result body is "${body}"`);
        });
    });

    it('Should pass echo request with urpc auth to socket service', () => {
        const port = server.address().port;
        const url = `http://localhost:${port}/urpc`;
        const body = 'hello';
        return fetch(url, {
            method: 'POST',
            headers: {
                authorization: 'bearer 12345',
            },
            body,
        })
        .then((res) => {
            assert.equal(res.status, 200, 'Status is 200');
            return res.text();
        })
        .then((text) => {
            assert.equal(text, body, `Result body is "${body}"`);
        });
    });

    it('Should pass echo request with bearer auth to http service', () => {
        const port = server.address().port;
        const url = `http://localhost:${port}/http-echo`;
        const body = 'hello';
        return fetch(url, {
            method: 'POST',
            headers: {
                authorization: 'bearer 12345',
            },
            body,
        })
        .then((res) => {
            assert.equal(res.status, 200, 'Status is 200');
            return res.text();
        })
        .then((text) => {
            assert.equal(text, body, `Result body is "${body}"`);
        });
    });

    it('Should pass echo request with bearer auth to ws service', () => {
        const port = server.address().port;
        const url = `http://localhost:${port}/ws-echo?__AUTH__=bearer%2012345`;
        const body = 'Hello';

        return new Promise((resolve, reject) => {
            let conn = ws.connect(url);

            conn.on('open', () => {
                conn.on('message', (msg) => {
                    conn.close();
                    resolve(msg);
                });

                conn.send(body);
            });

            conn.on('error', reject);
        })
        .then((result) => {
            assert.equal(body, result, 'Result equals');
        });
    });

    it('Should not pass echo request with bearer auth to socket service', () => {
        const port = server.address().port;
        const url = `http://localhost:${port}/echo`;
        const body = 'hello';
        return fetch(url, {
            method: 'POST',
            headers: {
                authorization: 'bearer not a valid bearer',
            },
            body,
        })
        .then((res) => {
            assert.equal(res.status, 403, 'Status is 403');
        });
    });

    it('Should not pass echo request with urpc auth to socket service', () => {
        const port = server.address().port;
        const url = `http://localhost:${port}/urpc`;
        const body = 'hello';
        return fetch(url, {
            method: 'POST',
            headers: {
                authorization: 'no-bearer',
            },
            body,
        })
        .then((res) => {
            assert.equal(res.status, 403, 'Status is 403');
        });
    });

    it('Should not pass echo request with bearer auth to http service', () => {
        const port = server.address().port;
        const url = `http://localhost:${port}/http-echo`;
        const body = 'hello';
        return fetch(url, {
            method: 'POST',
            headers: {
                authorization: 'no-bearer',
            },
            body,
        })
        .then((res) => {
            assert.equal(res.status, 403, 'Status is 403');
        });
    });

    it('Should not pass echo request with bearer auth to ws service', () => {
        const port = server.address().port;
        const url = `http://localhost:${port}/ws-echo?__AUTH__=no-bearer`;

        return new Promise((resolve, reject) => {
            let conn = ws.connect(url);

            conn.on('error', resolve);
        })
        .then((result) => {
            assert.ok((result + '').match(/403/), 'Server response with 403');
        });
    });

    it('Should pass CORS request', () => {
        const port = server.address().port;
        const url = `http://localhost:${port}/echo`;
        const body = 'hello';
        return fetch(url, {
            method: 'POST',
            headers: {
                authorization: 'bearer 12345',
                origin: 'http://test.local'
            },
            body,
        })
        .then((res) => {
            assert.equal(res.status, 200, 'Status is 200');
            return res.text();
        })
        .then((text) => {
            assert.equal(text, body, `Result body is "${body}"`);
        });
    });

    it('Should not pass CORS request', () => {
        const port = server.address().port;
        const url = `http://localhost:${port}/echo`;
        const body = 'hello';
        return fetch(url, {
            method: 'POST',
            headers: {
                authorization: 'bearer 12345',
                origin: 'http://test.aware',
            },
            body,
        })
        .then((res) => {
            assert.equal(res.status, 403, 'Status is 403');
        });
    });
});
