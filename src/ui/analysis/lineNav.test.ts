import { describe, expect, it } from 'vitest';
import type { CardId } from '../../engine';
import type { AnalysisLine } from '../../table';
import { backOne, canForward, forwardOne, jumpToTrick, moveTo, resetToActual } from './lineNav';

const cards = ['CA', 'C7', 'C8', 'CK', 'CQ', 'CJ'] as CardId[];
const actual: AnalysisLine = { plays: cards, cursor: 0 };

describe('cursor moves', () => {
  it('clamps the cursor to the line', () => {
    expect(moveTo(actual, -3).cursor).toBe(0);
    expect(moveTo(actual, 99).cursor).toBe(cards.length);
  });

  it('steps back and forward one card, never past the ends', () => {
    expect(backOne(actual).cursor).toBe(0);
    expect(forwardOne(actual).cursor).toBe(1);
    expect(forwardOne(moveTo(actual, cards.length)).cursor).toBe(cards.length);
  });

  it('forward is off at the end of the line', () => {
    expect(canForward(actual)).toBe(true);
    expect(canForward(moveTo(actual, cards.length))).toBe(false);
  });

  it('jumps to the end of trick n (three cards per trick), capped at the line', () => {
    expect(jumpToTrick(actual, 1).cursor).toBe(3);
    expect(jumpToTrick(actual, 9).cursor).toBe(cards.length);
  });
});

describe('resetToActual', () => {
  it('keeps the cursor when the line never left the actual game', () => {
    expect(resetToActual(cards, { plays: cards, cursor: 4 })).toEqual({ plays: cards, cursor: 4 });
  });

  it('puts the cursor before the variant card when the line left the actual game', () => {
    const variant: AnalysisLine = { plays: [cards[0], cards[1], 'S9'] as CardId[], cursor: 3 };
    expect(resetToActual(cards, variant)).toEqual({ plays: cards, cursor: 2 });
  });
});
