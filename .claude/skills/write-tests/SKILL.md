---
name: write-tests
description: How to write unit, property and component tests (Vitest) in WebSkat - where tests go, the test helpers of each layer, conventions (seeds, fake timers, jsdom pragma, no jest-dom), and which test a given change needs. Use when adding or fixing tests.
---

# Write tests in WebSkat

Full guide and inventory: `docs/dev/testing.md`. E2E: skill `e2e-tests`.

## Where

- Next to the code: `foo.ts` ↔ `foo.test.ts`, React: `Foo.test.tsx`.
- Engine and table are tested exhaustively; net with the fake network; UI with a few jsdom tests.

## Conventions

- Deterministic: fixed seeds, `vi.useFakeTimers()`; never `Date` or real timers.
- Rules tests: `it.each` tables copied from `docs/skat-rules.md`, with `// skat-rules §N`.
- Errors: assert `result.ok === false` and `result.error.code`.
- Immutability: `const before = snapshot(state)` → act → `expect(state).toEqual(before)`.
- React/hooks: first line `// @vitest-environment jsdom`; `render`, `screen`, `renderHook`, `act`
  from `@testing-library/react`; `userEvent` for clicks.
- No jest-dom matchers. Use `el.hasAttribute('disabled')`, `el.textContent`. CSS modules hash
  class names: select with `[class*="disabled"]`.
- Keep test files < 300 lines; split by topic.

## Helpers (test-only, never exported from `index.ts`)

| Layer | File | Main helpers |
|---|---|---|
| engine | `src/engine/testing.ts` | `hand('CJ SJ HA')`, `stateWith({...})`, `apply`, `run(state, steps)`, `bid(18)`, `PASS`, `HOLD`, `PICKUP`, `PLAY_HAND`, `afterBidding()`, `playingState()`, `snapshot` |
| table | `src/table/testing.ts`, `fixtures.ts` | `tableWith(n, {bots, maxSeats})`, `ctxFor(seed)`, `randomStep`, `playUntilRecords`; `finishedGame`, `GRAND_144`, `DIAMONDS_LOST`, `NULL_OUVERT_WON` |
| bots | `src/table/bot/arena.ts` | `playGame`, `match(a, b, deals)`, `envFlag('BOT_BENCH')` |
| net | `src/net/testing.ts`, `fake.ts` | `createRig()`, `joinClient(rig, peer, name, token?)`, `settle(rig)`, `lastView`, `statusOf`, `errorsOf`, `CARD_PATTERN` |

## Which test for which change

| Change | Test |
|---|---|
| rule/scoring | table-driven engine test; `game.fuzz.test.ts` must stay green |
| engine action/phase | flow + error + immutability + `getLegal` tests |
| table command | success, every error code, state unchanged on error (`table.test.ts`) |
| view field | per viewer type in `view.test.ts`; extend the oracle in `view.redaction.test.ts` if it can hold cards |
| protocol | valid sample parses, malformed samples rejected (`protocol.test.ts`) |
| host/client | `host.test.ts` with the rig |
| bot | scenario with a hand-built `BotView` (`heuristics.test.ts` style) |
| component | enabled/disabled from props, command sent on click |
| stored data | round trip, invalid → defaults, migration of old shapes |

## Never

Delete or weaken the property tests: `game.fuzz.test.ts`, `view.redaction.test.ts`,
`bot/knowledge.test.ts`, `bot/levels.test.ts`.

## Run

`npx vitest run <file>` → `npx vitest run <folder>` → `npm run check`.
New test file → add it to the inventory in `docs/dev/testing.md` §4 if it covers a new area.
