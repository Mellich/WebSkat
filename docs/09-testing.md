# 09 — Testing

Tools: Vitest (unit/integration, Node environment; jsdom only for component tests), fast-check
(property tests, optional — a seeded loop is acceptable), Playwright (e2e).
Test files live next to code: `foo.ts` ↔ `foo.test.ts`. e2e in `e2e/`.

Principle: **the engine and table are tested exhaustively; UI and network are tested thinly but
at their seams.** Write tests with (or before) the code, in the same commit/phase.

## 1. Conventions

- Table-driven tests with `it.each` for rules (rows copied from `03-skat-rules.md`).
- Builders in `src/engine/testing.ts` (exported only for tests; not in `index.ts`):
  `hand('CJ SJ HA …'): CardId[]`, `stateWith({ phase, hands, declaration, … })` to construct an
  arbitrary `GameState` quickly, `playAll(state, actions)`.
- No real time, no randomness: pass fixed seeds; use `vi.useFakeTimers()` for timeouts.
- Tests must not rely on the order of object keys or on `Date`.

## 2. Engine (`src/engine`)

| Area | Must cover |
|---|---|
| deck/rng | permutation, determinism, deal indices (03 §3) |
| trump | all rows of 03 §6.4 (legal cards) and §6.5 (trick winner); Jacks in suit games/Grand/Null; led trump |
| spitzen | 03 §7 examples + max values + Null returns `null` |
| values | `BID_VALUES` first 20 values, sorted, unique, max 264; base values; Null values; multiplier formula incl. announce/ouvert |
| declaration | validity matrix (every combination of hand × kind × announce × ouvert), `declarationOptions` counts (7/22) |
| bidding | 03 §4.2 example table; increasing bids; only caller bids; hold requires bid; claim stage; passed-in |
| scoring | all 20 vectors 03 §10.7; overbid rounding; Null overbid; Schneider/Schwarz thresholds at boundaries (30/31, 60/61, 89/90) |
| play | follow-suit enforcement via `applyAction`; trick winner leads next; Null early end; 10 tricks end |
| reducer | wrong phase/turn errors; immutability (input state deep-equal before/after, also on errors) |
| fuzz | 2000 seeds × random legal actions: invariants (below) |

Fuzz invariants (check after every action and at the end):
1. Multiset of cards in `hands ∪ skat(+discarded) ∪ tricks` is exactly the 32 cards (accounting
   for pick-up/discard moves).
2. For finished suit/grand games: `declarerPoints + defenderPoints === 120`.
3. `enumerateActions(state, role)` returns only actions that `applyAction` accepts; for roles not
   on turn it returns `[]`; some action always exists while `phase !== 'finished'` for the role on
   turn.
4. Rejected actions leave the state deep-equal to the old state.
5. `getLegal` agrees with `enumerateActions` (same cards/bids).

## 3. Table (`src/table`)

- Rotation: for N=3..6 and every dealer index: forehand/middlehand/hindhand and sitting-out lists
  (03 §9). Dealer pointer advances every game incl. passed-in.
- Seating: join in lobby; join during game → `pending`; seated after the game; `TABLE_FULL`.
- `removePlayer` index maths (before/at/after `nextDealerIdx`); host cannot be kicked; <3 players →
  lobby.
- `ready`: all connected humans needed; bots auto-ready; disconnected humans do not block.
- Records and stats: 03 §10.7 vectors; Seeger vectors → cumulative A=90 B=40 C=136; 4-player
  sitting-out bonus; passed-in; names persist after kick.
- **View redaction property test** (`view.redaction.test.ts`): for 300 random games driven by
  random legal actions, for **every** viewer (all seated, sitting-out, pending, and a stranger id):
  after every action compute `allowed(viewer, state)` = viewer's own hand ∪ cards in
  `trick`/`lastTrick` ∪ (ouvert declarer's hand during play) ∪ (declarer's picked-up skat while
  discarding/declaring, only for the declarer) ∪ (skat + discarded + all trick cards when finished).
  Extract all `CardId`-looking strings from `JSON.stringify(view)` with a regex
  (`/\b[CSHD](?:7|8|9|10|J|Q|K|A)\b/g`) and assert ⊆ `allowed`. Also assert the JSON contains neither
  `"seed"` nor `"initialHands"`.
- Bots: bot-only tables for N=3,4,5,6, 50 games each, fixed seeds → terminates, record count
  equals finished games, no exceptions. Run them at every bot level.
- Bot levels (Phase 13, `14-bots.md` §8): fairness property (`botViewOf` and the chosen action do not
  change when cards the bot cannot see are swapped), evaluation/auction/heuristic scenario tests,
  sampling constraints, determinism, "legal fallback never used". Strength check: `normal` beats
  `easy` (in `npm run check`); `strong` ≥ `normal` and the wall-clock perf checks (strong card
  decision < 100 ms median, full strong game < 5 s) only with `BOT_BENCH=1`.

## 4. Network (`src/net`)

All with the in-memory fake transport (`fake.ts`), no real WebRTC.

- protocol: valid and invalid samples (unknown card, bad regex, missing fields, name > 40 chars,
  extra `t`), roundtrip of real `TableView`s produced by `viewFor`.
- host+client integration: join/welcome/records/view flow; full scripted game with three clients;
  clients' received messages contain no foreign cards (reuse the regex check); commands from
  unknown peers ignored; actor derived from sender peer (a client claiming another playerId in the
  payload has no effect); reconnect with token; `TABLE_FULL`; `PROTOCOL_MISMATCH`; `closed` on
  `stop`; join `TIMEOUT` (fake timers); host-lost → status → recovered when host rejoins.
- directory: ads appear, expire after TTL (fake timers), private tables not advertised.
- keys: alphabet, length, normalization, validation, uniqueness over 1000 generated keys.

## 5. End-to-end (Playwright, Phase 10)

Setup: `webServer` entries start `npm run relay` (port 8787) and the Vite dev/preview server with
`VITE_SIGNALING=ws-relay VITE_RELAY_URL=ws://localhost:8787` so public Nostr relays are never
touched. Chromium args: `--disable-features=WebRtcHideLocalIpsWithMdns`. Use
`browser.newContext()` ×3–4 (separate storage = separate players). Give each element a stable
`data-testid` (e.g. `create-table`, `table-key`, `join-key-input`, `start-game`, `bid-pass`,
`hand-card-<ID>`, `bid-value`, `bid-submit`, `bid-hold`, `pickup`, `play-hand`, `discard-submit`,
`declare-option-<n>`, `declare-submit`, `result-dialog`, `continue`, `open-stats`).
The robot clicker therefore uses `bid-pass` / `bid-hold` / `pickup` / `play-hand` etc.; define every id
in `06-ui-ux.md` components as you build them and keep this list in sync.

A "robot clicker" helper plays a whole game: loop until the result dialog is visible in all pages:
for each page, if a bid/pass button is enabled click `bid-pass` (or hold/claim if it is the only
option), if `pickup`/`play-hand` is shown click `play-hand`/`pickup`, discard the first two cards,
declare the first suggested option, else click the first enabled `hand-card-*`.

Scenarios: A (3 players, one game, stats visible), B (public list + 4 players Geberskat rotation),
C (reload a client mid-game), D (`layout.spec.ts`: offline `#/dev/local?seed=123` at the viewports
of `13-playtest-fixes.md` F3; asserts no page scroll, all game areas inside the viewport, hand card
width ≥ 60 px on phones and ≤ 104 px everywhere; saves screenshots). Additional test ids for D:
`opponent-seat`, `trick-area`, `phase-panel`, `trick-dismiss`, `setting-trick-display`, `last-trick`, and
`create-bot-level` (Phase 13; the e2e scenarios play without bots). The
`bid-value` select no longer exists; bidding uses `bid-submit` (single "Bid N" button).

## 6. Component tests (jsdom)

`// @vitest-environment jsdom` at the top; testing-library queries by role/name. See `06-ui-ux.md` §9.
Phase 12 adds: `useShownTrick` hold tests (fake timers: full duration, next-trick cards held back,
batched update, dismiss, no hold on first render, restart on a new trick, 0 = no hold), `Hand` `paused` + `--hand-n`,
`BiddingPanel` single "Bid N" button, `CardChip` (visible `♥10`, accessible name "Ten of hearts"), settings migration `botDelayMs` → `trickDisplayMs`. Pure:
`nextBidValue`/strict bidding (engine), bot opens with 18; `host.test.ts`: bots run synchronously
without timers.

## 7. Commands and CI

`npm run check` = typecheck + lint + `vitest run`. A GitHub Actions workflow (Phase 11) runs
`npm ci && npm run check && npm run build`; e2e optionally in a separate job
(`npx playwright install --with-deps chromium`).
Coverage is not enforced, but engine/table line coverage should be > 95 % (`vitest --coverage`
needs `@vitest/coverage-v8`; optional).
