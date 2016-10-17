'use strict';

const Crewman = require('..');
const fetch = require('node-fetch');
const net = require('net');
const {spawn} = require('child_process');

const subproc = spawn('node', ['./examples/service.js'], {
    env: Object.assign({}, process.env, {
        PORT: '/tmp/service.sock',
    }),
    stdio: 'inherit',
});

subproc.on('error', (error) => console.error(error));

const crewman = new Crewman({
    dir: process.cwd(),
    common: {
        auth: {
            bearer: {
                token: '12345',
            },
            urpc: {
                url: 'ws://localhost:1980',
                headers: ['authorization'],
            },
        },
        order: ['urpc'],
    },
    services: {
        echo: {
            socket: '/tmp/service.sock',
        },
    },
});

crewman.start();

const server = net.createServer((conn) => crewman.emit('connection', conn));

server.listen(() => {
    setTimeout(() => {
        Promise.all([
            request('echo/1'),
            request('404'),
        ])
        .then(() => {
            server.close();
            subproc.kill();
            crewman.stop();
        });
    }, 500);
});

function request(path) {
    const address = server.address();

    return fetch(`http://0.0.0.0:${address.port}/${path}`, {
        method: 'POST',
        headers: {
            'authorization': 'bearer 12345',
            // 'authorization': 'bearer 1234',
        },
    })
    .then((res) => {
        return res.text().then((text) => {
            console.log(path, ':', text);
        });
    })
    .catch(err => console.error(path, err));

}
