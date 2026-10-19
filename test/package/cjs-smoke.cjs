'use strict';

// CommonJS smoke test for the built package, run by `npm run test:cjs` as plain Node with
// NODE_OPTIONS=--no-experimental-require-module. EmailEngine bundles @postalsys/gettext into a
// @yao-pkg/pkg binary that can only load a CommonJS module graph, and Node 22+ enables
// require(esm) by default, which would hide an ES module reached through require(). With the
// flag set, such a module throws ERR_REQUIRE_ESM here instead of in the binary. Kept as plain
// JavaScript on purpose: running it through tsx would let its loader transpile an ES module to
// CommonJS and mask exactly the failure this guards against.

const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

const Gettext = require('@postalsys/gettext');
const catalog = require('../fixtures/latin13.json');

assert.strictEqual(require.resolve('@postalsys/gettext'), path.join(root, 'dist', 'cjs', 'gettext.js'));
assert.strictEqual(typeof Gettext, 'function');
assert.strictEqual(Gettext.name, 'Gettext');
assert.strictEqual(require('@postalsys/gettext/lib/gettext'), Gettext);
assert.strictEqual(require('@postalsys/gettext/lib/gettext.js'), Gettext);

// The deep imports of the JavaScript package, and the plural table is the one Gettext reads
const plurals = require('@postalsys/gettext/lib/plurals');
assert.strictEqual(require('@postalsys/gettext/lib/plurals.js'), plurals);
assert.strictEqual(plurals.pl.nplurals, 3);
assert.strictEqual(plurals.pl.pluralsFunc(5), 2);
const { parsePluralForms, DEFAULT_PLURAL_FORMS } = require('@postalsys/gettext/lib/plural-forms');
assert.strictEqual(require('@postalsys/gettext/lib/plural-forms.js').parsePluralForms, parsePluralForms);
assert.strictEqual(parsePluralForms('nplurals=3; plural=n%3;').pluralsFunc(5), 2);
assert.strictEqual(DEFAULT_PLURAL_FORMS.pluralsFunc(2), 1);

// The way EmailEngine uses it (lib/translations.js, workers/api.js, lib/handlebars-helpers.js):
// one shared instance, catalogs from gettext-parser, a default locale and per-request locales
const gt = new Gettext();
const errors = [];
gt.on('error', err => errors.push(err.message));
gt.addTranslations('et', 'messages', catalog);
gt.setLocale('en');
assert.strictEqual(gt.gettext('o1'), 'o1');
gt.setLocale('et');
assert.strictEqual(gt.gettext('o1'), 't1');
assert.strictEqual(gt.ngettext('o2-1', 'o2-2', 1), 't2-1');
assert.strictEqual(gt.ngettext('o2-1', 'o2-2', 5), 't2-2');

const reqLocale = Gettext.getLanguageCode('et-EE');
assert.strictEqual(reqLocale, 'et');
const localGt = gt.useLocale(reqLocale);
assert.strictEqual(localGt.gettext('o1'), 't1');
assert.strictEqual(localGt.ngettext('o2-1', 'o2-2', 2), 't2-2');
assert.strictEqual(gt.useLocale('de').gettext('missing'), 'missing');
assert.strictEqual(errors.length, 4, errors.join('\n'));

console.log('CommonJS smoke test passed (' + process.version + ', ' + (process.env.NODE_OPTIONS || 'no NODE_OPTIONS') + ')');
