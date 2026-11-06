import { describe, expect, it } from 'vitest';
import { mulberry32, shuffle } from './rng';

const SAMPLE = Array.from({ length: 32 }, (_, i) => i);

describe('mulberry32', () => {
  it('returns floats in [0, 1)', () => {
    const next = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('gives different streams for different seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('shuffle', () => {
  it('is deterministic for the same seed', () => {
    expect(shuffle(SAMPLE, 99)).toEqual(shuffle(SAMPLE, 99));
  });

  it('returns a permutation of the input', () => {
    const result = shuffle(SAMPLE, 12345);
    expect(result).toHaveLength(SAMPLE.length);
    expect([...result].sort((a, b) => a - b)).toEqual(SAMPLE);
  });

  it('gives different orders for different seeds', () => {
    expect(shuffle(SAMPLE, 1)).not.toEqual(shuffle(SAMPLE, 2));
  });

  it('does not mutate its input', () => {
    const input = [...SAMPLE];
    shuffle(input, 5);
    expect(input).toEqual(SAMPLE);
  });
});
