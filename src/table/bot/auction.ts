// Normal/Strong auction, Skat decision, discard and declaration (docs/bots.md §4.3–4.4).

import {
  declarationFloorValue,
  modeOf,
  countSpitzen,
  rankOf,
  sumPoints,
  suitOf,
  SUITS,
  type CardId,
  type Declaration,
  type GameAction,
} from '../../engine';
import {
  bestGame,
  declarationFor,
  evaluateGame,
  GAME_CHOICES,
  isPerfectNullSuit,
  isSafeNullSuit,
  type Evaluation,
  type GameChoice,
} from './evaluate';
import type { BotView } from './knowledge';
import { DISCARD_POINTS_WEIGHT } from './tuning';

/** Bid, hold, claim or pass, never above `maxBid`. */
export function auctionAction(view: BotView, maxBid: number): GameAction {
  const legal = view.legal;
  const next = legal.bidValues?.[0];
  if (next !== undefined) return next <= maxBid ? { type: 'bid', value: next } : { type: 'pass' };
  if (legal.canHold === true) {
    const current = view.bidding.currentBid ?? 0;
    return current <= maxBid ? { type: 'hold' } : { type: 'pass' };
  }
  if (legal.canClaim === true) return maxBid >= 18 ? { type: 'claim' } : { type: 'pass' };
  return { type: 'pass' };
}

export function skatDecision(view: BotView): GameAction {
  const best = bestGame(view.hand, { hand: true });
  return best !== null && best.value >= (view.bid ?? 0) ? { type: 'play-hand' } : { type: 'pickup-skat' };
}

interface DiscardChoice {
  readonly cards: readonly [CardId, CardId];
  readonly game: Evaluation;
  readonly rank: number;
}

function allowedDiscard(pair: readonly [CardId, CardId], game: GameChoice): boolean {
  return game === 'null' || pair.every((c) => rankOf(c) !== 'J');
}

function nullDiscardBonus(rest: readonly CardId[], pair: readonly [CardId, CardId]): number {
  // Prefer putting away the highest cards of suits that stay unsafe in Null.
  return pair.reduce((n, c) => n + (isSafeNullSuit(rest, suitOf(c)) ? 0 : 0.1), 0);
}

/** Best two cards to discard from 12 and the game they are meant for. */
export function chooseDiscard(twelve: readonly CardId[], bid: number): DiscardChoice {
  const choices: DiscardChoice[] = [];
  for (let i = 0; i < twelve.length; i++) {
    for (let j = i + 1; j < twelve.length; j++) {
      const a = twelve[i];
      const b = twelve[j];
      if (a === undefined || b === undefined) continue;
      const pair: [CardId, CardId] = [a, b];
      const rest = twelve.filter((c) => c !== a && c !== b);
      for (const g of GAME_CHOICES) {
        if (!allowedDiscard(pair, g)) continue;
        const game = evaluateGame(rest, g, { hand: false, final: true, spitzenCards: twelve });
        const bonus = g === 'null' ? nullDiscardBonus(rest, pair) : DISCARD_POINTS_WEIGHT * sumPoints(pair);
        const reachesBid = game.value >= bid ? 100 : 0;
        const playable = game.playable ? 50 : 0;
        choices.push({ cards: pair, game, rank: reachesBid + playable + game.margin + bonus });
      }
    }
  }
  choices.sort((x, y) => y.rank - x.rank);
  const best = choices[0];
  if (best === undefined) throw new Error('no discard possible');
  return best;
}

export function discardAction(view: BotView): GameAction {
  return { type: 'discard', cards: chooseDiscard(view.hand, view.bid ?? 18).cards };
}

function sameDeclaration(a: Declaration, b: Declaration): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The game to declare: the safest one that reaches the bid, else the most valuable one. */
export function chooseGame(view: BotView): Declaration {
  const hand = !view.pickedUpSkat;
  const spitzenCards = [...view.hand, ...view.ownDiscard];
  const bid = view.bid ?? 18;
  const evals = GAME_CHOICES.map((g) => evaluateGame(view.hand, g, { hand, final: true, spitzenCards }));
  const reaching = evals.filter((e) => e.value >= bid);
  const pool = reaching.length > 0 ? reaching : evals;
  pool.sort((a, b) => (reaching.length > 0 ? b.margin - a.margin : b.value - a.value || b.margin - a.margin));
  const game = pool[0]?.game ?? 'grand';
  if (game === 'null' && hand && SUITS.every((s) => isPerfectNullSuit(view.hand, s))) {
    return { kind: 'null', hand: true, ouvert: true };
  }
  return declarationFor(game, hand);
}

export function declareAction(view: BotView): GameAction {
  const wanted = chooseGame(view);
  const options = view.legal.declarations ?? [];
  const found = options.find((d) => sameDeclaration(d, wanted)) ?? options[0];
  if (found === undefined) throw new Error('no declaration offered');
  return { type: 'declare', declaration: found };
}

/** Floor value of a declaration for these cards (used by tests and the strong auction). */
export function floorValue(decl: Declaration, twelve: readonly CardId[]): number {
  return declarationFloorValue(decl, countSpitzen(twelve, modeOf(decl))?.count ?? null);
}
