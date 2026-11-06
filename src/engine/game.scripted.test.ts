import { describe, expect, it } from 'vitest';
import { HOLD, PASS, PICKUP, apply, bid, run, stateWith, hand, type Step } from './testing';
import type { CardId, Role } from './types';

/**
 * Hand-written full game (living documentation, docs/09-testing.md §2).
 * Null, declared by the forehand after a bid of 23. The middlehand takes every trick, so the
 * declarer takes none and wins the Null. The Skat (D9, D10) is picked up and discarded again.
 */
describe('scripted game: Null won without a trick', () => {
  const HANDS = {
    forehand: hand('C7 C9 CJ S7 S9 SJ D7 D8 DJ DQ'),
    middlehand: hand('CA CK CQ SA SK SQ HA HK DA DK'),
    hindhand: hand('C8 C10 HJ S8 S10 H7 H8 H9 H10 HQ'),
  };
  const SKAT = hand('D9 D10');

  const BIDDING: readonly Step[] = [
    ['middlehand', bid(23)],
    ['forehand', HOLD],
    ['middlehand', PASS],
    ['hindhand', PASS],
    ['forehand', PICKUP],
    ['forehand', { type: 'discard', cards: ['D9', 'D10'] }],
    ['forehand', { type: 'declare', declaration: { kind: 'null', hand: false, ouvert: false } }],
  ];

  /** Trick by trick; the first entry is the leader. */
  const TRICKS: ReadonlyArray<readonly [Role, CardId][]> = [
    [['forehand', 'C7'], ['middlehand', 'CA'], ['hindhand', 'C8']],
    [['middlehand', 'CK'], ['hindhand', 'C10'], ['forehand', 'C9']],
    [['middlehand', 'CQ'], ['hindhand', 'HJ'], ['forehand', 'CJ']],
    [['middlehand', 'SA'], ['hindhand', 'S8'], ['forehand', 'S7']],
    [['middlehand', 'SK'], ['hindhand', 'S10'], ['forehand', 'S9']],
    [['middlehand', 'SQ'], ['hindhand', 'H7'], ['forehand', 'SJ']],
    [['middlehand', 'HA'], ['hindhand', 'H8'], ['forehand', 'D7']],
    [['middlehand', 'HK'], ['hindhand', 'H9'], ['forehand', 'D8']],
    [['middlehand', 'DA'], ['hindhand', 'H10'], ['forehand', 'DJ']],
    [['middlehand', 'DK'], ['hindhand', 'HQ'], ['forehand', 'DQ']],
  ];

  it('plays out to the expected result', () => {
    let state = run(stateWith({ hands: HANDS, initialHands: HANDS, skat: SKAT }), BIDDING);
    expect(state).toMatchObject({ phase: 'playing', declarer: 'forehand', bid: 23, turn: 'forehand' });

    for (const trick of TRICKS) {
      for (const [role, card] of trick) {
        state = apply(state, role, { type: 'play', card });
      }
    }

    expect(state.phase).toBe('finished');
    expect(state.tricks.map((t) => t.winner)).toEqual(TRICKS.map(() => 'middlehand'));
    expect(state.tricks.map((t) => t.leader)).toEqual(TRICKS.map((_, i) => (i === 0 ? 'forehand' : 'middlehand')));
    expect(state.hands).toEqual({ forehand: [], middlehand: [], hindhand: [] });
    expect(state.result).toEqual({
      kind: 'played',
      declarer: 'forehand',
      bid: 23,
      declaration: { kind: 'null', hand: false, ouvert: false },
      spitzen: null,
      declarerPoints: 0,
      defenderPoints: 0,
      declarerTricks: 0,
      defenderTricks: 10,
      schneider: false,
      schwarz: false,
      base: 23,
      multiplier: null,
      gameValue: 23,
      playedWon: true,
      overbid: false,
      won: true,
      loseValue: null,
      declarerScore: 23,
    });
  });
});
