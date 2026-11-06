import { describe, expect, it } from 'vitest';
import { cardStrength, effectiveSuit, isTrump, legalCards, modeOf, trickWinner, type PlayMode } from './trump';
import { hand } from './testing';
import type { CardId, Declaration, Role, Trick } from './types';

const HEARTS: PlayMode = { kind: 'suit', trump: 'H' };
const CLUBS: PlayMode = { kind: 'suit', trump: 'C' };
const GRAND: PlayMode = { kind: 'grand' };
const NULL_GAME: PlayMode = { kind: 'null' };

function trick(...plays: [Role, CardId][]): Trick {
  return {
    leader: plays[0]?.[0] ?? 'forehand',
    plays: plays.map(([role, card]) => ({ role, card })),
  };
}

describe('modeOf', () => {
  it('maps declarations to play modes', () => {
    const suit: Declaration = { kind: 'suit', trump: 'D', hand: false, announce: 'none', ouvert: false };
    expect(modeOf(suit)).toEqual({ kind: 'suit', trump: 'D' });
    expect(modeOf({ kind: 'grand', hand: true, announce: 'none', ouvert: false })).toEqual({ kind: 'grand' });
    expect(modeOf({ kind: 'null', hand: false, ouvert: false })).toEqual({ kind: 'null' });
  });
});

describe('isTrump and effectiveSuit (docs/03 §6.1, §6.3)', () => {
  it.each([
    ['DJ', HEARTS, true],
    ['HA', HEARTS, true],
    ['D9', HEARTS, false],
    ['CA', HEARTS, false],
    ['HJ', GRAND, true],
    ['HA', GRAND, false],
    ['CJ', NULL_GAME, false],
  ] as const)('isTrump(%s) is %s', (c, mode, expected) => {
    expect(isTrump(c, mode)).toBe(expected);
  });

  it.each([
    ['DJ', HEARTS, 'trump'],
    ['D10', HEARTS, 'D'],
    ['DJ', GRAND, 'trump'],
    ['DJ', NULL_GAME, 'D'],
    ['H7', NULL_GAME, 'H'],
  ] as const)('effectiveSuit(%s) is %s', (c, mode, expected) => {
    expect(effectiveSuit(c, mode)).toBe(expected);
  });
});

describe('trump strength order (docs/03 §6.2)', () => {
  function strictlyDecreasing(cards: readonly CardId[], mode: PlayMode): boolean {
    const values = cards.map((c) => cardStrength(c, mode));
    return values.every((v, i) => i === 0 || (values[i - 1] ?? Infinity) > v);
  }

  it('orders trumps in a suit game: CJ SJ HJ DJ, then trump suit A 10 K Q 9 8 7', () => {
    expect(strictlyDecreasing(hand('CJ SJ HJ DJ HA H10 HK HQ H9 H8 H7'), HEARTS)).toBe(true);
  });

  it('orders the four Jacks first in Grand, above every plain card', () => {
    expect(strictlyDecreasing(hand('CJ SJ HJ DJ CA C10 CK CQ C9 C8 C7'), GRAND)).toBe(true);
  });

  it('orders Null ranks A K Q J 10 9 8 7 within a suit', () => {
    expect(strictlyDecreasing(hand('SA SK SQ SJ S10 S9 S8 S7'), NULL_GAME)).toBe(true);
  });
});

describe('legalCards (docs/03 §6.4)', () => {
  it.each([
    ['Hearts: follow the diamond lead, DJ is trump', HEARTS, 'D10', 'DJ D9 C7', 'D9'],
    ['Hearts: trump lead must be followed with trump', HEARTS, 'HJ', 'SJ H7 C7 D7', 'SJ H7'],
    ['Hearts: trump must be followed', HEARTS, 'H8', 'CJ C9 S7', 'CJ'],
    ['Grand: plain suit must be followed', GRAND, 'C8', 'CJ C9 S7', 'C9'],
    ['Grand: Jack led is trump', GRAND, 'CJ', 'SJ C9 S7', 'SJ'],
    ['Null: suit must be followed', NULL_GAME, 'C10', 'CJ C7 S7', 'CJ C7'],
    ['Clubs: no spades, trump not followed', CLUBS, 'S7', 'H7 D7', 'H7 D7'],
  ] as const)('%s', (_name, mode, led, hold, expected) => {
    const result = legalCards(hand(hold), trick(['forehand', led]), mode);
    expect(result).toEqual(hand(expected));
  });

  it('lets the leader play any card', () => {
    const cards = hand('CJ C9 S7');
    expect(legalCards(cards, { leader: 'forehand', plays: [] }, HEARTS)).toEqual(cards);
  });
});

describe('trickWinner (docs/03 §6.5)', () => {
  it.each([
    ['Hearts: trump jack beats the led ace', HEARTS, trick(['forehand', 'CA'], ['middlehand', 'H7'], ['hindhand', 'SJ']), 'hindhand'],
    ['Hearts: off-suit ace cannot win', HEARTS, trick(['forehand', 'CA'], ['middlehand', 'C10'], ['hindhand', 'DA']), 'forehand'],
    ['Grand: diamond jack is trump', GRAND, trick(['forehand', 'DA'], ['middlehand', 'D10'], ['hindhand', 'DJ']), 'hindhand'],
    ['Grand: highest led suit card wins', GRAND, trick(['forehand', 'H7'], ['middlehand', 'HA'], ['hindhand', 'S7']), 'middlehand'],
    ['Null: King beats Jack and Ten', NULL_GAME, trick(['forehand', 'S10'], ['middlehand', 'SJ'], ['hindhand', 'SK']), 'hindhand'],
    ['Null: off-suit card cannot win', NULL_GAME, trick(['forehand', 'S10'], ['middlehand', 'SJ'], ['hindhand', 'D9']), 'middlehand'],
  ] as const)('%s', (_name, mode, t, expected) => {
    expect(trickWinner(t, mode)).toBe(expected);
  });

  it('returns the leader for an empty trick', () => {
    expect(trickWinner({ leader: 'hindhand', plays: [] }, HEARTS)).toBe('hindhand');
  });
});
