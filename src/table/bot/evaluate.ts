// Hand evaluation for bidding, Skat and declaring (docs/bots.md §4.1–4.2).

import {
  countSpitzen,
  declarationFloorValue,
  modeOf,
  nullValue,
  rankOf,
  suitOf,
  SUITS,
  type CardId,
  type Declaration,
  type Rank,
  type Suit,
} from '../../engine';
import {
  FOUR_TRUMP_PENALTY,
  GRAND_ACE,
  GRAND_MIN,
  GRAND_MIN_HAND,
  JACK_WEIGHT,
  SIDE_ACE,
  SIDE_TEN_GUARDED,
  SIDE_TEN_WITH_ACE,
  SUIT_MIN,
  SUIT_MIN_HAND,
  TRUMP_ACE,
  TRUMP_OTHER,
  TRUMP_TEN,
  VOID_BONUS,
} from './tuning';

export type GameChoice = Suit | 'grand' | 'null';
export const GAME_CHOICES: readonly GameChoice[] = ['grand', 'C', 'S', 'H', 'D', 'null'];

export interface Evaluation {
  readonly game: GameChoice;
  readonly playable: boolean;
  /** score − threshold: comparable between game types, > 0 roughly means "playable". */
  readonly margin: number;
  /** Value of the game if won without announcements. */
  readonly value: number;
}

/**
 * `final`: the 10 cards are the cards the game is played with (after discarding). Otherwise
 * the Skat may still be picked up (only matters for Null).
 */
export interface EvalOptions {
  readonly hand: boolean;
  readonly final?: boolean;
  /** Cards used for counting Spitzen (default: `cards`). */
  readonly spitzenCards?: readonly CardId[];
}

const NULL_INDEX: Readonly<Record<Rank, number>> = { '7': 0, '8': 1, '9': 2, '10': 3, J: 4, Q: 5, K: 6, A: 7 };

export function declarationFor(game: GameChoice, hand: boolean): Declaration {
  if (game === 'null') return { kind: 'null', hand, ouvert: false };
  if (game === 'grand') return { kind: 'grand', hand, announce: 'none', ouvert: false };
  return { kind: 'suit', trump: game, hand, announce: 'none', ouvert: false };
}

function sideSuitScore(cards: readonly CardId[], suit: Suit, withVoidBonus: boolean): number {
  const inSuit = cards.filter((c) => suitOf(c) === suit && rankOf(c) !== 'J');
  if (inSuit.length === 0) return withVoidBonus ? VOID_BONUS : 0;
  const ranks = inSuit.map(rankOf);
  let score = 0;
  if (ranks.includes('A')) score += SIDE_ACE;
  if (ranks.includes('10')) {
    if (ranks.includes('A')) score += SIDE_TEN_WITH_ACE;
    else if (inSuit.length >= 2) score += SIDE_TEN_GUARDED;
  }
  return score;
}

function jackScore(cards: readonly CardId[]): number {
  return cards
    .filter((c) => rankOf(c) === 'J')
    .reduce((sum, c) => sum + JACK_WEIGHT[suitOf(c)], 0);
}

function suitEval(cards: readonly CardId[], trump: Suit, opts: EvalOptions): Evaluation {
  const trumps = cards.filter((c) => rankOf(c) === 'J' || suitOf(c) === trump);
  let score = jackScore(cards);
  for (const c of trumps) {
    const rank = rankOf(c);
    if (rank === 'J') continue;
    score += rank === 'A' ? TRUMP_ACE : rank === '10' ? TRUMP_TEN : TRUMP_OTHER;
  }
  for (const side of SUITS) {
    if (side !== trump) score += sideSuitScore(cards, side, trumps.length >= 5);
  }
  const min = (opts.hand ? SUIT_MIN_HAND : SUIT_MIN) + (trumps.length === 4 ? FOUR_TRUMP_PENALTY : 0);
  const playable = trumps.length >= 4 && score >= min;
  return { game: trump, playable, margin: trumps.length < 4 ? score - min - 5 : score - min, value: valueOf(trump, cards, opts) };
}

function grandEval(cards: readonly CardId[], opts: EvalOptions): Evaluation {
  let score = jackScore(cards);
  for (const suit of SUITS) {
    const ranks = cards.filter((c) => suitOf(c) === suit && rankOf(c) !== 'J').map(rankOf);
    if (ranks.includes('A')) score += GRAND_ACE;
    if (ranks.includes('10')) {
      if (ranks.includes('A')) score += SIDE_TEN_WITH_ACE;
      else if (ranks.length >= 2) score += SIDE_TEN_GUARDED;
    }
  }
  const jacks = cards.filter((c) => rankOf(c) === 'J').length;
  const enoughJacks = jacks >= 3 || (jacks === 2 && cards.includes('CJ'));
  const min = opts.hand ? GRAND_MIN_HAND : GRAND_MIN;
  return {
    game: 'grand',
    playable: enoughJacks && score >= min,
    margin: enoughJacks ? score - min : score - min - 5,
    value: valueOf('grand', cards, opts),
  };
}

/** Null rank indices of the cards of one suit (Jacks belong to their suit), ascending. */
function nullIndices(cards: readonly CardId[], suit: Suit): number[] {
  return cards.filter((c) => suitOf(c) === suit).map((c) => NULL_INDEX[rankOf(c)]).sort((a, b) => a - b);
}

export function isSafeNullSuit(cards: readonly CardId[], suit: Suit): boolean {
  return nullIndices(cards, suit).every((idx, k) => idx <= 2 * k);
}

export function isPerfectNullSuit(cards: readonly CardId[], suit: Suit): boolean {
  return nullIndices(cards, suit).every((idx, k) => idx <= k);
}

function nullEval(cards: readonly CardId[], opts: EvalOptions): Evaluation {
  const unsafe = SUITS.filter((s) => !isSafeNullSuit(cards, s));
  const perfect = SUITS.filter((s) => isPerfectNullSuit(cards, s)).length;
  const strict = opts.hand || opts.final === true;
  const unsafeCards = unsafe.reduce((n, s) => n + cards.filter((c) => suitOf(c) === s).length, 0);
  const playable = strict ? unsafe.length === 0 : unsafe.length === 0 || (unsafe.length === 1 && unsafeCards <= 2);
  const margin = playable ? 1 + perfect * 0.5 - (unsafe.length > 0 ? 0.5 : 0) : -2 * unsafe.length - unsafeCards * 0.5;
  return { game: 'null', playable, margin, value: nullValue({ hand: opts.hand, ouvert: false }) };
}

function valueOf(game: GameChoice, cards: readonly CardId[], opts: EvalOptions): number {
  const decl = declarationFor(game, opts.hand);
  const spitzen = countSpitzen(opts.spitzenCards ?? cards, modeOf(decl));
  return declarationFloorValue(decl, spitzen?.count ?? null);
}

export function evaluateGame(cards: readonly CardId[], game: GameChoice, opts: EvalOptions): Evaluation {
  if (game === 'null') return nullEval(cards, opts);
  if (game === 'grand') return grandEval(cards, opts);
  return suitEval(cards, game, opts);
}

const GAME_ORDER: Readonly<Record<GameChoice, number>> = { grand: 0, C: 1, S: 2, H: 3, D: 4, null: 5 };

/** The playable game with the highest value (ties: margin, then grand > C > S > H > D > null). */
export function bestGame(cards: readonly CardId[], opts: EvalOptions): Evaluation | null {
  const playable = GAME_CHOICES.map((g) => evaluateGame(cards, g, opts)).filter((e) => e.playable);
  playable.sort((a, b) => b.value - a.value || b.margin - a.margin || GAME_ORDER[a.game] - GAME_ORDER[b.game]);
  return playable[0] ?? null;
}

/** Highest value the bot is willing to bid with these 10 cards (0 = nothing playable). */
export function maxBidOf(cards: readonly CardId[]): number {
  const pickup = bestGame(cards, { hand: false })?.value ?? 0;
  const hand = bestGame(cards, { hand: true })?.value ?? 0;
  return Math.max(pickup, hand);
}
