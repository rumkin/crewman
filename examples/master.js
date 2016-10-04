const net = require('net');
const {spawn} = require('child_process');

process.on('exit', () => console.log('master exit'));

const PORT = process.env.PORT;

var child = spawn('node', ['child.js', ...process.argv.slice(2)], {
    cwd: __dirname,
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    detached: true,
});

child.on('error', (error) => {
    console.error(error);
});

var server = net.createServer({
    pauseOnConnect: true,
}, (conn) => {
    child.send('connection', conn);

    // setTimeout(() => {
    //     process.exit();
    // });
});

server.listen(PORT);
