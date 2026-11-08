import { describe, expect, it } from 'vitest';
import {
  ALL_CARDS,
  card,
  cardPoints,
  isCardId,
  rankOf,
  sortHand,
  sumPoints,
  suitOf,
} from './cards';
import { hand } from './testing';

describe('ALL_CARDS', () => {
  it('contains 32 unique, valid card ids', () => {
    expect(ALL_CARDS).toHaveLength(32);
    expect(new Set(ALL_CARDS).size).toBe(32);
    for (const c of ALL_CARDS) {
      expect(isCardId(c)).toBe(true);
    }
  });
});

describe('card parsing', () => {
  it('builds card ids from suit and rank', () => {
    expect(card('H', '10')).toBe('H10');
    expect(card('C', 'J')).toBe('CJ');
  });

  it('splits suit and rank, handling the two-character rank 10', () => {
    expect(suitOf('S10')).toBe('S');
    expect(rankOf('S10')).toBe('10');
    expect(rankOf('CJ')).toBe('J');
  });

  it.each([
    ['CJ', true],
    ['C10', true],
    ['D7', true],
    ['X1', false],
    ['C1', false],
    ['10C', false],
    ['', false],
  ])('isCardId(%s) is %s', (s, expected) => {
    expect(isCardId(s)).toBe(expected);
  });
});

describe('card points (skat-rules §1)', () => {
  it.each([
    ['CA', 11],
    ['C10', 10],
    ['CK', 4],
    ['CQ', 3],
    ['CJ', 2],
    ['C9', 0],
    ['C8', 0],
    ['C7', 0],
  ] as const)('%s is worth %i', (c, points) => {
    expect(cardPoints(c)).toBe(points);
  });

  it('sums to 120 for the whole deck', () => {
    expect(sumPoints(ALL_CARDS)).toBe(120);
  });
});

describe('sortHand', () => {
  const sample = hand('D7 SA H9 CJ C10 HJ S7 DJ');

  it('puts trump first in a suit game (Jacks, trump suit, then C H S D)', () => {
    const sorted = sortHand(sample, { kind: 'suit', trump: 'H', hand: false, announce: 'none', ouvert: false });
    expect(sorted).toEqual(hand('CJ HJ DJ H9 C10 SA S7 D7'));
  });

  it('puts all Jacks first in Grand', () => {
    const sorted = sortHand(sample, { kind: 'grand', hand: false, announce: 'none', ouvert: false });
    expect(sorted).toEqual(hand('CJ HJ DJ C10 H9 SA S7 D7'));
  });

  it('orders suit by suit with A K Q J 10 9 8 7 in Null', () => {
    const sorted = sortHand(sample, { kind: 'null', hand: false, ouvert: false });
    expect(sorted).toEqual(hand('CJ C10 HJ H9 SA S7 DJ D7'));
  });

  it('treats an unknown declaration like Grand (Jacks first)', () => {
    expect(sortHand(sample, null)).toEqual(hand('CJ HJ DJ C10 H9 SA S7 D7'));
  });

  it('does not mutate its input', () => {
    const input = hand('D7 SA');
    sortHand(input, null);
    expect(input).toEqual(hand('D7 SA'));
  });
});
