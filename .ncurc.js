'use strict';

module.exports = {
    upgrade: true,
    // This package is consumed by EmailEngine, which is bundled into standalone
    // binaries with @yao-pkg/pkg and only supports CommonJS. Reject upgrades of
    // any dependency that moves to pure ESM.
    reject: []
};
