import plurals from './plurals.js';
import { parsePluralForms, DEFAULT_PLURAL_FORMS } from './plural-forms.js';
import type { PluralForms } from './plural-forms.js';
import type { PluralRule } from './plurals.js';

export type { PluralForms } from './plural-forms.js';
export type { PluralExample, PluralRule } from './plurals.js';

/** Translator comments of a catalog entry, as gettext-parser reads them */
export interface TranslationComments {
    translator?: string | undefined;
    extracted?: string | undefined;
    reference?: string | undefined;
    flag?: string | undefined;
    previous?: string | undefined;
}

/** One catalog entry in gettext-parser JSON shape */
export interface Translation {
    msgid?: string | undefined;
    msgctxt?: string | undefined;
    msgid_plural?: string | undefined;
    /** The translated string, one per plural form */
    msgstr: string[];
    comments?: TranslationComments | undefined;
}

/** A catalog of gettext-parser JSON shape, as passed to addTranslations() */
export interface Catalog {
    charset?: string | undefined;
    /** Catalog headers, the Plural-Forms header is read for languages missing from the plural table */
    headers?: Record<string, string> | undefined;
    /** Entries keyed by msgctxt (an empty string for no context), then by msgid */
    translations: Record<string, Record<string, Translation>>;
}

export interface GettextOptions {
    /** The locale that the source code and its texts are written in */
    sourceLocale?: string | undefined;
    /** Whether to output debug info into the console */
    debug?: boolean | undefined;
}

/** An event listener registered with on() */
export interface GettextListener {
    eventName: string;
    callback: (eventData: any) => void;
}

/** The lookup functions useLocale() returns, bound to one locale */
export interface LocaleGettext {
    gettext(msgid: string): string;
    dgettext(domain: string, msgid: string): string;
    ngettext(msgid: string, msgidPlural: string, count: number): string;
    dngettext(domain: string, msgid: string, msgidPlural: string, count: number): string;
    pgettext(msgctxt: string, msgid: string): string;
    dpgettext(domain: string, msgctxt: string, msgid: string): string;
    npgettext(msgctxt: string, msgid: string, msgidPlural: string, count: number): string;
    dnpgettext(domain: string, msgctxt: string, msgid: string, msgidPlural?: string, count?: number): string;
}

// Compiled Plural-Forms rules per catalog object, recompiled when the header text changes
const catalogPluralForms = new WeakMap<object, { header: unknown; rule: PluralForms }>();

/**
 * Reads an own property only, so a key such as "constructor" or "__proto__" never resolves to
 * a member inherited from Object.prototype.
 *
 * @private
 * @param  {Object} obj  Object to read from
 * @param  {String} key  Property name
 * @return {any} The own property value or undefined
 */
function getOwn(obj: unknown, key: string): any {
    return obj !== null && typeof obj === 'object' && Object.hasOwn(obj, key) ? (obj as Record<string, unknown>)[key] : undefined;
}

/**
 * Whether count selects the plural fallback string. Never throws, a Symbol or BigInt count
 * (which isNaN() refuses to convert) counts as singular.
 *
 * @private
 * @param  {any} count  Count passed to a plural lookup
 * @return {Boolean}
 */
function isPluralCount(count: unknown): boolean {
    try {
        return !isNaN(count as number) && count !== 1;
    } catch {
        return false;
    }
}

/**
 * Returns the plural rule from a catalog's Plural-Forms header, or the n != 1 default when the
 * header is missing or cannot be parsed.
 *
 * @private
 * @param  {Object} catalog  A catalog of gettext-parser JSON shape
 * @return {Object} { nplurals, pluralsFunc }
 */
function getCatalogPluralForms(catalog: object): PluralForms {
    // gettext-parser lowercases header names in some versions and keeps "Plural-Forms" in others
    const headers = getOwn(catalog, 'headers');
    const header = getOwn(headers, 'plural-forms') ?? getOwn(headers, 'Plural-Forms');

    const cached = catalogPluralForms.get(catalog);
    if (cached && cached.header === header) {
        return cached.rule;
    }

    const rule = parsePluralForms(header) || DEFAULT_PLURAL_FORMS;
    catalogPluralForms.set(catalog, { header, rule });
    return rule;
}

class Gettext {
    catalogs: Record<string, Record<string, Catalog>>;
    locale: string;
    domain: string;
    listeners: GettextListener[];
    sourceLocale: string;
    debug: boolean;

    /**
     * Returns the language code part of a locale
     *
     * @example
     *     Gettext.getLanguageCode('sv-SE')
     *     // -> "sv"
     *
     * @private
     * @param   {String} locale  A case-insensitive locale string
     * @returns {String} A language code
     */
    static getLanguageCode(locale: string): string {
        return locale.split(/[-_]/)[0].toLowerCase();
    }

    /**
     * Creates and returns a new Gettext instance.
     *
     * @constructor
     * @param  {Object}  [options]             A set of options
     * @param  {String}  options.sourceLocale  The locale that the source code and its
     *                                         texts are written in. Translations for
     *                                         this locale is not necessary.
     * @param  {Boolean} options.debug         Whether to output debug info into the
     *                                         console.
     * @return {Object}  A Gettext instance
     */
    constructor(options?: GettextOptions | null) {
        options = options || {};

        this.catalogs = {};
        this.locale = '';
        this.domain = 'messages';

        this.listeners = [];

        // Set source locale
        this.sourceLocale = '';
        if (options.sourceLocale) {
            if (typeof options.sourceLocale === 'string') {
                this.sourceLocale = options.sourceLocale;
            } else {
                this.warn(`Invalid sourceLocale option: Expected a string value.`);
            }
        }

        // Set debug flag
        this.debug = 'debug' in options && options.debug === true;
    }

    /**
     * Adds an event listener.
     *
     * @param  {String}   eventName  An event name
     * @param  {Function} callback   An event handler function
     */
    on(eventName: string, callback: (eventData: any) => void): void {
        this.listeners.push({
            eventName,
            callback
        });
    }

    /**
     * Removes an event listener.
     *
     * @param  {String}   eventName  An event name
     * @param  {Function} callback   A previously registered event handler function
     */
    off(eventName: string, callback: (eventData: any) => void): void {
        this.listeners = this.listeners.filter(listener => (listener.eventName === eventName && listener.callback === callback) === false);
    }

    /**
     * Emits an event to all registered event listener.
     *
     * @private
     * @param  {String} eventName  An event name
     * @param  {any}    eventData  Data to pass to event listeners
     */
    emit(eventName: string, eventData?: unknown): void {
        for (let i = 0; i < this.listeners.length; i++) {
            let listener = this.listeners[i];
            if (listener.eventName === eventName) {
                listener.callback(eventData);
            }
        }
    }

    /**
     * Logs a warning to the console if debug mode is enabled.
     *
     * @ignore
     * @param  {String} message  A warning message
     */
    warn(message: string, options: { doThrow: true }): never;
    warn(message: string, options?: { doThrow?: boolean | undefined }): void;
    warn(message: string, options?: { doThrow?: boolean | undefined }): void {
        const { doThrow } = options || {};
        if (this.debug) {
            console.warn(message);
        }

        const error = new Error(message);

        if (doThrow) {
            throw error;
        }

        this.emit('error', error);
    }

    /**
     * Stores a set of translations in the set of gettext
     * catalogs.
     *
     * @example
     *     gt.addTranslations('sv-SE', 'messages', translationsObject)
     *
     * @param {String} locale        A locale string
     * @param {String} domain        A domain name
     * @param {Object} translations  An object of gettext-parser JSON shape
     */
    addTranslations(locale: string, domain: string, translations: Catalog): void {
        if (typeof locale !== 'string') {
            this.warn(`Invalid argument for locale in addTranslations(): Expected a string, but received a ${typeof locale}.`);
            return;
        }

        if (typeof domain !== 'string') {
            this.warn(`Invalid argument for domain in addTranslations(): Expected a string, but received a ${typeof domain}.`);
            return;
        }

        if (locale in {}) {
            this.warn(`Invalid locale: "${locale}" is a reserved keyword and cannot be used as a locale.`);
            return;
        }

        if (domain in {}) {
            this.warn(`Invalid domain: "${domain}" is a reserved keyword and cannot be used as a domain.`);
            return;
        }

        if (!getOwn(this.catalogs, locale)) {
            this.catalogs[locale] = {};
        }

        this.catalogs[locale][domain] = translations;
    }

    /**
     * Sets the locale to get translated messages for.
     *
     * @example
     *     gt.setLocale('sv-SE')
     *
     * @param {String} locale  A locale
     */
    setLocale(locale: string): void {
        if (typeof locale !== 'string') {
            this.warn(`Invalid argument for setLocale(): Expected a string, but received a ${typeof locale}.`);
            return;
        }

        if (locale in {}) {
            this.warn(`Invalid locale: "${locale}" is a reserved keyword and cannot be used as a locale.`);
            return;
        }

        if (locale.trim() === '') {
            this.warn(`Invalid locale: The locale cannot be an empty string.`);
        }

        if (locale !== this.sourceLocale && !getOwn(this.catalogs, locale)) {
            this.warn(`Locale "${locale}" not found: No translations have been added for this locale.`);
        }

        this.locale = locale;
    }

    /**
     * Sets the default gettext domain.
     *
     * @example
     *     gt.setTextDomain('domainname')
     *
     * @param {String} domain  A gettext domain name
     */
    setTextDomain(domain: string): void {
        if (typeof domain !== 'string') {
            this.warn(`Invalid argument for setTextDomain(): Expected a string, but received a ${typeof domain}.`);
            return;
        }

        if (domain in {}) {
            this.warn(`Invalid domain: "${domain}" is a reserved keyword and cannot be used as a domain.`);
            return;
        }

        if (domain.trim() === '') {
            this.warn(`Invalid domain: The domain cannot be an empty string.`);
        }

        this.domain = domain;
    }

    /**
     * Translates a string using the default textdomain
     *
     * @example
     *     gt.gettext('Some text')
     *
     * @param  {String} msgid  String to be translated
     * @return {String} Translation or the original string if no translation was found
     */
    gettext(msgid: string): string {
        return this.dnpgettext(this.domain, '', msgid);
    }

    /**
     * Translates a string using a specific domain
     *
     * @example
     *     gt.dgettext('domainname', 'Some text')
     *
     * @param  {String} domain  A gettext domain name
     * @param  {String} msgid   String to be translated
     * @return {String} Translation or the original string if no translation was found
     */
    dgettext(domain: string, msgid: string): string {
        return this.dnpgettext(domain, '', msgid);
    }

    /**
     * Translates a plural string using the default textdomain
     *
     * @example
     *     gt.ngettext('One thing', 'Many things', numberOfThings)
     *
     * @param  {String} msgid        String to be translated when count is not plural
     * @param  {String} msgidPlural  String to be translated when count is plural
     * @param  {Number} count        Number count for the plural
     * @return {String} Translation or the original string if no translation was found
     */
    ngettext(msgid: string, msgidPlural: string, count: number): string {
        return this.dnpgettext(this.domain, '', msgid, msgidPlural, count);
    }

    /**
     * Translates a plural string using a specific textdomain
     *
     * @example
     *     gt.dngettext('domainname', 'One thing', 'Many things', numberOfThings)
     *
     * @param  {String} domain       A gettext domain name
     * @param  {String} msgid        String to be translated when count is not plural
     * @param  {String} msgidPlural  String to be translated when count is plural
     * @param  {Number} count        Number count for the plural
     * @return {String} Translation or the original string if no translation was found
     */
    dngettext(domain: string, msgid: string, msgidPlural: string, count: number): string {
        return this.dnpgettext(domain, '', msgid, msgidPlural, count);
    }

    /**
     * Translates a string from a specific context using the default textdomain
     *
     * @example
     *    gt.pgettext('sports', 'Back')
     *
     * @param  {String} msgctxt  Translation context
     * @param  {String} msgid    String to be translated
     * @return {String} Translation or the original string if no translation was found
     */
    pgettext(msgctxt: string, msgid: string): string {
        return this.dnpgettext(this.domain, msgctxt, msgid);
    }

    /**
     * Translates a string from a specific context using s specific textdomain
     *
     * @example
     *     gt.dpgettext('domainname', 'sports', 'Back')
     *
     * @param  {String} domain   A gettext domain name
     * @param  {String} msgctxt  Translation context
     * @param  {String} msgid    String to be translated
     * @return {String} Translation or the original string if no translation was found
     */
    dpgettext(domain: string, msgctxt: string, msgid: string): string {
        return this.dnpgettext(domain, msgctxt, msgid);
    }

    /**
     * Translates a plural string from a specific context using the default textdomain
     *
     * @example
     *     gt.npgettext('sports', 'Back', '%d backs', numberOfBacks)
     *
     * @param  {String} msgctxt      Translation context
     * @param  {String} msgid        String to be translated when count is not plural
     * @param  {String} msgidPlural  String to be translated when count is plural
     * @param  {Number} count        Number count for the plural
     * @return {String} Translation or the original string if no translation was found
     */
    npgettext(msgctxt: string, msgid: string, msgidPlural: string, count: number): string {
        return this.dnpgettext(this.domain, msgctxt, msgid, msgidPlural, count);
    }

    /**
     * Translates a plural string from a specifi context using a specific textdomain
     *
     * @example
     *     gt.dnpgettext('domainname', 'sports', 'Back', '%d backs', numberOfBacks)
     *
     * @param  {String} domain       A gettext domain name
     * @param  {String} msgctxt      Translation context
     * @param  {String} msgid        String to be translated
     * @param  {String} msgidPlural  If no translation was found, return this on count!=1
     * @param  {Number} count        Number count for the plural
     * @return {String} Translation or the original string if no translation was found
     */
    dnpgettext(domain: string, msgctxt: string, msgid: string, msgidPlural?: string, count?: number): string {
        return this._ldnpgettext(this.locale, domain, msgctxt, msgid, msgidPlural, count);
    }

    useLocale(locale: string): LocaleGettext {
        if (typeof locale !== 'string') {
            this.warn(`Invalid argument for useLocale(): Expected a string, but received a ${typeof locale}.`, { doThrow: true });
        }

        if (locale in {}) {
            this.warn(`Invalid locale: "${locale}" is a reserved keyword and cannot be used as a locale.`, { doThrow: true });
        }

        if (locale.trim() === '') {
            this.warn(`Invalid locale: The locale cannot be an empty string.`);
        }

        if (locale !== this.sourceLocale && !getOwn(this.catalogs, locale)) {
            this.warn(`Locale "${locale}" not found: No translations have been added for this locale.`);
        }

        return {
            gettext: msgid => this._ldnpgettext(locale, this.domain, '', msgid),
            dgettext: (domain, msgid) => this._ldnpgettext(locale, domain, '', msgid),
            ngettext: (msgid, msgidPlural, count) => this._ldnpgettext(locale, this.domain, '', msgid, msgidPlural, count),
            dngettext: (domain, msgid, msgidPlural, count) => this._ldnpgettext(locale, domain, '', msgid, msgidPlural, count),
            pgettext: (msgctxt, msgid) => this._ldnpgettext(locale, this.domain, msgctxt, msgid),
            dpgettext: (domain, msgctxt, msgid) => this._ldnpgettext(locale, domain, msgctxt, msgid),
            npgettext: (msgctxt, msgid, msgidPlural, count) => this._ldnpgettext(locale, this.domain, msgctxt, msgid, msgidPlural, count),
            dnpgettext: (domain, msgctxt, msgid, msgidPlural, count) => this._ldnpgettext(locale, domain, msgctxt, msgid, msgidPlural, count)
        };
    }

    /**
     * Retrieves comments object for a translation. The comments object
     * has the shape `{ translator, extracted, reference, flag, previous }`.
     *
     * @example
     *     const comment = gt.getComment('domainname', 'sports', 'Backs')
     *
     * @private
     * @param  {String} domain   A gettext domain name
     * @param  {String} msgctxt  Translation context
     * @param  {String} msgid    String to be translated
     * @return {Object} Comments object or false if not found
     */
    getComment(domain: string, msgctxt: string, msgid: string): TranslationComments {
        let translation;

        translation = this._getTranslation(this.locale, domain, msgctxt, msgid);
        if (translation) {
            return translation.comments || {};
        }

        return {};
    }

    /**
     * Translates a plural string from a specifi context using a specific textdomain
     *
     * @example
     *     gt.dnpgettext('domainname', 'sports', 'Back', '%d backs', numberOfBacks)
     *
     * @private
     * @internal
     * @param  {String} locale       A locale string
     * @param  {String} domain       A gettext domain name
     * @param  {String} msgctxt      Translation context
     * @param  {String} msgid        String to be translated
     * @param  {String} msgidPlural  If no translation was found, return this on count!=1
     * @param  {Number} count        Number count for the plural
     * @return {String} Translation or the original string if no translation was found
     */
    _ldnpgettext(locale: string, domain: string, msgctxt: string, msgid: string, msgidPlural?: string, count?: number): string {
        let defaultTranslation = msgid;
        let translation;
        let index;

        msgctxt = msgctxt || '';

        if (isPluralCount(count)) {
            defaultTranslation = msgidPlural || msgid;
        }

        translation = this._getTranslation(locale, domain, msgctxt, msgid);

        if (translation) {
            index = typeof count === 'number' ? this._getPluralIndex(locale, domain, count) : 0;

            return (Array.isArray(translation.msgstr) && translation.msgstr[index]) || defaultTranslation;
        } else if (!this.sourceLocale || locale !== this.sourceLocale) {
            this.warn(`Translation not found for msgid "${msgid}" with context "${msgctxt}" in domain "${domain}".`);
        }

        return defaultTranslation;
    }

    /**
     * Retrieves translation object from the domain and context
     *
     * @private
     * @internal
     * @param  {String} locale   A locale string
     * @param  {String} domain   A gettext domain name
     * @param  {String} msgctxt  Translation context
     * @param  {String} msgid    String to be translated
     * @return {Object} Translation object or false if not found
     */
    _getTranslation(locale: string, domain: string, msgctxt: string, msgid: string): Translation | undefined {
        msgctxt = msgctxt || '';

        return getOwn(getOwn(getOwn(this._getCatalog(locale, domain), 'translations'), msgctxt), msgid);
    }

    /**
     * Retrieves the catalog added for a locale and domain
     *
     * @private
     * @internal
     * @param  {String} locale  A locale string
     * @param  {String} domain  A gettext domain name
     * @return {Object} Catalog of gettext-parser JSON shape or undefined if not found
     */
    _getCatalog(locale: string, domain: string): Catalog | undefined {
        return getOwn(getOwn(this.catalogs, locale), domain);
    }

    /**
     * Picks the msgstr index for a count. Languages listed in src/plurals.ts use that table,
     * any other language uses the catalog's Plural-Forms header (or n != 1 without one).
     *
     * @private
     * @internal
     * @param  {String} locale  A locale string
     * @param  {String} domain  A gettext domain name
     * @param  {Number} count   Number count for the plural
     * @return {Number} msgstr index
     */
    _getPluralIndex(locale: string, domain: string, count: number): number {
        const language: PluralRule | undefined = getOwn(plurals, Gettext.getLanguageCode(locale));
        const index = (language || getCatalogPluralForms(this._getCatalog(locale, domain)!)).pluralsFunc(count);
        return typeof index === 'boolean' ? Number(index) : index;
    }
}

export default Gettext;
