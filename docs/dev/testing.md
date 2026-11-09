# Unit, property and component tests (Vitest)

Principle: **engine and table are tested exhaustively; net and UI are tested at their seams.**
Write the test with or before the code. End-to-end tests: `dev/e2e.md`.

## 1. Running tests

| Command | Use |
|---|---|
| `npm run test` | all Vitest tests once (~30 s; part of `npm run check`) |
| `npx vitest run src/engine/bidding.test.ts` | one file |
| `npx vitest run src/table/bot` | one folder |
| `npx vitest run -t "holds the trick"` | tests whose name contains the text |
| `npm run test:watch` | watch mode |
| `BOT_BENCH=1 npx vitest run src/table/bot` | also the slow bot benchmarks (strong vs normal, perf) |

Slow tests inside the normal run: `game.fuzz.test.ts` (~9 s, 2000 games), `levels.test.ts`
("normal beats easy", 300-game legality runs), `bot.test.ts` (bot-only tables of 3–6 players).

## 2. Conventions

- Test file next to the code: `foo.ts` ↔ `foo.test.ts` (`.test.tsx` for React).
- Environment is Node. Component and hook tests start with `// @vitest-environment jsdom`.
- No real time, no randomness: fixed seeds (`mulberry32(seed)`, `ctxFor(seed)`),
  `vi.useFakeTimers()` for timers. Never depend on `Date` or object key order.
- Rules tests are table-driven with `it.each`, rows copied from `skat-rules.md` (cite the section,
  e.g. `// skat-rules §6.4`).
- Reducers get an immutability check: `const before = snapshot(state)`, run, then
  `expect(state).toEqual(before)`, also on errors.
- Error cases assert the `error.code`, not the message.
- No `@testing-library/jest-dom` (not a dependency): use plain DOM assertions
  (`element.hasAttribute('disabled')`, `textContent`). CSS module class names are hashed: select
  with `[class*="disabled"]`, never `.disabled`.
- Query React components by role and accessible name (`screen.getByRole('button', { name: … })`)
  or by `data-testid`.
- Test files also stay < 300 lines; split by topic (`game.test.ts`, `game.legal.test.ts`,
  `game.scripted.test.ts`).

## 3. Test helpers (test-only; never exported from an `index.ts`)

| File | Helpers |
|---|---|
| `src/engine/testing.ts` | `hand('CJ SJ HA S10')`, `cardAt`, `snapshot` (deep clone), `stateWith(overrides)`, `apply(state, role, action)` (throws on error), `run(state, steps)`, `absentCard`, actions `bid(v)`, `PASS`, `HOLD`, `PICKUP`, `PLAY_HAND`, `DECLARE_HEARTS`, states `afterBidding()`, `afterPickup()`, `afterDiscard()`, `playingState()` |
| `src/table/testing.ts` | `tableWith(count, {bots?, maxSeats?})`, `ctxFor(seed, now?)`, `randomStep`, `playUntilRecords`, `pickRandom` |
| `src/table/fixtures.ts` | `finishedGame(table, roles, result, number, sittingOut?)`, results `GRAND_144`, `DIAMONDS_LOST`, `NULL_OUVERT_WON` |
| `src/table/bot/arena.ts` | `playGame`, `match(levelA, levelB, deals)`, `envFlag`, `nowMs` (engine-only bot games) |
| `src/net/fake.ts` | `createFakeNetwork()` with `flush()`, `members()`, `drop()` |
| `src/net/testing.ts` | `KEY`, `CARD_PATTERN`, `createRig({maxSeats?, isPublic?, withLobby?})`, `joinClient(rig, peerId, name, token?)`, `settle(rig)` (flush until quiet), `nextCommand(view)`, `lastView`, `statusOf`, `errorsOf` |

## 4. What exists (inventory)

| Area | Files | Covers |
|---|---|---|
| Engine | `cards`, `rng`, `deck`, `trump`, `spitzen`, `values`, `declaration`, `bidding`, `play`, `scoring` `.test.ts` | every table of `skat-rules.md` §3–§10 incl. all 20 scoring vectors, strict bidding, `nextBidValue` |
| Engine reducer | `game.test.ts`, `game.legal.test.ts`, `game.scripted.test.ts`, `game.fuzz.test.ts`, `ramsch.test.ts` (R1–R5 vectors, Ramsch flow), `ramsch.fuzz.test.ts` (500 Ramsch games) | flows (passed in, hand, pickup/discard, ouvert), errors, immutability, `getLegal`, a full scripted Null game, 2000-game fuzz invariants (`engine.md` §7) |
| Table | `table.test.ts`, `leave.test.ts`, `replace.test.ts`, `seating.test.ts`, `rotation.test.ts`, `records.test.ts`, `stats.test.ts`, `rules.test.ts` (set-rules, deal option), `bock.test.ts` (Bock trigger, counter, table flow over random games), `ramsch.test.ts` (Ramsch records, stats, views) | commands and errors, leaving during a game (removed at the next deal), replacing a seat (role, dealer and sitter moved, next deal after bot replacement), pending/seating, `removePlayer` pointer maths, rotation N = 3..6, Seeger vectors and bonus, stats |
| Views | `view.test.ts`, `view.redaction.test.ts` | fields per viewer; **redaction property test** (`hidden-information.md` §4) |
| Bots | `bot.test.ts`, `bot/{knowledge,evaluate,auction,heuristics,sample,strong,levels,ramsch}.test.ts` | bot-only tables (incl. Ramsch), fairness property, evaluation/auction/card-play scenarios, Ramsch card play, sampling, legality at all levels (incl. Ramsch games), normal beats easy (`bots.md` §8) |
| Net | `protocol`, `keys`, `signalingConfig`, `directory`, `host`, `integration`, `resume`, `invite` `.test.ts` | schemas accept/reject, join/welcome/rejected flows, no foreign cards on the wire, actor from peer id, reconnect with token, timeout, host stop, leave sends the command and closes after the delay, bots run at once, host resume; invites (single use, rejected when used or connected, old token stops working, kept in the snapshot), replacement over the wire (`kicked`, cards of the newcomer only) |
| Log | `log` (`appendLog`, every event kind from a scripted game, limits), `host.log` (join, disconnect, reconnect, leave entries), `schemaLog` (every kind parses, limit 100); `logText`, `GameLogDialog` (`.test.tsx`) | the log holds no card ids; a rejected command logs nothing; a second tab adds no entry; snapshots without a log load with an empty one |
| UI | `Hand`, `CardChip`, `TrickArea`, `BiddingPanel`, `DeclarationPicker`, `ResultDialog`, `AbortGameButton`, `useShownTrick`, `useBidBubbles`, `trickPositions` (`game/`), `Home`, `TableLobby`, `PlayersDialog` (`.test.tsx`); `labels`, `i18n`, `router` (invite parameter), `preload`, `stats`, `session` (incl. leave), `persist`, `hosted` (invites kept, old snapshots load), `records`, `bidBubbles`, `declarerSummary` (`.test.ts`) | only legal cards enabled (illegal ones `disabled` + `aria-disabled`), single "Bid N" button, picker emits a legal declaration, trick hold timing, bid bubble text and timing, key and invite validation, bot strength select, replace chooser sends `replace-player`, invite code and link shown, settings migration, snapshot migration |

## 5. Which tests to add for a change

| Change | Add / update |
|---|---|
| Rule or scoring | table-driven engine test with the example from `skat-rules.md`; fuzz must stay green |
| New engine action or phase | reducer flow test, error test, immutability test, `getLegal` test |
| Table command | `table.test.ts`: success, each error code, state unchanged on error |
| View field | `view.test.ts` per viewer type; extend the redaction oracle if it holds cards |
| Protocol | `protocol.test.ts`: valid sample parses, malformed samples are rejected |
| Host/client behavior | `host.test.ts` with `createRig` + `joinClient` + `settle` |
| Bot behavior | scenario test with a hand-built `BotView`; legality via `levels.test.ts` |
| UI component | jsdom test: enabled/disabled state from props, the command sent on click |
| Hook with timers | fake timers, `act()`, `renderHook` (see `useShownTrick.test.tsx`) |
| Stored data | load/save round trip, invalid data falls back, migration of old shapes |
| Layout / multi-browser flow | e2e (`dev/e2e.md`) |

## 6. Required property tests (never delete or weaken)

1. `game.fuzz.test.ts`: engine invariants over 2000 random games.
2. `view.redaction.test.ts`: no hidden card in any view.
3. `bot/knowledge.test.ts`: bots do not use cards they cannot see.
4. `bot/levels.test.ts`: bots never need the illegal-action fallback.
