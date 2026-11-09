# AGENTS.md — `src/engine` (one Skat game, pure)

Read first: `docs/skat-rules.md` (rules, scoring vectors) and `docs/engine.md` (types, reducer,
API). Tests: `docs/dev/testing.md`.

## Rules for this folder

- **Pure TypeScript.** No `react`, DOM, `window`, `localStorage`, network, `Date`, `Math.random`,
  `console`, timers, module-level mutable state. Randomness only via `rng.ts` with an explicit
  seed. (`tsconfig.core.json` has no DOM types; ESLint forbids the globals.)
- Imports only from inside `src/engine`. Never from `src/table`, `src/net`, `src/ui`, or `zod`.
- **Immutable**: return new objects; never `push`/`splice`/assign on inputs. Use `readonly`,
  spread, `map`, `filter`.
- **Never throw** for bad input: return `err(code, message)` (`types.ts`). Throw only in
  `assertNever`.
- Exhaustive `switch` on unions with `default: return assertNever(x)`.
- JSON-serializable data only (no `Map`, `Set`, classes, `Date`).
- Card ids are strings: suit = `id[0]`, rank = `id.slice(1)` (`'10'` has two characters).
- The public API is what `index.ts` re-exports. `testing.ts` is test-only; never export it.
- **Numbers and formulas come from `docs/skat-rules.md`.** If a test disagrees with the doc, fix
  the code. If you believe the doc is wrong, ask the user; never change the doc's numbers silently.

## File map

| File | Contents |
|---|---|
| `types.ts` | `Suit`, `Rank`, `CardId`, `Role`/`ROLES`, `Declaration`, `GamePhase`, `BiddingState`, `GameAction`, `GameOptions`/`DEFAULT_GAME_OPTIONS`, `GameState`, `GameResult`, `GameErrorCode`, `Result`, `ok`, `err`, `assertNever` |
| `cards.ts` | `SUITS`, `RANKS`, `ALL_CARDS`, `card`, `suitOf`, `rankOf`, `isCardId`, `cardPoints`, `sumPoints`, `sortHand` |
| `rng.ts` | `mulberry32(seed)`, `shuffle(items, seed)` |
| `deck.ts` | `deal(seed)` → hands + Skat |
| `trump.ts` | `PlayMode`, `modeOf`, `isTrump`, `effectiveSuit`, `cardStrength`, `trickWinner`, `legalCards` |
| `spitzen.ts` | `countSpitzen(twelve, mode)` |
| `values.ts` | `SUIT_BASE`, `GRAND_BASE`, `nullValue`, `baseValue`, `BID_VALUES`, `gameMultiplier`, `declarationFloorValue` |
| `declaration.ts` | `validateDeclaration`, `declarationOptions` |
| `bidding.ts` | `initialBidding`, `nextBidValue`, `applyBid`, `legalBidValues`, `biddingOutcome` |
| `play.ts` | `playCard`, `nextRole` |
| `ramsch.ts` | `playModeOf` (Grand mode in a Ramsch), `ramschScores` (numbers in), `scoreRamsch` (skat-rules §12) |
| `scoring.ts` | `computeScore` (numbers in, for tests), `scoreGame`, `skatPointsForDeclarer` |
| `legal.ts` | `Legal`, `getLegal`, `enumerateActions` (re-exported by `game.ts`; not in `index.ts`) |
| `game.ts` | `newGame(seed, options)`, `applyAction` (the reducer), `isFinished` |
| `index.ts` | public re-exports |
| `testing.ts` | test helpers (`hand`, `stateWith`, `apply`, `run`, `afterBidding`, …) |
| `*.test.ts` | one test file per module; `game.fuzz.test.ts` (2000 random games), `ramsch.fuzz.test.ts` (500 Ramsch games), `ramsch.test.ts` (R1–R5 vectors, Ramsch flow), `game.scripted.test.ts` (a full game as living documentation), `game.legal.test.ts` |

## Recipes

- **Change a rule:** update the table-driven test from `docs/skat-rules.md` first, then the code.
  Run `npx vitest run src/engine` (fuzz included), then `npm run check`.
- **New action or phase:** `types.ts` → `game.ts` (`applyAction` branch, `getLegal`,
  `enumerateActions`) → tests (flow, errors, immutability) → follow the cross-layer checklist in
  `docs/dev/workflow.md` §4 (zod schema, `PROTOCOL_VERSION`, bots, UI).
- **New helper for other layers:** export it from its module and make sure `index.ts` re-exports
  it. Bots and the UI import rule helpers from here instead of copying logic.

## Pitfalls

- Jacks are **not** part of their printed suit in suit games and Grand (`DJ` is trump). In Null
  they are ordinary cards between 10 and Q.
- A Ramsch has no declaration: `declaration` stays `null`. Use `playModeOf(state)`, never
  `state.declaration`, to get the play mode (card play, legal moves, bots).
- The first bidder is the **middlehand** (caller); the forehand is the listener. `newGame` sets
  `turn = 'middlehand'`.
- Bids go strictly up one step (`nextBidValue`); jumps are `ILLEGAL_BID`.
- Spitzen use the declarer's original 10 cards + the 2 Skat cards, even after discarding.
- `declarerPoints` includes the Skat/discard; the trick count does not.
- Schneider/Schwarz flags count for **both** won and lost games.
- The declarer needs ≥ 61 (not 60). Schneider = `≥ 90` or `≤ 30`.
- Overbid: `gameValue < bid` ⇒ lost; loss uses `ceil(bid / base) × base` (suit/grand); Null uses
  its own value.
