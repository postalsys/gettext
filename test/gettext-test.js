'use strict';

const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
let Gettext = require('../lib/gettext');
let fs = require('fs');

describe('Gettext', () => {
    let gt;
    let jsonFile;

    beforeEach(() => {
        gt = new Gettext({ debug: false });
        jsonFile = JSON.parse(fs.readFileSync(__dirname + '/fixtures/latin13.json'));
    });

    describe('#constructor', () => {
        let gtc;

        beforeEach(() => {
            gtc = null;
        });

        describe('#sourceLocale option', () => {
            it('should accept any string as a locale', () => {
                gtc = new Gettext({ sourceLocale: 'en-US' });
                assert.strictEqual(gtc.sourceLocale, 'en-US');
                gtc = new Gettext({ sourceLocale: '01234' });
                assert.strictEqual(gtc.sourceLocale, '01234');
            });

            it('should default to en empty string', () => {
                assert.strictEqual(new Gettext().sourceLocale, '');
            });

            it('should reject non-string values', () => {
                gtc = new Gettext({ sourceLocale: null });
                assert.strictEqual(gtc.sourceLocale, '');
                gtc = new Gettext({ sourceLocale: 123 });
                assert.strictEqual(gtc.sourceLocale, '');
                gtc = new Gettext({ sourceLocale: false });
                assert.strictEqual(gtc.sourceLocale, '');
                gtc = new Gettext({ sourceLocale: {} });
                assert.strictEqual(gtc.sourceLocale, '');
                gtc = new Gettext({ sourceLocale: () => {} });
                assert.strictEqual(gtc.sourceLocale, '');
            });
        });
    });

    describe('#getLanguageCode', () => {
        it('should normalize locale string', () => {
            assert.strictEqual(Gettext.getLanguageCode('ab-cd_ef.utf-8'), 'ab');
            assert.strictEqual(Gettext.getLanguageCode('ab-cd_ef'), 'ab');
        });
    });

    describe('#addTranslations', () => {
        it('should store added translations', () => {
            gt.addTranslations('et-EE', 'messages', jsonFile);

            assert.ok(gt.catalogs['et-EE'] !== undefined && gt.catalogs['et-EE'] !== null);
            assert.ok(gt.catalogs['et-EE'].messages !== undefined && gt.catalogs['et-EE'].messages !== null);
            assert.strictEqual(gt.catalogs['et-EE'].messages.charset, 'iso-8859-13');
        });

        it('should store added translations on a custom domain', () => {
            gt.addTranslations('et-EE', 'mydomain', jsonFile);

            assert.ok(gt.catalogs['et-EE'].mydomain !== undefined && gt.catalogs['et-EE'].mydomain !== null);
            assert.strictEqual(gt.catalogs['et-EE'].mydomain.charset, 'iso-8859-13');
        });
    });

    describe('#setLocale', () => {
        it('should have the empty string as default locale', () => {
            assert.strictEqual(gt.locale, '');
        });

        it('should accept whatever string is passed as locale', () => {
            gt.setLocale('de-AT');
            assert.strictEqual(gt.locale, 'de-AT');
            gt.setLocale('01234');
            assert.strictEqual(gt.locale, '01234');
            gt.setLocale('');
            assert.strictEqual(gt.locale, '');
        });

        it('should reject non-string locales', () => {
            gt.setLocale(null);
            assert.strictEqual(gt.locale, '');
            gt.setLocale(123);
            assert.strictEqual(gt.locale, '');
            gt.setLocale(false);
            assert.strictEqual(gt.locale, '');
            gt.setLocale(() => {});
            assert.strictEqual(gt.locale, '');
            gt.setLocale(NaN);
            assert.strictEqual(gt.locale, '');
            gt.setLocale();
            assert.strictEqual(gt.locale, '');
        });
    });

    describe('#setTextDomain', () => {
        it('should default to "messages"', () => {
            assert.strictEqual(gt.domain, 'messages');
        });

        it('should accept and store any string as domain name', () => {
            gt.setTextDomain('mydomain');
            assert.strictEqual(gt.domain, 'mydomain');
            gt.setTextDomain('01234');
            assert.strictEqual(gt.domain, '01234');
            gt.setTextDomain('');
            assert.strictEqual(gt.domain, '');
        });

        it('should reject non-string domains', () => {
            gt.setTextDomain(null);
            assert.strictEqual(gt.domain, 'messages');
            gt.setTextDomain(123);
            assert.strictEqual(gt.domain, 'messages');
            gt.setTextDomain(false);
            assert.strictEqual(gt.domain, 'messages');
            gt.setTextDomain(() => {});
            assert.strictEqual(gt.domain, 'messages');
            gt.setTextDomain(NaN);
            assert.strictEqual(gt.domain, 'messages');
            gt.setTextDomain();
            assert.strictEqual(gt.domain, 'messages');
        });
    });

    describe('Resolve translations', () => {
        beforeEach(() => {
            gt.addTranslations('et-EE', 'messages', jsonFile);
            gt.setLocale('et-EE');
        });

        describe('#dnpgettext', () => {
            it('should return singular match from default context', () => {
                assert.strictEqual(gt.dnpgettext('messages', '', 'o2-1', 'o2-2', 1), 't2-1');
            });

            it('should return plural match from default context', () => {
                assert.strictEqual(gt.dnpgettext('messages', '', 'o2-1', 'o2-2', 2), 't2-2');
            });

            it('should return singular match from selected context', () => {
                assert.strictEqual(gt.dnpgettext('messages', 'c2', 'co2-1', 'co2-2', 1), 'ct2-1');
            });

            it('should return plural match from selected context', () => {
                assert.strictEqual(gt.dnpgettext('messages', 'c2', 'co2-1', 'co2-2', 2), 'ct2-2');
            });

            it('should return singular match for non existing domain', () => {
                assert.strictEqual(gt.dnpgettext('cccc', '', 'o2-1', 'o2-2', 1), 'o2-1');
            });
        });

        describe('#gettext', () => {
            it('should return singular from default context', () => {
                assert.strictEqual(gt.gettext('o2-1'), 't2-1');
            });
        });

        describe('#dgettext', () => {
            it('should return singular from default context', () => {
                assert.strictEqual(gt.dgettext('messages', 'o2-1'), 't2-1');
            });
        });

        describe('#ngettext', () => {
            it('should return plural from default context', () => {
                assert.strictEqual(gt.ngettext('o2-1', 'o2-2', 2), 't2-2');
            });
        });

        describe('#dngettext', () => {
            it('should return plural from default context', () => {
                assert.strictEqual(gt.dngettext('messages', 'o2-1', 'o2-2', 2), 't2-2');
            });
        });

        describe('#pgettext', () => {
            it('should return singular from selected context', () => {
                assert.strictEqual(gt.pgettext('c2', 'co2-1'), 'ct2-1');
            });
        });

        describe('#dpgettext', () => {
            it('should return singular from selected context', () => {
                assert.strictEqual(gt.dpgettext('messages', 'c2', 'co2-1'), 'ct2-1');
            });
        });

        describe('#npgettext', () => {
            it('should return plural from selected context', () => {
                assert.strictEqual(gt.npgettext('c2', 'co2-1', 'co2-2', 2), 'ct2-2');
            });
        });

        describe('#getComment', () => {
            it('should return comments object', () => {
                assert.deepStrictEqual(gt.getComment('messages', '', 'test'), {
                    translator: 'Normal comment line 1\nNormal comment line 2',
                    extracted: 'Editors note line 1\nEditors note line 2',
                    reference: '/absolute/path:13\n/absolute/path:14',
                    flag: 'line 1\nline 2',
                    previous: 'line 3\nline 4'
                });
            });
        });
    });

    describe('Resolve translations with useLocale', () => {
        let localGt = new Gettext({ sourceLocale: 'en_US' });
        beforeEach(() => {
            gt.addTranslations('et-EE', 'messages', jsonFile);
            localGt = gt.useLocale('et-EE');
        });

        describe('#dnpgettext', () => {
            it('should return singular match from default context', () => {
                assert.strictEqual(localGt.dnpgettext('messages', '', 'o2-1', 'o2-2', 1), 't2-1');
            });

            it('should return plural match from default context', () => {
                assert.strictEqual(localGt.dnpgettext('messages', '', 'o2-1', 'o2-2', 2), 't2-2');
            });

            it('should return singular match from selected context', () => {
                assert.strictEqual(localGt.dnpgettext('messages', 'c2', 'co2-1', 'co2-2', 1), 'ct2-1');
            });

            it('should return plural match from selected context', () => {
                assert.strictEqual(localGt.dnpgettext('messages', 'c2', 'co2-1', 'co2-2', 2), 'ct2-2');
            });

            it('should return singular match for non existing domain', () => {
                assert.strictEqual(localGt.dnpgettext('cccc', '', 'o2-1', 'o2-2', 1), 'o2-1');
            });
        });

        describe('#gettext', () => {
            it('should return singular from default context', () => {
                assert.strictEqual(localGt.gettext('o2-1'), 't2-1');
            });
        });

        describe('#dgettext', () => {
            it('should return singular from default context', () => {
                assert.strictEqual(localGt.dgettext('messages', 'o2-1'), 't2-1');
            });
        });

        describe('#ngettext', () => {
            it('should return plural from default context', () => {
                assert.strictEqual(localGt.ngettext('o2-1', 'o2-2', 2), 't2-2');
            });
        });

        describe('#dngettext', () => {
            it('should return plural from default context', () => {
                assert.strictEqual(localGt.dngettext('messages', 'o2-1', 'o2-2', 2), 't2-2');
            });
        });

        describe('#pgettext', () => {
            it('should return singular from selected context', () => {
                assert.strictEqual(localGt.pgettext('c2', 'co2-1'), 'ct2-1');
            });
        });

        describe('#dpgettext', () => {
            it('should return singular from selected context', () => {
                assert.strictEqual(localGt.dpgettext('messages', 'c2', 'co2-1'), 'ct2-1');
            });
        });

        describe('#npgettext', () => {
            it('should return plural from selected context', () => {
                assert.strictEqual(localGt.npgettext('c2', 'co2-1', 'co2-2', 2), 'ct2-2');
            });
        });
    });

    describe('Unresolvable transaltions', () => {
        beforeEach(() => {
            gt.addTranslations('et-EE', 'messages', jsonFile);
        });

        it('should pass msgid when no translation is found', () => {
            assert.strictEqual(gt.gettext('unknown phrase'), 'unknown phrase');
            assert.strictEqual(gt.dnpgettext('unknown domain', null, 'hello'), 'hello');
            assert.strictEqual(gt.dnpgettext('messages', 'unknown context', 'hello'), 'hello');

            // 'o2-1' is translated, but no locale has been set yet
            assert.strictEqual(gt.dnpgettext('messages', '', 'o2-1'), 'o2-1');
        });

        it('should pass unresolved singular message when count is 1', () => {
            assert.strictEqual(gt.dnpgettext('messages', '', '0 matches', 'multiple matches', 1), '0 matches');
        });

        it('should pass unresolved plural message when count > 1', () => {
            assert.strictEqual(gt.dnpgettext('messages', '', '0 matches', 'multiple matches', 100), 'multiple matches');
        });
    });

    describe('Events', () => {
        let errorListener;

        beforeEach(() => {
            errorListener = mock.fn();
            gt.on('error', errorListener);
        });

        it('should notify a registered listener of error events', () => {
            gt.emit('error', 'Something went wrong');
            assert.strictEqual(errorListener.mock.callCount(), 1);
        });

        it('should deregister a previously registered event listener', () => {
            gt.off('error', errorListener);
            gt.emit('error', 'Something went wrong');
            assert.strictEqual(errorListener.mock.callCount(), 0);
        });

        it('should emit an error event when adding a reserved key as locale', () => {
            gt.addTranslations('__proto__', 'polluted', 'pwned');
            assert.strictEqual(errorListener.mock.callCount(), 1);
        });

        it('should emit an error event when a locale that has no translations is set', () => {
            gt.setLocale('et-EE');
            assert.strictEqual(errorListener.mock.callCount(), 1);
        });

        it('should emit an error event when no locale has been set', () => {
            gt.addTranslations('et-EE', 'messages', jsonFile);
            gt.gettext('o2-1');
            assert.strictEqual(errorListener.mock.callCount(), 1);
            gt.setLocale('et-EE');
            gt.gettext('o2-1');
            assert.strictEqual(errorListener.mock.callCount(), 1);
        });

        it('should emit an error event when a translation is missing', () => {
            gt.addTranslations('et-EE', 'messages', jsonFile);
            gt.setLocale('et-EE');
            gt.gettext('This message is not translated');
            assert.strictEqual(errorListener.mock.callCount(), 1);
        });

        it('should not emit any error events when a translation is found', () => {
            gt.addTranslations('et-EE', 'messages', jsonFile);
            gt.setLocale('et-EE');
            gt.gettext('o2-1');
            assert.strictEqual(errorListener.mock.callCount(), 0);
        });

        it('should not emit any error events when the current locale is the default locale', () => {
            let gtd = new Gettext({ sourceLocale: 'en-US' });
            let errorListenersourceLocale = mock.fn();
            gtd.on('error', errorListenersourceLocale);
            gtd.setLocale('en-US');
            gtd.gettext('This message is not translated');
            assert.strictEqual(errorListenersourceLocale.mock.callCount(), 0);
        });
    });
});
