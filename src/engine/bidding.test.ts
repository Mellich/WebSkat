import { describe, expect, it } from 'vitest';
import { applyBid, biddingOutcome, initialBidding, legalBidValues, type BiddingOutcome } from './bidding';
import { snapshot } from './testing';
import { BID_VALUES } from './values';
import type { BidAction, BiddingState, GameErrorCode, Role } from './types';

type Step = readonly [Role, BidAction];

const bid = (value: number): BidAction => ({ type: 'bid', value });
const HOLD: BidAction = { type: 'hold' };
const PASS: BidAction = { type: 'pass' };
const CLAIM: BidAction = { type: 'claim' };

function run(steps: readonly Step[]): BiddingState {
  let state = initialBidding();
  for (const [role, action] of steps) {
    const result = applyBid(state, role, action);
    if (!result.ok) {
      throw new Error(`step ${role} ${action.type} failed: ${result.error.code}`);
    }
    state = result.value;
  }
  return state;
}

function errorOf(state: BiddingState, role: Role, action: BidAction): GameErrorCode {
  const result = applyBid(state, role, action);
  if (result.ok) {
    throw new Error(`expected ${role} ${action.type} to be rejected`);
  }
  return result.error.code;
}

describe('initialBidding', () => {
  it('starts in stage 1 with the middlehand as caller', () => {
    expect(initialBidding()).toEqual({
      stage: 1,
      caller: 'middlehand',
      listener: 'forehand',
      awaiting: 'caller',
      currentBid: null,
      history: [],
    });
  });
});

describe('example table (docs/03 §4.2)', () => {
  it.each([
    [
      'M:18, F:hold, M:20, F:pass → H:pass',
      [['middlehand', bid(18)], ['forehand', HOLD], ['middlehand', bid(20)], ['forehand', PASS], ['hindhand', PASS]],
      { kind: 'declarer', role: 'middlehand', bid: 20 },
    ],
    [
      'M:pass → H:18, F:hold, H:20, F:pass',
      [['middlehand', PASS], ['hindhand', bid(18)], ['forehand', HOLD], ['hindhand', bid(20)], ['forehand', PASS]],
      { kind: 'declarer', role: 'hindhand', bid: 20 },
    ],
    [
      'M:18, F:pass → H:20, M:pass',
      [['middlehand', bid(18)], ['forehand', PASS], ['hindhand', bid(20)], ['middlehand', PASS]],
      { kind: 'declarer', role: 'hindhand', bid: 20 },
    ],
    [
      'M:18, F:pass → H:pass',
      [['middlehand', bid(18)], ['forehand', PASS], ['hindhand', PASS]],
      { kind: 'declarer', role: 'middlehand', bid: 18 },
    ],
    [
      'M:pass → H:pass → F:claim',
      [['middlehand', PASS], ['hindhand', PASS], ['forehand', CLAIM]],
      { kind: 'declarer', role: 'forehand', bid: 18 },
    ],
    [
      'M:pass → H:pass → F:pass',
      [['middlehand', PASS], ['hindhand', PASS], ['forehand', PASS]],
      { kind: 'passed-in' },
    ],
  ] as const)('%s', (_name, steps, expected: BiddingOutcome) => {
    expect(biddingOutcome(run(steps))).toEqual(expected);
  });
});

describe('turn order and stage transitions', () => {
  it('rejects actions from the role who is not on turn', () => {
    expect(errorOf(initialBidding(), 'forehand', PASS)).toBe('NOT_YOUR_TURN');
    expect(errorOf(initialBidding(), 'hindhand', bid(18))).toBe('NOT_YOUR_TURN');
  });

  it('moves to stage 2 with the hindhand as caller when stage 1 ends by a pass', () => {
    const state = run([['middlehand', PASS]]);
    expect(state).toMatchObject({
      stage: 2,
      caller: 'hindhand',
      listener: 'forehand',
      awaiting: 'caller',
      currentBid: null,
    });
  });

  it('keeps the bid across the stage change', () => {
    const state = run([['middlehand', bid(18)], ['forehand', PASS]]);
    expect(state).toMatchObject({ stage: 2, caller: 'hindhand', listener: 'middlehand', currentBid: 18 });
  });

  it('goes to the claim stage when nobody bids', () => {
    const state = run([['middlehand', PASS], ['hindhand', PASS]]);
    expect(state).toMatchObject({ stage: 'claim', caller: 'forehand', listener: 'forehand', awaiting: 'caller' });
  });

  it('ends in state done with the declarer in caller and the bid in currentBid', () => {
    const state = run([['middlehand', bid(18)], ['forehand', PASS], ['hindhand', PASS]]);
    expect(state).toMatchObject({ stage: 'done', caller: 'middlehand', currentBid: 18 });
  });
});

describe('bidding rules', () => {
  it('requires bids to increase', () => {
    const state = run([['middlehand', bid(20)], ['forehand', HOLD]]);
    expect(errorOf(state, 'middlehand', bid(18))).toBe('ILLEGAL_BID');
    expect(errorOf(state, 'middlehand', bid(20))).toBe('ILLEGAL_BID');
    expect(applyBid(state, 'middlehand', bid(22)).ok).toBe(true);
  });

  it('rejects values that are not in BID_VALUES', () => {
    expect(errorOf(initialBidding(), 'middlehand', bid(19))).toBe('ILLEGAL_BID');
    expect(errorOf(initialBidding(), 'middlehand', bid(265))).toBe('ILLEGAL_BID');
  });

  it('rejects hold without a bid', () => {
    expect(errorOf(initialBidding(), 'middlehand', HOLD)).toBe('CANNOT_HOLD');
  });

  it('rejects hold by the caller and bids by the listener', () => {
    const state = run([['middlehand', bid(18)]]);
    expect(errorOf(state, 'forehand', bid(20))).toBe('ILLEGAL_BID');
    expect(errorOf(run([['middlehand', bid(18)], ['forehand', HOLD]]), 'forehand', HOLD)).toBe('NOT_YOUR_TURN');
    expect(errorOf(initialBidding(), 'middlehand', HOLD)).toBe('CANNOT_HOLD');
  });

  it('allows only the forehand to claim, and only in the claim stage', () => {
    expect(errorOf(initialBidding(), 'middlehand', CLAIM)).toBe('ILLEGAL_BID');
    expect(errorOf(run([['middlehand', PASS]]), 'hindhand', CLAIM)).toBe('ILLEGAL_BID');
  });

  it('lets the forehand claim 18 or pass in the claim stage', () => {
    const claim = run([['middlehand', PASS], ['hindhand', PASS]]);
    expect(errorOf(claim, 'forehand', bid(18))).toBe('ILLEGAL_BID');
    expect(errorOf(claim, 'forehand', HOLD)).toBe('CANNOT_HOLD');
    expect(applyBid(claim, 'forehand', PASS)).toMatchObject({ ok: true, value: { stage: 'passed-in' } });
    expect(applyBid(claim, 'forehand', CLAIM)).toMatchObject({ ok: true, value: { stage: 'done', currentBid: 18 } });
  });

  it('rejects every action once the bidding is over', () => {
    const done = run([['middlehand', bid(18)], ['forehand', PASS], ['hindhand', PASS]]);
    expect(errorOf(done, 'middlehand', PASS)).toBe('WRONG_PHASE');
    const passedIn = run([['middlehand', PASS], ['hindhand', PASS], ['forehand', PASS]]);
    expect(errorOf(passedIn, 'forehand', CLAIM)).toBe('WRONG_PHASE');
  });

  it('records every accepted action in the history', () => {
    const state = run([['middlehand', bid(18)], ['forehand', HOLD]]);
    expect(state.history).toEqual([
      { role: 'middlehand', type: 'bid', value: 18 },
      { role: 'forehand', type: 'hold' },
    ]);
  });

  it('does not mutate the input state', () => {
    const state = run([['middlehand', bid(18)]]);
    const before = snapshot(state);
    applyBid(state, 'forehand', PASS);
    applyBid(state, 'middlehand', bid(12));
    expect(state).toEqual(before);
  });
});

describe('legalBidValues', () => {
  it('offers all bid values to the caller at the start', () => {
    expect(legalBidValues(initialBidding())).toEqual([...BID_VALUES]);
  });

  it('offers only higher values after a bid', () => {
    const values = legalBidValues(run([['middlehand', bid(20)], ['forehand', HOLD]]));
    expect(values[0]).toBe(22);
    expect(values).not.toContain(20);
    expect(values).not.toContain(18);
  });

  it('is empty when it is not a bid situation', () => {
    expect(legalBidValues(run([['middlehand', bid(18)]]))).toEqual([]);
    expect(legalBidValues(run([['middlehand', PASS], ['hindhand', PASS]]))).toEqual([]);
    expect(legalBidValues(run([['middlehand', bid(18)], ['forehand', PASS], ['hindhand', PASS]]))).toEqual([]);
  });
});
