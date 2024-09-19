A fork of [@postalsys/gettext](http://github.com/alexanderwallin/node-gettext)

<h1 align="center">
 @postalsys/gettext
</h1>

**`@postalsys/gettext`** is a JavaScript implementation of (a large subset of) [gettext](https://www.gnu.org/software/gettext/gettext.html), a localization framework originally written in C.

If you just want to parse or compile mo/po files, for use with this library or elsewhere, check out [gettext-parser](https://github.com/smhg/gettext-parser).

-   [Features](#features)
    -   [Differences from GNU gettext](#differences-from-gnu-gettext)
-   [Installation](#installation)
-   [Usage](#usage)
    -   [Error events](#error-events)
    -   [Recipes](#recipes)
-   [API](#api)
-   [License](#license)
-   [See also](#see-also)

## Features

-   Supports domains, contexts and plurals
-   Supports .json, .mo and .po files with the help of [gettext-parser](https://github.com/smhg/gettext-parser)
-   Ships with plural forms for 136 languages
-   Change locale or domain on the fly
-   Useful error messages enabled by a `debug` option
-   Emits events for internal errors, such as missing translations

### Differences from GNU gettext

There are two main differences between `@postalsys/gettext` and GNU's gettext:

1. **There are no categories.** GNU gettext features [categories such as `LC_MESSAGES`, `LC_NUMERIC` and `LC_MONETARY`](https://www.gnu.org/software/gettext/manual/gettext.html#Locale-Environment-Variables), but since there already is a plethora of great JavaScript libraries to deal with numbers, currencies, dates etc, `@postalsys/gettext` is simply targeted towards strings/phrases. You could say it just assumes the `LC_MESSAGES` category at all times.
2. **You have to read translation files from the file system yourself.** GNU gettext is a C library that reads files from the file system. This is done using `bindtextdomain(domain, localesDirPath)` and `setlocale(category, locale)`, where these four parameters combined are used to read the appropriate translations file.

However, since `@postalsys/gettext` needs to work both on the server in web browsers (which usually is referred to as it being _universal_ or _isomorphic_ JavaScript), it is up to the developer to read translation files from disk or somehow provide it with translations as pure JavaScript objects using [`addTranslations(locale, domain, translations)`](#gettextsetlocalelocale).

`bindtextdomain` will be provided as an optional feature in a future release.

## Installation

```sh
npm install --save @postalsys/gettext
```

## Usage

```js
const Gettext = require("@postalsys/gettext");
const swedishTranslations = require("./translations/sv-SE.json");

const gt = new Gettext();
gt.addTranslations("sv-SE", "messages", swedishTranslations);
gt.setLocale("sv-SE");

gt.gettext("The world is a funny place");
// -> "Världen är en underlig plats"
```

### Error events

```js
// Add translations etc...

gt.on("error", (error) => console.log("oh nose", error));
gt.gettext("An unrecognized message");
// -> 'oh nose', 'An unrecognized message'
```

### Recipes

#### Load and add translations from .mo or .po files

`@postalsys/gettext` expects all translations to be in the format specified by [`gettext-parser`](https://github.com/smhg/gettext-parser). Therefor, you should use that to parse .mo or .po files.

Here is an example where we read a bunch of translation files from disk and add them to our `Gettext` instance:

```js
const fs = require("fs");
const path = require("path");
const Gettext = require("@postalsys/gettext");
const { po } = require("gettext-parser");

// In this example, our translations are found at
// path/to/locales/LOCALE/DOMAIN.po
const translationsDir = "path/to/locales";
const locales = ["en", "fi-FI", "sv-SE"];
const domain = "messages";

const gt = new Gettext();

locales.forEach((locale) => {
    const fileName = `${domain}.po`;
    const translationsFilePath = path.join(translationsDir, locale, fileName);
    const translationsContent = fs.readFileSync(translationsFilePath);

    const parsedTranslations = po.parse(translationsContent);
    gt.addTranslations(locale, domain, parsedTranslations);
});
```

## API

<a name="Gettext"></a>

## Gettext

-   [Gettext](#Gettext)
    -   [new Gettext([options])](#new_Gettext_new)
    -   [.on(eventName, callback)](#Gettext+on)
    -   [.off(eventName, callback)](#Gettext+off)
    -   [.addTranslations(locale, domain, translations)](#Gettext+addTranslations)
    -   [.setLocale(locale)](#Gettext+setLocale)
    -   [.setTextDomain(domain)](#Gettext+setTextDomain)
    -   [.gettext(msgid)](#Gettext+gettext) ⇒ <code>String</code>
    -   [.dgettext(domain, msgid)](#Gettext+dgettext) ⇒ <code>String</code>
    -   [.ngettext(msgid, msgidPlural, count)](#Gettext+ngettext) ⇒ <code>String</code>
    -   [.dngettext(domain, msgid, msgidPlural, count)](#Gettext+dngettext) ⇒ <code>String</code>
    -   [.pgettext(msgctxt, msgid)](#Gettext+pgettext) ⇒ <code>String</code>
    -   [.dpgettext(domain, msgctxt, msgid)](#Gettext+dpgettext) ⇒ <code>String</code>
    -   [.npgettext(msgctxt, msgid, msgidPlural, count)](#Gettext+npgettext) ⇒ <code>String</code>
    -   [.dnpgettext(domain, msgctxt, msgid, msgidPlural, count)](#Gettext+dnpgettext) ⇒ <code>String</code>
    -   [.textdomain()](#Gettext+textdomain)
    -   [.setlocale()](#Gettext+setlocale)

<a name="new_Gettext_new"></a>

### new Gettext([options])

Creates and returns a new Gettext instance.

**Returns**: <code>Object</code> - A Gettext instance
**Params**

-   `[options]`: <code>Object</code> - A set of options
    -   `.sourceLocale`: <code>String</code> - The locale that the source code and its texts are written in. Translations for this locale is not necessary.
    -   `.debug`: <code>Boolean</code> - Whether to output debug info into the
        console.

<a name="Gettext+on"></a>

### gettext.on(eventName, callback)

Adds an event listener.

**Params**

-   `eventName`: <code>String</code> - An event name
-   `callback`: <code>function</code> - An event handler function

<a name="Gettext+off"></a>

### gettext.off(eventName, callback)

Removes an event listener.

**Params**

-   `eventName`: <code>String</code> - An event name
-   `callback`: <code>function</code> - A previously registered event handler function

<a name="Gettext+addTranslations"></a>

### gettext.addTranslations(locale, domain, translations)

Stores a set of translations in the set of gettext
catalogs.

**Params**

-   `locale`: <code>String</code> - A locale string
-   `domain`: <code>String</code> - A domain name
-   `translations`: <code>Object</code> - An object of gettext-parser JSON shape

**Example**

```js
gt.addTranslations("sv-SE", "messages", translationsObject);
```

<a name="Gettext+setLocale"></a>

### gettext.setLocale(locale)

Sets the locale to get translated messages for.

**Params**

-   `locale`: <code>String</code> - A locale

**Example**

```js
gt.setLocale("sv-SE");
```

<a name="Gettext+setTextDomain"></a>

### gettext.setTextDomain(domain)

Sets the default gettext domain.

**Params**

-   `domain`: <code>String</code> - A gettext domain name

**Example**

```js
gt.setTextDomain("domainname");
```

<a name="Gettext+gettext"></a>

### gettext.gettext(msgid) ⇒ <code>String</code>

Translates a string using the default textdomain

**Returns**: <code>String</code> - Translation or the original string if no translation was found
**Params**

-   `msgid`: <code>String</code> - String to be translated

**Example**

```js
gt.gettext("Some text");
```

<a name="Gettext+dgettext"></a>

### gettext.dgettext(domain, msgid) ⇒ <code>String</code>

Translates a string using a specific domain

**Returns**: <code>String</code> - Translation or the original string if no translation was found
**Params**

-   `domain`: <code>String</code> - A gettext domain name
-   `msgid`: <code>String</code> - String to be translated

**Example**

```js
gt.dgettext("domainname", "Some text");
```

<a name="Gettext+ngettext"></a>

### gettext.ngettext(msgid, msgidPlural, count) ⇒ <code>String</code>

Translates a plural string using the default textdomain

**Returns**: <code>String</code> - Translation or the original string if no translation was found
**Params**

-   `msgid`: <code>String</code> - String to be translated when count is not plural
-   `msgidPlural`: <code>String</code> - String to be translated when count is plural
-   `count`: <code>Number</code> - Number count for the plural

**Example**

```js
gt.ngettext("One thing", "Many things", numberOfThings);
```

<a name="Gettext+dngettext"></a>

### gettext.dngettext(domain, msgid, msgidPlural, count) ⇒ <code>String</code>

Translates a plural string using a specific textdomain

**Returns**: <code>String</code> - Translation or the original string if no translation was found
**Params**

-   `domain`: <code>String</code> - A gettext domain name
-   `msgid`: <code>String</code> - String to be translated when count is not plural
-   `msgidPlural`: <code>String</code> - String to be translated when count is plural
-   `count`: <code>Number</code> - Number count for the plural

**Example**

```js
gt.dngettext("domainname", "One thing", "Many things", numberOfThings);
```

<a name="Gettext+pgettext"></a>

### gettext.pgettext(msgctxt, msgid) ⇒ <code>String</code>

Translates a string from a specific context using the default textdomain

**Returns**: <code>String</code> - Translation or the original string if no translation was found
**Params**

-   `msgctxt`: <code>String</code> - Translation context
-   `msgid`: <code>String</code> - String to be translated

**Example**

```js
gt.pgettext("sports", "Back");
```

<a name="Gettext+dpgettext"></a>

### gettext.dpgettext(domain, msgctxt, msgid) ⇒ <code>String</code>

Translates a string from a specific context using s specific textdomain

**Returns**: <code>String</code> - Translation or the original string if no translation was found
**Params**

-   `domain`: <code>String</code> - A gettext domain name
-   `msgctxt`: <code>String</code> - Translation context
-   `msgid`: <code>String</code> - String to be translated

**Example**

```js
gt.dpgettext("domainname", "sports", "Back");
```

<a name="Gettext+npgettext"></a>

### gettext.npgettext(msgctxt, msgid, msgidPlural, count) ⇒ <code>String</code>

Translates a plural string from a specific context using the default textdomain

**Returns**: <code>String</code> - Translation or the original string if no translation was found
**Params**

-   `msgctxt`: <code>String</code> - Translation context
-   `msgid`: <code>String</code> - String to be translated when count is not plural
-   `msgidPlural`: <code>String</code> - String to be translated when count is plural
-   `count`: <code>Number</code> - Number count for the plural

**Example**

```js
gt.npgettext("sports", "Back", "%d backs", numberOfBacks);
```

<a name="Gettext+dnpgettext"></a>

### gettext.dnpgettext(domain, msgctxt, msgid, msgidPlural, count) ⇒ <code>String</code>

Translates a plural string from a specifi context using a specific textdomain

**Returns**: <code>String</code> - Translation or the original string if no translation was found
**Params**

-   `domain`: <code>String</code> - A gettext domain name
-   `msgctxt`: <code>String</code> - Translation context
-   `msgid`: <code>String</code> - String to be translated
-   `msgidPlural`: <code>String</code> - If no translation was found, return this on count!=1
-   `count`: <code>Number</code> - Number count for the plural

**Example**

```js
gt.dnpgettext("domainname", "sports", "Back", "%d backs", numberOfBacks);
```

<a name="Gettext+textdomain"></a>

### gettext.textdomain()

C-style alias for [setTextDomain](#gettextsettextdomaindomain)

**See**: Gettext#setTextDomain
<a name="Gettext+setlocale"></a>

### gettext.setlocale()

C-style alias for [setLocale](#gettextsetlocalelocale)

**See**: Gettext#setLocale

## License

MIT

## See also

-   [gettext-parser](https://github.com/smhg/gettext-parser) - Parsing and compiling gettext translations between .po/.mo files and JSON
-   [lioness](https://github.com/alexanderwallin/lioness) – Gettext library for React
-   [react-gettext-parser](https://github.com/laget-se/react-gettext-parser) - Extracting gettext translatable strings from JS(X) code
-   [narp](https://github.com/laget-se/narp) - Workflow CLI tool that syncs translations between your app and Transifex
