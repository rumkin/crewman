const escapeRegexp = require('escape-regexp');

module.exports = function(options) {
    let origins = options.origins;

    if (typeof origins === 'string') {
        origins = origins.split(/\s*,\s*/);
    }

    origins = origins.map((origin) => {
        let re = '^https?://' + origin.split('*').map(escapeRegexp).join('.*') + '$';

        return new RegExp(re);
    });

    return function (req, res) {
        if (! req.headers.hasOwnProperty('origin')) {
            return;
        }

        let origin = req.headers.origin;
        let match = false;
        for (let re of origins) {
            if (re.test(origin)) {
                match = true;
                break;
            }
        }

        if (match) {
            res.setHeader('access-control-allow-origin', origin);
            res.setHeader('access-control-allow-methods', '*');
            res.setHeader('access-control-allow-headers', '*');
            res.setHeader('access-control-allow-credentials', true);
        }
        else {
            res.writeHead(403, 'Access Forbidden');
            res.end();
            return;
        }

        if (req.method === 'OPTIONS') {
            res.end();
        }
    };
};
