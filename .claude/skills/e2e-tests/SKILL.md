---
name: e2e-tests
description: Run, write and debug WebSkat's Playwright end-to-end tests (multi-browser games over a local signaling relay, reconnect, Geberskat, layout at 7 viewports). Use when UI flows, layout, test ids or networking changed, or an e2e test fails.
---

# Playwright e2e tests

Full guide: `docs/dev/e2e.md`. Folder rules: `e2e/AGENTS.md`.

## Run

1. Once: `npx playwright install chromium` (or set `WEBSKAT_CHROMIUM=/path/to/chromium`).
2. Ports 5173 and 8787 must be free (the config starts relay + Vite itself).
3. One spec while working: `npx playwright test e2e/<spec>.ts` (`-g "title"` filters).
4. Then all: `npm run e2e` (several minutes; `game` ~1.5 min, `geberskat` ~3.5 min).
5. `npm run check` (lint covers `e2e/`).

| Spec | Run it when you changed |
|---|---|
| `game.spec.ts` | bidding/skat/declare/play UI, result dialog, stats history |
| `geberskat.spec.ts` | public list, 4+ players, sitting-out line, rotation, Continue |
| `reconnect.spec.ts` | sessions, tokens, host snapshot, `openTable`, rejoin |
| `layout.spec.ts` | any CSS or markup of the game screen, card sizes, TopBar, panels |

## Debug a failure

- Read the assertion message; layout failures name the phase and element box.
- Trace: `npx playwright show-trace test-results/<test>/trace.zip`.
- Layout screenshots: `test-results/layout-<viewport>-<phase>.png`.
- Robot stuck? Usually a missing/renamed `data-testid` or a button that is enabled but does
  nothing. Check the ids list in `docs/dev/e2e.md` §6 against `grep -rn data-testid src/ui`.
- Click on a hand card does nothing? Cards overlap; click `{ x: 6, y: 40 }`.
- `layout.spec.ts` cannot win the bidding? Seed 6 relies on `#/dev/local` restarting the bot RNG
  for each bot turn (`randomSeed: () => seed`); keep that or pick a new seed and update docs.
- Sandboxed shell: Chromium may need unsandboxed execution.

## Write a new spec

1. Only for multi-browser flows, real networking, reloads or layout; otherwise a unit/jsdom test.
2. Use `helpers.ts` (`newPlayer`, `createTable`, `joinTable`, `startGame`, `waitForHand`) and
   `robot.ts` (`playUntilResult`, `continueAfterResult`).
3. Select by `data-testid`; add missing ids to components and to `docs/dev/e2e.md` §6.
4. Wait with `expect(...)` (no sleeps); close contexts in `finally` with `closeAll`.
5. Add the spec to the tables in `docs/dev/e2e.md` §3 and `e2e/AGENTS.md`.
