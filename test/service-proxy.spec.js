const assert = require('assert');
const {ServiceProxy} = require('..');

describe('ServiceProxy', () => {
    it('Should instantiate service proxy', () => {
        new ServiceProxy({
            common: {
                auth: {
                    http: {
                        use: 'http',
                    },
                },
                order: [
                    'http',
                ],
            },
            services: {},
        });
    });

    describe('Services', () => {
        var sp;
        before(() => {
            sp = new ServiceProxy({
                common: {
                    auth: {
                        http: {
                            use: 'http',
                            username: 'user',
                            password: 'password',
                        },
                    },
                    order: [
                        'http',
                    ],
                },
            });
        });

        it('#addService should add service', () => {
            var auth = {
                order: [
                    'http'
                ],
                authOnly: false,
            };

            sp.addService('test', auth);

            assert.deepEqual(sp.getService('test'), auth, 'Options match');
        });

        it('#hasService should return false if service not exists', () => {
            assert.ok(! sp.hasService('unknown_Service'), 'Service not exists');
        });

        it('#getService should throw an errror if service not exists', () => {
            assert.throws(() => {
                sp.getService('unknown-service');
            }, /Service/, 'Service not found error');
        });

        it('#findService should return undefined if service not exists', () => {
            assert.equal(sp.findService('unknown'), undefined, 'Return undefined')
        });

        it('#removeService should remove service', () => {
            var name = 'remove';
            sp.addService(name, {
                auth: {},
            });

            sp.removeService(name);
            assert.ok(!sp.hasService(name), 'Service removed');
        });

        it('#getOrderedAuth should return an array of functions', () => {
            var auth = sp.getOrderedAuth('test');

            assert.ok(Array.isArray(auth), 'Result is an array');
            assert.equal(auth.length, 1, 'It has one auth middleware');
        });
    });
});
