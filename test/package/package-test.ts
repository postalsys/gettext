import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// These tests exercise the compiled output in dist/ (built by the pretest script) through the
// package.json exports map, the same way an installed copy of the package is loaded. Node resolves
// the package name to the package itself when the specifier is used from inside the package.
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

// Non-literal specifiers keep TypeScript from resolving the built types at type-check time, when
// dist/ may not exist yet
const packageName: string = '@postalsys/gettext';

const MODULES = ['gettext', 'plural-forms', 'plurals'];

const hasDist = MODULES.every(
    name => fs.existsSync(path.join(root, 'dist', 'cjs', `${name}.js`)) && fs.existsSync(path.join(root, 'dist', 'esm', `${name}.js`))
);

// Every method of the pre-TypeScript CommonJS class
const GETTEXT_METHODS = [
    'on',
    'off',
    'emit',
    'warn',
    'addTranslations',
    'setLocale',
    'setTextDomain',
    'gettext',
    'dgettext',
    'ngettext',
    'dngettext',
    'pgettext',
    'dpgettext',
    'npgettext',
    'dnpgettext',
    'useLocale',
    'getComment',
    '_ldnpgettext',
    '_getTranslation',
    '_getCatalog',
    '_getPluralIndex'
];

describe('Built package', { timeout: 30 * 1000, skip: hasDist ? false : 'dist/ is not built, run npm run build first' }, () => {
    it('ships both module formats with type declarations', () => {
        for (const format of ['esm', 'cjs']) {
            for (const name of MODULES) {
                for (const file of [`${name}.js`, `${name}.d.ts`]) {
                    assert.ok(fs.existsSync(path.join(root, 'dist', format, file)), `${format}/${file}`);
                }
            }
        }
        assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(root, 'dist', 'esm', 'package.json'), 'utf8')), { type: 'module' });
        assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(root, 'dist', 'cjs', 'package.json'), 'utf8')), { type: 'commonjs' });
    });

    it('points main, types and every exports entry at an existing file', () => {
        assert.strictEqual(pkg.main, './dist/cjs/gettext.js');
        assert.strictEqual(pkg.exports['.'].require, './dist/cjs/gettext.js');
        assert.strictEqual(pkg.exports['.'].import, './dist/esm/gettext.js');
        assert.ok(fs.existsSync(path.join(root, pkg.types)));
        for (const [subpath, entry] of Object.entries(pkg.exports)) {
            const targets = typeof entry === 'string' ? [entry] : Object.values(entry as Record<string, string>);
            for (const target of targets) {
                assert.ok(fs.existsSync(path.join(root, target)), `${subpath} points at a missing file ${target}`);
            }
        }
    });

    it('packs the build and leaves the sources and tests out', () => {
        // Packs a copy without the lifecycle scripts: prepare would rebuild dist/ under the test
        // files running in parallel, and npm 10 (Node 20 and 22) runs it on pack even with
        // --ignore-scripts
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gettext-pack-'));
        let files: string[];
        try {
            fs.cpSync(root, dir, { recursive: true, filter: source => !/^(node_modules|\.git|coverage)$/.test(path.relative(root, source)) });
            const { scripts: _scripts, ...manifest } = pkg;
            fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest, null, 4));
            const result = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: dir, encoding: 'utf8' });
            assert.strictEqual(result.status, 0, result.stderr);
            files = JSON.parse(result.stdout)[0].files.map((file: { path: string }) => file.path);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
        for (const name of MODULES) {
            for (const format of ['cjs', 'esm']) {
                assert.ok(files.includes(`dist/${format}/${name}.js`), `dist/${format}/${name}.js is packed`);
                assert.ok(files.includes(`dist/${format}/${name}.d.ts`), `dist/${format}/${name}.d.ts is packed`);
            }
        }
        assert.ok(files.includes('dist/cjs/package.json'));
        assert.ok(files.includes('dist/esm/package.json'));
        for (const file of files) {
            assert.ok(!/^(src|test|scripts|lib|docs|coverage)\//.test(file), `${file} must not be packed`);
        }
    });

    it('keeps ES module syntax out of the CommonJS build', () => {
        // The CommonJS build must not reach ES module code, see the platform constraints in CLAUDE.md
        for (const name of MODULES) {
            const cjs = fs.readFileSync(path.join(root, 'dist', 'cjs', `${name}.js`), 'utf8');
            assert.doesNotMatch(cjs, /\bimport\s*\(/, name);
            assert.doesNotMatch(cjs, /import\.meta/, name);
        }
    });

    describe('CommonJS build', () => {
        it('resolves require() to the CommonJS entry point', () => {
            assert.strictEqual(require.resolve(packageName), path.join(root, 'dist', 'cjs', 'gettext.js'));
        });

        it('returns the Gettext class itself, as module.exports = Gettext did', () => {
            const Gettext = require(packageName);
            assert.strictEqual(typeof Gettext, 'function');
            assert.strictEqual(Gettext.name, 'Gettext');
            assert.strictEqual(typeof Gettext.getLanguageCode, 'function');
            for (const method of GETTEXT_METHODS) {
                assert.strictEqual(typeof Gettext.prototype[method], 'function', method);
            }
            // transpiled `import Gettext from '@postalsys/gettext'` reads .default; it must not show up as a key
            assert.strictEqual(Gettext.default, Gettext);
            assert.deepStrictEqual(Object.keys(Gettext), ['parseMo']);
            // the named parseMo export of the ES module build, reachable through destructuring
            const { parseMo } = require(packageName);
            assert.strictEqual(parseMo, Gettext.parseMo);
            assert.strictEqual(typeof parseMo, 'function');
            assert.deepStrictEqual(Object.keys(new Gettext()), ['catalogs', 'locale', 'domain', 'listeners', 'sourceLocale', 'debug']);
        });

        it('keeps the lib/ deep imports of the JavaScript package working', () => {
            const Gettext = require(packageName);
            for (const name of ['lib/gettext', 'lib/gettext.js']) {
                assert.strictEqual(require(`${packageName}/${name}`), Gettext, name);
            }
            const plurals = require(`${packageName}/lib/plurals`);
            assert.strictEqual(require(`${packageName}/lib/plurals.js`), plurals);
            assert.strictEqual(plurals.ru.nplurals, 3);
            assert.deepStrictEqual(Object.keys(plurals.ru), ['name', 'examples', 'nplurals', 'pluralsText', 'pluralsFunc']);
            for (const name of ['lib/plural-forms', 'lib/plural-forms.js']) {
                const pluralForms = require(`${packageName}/${name}`);
                assert.deepStrictEqual(Object.keys(pluralForms).sort(), ['DEFAULT_PLURAL_FORMS', 'parsePluralForms'], name);
                assert.strictEqual(pluralForms.parsePluralForms('nplurals=2; plural=n>1;').pluralsFunc(2), 1, name);
            }
            assert.strictEqual(require(`${packageName}/package.json`).name, packageName);
        });

        it('returns the plural table as a plain object keyed by language code only', () => {
            // a `default` alias here would make Gettext treat "default" as a known language
            const plurals = require(`${packageName}/lib/plurals`);
            assert.ok(!Object.hasOwn(plurals, 'default'));
            assert.ok(!Object.hasOwn(plurals, '__esModule'));
            assert.ok(Object.keys(plurals).every(code => /^[a-z]{2,3}$/.test(code)));

            const Gettext = require(packageName);
            const gt = new Gettext();
            gt.addTranslations('default', 'messages', {
                headers: { 'plural-forms': 'nplurals=3; plural=2;' },
                translations: { '': { file: { msgid: 'file', msgstr: ['form0', 'form1', 'form2'] } } }
            });
            assert.strictEqual(gt.useLocale('default').ngettext('file', 'files', 1), 'form2');
        });

        it('shares the plural table between the entry point and the deep import', () => {
            const Gettext = require(packageName);
            const plurals = require(`${packageName}/lib/plurals`);
            const gt = new Gettext();
            gt.addTranslations('qq', 'messages', { translations: { '': { file: { msgid: 'file', msgstr: ['form0', 'form1', 'form2'] } } } });
            plurals.qq = { name: 'Test', examples: [], nplurals: 3, pluralsText: 'nplurals = 3; plural = 2', pluralsFunc: () => 2 };
            try {
                assert.strictEqual(gt.useLocale('qq').ngettext('file', 'files', 1), 'form2');
            } finally {
                delete plurals.qq;
            }
        });

        it('reaches every CommonJS module from the entry point', () => {
            // pkg follows the exports map only for ES modules, a CommonJS deep import such as
            // @postalsys/gettext/lib/plurals is resolved inside the binary from the files the entry
            // point pulled in. A module that only a deep import reaches would be missing from it
            const script = `require(${JSON.stringify(path.join(root, pkg.main))}); console.log(JSON.stringify(Object.keys(require.cache)))`;
            const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
            assert.strictEqual(result.status, 0, result.stderr);
            const loaded = new Set(JSON.parse(result.stdout));
            const cjsRoot = path.join(root, 'dist', 'cjs');
            for (const file of fs.readdirSync(cjsRoot).filter(name => name.endsWith('.js'))) {
                assert.ok(loaded.has(path.join(cjsRoot, file)), `${file} is not loaded by the entry point`);
            }
        });
    });

    describe('ES module build', () => {
        it('resolves import to the ES module entry point', async () => {
            const direct = await import(new URL('../../dist/esm/gettext.js', import.meta.url).href);
            const byName = await import(packageName);
            assert.strictEqual(byName.default, direct.default);
            assert.notStrictEqual(byName.default, require(packageName));
        });

        it('has the Gettext class and parseMo as its runtime exports', async () => {
            const mod = await import(packageName);
            assert.deepStrictEqual(Object.keys(mod).sort(), ['default', 'parseMo']);
            assert.strictEqual(mod.parseMo, mod.default.parseMo);
            const Gettext = mod.default;
            assert.strictEqual(Gettext.name, 'Gettext');
            for (const method of GETTEXT_METHODS) {
                assert.strictEqual(typeof Gettext.prototype[method], 'function', method);
            }
            const gt = new Gettext();
            gt.addTranslations('et', 'messages', { translations: { '': { o1: { msgid: 'o1', msgstr: ['t1'] } } } });
            assert.strictEqual(gt.useLocale('et').gettext('o1'), 't1');
        });

        it('exposes the deep imports', async () => {
            const { default: Gettext } = await import(packageName);
            assert.strictEqual((await import(packageName + '/lib/gettext.js')).default, Gettext);
            assert.strictEqual((await import(packageName + '/lib/gettext')).default, Gettext);
            const plurals = await import(packageName + '/lib/plurals');
            assert.strictEqual(plurals.default.pl.nplurals, 3);
            const pluralForms = await import(packageName + '/lib/plural-forms.js');
            assert.strictEqual(typeof pluralForms.parsePluralForms, 'function');
            assert.strictEqual(pluralForms.DEFAULT_PLURAL_FORMS.nplurals, 2);
        });
    });
});
