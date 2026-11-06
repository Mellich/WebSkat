import { BID_VALUES } from './values';
import {
  assertNever,
  err,
  ok,
  type BidAction,
  type BidEvent,
  type BiddingState,
  type GameErrorCode,
  type Result,
  type Role,
} from './types';

/** Value of a game won by a forehand claim (docs/03 §4.2). */
const CLAIM_VALUE = 18;

export type BiddingOutcome =
  | { readonly kind: 'running' }
  | { readonly kind: 'declarer'; readonly role: Role; readonly bid: number }
  | { readonly kind: 'passed-in' };

export function initialBidding(): BiddingState {
  return {
    stage: 1,
    caller: 'middlehand',
    listener: 'forehand',
    awaiting: 'caller',
    currentBid: null,
    history: [],
  };
}

function isRaise(value: number, currentBid: number | null): boolean {
  return BID_VALUES.includes(value) && value > (currentBid ?? 0);
}

function toEvent(role: Role, action: BidAction): BidEvent {
  switch (action.type) {
    case 'bid':
      return { role, type: 'bid', value: action.value };
    case 'hold':
      return { role, type: 'hold' };
    case 'pass':
      return { role, type: 'pass' };
    case 'claim':
      return { role, type: 'claim' };
    default:
      return assertNever(action);
  }
}

export function applyBid(
  b: BiddingState,
  role: Role,
  action: BidAction,
): Result<BiddingState, GameErrorCode> {
  if (b.stage === 'done' || b.stage === 'passed-in') {
    return err('WRONG_PHASE', 'The bidding is already over.');
  }
  const expected = b.awaiting === 'caller' ? b.caller : b.listener;
  if (role !== expected) {
    return err('NOT_YOUR_TURN', `It is the ${expected}'s turn to bid.`);
  }
  const history = [...b.history, toEvent(role, action)];
  return b.stage === 'claim' ? applyClaim(b, action, history) : applyStage(b, action, history);
}

function applyStage(
  b: BiddingState,
  action: BidAction,
  history: readonly BidEvent[],
): Result<BiddingState, GameErrorCode> {
  switch (action.type) {
    case 'bid':
      if (b.awaiting !== 'caller') {
        return err('ILLEGAL_BID', 'The listener must hold or pass.');
      }
      if (!isRaise(action.value, b.currentBid)) {
        return err('ILLEGAL_BID', `A bid of ${String(action.value)} is not allowed here.`);
      }
      return ok({ ...b, currentBid: action.value, awaiting: 'listener', history });
    case 'hold':
      if (b.awaiting !== 'listener' || b.currentBid === null) {
        return err('CANNOT_HOLD', 'There is no bid to hold.');
      }
      return ok({ ...b, awaiting: 'caller', history });
    case 'pass':
      return ok(endStage(b, b.awaiting === 'caller' ? b.listener : b.caller, history));
    case 'claim':
      return err('ILLEGAL_BID', 'Only the forehand may claim, after both others passed.');
    default:
      return assertNever(action);
  }
}

function applyClaim(
  b: BiddingState,
  action: BidAction,
  history: readonly BidEvent[],
): Result<BiddingState, GameErrorCode> {
  switch (action.type) {
    case 'claim':
      return ok({ ...b, stage: 'done', currentBid: CLAIM_VALUE, history });
    case 'pass':
      return ok({ ...b, stage: 'passed-in', history });
    case 'bid':
      return err('ILLEGAL_BID', 'The forehand may only claim 18 or pass.');
    case 'hold':
      return err('CANNOT_HOLD', 'There is no bid to hold.');
    default:
      return assertNever(action);
  }
}

/** Ends stage 1 or 2. In stage 'done' the `caller` field holds the declarer. */
function endStage(b: BiddingState, survivor: Role, history: readonly BidEvent[]): BiddingState {
  if (b.stage === 1) {
    return {
      stage: 2,
      caller: 'hindhand',
      listener: survivor,
      awaiting: 'caller',
      currentBid: b.currentBid,
      history,
    };
  }
  if (b.currentBid !== null) {
    return { ...b, stage: 'done', caller: survivor, awaiting: 'caller', history };
  }
  return {
    ...b,
    stage: 'claim',
    caller: 'forehand',
    listener: 'forehand',
    awaiting: 'caller',
    history,
  };
}

/** Values the caller may bid right now; [] when it is not a bid situation. */
export function legalBidValues(b: BiddingState): number[] {
  if ((b.stage !== 1 && b.stage !== 2) || b.awaiting !== 'caller') {
    return [];
  }
  return BID_VALUES.filter((value) => isRaise(value, b.currentBid));
}

export function biddingOutcome(b: BiddingState): BiddingOutcome {
  if (b.stage === 'passed-in') {
    return { kind: 'passed-in' };
  }
  if (b.stage === 'done' && b.currentBid !== null) {
    return { kind: 'declarer', role: b.caller, bid: b.currentBid };
  }
  return { kind: 'running' };
}
