# Changelog

## [4.3.0](https://github.com/postalsys/gettext/compare/v4.2.0...v4.3.0) (2026-10-19)


### Features

* add a .mo catalog reader ([4597e71](https://github.com/postalsys/gettext/commit/4597e71ab1b5399df28b8fd71fc3c1fb08c3b9ca))


### Bug Fixes

* decode windows-1252 catalogs the same way on Node 20 ([484cdd8](https://github.com/postalsys/gettext/commit/484cdd8bbc1bd2cc065fd2c4d356294513964f81))

## [4.2.0](https://github.com/postalsys/gettext/compare/v4.1.2...v4.2.0) (2026-10-19)


### Features

* migrate to TypeScript with ES module and CommonJS builds ([541aec3](https://github.com/postalsys/gettext/commit/541aec3be5295e662e811391b24a40066b425ce5))

## [4.1.2](https://github.com/postalsys/gettext/compare/v4.1.1...v4.1.2) (2026-10-19)


### Bug Fixes

* name the received type and the right method in invalid argument warnings ([467e1ef](https://github.com/postalsys/gettext/commit/467e1efb8c9fbe81f27cfb5270fc1bbb28bff576))
* read plural forms from the catalog header for languages missing from the plural table ([defa77a](https://github.com/postalsys/gettext/commit/defa77a68d1ad9329a575f2432ad950f9c8ee1b0))
* resolve msgids named after Object.prototype members through own properties only ([fb60db7](https://github.com/postalsys/gettext/commit/fb60db7b1e696d9fc5878ee794c8fcc666006290))

## [4.1.1](https://github.com/postalsys/gettext/compare/v4.1.0...v4.1.1) (2026-01-05)


### Bug Fixes

* **dependencies:** remove `lodash.get` ([#4](https://github.com/postalsys/gettext/issues/4)) ([bbbad07](https://github.com/postalsys/gettext/commit/bbbad07d01a5248ebf47d45200cd0611fc3a619c))

## [4.1.0](https://github.com/postalsys/gettext/compare/v4.0.1...v4.1.0) (2025-06-13)


### Features

* gt.useLocale(locale) ([7e1e4de](https://github.com/postalsys/gettext/commit/7e1e4debfe22d95044e38c01250dbf0ed011386b))

## [4.0.1](https://github.com/postalsys/gettext/compare/v4.0.0...v4.0.1) (2024-10-15)


### Bug Fixes

* **addTranslations:** Fixed domain value check ([c2bf8dc](https://github.com/postalsys/gettext/commit/c2bf8dc8266e2eca748324bb2fc22a24f03beade))

## 4.0.0 (2024-09-19)


### Features

* automatic release process ([a92527e](https://github.com/postalsys/gettext/commit/a92527ea13646b884212383708ecc685de7d1d42))


### Bug Fixes

* **security:** Fixed GHSA-g974-hxvm-x689 ([63e627c](https://github.com/postalsys/gettext/commit/63e627cece1592d03abadf36044c957b801c7315))


### Miscellaneous Chores

* release 4.0.0 ([1eab5ea](https://github.com/postalsys/gettext/commit/1eab5ea44631f063450018d246e0c54f3f505299))

## v1.1.0

  * Adds support for adding a textdomain from an already parsed json object

## v1.0.0 2015-01-21

  * Bumped version to 1.0.0 to be compatible with semver
  * Removed built in parser/compiler in favor of gettext-parser module
  * Moved tests from nodeunit to mocha
