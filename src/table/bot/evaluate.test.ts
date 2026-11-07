import { describe, expect, it } from 'vitest';
import { hand } from '../../engine/testing';
import { bestGame, evaluateGame, isPerfectNullSuit, isSafeNullSuit, maxBidOf } from './evaluate';

describe('evaluateGame', () => {
  it('finds a Grand with four Jacks, three aces and two tens', () => {
    const cards = hand('CJ SJ HJ DJ CA C10 SA S10 HA D7');
    expect(evaluateGame(cards, 'grand', { hand: false }).playable).toBe(true);
    expect(maxBidOf(cards)).toBeGreaterThanOrEqual(48);
    expect(bestGame(cards, { hand: true })?.game).toBe('grand');
  });

  it('finds a Hearts game with two top Jacks, five hearts and a side ace', () => {
    const cards = hand('CJ SJ HA H10 HK H8 H7 CA D7 S8');
    const hearts = evaluateGame(cards, 'H', { hand: false });
    expect(hearts.playable).toBe(true);
    expect(hearts.value).toBe(30); // mit 2: 3 × 10
  });

  it('plays nothing with a junk hand', () => {
    const cards = hand('C7 C8 C9 S7 S8 S9 HQ HK D8 D9');
    expect(bestGame(cards, { hand: false })).toBeNull();
    expect(maxBidOf(cards)).toBe(0);
  });

  it('finds a Null Hand when every suit is safe', () => {
    const cards = hand('C7 C8 C9 S7 S8 H7 H9 D7 D8 DJ');
    expect(evaluateGame(cards, 'null', { hand: true }).playable).toBe(true);
    expect(maxBidOf(cards)).toBeGreaterThanOrEqual(23);
  });

  it('refuses Null Hand with a lone ace', () => {
    const cards = hand('C7 C8 C9 S7 S8 S9 H7 H8 H9 DA');
    expect(evaluateGame(cards, 'null', { hand: true }).playable).toBe(false);
    expect(evaluateGame(cards, 'null', { hand: false }).playable).toBe(true); // the ace can be discarded
  });

  it('values a game "without" Spitzen by the missing top trumps', () => {
    const cards = hand('CA C10 CK CQ C9 C8 C7 SA HA DA');
    expect(evaluateGame(cards, 'C', { hand: false }).value).toBe(12 * 5); // ohne 4
  });
});

describe('null suit safety', () => {
  it.each([
    ['C7', true, true],
    ['C8', false, false],
    ['C7 C9', true, false],
    ['C7 C10', false, false],
    ['C7 C8 C9', true, true],
    ['C7 C9 CJ', true, false],
    ['', true, true],
  ])('%s → safe %s, perfect %s', (text, safe, perfect) => {
    expect(isSafeNullSuit(hand(text), 'C')).toBe(safe);
    expect(isPerfectNullSuit(hand(text), 'C')).toBe(perfect);
  });
});
