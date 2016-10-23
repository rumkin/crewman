#!/usr/bin/env node

'use strict';

const camelcase = require('camelcase');
const argv = process.argv.slice(2);
const cliAction = camelcase(argv.shift());

const actions = {
    up(argv) {
        require('./cli-up.js')([...argv], Object.assign({}, process.env));
    },

    usage(argv) {
        console.log(`Usage is ${process.argv[0]} <action> [options]`);
    }
};

if (actions.hasOwnProperty(cliAction)) {
    actions[cliAction](argv);
}
else {
    actions.usage(argv);
}
