import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Gettext from '../src/gettext.js';
import plurals from '../src/plurals.js';
import { parsePluralForms as parseOrNull } from '../src/plural-forms.js';
import type { PluralForms } from '../src/plural-forms.js';
import type { Catalog } from '../src/gettext.js';

// The rules under test parse, the assertions on the ones that must not still see the null
const parsePluralForms = (header: unknown) => parseOrNull(header) as PluralForms;

// src/plurals.ts writes its rules with JavaScript equality operators, catalogs use the C ones
const toCHeader = (pluralsText: string) => `${pluralsText.replaceAll('===', '==').replaceAll('!==', '!=')};`;

const tableIndex = (language: string, n: number) => {
    const index = plurals[language]!.pluralsFunc(n);
    return typeof index === 'boolean' ? Number(index) : index;
};

// Plural-Forms headers as they appear in real catalogs for these languages
const GNU_HEADERS: Record<string, string> = {
    pl: 'nplurals=3; plural=(n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);',
    ru: 'nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);',
    ar: 'nplurals=6; plural=(n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 ? 4 : 5);',
    cs: 'nplurals=3; plural=(n==1) ? 0 : (n>=2 && n<=4) ? 1 : 2;',
    ga: 'nplurals=5; plural=n==1 ? 0 : n==2 ? 1 : n<7 ? 2 : n<11 ? 3 : 4;',
    sl: 'nplurals=4; plural=(n%100==1 ? 0 : n%100==2 ? 1 : n%100==3 || n%100==4 ? 2 : 3);'
};

describe('Plural-Forms evaluator', () => {
    it('should agree with src/plurals.ts for every language for n in 0..200', () => {
        for (const language of Object.keys(plurals)) {
            const rule = parsePluralForms(toCHeader(plurals[language].pluralsText));
            assert.ok(rule, `rule for ${language} should parse`);
            assert.strictEqual(rule.nplurals, plurals[language].nplurals, language);
            for (let n = 0; n <= 200; n++) {
                assert.strictEqual(rule.pluralsFunc(n), tableIndex(language, n), `${language} n=${n}`);
            }
        }
    });

    it('should agree with src/plurals.ts for real catalog headers (Polish, Russian, Arabic, Czech, Irish, Slovenian)', () => {
        for (const [language, header] of Object.entries(GNU_HEADERS)) {
            const rule = parsePluralForms(header);
            assert.ok(rule, `rule for ${language} should parse`);
            assert.strictEqual(rule.nplurals, plurals[language].nplurals, language);
            for (let n = 0; n <= 200; n++) {
                assert.strictEqual(rule.pluralsFunc(n), tableIndex(language, n), `${language} n=${n}`);
            }
        }
    });

    it('should turn comparisons and logical operators into 0 or 1', () => {
        const rule = parsePluralForms('nplurals=3; plural=(n > 1) + (n > 5);');
        assert.deepStrictEqual([0, 1, 2, 5, 6, 100].map(rule.pluralsFunc), [0, 0, 1, 1, 2, 2]);
        assert.deepStrictEqual([0, 1, 2].map(parsePluralForms('nplurals=2; plural=!n;').pluralsFunc), [1, 0, 0]);
        assert.deepStrictEqual([0, 1, 7].map(parsePluralForms('nplurals=2; plural=n && 7 || 0;').pluralsFunc), [0, 1, 1]);
    });

    it('should apply C precedence and associativity', () => {
        assert.strictEqual(parsePluralForms('nplurals=9; plural=2 + 3 * 2;').pluralsFunc(0), 8);
        assert.strictEqual(parsePluralForms('nplurals=9; plural=8 - 3 - 2;').pluralsFunc(0), 3);
        assert.strictEqual(parsePluralForms('nplurals=9; plural=n / 2 / 2;').pluralsFunc(30), 7);
        assert.strictEqual(parsePluralForms('nplurals=9; plural=n == 1 ? 0 : n == 2 ? 1 : 2;').pluralsFunc(2), 1);
        assert.strictEqual(parsePluralForms('nplurals=9; plural=1 < 2 == 1;').pluralsFunc(0), 1);
    });

    it('should clamp the index to [0, nplurals - 1]', () => {
        assert.strictEqual(parsePluralForms('nplurals=2; plural=n * 5;').pluralsFunc(3), 1);
        assert.strictEqual(parsePluralForms('nplurals=3; plural=0 - 5;').pluralsFunc(1), 0);
        assert.strictEqual(parsePluralForms('nplurals=3; plural=n % 0;').pluralsFunc(4), 0);
        assert.strictEqual(parsePluralForms('nplurals=3; plural=n / 0;').pluralsFunc(4), 0);
        assert.strictEqual(parsePluralForms('nplurals=1; plural=0;').pluralsFunc(42), 0);
    });

    it('should accept headers without trailing semicolon, with extra whitespace or in either key order', () => {
        assert.strictEqual(parsePluralForms('nplurals=2; plural=(n != 1)').pluralsFunc(2), 1);
        assert.strictEqual(parsePluralForms('  nplurals = 2 ;  plural = ( n != 1 ) ;  ').pluralsFunc(1), 0);
        assert.strictEqual(parsePluralForms('plural=(n > 1); nplurals=2;').pluralsFunc(1), 0);
    });

    it('should reject malformed headers', () => {
        const malformed = [
            undefined,
            null,
            42,
            '',
            'nplurals=2;',
            'plural=(n != 1);',
            'nplurals=0; plural=0;',
            'nplurals=x; plural=0;',
            'nplurals=-2; plural=0;',
            'nplurals=2.5; plural=0;',
            'nplurals=99; plural=0;',
            'nplurals=2; plural=;',
            'nplurals=2; plural=(n != 1;',
            'nplurals=2; plural=n != 1);',
            'nplurals=2; plural=n !=;',
            'nplurals=2; plural=n ? 1;',
            'nplurals=2; plural=n 1;',
            'nplurals=2; plural=-n;',
            'nplurals=2; plural=n = 1;',
            'nplurals=2; plural=n++;',
            'nplurals=2; plural=0x10;',
            'nplurals=2; plural=1e3;',
            'nplurals=2; plural=1.5;',
            'nplurals=2; plural=n, 1;',
            'nplurals=2; plural=n & 1;',
            'nplurals=2; plural=n | 1;',
            'nplurals=2; plural=n ^ 1;',
            'nplurals=2; plural=~n;',
            'nplurals=2; plural=n << 1;',
            'nplurals=2; plural=N != 1;',
            'nplurals=2; plural=nn;',
            'nplurals=2; plural=1234567890;',
            'nplurals=2; plural=n != 1; garbage',
            // anything that is code rather than arithmetic on n
            'nplurals=2; plural=process.exit(1);',
            'nplurals=2; plural=this;',
            'nplurals=2; plural=constructor;',
            "nplurals=2; plural=require('fs');",
            'nplurals=2; plural=`n`;',
            'nplurals=2; plural=n/**/;',
            'nplurals=2; plural=(() => 1)();'
        ];
        for (const header of malformed) {
            assert.strictEqual(parsePluralForms(header), null, String(header));
        }
    });

    it('should reject oversized and too deeply nested expressions', () => {
        const long = `nplurals=2; plural=${'n + '.repeat(200)}n;`;
        assert.strictEqual(parsePluralForms(long), null);

        const deep = (depth: number) => `nplurals=2; plural=${'('.repeat(depth)}n != 1${')'.repeat(depth)};`;
        assert.strictEqual(parsePluralForms(deep(10)).pluralsFunc(2), 1);
        assert.strictEqual(parsePluralForms(deep(100)), null);
        assert.strictEqual(parsePluralForms(`nplurals=2; plural=${'!'.repeat(100)}n;`), null);
        assert.strictEqual(parsePluralForms(`nplurals=2; plural=${'n ? '.repeat(60)}1${' : 0'.repeat(60)};`), null);
    });

    it('should not throw for non-numeric or unusual counts', () => {
        const rule = parsePluralForms(GNU_HEADERS.pl);
        for (const count of [NaN, Infinity, -Infinity, -1, 1.5, Number.MAX_VALUE]) {
            const index = rule.pluralsFunc(count);
            assert.ok(Number.isInteger(index) && index >= 0 && index < 3, `count ${count} gave ${index}`);
        }
    });
});

describe('Gettext plural forms for languages missing from src/plurals.ts', () => {
    const buildCatalog = (headers: unknown): Catalog => ({
        charset: 'utf-8',
        headers: headers as Catalog['headers'],
        translations: {
            '': {
                file: { msgid: 'file', msgid_plural: 'files', msgstr: ['form0', 'form1', 'form2'] }
            }
        }
    });

    const setup = (locale: string, headers: unknown) => {
        const gt = new Gettext();
        gt.addTranslations(locale, 'messages', buildCatalog(headers));
        gt.setLocale(locale);
        return gt;
    };

    it('should use the catalog Plural-Forms header', () => {
        const gt = setup('xx-YY', { 'plural-forms': GNU_HEADERS.pl });
        assert.deepStrictEqual(
            [1, 2, 5, 22, 25, 112].map(n => gt.ngettext('file', 'files', n)),
            ['form0', 'form1', 'form2', 'form1', 'form2', 'form2']
        );
        assert.strictEqual(gt.useLocale('xx-YY').npgettext('', 'file', 'files', 3), 'form1');
    });

    it('should read the header under either name gettext-parser uses', () => {
        const gt = setup('xx', { 'Plural-Forms': 'nplurals=3; plural=n == 0 ? 0 : n == 1 ? 1 : 2;' });
        assert.deepStrictEqual(
            [0, 1, 2].map(n => gt.ngettext('file', 'files', n)),
            ['form0', 'form1', 'form2']
        );
    });

    it('should pick up a changed header on the same catalog', () => {
        const gt = setup('xx', { 'plural-forms': 'nplurals=2; plural=0;' });
        assert.strictEqual(gt.ngettext('file', 'files', 5), 'form0');
        gt.catalogs.xx!.messages!.headers!['plural-forms'] = 'nplurals=3; plural=2;';
        assert.strictEqual(gt.ngettext('file', 'files', 5), 'form2');
    });

    it('should fall back to n != 1 when the header is missing or malformed', () => {
        for (const headers of [undefined, {}, { 'plural-forms': 'nplurals=3; plural=process.exit(1);' }, { 'plural-forms': 42 }]) {
            const gt = setup('xx', headers);
            assert.deepStrictEqual(
                [0, 1, 2].map(n => gt.ngettext('file', 'files', n)),
                ['form1', 'form0', 'form1']
            );
        }
    });

    it('should not treat a language code named after an Object.prototype member as a known language', () => {
        const gt = setup('constructor_US', { 'plural-forms': 'nplurals=3; plural=2;' });
        assert.strictEqual(gt.ngettext('file', 'files', 1), 'form2');
    });

    it('should not throw for non-numeric counts', () => {
        for (const locale of ['xx', 'pl']) {
            const gt = setup(locale, { 'plural-forms': GNU_HEADERS.pl });
            for (const count of ['5', null, undefined, {}, [], true, NaN, Infinity, -3, 2.5, Symbol('n'), 10n]) {
                const result = gt.ngettext('file', 'files', count as any);
                assert.ok(['form0', 'form1', 'form2'].includes(result), `${locale} ${String(count)} gave ${result}`);
            }
            // nothing translated: the singular or plural msgid comes back instead
            assert.strictEqual(gt.ngettext('missing', 'missings', Symbol('n') as any), 'missing');
            assert.strictEqual(gt.ngettext('missing', 'missings', 10n as any), 'missing');
            assert.strictEqual(gt.ngettext('missing', 'missings', '5' as any), 'missings');
        }
    });
});
