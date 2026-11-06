import { applyBid, biddingOutcome, initialBidding, legalBidValues } from './bidding';
import { declarationOptions, validateDeclaration } from './declaration';
import { deal } from './deck';
import { playCard } from './play';
import { legalCards, modeOf } from './trump';
import {
  assertNever,
  err,
  ok,
  type BidAction,
  type BiddingState,
  type CardId,
  type Declaration,
  type GameAction,
  type GameErrorCode,
  type GameState,
  type Result,
  type Role,
} from './types';

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

export function newGame(seed: number): GameState {
  const { hands, skat } = deal(seed);
  return {
    phase: 'bidding',
    hands,
    initialHands: hands,
    skat,
    bidding: initialBidding(),
    declarer: null,
    bid: null,
    pickedUpSkat: false,
    discarded: [],
    declaration: null,
    trick: { leader: 'forehand', plays: [] },
    tricks: [],
    turn: 'middlehand',
    result: null,
  };
}

export function isFinished(state: GameState): boolean {
  return state.phase === 'finished';
}

function wrongPhase(): Result<never, GameErrorCode> {
  return err('WRONG_PHASE', 'This action is not allowed in the current phase.');
}

function notYourTurn(): Result<never, GameErrorCode> {
  return err('NOT_YOUR_TURN', 'It is not your turn.');
}

function isBidAction(action: GameAction): action is BidAction {
  return action.type === 'bid' || action.type === 'hold' || action.type === 'pass' || action.type === 'claim';
}

export function applyAction(
  state: GameState,
  role: Role,
  action: GameAction,
): Result<GameState, GameErrorCode> {
  switch (state.phase) {
    case 'bidding':
      return applyBidding(state, role, action);
    case 'skat-decision':
      return applySkatDecision(state, role, action);
    case 'discarding':
      return applyDiscarding(state, role, action);
    case 'declaring':
      return applyDeclaring(state, role, action);
    case 'playing':
      return applyPlaying(state, role, action);
    case 'finished':
      return wrongPhase();
    default:
      return assertNever(state.phase);
  }
}

function applyBidding(
  state: GameState,
  role: Role,
  action: GameAction,
): Result<GameState, GameErrorCode> {
  if (!isBidAction(action)) {
    return wrongPhase();
  }
  const bidding = applyBid(state.bidding, role, action);
  if (!bidding.ok) {
    return bidding;
  }
  const next = bidding.value;
  const outcome = biddingOutcome(next);
  switch (outcome.kind) {
    case 'running':
      return ok({
        ...state,
        bidding: next,
        turn: next.awaiting === 'caller' ? next.caller : next.listener,
      });
    case 'declarer':
      return ok({
        ...state,
        bidding: next,
        phase: 'skat-decision',
        declarer: outcome.role,
        bid: outcome.bid,
        turn: outcome.role,
      });
    case 'passed-in':
      return ok({
        ...state,
        bidding: next,
        phase: 'finished',
        turn: null,
        result: { kind: 'passed-in' },
      });
    default:
      return assertNever(outcome);
  }
}

function applySkatDecision(
  state: GameState,
  role: Role,
  action: GameAction,
): Result<GameState, GameErrorCode> {
  if (action.type !== 'pickup-skat' && action.type !== 'play-hand') {
    return wrongPhase();
  }
  if (role !== state.turn) {
    return notYourTurn();
  }
  if (action.type === 'play-hand') {
    return ok({ ...state, phase: 'declaring' });
  }
  return ok({
    ...state,
    hands: { ...state.hands, [role]: [...state.hands[role], ...state.skat] },
    pickedUpSkat: true,
    phase: 'discarding',
  });
}

function applyDiscarding(
  state: GameState,
  role: Role,
  action: GameAction,
): Result<GameState, GameErrorCode> {
  if (action.type !== 'discard') {
    return wrongPhase();
  }
  if (role !== state.turn) {
    return notYourTurn();
  }
  const [a, b] = action.cards;
  const hand = state.hands[role];
  if (a === b || !hand.includes(a) || !hand.includes(b)) {
    return err('INVALID_DISCARD', 'Discard two different cards from your hand.');
  }
  return ok({
    ...state,
    hands: { ...state.hands, [role]: hand.filter((c) => c !== a && c !== b) },
    discarded: [a, b],
    phase: 'declaring',
  });
}

function applyDeclaring(
  state: GameState,
  role: Role,
  action: GameAction,
): Result<GameState, GameErrorCode> {
  if (action.type !== 'declare') {
    return wrongPhase();
  }
  if (role !== state.turn) {
    return notYourTurn();
  }
  const declared = validateDeclaration(action.declaration, !state.pickedUpSkat);
  if (!declared.ok) {
    return declared;
  }
  return ok({
    ...state,
    declaration: declared.value,
    phase: 'playing',
    trick: { leader: 'forehand', plays: [] },
    turn: 'forehand',
  });
}

function applyPlaying(
  state: GameState,
  role: Role,
  action: GameAction,
): Result<GameState, GameErrorCode> {
  if (action.type !== 'play') {
    return wrongPhase();
  }
  return playCard(state, role, action.card);
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
    case 'playing':
      return state.declaration === null
        ? {}
        : { playableCards: legalCards(state.hands[role], state.trick, modeOf(state.declaration)) };
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
