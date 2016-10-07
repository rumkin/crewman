module.exports = function(options) {
    return function(req, res) {
        if (req.auth.type !== 'http') {
            return;
        }

        var decoded = new Buffer(req.auth.payload, 'base64').toString('utf8');
        colon = decoded.indexOf(':');

        let username = decoded.substr(0, colon);
        let password = decoded.substr(colon + 1);

        if (username !== options.username || password !== options.password) {
            return false;
        }

        return true;
    };
};
