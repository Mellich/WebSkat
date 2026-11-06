import type { CardId, Declaration, Rank, Suit } from './types';

export const SUITS: readonly Suit[] = ['C', 'H', 'S', 'D'];
export const RANKS: readonly Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const ALL_CARDS: readonly CardId[] = SUITS.flatMap((suit) =>
  RANKS.map((rank) => card(suit, rank)),
);

export function card(suit: Suit, rank: Rank): CardId {
  return `${suit}${rank}`;
}

export function suitOf(c: CardId): Suit {
  return c.slice(0, 1) as Suit;
}

export function rankOf(c: CardId): Rank {
  return c.slice(1) as Rank;
}

export function isCardId(s: string): s is CardId {
  return ALL_CARDS.some((c) => c === s);
}

const RANK_POINTS: Readonly<Record<Rank, number>> = {
  '7': 0,
  '8': 0,
  '9': 0,
  '10': 10,
  J: 2,
  Q: 3,
  K: 4,
  A: 11,
};

export function cardPoints(c: CardId): number {
  return RANK_POINTS[rankOf(c)];
}

export function sumPoints(cs: readonly CardId[]): number {
  return cs.reduce((sum, c) => sum + cardPoints(c), 0);
}

const JACK_ORDER: readonly CardId[] = ['CJ', 'SJ', 'HJ', 'DJ'];
const SUIT_RANK_ORDER: readonly Rank[] = ['A', '10', 'K', 'Q', '9', '8', '7'];
const NULL_RANK_ORDER: readonly Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'];

function displayOrder(decl: Declaration | null): readonly CardId[] {
  if (decl?.kind === 'null') {
    return SUITS.flatMap((suit) => NULL_RANK_ORDER.map((rank) => card(suit, rank)));
  }
  const trump = decl?.kind === 'suit' ? decl.trump : null;
  const trumpSuitCards = trump === null ? [] : SUIT_RANK_ORDER.map((rank) => card(trump, rank));
  const plainSuitCards = SUITS.filter((suit) => suit !== trump).flatMap((suit) =>
    SUIT_RANK_ORDER.map((rank) => card(suit, rank)),
  );
  return [...JACK_ORDER, ...trumpSuitCards, ...plainSuitCards];
}

/** Display order: trump group first (suit/grand/unknown), or suit-by-suit in Null. */
export function sortHand(cards: readonly CardId[], decl: Declaration | null): CardId[] {
  const order = displayOrder(decl);
  return [...cards].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}
