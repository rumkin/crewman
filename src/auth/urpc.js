const ws = require('ws');
const URPC = require('urpc');
const _ = require('lodash');

module.exports = function(options) {
    const socket = new ws(options.url);
    const conn = new URPC.Connection(new URPC.Tunnel({
        channel: socket,
        onMessage: JSON.parse,
        onSend: JSON.stringify,
    }));

    return function(req) {
        let headers = req.headers;

        if (options.headers) {
            headers = _.pick(headers, options.headers);
        }

        return conn.call('auth', {
            host: req.headers.host,
            url: req.url,
            headers: headers,
        });
    };
};
