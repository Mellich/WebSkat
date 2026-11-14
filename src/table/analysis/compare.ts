// Is one card really better than another, or is the gap just sampling noise? Every card is played
// in the same worlds, so the two are compared pair-wise: the mean and standard error of the
// per-world difference (docs/table.md "Game analysis", decision I188). Pure.

import type { CardId } from '../../engine';
import { bestCard, type CardStat, type ScoreCriterion } from './scores';
import { CONFIDENCE_Z } from './tuning';
import { worldPoints, worldWon } from './world';

/** What is compared: the win flag, or the card points. */
export type Measure = 'win' | 'points';

export interface PairedDifference {
  readonly n: number; // worlds both cards were played in
  readonly mean: number; // mean of (a - b) over those worlds
  readonly se: number; // standard error of that mean (0 for fewer than 2 worlds)
}

/** The win rate decides for the win criterion; every points criterion compares card points. */
export function measureOf(criterion: ScoreCriterion): Measure {
  return criterion === 'win' ? 'win' : 'points';
}

function valueOf(world: number, measure: Measure): number {
  return measure === 'win' ? (worldWon(world) ? 1 : 0) : worldPoints(world);
}

/** Pair-wise difference `a - b` over the worlds both stats have (same index = same deal). */
export function pairedDifference(a: CardStat, b: CardStat, measure: Measure): PairedDifference {
  const n = Math.min(a.worlds.length, b.worlds.length);
  if (n === 0) return { n, mean: 0, se: 0 };
  let sum = 0;
  let sumSquares = 0;
  for (let i = 0; i < n; i++) {
    const d = valueOf(a.worlds[i] ?? 0, measure) - valueOf(b.worlds[i] ?? 0, measure);
    sum += d;
    sumSquares += d * d;
  }
  const mean = sum / n;
  if (n < 2) return { n, mean, se: 0 };
  const variance = Math.max(0, (sumSquares - n * mean * mean) / (n - 1));
  return { n, mean, se: Math.sqrt(variance / n) };
}

/** True when `best` beats `other` by more than `z` standard errors; never below `minWorlds` common worlds. */
export function clearlyBetter(best: CardStat, other: CardStat, measure: Measure, z = CONFIDENCE_Z, minWorlds = 2): boolean {
  const d = pairedDifference(best, other, measure);
  if (d.n < minWorlds) return false;
  return d.mean > z * d.se;
}

/**
 * The best card by `criterion` first, then every card that is not clearly worse than it (in the
 * order of `stats`). One card means a clear decision; several mean "about equal". Empty before
 * the first sample.
 */
export function bestCards(stats: readonly CardStat[], criterion: ScoreCriterion): readonly CardId[] {
  const first = bestCard(stats, criterion);
  if (first === null) return [];
  const best = stats.find((s) => s.card === first);
  if (best === undefined) return [];
  const measure = measureOf(criterion);
  const tied = stats.filter((s) => s.card !== first && s.samples > 0 && !clearlyBetter(best, s, measure));
  return [first, ...tied.map((s) => s.card)];
}
