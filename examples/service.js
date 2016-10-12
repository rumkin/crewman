const http = require('http');
const fs = require('fs');
const ws = require('ws');

var PORT = process.env.PORT;

if (! PORT.match(/^\d{1,5}$/)) {
    if (fs.existsSync(PORT)) {
        fs.unlinkSync(PORT);
    }
}

const server = http.createServer((req, res) => {
    res.end('SERVICE OK');
});

(new ws.Server({server}))
.on('connection', (conn) => {
    var i = 3;

    conn.on('message', (i) => {
        console.log(i);

        if (--i < 1) {
            conn.close();
        }
    });
});


server.listen(PORT);

process.on('beforeExit', () => fs.unlinkSync(PORT));
