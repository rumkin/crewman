const {ServiceProxy} = require('..');

const sp = new ServiceProxy({
    ssl: false,
    services: {
        service: {
            socket: '/tmp/service.sock',
        },
    },
});

process.on('message', (msg, conn) => {
    if (msg + '' !== 'connection') {
        return;
    }

    sp.emit('connection', conn);

    // console.log('sp.connectionsCount', sp.connectionsCount);
});


// Imitate socket listening...
const interval = setInterval(() => {}, 1000);

process.on('disconnect', () => {
    // If there is no connections stop listening
    if (sp.connectionsCount < 1) {
        clearInterval(interval);
        return;
    }

    // Work until last socket disconnected...
    sp.on('disconnected', () => {
        if (sp.connectionsCount < 1) {
            clearInterval(interval);
        }
    });
});
