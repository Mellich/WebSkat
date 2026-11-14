import { describe, expect, it } from 'vitest';
import { mulberry32, type CardId } from '../../engine';
import { bestCards, pairedDifference } from './compare';
import { encodeWorld, worldPoints, worldWon } from './world';
import type { CardStat } from './scores';

function statOf(card: CardId, worlds: readonly number[]): CardStat {
  const wins = worlds.filter(worldWon).length;
  const points = worlds.reduce((sum, w) => sum + worldPoints(w), 0);
  return { card, samples: worlds.length, wins, points, histogram: [], worlds };
}

/** `n` worlds; world i is won when `won(i)`, with `points(i)` card points. */
function worldsOf(n: number, won: (i: number) => boolean, points: (i: number) => number = () => 60): number[] {
  return Array.from({ length: n }, (_, i) => encodeWorld(won(i), points(i)));
}

describe('encodeWorld', () => {
  it('round-trips the win flag and the card points', () => {
    for (const won of [true, false]) {
      for (const p of [0, 1, 61, 120]) {
        const w = encodeWorld(won, p);
        expect(worldWon(w)).toBe(won);
        expect(worldPoints(w)).toBe(p);
      }
    }
  });
});

describe('pairedDifference', () => {
  it('is the mean and standard error of the per-world difference', () => {
    const a = statOf('SA', worldsOf(4, (i) => i < 3));
    const b = statOf('S10', worldsOf(4, (i) => i < 1));
    const d = pairedDifference(a, b, 'win');
    expect(d.n).toBe(4);
    expect(d.mean).toBeCloseTo(0.5);
    // differences 0,1,1,0: sample variance 1/3, se = sqrt(1/3 / 4)
    expect(d.se).toBeCloseTo(Math.sqrt(1 / 12));
  });

  it('measures card points when asked', () => {
    const a = statOf('SA', worldsOf(2, () => true, () => 70));
    const b = statOf('S10', worldsOf(2, () => true, () => 60));
    expect(pairedDifference(a, b, 'points')).toEqual({ n: 2, mean: 10, se: 0 });
  });

  it('uses the common worlds when the lengths differ', () => {
    const a = statOf('SA', worldsOf(5, () => true));
    const b = statOf('S10', worldsOf(3, () => false));
    expect(pairedDifference(a, b, 'win').n).toBe(3);
  });
});

describe('bestCards', () => {
  it('is empty before any sample', () => {
    expect(bestCards([statOf('SA', []), statOf('S10', [])], 'win')).toEqual([]);
  });

  it('names one card when the others are clearly worse', () => {
    const good = statOf('SA', worldsOf(400, () => true));
    const bad = statOf('S10', worldsOf(400, () => false));
    expect(bestCards([bad, good], 'win')).toEqual(['SA']);
  });

  it('keeps cards whose gap is within the noise, best first', () => {
    const rand = mulberry32(3);
    const base = Array.from({ length: 200 }, () => rand() < 0.7);
    const a = statOf('SA', worldsOf(200, (i) => base[i] === true));
    const b = statOf('S10', worldsOf(200, (i) => base[i] === true || i === 0)); // one world better
    const c = statOf('S9', worldsOf(200, () => false));
    expect(bestCards([c, a, b], 'win')).toEqual(['S10', 'SA']);
  });

  it('does not separate cards with too few samples', () => {
    const a = statOf('SA', worldsOf(3, (i) => i === 0));
    const b = statOf('S10', worldsOf(3, () => false));
    expect(bestCards([a, b], 'win')).toEqual(['SA', 'S10']); // 1 win in 3 vs 0: well within the noise
  });

  it('compares card points for the points criteria', () => {
    const a = statOf('SA', worldsOf(100, () => true, (i) => 60 + (i % 3)));
    const b = statOf('S10', worldsOf(100, () => true, (i) => 50 + (i % 3)));
    expect(bestCards([b, a], 'average')).toEqual(['SA']);
    expect(bestCards([b, a], 'win')).toEqual(['SA', 'S10']); // same win rate: tied on win
  });
});
