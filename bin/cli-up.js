const argentum = require('argentum');
const fs = require('fs');
const path = require('path');
const toml = require('toml');
const _ = require('lodash');
const Crewman = require('..');
const net = require('net');

module.exports = function(argv, env) {
    const args = argentum.parse(argv, {
        aliases: {
            d: 'debug',
            v: 'verbose',
        },
        defaults: {
            debug: env.DEBUG === '1',
            verbose: env.VERBOSE === '1',
            dir: env.DIR || '/var/apps/crewman',
            port: env.PORT || 4444,
            socket: env.SOCKET || '/var/run/crewman.sock',
        },
    });

    const dir = path.resolve(process.cwd(), args.dir);
    const PORT = argv[0] || args.port;
    const VERBOSE = args.verbose;
    const DEBUG = args.DEBUG;

    const config = requireToml(path.join(dir, 'config.toml'));
    const aliases = [];
    const groups = config.groups;

    _.forOwn(groups, (v, k) => {
        if (_.isString(v)) {
            aliases.push([k, v]);
            return;
        }

        var order = v.order;
        if (_.isString(order)) {
            order = order.trim().split(/\s*,\s*/);
        }

        v.order = order;
    });

    aliases.forEach(([name, alias]) => {
        if (! groups.hasOwnProperty(alias)) {
            throw new Error(`Group ${alias} not found for ${name}.`);
        }
        else if (! _.isObject(groups[alias])) {
            throw new Error(`Group ${alias} not an object ${name}.`);
        }

        groups[name] = groups[alias];
    });

    if (! groups.hasOwnProperty('default')) {
        throw new Error('Default group not defined in config');
    }

    groups.default.auth = config.auth;

    const services = {};
    const serviceDir = path.join(dir, 'services');
    const serviceFiles = listFilesByExt(serviceDir, '.toml');

    serviceFiles.forEach((serviceFile) => {
        let service = requireToml(serviceFile);
        let group;

        if (service.hasOwnProperty('group')) {
            if (! groups.hasOwnProperty(service.group)) {
                throw new Error(`Unknown group "${group}" for ${serviceFile}`);
            }

            Object.assign(service, groups[service.group]);
        }

        let ext = path.extname(serviceFile);
        let name = path.basename(serviceFile, ext);
        service.dir = serviceDir;
        services[name] = service;
    });

    const crewman = new Crewman({
        dir,
        common: groups.default,
        services,
    });

    crewman.start();

    // TCP socket listener
    const server = net.createServer((conn) => crewman.emit('connection', conn));

    server.listen(PORT, () => {
        VERBOSE && console.log('Listening localhost:%s', PORT);
    });

    // Unix socket listener
    const local = net.createServer((conn) => crewman.emit('connection', conn));

    local.listen(SOCKET);
};

function listFilesByExt(dir, ext) {
    return fs.readdirSync(dir)
    .map((file) => {
        let fileExt = path.extname(file).toLowerCase();
        if (fileExt !== ext) {
            return;
        }

        return path.join(dir, file);
    })
    .filter((file) => !! file);
}

function requireToml(filepath) {
    return toml.parse(
        fs.readFileSync(filepath, 'utf-8')
    );
}
