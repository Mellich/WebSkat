import { describe, expect, it } from 'vitest';
import { mulberry32, type CardId, type Declaration, type GameState } from '../../engine';
import { botViewOf } from '../bot/knowledge';
import { heuristicCard } from '../bot/heuristics';
import type { SimOutcome } from '../bot/simulate';
import type { TableState } from '../types';
import { viewFor } from '../view';
import { analysisInputFromView } from './fromView';
import { analysisPolicy, teamWon } from './rollout';
import { bestCard, maxPoints, medianPoints, minPoints, canScore, emptyStats, minSamples, scoreBatch, winRate, type CardStat } from './scores';
import { analysisStart, positionAt } from './replay';
import { worldPoints, worldWon } from './world';
import { finishedTable } from './testing';
import type { AnalysisInput, Position } from './types';

function inputOf(s: TableState): AnalysisInput {
  const input = analysisInputFromView(viewFor(s, 'p0'));
  if (input === null) throw new Error('expected an input');
  return input;
}

function startOf(input: AnalysisInput): GameState {
  const start = analysisStart(input);
  if (!start.ok || start.value === null) throw new Error('expected a start state');
  return start.value;
}

function at(input: AnalysisInput, n: number): Position {
  const pos = positionAt(startOf(input), input.plays.slice(0, n));
  if (!pos.ok) throw new Error(pos.error.message);
  return pos.value;
}

const played = inputOf(finishedTable('played'));

describe('emptyStats and bestCard', () => {
  it('has one zero stat per playable card and nothing sampled yet', () => {
    const pos = at(played, 0);
    const stats = emptyStats(pos);
    expect(stats.map((s) => s.card)).toEqual(pos.playable);
    expect(stats.every((s) => s.samples === 0 && s.wins === 0 && s.points === 0)).toBe(true);
    expect(minSamples(stats)).toBe(0);
    expect(minSamples([])).toBe(0);
    expect(bestCard(stats)).toBeNull();
  });
});

describe('scoreBatch', () => {
  it('adds the samples of every batch to every card', () => {
    const pos = at(played, 0);
    const rand = mulberry32(5);
    const once = scoreBatch(pos, emptyStats(pos), { useRealHands: false, samples: 4 }, rand);
    const twice = scoreBatch(pos, once, { useRealHands: false, samples: 4 }, rand);
    expect(twice).toHaveLength(pos.playable.length);
    for (const stat of twice) {
      expect(stat.samples).toBe(8);
      expect(stat.wins).toBeGreaterThanOrEqual(0);
      expect(stat.wins).toBeLessThanOrEqual(8);
      expect(stat.points).toBeGreaterThanOrEqual(0);
      expect(stat.points).toBeLessThanOrEqual(8 * 120);
    }
    expect(minSamples(twice)).toBe(8);
    expect(winRate(twice[0] as CardStat)).not.toBeNull();
  });

  it('gives the same stats for the same seed', () => {
    const pos = at(played, 0);
    const options = { useRealHands: false, samples: 6 };
    const a = scoreBatch(pos, emptyStats(pos), options, mulberry32(9));
    const b = scoreBatch(pos, emptyStats(pos), options, mulberry32(9));
    expect(b).toEqual(a);
  });

  it('is not changed by cards the mover cannot know (default mode)', () => {
    // Swap one card between the two hidden hands of the players who are not the mover at the first
    // card: the mover's view is the same, so the sampled deals and the stats must be the same.
    // The fixture is an ouvert game (its declarer's hand is open to all), so the test makes it closed.
    const declaration = played.declaration;
    const input: AnalysisInput = declaration === null ? played : { ...played, declaration: { ...declaration, ouvert: false } };
    const start = startOf(input);
    const pos = at(input, 0);
    if (pos.mover === null) throw new Error('no mover');
    const others = (['middlehand', 'hindhand'] as const).filter((r) => r !== pos.mover);
    const [first, second] = others;
    if (first === undefined || second === undefined) throw new Error('roles');
    const a = start.hands[first][0];
    const b = start.hands[second][0];
    if (a === undefined || b === undefined) throw new Error('no cards');
    const swapped = {
      ...start.hands,
      [first]: start.hands[first].map((c: CardId) => (c === a ? b : c)),
      [second]: start.hands[second].map((c: CardId) => (c === b ? a : c)),
    };
    const alt = positionAt({ ...start, hands: swapped }, []);
    if (!alt.ok) throw new Error(alt.error.message);
    const options = { useRealHands: false, samples: 8 };
    const original = scoreBatch(pos, emptyStats(pos), options, mulberry32(3));
    const changed = scoreBatch(alt.value, emptyStats(alt.value), options, mulberry32(3));
    expect(changed).toEqual(original);
  });

  it('scores the last card with the real hands like the engine result', () => {
    // The first card of the last trick: the mover has exactly one card left, so one play-out remains.
    const pos = at(played, 27);
    expect(pos.playable).toHaveLength(1);
    const [stat] = scoreBatch(pos, emptyStats(pos), { useRealHands: true, samples: 4 }, mulberry32(1));
    if (stat === undefined) throw new Error('no stat');
    const end = positionAt(startOf(played), played.plays);
    if (!end.ok || end.value.result?.kind !== 'played') throw new Error('expected a played result');
    const declarerSide = pos.mover === end.value.result.declarer;
    const won = declarerSide ? end.value.result.playedWon : !end.value.result.playedWon;
    expect(stat.samples).toBe(4);
    expect(stat.wins).toBe(won ? 4 : 0);
  });

  it('does not score a Ramsch or a finished position', () => {
    const ramsch = inputOf(finishedTable('ramsch'));
    const pos = at(ramsch, 0);
    expect(canScore(pos)).toBe(false);
    const stats = emptyStats(pos);
    expect(scoreBatch(pos, stats, { useRealHands: false, samples: 4 }, mulberry32(2))).toBe(stats);
    const end = at(played, played.plays.length);
    expect(canScore(end)).toBe(false);
  });

  it('can score the first card of a played game', () => {
    expect(canScore(at(played, 0))).toBe(true);
  });
});

describe('teamWon', () => {
  const suit = (announce: 'none' | 'schneider' | 'schwarz', ouvert = false): Declaration => ({
    kind: 'suit',
    trump: 'C',
    hand: false,
    announce,
    ouvert,
  });
  const outcome = (declarerPoints: number, declarerTricks: number, defenderTricks: number): SimOutcome => ({
    declarerPoints,
    declarerTricks,
    defenderTricks,
  });

  it('needs 61 card points for a suit game', () => {
    expect(teamWon(suit('none'), outcome(61, 6, 4), true)).toBe(true);
    expect(teamWon(suit('none'), outcome(60, 6, 4), true)).toBe(false);
    expect(teamWon(suit('none'), outcome(60, 6, 4), false)).toBe(true);
    expect(teamWon(suit('none'), outcome(61, 6, 4), false)).toBe(false);
  });

  it('needs 90 points when Schneider was announced', () => {
    expect(teamWon(suit('schneider'), outcome(89, 7, 3), true)).toBe(false);
    expect(teamWon(suit('schneider'), outcome(90, 7, 3), true)).toBe(true);
  });

  it('needs no defender trick when Schwarz was announced or the game is ouvert', () => {
    expect(teamWon(suit('schwarz'), outcome(90, 9, 1), true)).toBe(false);
    expect(teamWon(suit('schwarz'), outcome(120, 10, 0), true)).toBe(true);
    expect(teamWon(suit('none', true), outcome(80, 9, 1), true)).toBe(false);
    expect(teamWon(suit('none', true), outcome(80, 10, 0), true)).toBe(true);
  });

  it('wins a Null game when the declarer takes no trick', () => {
    const nullGame: Declaration = { kind: 'null', hand: false, ouvert: false };
    expect(teamWon(nullGame, outcome(0, 0, 10), true)).toBe(true);
    expect(teamWon(nullGame, outcome(0, 1, 9), true)).toBe(false);
    expect(teamWon(nullGame, outcome(0, 1, 9), false)).toBe(true);
    expect(teamWon(nullGame, outcome(0, 0, 10), false)).toBe(false);
  });
});

describe('analysisPolicy', () => {
  it('plays the Normal heuristic when the random step does not fire', () => {
    const view = botViewOf(at(played, 0).state, 'forehand');
    expect(analysisPolicy(() => 0.99)(view)).toBe(heuristicCard(view));
  });

  it('plays a random legal card when the random step fires', () => {
    const view = botViewOf(at(played, 0).state, 'forehand');
    expect(analysisPolicy(() => 0)(view)).toBe(view.playable[0]);
  });
});

describe('point distribution', () => {
  const stat = (histogram: Record<number, number>): CardStat => {
    const h = new Array<number>(121).fill(0);
    for (const [p, n] of Object.entries(histogram)) h[Number(p)] = n;
    const samples = Object.values(histogram).reduce((a, b) => a + b, 0);
    return { card: 'C7', samples, wins: 0, points: 0, histogram: h, worlds: [] };
  };

  it('gives min, max and median', () => {
    const odd = stat({ 10: 1, 40: 1, 90: 1 });
    expect([minPoints(odd), medianPoints(odd), maxPoints(odd)]).toEqual([10, 40, 90]);
    expect(medianPoints(stat({ 10: 1, 40: 1 }))).toBe(25);
  });

  it('is null before the first sample', () => {
    const none = stat({});
    expect([minPoints(none), medianPoints(none), maxPoints(none)]).toEqual([null, null, null]);
  });

  it('picks the best card by the criterion', () => {
    const steady: CardStat = { ...stat({ 50: 4 }), card: 'C8' };
    const risky: CardStat = { ...stat({ 0: 2, 100: 2 }), card: 'C9' };
    expect(bestCard([steady, risky], 'min')).toBe('C8');
    expect(bestCard([steady, risky], 'max')).toBe('C9');
  });
});

describe('scoreBatch worlds', () => {
  it('records one result per world for every card, aligned across batches', () => {
    const pos = at(played, 0);
    const rand = mulberry32(11);
    const once = scoreBatch(pos, emptyStats(pos), { useRealHands: false, samples: 3 }, rand);
    const twice = scoreBatch(pos, once, { useRealHands: false, samples: 2 }, rand);
    for (const stat of twice) {
      expect(stat.worlds).toHaveLength(5);
      expect(stat.worlds.filter(worldWon)).toHaveLength(stat.wins);
      expect(stat.worlds.reduce((sum, w) => sum + worldPoints(w), 0)).toBe(stat.points);
    }
  });

  it('samples only the listed cards when `cards` is given', () => {
    const pos = at(played, 0);
    const [first, ...others] = pos.playable;
    if (first === undefined) throw new Error('expected playable cards');
    const rand = mulberry32(13);
    const once = scoreBatch(pos, emptyStats(pos), { useRealHands: false, samples: 4 }, rand);
    const twice = scoreBatch(pos, once, { useRealHands: false, samples: 4, cards: [first] }, rand);
    expect(twice.find((s) => s.card === first)?.samples).toBe(8);
    expect(twice.find((s) => s.card === first)?.worlds).toHaveLength(8);
    for (const card of others) expect(twice.find((s) => s.card === card)).toEqual(once.find((s) => s.card === card));
  });

  it('uses the rollout epsilon of the options: 0 makes real-hand play-outs identical, 1 makes them vary', () => {
    const pos = at(played, 0);
    const distinct = (epsilon: number): number => {
      const stats = scoreBatch(pos, emptyStats(pos), { useRealHands: true, samples: 30, epsilon }, mulberry32(21));
      return Math.max(...stats.map((s) => new Set(s.worlds).size));
    };
    expect(distinct(0)).toBe(1);
    expect(distinct(1)).toBeGreaterThan(1);
  });
});
