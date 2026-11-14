// Monte-Carlo card scores of the game analysis (docs/table.md "Game analysis", docs/bots.md §6).
// Every playable card is played in the same sampled worlds, so the cards are compared fairly.

import { assertNever, type CardId, type Declaration, type GameState, type Role } from '../../engine';
import { botViewOf } from '../bot/knowledge';
import { sampleDeal } from '../bot/sample';
import { playOut, simPlay, type SimState } from '../bot/simulate';
import { analysisPolicy, teamPoints, teamWon } from './rollout';
import { SAMPLES_PER_BATCH } from './tuning';
import { encodeWorld } from './world';
import type { Position } from './types';

export interface CardStat {
  readonly card: CardId;
  readonly samples: number;
  readonly wins: number; // play-outs the mover's team won
  readonly points: number; // sum of the mover's team card points over all samples
  readonly histogram: readonly number[]; // histogram[p] = play-outs in which the mover's team got p card points
  readonly worlds: readonly number[]; // result per sampled world (`world.ts`); the same index is the same deal for every card
}

/** What "best card" is measured by (first), the others break ties in the order of `CRITERIA`. */
export type ScoreCriterion = 'win' | 'average' | 'median' | 'max' | 'min';
export const CRITERIA: readonly ScoreCriterion[] = ['win', 'average', 'median', 'max', 'min'];

const POINT_VALUES = 121; // 0..120 card points

export interface ScoreOptions {
  readonly useRealHands: boolean;
  readonly samples?: number; // worlds in this batch (default SAMPLES_PER_BATCH)
  readonly epsilon?: number; // share of random moves in the play-outs (default ROLLOUT_EPSILON)
  readonly cards?: readonly CardId[]; // sample only these cards (default all); the others stay as they are
}

interface Scorable {
  readonly state: GameState;
  readonly mover: Role;
  readonly declarer: Role;
  readonly declaration: Declaration;
}

/** The parts of a position that scoring needs; null for Ramsch, passed-in and finished positions. */
function scorableOf(position: Position): Scorable | null {
  const { state, mover } = position;
  if (mover === null || state.ramsch || state.declarer === null || state.declaration === null) return null;
  return { state, mover, declarer: state.declarer, declaration: state.declaration };
}

/** True when the position can be scored: a played (not Ramsch) game with a player to move. */
export function canScore(position: Position): boolean {
  return scorableOf(position) !== null;
}

/** One zeroed stat per playable card, in the order of `position.playable`. */
export function emptyStats(position: Position): readonly CardStat[] {
  return position.playable.map((card) => ({ card, samples: 0, wins: 0, points: 0, histogram: new Array<number>(POINT_VALUES).fill(0), worlds: [] }));
}

/** The real deal of the game as it is now (only for `useRealHands`). */
function realDeal(state: GameState): { hands: GameState['hands']; skat: readonly CardId[] } {
  return { hands: state.hands, skat: state.pickedUpSkat ? state.discarded : state.skat };
}

/** Adds `options.samples` worlds to every stat (returns new stats; `stats` must match the position). */
export function scoreBatch(
  position: Position,
  stats: readonly CardStat[],
  options: ScoreOptions,
  rand: () => number,
): readonly CardStat[] {
  const scorable = scorableOf(position);
  if (scorable === null) return stats;
  const { state, mover, declarer, declaration } = scorable;
  const view = botViewOf(state, mover);
  const pick = analysisPolicy(rand, options.epsilon);
  const worlds: SimState[] = [];
  for (let i = 0; i < (options.samples ?? SAMPLES_PER_BATCH); i++) {
    const deal = options.useRealHands ? realDeal(state) : sampleDeal(view, rand);
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
  const moverIsDeclarer = mover === declarer;
  return stats.map((stat) => {
    if (options.cards !== undefined && !options.cards.includes(stat.card)) return stat;
    let wins = 0;
    let points = 0;
    const results: number[] = [];
    const histogram = stat.histogram.length === POINT_VALUES ? [...stat.histogram] : new Array<number>(POINT_VALUES).fill(0);
    for (const world of worlds) {
      const outcome = playOut(simPlay(world, mover, stat.card), pick);
      const won = teamWon(declaration, outcome, moverIsDeclarer);
      if (won) wins++;
      const got = teamPoints(outcome, moverIsDeclarer);
      points += got;
      histogram[got] = (histogram[got] ?? 0) + 1;
      results.push(encodeWorld(won, got));
    }
    return {
      ...stat,
      samples: stat.samples + worlds.length,
      wins: stat.wins + wins,
      points: stat.points + points,
      histogram,
      worlds: stat.worlds.length === stat.samples ? [...stat.worlds, ...results] : results,
    };
  });
}

/** The largest sample count over all cards (0 for no cards): how far the cards that are still sampled are. */
export function maxSamples(stats: readonly CardStat[]): number {
  return stats.reduce((most, s) => Math.max(most, s.samples), 0);
}

/** Share of sampled play-outs the mover's team won; null before the first sample. */
export function winRate(stat: CardStat): number | null {
  return stat.samples === 0 ? null : stat.wins / stat.samples;
}

/** Average card points of the mover's team; null before the first sample. */
export function averagePoints(stat: CardStat): number | null {
  return stat.samples === 0 ? null : stat.points / stat.samples;
}

/** The smallest sample count over all cards (0 for no cards). */
export function minSamples(stats: readonly CardStat[]): number {
  if (stats.length === 0) return 0;
  return Math.min(...stats.map((s) => s.samples));
}

/** Smallest card points seen; null before the first sample. */
export function minPoints(stat: CardStat): number | null {
  const index = stat.histogram.findIndex((n) => n > 0);
  return index < 0 ? null : index;
}

/** Largest card points seen; null before the first sample. */
export function maxPoints(stat: CardStat): number | null {
  for (let p = stat.histogram.length - 1; p >= 0; p--) {
    if ((stat.histogram[p] ?? 0) > 0) return p;
  }
  return null;
}

/** The value at the 0-based rank `rank` of the sorted samples. */
function valueAtRank(histogram: readonly number[], rank: number): number {
  let seen = 0;
  for (let p = 0; p < histogram.length; p++) {
    seen += histogram[p] ?? 0;
    if (rank < seen) return p;
  }
  return 0;
}

/** Median card points (mean of the two middle samples when even); null before the first sample. */
export function medianPoints(stat: CardStat): number | null {
  const total = stat.histogram.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const low = valueAtRank(stat.histogram, Math.floor((total - 1) / 2));
  const high = valueAtRank(stat.histogram, Math.floor(total / 2));
  return (low + high) / 2;
}

function valueOf(stat: CardStat, criterion: ScoreCriterion): number {
  switch (criterion) {
    case 'win': return winRate(stat) ?? -1;
    case 'average': return averagePoints(stat) ?? -1;
    case 'median': return medianPoints(stat) ?? -1;
    case 'max': return maxPoints(stat) ?? -1;
    case 'min': return minPoints(stat) ?? -1;
    default: return assertNever(criterion);
  }
}

/** Negative when `a` is better than `b`: by `criterion`, then by the other criteria in order. */
export function compareStats(a: CardStat, b: CardStat, criterion: ScoreCriterion): number {
  for (const c of [criterion, ...CRITERIA.filter((x) => x !== criterion)]) {
    const diff = valueOf(b, c) - valueOf(a, c);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Best card by `criterion` (default win rate); null when nothing is sampled yet. */
export function bestCard(stats: readonly CardStat[], criterion: ScoreCriterion = 'win'): CardId | null {
  let best: CardStat | null = null;
  for (const stat of stats) {
    if (stat.samples === 0) continue;
    if (best === null || compareStats(stat, best, criterion) < 0) best = stat;
  }
  return best?.card ?? null;
}
