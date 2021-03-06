#!/usr/bin/env node

'use strict';

const program = require('commander');
const packjson = require('../package.json');
const _ = require('lodash');

program.version(packjson.version);

program.command('up [port]')
    .option('-n, --no-tcp', 'No TCP listener')
    .option('-c, --config <path>', 'Config directory')
    .option('-v, --verbose', 'Verbose output')
    .option('-s, --socket <path>', 'Socket path. Default is /var/run/crewman.sock')
    .action((port = 4040, opts) => {
        let args = _.pick(opts, [
            'tcp',
            'config',
            'verbose',
            'socket',
        ]);

        _.defaults(args, {
            tcp: true,
            socket: '/var/run/crewman.sock',
            verbose: (process.env.VERBOSE !== '0'),
            config: '/etc/crewman',
        });

        args.port = port;

        require('./crewman-up.js')(args);
    });

program.parse(process.argv);

if (process.argv.length === 2) {
    program.outputHelp();
}
