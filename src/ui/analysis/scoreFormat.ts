// Text and order of the card scores of the analysis screen (docs/ui.md §11). Pure.

import { ALL_CARDS, type CardId } from '../../engine';
import { compareStats, type CardStat, type ScoreCriterion } from '../../table';

/** "82 %" for a win rate, "–" before the first sample. */
export function percent(x: number | null): string {
  return x === null ? '–' : `${String(Math.round(x * 100))} %`;
}

/** Card points (average, median, …) rounded to a whole number, "–" before the first sample. */
export function points(x: number | null): string {
  return x === null ? '–' : String(Math.round(x));
}

const CARD_ORDER = new Map<CardId, number>(ALL_CARDS.map((card, index) => [card, index]));

/** Best first by `criterion` (then the other values), then the card order. Unsampled cards come last. */
export function rankStats(stats: readonly CardStat[], criterion: ScoreCriterion = 'win'): CardStat[] {
  return [...stats].sort((a, b) => {
    const byValue = compareStats(a, b, criterion);
    if (byValue !== 0) return byValue;
    return (CARD_ORDER.get(a.card) ?? 0) - (CARD_ORDER.get(b.card) ?? 0);
  });
}

export type WinTone = 'good' | 'bad' | 'neutral';

/** Badge colour of a win rate: good from 60 %, bad up to 40 %, neutral in between or before a sample. */
export function winTone(rate: number | null): WinTone {
  if (rate === null) return 'neutral';
  if (rate >= 0.6) return 'good';
  if (rate <= 0.4) return 'bad';
  return 'neutral';
}
