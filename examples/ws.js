const WebSocket = require('ws');
const qs = require('querystring');

const PORT = process.env.PORT;
const token = process.argv[2];

const ws = new WebSocket(`ws://localhost:${PORT}/service`, 'htools?' + qs.stringify({
    authorization: `Bearer ${token}`,
}));

ws.on('open', () => {
    ws.on('message', (message) => {
        console.log('message', message);
    });

    ws.send('1');
    ws.send('2');
    ws.send('3');
});

ws.on('close', () => {
    console.log('closed');
});

ws.on('error', (error) => console.error(error));
