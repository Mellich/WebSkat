# Plan 08: Ramsch when everybody passes (table rule)

User request: *"Add Ramsch as play type: during Ramsch, all players play on their own and have to
make as few points as possible. Add a setting to the table: start a Ramsch round if all players
leave the bidding without a bid. Usually this would mean the cards are given again, but then a
Ramsch round should start instead!"*

Read first: `docs/skat-rules.md` (§4.2, §6, §8, §10, §11), `docs/engine.md`, `docs/table.md`,
`docs/hidden-information.md`, `docs/bots.md` §1–§5, `docs/statistics.md`,
`src/engine/AGENTS.md`, `src/table/AGENTS.md`, skill `change-protocol`. Plans 01–07 must be done.

## 1. Current state

- Ramsch is explicitly out of scope today (`decisions.md` D8, `docs/overview.md` §4). The user now
  asks for it, so the rules must first be written into `docs/skat-rules.md` (the single source of
  truth), then implemented.
- Engine: when everybody passes (claim stage, forehand passes), `applyBidding` (`src/engine/game.ts`
  ~line 123) finishes the game with `result: { kind: 'passed-in' }`. `src/engine/game.ts` has 290
  lines.
- Card play needs a `PlayMode`; today it always comes from `state.declaration`
  (`play.ts` `playCard`, `game.ts` `getLegal`). Grand mode (`{ kind: 'grand' }`) = only the four
  Jacks are trump, exactly the trump rule of Ramsch.
- The table has no per-table rules; `createTable` takes only key, name, public flag, host,
  `maxSeats`. Bots: `src/table/bot/` assume a declarer during play (`cardsLeft.ts`
  `modeOfView` throws without a declaration).
- `GameRecord.outcome` is `'passed-in' | 'played'`.

## 2. Decisions (log them in `docs/decisions.md`)

1. *Ramsch rules* (written to `skat-rules.md` §12, see Step 1): plain Ramsch. Only Jacks are
   trump (Grand order), forehand leads, all 10 tricks are played, no declarer, nobody looks at the
   Skat; the Skat's card points go to the winner of the **last trick**. The player with the most
   card points loses that many points (ties: every tied player loses). *Jungfrau*: a player took no
   trick → the loss is doubled. *Durchmarsch*: one player took all 10 tricks → that player wins
   +120. Nobody else gets points. No Schieberamsch, no Grand Hand override, no Kontra.
2. *Seeger scoring for Ramsch* = the standard Ramsch scores (no ±50, no defender bonus). Sitting-out
   players get 0.
3. *Table rules*: new `TableState.rules` (`TableRules = { ramsch: boolean }`, default off), changed
   by the host with the new command `set-rules` while no game is running (lobby or finished game);
   shown in the lobby. The engine receives `GameOptions = { ramschOnPassIn }` at deal time.
4. *Records*: `outcome: 'ramsch'` with a `ramsch` block (points, tricks, losers, flags); the
   declarer fields stay `null` like a passed-in game.
5. *Bots in Ramsch*: Normal and Strong use a Ramsch heuristic (avoid points, dump high cards on
   tricks won by others); Easy stays random. Bidding is unchanged.
6. *Protocol* version +1. *Supersedes the Ramsch part of D8.*

## 3. Steps

### Step 1: rules first (`docs/skat-rules.md`)

Do not renumber anything. Add:

- §4.2, after "→ game is **passed in**": "(If the table rule *Ramsch* is on, a Ramsch game is
  played instead, §12.)"
- §11: one line under the diagram: "With the Ramsch rule, `passed-in` becomes `playing` (Ramsch,
  §12)."
- New chapter at the end:

```markdown
## 12. Ramsch (table rule, off by default)

### 12.1 When
Only when the table rule "Ramsch" is on, and only instead of a passed-in game (§4.2: middlehand,
hindhand and forehand all pass). There is no declarer and no bid.

### 12.2 Play
- Trumps: only the four Jacks, order `CJ SJ HJ DJ` (as in Grand, §6.1–§6.2). Suits `A 10 K Q 9 8 7`.
- Following suit and trick winner as in Grand (§6.4–§6.5). Forehand leads the first trick.
- All 10 tricks are played. Nobody picks up or looks at the Skat during play.

### 12.3 Card points
Each player's card points = the cards of the tricks they won. The Skat (2 cards) counts for the
winner of the last trick (it is not a trick). The three totals add up to 120.

### 12.4 Scoring (standard and Seeger–Fabian alike)
- **Durchmarsch**: one player won all 10 tricks → that player scores **+120**, the others 0.
- Otherwise the **loser(s)** = the player(s) with the most card points. Each loser scores
  **−(own card points)**; everybody else 0. Ties for the most points: every tied player loses.
- **Jungfrau**: if a player won no trick (and there is no Durchmarsch), the losers' scores are
  doubled.
- Sitting-out players (§9) score 0.

### 12.5 Worked examples = test vectors

| # | Points F/M/H | Tricks F/M/H | Result |
|---|---|---|---|
| R1 | 50 / 40 / 30 | 4 / 3 / 3 | F −50 |
| R2 | 72 / 48 / 0 | 6 / 4 / 0 | Jungfrau: F −144 |
| R3 | 120 / 0 / 0 | 10 / 0 / 0 | Durchmarsch: F +120 |
| R4 | 45 / 45 / 30 | 4 / 3 / 3 | F −45, M −45 |
| R5 | 40 / 40 / 40 | 4 / 3 / 3 | F −40, M −40, H −40 |
| R6 | scripted | — | H wins the last trick, the Skat is `SA D7` (11 points): H's card points include these 11 |
```
(For R6 write a scripted engine test: play a Ramsch with a known seed to the end, find the role
that won the last trick, and check that its `points` equal its trick points plus
`sumPoints(state.skat)`. If the seed's Skat is not `SA D7`, write the actual cards into the row.)

### Step 2: engine: make room

- Move `Legal`, `biddingLegal`, `getLegal`, `enumerateActions` from `src/engine/game.ts` into new
  `src/engine/legal.ts`. In `game.ts` add
  `export { enumerateActions, getLegal, type Legal } from './legal';` so imports from `./game`
  keep working. Do **not** add `./legal` to `index.ts` (it is re-exported through `./game`).
  Run `npx vitest run src/engine` → green.

### Step 3: engine: Ramsch (tests first)

- `src/engine/types.ts`:
  ```ts
  export interface GameOptions { readonly ramschOnPassIn: boolean }
  export const DEFAULT_GAME_OPTIONS: GameOptions = { ramschOnPassIn: false };
  // GameState gets:
  readonly options: GameOptions;
  readonly ramsch: boolean; // true while/after a Ramsch game is played (skat-rules §12)
  // GameResult gets a third variant:
  | {
      readonly kind: 'ramsch';
      readonly points: Readonly<Record<Role, number>>;
      readonly tricks: Readonly<Record<Role, number>>;
      readonly skatTo: Role;              // winner of the last trick
      readonly losers: readonly Role[];   // empty on Durchmarsch
      readonly jungfrau: boolean;
      readonly durchmarsch: Role | null;
      readonly scores: Readonly<Record<Role, number>>; // skat-rules §12.4
    }
  ```
- New `src/engine/ramsch.ts`:
  - `playModeOf(state: GameState): PlayMode | null` → `state.declaration !== null ? modeOf(state.declaration) : state.ramsch ? { kind: 'grand' } : null`.
  - `scoreRamsch(state: GameState): GameResult` (pure numbers per §12.3–§12.4).
  - `ramschScores(points, tricks): { losers, jungfrau, durchmarsch, scores }` (numbers in, for
    the table-driven tests R1–R5).
- `src/engine/game.ts`:
  - `newGame(seed, options: GameOptions = DEFAULT_GAME_OPTIONS)`: add `options`, `ramsch: false`.
  - `applyBidding`, outcome `passed-in`: if `state.options.ramschOnPassIn` →
    `{ ...state, bidding: next, phase: 'playing', ramsch: true, trick: { leader: 'forehand', plays: [] }, turn: 'forehand' }`;
    else as today.
- `src/engine/legal.ts`, phase `playing`: use `playModeOf(state)` instead of `state.declaration`.
- `src/engine/play.ts` `playCard`: `const mode = playModeOf(state); if (state.phase !== 'playing' || mode === null) → WRONG_PHASE`;
  the Null early end checks `state.declaration?.kind === 'null'`.
- `src/engine/scoring.ts` `scoreGame`: first line `if (state.ramsch) return scoreRamsch(state);`.
- `src/engine/index.ts`: `export * from './ramsch';`.
- Find every place that switches on `GameResult.kind` and handle `'ramsch'`:
  `grep -rn "'passed-in'" src | grep -v test` (records, views, UI, bots/arena, tests).
- Tests:
  - `src/engine/ramsch.test.ts`: `it.each` over R1–R5 with `ramschScores`; the R6 scripted case;
    a flow test: `newGame(seed, { ramschOnPassIn: true })`, M pass, H pass, F pass → phase
    `playing`, `ramsch: true`, turn forehand, `getLegal(…, 'forehand').playableCards` = whole hand;
    a Jack led must be followed by a Jack (Grand rule); `newGame(seed)` + three passes →
    `passed-in` as before.
  - Mini fuzz in the same file (or `ramsch.fuzz.test.ts`): 500 seeds with `ramschOnPassIn: true`,
    random legal actions (copy the loop shape of `game.fuzz.test.ts`); for Ramsch results assert:
    points sum 120, tricks sum 10, `scores` match §12.4 (recompute with `ramschScores`), all hands
    empty. Assert that at least one Ramsch game happened.
  - `game.fuzz.test.ts` must stay green unchanged (default options).
- Run: `npx vitest run src/engine`.

### Step 4: table: rules, deal options, records, views (tests first)

- `src/table/types.ts`: `export interface TableRules { readonly ramsch: boolean }`;
  `TableState.rules: TableRules`; command
  `| { readonly type: 'set-rules'; readonly rules: TableRules }`;
  `GameRecord.outcome: 'passed-in' | 'played' | 'ramsch'` and
  ```ts
  readonly ramsch: {
    readonly points: Readonly<Record<PlayerId, number>>;
    readonly tricks: Readonly<Record<PlayerId, number>>;
    readonly loserIds: readonly PlayerId[];
    readonly jungfrau: boolean;
    readonly durchmarschId: PlayerId | null;
  } | null;   // null unless outcome === 'ramsch'
  ```
- New `src/table/rules.ts`: `DEFAULT_RULES: TableRules = { ramsch: false }`;
  `setRules(s, actor, rules): Result<TableState, TableErrorCode>` → `NOT_HOST`; running game →
  `GAME_RUNNING`; else `touch({ ...s, rules })`.
- `src/table/table.ts`: `createTable` sets `rules: DEFAULT_RULES`; `case 'set-rules'`;
  `dealNext` → `newGame(ctx.seed, { ramschOnPassIn: s.rules.ramsch })`.
- `src/table/records.ts`: `result.kind === 'ramsch'` → record with `outcome: 'ramsch'`, declarer
  fields as in `passedInRecord`, `ramsch` block (role → id via `game.roles`), and
  `scores.standard = scores.seeger = { ...zeroes(ids), [idOf(role)]: result.scores[role] … }`.
  Other outcomes: `ramsch: null`. Keep `records.ts` < 300 lines.
- `src/table/stats.ts`: `TableStats.ramsch: number` (count of Ramsch records). `playedIn` must
  stay `outcome === 'played'` for the declarer/defender statistics; a Ramsch game still counts in
  `games` and its scores in the totals (automatic through `scores`).
- `src/table/viewTypes.ts`: `GameView.ramsch: boolean`; `TableView.table.rules: TableRules`;
  `ViewResult` gets
  `| { kind: 'ramsch'; points; tricks; skatToId; loserIds; jungfrau; durchmarschId; scores }`
  (all keyed by player id).
- `src/table/viewGame.ts`: fill `ramsch: e.ramsch`; `viewResult` maps the Ramsch variant to ids;
  the finished-game reveal (`finishedPlayed`) becomes `e.phase === 'finished' && (declarer !== null || e.ramsch)`
  so the Skat is shown to everybody after a Ramsch. `src/table/view.ts`: `rules: s.rules`.
- Tests:
  - `src/table/rules.test.ts`: set-rules by host in the lobby; `NOT_HOST`; `GAME_RUNNING`;
    allowed after a finished game; `dealNext` passes the option (deal with the rule on, everybody
    passes via `applyCommand` → the game is in `playing` with `ramsch: true`).
  - `records.test.ts`: a finished Ramsch game (build the `GameResult` by hand, use
    `finishedGame` from `fixtures.ts`) → outcome, `ramsch` block, scores; a 4-player table gives
    the sitting-out player 0.
  - `stats.test.ts`: Ramsch scores add to totals; `ramsch` count.
  - `view.test.ts`: `ramsch` flag; Skat visible to everybody when a Ramsch is finished, not before.
  - `view.redaction.test.ts`: oracle `allowedCards`: the finished reveal also when `e.ramsch`;
    turn the rule on for every second random game (`applyCommand(…, { type: 'set-rules', rules: { ramsch: g % 2 === 0 } })`
    before `start`).
- Run: `npx vitest run src/table`.

### Step 5: bots

- `src/table/bot/knowledge.ts`: `PlayView.ramsch: boolean` (and thus `BotView`); `botViewOf`
  sets `ramsch: game.ramsch`; `voidsOf(tricks, mode: PlayMode | null)` — call it with
  `playModeOf(game)`. Fix every other `PlayView` literal (`simulate.ts`, tests): `ramsch: false`.
- `src/table/bot/cardsLeft.ts` `modeOfView`: `if (view.ramsch) return { kind: 'grand' };` before
  the declaration check.
- New `src/table/bot/ramsch.ts` `ramschCard(view: PlayView): CardId` (Normal):
  1. One playable card → it.
  2. Leading: the playable card with the fewest card points; ties → the weakest
     (`cardStrength`); prefer non-trumps.
  3. Following: `losers = playable.filter((c) => !winsNow(c, view))`. If there are losers →
     the loser with the **most** card points (ties → strongest), i.e. dump points on the trick
     winner. If you are not the last to play, a later player may still win, which is fine.
  4. No losing card → the playable card with the fewest card points; ties → the strongest
     (get rid of high cards while you must win anyway).
  Constants (if any) go to `tuning.ts`.
- `src/table/bot/heuristics.ts` `heuristicCard`: after the single-card shortcut,
  `if (view.ramsch) return ramschCard(view);`.
- `src/table/bot/strong.ts` `strongCard`: `if (view.ramsch) return heuristicCard(view);` at the
  start (sampling assumes a declarer).
- Tests: `src/table/bot/ramsch.test.ts` with hand-built `PlayView`s (lead → lowest points; can
  dump an Ace under a higher trump → does; forced to win → fewest points). `levels.test.ts`: add
  Ramsch games (engine `newGame(seed, { ramschOnPassIn: true })`, all three levels) and assert the
  illegal-action fallback never happens; if `arena.ts` `playGame` builds games, give it an
  optional `options` parameter. `bot.test.ts`: a bot-only table with `rules.ramsch` on plays
  several games without errors.
- Run: `npx vitest run src/table/bot src/table/bot.test.ts`.

### Step 6: wire format and snapshots

- `src/net/schemaGame.ts`: `set-rules` command (`rules: z.object({ ramsch: z.boolean() })`).
- `src/net/schemaView.ts`: `GameViewSchema.ramsch`, `table.rules`, `ViewResultSchema` Ramsch
  variant, `GameRecordSchema.outcome` enum + `ramsch: RamschRecordSchema.nullable().default(null)`
  (old cached records have no field). If the file nears 300 lines, move the record schema into
  `src/net/schemaRecord.ts`.
- `src/net/constants.ts`: `PROTOCOL_VERSION` + 1 (expected 5).
- `src/ui/persist/hostedMigrate.ts` (`migrateSnapshot`): `table.rules` missing → `{ ramsch: false }`;
  `table.game.engine` missing `options` → `{ ramschOnPassIn: false }`, missing `ramsch` → `false`;
  each record missing `ramsch` → `null`. Test in `hosted.test.ts` with an old-shape snapshot
  (copy a current snapshot JSON and delete the new fields).
- `src/net/protocol.test.ts`: views and records with the new fields parse; an old record without
  `ramsch` parses to `ramsch: null`.

### Step 7: UI

- `src/ui/screens/TableLobby.tsx`: section "Table rules" (`lobby.rules`): host → checkbox
  `data-testid="rule-ramsch"` (`lobby.ruleRamsch`), on change sends
  `{ type: 'set-rules', rules: { ...view.table.rules, ramsch: checked } }`; others → text
  "Ramsch when everybody passes: on/off". Test in `TableLobby.test.tsx`.
- `src/ui/game/declarerSummary.ts` (plan 06): `game.ramsch` → `t('summary.ramsch')`.
- `src/ui/game/TableCenter.tsx`: show the `SkatPile` also while a Ramsch is played.
- `src/ui/game/ResultDialog.tsx`: `result.kind === 'ramsch'` branch (new small component
  `RamschResult.tsx` if the file grows): headline `result.durchmarsch` ("{name} took every
  trick: Durchmarsch!") or `result.ramschLost` ("{names} lost the Ramsch"); a `result.jungfrau`
  line; a table with name, card points, tricks and the score delta (the score comes from the
  record, as in plan 01); the Skat chips (`game.skat` is visible after a Ramsch). Test in
  `ResultDialog.test.tsx`.
- `src/ui/stats/gameLabel.ts`: `outcome === 'ramsch'` → `t('game.ramsch')`.
  `src/ui/stats/History.tsx`: Ramsch rows: declarer and bid `—`, flags "Jungfrau"/"Durchmarsch",
  per-player deltas as usual. `ByType.tsx`: one more line "Ramsch: N".
- Bots and `TableLobby` texts in both languages (`enApp`/`enGame`/`enPanels` and German parts):
  `lobby.rules`: "Table rules" / "Tischregeln"; `lobby.ruleRamsch`: "Ramsch when everybody
  passes" / "Ramsch, wenn alle passen"; `lobby.ruleOn`/`lobby.ruleOff`: "on"/"an", "off"/"aus";
  `game.ramsch`: "Ramsch"; `summary.ramsch`: "Ramsch: everybody plays alone; fewest points
  win" / "Ramsch: jeder spielt allein, wenige Augen gewinnen"; `result.ramschLost`: "{names}
  lost the Ramsch" / "{names} verliert den Ramsch"; `result.durchmarsch`: "{name} took every
  trick: Durchmarsch!" / "{name} hat alle Stiche: Durchmarsch!"; `result.jungfrau`: "Jungfrau:
  a player took no trick, the loss counts double." / "Jungfrau: ein Spieler hat keinen Stich,
  der Verlust zählt doppelt."; `stats.ramsch`: "Ramsch"; `game.jungfrau`: "Jungfrau";
  `game.durchmarsch`: "Durchmarsch".

### Step 8: docs

- `docs/skat-rules.md`: Step 1 (already done).
- `docs/engine.md`: §1 types (`GameOptions`, `ramsch`, result variant), §2 state machine (the
  passed-in arrow with the option), §3 table (`newGame(seed, options)`, `legal.ts`), §5
  `playModeOf`, §6 `ramsch.ts`, §7 invariants (Ramsch fuzz). `src/engine/AGENTS.md` file map.
- `docs/table.md`: §1 `rules`, §2 `setRules`, §3 `set-rules` row, §5 records (Ramsch), §6 view
  fields. `src/table/AGENTS.md` file map (`rules.ts`, `bot/ramsch.ts`).
- `docs/hidden-information.md` §2: Skat revealed after a finished Ramsch.
- `docs/bots.md`: new section "Ramsch" (heuristic, Strong falls back).
- `docs/statistics.md`: §1 `outcome`/`ramsch` fields, §2 `ramsch` count, §3 History.
- `docs/networking.md` §1: version 5.
- `docs/ui.md` §3 lobby rules; `docs/ui-game-screen.md` §1/§7 (Ramsch summary, result).
- `docs/overview.md`: §3 new feature row; §4 remove Ramsch from "out of scope".
- `docs/dev/e2e.md` §6: `rule-ramsch`. `docs/dev/testing.md` §4.
- `README.md` "How to play": the table rule.
- `docs/decisions.md`: rows from §2; mark D8 "*Ramsch part superseded by I…*".

## 4. Validation

- `npm run check` green (fuzz tests included).
- `npx playwright test e2e/game.spec.ts e2e/layout.spec.ts`.
- Manual: `#/dev/local?bots=easy`, enable Ramsch in the lobby before Start, play until everybody
  passes (easy bots pass often; you pass too): the game goes straight to card play, the summary
  line says Ramsch, the result shows points per player and the loser.

## 5. Pitfalls

- Never compute Ramsch scores in the table or UI; they come from the engine result
  (`result.scores`), the table only maps roles to ids.
- `declaration` stays `null` in Ramsch. Every place that used `state.declaration` to get the play
  mode must use `playModeOf` (engine) / `modeOfView` (bots).
- Old host snapshots: engine states without `options`/`ramsch` would crash `applyBidding`; the
  migration is required.
- Do not change `game.fuzz.test.ts` expectations for the default options.
