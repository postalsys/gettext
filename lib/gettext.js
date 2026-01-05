'use strict';

let plurals = require('./plurals');

class Gettext {
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
    static getLanguageCode(locale) {
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
    constructor(options) {
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
    on(eventName, callback) {
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
    off(eventName, callback) {
        this.listeners = this.listeners.filter(listener => (listener.eventName === eventName && listener.callback === callback) === false);
    }

    /**
     * Emits an event to all registered event listener.
     *
     * @private
     * @param  {String} eventName  An event name
     * @param  {any}    eventData  Data to pass to event listeners
     */
    emit(eventName, eventData) {
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
    warn(message, options) {
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
    addTranslations(locale, domain, translations) {
        if (typeof locale !== 'string') {
            this.warn('Invalid argument for locale in addTranslations(): Expected a string, but received a ${typeof locale}.');
            return;
        }

        if (typeof domain !== 'string') {
            this.warn('Invalid argument for domain in addTranslations(): Expected a string, but received a ${typeof domain}.');
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

        if (!this.catalogs[locale]) {
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
    setLocale(locale) {
        if (typeof locale !== 'string') {
            this.warn('Invalid argument for setLocale(): Expected a string, but received a ${typeof locale}.');
            return;
        }

        if (locale in {}) {
            this.warn(`Invalid locale: "${locale}" is a reserved keyword and cannot be used as a locale.`);
            return;
        }

        if (locale.trim() === '') {
            this.warn(`Invalid locale: The locale cannot be an empty string.`);
        }

        if (locale !== this.sourceLocale && !this.catalogs[locale]) {
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
    setTextDomain(domain) {
        if (typeof domain !== 'string') {
            this.warn('Invalid argument for setTextDomain(): Expected a string, but received a ${typeof domain}.');
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
    gettext(msgid) {
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
    dgettext(domain, msgid) {
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
    ngettext(msgid, msgidPlural, count) {
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
    dngettext(domain, msgid, msgidPlural, count) {
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
    pgettext(msgctxt, msgid) {
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
    dpgettext(domain, msgctxt, msgid) {
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
    npgettext(msgctxt, msgid, msgidPlural, count) {
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
    dnpgettext(domain, msgctxt, msgid, msgidPlural, count) {
        return this._ldnpgettext(this.locale, domain, msgctxt, msgid, msgidPlural, count);
    }

    useLocale(locale) {
        if (typeof locale !== 'string') {
            this.warn('Invalid argument for setLocale(): Expected a string, but received a ${typeof locale}.', { doThrow: true });
            return;
        }

        if (locale in {}) {
            this.warn(`Invalid locale: "${locale}" is a reserved keyword and cannot be used as a locale.`, { doThrow: true });
            return;
        }

        if (locale.trim() === '') {
            this.warn(`Invalid locale: The locale cannot be an empty string.`);
        }

        if (locale !== this.sourceLocale && !this.catalogs[locale]) {
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
    getComment(domain, msgctxt, msgid) {
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
     * @param  {String} locale       A locale string
     * @param  {String} domain       A gettext domain name
     * @param  {String} msgctxt      Translation context
     * @param  {String} msgid        String to be translated
     * @param  {String} msgidPlural  If no translation was found, return this on count!=1
     * @param  {Number} count        Number count for the plural
     * @return {String} Translation or the original string if no translation was found
     */
    _ldnpgettext(locale, domain, msgctxt, msgid, msgidPlural, count) {
        let defaultTranslation = msgid;
        let translation;
        let index;

        msgctxt = msgctxt || '';

        if (!isNaN(count) && count !== 1) {
            defaultTranslation = msgidPlural || msgid;
        }

        translation = this._getTranslation(locale, domain, msgctxt, msgid);

        if (translation) {
            if (typeof count === 'number') {
                let pluralsFunc = plurals[Gettext.getLanguageCode(locale)].pluralsFunc;
                index = pluralsFunc(count);
                if (typeof index === 'boolean') {
                    index = index ? 1 : 0;
                }
            } else {
                index = 0;
            }

            return translation.msgstr[index] || defaultTranslation;
        } else if (!this.sourceLocale || locale !== this.sourceLocale) {
            this.warn(`Translation not found for msgid "${msgid}" with context "${msgctxt}" in domain "${domain}".`);
        }

        return defaultTranslation;
    }

    /**
     * Retrieves translation object from the domain and context
     *
     * @private
     * @param  {String} locale   A locale string
     * @param  {String} domain   A gettext domain name
     * @param  {String} msgctxt  Translation context
     * @param  {String} msgid    String to be translated
     * @return {Object} Translation object or false if not found
     */
    _getTranslation(locale, domain, msgctxt, msgid) {
        msgctxt = msgctxt || '';

        return this.catalogs?.[locale]?.[domain]?.translations?.[msgctxt]?.[msgid];
    }
}

module.exports = Gettext;
