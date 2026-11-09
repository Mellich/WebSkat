---
name: run-checks
description: Run WebSkat's verification (npm run check = typecheck + lint + unit tests, optional e2e) and fix typical TypeScript/ESLint/Vitest failures without silencing rules. Use before finishing any change or when a check fails.
---

# Run and fix the checks

## Commands

| Command | Time | When |
|---|---|---|
| `npx vitest run <file or folder>` | seconds | while working |
| `npm run typecheck` | ~10 s | after type changes |
| `npm run lint` | ~20 s | after code changes |
| `npm run check` | ~1 min | **always before finishing**; must be green |
| `npm run e2e` | minutes | UI flows, layout, test ids, networking changed (skill `e2e-tests`) |
| `BOT_BENCH=1 npx vitest run src/table/bot` | minutes | bot strength/performance changes |

Run long commands in the background if your tool allows it, and read only the tail of the output.

## Fixing failures (never use `any`, `@ts-ignore`, `eslint-disable`, or weaken tests)

| Message | Fix |
|---|---|
| `Object is possibly 'undefined'` | `noUncheckedIndexedAccess`: handle `undefined` (`?? x`, guard, early return) |
| optional property / `undefined` not assignable | `exactOptionalPropertyTypes`: `...(v === undefined ? {} : { k: v })` or type `k?: T \| undefined` |
| `Cannot find name 'window'` / `'console'` in engine/table | pure layer: pass the value in or move the code to `src/ui`/`src/net` |
| property missing in a `de*.ts` part (`i18n/parts/`) | add the German string for the new key to the matching part |
| zod schema not assignable to `ZodType<…>` | update `src/net/schemaGame.ts` / `schemaView.ts` to match the type |
| `no-restricted-globals` / `no-restricted-properties` (`Math.random`, `Date`) | inject `ctx.now`, `ctx.seed`, `rand` |
| `src/ui/changelog/changelog.test.ts` fails | `package.json` version and the newest `CHANGELOG.md` release differ, or a release lacks a date/item: fix per `docs/dev/versioning.md` §3 (never edit the test) |
| `no-restricted-imports` | wrong layer import; imports go ui → net → table → engine only |
| `switch-exhaustiveness-check` | add the missing `case` |
| `restrict-template-expressions` | wrap numbers: `` `${String(n)}` `` |
| `no-unnecessary-condition` | remove the impossible check or fix the type |
| `react-hooks/*` | restructure; hooks at top level, complete dependency lists |
| test times out | infinite loop (bot/reducer) or real timer; use fake timers |
| jsdom test: `matchMedia`/`window` missing | `// @vitest-environment jsdom`; guard with try/catch |
| fuzz/redaction/fairness test fails | real bug: fix the code, not the test |

## Report

State exactly which commands ran and their result (pass/fail counts). If something was not run
(e.g. e2e), say so.
