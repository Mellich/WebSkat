import { describe, expect, it } from 'vitest';
import { applyAction, enumerateActions, getLegal, newGame } from './game';
import { PASS, PLAY_HAND, afterBidding, afterDiscard, afterPickup, apply, bid, playingState, run } from './testing';


describe('getLegal', () => {
  it('lets the caller bid only 18 and pass, and the listener hold after a bid', () => {
    const start = newGame(1);
    expect(getLegal(start, 'middlehand')).toEqual({ bidValues: [18], canPassBid: true });
    expect(getLegal(start, 'forehand')).toEqual({});
    const afterBid = apply(start, 'middlehand', bid(18));
    expect(getLegal(afterBid, 'forehand')).toEqual({ canPassBid: true, canHold: true });
  });

  it('offers claim and pass in the claim stage', () => {
    const claim = run(newGame(1), [
      ['middlehand', PASS],
      ['hindhand', PASS],
    ]);
    expect(getLegal(claim, 'forehand')).toEqual({ canPassBid: true, canClaim: true });
  });

  it('offers pick-up and hand in the skat decision', () => {
    expect(getLegal(afterBidding(), 'middlehand')).toEqual({ canPickUp: true, canPlayHand: true });
  });

  it('offers the 12 cards for the discard', () => {
    expect(getLegal(afterPickup(), 'middlehand').discardFrom).toHaveLength(12);
  });

  it('offers 7 declarations after a pick-up and 22 after a Hand game', () => {
    expect(getLegal(afterDiscard(), 'middlehand').declarations).toHaveLength(7);
    expect(getLegal(apply(afterBidding(), 'middlehand', PLAY_HAND), 'middlehand').declarations).toHaveLength(22);
  });

  it('offers the whole hand as playable when leading', () => {
    const state = playingState();
    expect(getLegal(state, 'forehand').playableCards).toEqual(state.hands.forehand);
  });
});

describe('enumerateActions', () => {
  it('is empty for roles not on turn', () => {
    expect(enumerateActions(newGame(1), 'forehand')).toEqual([]);
  });

  it('lists one bid and a pass for the caller at the start', () => {
    const actions = enumerateActions(newGame(1), 'middlehand');
    expect(actions).toHaveLength(2);
    expect(actions).toContainEqual({ type: 'pass' });
  });

  it('lists all 66 pairs of cards for the discard', () => {
    const actions = enumerateActions(afterPickup(), 'middlehand');
    expect(actions).toHaveLength(66);
    expect(actions.every((a) => a.type === 'discard')).toBe(true);
  });

  it('only lists actions that the reducer accepts', () => {
    const state = afterPickup();
    for (const action of enumerateActions(state, 'middlehand')) {
      expect(applyAction(state, 'middlehand', action).ok).toBe(true);
    }
  });
});
