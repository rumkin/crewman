const assert = require('assert');
const {ServiceProxy} = require('..');

describe('ServiceProxy', () => {
    it('Should instantiate service proxy', () => {
        var sp = new ServiceProxy({
            global: {
                auth: {
                    http: {
                        use: 'http',
                    },
                },
                authOrder: [
                    'http',
                ]
            },
            services: {

            }
        });
    });

    describe('Services', () => {
        var sp;
        before(() => {
            sp = new ServiceProxy();
        });

        it('#addService should add service', () => {
            var auth = {
                use: 'http-auth',
                order: [
                    'http-auth'
                ],
                authOnly: false,
            };

            sp.addService('test', auth);

            assert.deepEqual(sp.getService('test'), auth, 'Options match');
        });

        it('#hasService should return false if service nt exists', () => {
            assert.ok(! sp.hasService('unknown_Service'), 'Service not exists');
        });

        it('#removeService should remove service', () => {
            var name = 'remove';
            sp.addService(name, {
                auth: {},
            });

            sp.removeService(name);
            assert.ok(!sp.hasService(name), 'Service removed');
        });
    });
});
