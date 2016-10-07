module.exports = function(options) {
    return function(req, res) {
        if (req.auth.type !== 'bearer') {
            return;
        }

        return req.auth.payload === options.token;
    };
};
