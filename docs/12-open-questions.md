# 12 — Open Questions and Decisions

Planning-time decisions where the sources were ambiguous or silent. **Append new entries when you
decide something while implementing** (date, decision, reason). Format: `ID — Decision — Why`.

## Decided during planning

| ID | Topic | Decision | Why / alternative |
|---|---|---|---|
| D1 | Spitzen counting | Official ISkO: count jacks **and** following trump-suit cards (max 11 suit, 4 grand). Not the "jacks only" variant | Official rule; variant listed on Wikipedia as regional |
| D2 | Grand base value | 24 | Current ISkO (was 20 until 1932) |
| D3 | Overbid scoring (suit/grand) | Lost; value = next multiple of base ≥ bid, doubled | ISkO overbid rule; verified only via Wikipedia worked example (bid 36 / base 12), not the PDF |
| D4 | Overbid scoring (Null) | Lost; score `−2 × value of the declared Null` (no rounding) | Not clearly documented in sources; simplest. Revisit if the ISkO PDF says otherwise |
| D5 | Default scoring display | Extended Seeger–Fabian (tournament), with toggle to classic ("standard"); both stored per game | Both are cheap to store; Seeger is the official tournament system |
| D6 | Seeger bonus for N ≥ 5 | 24 (N=5, from DSkV list per Wikipedia), 20 (N=6, our own extension) — paid to *every* non-declarer seated player when the declarer loses | Sources only specify N=3 (40) and N=4 (30) |
| D7 | Geberskat seating for 5–6 | Active = the 3 players after the dealer; everyone else (incl. dealer) sits out; pointer advances one seat per game | User spec: "others skip, next game the next player skips". Official 5-player seating differs slightly |
| D8 | Ramsch / Kontra / Bock | Not implemented | Not part of ISkO; user asked for official game types |
| D9 | Passed-in game | No points, no replay, next dealer; stored as a record with `outcome: 'passed-in'` | ISkO |
| D10 | Forehand with no bids | Claim stage: forehand may take the game at 18 or pass (→ passed in) | ISkO: forehand may play if both others pass |
| D11 | Cutting the deck | Skipped (shuffle is by the host's CSPRNG-seeded PRNG) | No physical deck |
| D12 | Null early termination | Game ends when the declarer wins a trick | ISkO |
| D13 | Suit/grand early termination | Not implemented; all 10 tricks are always played | Simplicity |
| D14 | Declaration vs bid | Not blocked; UI warns if floor value < bid | ISkO lets the declarer overbid, he just loses |
| D15 | Host authority & trust | Host sees all cards; no mental poker | Casual game among friends |
| D16 | Table list without server | Hosts of public tables advertise in a shared Trystero "lobby" room | No server needed |
| D17 | Late joiners | Seated only between games (`pending` list) | Keeps rotation fair and engine simple |
| D18 | Spectators | None in v1 (pending players only see lobby-ish info) | Scope |
| D19 | TypeScript version | `~6.0.3`, not 7.x | typescript-eslint 8.72 peer range `<6.1.0` |
| D20 | Action names for Trystero | `cmd`, `msg`, `ad` (≤ 12 bytes) | Older Trystero versions enforce 12-byte limit |
| D21 | First dealer | `seed % N` chosen by the host at `start` | Fair, deterministic for tests |
| D22 | Timers / turn clock | None | Friends at a table; disconnected players are waited for |
| D23 | Language | EN + DE dictionaries, default by browser | Game terms are German |

## Open (answer when relevant; default shown)

| ID | Question | Default until answered |
|---|---|---|
| Q1 | Should `Null` overbid use the bid-based rounding like suit games? | No (D4) |
| Q2 | Should spectators be supported? | No |
| Q3 | Host migration if the host leaves? | No; host snapshot resume only (Phase 9) |
| Q4 | Optional turn timer / auto-play for AFK players? | No |
| Q5 | Sound effects? | None |
| Q6 | Strong AI opponents? | No, random bots only |

## Decided during implementation

| ID | Topic | Decision | Why / alternative |
|---|---|---|---|
| I1 | TypeScript project layout (Phase 0) | `tsconfig.base.json` (shared strict options); `tsconfig.core.json` for `src/engine` + `src/table` with `lib: ["ES2022"]`, `types: []` (no DOM); `tsconfig.app.json` for `src` (DOM, `vite/client`); `tsconfig.node.json` for `vite.config.ts`; root `tsconfig.json` references all three; `npm run typecheck` = `tsc -b` | Makes accidental `window`/`console` use in the pure layers a compile error (verified). Same pattern as the Vite React template |
| I2 | Type-aware ESLint (Phase 0) | `tseslint.configs.strictTypeChecked` for `**/*.{ts,tsx}` with `parserOptions.project` = the three tsconfigs; `*.js/*.mjs` use `disableTypeChecked`; `eslint-plugin-react-hooks` flat recommended for `src/**` | Type info is needed for the strict rules; JS config files are not part of a TS project |
| I3 | Extra dev dependencies (Phase 0) | Added `eslint-plugin-react-hooks@^7.1.1`, `jsdom@^31`, `@testing-library/react@^16`, `@testing-library/dom@^10` (peer of RTL), `@testing-library/user-event@^14`, `fast-check@^4`, `@types/react@^19`, `@types/react-dom@^19`, `@types/node@^22` | Listed in 01 as "latest compatible" / "matching". `@types/node` pinned to 22 to match the minimum runtime (Node 22.12), not the latest (26) |
| I4 | Purity lint rules (Phase 0) | `src/engine` and `src/table`: no `react`/`zustand`/`trystero`, no `window`/`document`/storage/`fetch`/`crypto`/timers, no `Date` (any use), no `Math.random`, no `console`. `src/engine` additionally forbids `zod` and importing `table`/`net`/`ui`; `src/table` forbids `net`/`ui`; `src/net` forbids `ui` | Literal reading of 01 ("zod (engine only)"). `table` may therefore use `zod` if it needs to; revisit if that is undesired |
| I5 | Vitest scope (Phase 0) | `vite.config.ts` test block: `environment: 'node'`, excludes `e2e/**` (Playwright) | Keeps Vitest and Playwright apart; jsdom only for component tests |
| I6 | Node runtime (Phase 0) | Node v26.13.0 (via nvm) is used locally; `engines.node` is `>=22.12` | Requirement is the minimum; the project is tested only on the installed version so far |
| I7 | Typing of value helpers (Phase 1) | `gameMultiplier` takes `TrumpDeclaration` (suit or grand) instead of `Declaration`, so Null cannot reach the multiplier by type. `declarationFloorValue(d, spitzen)` treats a missing spitzen count as 0 for suit/grand | Makes the Null/suit split a compile-time fact; the doc signature is otherwise kept |
| I8 | Empty trick (Phase 1) | `trickWinner` on an empty trick returns the leader; `legalCards` on an empty trick returns the whole hand | Avoids throwing (engine never throws for input); callers only ask with at least one card played for a winner |
| I9 | Bid value count (Phase 1) | `BID_VALUES` has 63 entries, from 18 to 264 (union of the four base series, the Grand series and 23/35/46/59); asserted in `values.test.ts` | Derived from the formula in 03 §4.1; the doc gives no count |
| I10 | Hand order and display (Phase 1) | `sortHand(cards, null)` sorts like Grand (Jacks first); the deal returns readonly arrays | Pre-declaration hands are shown in the Grand/suit style; readonly matches `GameState` |
| I11 | Test helpers (Phase 1) | `src/engine/testing.ts` exports `hand('CJ SJ HA')` for tests only (not in `index.ts`); the Phase 0 `smoke.test.ts` was removed once real tests existed | Keeps test data readable without exporting test code |
| I12 | Action checks order (Phase 2) | In `applyAction`, the phase is checked first (`WRONG_PHASE`), then the role (`NOT_YOUR_TURN`). Wrong action for a phase is `WRONG_PHASE` even when the role is also wrong | One clear error per call; matches the dispatch table in 04 A2 |
| I13 | Bidding details (Phase 2) | A `bid` from the caller when the listener is expected, and a `hold` when no bid is standing, are rejected. The claim stage rejects `bid` (`ILLEGAL_BID`) and `hold` (`CANNOT_HOLD`). In stage `done` `bidding.caller` is the declarer (as the type comment says) | Gives each invalid case a specific code; the 04 A2 table leaves these error codes open |
| I14 | Scoring API (Phase 2) | `computeScore(input)` returns `ScoreComputation` (base, multiplier, gameValue, flags, loseValue, declarerScore). `scoreGame` returns `{ kind: 'passed-in' }` for a state with no declarer, bid or declaration instead of throwing | Engine never throws for input (02 §6). The `Omit<…>` signature in 04 was simplified as allowed there |
| I15 | Null with an overbid (Phase 2) | `loseValue` is the Null value (not rounded), so an overbid Null scores `-2 × gameValue` (D4) | Implements D4 as decided |
| I16 | Fuzz invariants (Phase 2) | Fuzz test (2000 seeds) checks: every enumerated action is accepted; rejected actions (out-of-turn, illegal card) leave the state unchanged; card conservation after every action; trick leader chain; Null ends at the declarer's first trick; suit/grand point total 120; scores match `won`/`loseValue`. It runs in about 9 s | Covers the invariants in 09 §2 items 1–5 |
| I17 | Test layout (Phase 2) | Shared fixtures (`apply`, `run`, `afterBidding`, `playingState`, `snapshot`, …) live in `src/engine/testing.ts`. `game.test.ts` is split into `game.test.ts`, `game.legal.test.ts` and `game.scripted.test.ts` to stay under 300 lines | Keeps the file-size rule from AGENTS.md |
| I18 | Purity check (Phase 2) | The purity rule is enforced by ESLint (`no-restricted-globals`, `no-restricted-properties` for `Math.random`, `Date` ban) rather than a grep test | ESLint already fails on violations; a second mechanism would duplicate it |
| I19 | Spitzen in the view (Phase 3) | `view.declarerSpitzen` gives the declarer's Spitzen for the grand and for each of the four suits while declaring, instead of one `spitzen` value. Spitzen depends on the trump, so one count cannot drive `declarationFloorValue` for every option (04 B4 gave a single count) | Needed for the per-option floor hint in the UI. Shown only to the declarer and only during `declaring` |
| I20 | Skat visibility (Phase 3) | `skat` is shown to the declarer while discarding/declaring after a pick-up, and to everybody once a played game is finished. `discarded` is shown only when finished. Passed-in games show neither | Matches 02 §3 |
| I21 | Ouvert hand after an early Null end (Phase 3) | An ouvert declarer's remaining cards stay visible in the finished view, because the rule keeps ouvert cards face-up for the whole game | 02 §3 allows the declarer's hand when ouvert; the redaction test oracle follows this |
| I22 | Table error codes (Phase 3) | Added `INVALID_NAME`, `CANNOT_KICK_HOST`, `HOST_CANNOT_LEAVE` to `TableErrorCode`. Kick and add-bot during a running game return `GAME_RUNNING`; ready or continue without a finished game returns `WRONG_STATUS`; ready from a pending player returns `NOT_SEATED`; a game action by a sitting-out player returns `NOT_ACTIVE_PLAYER` | Explicit codes for the UI toasts (06, 09) |
| I23 | Host leaving (Phase 3) | The host cannot leave (`HOST_CANNOT_LEAVE`). Closing a table is not part of the table layer | Host migration is out of scope (Q3). The net layer decides what a host disconnect means |
| I24 | Leave and disconnect (Phase 3) | A seated player who leaves during a running game is only marked disconnected, so the same id can rejoin with `addPlayer`. In the lobby or after a finished game they are removed; if fewer than three remain, the table goes back to the lobby and pending players are seated | Lets the reconnect flow of 05 §9 reuse the same seat |
| I25 | Ready and auto-deal (Phase 3) | Bots are always ready. The next game is dealt when every connected human is ready. This is also checked right after a game finishes, so a bot-only table keeps playing by itself | Disconnected humans do not block (09 §3) |
| I26 | Joining (Phase 3) | Joining seats immediately only while no game is dealt. During a game, and after a finished game until the next deal, the player waits in `pending`. Joining with an id already at the table reconnects that player | Matches 04 B2 |
| I27 | Abort (Phase 3) | `abort-game` discards the running game and deals the next one with the dealer pointer as it already stands (it advanced when the aborted game was dealt) | Reading of the 04 B2 wording. The aborted game counts in `gameCounter` but creates no record |
| I28 | Bot ids and names (Phase 3) | Bots get the id `bot-<seq>` (no randomness in the table layer) and the names `Bot`, `Bot (2)`, ... | Keeps the table reducer pure and deterministic |
| I29 | Standings order (Phase 3) | `computeStats` returns players sorted by the standard total (ties by name); the UI may re-sort by Seeger | 07 §2 allows either |
| I30 | Record names (Phase 3) | `GameRecord.names` holds the names of the players seated when the game was dealt; statistics prefer those names over the current ones | Kicked players keep their name in history (07 §2) |
| I31 | Bot API (Phase 3) | `botStep` lets one bot act and returns `null` when a human must act; `runBots` loops it with a step limit. Test-only helpers (`testing.ts`, `fixtures.ts`) are not exported from `index.ts` | Lets bot-only tables be driven one step at a time in tests |
| I32 | Pending in the view (Phase 3) | `PlayerPublic.seat` is `null` for pending players (the spec's `number` cannot express "not seated") | Type deviation, documented in `viewTypes.ts` |

