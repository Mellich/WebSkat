// Adaptive sampling: which cards still need samples (docs/table.md "Game analysis", decision I189).
// Cards that are clearly behind stop getting samples, so the budget goes to the close contenders.
// Pure: the runner only asks, it holds no rule of its own.

import type { CardId } from '../../engine';
import { clearlyBetter } from './compare';
import { bestCard, maxSamples, type CardStat } from './scores';
import { ELIMINATION_Z, MAX_SAMPLES_PER_CARD, MIN_SAMPLES_TO_ELIMINATE } from './tuning';

function statOf(stats: readonly CardStat[], card: CardId | null): CardStat | undefined {
  return stats.find((s) => s.card === card);
}

/**
 * The cards to sample in the next batch; empty when the analysis is finished (the maximum is
 * reached, or one card is clearly the best).
 *
 * Only cards at the front (the most samples) can continue: a card that fell behind stays behind,
 * so the cards that are sampled together always share the same worlds (pair-wise comparison, `compare.ts`).
 * A front card is dropped when it is clearly behind the leader by win rate and, if `usePoints`
 * (card points matter, not in Null), also behind the leader by average points, so either
 * "best by" choice of the screen stays decided. A single playable card is sampled to the maximum.
 */
export function activeCards(stats: readonly CardStat[], usePoints: boolean): readonly CardId[] {
  const front = maxSamples(stats);
  if (front === 0 && stats.length === 0) return [];
  if (front >= MAX_SAMPLES_PER_CARD) return [];
  const candidates = stats.filter((s) => s.samples === front);
  if (stats.length <= 1 || front < MIN_SAMPLES_TO_ELIMINATE) return candidates.map((s) => s.card);

  const byWin = statOf(candidates, bestCard(candidates, 'win'));
  const byPoints = statOf(candidates, bestCard(candidates, 'average'));
  if (byWin === undefined || byPoints === undefined) return candidates.map((s) => s.card);
  const out = (s: CardStat): boolean =>
    clearlyBetter(byWin, s, 'win', ELIMINATION_Z, MIN_SAMPLES_TO_ELIMINATE) &&
    (!usePoints || clearlyBetter(byPoints, s, 'points', ELIMINATION_Z, MIN_SAMPLES_TO_ELIMINATE));
  const active = candidates.filter((s) => !out(s));
  return active.length <= 1 ? [] : active.map((s) => s.card);
}
