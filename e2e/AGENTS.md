# AGENTS.md — `e2e/` (Playwright end-to-end tests)

Read first: `docs/dev/e2e.md` (setup, specs, robot, layout test, test ids).

## Rules for this folder

- One browser context per player (own `localStorage`), like separate devices.
- Never use public Nostr relays: `playwright.config.ts` starts `scripts/relay.mjs` and a dev
  server with `VITE_SIGNALING=ws-relay`.
- Address elements by `data-testid`. If a needed id is missing, add it in the component and to
  `docs/dev/e2e.md` §6.
- Wait for conditions (`expect(...).toBeVisible()`, `toHaveCount`), not fixed sleeps.
- The robot clicker must not know rules: it clicks the first enabled option.
- Hand cards overlap: click their left part (`{ x: 6, y: 40 }`).
- Close all contexts in `finally`.
- TypeScript strict and linted like the app (`tsconfig.e2e.json`; `npm run check` covers it).

## File map

| File | Contents |
|---|---|
| `helpers.ts` | `newPlayer`, `createTable`, `joinTable`, `startGame`, `handCards`, `waitForHand`, `storageKey`, `hasHostSnapshot`, `closeAll` |
| `robot.ts` | `robotStep`, `playUntilResult`, `continueAfterResult` |
| `game.spec.ts` | A: three players play one game; result and history row everywhere |
| `geberskat.spec.ts` | B: public table, four players, dealer sits out, rotation after one game |
| `reconnect.spec.ts` | C: client reload, start-page rejoin, host reload + resume |
| `layout.spec.ts` | D: `#/dev/local?seed=6&bots=easy` at 7 viewports, every phase fits without scrolling |

## Commands

```
npx playwright install chromium        # once
npm run e2e                            # all specs
npx playwright test e2e/layout.spec.ts # one spec
npx playwright show-trace test-results/<test>/trace.zip
```
