import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// The suite runs through tsx, which strips the types instead of checking them, and `npm run
// typecheck` checks the types in src/. These tests type-check consumers against the built
// declarations in dist/ the way an installed copy is resolved: the package is linked into a
// temporary project so that the specifiers go through the package.json exports map.
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tsc = require.resolve('typescript/bin/tsc');

const hasDist = fs.existsSync(path.join(root, 'dist', 'cjs', 'gettext.d.ts')) && fs.existsSync(path.join(root, 'dist', 'esm', 'gettext.d.ts'));

// The documented API and the way EmailEngine calls it
const consumer = `
import Gettext, { parseMo } from '@postalsys/gettext';
import type { Catalog, GettextOptions, LocaleGettext, MoCatalog, MoTranslation, PluralRule, Translation } from '@postalsys/gettext';
import plurals from '@postalsys/gettext/lib/plurals';
import { parsePluralForms, DEFAULT_PLURAL_FORMS } from '@postalsys/gettext/lib/plural-forms';

const options: GettextOptions = { sourceLocale: 'en', debug: false };
const gt = new Gettext(options);
new Gettext();

const entry: Translation = { msgid: 'file', msgid_plural: 'files', msgstr: ['fail', 'faili'], comments: { translator: 'note' } };
const catalog: Catalog = { charset: 'utf-8', headers: { 'plural-forms': 'nplurals=2; plural=(n != 1);' }, translations: { '': { file: entry } } };
gt.addTranslations('et', 'messages', catalog);
gt.setLocale('et');
gt.setTextDomain('messages');
gt.on('error', (err: Error) => err.message);
gt.off('error', () => undefined);

declare const moFile: Buffer;
const moCatalog: MoCatalog = parseMo(moFile);
const moEntry: MoTranslation | undefined = Gettext.parseMo(new Uint8Array(moFile), 'utf-8').translations['']?.['file'];
gt.addTranslations('et', 'messages', moCatalog);
const moHeaders: Record<string, string> | undefined = moCatalog.headers;

const code: string = Gettext.getLanguageCode('et-EE');
const local: LocaleGettext = gt.useLocale(code);
const strings: string[] = [
    gt.gettext('file'),
    gt.dgettext('messages', 'file'),
    gt.ngettext('file', 'files', 2),
    gt.dngettext('messages', 'file', 'files', 2),
    gt.pgettext('ctx', 'file'),
    gt.dpgettext('messages', 'ctx', 'file'),
    gt.npgettext('ctx', 'file', 'files', 2),
    gt.dnpgettext('messages', 'ctx', 'file'),
    gt.dnpgettext('messages', 'ctx', 'file', 'files', 2),
    local.gettext('file'),
    local.ngettext('file', 'files', 2)
];
const translator: string | undefined = gt.getComment('messages', '', 'file').translator;

const rule: PluralRule | undefined = plurals['et'];
const index: number | boolean | undefined = rule?.pluralsFunc(2);
const parsed: number | undefined = parsePluralForms('nplurals=2; plural=n>1;')?.pluralsFunc(2);
const fallback: number = DEFAULT_PLURAL_FORMS.nplurals;
export const all = [strings, translator, index, parsed, fallback, moEntry, moHeaders];
`;

// exactOptionalPropertyTypes consumers can pass an explicit undefined for every option
const exactOptionalConsumer = `
import Gettext from '@postalsys/gettext';
declare const maybe: string | undefined;
new Gettext({ sourceLocale: maybe, debug: undefined });
new Gettext(null);
`;

// A plural table entry has to be complete
const malformedPluralRule = `
import plurals from '@postalsys/gettext/lib/plurals';
plurals['xx'] = { name: 'Test', examples: [], nplurals: 2, pluralsFunc: (n: number) => n > 1 };
`;

// Compiles to require('@postalsys/gettext').default, the non-enumerable alias the build adds
const cjsConsumer = `
import Gettext from '@postalsys/gettext';
const gt = new Gettext();
export const text: string = gt.useLocale('et').gettext('file');
`;

// The internals exist at runtime but are stripped from the declarations
const internalConsumer = `
import Gettext from '@postalsys/gettext';
const gt = new Gettext();
gt._getCatalog('et', 'messages');
gt._ldnpgettext('et', 'messages', '', 'file');
`;

const node16 = { module: 'node16', moduleResolution: 'node16' };
const resolutions: Array<{ name: string; compilerOptions: { [key: string]: unknown }; type?: string }> = [
    { name: 'node16 ES module project', compilerOptions: node16, type: 'module' },
    { name: 'node16 CommonJS project', compilerOptions: node16 },
    { name: 'bundler resolution', compilerOptions: { module: 'esnext', moduleResolution: 'bundler' }, type: 'module' }
];

// Type-checks consumer sources against the built declarations. With expectedErrors the consumer
// must fail to compile, and every listed message must be among the errors
function typeCheckConsumer(sources: string | string[], compilerOptions: { [key: string]: unknown }, type?: string, expectedErrors?: string[]): void {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gettext-types-'));
    try {
        fs.mkdirSync(path.join(dir, 'node_modules', '@types'), { recursive: true });
        fs.mkdirSync(path.join(dir, 'node_modules', '@postalsys'), { recursive: true });
        // link the package and what a real consumer has installed next to it
        fs.symlinkSync(root, path.join(dir, 'node_modules', '@postalsys', 'gettext'), 'dir');
        fs.symlinkSync(path.join(root, 'node_modules', '@types', 'node'), path.join(dir, 'node_modules', '@types', 'node'), 'dir');
        fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'consumer', private: true, ...(type ? { type } : {}) }));
        const files = (Array.isArray(sources) ? sources : [sources]).map((source, index) => {
            const name = `consumer${index}.ts`;
            fs.writeFileSync(path.join(dir, name), source);
            return name;
        });
        fs.writeFileSync(
            path.join(dir, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: {
                    target: 'ES2022',
                    lib: ['ES2023'],
                    types: ['node'],
                    strict: true,
                    exactOptionalPropertyTypes: true,
                    noEmit: true,
                    skipLibCheck: true,
                    esModuleInterop: true,
                    ...compilerOptions
                },
                include: files
            })
        );

        const result = spawnSync(process.execPath, [tsc, '-p', path.join(dir, 'tsconfig.json')], { encoding: 'utf8' });
        const output = result.stdout + result.stderr;
        if (expectedErrors) {
            assert.notStrictEqual(result.status, 0, 'tsc accepted a consumer that must not compile');
            for (const expected of expectedErrors) {
                assert.ok(output.includes(expected), `tsc did not report "${expected}"\n${output}`);
            }
            return;
        }
        assert.strictEqual(result.status, 0, `tsc reported\n${output}`);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

describe('Built package types', { timeout: 120 * 1000, skip: hasDist ? false : 'dist/ is not built, run npm run build first' }, () => {
    for (const resolution of resolutions) {
        it(`type-checks a consumer with ${resolution.name}`, () => {
            typeCheckConsumer([consumer, exactOptionalConsumer], resolution.compilerOptions, resolution.type);
        });
    }

    it('type-checks a CommonJS consumer without esModuleInterop', () => {
        typeCheckConsumer(cjsConsumer, { ...node16, esModuleInterop: false, ignoreDeprecations: '6.0' });
    });

    it('rejects an incomplete plural table entry', () => {
        typeCheckConsumer(malformedPluralRule, node16, 'module', ["Property 'pluralsText' is missing"]);
    });

    it('strips the internal members from the declarations', () => {
        typeCheckConsumer(internalConsumer, node16, 'module', [
            "Property '_getCatalog' does not exist on type 'Gettext'",
            "Property '_ldnpgettext' does not exist on type 'Gettext'"
        ]);
    });
});
