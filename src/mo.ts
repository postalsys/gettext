import { TextDecoder } from 'node:util';

/** One entry of a parsed .mo catalog */
export interface MoTranslation {
    msgid: string;
    msgctxt?: string | undefined;
    msgid_plural?: string | undefined;
    /** The translated string, one per plural form */
    msgstr: string[];
}

/** A parsed .mo catalog, the shape gettext-parser's mo.parse() returns */
export interface MoCatalog {
    /** The charset the strings were decoded from, normalized as gettext-parser does */
    charset: string;
    /** The header entry parsed into key-value pairs, undefined when the file has no header entry */
    headers: Record<string, string> | undefined;
    /** Entries keyed by msgctxt (an empty string for no context), then by msgid */
    translations: Record<string, Record<string, MoTranslation>>;
}

const MAGIC = 0x950412de;
const HEADER_SIZE = 20;

// Canonical header names, gettext-parser rewrites a case-insensitive match to these
const HEADERS = new Map([
    ['project-id-version', 'Project-Id-Version'],
    ['report-msgid-bugs-to', 'Report-Msgid-Bugs-To'],
    ['pot-creation-date', 'POT-Creation-Date'],
    ['po-revision-date', 'PO-Revision-Date'],
    ['last-translator', 'Last-Translator'],
    ['language-team', 'Language-Team'],
    ['language', 'Language'],
    ['content-type', 'Content-Type'],
    ['content-transfer-encoding', 'Content-Transfer-Encoding'],
    ['plural-forms', 'Plural-Forms']
]);

// Labels that decode byte for byte. TextDecoder maps these to windows-1252, which differs in 0x80-0x9f
const LATIN1 = new Set(['iso-8859-1', 'iso8859-1', 'iso_8859-1', 'latin1', 'l1', 'cp819', 'ibm819']);

/**
 * Sets a property as an own data property, so a key read from the file such as "__proto__"
 * can not replace the prototype of the object it is stored in.
 */
function setOwn<T>(obj: Record<string, T>, key: string, value: T): void {
    if (key === '__proto__') {
        Object.defineProperty(obj, key, { value, enumerable: true, writable: true, configurable: true });
    } else {
        obj[key] = value;
    }
}

/** Normalizes a charset name the way gettext-parser does (utf8 to utf-8, WIN1257 to windows-1257, ...) */
function formatCharset(charset: string, defaultCharset: string): string {
    return charset
        .toLowerCase()
        .replace(/^utf[-_]?(\d+)$/, 'utf-$1')
        .replace(/^win(?:dows)?[-_]?(\d+)$/, 'windows-$1')
        .replace(/^latin[-_]?(\d+)$/, 'iso-8859-$1')
        .replace(/^(us[-_]?)?ascii$/, 'ascii')
        .replace(/^charset$/, defaultCharset)
        .trim();
}

/** Returns a decoder for the charset, UTF-8 when the runtime does not know the charset */
function getDecoder(charset: string): (bytes: Buffer) => string {
    if (charset === 'utf-8' || charset === 'utf8') {
        return bytes => bytes.toString('utf8');
    }
    if (LATIN1.has(charset)) {
        return bytes => bytes.toString('latin1');
    }
    if (charset === 'ascii') {
        // TextDecoder maps "ascii" to windows-1252 as well, gettext-parser replaces every byte above 0x7f
        return bytes => bytes.toString('latin1').replace(/[\u0080-\u00ff]/g, '\ufffd');
    }
    let decoder: TextDecoder;
    try {
        decoder = new TextDecoder(charset);
    } catch {
        return bytes => bytes.toString('utf8');
    }
    return bytes => decoder.decode(bytes);
}

/** Parses the header entry into key-value pairs */
function parseHeader(str: string): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const line of str.split('\n')) {
        const parts = line.split(':');
        const key = (parts.shift() || '').trim();
        if (key) {
            setOwn(headers, HEADERS.get(key.toLowerCase()) || key, parts.join(':').trim());
        }
    }
    return headers;
}

/**
 * Parses a compiled GNU gettext catalog (a .mo file) into the JSON shape that
 * addTranslations() takes. The result is the same as gettext-parser's mo.parse() returns
 * for the same file: both byte orders, contexts, plural forms, and strings decoded from
 * the charset named in the header entry's Content-Type.
 *
 * @example
 *     const catalog = Gettext.parseMo(fs.readFileSync('sv.mo'));
 *     gt.addTranslations('sv-SE', 'messages', catalog);
 *
 * @param {Buffer|Uint8Array} buffer  Contents of a .mo file
 * @param {String} [defaultCharset='iso-8859-1']  Charset to use when the header names none
 * @return {Object} A catalog of gettext-parser JSON shape
 * @throws {TypeError} When buffer is not a Buffer or Uint8Array
 * @throws {Error} When buffer is not a .mo file or is truncated
 */
export function parseMo(buffer: Uint8Array, defaultCharset: string = 'iso-8859-1'): MoCatalog {
    if (!(buffer instanceof Uint8Array)) {
        throw new TypeError('parseMo() expects a Buffer or Uint8Array with the contents of a .mo file');
    }
    const data = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    if (data.length < HEADER_SIZE) {
        throw new Error('Not a .mo file: the input is too short to hold a .mo header');
    }

    let littleEndian: boolean;
    if (data.readUInt32LE(0) === MAGIC) {
        littleEndian = true;
    } else if (data.readUInt32BE(0) === MAGIC) {
        littleEndian = false;
    } else {
        throw new Error('Not a .mo file: the magic number is missing');
    }
    const readUInt32 = (offset: number): number => {
        if (offset + 4 > data.length) {
            throw new Error('Invalid .mo file: a string table runs past the end of the input');
        }
        return littleEndian ? data.readUInt32LE(offset) : data.readUInt32BE(offset);
    };
    const readString = (tableOffset: number): Buffer => {
        const length = readUInt32(tableOffset);
        const position = readUInt32(tableOffset + 4);
        if (position + length > data.length) {
            throw new Error('Invalid .mo file: a string runs past the end of the input');
        }
        return data.subarray(position, position + length);
    };

    const total = readUInt32(8);
    const originalsOffset = readUInt32(12);
    const translationsOffset = readUInt32(16);

    let charset = defaultCharset;
    let decode = getDecoder(formatCharset(charset, defaultCharset));
    const catalog: MoCatalog = { charset, headers: undefined, translations: {} };

    for (let i = 0; i < total; i++) {
        const rawMsgid = readString(originalsOffset + i * 8);
        const rawMsgstr = readString(translationsOffset + i * 8);

        // The first entry with an empty msgid is the header, it names the charset of every string
        if (i === 0 && rawMsgid.length === 0) {
            const match = rawMsgstr.toString('utf8').match(/[; ]charset\s*=\s*([\w-]+)/i);
            if (match) {
                charset = catalog.charset = formatCharset(match[1], charset);
                decode = getDecoder(charset);
            }
            catalog.headers = parseHeader(decode(rawMsgstr));
        }

        const translation = {} as MoTranslation;
        const idParts = decode(rawMsgid).split('\u0004');
        let msgctxt = '';
        if (idParts.length > 1) {
            msgctxt = idParts.shift() as string;
            translation.msgctxt = msgctxt;
        }
        const pluralParts = idParts.join('\u0004').split('\u0000');
        const msgid = pluralParts.shift() as string;
        translation.msgid = msgid;
        const msgidPlural = pluralParts.join('\u0000');
        if (msgidPlural) {
            translation.msgid_plural = msgidPlural;
        }
        translation.msgstr = decode(rawMsgstr).split('\u0000');

        if (!Object.hasOwn(catalog.translations, msgctxt)) {
            setOwn(catalog.translations, msgctxt, {});
        }
        setOwn(catalog.translations[msgctxt], msgid, translation);
    }

    return catalog;
}
