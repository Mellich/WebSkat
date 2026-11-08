import { describe, expect, it } from 'vitest';
import { ALL_CARDS, sumPoints } from './cards';
import { deal } from './deck';
import { shuffle } from './rng';

describe('deal', () => {
  it.each([1, 42, 123456, 4294967295])('deals 10/10/10 and 2 Skat, all 32 cards unique (seed %i)', (seed) => {
    const { hands, skat } = deal(seed);
    expect(hands.forehand).toHaveLength(10);
    expect(hands.middlehand).toHaveLength(10);
    expect(hands.hindhand).toHaveLength(10);
    expect(skat).toHaveLength(2);
    const all = [...hands.forehand, ...hands.middlehand, ...hands.hindhand, ...skat];
    expect(new Set(all).size).toBe(32);
    expect([...all].sort()).toEqual([...ALL_CARDS].sort());
  });

  it('is deterministic for the same seed', () => {
    expect(deal(77)).toEqual(deal(77));
  });

  it('deals in the documented index order (skat-rules §3)', () => {
    const deck = shuffle(ALL_CARDS, 2024);
    const { hands, skat } = deal(2024);
    expect(skat).toEqual(deck.slice(9, 11));
    expect(hands.forehand).toEqual([...deck.slice(0, 3), ...deck.slice(11, 15), ...deck.slice(23, 26)]);
    expect(hands.middlehand).toEqual([...deck.slice(3, 6), ...deck.slice(15, 19), ...deck.slice(26, 29)]);
    expect(hands.hindhand).toEqual([...deck.slice(6, 9), ...deck.slice(19, 23), ...deck.slice(29, 32)]);
  });

  it('has 120 card points in total', () => {
    const { hands, skat } = deal(9);
    const all = [...hands.forehand, ...hands.middlehand, ...hands.hindhand, ...skat];
    expect(sumPoints(all)).toBe(120);
  });
});
