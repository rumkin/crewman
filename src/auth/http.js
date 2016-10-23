const fetch = require('node-fetch');

module.exports = function(options) {
    return function(req) {
        return fetch(options.url, {
            headers: Object.assign({}, req.headers, {
                'X-Origin-Url': req.url,
                'X-Origin-Host': req.host,
            }),
        })
        .then(
            (res) => {
                if (res.status === 200) {
                    req.headers['x-user'] = res.headers.get('x-user');
                    return true;
                }
            }
        );
    };
};
