// Strong level (docs/bots.md §6): Perfect-Information Monte-Carlo card play with heuristic
// rollouts, and a Skat-sampling estimate of the maximum bid.

import { ALL_CARDS, isTrump, mulberry32, rankOf, suitOf, type CardId } from '../../engine';
import { bestGame, declarationFor, evaluateGame, GAME_CHOICES, isSafeNullSuit, type GameChoice } from './evaluate';
import { heuristicCard } from './heuristics';
import type { BotView } from './knowledge';
import { sampleDeal, shuffle } from './sample';
import { playOut, simPlay, type SimOutcome, type SimState } from './simulate';
import {
  MIN_SAMPLES,
  NULL_WIN_SCORE,
  ROLLOUT_BUDGET,
  SAMPLES,
  SCHNEIDER_BONUS,
  SCHWARZ_BONUS,
  SKAT_CONFIDENCE,
  SKAT_SAMPLES,
  WIN_BONUS,
} from './tuning';

/** How good a play-out is for the bot's team (higher is better). */
export function teamScore(view: BotView, outcome: SimOutcome): number {
  const isDeclarer = view.role === view.declarer;
  if (view.declaration?.kind === 'null') {
    const declarerWon = outcome.declarerTricks === 0;
    return declarerWon === isDeclarer ? NULL_WIN_SCORE : 0;
  }
  const pts = outcome.declarerPoints;
  if (isDeclarer) {
    return pts + (pts >= 61 ? WIN_BONUS : 0) + (pts >= 90 ? SCHNEIDER_BONUS : 0) + (outcome.defenderTricks === 0 ? SCHWARZ_BONUS : 0);
  }
  const ours = 120 - pts;
  return ours + (pts <= 60 ? WIN_BONUS : 0) + (pts <= 30 ? SCHNEIDER_BONUS : 0) + (outcome.declarerTricks === 0 ? SCHWARZ_BONUS : 0);
}

export function sampleCount(playable: number): number {
  return Math.max(MIN_SAMPLES, Math.min(SAMPLES, Math.floor(ROLLOUT_BUDGET / Math.max(1, playable))));
}

export function strongCard(view: BotView, rand: () => number, samples = sampleCount(view.playable.length)): CardId {
  // Sampling assumes a declarer; Ramsch has none, so the Normal heuristic plays it.
  if (view.ramsch) return heuristicCard(view);
  const fallback = heuristicCard(view);
  if (view.playable.length <= 1) return fallback;
  const declarer = view.declarer;
  const declaration = view.declaration;
  if (declarer === null || declaration === null) return fallback;
  const worlds: SimState[] = [];
  for (let i = 0; i < samples; i++) {
    const deal = sampleDeal(view, rand);
    worlds.push({
      hands: deal.hands,
      trick: view.trick,
      tricks: view.tricks,
      declarer,
      declaration,
      skat: deal.skat,
      declarerKnowsSkat: view.pickedUpSkat,
      voids: view.voids,
    });
  }
  let best = fallback;
  let bestScore = -Infinity;
  for (const card of view.playable) {
    let total = 0;
    for (const world of worlds) total += teamScore(view, playOut(simPlay(world, view.role, card)));
    const better = total > bestScore || (total === bestScore && card === fallback);
    if (better) {
      best = card;
      bestScore = total;
    }
  }
  return best;
}

/** Cards worth trying to discard: side cards in suit/grand games, unsafe-suit cards in Null. */
function discardCandidates(twelve: readonly CardId[], game: GameChoice): CardId[] {
  if (game === 'null') {
    const unsafe = twelve.filter((c) => !isSafeNullSuit(twelve, suitOf(c)));
    return unsafe.length >= 2 ? unsafe : [...twelve];
  }
  const decl = declarationFor(game, false);
  const mode = decl.kind === 'suit' ? { kind: 'suit' as const, trump: decl.trump } : { kind: 'grand' as const };
  const side = twelve.filter((c) => !isTrump(c, mode));
  return side.length >= 2 ? side : twelve.filter((c) => rankOf(c) !== 'J');
}

/** Highest value of a playable game after a good discard from these 12 cards (0 = none). */
function bestValueWithSkat(twelve: readonly CardId[]): number {
  let best = 0;
  for (const g of GAME_CHOICES) {
    const candidates = discardCandidates(twelve, g);
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i];
        const b = candidates[j];
        if (a === undefined || b === undefined) continue;
        if (g !== 'null' && (rankOf(a) === 'J' || rankOf(b) === 'J')) continue;
        const rest = twelve.filter((c) => c !== a && c !== b);
        const e = evaluateGame(rest, g, { hand: false, final: true, spitzenCards: twelve });
        if (e.playable && e.value > best) best = e.value;
      }
    }
  }
  return best;
}

/** A seed derived from the cards, so the same hand always gives the same estimate. */
function handSeed(hand: readonly CardId[]): number {
  let h = 2166136261;
  for (const c of [...hand].sort().join('')) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

const MAX_BID_CACHE_SIZE = 64;
/** Memo of strongMaxBid by hand: the estimate is a pure function of the 10 cards. */
const maxBidCache = new Map<string, number>();

/** Strong auction limit: a value reached in at least SKAT_CONFIDENCE of the sampled Skats. */
export function strongMaxBid(view: BotView): number {
  const key = [...view.hand].sort().join(' ');
  const cached = maxBidCache.get(key);
  if (cached !== undefined) return cached;
  const value = estimateMaxBid(view.hand);
  if (maxBidCache.size >= MAX_BID_CACHE_SIZE) maxBidCache.clear();
  maxBidCache.set(key, value);
  return value;
}

function estimateMaxBid(hand: readonly CardId[]): number {
  const rand = mulberry32(handSeed(hand));
  const unknown = ALL_CARDS.filter((c) => !hand.includes(c));
  const values: number[] = [];
  for (let i = 0; i < SKAT_SAMPLES; i++) {
    const skat = shuffle(unknown, rand).slice(0, 2);
    values.push(bestValueWithSkat([...hand, ...skat]));
  }
  values.sort((a, b) => b - a);
  const index = Math.max(0, Math.ceil(values.length * SKAT_CONFIDENCE) - 1);
  const sampled = values[index] ?? 0;
  const handGame = bestGame(hand, { hand: true })?.value ?? 0;
  return Math.max(sampled, handGame);
}
