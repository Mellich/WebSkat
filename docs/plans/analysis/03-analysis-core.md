# Step 03: analysis core – input, replay lines, positions (`src/table/analysis/`)

**Kind:** feature (pure). **Layers:** table. **Protocol:** no.
**Needs:** step 01 (`GameView.tricks`) and step 02 (`playingStateFrom`).

## Read first

- `src/table/AGENTS.md`, `docs/table.md` (views), `src/table/viewTypes.ts`
- `src/engine/playingState.ts` (step 02), `src/engine/legal.ts` (`getLegal`), `src/engine/game.ts`
  (`applyAction`), `src/engine/cards.ts` (`ALL_CARDS`, `cardPoints`)

## Why

Everything the analysis screen shows must come from pure code: the input it receives, the state
after any number of played cards, the legal cards of the player to move, and how a chosen card
changes the line of play. The UI must not call `applyAction` or `legalCards` itself
(`src/ui/AGENTS.md`).

## New folder `src/table/analysis/`

Pure like the rest of `src/table` (ESLint already applies the table rules to `src/table/**`).

### `types.ts`

```ts
// Data of the game analysis (docs/table.md §analysis). JSON-serializable, card ids only from a finished game.

export type AnalysisKind = 'played' | 'ramsch' | 'passed-in';

export interface AnalysisBid {
  readonly role: Role;
  readonly type: 'bid' | 'hold' | 'pass' | 'claim';
  readonly value?: number | undefined;
}

/** Everything the analysis needs about one finished game. Travels in the URL (step 05). */
export interface AnalysisInput {
  readonly version: 1;
  readonly kind: AnalysisKind;
  readonly names: Readonly<Record<Role, string>>;
  readonly hands: Readonly<Record<Role, readonly CardId[]>>; // as dealt
  readonly skat: readonly CardId[]; // as dealt
  readonly declarer: Role | null; // null for ramsch and passed-in
  readonly declaration: Declaration | null;
  readonly bid: number | null;
  readonly pickedUpSkat: boolean;
  readonly discarded: readonly CardId[];
  readonly doubling: DoubleLevel;
  readonly bidding: readonly AnalysisBid[];
  readonly plays: readonly CardId[]; // the actual card play, in order (who played follows from the rules)
}

/** A line of play: the cards in order and how many of them are currently applied. */
export interface AnalysisLine {
  readonly plays: readonly CardId[];
  readonly cursor: number; // 0 = before the first card; plays.length = end of the line
}

/** The game after `cursor` cards, prepared for display and for the sampler. */
export interface Position {
  readonly state: GameState; // for scoreBatch (step 04); the UI does not read it
  readonly hands: Readonly<Record<Role, readonly CardId[]>>; // cards still in hand
  readonly trick: Trick; // current trick (may be empty)
  readonly lastTrick: CompletedTrick | null;
  readonly tricks: readonly CompletedTrick[];
  readonly tricksWon: Readonly<Record<Role, number>>;
  readonly points: Readonly<Record<Role, number>>; // card points won in tricks so far
  readonly mover: Role | null; // who plays next; null when the game is over
  readonly playable: readonly CardId[]; // legal cards of the mover ([] when over)
  readonly result: GameResult | null; // set when the line reached the end of the game
}
```

### `fromView.ts`

```ts
/** The analysis input of the finished game in `view`, or null while no finished game is shown. */
export function analysisInputFromView(view: TableView): AnalysisInput | null;
```

- `null` unless `view.game !== null`, `view.game.phase === 'finished'`, `view.game.result !== null`
  and `view.game.initialHands !== null`.
- `roleOfId`: invert `game.roles`. `names[role]` = name of `game.roles[role]` from
  `view.table.players` (fallback `'?'`).
- `hands[role] = game.initialHands[game.roles[role]] ?? []`.
- `skat = game.skat ?? ALL_CARDS.filter((c) => not in any hand)`. (A passed-in view has no Skat;
  the two missing cards are derivable from the public hands, so this reveals nothing new.)
- `kind = game.result.kind`; `declarer = game.declarerId === null ? null : roleOfId(declarerId)`.
- `declaration`, `bid`, `pickedUpSkat`, `doubling` from the game view; `discarded = game.discarded ?? []`.
- `bidding = game.bidding.history.map(...)` (player id → role; keep `value` only for `bid`).
- `plays = (game.tricks ?? []).flatMap((t) => t.plays.map((p) => p.card))`.

### `replay.ts`

```ts
/** The game at its first card; null for a passed-in game (nothing was played). */
export function analysisStart(input: AnalysisInput): Result<GameState | null, GameErrorCode>;

/** Applies `plays` (in order) to `start`; error if a card is not legal. */
export function positionAt(start: GameState, plays: readonly CardId[]): Result<Position, GameErrorCode>;

/** The actual game as a line, cursor at the start. */
export function actualLine(input: AnalysisInput): AnalysisLine;

/** Plays `card` at the cursor: follows the line if it is the next card, else starts a variant there. */
export function chooseCard(line: AnalysisLine, card: CardId): AnalysisLine;

/** Index of the first card where `line` leaves the actual game, or null if it never does. */
export function divergenceAt(actual: readonly CardId[], line: AnalysisLine): number | null;

/** Checks the whole input: it starts and the actual plays replay without error. */
export function validateInput(input: AnalysisInput): Result<null, GameErrorCode>;
```

Details:

- `analysisStart`: `passed-in` → `ok(null)`. Otherwise call `playingStateFrom` with
  `ramsch: input.kind === 'ramsch'` and the input fields.
- `positionAt`: loop over `plays`; for each card `role = state.turn`; if `role === null` return
  `err('WRONG_PHASE', ...)`; `applyAction(state, role, { type: 'play', card })`; stop on error.
  Then build the `Position`: `mover = state.turn`,
  `playable = mover === null ? [] : getLegal(state, mover).playableCards ?? []`,
  `tricksWon` / `points` by counting `state.tricks` (winner role; `cardPoints` sum of the plays),
  `lastTrick = state.tricks.at(-1) ?? null`, `result = state.result`.
- `chooseCard(line, card)`: if `line.plays[line.cursor] === card` → `{ ...line, cursor: cursor + 1 }`;
  else `{ plays: [...line.plays.slice(0, cursor), card], cursor: cursor + 1 }`. It does not check
  legality: the UI only offers `Position.playable`.
- `divergenceAt`: first `i < line.plays.length` with `line.plays[i] !== actual[i]`, else `null`.
- `validateInput`: `analysisStart`; for `passed-in` require `plays.length === 0`; else
  `positionAt(start, input.plays)` must be ok.

### `index.ts`

Re-export the public API of `types.ts`, `fromView.ts`, `replay.ts` (step 04 adds `scores.ts`).
Add `export * from './analysis';` to `src/table/index.ts`.

## Tests first

`src/table/analysis/replay.test.ts`

1. Build a finished game with `playUntilRecords` (`src/table/testing.ts`) or play a seed to the
   end; take `viewFor(state, someId)` and `analysisInputFromView`. `validateInput` is ok;
   `positionAt(start, input.plays)` has `mover === null` and `result` equal to the engine's result.
2. `positionAt(start, [])`: `mover === 'forehand'`, `playable` equals
   `getLegal(start, 'forehand').playableCards`, every hand has 10 cards, `points` all 0.
3. An illegal card (a card of another hand) → `ILLEGAL_CARD` or `NOT_YOUR_TURN`.
4. `chooseCard`: following the line only moves the cursor; a different card cuts the rest and
   appends; `divergenceAt` returns the cut index, `null` for the actual line.
5. Ramsch input (table rule `ramsch: true`, play until a Ramsch record): replays to the same result.
6. Passed-in: `analysisStart` → `ok(null)`; `validateInput` ok; with a non-empty `plays` → error.

`src/table/analysis/fromView.test.ts`

1. Running game → `null`. Finished game → names by role, 10 cards per hand, 2 Skat cards, 30
   distinct + Skat = 32 distinct cards, `plays.length` = 3 × trick count.
2. Passed-in game → `skat` = the two cards missing from the hands, `plays` = `[]`.
3. The result is JSON round-trip equal (`JSON.parse(JSON.stringify(x))`), i.e. serializable.

Run: `npx vitest run src/table/analysis`

## Docs

- `docs/table.md`: new section "Game analysis (`src/table/analysis/`)" – input, line/cursor model,
  `Position`; say it is not used by the host.
- `src/table/AGENTS.md` file map: `analysis/` row (files and one-line contents).
- `docs/decisions.md`: row "Replay scope" (README §3).

## Done when

`npm run check` is green; each new file < 200 lines.
