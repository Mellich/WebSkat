import { legalBidValues } from './bidding';
import { declarationOptions } from './declaration';
import { legalCards } from './trump';
import { playModeOf } from './ramsch';
import { assertNever, type BiddingState, type CardId, type Declaration, type GameAction, type GameState, type Role } from './types';

/** Information for the acting role. Absent fields mean "not allowed". */
export interface Legal {
  bidValues?: number[] | undefined;
  canPassBid?: boolean | undefined;
  canHold?: boolean | undefined;
  canClaim?: boolean | undefined;
  canPickUp?: boolean | undefined;
  canPlayHand?: boolean | undefined;
  discardFrom?: CardId[] | undefined;
  declarations?: Declaration[] | undefined;
  playableCards?: CardId[] | undefined;
}

function biddingLegal(b: BiddingState): Legal {
  if (b.stage === 'claim') {
    return { canPassBid: true, canClaim: true };
  }
  if (b.stage === 'done' || b.stage === 'passed-in') {
    return {};
  }
  if (b.awaiting === 'caller') {
    return { bidValues: legalBidValues(b), canPassBid: true };
  }
  return { canPassBid: true, canHold: true };
}

/** Legal options for `role`; empty object when `role` is not on turn. */
export function getLegal(state: GameState, role: Role): Legal {
  if (state.turn !== role) {
    return {};
  }
  switch (state.phase) {
    case 'bidding':
      return biddingLegal(state.bidding);
    case 'skat-decision':
      return { canPickUp: true, canPlayHand: true };
    case 'discarding':
      return { discardFrom: [...state.hands[role]] };
    case 'declaring':
      return { declarations: declarationOptions(!state.pickedUpSkat) };
    case 'playing': {
      const mode = playModeOf(state);
      return mode === null ? {} : { playableCards: legalCards(state.hands[role], state.trick, mode) };
    }
    case 'finished':
      return {};
    default:
      return assertNever(state.phase);
  }
}

/** Every action `role` may take right now. Empty for roles not on turn. */
export function enumerateActions(state: GameState, role: Role): GameAction[] {
  const legal = getLegal(state, role);
  const actions: GameAction[] = [];
  for (const value of legal.bidValues ?? []) {
    actions.push({ type: 'bid', value });
  }
  if (legal.canHold) {
    actions.push({ type: 'hold' });
  }
  if (legal.canPassBid) {
    actions.push({ type: 'pass' });
  }
  if (legal.canClaim) {
    actions.push({ type: 'claim' });
  }
  if (legal.canPickUp) {
    actions.push({ type: 'pickup-skat' });
  }
  if (legal.canPlayHand) {
    actions.push({ type: 'play-hand' });
  }
  const pool = legal.discardFrom ?? [];
  pool.forEach((a, i) => {
    for (const b of pool.slice(i + 1)) {
      actions.push({ type: 'discard', cards: [a, b] });
    }
  });
  for (const declaration of legal.declarations ?? []) {
    actions.push({ type: 'declare', declaration });
  }
  for (const card of legal.playableCards ?? []) {
    actions.push({ type: 'play', card });
  }
  return actions;
}
