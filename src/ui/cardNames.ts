// English card names for labels and alt texts. Phase 6 moves these into the i18n dictionaries.

import { rankOf, suitOf, type CardId, type Rank, type Suit } from '../engine';

const SUIT_NAMES: Readonly<Record<Suit, string>> = {
  C: 'clubs',
  S: 'spades',
  H: 'hearts',
  D: 'diamonds',
};

const RANK_NAMES: Readonly<Record<Rank, string>> = {
  '7': 'Seven',
  '8': 'Eight',
  '9': 'Nine',
  '10': 'Ten',
  J: 'Jack',
  Q: 'Queen',
  K: 'King',
  A: 'Ace',
};

export function cardLabel(id: CardId): string {
  return `${RANK_NAMES[rankOf(id)]} of ${SUIT_NAMES[suitOf(id)]}`;
}
