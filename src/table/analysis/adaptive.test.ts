import { describe, expect, it } from 'vitest';
import type { CardId } from '../../engine';
import { activeCards } from './adaptive';
import type { CardStat } from './scores';
import { encodeWorld, worldPoints, worldWon } from './world';
import { MAX_SAMPLES_PER_CARD, MIN_SAMPLES_TO_ELIMINATE } from './tuning';

/** A stat with `n` worlds; world i is won when `won(i)`, points `points(i)`. */
function statOf(card: CardId, n: number, won: (i: number) => boolean, points: (i: number) => number = () => 60): CardStat {
  const worlds = Array.from({ length: n }, (_, i) => encodeWorld(won(i), points(i)));
  return {
    card,
    samples: n,
    wins: worlds.filter(worldWon).length,
    points: worlds.reduce((sum, w) => sum + worldPoints(w), 0),
    histogram: [],
    worlds,
  };
}

const N = MIN_SAMPLES_TO_ELIMINATE;
const noisy = (rate: number) => (i: number) => (i * 7919) % 100 < rate * 100; // deterministic mix

describe('activeCards', () => {
  it('samples every card before the minimum sample count', () => {
    const stats = [statOf('SA', N - 8, () => true), statOf('S10', N - 8, () => false)];
    expect(activeCards(stats, true)).toEqual(['SA', 'S10']);
  });

  it('drops a card that is clearly worse in win rate and in points', () => {
    const stats = [
      statOf('SA', N, noisy(0.7), (i) => 60 + (i % 5)),
      statOf('S10', N, noisy(0.7), (i) => 60 + (i % 5)),
      statOf('S9', N, () => false, () => 20),
    ];
    expect(activeCards(stats, true)).toEqual(['SA', 'S10']);
  });

  it('keeps a card that is worse in win rate but not in points while points matter', () => {
    const stats = [
      statOf('SA', N, () => true, (i) => 60 + (i % 2)),
      statOf('S10', N, noisy(0.7), (i) => 60 + (i % 2) * (i % 3)), // fewer wins, similar points
    ];
    expect(activeCards(stats, false)).toEqual([]); // win rate alone is clear
    expect(activeCards(stats, true)).toEqual(['SA', 'S10']);
  });

  it('is finished (empty) when one card is clearly the best', () => {
    const stats = [statOf('SA', N, () => true, () => 80), statOf('S10', N, () => false, () => 20)];
    expect(activeCards(stats, true)).toEqual([]);
  });

  it('never resumes a card that fell behind the others', () => {
    const stats = [
      statOf('SA', N + 8, noisy(0.7)),
      statOf('S10', N + 8, noisy(0.7)),
      statOf('S9', N, () => false), // dropped in an earlier batch
    ];
    expect(activeCards(stats, false)).toEqual(['SA', 'S10']);
  });

  it('is finished at the maximum sample count', () => {
    const stats = [statOf('SA', MAX_SAMPLES_PER_CARD, noisy(0.7)), statOf('S10', MAX_SAMPLES_PER_CARD, noisy(0.7))];
    expect(activeCards(stats, true)).toEqual([]);
  });

  it('keeps sampling a single playable card up to the maximum', () => {
    expect(activeCards([statOf('SA', N * 2, noisy(0.5))], true)).toEqual(['SA']);
    expect(activeCards([statOf('SA', MAX_SAMPLES_PER_CARD, noisy(0.5))], true)).toEqual([]);
  });

  it('is empty without cards', () => {
    expect(activeCards([], true)).toEqual([]);
  });
});
