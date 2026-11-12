# AGENTS.md — WebSkat

**WebSkat** is a browser-only, peer-to-peer multiplayer Skat game (3 players; 4–6 with
Geberskat), written in TypeScript + React. It is fully implemented (phases 0–14) and you are
maintaining and extending it. Bots (easy/normal/strong) can fill seats.

## 1. Where to read

1. `docs/README.md`: map of all docs and **which files to read for your task**. Read only those.
2. The `AGENTS.md` of every folder you touch: rules, **file map**, recipes, pitfalls.
   `src/engine/`, `src/table/`, `src/net/`, `src/ui/`, `e2e/`.
3. `docs/dev/workflow.md`: the step-by-step process for every change.
4. `docs/dev/versioning.md`: how to write the `CHANGELOG.md` entry (Unreleased) and how to release.

Rules and scoring come only from `docs/skat-rules.md`. Do not invent rules or architecture. If
something is ambiguous, pick the simplest option, write it into `docs/decisions.md`, and continue.
Ask the user if a request conflicts with a hard rule or with `skat-rules.md`.

## 2. Architecture in 6 lines

```
src/ui      React screens, stores (zustand), i18n, localStorage      impure
src/net     Trystero WebRTC transport, zod protocol, host/client      impure
src/table   seats, dealer rotation, commands, records, views, bots   PURE
src/engine  one Skat game: cards, bidding, play, scoring             PURE
```
Imports point down only. The **host** browser runs `src/table` + `src/engine`; clients send
commands and receive per-player redacted views (`docs/architecture.md`).

## 3. Hard rules (violating one is a bug)

1. **`src/engine` and `src/table` are pure TypeScript.** No `react`, DOM, `window`,
   `localStorage`, network, timers, `console`, `Date`, `Math.random`. Time and randomness are
   parameters (`ctx.now`, `ctx.seed`, `rand`). ESLint and `tsconfig.core.json` enforce this.
2. **All game logic lives in `src/engine` / `src/table`.** UI and net code never decide whether a
   move is legal; the UI enables exactly what `view.game.legal` allows.
3. **The host is the only authority.** Clients must never receive other players' hidden cards
   (`docs/hidden-information.md`). Views are built from an allow-list in `src/table/view*.ts`.
4. **Validate all incoming data with zod**: network messages (`src/net/protocol.ts`,
   `schema*.ts`) and `localStorage` reads (`src/ui/persist/`).
5. **TypeScript strict, no `any`, no `@ts-ignore`, no eslint-disable.** Discriminated unions and
   exhaustive `switch` with `assertNever`.
6. **State is immutable.** Return new objects; never mutate arguments. Engine/table functions
   return `Result` and never throw for bad input.
7. Rule and scoring numbers come from `docs/skat-rules.md`. Do not "improve" them.
8. No new dependencies without the user's agreement (`docs/tech-stack.md` §2).
9. Every visible string goes through `t()`, with the key in **both** `en.ts` and `de.ts`.
10. Files < 300 lines, one concept per file, tests next to the code.
11. Never modify or delete anything in `assets/`. Generated images go to `public/`.
12. Do not commit, push or create branches unless the user asks.
13. **Every code change adds a `CHANGELOG.md` entry under `## [Unreleased]`; it never bumps the
    version.** Only when the user requests a release: pick the semver from the collected entries,
    run `npm run release -- X.Y.Z` (release commit, tag `vX.Y.Z`, publish and push `gh-pages`;
    `docs/dev/versioning.md` §4). `package.json` `"version"` is the single source; the newest
    released changelog version must match it (`src/ui/changelog/changelog.test.ts` checks this).

## 4. How to work (summary of `docs/dev/workflow.md`)

1. Read the docs for your task (§1). Find the lowest layer the change belongs to.
2. Write or change a test first; see it fail (`npx vitest run path/to/file.test.ts`).
3. Implement bottom-up: engine → table → net → ui.
4. `npm run check` must be green. Run `npm run e2e` when UI flows, layout, test ids or networking
   changed.
5. Update the docs in the same change (`docs/dev/docs-maintenance.md`) and log decisions in
   `docs/decisions.md`.
6. Add the change to `## [Unreleased]` in `CHANGELOG.md` (`docs/dev/versioning.md`); do not bump the
   version. If the user asks for a release, follow `docs/dev/versioning.md` §4.
7. Report what you changed, which files, and which checks ran with which result.
   Never claim "done" without a green `npm run check`.

## 5. Commands

```
npm install                          install deps (needs Node >= 22.12; check `node -v`)
npm run dev                          dev server http://localhost:5173
npm run check                        typecheck + lint + unit tests   <- before you finish
npx vitest run src/engine/x.test.ts  one test file  (-t "name" filters by test name)
npm run e2e                          Playwright (starts relay + dev server; see docs/dev/e2e.md)
npx playwright test e2e/game.spec.ts one e2e spec
npm run build / npm run preview      production build into dist/ / serve it
npm run assets                       regenerate public/cards and public/backs
npm run textures                     regenerate the felt stamp and the oak texture (committed)
npm run relay                        local signaling relay (port 8787)
npm run release -- X.Y.Z             release (only on request): version, commit, tag vX.Y.Z, publish + push gh-pages
npm run publish:pages                build and prepare the gh-pages commit (no push)
```

Dev pages (DEV builds): `#/dev/local?seed=N&players=3..6&bots=easy|normal|strong` (offline game
against bots, no network) and `#/dev/gallery` (all cards and components). `#/changelog` shows `CHANGELOG.md` (all builds; the
version label bottom left opens it).

## 6. Skills (task checklists)

`.claude/skills/<name>/SKILL.md`. Other agents can read them as plain Markdown.

| Skill | Use for |
|---|---|
| `implement-change` | any feature or behavior change, across layers |
| `fix-bug` | reproducing and fixing a bug with a regression test |
| `write-tests` | choosing and writing unit/component tests, helpers per layer |
| `run-checks` | running `npm run check` / e2e and fixing typical failures |
| `e2e-tests` | running, writing and debugging Playwright tests |
| `change-protocol` | adding/changing a command, action, view field or message |
| `update-docs` | bringing the docs in sync after a change, incl. changelog (Unreleased) |

## 7. Glossary (short; full list in `docs/overview.md` §6)

Vorhand/Mittelhand/Hinterhand = `forehand`/`middlehand`/`hindhand` · Geber = dealer ·
Reizen = bidding (`bid`/`hold`/`pass`) · Alleinspieler = declarer · Skat = the 2 hidden cards ·
Drücken = `discard` · Hand = no Skat pickup · Ouvert = open cards · Schneider ≤ 30 points ·
Schwarz = no trick · Grand = only Jacks trump · Null = declarer takes no trick ·
Spitzen = mit/ohne N top trumps · Eingepasst = `passed-in` · Geberskat = 4+ players, some sit out.
