# Step 04: Monte-Carlo card scores (`scoreBatch`)

**Kind:** feature (pure). **Layers:** table (`analysis/`, small change in `bot/simulate.ts`).
**Protocol:** no. **Needs:** step 03.

## Read first

- `docs/bots.md` §6 (Strong level: PIMC, sampling, rollouts)
- `src/table/bot/strong.ts` (`strongCard`, `teamScore`) – the model for this step
- `src/table/bot/sample.ts` (`sampleDeal`), `src/table/bot/simulate.ts` (`SimState`, `simPlay`,
  `playOut`), `src/table/bot/knowledge.ts` (`botViewOf`, `PlayView`), `src/table/bot/heuristics.ts`
  (`heuristicCard`)

## What a score means

For the player to move (the **mover**) and each card in `Position.playable`:

- **win rate**: share of play-outs after this card that the mover's **team** wins
  (declarer alone, or the two defenders together);
- **average points**: average card points of the mover's team at the end (Skat included for the
  declarer, as in `playOut`). Not shown for Null games.

Each sample ("world") is one full deal of the cards still in play. All cards are tried in the
**same** worlds (common random numbers, as in `strongCard`), so differences between cards are not
noise from different worlds.

Two modes (the switch in the UI, step 07):

- `useRealHands: false` (default): worlds come from `sampleDeal(botViewOf(state, mover), rand)`.
  The hidden cards are dealt randomly but consistent with what the mover knows (own hand, played
  cards, voids shown, ouvert hand, own discard). This rates the decision fairly.
- `useRealHands: true`: every world is the real deal (`state.hands`; the Skat cards that count for
  the declarer are `state.pickedUpSkat ? state.discarded : state.skat`).

The rollout policy: every simulated player plays `heuristicCard(view)`, except that with
probability `ROLLOUT_EPSILON` (0.1) it plays a random legal card. Without this, real-hand play-outs
would be fully deterministic and more samples would add nothing; with it, both modes converge to a
stable average as samples grow ("continuous improvement").

Winning a play-out (`teamWon`):

- Null: the declarer wins iff `declarerTricks === 0`.
- Suit / Grand: the declarer wins iff `declarerPoints >= 61`, and `>= 90` if Schneider was
  announced, and `defenderTricks === 0` if Schwarz was announced or the game is ouvert
  (ouvert suit/grand implies Schwarz, skat-rules §5). Overbidding is **ignored** (needs the game
  value; documented in the decision row).
- Defenders win iff the declarer does not.

## Changes

### 1. `src/table/bot/simulate.ts`: injectable rollout policy

```ts
export type RolloutPolicy = (view: PlayView) => CardId;

/** Plays the deal to the end (Null stops once the declarer has taken a trick). */
export function playOut(start: SimState, pick: RolloutPolicy = heuristicCard): SimOutcome
```

Inside the loop use `pick(viewIn(sim, role))` instead of `heuristicCard(viewIn(sim, role))`.
The default keeps the Strong bot unchanged (its tests must stay green; the bot arena is not
affected).

### 2. `src/table/analysis/tuning.ts`

```ts
// Numeric constants of the game analysis (docs/table.md §analysis, decision row "Card scores").
export const ROLLOUT_EPSILON = 0.1; // chance of a random legal card per simulated move
export const SAMPLES_PER_BATCH = 8; // worlds per scoreBatch call (each card is played in each)
export const MAX_SAMPLES_PER_CARD = 3000; // the worker stops here (step 06)
```

### 3. `src/table/analysis/rollout.ts`

```ts
export function analysisPolicy(rand: () => number, epsilon = ROLLOUT_EPSILON): RolloutPolicy;
// (view) => rand() < epsilon ? view.playable[Math.floor(rand() * view.playable.length)] ?? heuristicCard(view) : heuristicCard(view)

export function teamWon(declaration: Declaration, outcome: SimOutcome, moverIsDeclarer: boolean): boolean;
export function teamPoints(outcome: SimOutcome, moverIsDeclarer: boolean): number; // declarerPoints or 120 - declarerPoints
```

### 4. `src/table/analysis/scores.ts`

```ts
export interface CardStat {
  readonly card: CardId;
  readonly samples: number;
  readonly wins: number; // play-outs the mover's team won
  readonly points: number; // sum of the mover's team card points over all samples
}

export interface ScoreOptions {
  readonly useRealHands: boolean;
  readonly samples: number; // worlds in this batch (default SAMPLES_PER_BATCH)
}

/** True when the position can be scored: a played (not Ramsch) game with a player to move. */
export function canScore(position: Position): boolean;

/** One zeroed stat per playable card, in the order of `position.playable`. */
export function emptyStats(position: Position): readonly CardStat[];

/** Adds `options.samples` worlds to `stats` (returns new stats; `stats` must match the position). */
export function scoreBatch(
  position: Position,
  stats: readonly CardStat[],
  options: ScoreOptions,
  rand: () => number,
): readonly CardStat[];

export function winRate(stat: CardStat): number | null; // null when samples === 0
export function averagePoints(stat: CardStat): number | null;
export function minSamples(stats: readonly CardStat[]): number; // 0 for []
/** Best card by win rate, then average points; null when nothing is sampled yet. */
export function bestCard(stats: readonly CardStat[]): CardId | null;
```

`scoreBatch` outline (copy the world-building from `strongCard`):

```ts
const state = position.state;
const mover = position.mover;            // canScore guarantees non-null, declarer and declaration
const view = botViewOf(state, mover);
const pick = analysisPolicy(rand);
const worlds: SimState[] = [];
for (let i = 0; i < options.samples; i++) {
  const deal = options.useRealHands
    ? { hands: state.hands, skat: state.pickedUpSkat ? state.discarded : state.skat }
    : sampleDeal(view, rand);
  worlds.push({ hands: deal.hands, trick: state.trick, tricks: state.tricks, declarer, declaration,
    skat: deal.skat, declarerKnowsSkat: state.pickedUpSkat, voids: view.voids });
}
return stats.map((stat) => {
  let wins = 0; let points = 0;
  for (const world of worlds) {
    const outcome = playOut(simPlay(world, mover, stat.card), pick);
    if (teamWon(declaration, outcome, mover === declarer)) wins++;
    points += teamPoints(outcome, mover === declarer);
  }
  return { ...stat, samples: stat.samples + worlds.length, wins: stat.wins + wins, points: stat.points + points };
});
```

If `canScore(position)` is false, `scoreBatch` returns `stats` unchanged (no throw).
`sampleDeal` may throw only when the cards are inconsistent; positions from `positionAt` are
always consistent. Do not catch it here; the worker (step 06) reports errors.

Export everything public from `src/table/analysis/index.ts`.

## Tests first: `src/table/analysis/scores.test.ts`

Use `mulberry32(seed)` from the engine for `rand`. Build positions via a finished game →
`analysisInputFromView` → `analysisStart` → `positionAt(start, input.plays.slice(0, n))`.

1. `emptyStats` has one entry per playable card, all zero; `minSamples` = 0; `bestCard` = null.
2. After two batches of 4: every stat has `samples === 8`, `0 <= wins <= 8`,
   `0 <= points <= 8 * 120`.
3. Deterministic: the same seed gives the same stats; another seed may differ.
4. `canScore` is false for a Ramsch position, for the final position (`mover === null`) and true
   at the first card of a played game.
5. Knowledge test (default mode): swap two cards between the two hidden hands **of the other
   players** that have the same effective suit and keep all voids valid (e.g. pick a position at
   the first card, where nobody has shown a void yet, and swap any card of player B with one of
   player C); rebuild the position; with the same seed `scoreBatch(..., { useRealHands: false })`
   gives **equal** stats. With `useRealHands: true` the stats are allowed to differ.
6. Obvious position: take a played suit or grand game (not Null, not ouvert, not Ramsch) that
   went all 10 tricks. At the first card of the last trick there is exactly one playable card; its
   win rate with `useRealHands: true` is 0 or 1 and matches the engine result after the full line
   (`positionAt(start, input.plays).result`): compare with `result.playedWon` (won ignoring
   overbid), seen from the mover's team.
7. `teamWon` table test: suit 61 → win, 60 → loss; announced Schneider needs 90; ouvert needs
   `defenderTricks === 0`; Null with 0 / 1 declarer tricks; defenders get the opposite.
8. `analysisPolicy(() => 0.99)` returns `heuristicCard(view)`; with `rand` returning 0 first it
   returns `view.playable[0]`.

Also run the bot tests: `npx vitest run src/table/bot` (the default `pick` keeps them green).

Run: `npx vitest run src/table/analysis src/table/bot`

## Docs

- `docs/bots.md` §6.2: `playOut` takes an optional rollout policy (default `heuristicCard`); the
  game analysis uses it.
- `docs/table.md` analysis section: what a score is, the two modes, the policy, the win rule,
  constants in `analysis/tuning.ts`.
- `src/table/AGENTS.md` file map (`analysis/` row) – add `scores.ts`, `rollout.ts`, `tuning.ts`.
- `docs/decisions.md`: row "Card scores" (README §3).

## Done when

`npm run check` is green; `scores.ts` < 200 lines.
