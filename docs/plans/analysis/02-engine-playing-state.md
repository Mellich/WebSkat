# Step 02: `playingStateFrom` – a game at the first card, from known cards

**Kind:** feature (new pure helper). **Layers:** engine. **Protocol:** no.

## Read first

- `docs/engine.md`, `src/engine/AGENTS.md`
- `src/engine/game.ts` (`newGame`, `applySkatDecision`, `applyDiscarding`), `src/engine/play.ts`
  (`playCard`), `src/engine/declaration.ts` (`validateDeclaration(d, hand)`),
  `src/engine/bidding.ts` (`initialBidding`), `src/engine/testing.ts` (test helpers)

## Why

The analysis must replay the card play of a finished game. We know the dealt hands, the Skat, the
discard and the declaration, but not the seed, and we do not want to replay bidding and Kontra/Re.
So we build the `GameState` at the start of card play directly and then use the normal reducer
(`applyAction` with `{ type: 'play', card }`) for every card. That gives legal cards, trick winners
and the final `GameResult` for free, exactly as in a real game.

## Goal: new file `src/engine/playingState.ts`

```ts
// Builds the GameState at the first card of a played game or a Ramsch from known cards (analysis).

export interface PlaySetup {
  readonly hands: Readonly<Record<Role, readonly CardId[]>>; // as dealt, 10 each
  readonly skat: readonly CardId[]; // as dealt, 2
  readonly ramsch: boolean;
  readonly declarer: Role | null; // null exactly when ramsch
  readonly declaration: Declaration | null; // null exactly when ramsch
  readonly bid: number | null; // null exactly when ramsch
  readonly pickedUpSkat: boolean; // false for Hand games and Ramsch
  readonly discarded: readonly CardId[]; // 2 cards when pickedUpSkat, else []
  readonly doubling: DoubleLevel;
}

export function playingStateFrom(setup: PlaySetup): Result<GameState, GameErrorCode>;
```

Validation (return `err(...)`, never throw; reuse existing codes, do **not** add a new
`GameErrorCode`, because every code needs an `error.<CODE>` text in the UI):

| Check | Error code |
|---|---|
| each hand has 10 cards, the Skat 2, all 32 ids are valid (`isCardId`) and appear exactly once | `UNKNOWN_CARD` |
| `ramsch` ⇔ `declarer === null` ⇔ `declaration === null` ⇔ `bid === null` | `INVALID_DECLARATION` |
| `ramsch` and (`pickedUpSkat` or `discarded.length > 0` or `doubling !== 1`) | `INVALID_DECLARATION` |
| `validateDeclaration(declaration, !pickedUpSkat)` fails | `INVALID_DECLARATION` |
| `pickedUpSkat` and discard is not 2 different cards from declarer hand + Skat | `INVALID_DISCARD` |
| not `pickedUpSkat` and `discarded.length !== 0` | `INVALID_DISCARD` |

State built (compare with `newGame` and the Ramsch branch of `applyBidding`):

```ts
{
  phase: 'playing',
  hands: declarer's hand = pickedUpSkat ? [...hand, ...skat] minus discarded : hand; others as dealt,
  initialHands: setup.hands,
  skat: setup.skat,
  bidding: { ...initialBidding(), stage: ramsch ? 'passed-in' : 'done', currentBid: bid },
  declarer, bid, pickedUpSkat, discarded, declaration: validated declaration (or null),
  doubling,
  doublePassed: [],
  trick: { leader: 'forehand', plays: [] },
  tricks: [],
  turn: 'forehand',
  result: null,
  options: { ramschOnPassIn: ramsch, kontra: doubling > 1 },
  ramsch,
}
```

Export it from `src/engine/index.ts` (`export * from './playingState';`).

## Tests first: `src/engine/playingState.test.ts`

1. **Round trip (property, 300 seeds):** for seeds `1..300`, play a random game to the end with
   options `{ ramschOnPassIn: seed % 3 === 0, kontra: seed % 2 === 0 }` (pick random actions from
   `enumerateActions(state, state.turn)` with `mulberry32(seed)`; see `game.fuzz.test.ts` for the
   pattern). Skip games whose result is `passed-in`. Build a `PlaySetup` from the finished state
   (`initialHands`, `skat`, `ramsch`, `declarer`, `declaration`, `bid`, `pickedUpSkat`,
   `discarded`, `doubling`), call `playingStateFrom`, then apply every card of
   `finished.tricks.flatMap((t) => t.plays)` with `applyAction(s, play.role, { type: 'play', card })`.
   Expect every step ok and the final `result` `toEqual` the original `result`.
2. Hand game: `pickedUpSkat: false` → declarer keeps 10 cards, `discarded` is `[]`.
3. Errors: duplicate card → `UNKNOWN_CARD`; 9 cards in a hand → `UNKNOWN_CARD`; Ramsch with a
   declarer → `INVALID_DECLARATION`; discard of a card not in hand + Skat → `INVALID_DISCARD`;
   `pickedUpSkat: false` with a discard → `INVALID_DISCARD`; `pickedUpSkat: true` with a
   declaration `hand: true` → `INVALID_DECLARATION` (`validateDeclaration` requires
   `d.hand === !pickedUpSkat`).
4. Immutability: the `setup` object (deep-frozen with `Object.freeze` on nested arrays) is unchanged.

Run: `npx vitest run src/engine/playingState.test.ts`, then `npx vitest run src/engine`.

## Docs

- `docs/engine.md`: module API, one paragraph on `playingStateFrom` (for the analysis; not used by
  the table).
- `src/engine/AGENTS.md` file map: `playingState.ts` row; add `playingState` to the tests row.
- `docs/decisions.md`: row "Card play can start from known cards" (README §3).

## Done when

`npm run check` is green; `src/engine/playingState.ts` < 120 lines.
