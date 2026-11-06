import { describe, expect, it } from 'vitest';
import { applyAction, isFinished, newGame } from './game';
import {
  DECLARE_HEARTS,
  HOLD,
  PASS,
  PICKUP,
  PLAY_HAND,
  absentCard,
  afterBidding,
  afterDiscard,
  afterPickup,
  apply,
  bid,
  playingState,
  run,
  snapshot,
} from './testing';
import type { GameAction, GameErrorCode, GameState, Role } from './types';

function errorCode(state: GameState, role: Role, action: GameAction): GameErrorCode {
  const result = applyAction(state, role, action);
  if (result.ok) {
    throw new Error(`expected ${role} ${action.type} to be rejected`);
  }
  return result.error.code;
}

describe('newGame', () => {
  it('starts the bidding with the middlehand', () => {
    const state = newGame(5);
    expect(state).toMatchObject({
      phase: 'bidding',
      turn: 'middlehand',
      declarer: null,
      bid: null,
      declaration: null,
      tricks: [],
      result: null,
      bidding: { stage: 1, caller: 'middlehand', listener: 'forehand', awaiting: 'caller', currentBid: null },
    });
    expect(state.hands.forehand).toHaveLength(10);
    expect(state.hands.middlehand).toHaveLength(10);
    expect(state.hands.hindhand).toHaveLength(10);
    expect(state.skat).toHaveLength(2);
    expect(state.initialHands).toEqual(state.hands);
  });

  it('is deterministic for a seed', () => {
    expect(newGame(42)).toEqual(newGame(42));
  });
});

describe('bidding flow', () => {
  it('ends with passed-in when everybody passes', () => {
    const state = run(newGame(1), [
      ['middlehand', PASS],
      ['hindhand', PASS],
      ['forehand', PASS],
    ]);
    expect(state).toMatchObject({ phase: 'finished', turn: null, result: { kind: 'passed-in' } });
    expect(isFinished(state)).toBe(true);
    expect(errorCode(state, 'forehand', PASS)).toBe('WRONG_PHASE');
  });

  it('makes the bidder the declarer in the skat-decision phase', () => {
    expect(afterBidding()).toMatchObject({
      phase: 'skat-decision',
      declarer: 'middlehand',
      bid: 18,
      turn: 'middlehand',
    });
  });

  it('alternates the turn between caller and listener during the bidding', () => {
    const afterBid = apply(newGame(1), 'middlehand', bid(18));
    expect(afterBid.turn).toBe('forehand');
    expect(apply(afterBid, 'forehand', HOLD).turn).toBe('middlehand');
  });

  it('rejects a play action during bidding', () => {
    expect(errorCode(newGame(1), 'middlehand', { type: 'play', card: 'CA' })).toBe('WRONG_PHASE');
  });
});

describe('skat decision, discard and declaration', () => {
  it('lets only the declarer pick up the Skat', () => {
    expect(errorCode(afterBidding(), 'forehand', PICKUP)).toBe('NOT_YOUR_TURN');
    expect(errorCode(afterBidding(), 'middlehand', { type: 'discard', cards: ['CA', 'CK'] })).toBe('WRONG_PHASE');
  });

  it('picks up the Skat: 12 cards in hand, then discarding', () => {
    const state = afterPickup();
    expect(state.hands.middlehand).toHaveLength(12);
    expect(state).toMatchObject({ pickedUpSkat: true, phase: 'discarding', turn: 'middlehand' });
  });

  it('rejects an invalid discard and leaves the state unchanged', () => {
    const state = afterPickup();
    const before = snapshot(state);
    const [first] = state.hands.middlehand;
    if (first === undefined) throw new Error('expected cards in hand');
    expect(errorCode(state, 'middlehand', { type: 'discard', cards: [first, first] })).toBe('INVALID_DISCARD');
    const outsider = absentCard(state, 'middlehand');
    expect(errorCode(state, 'middlehand', { type: 'discard', cards: [first, outsider] })).toBe('INVALID_DISCARD');
    expect(state).toEqual(before);
  });

  it('discards two cards and moves to declaring', () => {
    const state = afterPickup();
    const [a, b] = state.hands.middlehand;
    if (a === undefined || b === undefined) throw new Error('expected 12 cards');
    const next = apply(state, 'middlehand', { type: 'discard', cards: [a, b] });
    expect(next.hands.middlehand).toHaveLength(10);
    expect(next.discarded).toEqual([a, b]);
    expect(next.phase).toBe('declaring');
  });

  it('rejects a declaration that does not match the way the Skat was taken', () => {
    expect(
      errorCode(afterDiscard(), 'middlehand', {
        type: 'declare',
        declaration: { kind: 'grand', hand: true, announce: 'none', ouvert: false },
      }),
    ).toBe('INVALID_DECLARATION');
  });

  it('declares and starts the play with the forehand', () => {
    expect(playingState()).toMatchObject({
      phase: 'playing',
      turn: 'forehand',
      trick: { leader: 'forehand', plays: [] },
      declaration: { kind: 'suit', trump: 'H' },
    });
  });

  it('plays a Hand game without picking up the Skat', () => {
    const state = apply(afterBidding(), 'middlehand', PLAY_HAND);
    expect(state).toMatchObject({ phase: 'declaring', pickedUpSkat: false });
    expect(state.hands.middlehand).toHaveLength(10);
    const next = apply(state, 'middlehand', {
      type: 'declare',
      declaration: { kind: 'grand', hand: true, announce: 'schneider', ouvert: false },
    });
    expect(next.phase).toBe('playing');
  });
});

describe('playing phase guards', () => {
  it('rejects declarations while playing', () => {
    expect(
      errorCode(playingState(), 'forehand', DECLARE_HEARTS),
    ).toBe('WRONG_PHASE');
  });

  it('rejects a player who is not on turn', () => {
    expect(errorCode(playingState(), 'middlehand', { type: 'play', card: 'CA' })).toBe('NOT_YOUR_TURN');
  });

  it('rejects a card that is not in the hand', () => {
    const state = playingState();
    expect(errorCode(state, 'forehand', { type: 'play', card: absentCard(state, 'forehand') })).toBe('ILLEGAL_CARD');
  });
});

describe('immutability', () => {
  it('does not change the input state of a successful action', () => {
    const state = newGame(3);
    const before = snapshot(state);
    apply(state, 'middlehand', bid(18));
    expect(state).toEqual(before);
  });
});
