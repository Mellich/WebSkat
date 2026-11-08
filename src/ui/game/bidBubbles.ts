// Speech bubbles for the bidding: which new bidding event belongs to which player (pure).

import type { ViewBidEvent } from '../../table';
import type { Translator } from '../i18n';

export interface BidBubble {
  readonly event: ViewBidEvent;
  /** Position of the event in `bidding.history`; a new event of the same player has a new index. */
  readonly index: number;
}

/** The latest event of each player among `history[from..]`. */
export function latestPerPlayer(history: readonly ViewBidEvent[], from: number): Readonly<Record<string, BidBubble>> {
  const found: Record<string, BidBubble> = {};
  history.forEach((event, index) => {
    if (index >= from) found[event.playerId] = { event, index };
  });
  return found;
}

export function bubbleText(event: ViewBidEvent, t: Translator): string {
  switch (event.type) {
    case 'bid':
      return String(event.value ?? '');
    case 'hold':
      return t('bubble.hold');
    case 'pass':
      return t('bubble.pass');
    case 'claim':
      return t('bubble.claim');
    default: {
      const unused: never = event.type;
      return unused;
    }
  }
}
