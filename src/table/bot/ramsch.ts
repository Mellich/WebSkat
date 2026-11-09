// Normal card play in Ramsch (skat-rules §12): everybody plays alone and wants few card points.
// Dump points on the trick winner when you cannot win; otherwise shed the cheapest card.

import { cardPoints, cardStrength, isTrump, type CardId, type PlayMode } from '../../engine';
import { winsNow } from './cardsLeft';
import type { PlayView } from './knowledge';

const RAMSCH_MODE: PlayMode = { kind: 'grand' };

/** Lowest card points first; then non-trumps; then weakest. */
function leadKey(c: CardId): number {
  return cardPoints(c) * 10_000 + (isTrump(c, RAMSCH_MODE) ? 5_000 : 0) + cardStrength(c, RAMSCH_MODE);
}

function lowest(cards: readonly CardId[], key: (c: CardId) => number): CardId {
  const best = [...cards].sort((a, b) => key(a) - key(b))[0];
  if (best === undefined) throw new Error('no card to choose from');
  return best;
}

function highest(cards: readonly CardId[], key: (c: CardId) => number): CardId {
  return lowest(cards, (c) => -key(c));
}

export function ramschCard(view: PlayView): CardId {
  const playable = view.playable;
  const only = playable[0];
  if (only === undefined) throw new Error('no playable card');
  if (playable.length === 1) return only;
  if (view.trick.plays.length === 0) {
    return lowest(playable, leadKey);
  }
  const losers = playable.filter((c) => !winsNow(c, view));
  if (losers.length > 0) {
    // Dump the most points on the trick winner; ties go to the strongest card.
    return highest(losers, (c) => cardPoints(c) * 1_000 + cardStrength(c, RAMSCH_MODE));
  }
  // Forced to win: take the trick with the cheapest card that still wins.
  return lowest(playable, (c) => cardPoints(c) * 1_000 - cardStrength(c, RAMSCH_MODE));
}
