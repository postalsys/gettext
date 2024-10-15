# @postalsys/gettext

> **Note:** This is a fork of [alexanderwallin/node-gettext](https://github.com/alexanderwallin/node-gettext) with additional enhancements and maintenance updates.

**`@postalsys/gettext`** is a JavaScript implementation of a substantial subset of [GNU gettext](https://www.gnu.org/software/gettext/), a powerful localization framework originally written in C. This library enables developers to internationalize their JavaScript applications by handling translations, plural forms, and contexts, closely mirroring the functionality of the original gettext.

If you're interested in parsing or compiling `.mo`/`.po` files for use with this library or elsewhere, consider using [gettext-parser](https://github.com/smhg/gettext-parser).

## Table of Contents

-   [Features](#features)
    -   [Differences from GNU gettext](#differences-from-gnu-gettext)
-   [Installation](#installation)
-   [Usage](#usage)
    -   [Basic Example](#basic-example)
    -   [Error Events](#error-events)
    -   [Recipes](#recipes)
        -   [Loading Translations from .mo or .po Files](#loading-translations-from-mo-or-po-files)
-   [API Reference](#api-reference)
-   [Contributing](#contributing)
-   [License](#license)
-   [See Also](#see-also)

## Features

-   **Comprehensive Localization Support**: Handles domains, contexts, plurals, and more.
-   **File Format Compatibility**: Supports `.json`, `.mo`, and `.po` files via [gettext-parser](https://github.com/smhg/gettext-parser).
-   **Extensive Language Support**: Includes plural forms for 136 languages.
-   **Dynamic Configuration**: Allows changing locale or domain at runtime.
-   **Debugging Tools**: Provides detailed error messages when the `debug` option is enabled.
-   **Event Emission**: Emits events for internal errors, such as missing translations.

### Differences from GNU gettext

While `@postalsys/gettext` aims to closely emulate GNU gettext, there are notable differences:

1. **No Category Support**: Unlike GNU gettext, which supports categories like `LC_MESSAGES`, `LC_NUMERIC`, and `LC_MONETARY`, this library focuses solely on message localization, effectively always operating under the `LC_MESSAGES` category. For number formatting, currencies, dates, and other localization needs, consider using dedicated JavaScript libraries.
2. **Manual Translation Loading**: GNU gettext automatically reads translation files from the filesystem based on locale and category settings. In contrast, `@postalsys/gettext` requires developers to manually load and provide translations, accommodating both server-side and client-side environments.

## Installation

Install the package via npm:

```sh
npm install @postalsys/gettext
```

## Usage

### Basic Example

```js
const Gettext = require('@postalsys/gettext');
const swedishTranslations = require('./translations/sv-SE.json');

const gt = new Gettext();
gt.addTranslations('sv-SE', 'messages', swedishTranslations);
gt.setLocale('sv-SE');

console.log(gt.gettext('The world is a funny place'));
// Output: "Världen är en underlig plats"
```

### Error Events

`@postalsys/gettext` emits an `error` event when it encounters issues such as missing translations. You can handle these events as follows:

```js
// Set up your Gettext instance and add translations...

gt.on('error', error => {
    console.error('Translation error:', error.message);
});

gt.gettext('An unrecognized message');
// Logs: 'Translation error: No translation found for msgid "An unrecognized message"'
```

### Recipes

#### Loading Translations from .mo or .po Files

`@postalsys/gettext` works seamlessly with translations parsed by [`gettext-parser`](https://github.com/smhg/gettext-parser). Here's how you can load translations from `.po` files:

```js
const fs = require('fs');
const path = require('path');
const Gettext = require('@postalsys/gettext');
const { po } = require('gettext-parser');

// Directory where your translations are stored
const translationsDir = 'path/to/locales';
const locales = ['en', 'fi-FI', 'sv-SE'];
const domain = 'messages';

const gt = new Gettext();

locales.forEach(locale => {
    const filename = `${domain}.po`;
    const translationsFilePath = path.join(translationsDir, locale, filename);
    const translationsContent = fs.readFileSync(translationsFilePath);

    const parsedTranslations = po.parse(translationsContent);
    gt.addTranslations(locale, domain, parsedTranslations);
});

gt.setLocale('sv-SE');
console.log(gt.gettext('Hello'));
// Outputs the translated string in Swedish
```

## API Reference

<a name="Gettext"></a>

## Gettext

* [Gettext](#Gettext)
    * [new Gettext([options])](#new_Gettext_new)
    * [.on(eventName, callback)](#Gettext+on)
    * [.off(eventName, callback)](#Gettext+off)
    * [.addTranslations(locale, domain, translations)](#Gettext+addTranslations)
    * [.setLocale(locale)](#Gettext+setLocale)
    * [.setTextDomain(domain)](#Gettext+setTextDomain)
    * [.gettext(msgid)](#Gettext+gettext) ⇒ <code>String</code>
    * [.dgettext(domain, msgid)](#Gettext+dgettext) ⇒ <code>String</code>
    * [.ngettext(msgid, msgidPlural, count)](#Gettext+ngettext) ⇒ <code>String</code>
    * [.dngettext(domain, msgid, msgidPlural, count)](#Gettext+dngettext) ⇒ <code>String</code>
    * [.pgettext(msgctxt, msgid)](#Gettext+pgettext) ⇒ <code>String</code>
    * [.dpgettext(domain, msgctxt, msgid)](#Gettext+dpgettext) ⇒ <code>String</code>
    * [.npgettext(msgctxt, msgid, msgidPlural, count)](#Gettext+npgettext) ⇒ <code>String</code>
    * [.dnpgettext(domain, msgctxt, msgid, msgidPlural, count)](#Gettext+dnpgettext) ⇒ <code>String</code>

<a name="new_Gettext_new"></a>

### new Gettext([options])
Creates and returns a new Gettext instance.

**Returns**: <code>Object</code> - A Gettext instance  
**Params**

- `[options]`: <code>Object</code> - A set of options
    - `.sourceLocale`: <code>String</code> - The locale that the source code and its
                                        texts are written in. Translations for
                                        this locale is not necessary.
    - `.debug`: <code>Boolean</code> - Whether to output debug info into the
                                        console.

<a name="Gettext+on"></a>

### gettext.on(eventName, callback)
Adds an event listener.

**Params**

- `eventName`: <code>String</code> - An event name
- `callback`: <code>function</code> - An event handler function

<a name="Gettext+off"></a>

### gettext.off(eventName, callback)
Removes an event listener.

**Params**

- `eventName`: <code>String</code> - An event name
- `callback`: <code>function</code> - A previously registered event handler function

<a name="Gettext+addTranslations"></a>

### gettext.addTranslations(locale, domain, translations)
Stores a set of translations in the set of gettext
catalogs.

**Params**

- `locale`: <code>String</code> - A locale string
- `domain`: <code>String</code> - A domain name
- `translations`: <code>Object</code> - An object of gettext-parser JSON shape

**Example**  
```js
gt.addTranslations('sv-SE', 'messages', translationsObject)
```
<a name="Gettext+setLocale"></a>

### gettext.setLocale(locale)
Sets the locale to get translated messages for.

**Params**

- `locale`: <code>String</code> - A locale

**Example**  
```js
gt.setLocale('sv-SE')
```
<a name="Gettext+setTextDomain"></a>

### gettext.setTextDomain(domain)
Sets the default gettext domain.

**Params**

- `domain`: <code>String</code> - A gettext domain name

**Example**  
```js
gt.setTextDomain('domainname')
```
<a name="Gettext+gettext"></a>

### gettext.gettext(msgid) ⇒ <code>String</code>
Translates a string using the default textdomain

**Returns**: <code>String</code> - Translation or the original string if no translation was found  
**Params**

- `msgid`: <code>String</code> - String to be translated

**Example**  
```js
gt.gettext('Some text')
```
<a name="Gettext+dgettext"></a>

### gettext.dgettext(domain, msgid) ⇒ <code>String</code>
Translates a string using a specific domain

**Returns**: <code>String</code> - Translation or the original string if no translation was found  
**Params**

- `domain`: <code>String</code> - A gettext domain name
- `msgid`: <code>String</code> - String to be translated

**Example**  
```js
gt.dgettext('domainname', 'Some text')
```
<a name="Gettext+ngettext"></a>

### gettext.ngettext(msgid, msgidPlural, count) ⇒ <code>String</code>
Translates a plural string using the default textdomain

**Returns**: <code>String</code> - Translation or the original string if no translation was found  
**Params**

- `msgid`: <code>String</code> - String to be translated when count is not plural
- `msgidPlural`: <code>String</code> - String to be translated when count is plural
- `count`: <code>Number</code> - Number count for the plural

**Example**  
```js
gt.ngettext('One thing', 'Many things', numberOfThings)
```
<a name="Gettext+dngettext"></a>

### gettext.dngettext(domain, msgid, msgidPlural, count) ⇒ <code>String</code>
Translates a plural string using a specific textdomain

**Returns**: <code>String</code> - Translation or the original string if no translation was found  
**Params**

- `domain`: <code>String</code> - A gettext domain name
- `msgid`: <code>String</code> - String to be translated when count is not plural
- `msgidPlural`: <code>String</code> - String to be translated when count is plural
- `count`: <code>Number</code> - Number count for the plural

**Example**  
```js
gt.dngettext('domainname', 'One thing', 'Many things', numberOfThings)
```
<a name="Gettext+pgettext"></a>

### gettext.pgettext(msgctxt, msgid) ⇒ <code>String</code>
Translates a string from a specific context using the default textdomain

**Returns**: <code>String</code> - Translation or the original string if no translation was found  
**Params**

- `msgctxt`: <code>String</code> - Translation context
- `msgid`: <code>String</code> - String to be translated

**Example**  
```js
gt.pgettext('sports', 'Back')
```
<a name="Gettext+dpgettext"></a>

### gettext.dpgettext(domain, msgctxt, msgid) ⇒ <code>String</code>
Translates a string from a specific context using s specific textdomain

**Returns**: <code>String</code> - Translation or the original string if no translation was found  
**Params**

- `domain`: <code>String</code> - A gettext domain name
- `msgctxt`: <code>String</code> - Translation context
- `msgid`: <code>String</code> - String to be translated

**Example**  
```js
gt.dpgettext('domainname', 'sports', 'Back')
```
<a name="Gettext+npgettext"></a>

### gettext.npgettext(msgctxt, msgid, msgidPlural, count) ⇒ <code>String</code>
Translates a plural string from a specific context using the default textdomain

**Returns**: <code>String</code> - Translation or the original string if no translation was found  
**Params**

- `msgctxt`: <code>String</code> - Translation context
- `msgid`: <code>String</code> - String to be translated when count is not plural
- `msgidPlural`: <code>String</code> - String to be translated when count is plural
- `count`: <code>Number</code> - Number count for the plural

**Example**  
```js
gt.npgettext('sports', 'Back', '%d backs', numberOfBacks)
```
<a name="Gettext+dnpgettext"></a>

### gettext.dnpgettext(domain, msgctxt, msgid, msgidPlural, count) ⇒ <code>String</code>
Translates a plural string from a specifi context using a specific textdomain

**Returns**: <code>String</code> - Translation or the original string if no translation was found  
**Params**

- `domain`: <code>String</code> - A gettext domain name
- `msgctxt`: <code>String</code> - Translation context
- `msgid`: <code>String</code> - String to be translated
- `msgidPlural`: <code>String</code> - If no translation was found, return this on count!=1
- `count`: <code>Number</code> - Number count for the plural

**Example**  
```js
gt.dnpgettext('domainname', 'sports', 'Back', '%d backs', numberOfBacks)
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## See Also

-   [gettext-parser](https://github.com/smhg/gettext-parser) - Parse and compile gettext translations between `.po`/`.mo` files and JSON.
-   [lioness](https://github.com/alexanderwallin/lioness) - Gettext library for React applications.
-   [react-gettext-parser](https://github.com/lagetse/react-gettext-parser) - Extract translatable strings from React components.
-   [narp](https://github.com/lagetse/narp) - CLI tool for synchronizing translations between your app and Transifex.
