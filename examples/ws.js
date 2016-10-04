const WebSocket = require('ws');

const PORT = process.env.PORT;

const ws = new WebSocket(`ws://localhost:${PORT}/service`);

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
