#!/usr/bin/env node

'use strict';

const net = require('net');
const {spawn} = require('child_process');
const argentum = require('argentum');
const camelcase = require('camelcase');
const argv = process.argv.slice(2);
const cliAction = camelcase(argv.shift());
const actions = {
    up(argv, options) {
        console.log('options', options);
    },

    usage(argv) {
        console.log(`Usage is ${process.argv[0]} <action> [options]`);
    }
};

console.log(argv);

if (actions.hasOwnProperty(cliAction)) {
    actions[cliAction](argv, argentum.parse(argv));
}
else {
    actions.usage(argv);
}



// const actions = {
//
// };
//
// const PORT = process.env.PORT;
//
// var child = spawn('node', ['child.js', ...process.argv.slice(2)], {
//     cwd: __dirname,
//     stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
//     detached: true,
// });
//
// child.on('error', (error) => {
//     console.error(error);
// });
//
// var server = net.createServer({
//     pauseOnConnect: true,
// }, (conn) => {
//     child.send('connection', conn);
//
//     // setTimeout(() => {
//     //     process.exit();
//     // });
// });
//
// server.listen(PORT);
