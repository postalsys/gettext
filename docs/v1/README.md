# @postalsys/gettext

[![Build Status](https://secure.travis-ci.org/postalsys/gettext.png)](http://travis-ci.org/postalsys/gettext)
[![npm version](https://badge.fury.io/js/@postalsys/gettext.svg)](https://badge.fury.io/js/@postalsys/gettext)

**@postalsys/gettext** is a Node.JS module to use .MO and .PO files.

**NB!** If you just want to parse or compile mo/po files, check out [gettext-parser](https://github.com/andris9/gettext-parser).

## Features

-   Load binary _MO_ or source _PO_ files
-   Supports contexts and plurals

## Installation

```sh
npm install @postalsys/gettext
```

## Usage

### Create a new Gettext object

```js
var Gettext = require("@postalsys/gettext");

var gt = new Gettext();
```

### Check or change default language

_textdomain(domain)_

```js
gt.textdomain("et");
```

The function also returns the current texdomain value

```js
var curlang = gt.textdomain();
```

## Translation methods

### Load a string from default language file

_gettext(msgid)_

```js
var greeting = gt.gettext("Hello!");
```

### Load a string from a specific language file

_dgettext(domain, msgid)_

```js
var greeting = gt.dgettext("et", "Hello!");
```

### Load a plural string from default language file

_ngettext(msgid, msgid_plural, count)_

```js
gt.ngettext("%d Comment", "%d Comments", 10);
```

### Load a plural string from a specific language file

_dngettext(domain, msgid, msgid_plural, count)_

```js
gt.dngettext("et", "%d Comment", "%d Comments", 10);
```

### Load a string of a specific context

_pgettext(msgctxt, msgid)_

```js
gt.pgettext("menu items", "File");
```

### Load a string of a specific context from specific language file

_dpgettext(domain, msgctxt, msgid)_

```js
gt.dpgettext("et", "menu items", "File");
```

### Load a plural string of a specific context

_npgettext(msgctxt, msgid, msgid_plural, count)_

```js
gt.npgettext("menu items", "%d Recent File", "%d Recent Files", 3);
```

### Load a plural string of a specific context from specific language file

_dnpgettext(domain, msgctxt, msgid, msgid_plural, count)_

```js
gt.dnpgettext("et", "menu items", "%d Recent File", "%d Recent Files", 3);
```

### Get comments for a translation (if loaded from PO)

_getComment(domain, msgctxt, msgid)_

```js
gt.getComment("et", "menu items", "%d Recent File");
```

Returns an object in the form of `{translator: "", extracted: "", reference: "", flag: "", previous: ""}`

## Advanced handling

If you need the translation object for a domain, for example `et_EE`, you can access it from `gt.domains.et_EE`.

If you want modify it and compile it to _mo_ or _po_, checkout [gettext-parser](https://github.com/andris9/gettext-parser) module.

## License

MIT
