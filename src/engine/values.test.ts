import { describe, expect, it } from 'vitest';
import {
  BID_VALUES,
  baseValue,
  declarationFloorValue,
  gameMultiplier,
  nullValue,
} from './values';
import type { Declaration, TrumpDeclaration } from './types';

describe('BID_VALUES (skat-rules §4.1)', () => {
  it('starts with the documented first 20 values', () => {
    expect(BID_VALUES.slice(0, 20)).toEqual([18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40, 44, 45, 46, 48, 50, 54, 55, 59, 60]);
  });

  it('is sorted ascending without duplicates', () => {
    const sorted = [...BID_VALUES].sort((a, b) => a - b);
    expect(BID_VALUES).toEqual(sorted);
    expect(new Set(BID_VALUES).size).toBe(BID_VALUES.length);
  });

  it('has 63 values from 18 up to 264', () => {
    expect(BID_VALUES).toHaveLength(63);
    expect(BID_VALUES[0]).toBe(18);
    expect(BID_VALUES[BID_VALUES.length - 1]).toBe(264);
  });

  it('contains the Null values and the Grand maximum', () => {
    for (const v of [23, 35, 46, 59, 264]) {
      expect(BID_VALUES).toContain(v);
    }
    expect(BID_VALUES).not.toContain(265);
  });
});

describe('base values (skat-rules §10.1)', () => {
  const base = { hand: false, announce: 'none', ouvert: false } as const;

  it.each([
    ['Clubs', { kind: 'suit', trump: 'C', ...base }, 12],
    ['Spades', { kind: 'suit', trump: 'S', ...base }, 11],
    ['Hearts', { kind: 'suit', trump: 'H', ...base }, 10],
    ['Diamonds', { kind: 'suit', trump: 'D', ...base }, 9],
    ['Grand', { kind: 'grand', ...base }, 24],
    ['Null', { kind: 'null', hand: false, ouvert: false }, 23],
  ] as const)('%s is %i', (_name, decl, value) => {
    expect(baseValue(decl)).toBe(value);
  });
});

describe('nullValue (skat-rules §10.1)', () => {
  it.each([
    [false, false, 23],
    [true, false, 35],
    [false, true, 46],
    [true, true, 59],
  ] as const)('hand=%s ouvert=%s → %i', (hand, ouvert, value) => {
    expect(nullValue({ hand, ouvert })).toBe(value);
  });
});

describe('gameMultiplier (skat-rules §10.2 and §10.7 vectors)', () => {
  const grand = (hand: boolean, announce: TrumpDeclaration['announce'], ouvert: boolean): TrumpDeclaration => ({
    kind: 'grand',
    hand,
    announce,
    ouvert,
  });
  const suit = (
    trump: 'C' | 'S' | 'H' | 'D',
    hand: boolean,
    announce: TrumpDeclaration['announce'],
    ouvert = false,
  ): TrumpDeclaration => ({ kind: 'suit', trump, hand, announce, ouvert });

  it.each([
    ['vector 1: Grand mit 4, Schneider achieved', grand(false, 'none', false), 4, true, false, 6],
    ['vector 2: Grand mit 4, Schneider and Schwarz achieved', grand(false, 'none', false), 4, true, true, 7],
    ['vector 3: Diamonds ohne 2', suit('D', false, 'none'), 2, false, false, 3],
    ['vector 4: Diamonds ohne 2, Schneider achieved', suit('D', false, 'none'), 2, true, false, 4],
    ['vector 8: Hearts hand mit 1', suit('H', true, 'none'), 1, false, false, 3],
    ['vector 9: Spades hand, schneider announced, mit 2', suit('S', true, 'schneider'), 2, false, false, 5],
    ['vector 10: Clubs hand, schwarz announced, mit 1, both achieved', suit('C', true, 'schwarz'), 1, true, true, 7],
    ['vector 11: Grand hand ouvert schwarz, mit 2, both achieved', grand(true, 'schwarz', true), 2, true, true, 9],
    ['vector 12: Grand hand ouvert schwarz, mit 2, nothing achieved', grand(true, 'schwarz', true), 2, false, false, 7],
    ['Clubs not hand, mit 1, Schneider achieved', suit('C', false, 'none'), 1, true, false, 3],
  ] as const)('%s', (_name, d, spitzen, schneider, schwarz, expected) => {
    expect(gameMultiplier(d, spitzen, schneider, schwarz)).toBe(expected);
  });
});

describe('declarationFloorValue', () => {
  it('uses the multiplier without achieved Schneider or Schwarz', () => {
    const clubsHandSchwarz: Declaration = { kind: 'suit', trump: 'C', hand: true, announce: 'schwarz', ouvert: false };
    expect(declarationFloorValue(clubsHandSchwarz, 1)).toBe(60); // 12 × (1+1+1+2)
  });

  it('matches the game value when nothing is achieved beyond the floor', () => {
    const grandHandOuvert: Declaration = { kind: 'grand', hand: true, announce: 'schwarz', ouvert: true };
    expect(declarationFloorValue(grandHandOuvert, 2)).toBe(168); // 24 × 7
  });

  it('returns the Null value for Null', () => {
    expect(declarationFloorValue({ kind: 'null', hand: true, ouvert: false }, null)).toBe(35);
  });
});
