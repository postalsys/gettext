import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Gettext, { parseMo } from '../src/gettext.js';
import type { MoCatalog } from '../src/gettext.js';

// gettext-parser 7.0.1 (a devDependency, pinned) is the reference: parseMo() replaces its
// mo.parse() in EmailEngine, so the two have to return the same catalog for the same file
const require = createRequire(import.meta.url);
const gettextParser: { mo: { parse(buffer: Buffer, defaultCharset?: string): any } } = require('gettext-parser');

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

// test/fixtures/emailengine/ holds copies of EmailEngine's compiled catalogs. A checkout of
// EmailEngine next to this repository is compared as well, so a catalog newer than the copies
// is covered when it exists.
const emailEngineTranslations = path.resolve(fixtures, '..', '..', '..', 'emailengine', 'translations');

function listMo(dir: string): string[] {
    return fs
        .readdirSync(dir)
        .filter(name => name.endsWith('.mo'))
        .map(name => path.join(dir, name));
}

const MO_FILES = [
    ...listMo(fixtures),
    ...listMo(path.join(fixtures, 'emailengine')),
    ...(fs.existsSync(emailEngineTranslations) ? listMo(emailEngineTranslations) : [])
];

type Entry = [msgid: string | Buffer, msgstr: string | Buffer];

/** Writes a .mo file from raw entries, in either byte order, with no hash table */
function writeMo(entries: Entry[], { bigEndian = false } = {}): Buffer {
    const strings = entries.map(([msgid, msgstr]) => [Buffer.from(msgid), Buffer.from(msgstr)] as const);
    const originalsOffset = 28;
    const translationsOffset = originalsOffset + entries.length * 8;
    let position = translationsOffset + entries.length * 8;

    const parts: Buffer[] = [];
    const header = Buffer.alloc(position);
    const write = (value: number, offset: number) => (bigEndian ? header.writeUInt32BE(value, offset) : header.writeUInt32LE(value, offset));
    write(0x950412de, 0);
    write(0, 4);
    write(entries.length, 8);
    write(originalsOffset, 12);
    write(translationsOffset, 16);
    for (const column of [0, 1]) {
        strings.forEach((pair, i) => {
            const str = pair[column] as Buffer;
            write(str.length, (column ? translationsOffset : originalsOffset) + i * 8);
            write(position, (column ? translationsOffset : originalsOffset) + i * 8 + 4);
            parts.push(str, Buffer.alloc(1));
            position += str.length + 1;
        });
    }
    return Buffer.concat([header, ...parts]);
}

function header(charset: string): string {
    return `Language: xx\nContent-Type: text/plain; charset=${charset}\n`;
}

/** Parses with both parsers and asserts the results are equal, returning parseMo()'s */
function compare(buffer: Buffer, defaultCharset?: string): MoCatalog {
    const expected = defaultCharset === undefined ? gettextParser.mo.parse(buffer) : gettextParser.mo.parse(buffer, defaultCharset);
    const actual = defaultCharset === undefined ? parseMo(buffer) : parseMo(buffer, defaultCharset);
    assert.deepStrictEqual(actual, expected);
    return actual;
}

describe('parseMo', () => {
    it('is the named export and Gettext.parseMo', () => {
        assert.strictEqual(typeof parseMo, 'function');
        assert.strictEqual(Gettext.parseMo, parseMo);
    });

    describe('matches gettext-parser 7.0.1 mo.parse()', () => {
        it('finds the catalogs to compare', () => {
            // the fixtures (6) and the EmailEngine copies (11)
            assert.ok(MO_FILES.length >= 17, MO_FILES.join('\n'));
        });

        for (const file of MO_FILES) {
            it(path.relative(path.join(fixtures, '..', '..'), file), () => {
                compare(fs.readFileSync(file));
            });
        }

        it('reads contexts and plurals', () => {
            const catalog = compare(fs.readFileSync(path.join(fixtures, 'mo-features.mo')));
            assert.strictEqual(catalog.charset, 'utf-8');
            assert.strictEqual(catalog.headers?.Language, 'pl');
            assert.strictEqual(catalog.headers?.['X-Custom'], 'a: value: with colons');
            assert.deepStrictEqual(catalog.translations.menu?.Open, { msgctxt: 'menu', msgid: 'Open', msgstr: ['Otwórz'] });
            assert.deepStrictEqual(catalog.translations.door?.Open, { msgctxt: 'door', msgid: 'Open', msgstr: ['Otwarte'] });
            assert.deepStrictEqual(catalog.translations['']?.['One file'], {
                msgid: 'One file',
                msgid_plural: '%d files',
                msgstr: ['Jeden plik', '%d pliki', '%d plików']
            });
            assert.deepStrictEqual(catalog.translations.inbox?.['One message']?.msgstr, ['Jedna wiadomość', '%d wiadomości', '%d wiadomości']);
        });

        it('reads a big-endian file the same as a little-endian one', () => {
            const big = fs.readFileSync(path.join(fixtures, 'mo-features-be.mo'));
            assert.strictEqual(big.readUInt32BE(0), 0x950412de);
            assert.deepStrictEqual(compare(big), parseMo(fs.readFileSync(path.join(fixtures, 'mo-features.mo'))));
        });

        it('decodes the charset from the header', () => {
            assert.strictEqual(compare(fs.readFileSync(path.join(fixtures, 'mo-koi8r.mo'))).translations['']?.Hello?.msgstr[0], 'Привет');
            assert.strictEqual(compare(fs.readFileSync(path.join(fixtures, 'mo-latin1.mo'))).translations['']?.Summer?.msgstr[0], 'Été');
            assert.strictEqual(compare(fs.readFileSync(path.join(fixtures, 'latin13.mo'))).charset, 'iso-8859-13');
        });

        it('leaves headers undefined without a header entry', () => {
            const catalog = compare(fs.readFileSync(path.join(fixtures, 'mo-no-header.mo')));
            assert.ok(Object.hasOwn(catalog, 'headers'));
            assert.strictEqual(catalog.headers, undefined);
            assert.strictEqual(catalog.charset, 'iso-8859-1');
        });

        it('normalizes charset names and decodes ISO-8859-1 byte for byte', () => {
            const bytes = Buffer.from([0x41, 0xe9, 0x85, 0x9f]);
            for (const charset of ['latin1', 'Latin-1', 'ISO-8859-1', 'ISO_8859-1']) {
                const catalog = compare(
                    writeMo([
                        ['', header(charset)],
                        ['a', bytes]
                    ])
                );
                assert.strictEqual(catalog.translations['']?.a?.msgstr[0], 'Aé\u0085\u009f', charset);
            }
            // Bytes a single-byte code page leaves undefined (0x9f in windows-1257) are left out:
            // iconv-lite decodes them to U+FFFD and TextDecoder to the C1 control of the same value
            for (const charset of ['UTF8', 'utf_8', 'WIN1257', 'windows-1252', 'KOI8-R', 'US-ASCII', 'ascii']) {
                compare(
                    writeMo([
                        ['', header(charset)],
                        ['a', bytes.subarray(0, 3)]
                    ])
                );
            }
            assert.strictEqual(compare(writeMo([['', header('UTF8')]])).charset, 'utf-8');
            assert.strictEqual(compare(writeMo([['', header('WIN1257')]])).charset, 'windows-1257');
            assert.strictEqual(
                compare(
                    writeMo([
                        ['', header('us-ascii')],
                        ['a', bytes]
                    ])
                ).translations['']?.a?.msgstr[0],
                'A���'
            );
        });

        it('falls back to UTF-8 for a charset the runtime does not know', () => {
            // iconv-lite throws for it and gettext-parser logs the error before falling back
            const consoleError = mock.method(console, 'error', () => {});
            try {
                const catalog = compare(
                    writeMo([
                        ['', header('x-unknown-charset')],
                        ['a', 'é']
                    ])
                );
                assert.strictEqual(catalog.charset, 'x-unknown-charset');
                assert.strictEqual(catalog.translations['']?.a?.msgstr[0], 'é');
            } finally {
                consoleError.mock.restore();
            }
        });

        it('keeps the default charset when the header names none', () => {
            const entries: Entry[] = [
                ['', 'Language: xx\n'],
                ['a', Buffer.from([0xe9])]
            ];
            assert.strictEqual(compare(writeMo(entries)).translations['']?.a?.msgstr[0], 'é');
            assert.strictEqual(compare(writeMo(entries), 'utf-8').charset, 'utf-8');
            assert.strictEqual(compare(writeMo([['', 'Content-Type: text/plain; charset=CHARSET\n']]), 'koi8-r').charset, 'koi8-r');
        });

        it('only reads the header from the first entry', () => {
            compare(
                writeMo([
                    ['a', 'b'],
                    ['', header('koi8-r')]
                ])
            );
        });

        it('splits the context and the plural form at the first separator', () => {
            const catalog = compare(writeMo([['c1\u0004c2\u0004id\u0000plural\u0000more', 'one\u0000two']], { bigEndian: true }));
            assert.deepStrictEqual(catalog.translations.c1?.['c2\u0004id'], {
                msgctxt: 'c1',
                msgid: 'c2\u0004id',
                msgid_plural: 'plural\u0000more',
                msgstr: ['one', 'two']
            });
            compare(
                writeMo([
                    ['\u0004', ''],
                    ['id\u0000', 'x']
                ])
            );
        });
    });

    it('accepts a Uint8Array that is a view into a larger buffer', () => {
        const file = fs.readFileSync(path.join(fixtures, 'mo-features.mo'));
        const padded = new Uint8Array(file.length + 16);
        padded.set(file, 8);
        assert.deepStrictEqual(parseMo(padded.subarray(8, 8 + file.length)), parseMo(file));
    });

    it('stores keys such as __proto__ as own properties', () => {
        const catalog = parseMo(
            writeMo([
                ['', '__proto__: polluted\n' + header('utf-8')],
                ['__proto__', 'a'],
                ['__proto__\u0004b', 'c']
            ])
        );
        assert.strictEqual(Object.getPrototypeOf(catalog.headers), Object.prototype);
        assert.strictEqual(catalog.headers?.__proto__, 'polluted');
        assert.strictEqual(Object.getPrototypeOf(catalog.translations['']), Object.prototype);
        assert.deepStrictEqual(Object.getOwnPropertyDescriptor(catalog.translations[''], '__proto__')?.value, { msgid: '__proto__', msgstr: ['a'] });
        assert.strictEqual(Object.getPrototypeOf(catalog.translations), Object.prototype);
        assert.ok(Object.hasOwn(catalog.translations, '__proto__'));
        assert.strictEqual(({} as any).polluted, undefined);
    });

    describe('rejects input that is not a .mo file', () => {
        it('refuses a value that is not a Buffer or Uint8Array', () => {
            for (const value of [undefined, null, 'string', 123, {}, new ArrayBuffer(32)]) {
                assert.throws(() => parseMo(value as any), { name: 'TypeError', message: /expects a Buffer or Uint8Array/ });
            }
        });

        it('refuses a buffer shorter than the header', () => {
            assert.throws(() => parseMo(Buffer.alloc(0)), /Not a \.mo file: the input is too short/);
            assert.throws(() => parseMo(writeMo([]).subarray(0, 19)), /Not a \.mo file: the input is too short/);
        });

        it('refuses a buffer without the magic number', () => {
            assert.throws(() => parseMo(fs.readFileSync(path.join(fixtures, 'mo-features.po'))), /Not a \.mo file: the magic number is missing/);
            assert.throws(() => parseMo(Buffer.alloc(64)), /Not a \.mo file: the magic number is missing/);
        });

        it('refuses a truncated file', () => {
            const file = writeMo([
                ['a', 'b'],
                ['c', 'd']
            ]);
            // the string tables start at 28, the strings follow them
            assert.throws(() => parseMo(file.subarray(0, 30)), /a string table runs past the end/);
            assert.throws(() => parseMo(file.subarray(0, file.length - 2)), /a string runs past the end/);
            const hugeCount = Buffer.from(file);
            hugeCount.writeUInt32LE(0xffffffff, 8);
            assert.throws(() => parseMo(hugeCount), /runs past the end/);
        });
    });

    describe('feeds addTranslations() the same as gettext-parser', () => {
        for (const file of MO_FILES) {
            it(path.basename(path.dirname(file)) + '/' + path.basename(file), () => {
                const buffer = fs.readFileSync(file);
                const ours = new Gettext();
                const theirs = new Gettext();
                ours.addTranslations('xx', 'messages', parseMo(buffer));
                theirs.addTranslations('xx', 'messages', gettextParser.mo.parse(buffer));
                assert.deepStrictEqual(ours.catalogs, theirs.catalogs);

                const a = ours.useLocale('xx');
                const b = theirs.useLocale('xx');
                let checked = 0;
                for (const [msgctxt, entries] of Object.entries(ours.catalogs.xx?.messages?.translations ?? {})) {
                    for (const [msgid, entry] of Object.entries(entries)) {
                        if (!msgid) {
                            continue;
                        }
                        const plural = entry.msgid_plural ?? msgid;
                        for (const count of [0, 1, 2, 5, 21]) {
                            assert.strictEqual(a.npgettext(msgctxt, msgid, plural, count), b.npgettext(msgctxt, msgid, plural, count));
                        }
                        assert.strictEqual(a.pgettext(msgctxt, msgid), b.pgettext(msgctxt, msgid));
                        checked++;
                    }
                }
                assert.ok(checked > 0);
            });
        }
    });
});
