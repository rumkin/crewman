const ws = require('ws');
const URPC = require('urpc');

const server = new ws.Server({
    port: 1980
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
    connection: server,
    onCall(method, args) {
        if (method !== 'auth') {
            throw new URPC.Error('invalid_method');
        }

        console.log(args);

        return true;
    },
});
