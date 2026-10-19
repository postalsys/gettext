'use strict';

module.exports = {
    upgrade: true,
    // This package is consumed by EmailEngine, which is bundled into standalone
    // binaries with @yao-pkg/pkg and only supports CommonJS. Reject upgrades of
    // any dependency that moves to pure ESM.
    reject: [],
    target: name => {
        // @types/node stays on the 20.x line so the compiler rejects APIs that do
        // not exist on Node 20, the oldest supported version
        if (name === '@types/node') {
            return 'minor';
        }
        // typescript-eslint declares a peer range that excludes TypeScript 7
        if (name === 'typescript') {
            return 'minor';
        }
        return 'latest';
    }
};
