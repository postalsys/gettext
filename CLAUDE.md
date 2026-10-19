# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                  # run the full suite (node --test test/*-test.js)
npm run test:coverage     # the suite under c8
npm run test:cjs          # the suite with require(esm) disabled (CommonJS guard)
npm run lint              # eslint .
npm run lint:fix          # eslint . --fix
npm run format            # prettier --write .
npm run format:check      # prettier --check .
npm run docs              # regenerate README.md from docs/README.template.md + JSDoc in lib/gettext.js
npm run update            # rm -rf node_modules package-lock.json && ncu -u && npm install
```

Run a single test file or a single test by name (Node's built-in test runner):

```bash
node --test test/gettext-test.js
node --test --test-name-pattern="should return plural from default context" test/gettext-test.js
```

## Platform constraints

The main consumer is EmailEngine (`lib/translations.js` there), which ships as a standalone binary built with `@yao-pkg/pkg`. That binary snapshots a CommonJS module graph and cannot load ES modules, and EmailEngine supports Node 20 and later. Two rules follow:

- **Node.js 20 is the minimum.** Runtime code, tests and tooling must work on Node 20, 22 and 24 (`engines.node` is `>=20.0.0`; CI runs all three).
- **Everything that reaches runtime must be genuinely CommonJS.** All source uses `require`/`module.exports`. `require()` of the package must work with `--no-experimental-require-module`: Node 22+ (and 20.19) load ESM through `require()` by default, which would hide an ESM-only dependency until the pkg binary fails. A CJS wrapper around a dynamic `import()` does not count. Never add or upgrade to an ESM-only dependency; pin the last CommonJS major in `.ncurc.js` (`reject` or `target`) with a comment giving the reason.

Check with `npm run test:cjs`, which runs the full suite under `NODE_OPTIONS=--no-experimental-require-module`. CI runs it on Node 22.x and 24.x, the versions where require(esm) is on by default.

## Critical constraints

- **No runtime dependencies.** The package ships `lib/` with nothing in `dependencies`. Keep it that way unless there is a strong reason. `gettext-parser` (maintained upstream by smhg, not by us) is only referenced in docs: callers parse `.po`/`.mo` files with it and pass the resulting JSON shape to `addTranslations()`.
- **README.md is generated.** Edit `docs/README.template.md` or the JSDoc comments in `lib/gettext.js`, then run `npm run docs`. README.md, `docs/` and `test/fixtures/` are excluded from Prettier (the jsdoc2md Handlebars partials do not parse, and fixtures must stay byte-identical).
- **Releases are automated via release-please** (`.github/workflows/release.yaml`, publishes to npm with provenance). The version in `package.json` and `CHANGELOG.md` are owned by the bot, do not bump them by hand.

## Architecture

A small library, a fork of `node-gettext` published as `@postalsys/gettext`.

- `lib/gettext.js` exports the `Gettext` class. Translations are stored in `this.catalogs[locale][domain]` in gettext-parser JSON shape (`{ charset, headers, translations: { [msgctxt]: { [msgid]: { msgstr: [...], comments } } } }`). All lookup methods (`gettext`, `dgettext`, `ngettext`, `dngettext`, `pgettext`, `dpgettext`, `npgettext`, `dnpgettext`) funnel into `_ldnpgettext(locale, domain, msgctxt, msgid, msgidPlural, count)`, which resolves the entry through `_getTranslation()` and picks the plural index with the language's plural function. When nothing is found it returns the msgid (or msgidPlural when count is not 1) and emits an `error` event unless the locale is the source locale.
- `useLocale(locale)` returns an object with the same lookup functions bound to a fixed locale, so one shared instance can serve concurrent requests in different languages without mutating `this.locale` (this is how EmailEngine uses it).
- Errors are reported through a tiny built-in event emitter (`on`/`off`/`emit`), not thrown, except for invalid arguments to `useLocale()`. `warn()` also logs to the console when `debug: true`.
- Reserved keys (`locale in {}`, e.g. `__proto__`) are refused as locale or domain names to prevent prototype pollution of `catalogs`.
- `lib/plurals.js` is a static table keyed by language code (`Gettext.getLanguageCode()`: the part before `-`/`_`, lowercased) with `nplurals`, `pluralsText` and `pluralsFunc` per language.

Tests live in `test/gettext-test.js` (node:test with `describe`/`it`, `node:assert/strict`, `mock.fn()` for event listener spies) against the fixture catalog in `test/fixtures/latin13.*`.

## Conventions

These mirror the conventions used across Postal Systems projects (see `../emailengine`).

**Git commits**

- Use Conventional Commits: `fix:` (patch release), `feat:` (minor release), and `chore:`/`docs:`/`ci:`/`build:`/`style:`/`refactor:`/`test:` for changes that should not trigger a release. release-please derives the version and changelog from these prefixes.
- Do **not** list Claude or any AI assistant as a co-author or co-contributor in commit messages or PR descriptions (no `Co-Authored-By` trailer).
- Append `[skip ci]` to commits that do not change runtime behavior (docs, comments, CI/workflow tweaks, formatting) to avoid spending CI minutes. Exception: never add `[skip ci]` to a `fix:` or `feat:` commit, those must run so the release workflow triggers. GitHub reads the marker off the HEAD commit of a push, so when a push mixes the two, the release-triggering commit has to be last.

**Code and docs style**

- No emojis anywhere in code or documentation, printable ASCII only.
- Use a single hyphen-minus (`-`) as a dash in user-facing strings and docs. Never use double hyphens (`--`), em dashes, or en dashes.

**Before committing code changes**

1. `npm run format` and `npm run lint`
2. `npm test`
3. For non-trivial changes, consider `/simplify` (quality cleanup) and `/security-review`.

**After pushing**

- Check the workflow runs for the push (`gh run list --branch <branch>`) and report their status. If a run fails for an unrelated or infrastructure reason (checkout reporting "account suspended", HTTP 403, other auth errors), check <https://www.githubstatus.com/> for an active GitHub incident before assuming the change caused it.
