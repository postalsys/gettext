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

{{>main}}

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## See Also

-   [gettext-parser](https://github.com/smhg/gettext-parser) - Parse and compile gettext translations between `.po`/`.mo` files and JSON.
-   [lioness](https://github.com/alexanderwallin/lioness) - Gettext library for React applications.
-   [react-gettext-parser](https://github.com/lagetse/react-gettext-parser) - Extract translatable strings from React components.
-   [narp](https://github.com/lagetse/narp) - CLI tool for synchronizing translations between your app and Transifex.
