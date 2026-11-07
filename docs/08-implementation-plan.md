# 08 — Implementation Plan

Execute **in order**. Tick `[x]` when done. Do not start a phase before the previous phase's
**Acceptance** passes. After every phase run `npm run check` (typecheck + lint + test) and report
briefly. Keep files < 300 lines; tests next to the code.

Reference docs per phase are in *italics*. Rules/numbers always from `03-skat-rules.md`.

---

## Phase 0 — Scaffolding  (*01-tech-stack.md*)

- [x] `node -v` is ≥ 22.12 (if Node is missing: stop and tell the user).
- [x] `npm init`, install the dependencies from `01-tech-stack.md` (exact ranges listed there).
- [x] Create `package.json` scripts, `tsconfig.json` (+ no-DOM config for `src/engine`/`src/table`),
      `vite.config.ts`, `eslint.config.js` (with layering and purity rules), `.gitignore`,
      `.env.example`, `index.html`.
- [x] `src/main.tsx` + `src/App.tsx` rendering "WebSkat" (placeholder).
- [x] Add a trivial test `src/engine/smoke.test.ts` so Vitest has something to run.
- [x] Verify the lint rules work: temporarily `import React` inside `src/engine/x.ts` and confirm
      ESLint fails; remove it.
- [x] Create `docs/12-open-questions.md` entries are already seeded; keep appending.

**Acceptance**: `npm run check` green; `npm run dev` serves the placeholder; `npm run build` works.

---

## Phase 1 — Engine core  (*04 Part A*, *03 §1,3,6,7,10.1*)

- [x] `types.ts` exactly as in 04 A1 (+ `assertNever`, `ok()/err()` helpers for `Result`).
- [x] `cards.ts`: `ALL_CARDS` (32 unique), `suitOf/rankOf/cardPoints/sumPoints/isCardId`, `sortHand`.
- [x] `rng.ts`: `mulberry32`, `shuffle`; test determinism (same seed → same order) and that
      the result is a permutation.
- [x] `deck.ts`: `deal(seed)`; test: 10/10/10/2, all 32 unique, deterministic, deal order by index.
- [x] `trump.ts`: `modeOf/isTrump/effectiveSuit/cardStrength/trickWinner/legalCards`.
      Tests: **every row** of the tables in 03 §6.4 and §6.5; plus Null ordering, jacks in Grand.
- [x] `spitzen.ts`: tests for the examples in 03 §7 (mit 2, ohne 2, mit 6, ohne 3, mit 11, grand max 4).
- [x] `values.ts`: `BID_VALUES` (test first 20 values + length + sorted + unique), `baseValue`,
      `nullValue`, `gameMultiplier`, `declarationFloorValue`.
- [x] `index.ts` re-exports the public API.

**Acceptance**: `npm run check` green; all table-driven tests above exist and pass.

---

## Phase 2 — Engine game flow  (*04 A2*, *03 §4,5,8,10,11*)

- [x] `declaration.ts`: `validateDeclaration` (all invalid combos rejected), `declarationOptions`
      (exactly 7 / 22 entries, all valid, all unique).
- [x] `bidding.ts`: state machine per transition table. Tests: every example row in 03 §4.2,
      wrong-turn rejection, bids must increase, `hold` without bid rejected, claim stage.
- [x] `scoring.ts`: `computeScore` + `scoreGame`; **all 20 vectors** from 03 §10.7 as a
      table-driven test (`it.each`). Test overbid rounding and Null overbid.
- [x] `play.ts`: `playCard`, trick resolution, Null early end, 10-trick end.
- [x] `game.ts`: `newGame`, `applyAction`, `getLegal`, `enumerateActions`, `isFinished`.
      Test: `newGame` starts with `turn = 'middlehand'`; passed-in flow; hand game flow; pickup +
      discard flow (declarer holds 12 then 10); ouvert flow; illegal card rejected and state
      unchanged (use `toBe` identity on the returned state in error cases is not needed, but
      verify deep equality with the old state).
- [x] Fuzz test `game.fuzz.test.ts`: 2000 seeds, random legal actions via `enumerateActions`;
      invariants listed in 04 A3. Use `fast-check` or a plain seeded loop.
- [x] Purity check: grep test or ESLint ensures no `Math.random`/`Date` in `src/engine`.

**Acceptance**: `npm run check` green; fuzz test passes; a scripted full game (hand-written
sequence) is part of the tests as living documentation.

---

## Phase 3 — Table layer  (*04 Part B*, *07*, *02 §3*)

- [x] `types.ts` (Part B), `rotation.ts` (`rolesForDealer`, `pickFirstDealer`) with tests for N=3..6
      (who sits out, forehand/middle/hind per dealer).
- [x] `table.ts`: `createTable`, `addPlayer`, `setConnected`, `uniqueName`, `applyCommand` with all
      commands of 04 B2; `removePlayer` index maths with tests (kick before/at/after dealer pointer).
- [x] `records.ts`: `makeRecord` incl. Seeger bonus by `seatsAtDeal`; tests with 03 §10.7 vectors and
      a 4-player table (+30 to the sitting-out player).
- [x] `stats.ts`: `computeStats` + tests from 07 §5.
- [x] `view.ts`: `viewFor` with allow-list redaction (04 B4) + `spitzen` for declarer.
- [x] **Redaction property test** (09 §3): for random games × every viewer × after every action.
- [x] `bot.ts`: `botAction`, `runBots`; test: bot-only tables of 3, 4, 5, 6 players play 50 games
      each → records consistent, no exceptions, dealer rotation correct, scores sum rules
      (standard: sum of deltas per game = declarerScore).
- [x] Table-level tests: `ready` flow, abort, pending players seated after game, host cannot be
      kicked, `start` requires ≥ 3.

**Acceptance**: `npm run check` green. A Node script/test can play whole 4-player tables using only
`src/table` (no UI, no network).

---

## Phase 4 — Networking  (*05*, *02 §3–4*)

- [x] `constants.ts`, `keys.ts` (+ tests: format/normalize/validate, alphabet, length).
- [x] `protocol.ts`: zod schemas typed against the TS types; tests: valid samples parse, malformed
      (unknown card id, extra type, missing fields, oversize name) rejected.
- [x] `transport.ts` interface + `fake.ts` in-memory network (synchronous or microtask delivery,
      supports multiple rooms, targets, join/leave events).
- [x] `host.ts` + `client.ts` + `connection.ts` against the fake network. Tests:
      3 clients + host play a scripted game to the end through `GameConnection`s; clients never
      receive a `view` containing foreign cards; unknown peer commands ignored; reconnect with
      token reclaims the seat; table full → `rejected`; version mismatch → `rejected`;
      host `stop` → clients `closed`; join timeout → `rejected TIMEOUT` (use fake timers).
- [x] `directory.ts` + test with fake network (ads appear, expire after TTL, stop leaves room).
- [x] `createTrysteroTransport` for `nostr` and `ws-relay` (dynamic imports). Read the `.d.ts` files
      in `node_modules` first. This part is not unit-tested (manual in Phase 10).
- [x] `scripts/relay.mjs` and `npm run relay`.

**Acceptance**: `npm run check` green. Two terminal-free checks: `npm run relay` starts; the fake
network integration test passes.

---

## Phase 5 — Assets and base components  (*10-assets.md*, *06 §2,5*)

- [x] `scripts/make-assets.mjs` using `sharp`: 32 card WebP files and 4 backs (see `10-assets.md`);
      idempotent; `npm run assets`; `predev`/`prebuild` run it if `public/cards` is missing.
- [x] `ui/styles/tokens.css`, `global.css`.
- [x] `Card`, `Hand`, `OpponentSeat`, `TrickArea`, `SkatPile` components (pure presentational) with
      a dev-only **Gallery** page (`#/dev/gallery`, only when `import.meta.env.DEV`) showing: all 32
      cards, 4 backs, a hand with some disabled cards, a trick with 3 cards.
- [x] Component tests for `Hand` (only legal cards enabled).

**Acceptance**: gallery looks right on a 360 px wide viewport and on desktop; `npm run check` green.

---

## Phase 6 — UI shell: Home, Lobby, session  (*06 §1,6,7*, *05 §5–7*)

- [x] i18n (`en.ts`, `de.ts`, `t()`), settings store + persistence (zod-validated).
- [x] Session store (zustand) wiring `GameConnection` events → `view`, `records`, `status`, `toast`.
- [x] Home: name, create table (host with `createHost` + `createTrysteroTransport`), join by key,
      public list (`createDirectory`), validation and error messages.
- [x] Hash router (`#/t/KEY` auto-join, deep link), TopBar, Toast, Leave (with confirm when in game).
- [x] TableLobby: key copy/link copy, seat list, Start, Add bot, Kick, status.
- [x] **Offline dev mode**: `#/dev/local` creates a host + 2 bots using the **fake network**, so the
      whole UI can be developed without any WebRTC. (DEV builds only.)

**Acceptance**: with `npm run dev` + `npm run relay` and `VITE_SIGNALING=ws-relay`, two browser tabs
can create/join a table by key and see each other in the lobby; Start works with an added bot.

---

## Phase 7 — UI: playing a game  (*06 §1–4*)

- [x] `GameScreen` layout with `OpponentSeat`s, `SittingOutBar`, `TrickArea`, `SkatPile`, status line.
- [x] `BiddingPanel` (caller/listener/claim, bid history), `SkatDecision`, `DiscardPanel`,
      `DeclarationPicker` (+ floor value hint), playing phase with `Hand` driven by `legal`.
- [x] Trick display timing (06 §4), last-trick popover, turn indicators, "waiting for X" banner.
- [x] `ResultDialog` with breakdown and Continue/ready state (no stats yet beyond the delta table).
- [x] Touch two-tap play; keyboard support; `aria-live` announcements.
- [x] Component tests: `BiddingPanel`, `DeclarationPicker`.

**Acceptance**: in `#/dev/local` (you + 2 bots) a full game can be played through all phases, for
each game type at least once (use a debug query `?seed=123` in DEV to reproduce a deal), including
passed-in and Hand/Ouvert; no illegal card is ever clickable.

---

## Phase 8 — Statistics UI, Geberskat polish  (*07*, *06*)

- [x] `StatsPanel` with tabs Standings / History / Charts, scoring toggle, `ScoreChart` (SVG).
- [x] `gameLabel(record, t)` helper (used by the history; the result dialog uses `declarationLabel` on the live view, see I78).
- [x] Records flow: host broadcasts `record`; clients append; stats recompute via `computeStats`.
- [x] Geberskat UX: sitting-out view, dealer marker, role chips (Vorhand etc.), lobby text; 4–6 player
      dev-local mode with bots (`#/dev/local?players=5`).
- [x] Settings dialog (language, card back, confirm mode, scoring, adjustable bot-play delay).

**Acceptance**: after several games with 4–5 participants the stats show correct totals (compare
with a manual calculation of at least 3 games), the chart renders, history rows match results.

---

## Phase 9 — Persistence, reconnect, resume, polish  (*05 §9–10*, *07 §4*)

- [x] Client session persistence + auto-rejoin on load; Home "Rejoin table".
- [x] Client record cache in `localStorage` (cap 500).
- [x] Host snapshot persistence + "Resume hosted table" (all humans start `connected:false`).
- [x] Host-lost banner and automatic re-join when the host returns.
- [x] Tab title "● your turn", favicon (supplied Skatastischer Hirsch logo SVG), PWA-less meta tags, `prefers-reduced-motion`.
- [ ] Optional: lifetime personal stats on Home. *Skipped for now, see `12` I79.*
- [x] Error toasts for every `error.<CODE>`.

**Acceptance**: reload a client tab mid-game → seat reclaimed and hand visible again; reload the host
tab → resume → clients reconnect and the game continues at the same state.

---

## Phase 10 — End-to-end tests  (*09 §5*)

- [x] `playwright.config.ts` starting `npm run relay` and `vite` with
      `VITE_SIGNALING=ws-relay VITE_RELAY_URL=ws://localhost:8787` (build env in `webServer`).
- [x] Chromium launch args: `--disable-features=WebRtcHideLocalIpsWithMdns`.
- [x] Test A: three browser contexts: host creates a table, two join by key, start, play one full
      game by repeatedly clicking the first enabled option for the active player, assert result
      dialog and stats row appear in all three.
- [x] Test B: public table appears in the list of a 4th context; join; Geberskat: 4 players, dealer
      sits out; next game another player sits out.
- [x] Test C: client reload mid-game rejoins.
- [x] `npm run e2e` documented in the README.

**Acceptance**: `npm run e2e` green locally (requires `npx playwright install chromium`).

---

## Phase 11 — Deployment and docs  (*11-deployment.md*)

- [x] `npm run build` output verified with `npm run preview` on a phone-sized viewport (home and About at 360 px; the game screen was checked in Phase 7 and by the e2e tests).
- [x] GitHub Pages branch publishing via `npm run publish:pages`; GitHub Actions validates the source branch.
- [x] `README.md`: what it is, how to play, how to run, trust model, relay + TURN options.
- [ ] Final pass: a11y check, bundle size < 300 kB gzipped JS (excluding images), Lighthouse sanity. *Bundle: 129 kB gzipped main chunk (checked). The a11y audit and Lighthouse were not run (no audit tooling installed, network blocked); see `12` I94.*

**Acceptance**: a deployed URL (or `preview`) works over HTTPS with two real devices.

---

## Phase 12 — Playtest fixes: strict bidding, trick display, mobile layout  (*13-playtest-fixes.md*, *03 §4*, *06 §1,4,5,7*)

Detailed instructions, file names and test cases: `13-playtest-fixes.md`. Do F1 → F2 → F3; run
`npm run check` after each.

**F1 — strictly ascending bids (18, 20, 22, …)**
- [x] `nextBidValue` in `bidding.ts` (+ export); `applyBid` accepts only the next value; `legalBidValues` returns `[next]` or `[]`.
- [x] Engine tests for the new rule (next value only, jump rejected, `nextBidValue` incl. 264 → null); tests that jumped were fixed (`game.legal.test.ts`, `view.test.ts`; the scripted Null test spells out 18…23 instead of a `bidUpTo` helper).
- [x] Bot: remove `LOWEST_BIDS`; bots only bid `nextBidValue` (asserted in `src/table/bot/levels.test.ts`, Phase 13).
- [x] `BiddingPanel`: single "Bid N" button (`bid-submit`), no `<select>`; i18n `bid.bidValue`; component test; e2e helpers no longer use `bid-value`.

**F2 — finished trick stays for the configured time**
- [x] Rename the setting `botDelayMs` → `trickDisplayMs` (Off/0.3/0.6/1/2 s, default 0.6 s) with migration of stored values; label "Show finished trick" (`setting-trick-display`); tests.
- [x] `useShownTrick(game, displayMs)` returns `{ plays, holding, winnerId, dismiss }`; holds next-trick cards back; tests with fake timers.
- [x] `GameScreen`: `Hand paused` while holding, clear pending tap, status "{name} takes the trick", `TrickArea onDismiss` (`trick-dismiss`), `ResultDialog` only after the hold.
- [x] Remove bot pacing: `host.ts` runs bots synchronously without delay; drop the `botDelayMs` host option; `host.test.ts` checks that all bot turns run at once until a human must act.

**F3 — layout fits phones (portrait + landscape) and stays moderate on desktop**
- [x] Tokens: `--card-w` from width and height (cap 100 px); hover only on `(hover: hover)`.
- [x] `Hand`: `--hand-n` + CSS clamp overlap (10 and 12 cards fit).
- [x] `TableScreen` fixed `100dvh` during a game; `GameScreen` grid areas: portrait, compact landscape (opponents left/right, phase panel over table), large screens (max-width 1040 px).
- [x] Compact `TopBar` (icon buttons), `OpponentSeat` (max 4 backs + count, ouvert cards wrap), `BiddingPanel`, `DeclarationPicker`, last-trick bubble; dialogs `max-height: calc(100dvh - 16px)`.
- [x] Test ids `opponent-seat`, `trick-area`, `phase-panel`; `e2e/layout.spec.ts` for the 7 target viewports (no scroll, everything in view, card width limits, screenshots).
- [ ] Manual visual pass in `#/dev/local` and `#/dev/gallery` for all phases at all target viewports. *Done from the `layout.spec.ts` screenshots for bidding, skat decision, discarding (12 cards), declaring and playing at all 7 viewports. Not yet looked at: result dialog, ouvert opponent, 4-player sitting-out bar, gallery.*

**F4 — small card symbols instead of written-out card names**
- [x] i18n `rankShort.*`; `cardShort` in `labels.ts` + test.
- [x] `CardChip`/`CardChips` component (white chip, coloured suit, short rank, full name as `aria-label`/`title`) + test; gallery row.
- [x] Use the chips in the last-trick bubble (`last-trick`, winner marked) and in `ResultDialog` (Skat, discarded); no other visible `cardName()` text left.

**Acceptance**: `npm run check` and `npm run e2e` green. In `#/dev/local`: bots open with 18 and
nobody can jump a bid. With "Show finished trick" at 2 s, every finished trick (also the last one,
and also when a bot leads next) stays visible for 2 s; bots act without pauses. On 360×640, 390×844, 844×390 and 640×360 the whole table is
visible without scrolling and the cards are easy to read and tap. On 1920×1080 the cards are no
wider than 100 px. "Last trick" and the result dialog show cards as small symbols ("♥10"),
with the full names still available to screen readers.

---

## Phase 13 — Bots with selectable strength  (*14-bots.md*, *04 B3*, *02 Hidden information*)

Detailed algorithms, constants and tests: `14-bots.md`. All bot code is pure (`src/table/bot/`).

- [x] `BotLevel` type, `TableState.botLevel` (default `normal`), `createTable` argument, view field + zod, `PROTOCOL_VERSION = 2`, old host snapshots load as `normal`.
- [x] `bot/knowledge.ts`: `BotView`, `botViewOf`, void detection; fairness property test (14 §2).
- [x] `bot/index.ts` dispatcher with legality check; `bot/easy.ts` = the current random bot; `bot.ts` uses `s.botLevel`.
- [x] `bot/cardsLeft.ts`, `bot/evaluate.ts`, `bot/auction.ts` (bid/hold/pass/claim up to `maxBid`, Skat decision, discard, declare) + tests.
- [x] `bot/heuristics.ts` (normal card play for declarer/defenders, suit/grand/null) + scenario tests.
- [x] `bot/sample.ts`, `bot/simulate.ts`, `bot/strong.ts` (PIMC card play, Skat-sampling auction) + tests, perf budget.
- [x] `levels.test.ts`: legality at all levels + strength (normal beats easy; strong vs normal behind `BOT_BENCH=1`); measured results in `12` I101.
- [x] UI: create-form bot strength select (`create-bot-level`, remembered as `lastBotLevel`), lobby shows the level, i18n, `Home.test.tsx`; `#/dev/local?bots=…` (e2e scenarios have no bots, unchanged). *Replaced in Phase 14 by a per-bot strength in the lobby.*

**Acceptance**: `npm run check` and `npm run e2e` green. Creating a table offers Easy/Normal/Strong.
In `#/dev/local?bots=normal` the bots pass with weak hands, bid up to sensible values with strong
ones, never discard Jacks in suit/Grand games, and as defenders give points to a partner who is
winning the trick. `strong` decisions feel instant (< 100 ms each). The fairness test proves no bot
uses hidden cards.

---

## Phase 14 — Lobby: per-bot strength, no table size  (*14-bots.md §7*, *06 §1*, *04 B1–B3*)

User change after Phase 13: the strength is not chosen when creating a table, and neither is the
number of seats.

- [x] `Player.botLevel` (bots only, new bots `normal`); `TableState.botLevel` removed; `createTable` `maxSeats` optional (default 6).
- [x] Command `set-bot-level` (host, any time; `UNKNOWN_PLAYER` / `NOT_A_BOT`); zod schema; `PlayerPublic.botLevel`; `PROTOCOL_VERSION = 3`.
- [x] `botStep` uses the acting bot's level; old host snapshots: table level copied to each bot.
- [x] Create form: only table name and public flag; settings `lastBotLevel` removed.
- [x] Lobby: strength select per bot for the host (`bot-level-<seat>`), level text for others; Start with ≥ 3 players or bots; info text updated (en/de).
- [x] `#/dev/local?bots=…` sets each bot via `set-bot-level`; e2e helper `createTable` no longer picks seats.
- [x] Tests: table (`set-bot-level`, default level, 6 seats + start with bots), view, bot (own level), snapshots, `TableLobby.test.tsx`, `Home.test.tsx`.

**Acceptance**: `npm run check` and `npm run e2e` green. Creating a table asks only for a name and
the public flag; the host can add bots, set each bot's strength and start once 3 players or bots
are seated.

---

## Definition of done (whole project)

All phases ticked; `npm run check` and `npm run e2e` green; a full 3-player game and a 4-player
Geberskat series run over real WebRTC with Nostr signaling; no `any`, no `@ts-ignore`, no engine
purity violations; stats match hand calculations.
