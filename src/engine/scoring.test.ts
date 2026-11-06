import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from './cards';
import { deal } from './deck';
import { countSpitzen } from './spitzen';
import { cardAt, hand, stateWith } from './testing';
import { computeScore, scoreGame, skatPointsForDeclarer, type ScoreComputation, type ScoreInput } from './scoring';
import { modeOf } from './trump';
import { ROLES, type Announce, type CompletedTrick, type Declaration, type Suit } from './types';

const suit = (trump: Suit, hand: boolean, announce: Announce = 'none', ouvert = false): Declaration => ({
  kind: 'suit',
  trump,
  hand,
  announce,
  ouvert,
});
const grand = (hand: boolean, announce: Announce = 'none', ouvert = false): Declaration => ({
  kind: 'grand',
  hand,
  announce,
  ouvert,
});
const nul = (hand = false, ouvert = false): Declaration => ({ kind: 'null', hand, ouvert });

type Expected = Pick<ScoreComputation, 'multiplier' | 'gameValue' | 'won' | 'overbid' | 'declarerScore'>;

/** The 20 worked examples of docs/03-skat-rules.md §10.7. */
const VECTORS: ReadonlyArray<{ name: string; input: ScoreInput; expected: Expected }> = [
  {
    name: '#1 Grand mit 4, Schneider, won',
    input: { declaration: grand(false), bid: 48, spitzen: 4, declarerPoints: 100, declarerTricks: 8 },
    expected: { multiplier: 6, gameValue: 144, won: true, overbid: false, declarerScore: 144 },
  },
  {
    name: '#2 Grand mit 4, Schneider and Schwarz, won',
    input: { declaration: grand(false), bid: 48, spitzen: 4, declarerPoints: 120, declarerTricks: 10 },
    expected: { multiplier: 7, gameValue: 168, won: true, overbid: false, declarerScore: 168 },
  },
  {
    name: '#3 Diamonds ohne 2, lost',
    input: { declaration: suit('D', false), bid: 18, spitzen: 2, declarerPoints: 40, declarerTricks: 3 },
    expected: { multiplier: 3, gameValue: 27, won: false, overbid: false, declarerScore: -54 },
  },
  {
    name: '#4 Diamonds ohne 2, lost with Schneider against',
    input: { declaration: suit('D', false), bid: 18, spitzen: 2, declarerPoints: 25, declarerTricks: 1 },
    expected: { multiplier: 4, gameValue: 36, won: false, overbid: false, declarerScore: -72 },
  },
  {
    name: '#5 Clubs mit 1, bid 36 overbid, lost',
    input: { declaration: suit('C', false), bid: 36, spitzen: 1, declarerPoints: 70, declarerTricks: 6 },
    expected: { multiplier: 2, gameValue: 24, won: false, overbid: true, declarerScore: -72 },
  },
  {
    name: '#6 Clubs mit 1, bid 36 exactly reached, won',
    input: { declaration: suit('C', false), bid: 36, spitzen: 1, declarerPoints: 95, declarerTricks: 8 },
    expected: { multiplier: 3, gameValue: 36, won: true, overbid: false, declarerScore: 36 },
  },
  {
    name: '#7 Clubs mit 1, bid 40 overbid, lost',
    input: { declaration: suit('C', false), bid: 40, spitzen: 1, declarerPoints: 70, declarerTricks: 6 },
    expected: { multiplier: 2, gameValue: 24, won: false, overbid: true, declarerScore: -96 },
  },
  {
    name: '#8 Hearts Hand mit 1, won',
    input: { declaration: suit('H', true), bid: 30, spitzen: 1, declarerPoints: 65, declarerTricks: 6 },
    expected: { multiplier: 3, gameValue: 30, won: true, overbid: false, declarerScore: 30 },
  },
  {
    name: '#9 Spades Hand, Schneider announced but only 85 points, lost',
    input: { declaration: suit('S', true, 'schneider'), bid: 55, spitzen: 2, declarerPoints: 85, declarerTricks: 7 },
    expected: { multiplier: 5, gameValue: 55, won: false, overbid: false, declarerScore: -110 },
  },
  {
    name: '#10 Clubs Hand, Schwarz announced and achieved, won',
    input: { declaration: suit('C', true, 'schwarz'), bid: 84, spitzen: 1, declarerPoints: 120, declarerTricks: 10 },
    expected: { multiplier: 7, gameValue: 84, won: true, overbid: false, declarerScore: 84 },
  },
  {
    name: '#11 Grand Hand Ouvert Schwarz, won',
    input: { declaration: grand(true, 'schwarz', true), bid: 100, spitzen: 2, declarerPoints: 120, declarerTricks: 10 },
    expected: { multiplier: 9, gameValue: 216, won: true, overbid: false, declarerScore: 216 },
  },
  {
    name: '#12 Grand Hand Ouvert Schwarz, lost with 70 points',
    input: { declaration: grand(true, 'schwarz', true), bid: 100, spitzen: 2, declarerPoints: 70, declarerTricks: 5 },
    expected: { multiplier: 7, gameValue: 168, won: false, overbid: false, declarerScore: -336 },
  },
  {
    name: '#13 Null won',
    input: { declaration: nul(), bid: 23, spitzen: 0, declarerPoints: 0, declarerTricks: 0 },
    expected: { multiplier: null, gameValue: 23, won: true, overbid: false, declarerScore: 23 },
  },
  {
    name: '#14 Null lost with one trick',
    input: { declaration: nul(), bid: 23, spitzen: 0, declarerPoints: 0, declarerTricks: 1 },
    expected: { multiplier: null, gameValue: 23, won: false, overbid: false, declarerScore: -46 },
  },
  {
    name: '#15 Null Hand won',
    input: { declaration: nul(true), bid: 35, spitzen: 0, declarerPoints: 0, declarerTricks: 0 },
    expected: { multiplier: null, gameValue: 35, won: true, overbid: false, declarerScore: 35 },
  },
  {
    name: '#16 Null Ouvert won',
    input: { declaration: nul(false, true), bid: 46, spitzen: 0, declarerPoints: 0, declarerTricks: 0 },
    expected: { multiplier: null, gameValue: 46, won: true, overbid: false, declarerScore: 46 },
  },
  {
    name: '#17 Null Ouvert Hand lost with three tricks',
    input: { declaration: nul(true, true), bid: 59, spitzen: 0, declarerPoints: 0, declarerTricks: 3 },
    expected: { multiplier: null, gameValue: 59, won: false, overbid: false, declarerScore: -118 },
  },
  {
    name: '#18 Null bid 24 overbids the value 23',
    input: { declaration: nul(), bid: 24, spitzen: 0, declarerPoints: 0, declarerTricks: 0 },
    expected: { multiplier: null, gameValue: 23, won: false, overbid: true, declarerScore: -46 },
  },
  {
    name: '#19 Diamonds mit 1, exactly 61 points, won',
    input: { declaration: suit('D', false), bid: 18, spitzen: 1, declarerPoints: 61, declarerTricks: 6 },
    expected: { multiplier: 2, gameValue: 18, won: true, overbid: false, declarerScore: 18 },
  },
  {
    name: '#20 Diamonds mit 1, 60 points is not enough, lost',
    input: { declaration: suit('D', false), bid: 18, spitzen: 1, declarerPoints: 60, declarerTricks: 5 },
    expected: { multiplier: 2, gameValue: 18, won: false, overbid: false, declarerScore: -36 },
  },
];

describe('computeScore against the worked examples (docs/03 §10.7)', () => {
  it.each(VECTORS)('$name', ({ input, expected }) => {
    const result = computeScore(input);
    expect({
      multiplier: result.multiplier,
      gameValue: result.gameValue,
      won: result.won,
      overbid: result.overbid,
      declarerScore: result.declarerScore,
    }).toEqual(expected);
  });
});

describe('Schneider and Schwarz thresholds', () => {
  const base = { declaration: grand(false), bid: 18, spitzen: 0 } as const;

  it.each([
    [29, true],
    [30, true],
    [31, false],
    [89, false],
    [90, true],
    [91, true],
  ])('declarer with %i points → schneider=%s', (declarerPoints, schneider) => {
    expect(computeScore({ ...base, declarerPoints, declarerTricks: 5 }).schneider).toBe(schneider);
  });

  it.each([
    [0, true],
    [1, false],
    [9, false],
    [10, true],
  ])('declarer with %i tricks → schwarz=%s', (declarerTricks, schwarz) => {
    expect(computeScore({ ...base, declarerPoints: 60, declarerTricks }).schwarz).toBe(schwarz);
  });

  it('a Schwarz announcement needs all 10 tricks, not 90 points', () => {
    const result = computeScore({
      declaration: grand(true, 'schwarz'),
      bid: 18,
      spitzen: 2,
      declarerPoints: 95,
      declarerTricks: 9,
    });
    expect(result.won).toBe(false);
  });

  it('a Schneider announcement needs at least 90 points', () => {
    const result = computeScore({
      declaration: suit('S', true, 'schneider'),
      bid: 18,
      spitzen: 1,
      declarerPoints: 89,
      declarerTricks: 6,
    });
    expect(result.won).toBe(false);
  });
});

describe('overbid rounding (docs/03 §10.5)', () => {
  it('rounds the lost value up to the next multiple of the base', () => {
    const result = computeScore({
      declaration: suit('C', false),
      bid: 37,
      spitzen: 1,
      declarerPoints: 70,
      declarerTricks: 6,
    });
    expect(result.loseValue).toBe(48);
    expect(result.declarerScore).toBe(-96);
  });

  it('applies the overbid penalty even when the declarer reached 61 points', () => {
    const result = computeScore({
      declaration: suit('D', false),
      bid: 19,
      spitzen: 1,
      declarerPoints: 61,
      declarerTricks: 6,
    });
    expect(result.won).toBe(false);
    expect(result.loseValue).toBe(27);
    expect(result.declarerScore).toBe(-54);
  });

  it('does not round the Null value', () => {
    const result = computeScore({ declaration: nul(), bid: 24, spitzen: 0, declarerPoints: 0, declarerTricks: 0 });
    expect(result.loseValue).toBe(23);
  });

  it('reports no loss value for a won game', () => {
    const result = computeScore({
      declaration: suit('D', false),
      bid: 18,
      spitzen: 1,
      declarerPoints: 61,
      declarerTricks: 6,
    });
    expect(result.loseValue).toBeNull();
  });
});

describe('skatPointsForDeclarer', () => {
  it('counts the Skat when the cards were not picked up (Hand game)', () => {
    expect(skatPointsForDeclarer(stateWith({ skat: hand('CA C10'), pickedUpSkat: false }))).toBe(21);
  });

  it('counts only the discarded cards after a pick-up', () => {
    const state = stateWith({ skat: hand('CA C10'), pickedUpSkat: true, discarded: hand('D9 SK') });
    expect(skatPointsForDeclarer(state)).toBe(4);
  });
});

describe('scoreGame on a finished game', () => {
  it('scores a Hand Clubs game where the declarer takes every trick', () => {
    const { hands, skat } = deal(7);
    const played = ROLES.flatMap((role) => hands[role]);
    const tricks: CompletedTrick[] = [];
    for (let i = 0; i < 10; i++) {
      const plays = [0, 1, 2].map((j) => ({ role: ROLES[j] ?? 'forehand', card: cardAt(played, i * 3 + j) }));
      tricks.push({ leader: 'forehand', plays, winner: 'middlehand' });
    }
    const declaration = suit('C', true);
    const state = stateWith({
      phase: 'finished',
      declarer: 'middlehand',
      bid: 18,
      declaration,
      initialHands: hands,
      skat,
      pickedUpSkat: false,
      tricks,
      hands: { forehand: [], middlehand: [], hindhand: [] },
    });

    const result = scoreGame(state);
    if (result.kind !== 'played') {
      throw new Error('expected a played game');
    }
    const spitzen = countSpitzen([...hands.middlehand, ...skat], modeOf(declaration));
    expect(spitzen).not.toBeNull();
    expect(result).toMatchObject({
      declarer: 'middlehand',
      declarerPoints: 120,
      defenderPoints: 0,
      declarerTricks: 10,
      defenderTricks: 0,
      schneider: true,
      schwarz: true,
      playedWon: true,
      won: true,
      spitzen,
    });
    expect(result.multiplier).toBe((spitzen?.count ?? 0) + 4);
    expect(result.declarerScore).toBe(result.gameValue);
  });

  it('reports passed-in for a state that was never played', () => {
    expect(scoreGame(stateWith({ phase: 'finished' }))).toEqual({ kind: 'passed-in' });
  });

  it('deals every card exactly once', () => {
    const { hands, skat } = deal(7);
    expect([...ROLES.flatMap((role) => hands[role]), ...skat].sort()).toEqual([...ALL_CARDS].sort());
  });
});
