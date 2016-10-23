const http = require('http');
const fs = require('fs');

const PORT = process.argv[2] || process.env.PORT || '/tmp/echo.sock';

if (fs.existsSync(PORT)) {
    fs.unlinkSync(PORT);
}

http.createServer((req, res) => req.pipe(res)).listen(PORT);
