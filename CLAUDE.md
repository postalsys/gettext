# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build             # scripts/build.js: dist/esm + dist/cjs (also runs on install and publish via `prepare`)
npm test                  # build, then the suite through tsx (test/*-test.ts, test/package/*-test.ts)
npm run test:coverage     # the same under c8, 100% thresholds over src/ (.c8rc.json)
npm run test:cjs          # build, then the CommonJS smoke test with require(esm) disabled
npm run lint              # tsc type-check over src/ and test/, then eslint .
npm run lint:fix          # eslint . --fix
npm run typecheck         # the type-check alone
npm run format            # prettier --write (js, cjs, ts, json, md, yml, yaml)
npm run format:check      # prettier --check, CI runs it
npm run docs              # build, then regenerate README.md from docs/README.template.md + JSDoc in dist/cjs/gettext.js
npm run update            # rm -rf node_modules package-lock.json && ncu -u && npm install
```

Run a single test file or a single test by name (Node's built-in test runner through tsx):

```bash
node --import tsx --test test/gettext-test.ts
node --import tsx --test --test-name-pattern="should return plural from default context" test/gettext-test.ts
```

## Platform constraints

The main consumer is EmailEngine (`lib/translations.js` there), which ships as a standalone binary built with `@yao-pkg/pkg`. That binary snapshots a CommonJS module graph and cannot load ES modules, and EmailEngine supports Node 20 and later. Two rules follow:

- **Node.js 20 is the minimum.** Runtime code, tests and tooling must work on Node 20, 22 and 24 (`engines.node` is `>=20.0.0`; CI runs all three).
- **Everything that reaches runtime must be genuinely CommonJS-loadable.** The CommonJS build in `dist/cjs` is compiled from the same sources as the ES module build, never a wrapper: `require()` of the package must work with `--no-experimental-require-module`. Node 22+ (and 20.19) load ESM through `require()` by default, which would hide an ES module reached through `require()` until the pkg binary fails. A CJS wrapper around a dynamic `import()` does not count. Never drop the CommonJS build, and never add or upgrade to an ESM-only dependency; pin the last CommonJS major in `.ncurc.cjs` (`reject` or `target`) with a comment giving the reason.

Check with `npm run test:cjs`, which builds and runs `test/package/cjs-smoke.cjs` under `NODE_OPTIONS=--no-experimental-require-module`: it requires the package and its `lib/` deep imports by name and does what EmailEngine does (catalog from gettext-parser JSON, `setLocale`, `getLanguageCode`, `useLocale`, `gettext`, `ngettext`). It is plain JavaScript on purpose, tsx's loader would transpile an ES module and hide the failure. CI runs it on Node 22 and later, the versions where require(esm) is on by default.

## TypeScript layout and build

The library is TypeScript under `src/` and is published as a dual package, following `../ioredfour` and `../pubface` (themselves following `../nodemailer` and `../imapflow`):

- `src/gettext.ts` (the `Gettext` class, `export default`, plus the exported types `Catalog`, `Translation`, `TranslationComments`, `GettextOptions`, `LocaleGettext`, `GettextListener`, and the re-exported `PluralRule`, `PluralExample`, `PluralForms`), `src/plural-forms.ts` (named exports `parsePluralForms`, `DEFAULT_PLURAL_FORMS`), `src/plurals.ts` (the plural table, `export default`, typed `Record<string, PluralRule>` so an incomplete entry fails the type-check; the data itself is kept as it was).
- `scripts/build.js` runs `tsc` with `tsconfig.esm.json` (`module: nodenext`, into `dist/esm`) and `tsconfig.cjs.json` (`module: commonjs`, into `dist/cjs`, `--noCheck` since the ES module compile already checked the same sources), writes a `package.json` with the module format into each, and rewrites the CommonJS output of default-export modules so `require()` returns the export itself: `require('@postalsys/gettext')` is the `Gettext` class (with a non-enumerable `.default` alias for transpiled default imports), `require('@postalsys/gettext/lib/plurals')` is the plain table object (deliberately without a `default` alias, its keys are language codes and `default` would look like one). A module with a default export must have no other runtime export (type exports are fine), the build fails otherwise.
- `tsconfig.base.json`: strict, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`, `isolatedModules`, `stripInternal`, target ES2022. `tsconfig.json` type-checks `src/` and `test/` without emitting. `@types/node` stays on the 20.x line and `typescript` on 6.x (`.ncurc.cjs`).
- `package.json`: `"type": "module"`, `main`/`types` point at `dist/cjs/gettext.*`, and `exports` maps `.`, `./lib/gettext(.js)`, `./lib/plural-forms(.js)`, `./lib/plurals(.js)` (the files of the JavaScript package) to both builds, plus `./package.json`; `typesVersions` resolves the `lib/*` types for node10 resolution. `files` is `dist` and the docs files; `src/`, `test/`, `scripts/` and `docs/` are not published. `dist/` is gitignored and built by `prepare`, so `npm ci` in the release workflow builds it before `npm publish`.
- Source rules: every file compiles both ways, so no `import.meta`, `require`, `__dirname`, top-level `await` or JSON imports in `src/`; no enums, namespaces with code or parameter properties; relative imports carry `.js`; every optional property of a public interface is declared `| undefined`. Underscore methods are `@internal` (present at runtime, stripped from the declarations). `src/` is also linted with the type-aware rules.

## Critical constraints

- **No runtime dependencies.** The package ships `dist/` with nothing in `dependencies`. Keep it that way unless there is a strong reason. `gettext-parser` (maintained upstream by smhg, not by us) is only referenced in docs: callers parse `.po`/`.mo` files with it and pass the resulting JSON shape to `addTranslations()`.
- **README.md is generated.** Edit `docs/README.template.md` or the JSDoc comments in `src/gettext.ts`, then run `npm run docs` (it builds first and reads the JSDoc tsc keeps in `dist/cjs/gettext.js`, jsdoc2md does not parse TypeScript; keep the `{Type}` annotations in the JSDoc for it). README.md, `docs/` and `test/fixtures/` are excluded from Prettier (the jsdoc2md Handlebars partials do not parse, and fixtures must stay byte-identical).
- **Releases are automated via release-please** (`.github/workflows/release.yaml`, publishes to npm with provenance). The version in `package.json` and `CHANGELOG.md` are owned by the bot, do not bump them by hand.

## Architecture

A small library, a fork of `node-gettext` published as `@postalsys/gettext`.

- `src/gettext.ts` exports the `Gettext` class. Translations are stored in `this.catalogs[locale][domain]` in gettext-parser JSON shape (`{ charset, headers, translations: { [msgctxt]: { [msgid]: { msgstr: [...], comments } } } }`). All lookup methods (`gettext`, `dgettext`, `ngettext`, `dngettext`, `pgettext`, `dpgettext`, `npgettext`, `dnpgettext`) funnel into `_ldnpgettext(locale, domain, msgctxt, msgid, msgidPlural, count)`, which resolves the entry through `_getTranslation()` and picks the plural index with the language's plural function. When nothing is found it returns the msgid (or msgidPlural when count is not 1) and emits an `error` event unless the locale is the source locale.
- `useLocale(locale)` returns an object with the same lookup functions bound to a fixed locale, so one shared instance can serve concurrent requests in different languages without mutating `this.locale` (this is how EmailEngine uses it).
- Errors are reported through a tiny built-in event emitter (`on`/`off`/`emit`), not thrown, except for invalid arguments to `useLocale()`. `warn()` also logs to the console when `debug: true`.
- Reserved keys (`locale in {}`, e.g. `__proto__`) are refused as locale or domain names to prevent prototype pollution of `catalogs`.
- `src/plurals.ts` is a static table keyed by language code (`Gettext.getLanguageCode()`: the part before `-`/`_`, lowercased) with `nplurals`, `pluralsText` and `pluralsFunc` per language.

Tests are TypeScript, run with `node --import tsx --test` against `src/`: `test/gettext-test.ts` (node:test with `describe`/`it`, `node:assert/strict`, `mock.fn()` for event listener spies) against the fixture catalog in `test/fixtures/latin13.*`, and `test/plural-forms-test.ts` (the Plural-Forms evaluator and the catalog-header fallback for languages missing from the table). Deliberately invalid arguments are cast with `as any`, the runtime checks are what those tests cover. `test/package/` runs against the built `dist/`: module shapes of both builds and the deep imports through the exports map (`package-test.ts`), consumer programs type-checked against the shipped declarations under node16 ESM, node16 CommonJS and bundler resolution with `exactOptionalPropertyTypes`, plus the stripped internals and the plural table type (`types-consumer-test.ts`), and the CommonJS smoke test (`cjs-smoke.cjs`, run by `npm run test:cjs`, not by `npm test`). CI (`.github/workflows/test.yml`) runs lint, format check and the suite on Node 20, 22, 24 and latest (coverage on 24) and `npm run test:cjs` on Node 22 and later.

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
2. `npm test` and `npm run test:cjs`, and `npm run test:coverage` for changes to `src/`
3. For non-trivial changes, consider `/simplify` (quality cleanup) and `/security-review`.

**After pushing**

- Check the workflow runs for the push (`gh run list --branch <branch>`) and report their status. If a run fails for an unrelated or infrastructure reason (checkout reporting "account suspended", HTTP 403, other auth errors), check <https://www.githubstatus.com/> for an active GitHub incident before assuming the change caused it.
