import { applyBid, biddingOutcome, initialBidding } from './bidding';
import { applyDoubling, openDoubling } from './doubling';
import { validateDeclaration } from './declaration';
import { deal } from './deck';
import { playCard } from './play';
import {
  assertNever,
  err,
  ok,
  type BidAction,
  type GameAction,
  type GameErrorCode,
  type GameOptions,
  type GameState,
  DEFAULT_GAME_OPTIONS,
  type Result,
  type Role,
} from './types';

export { enumerateActions, getLegal, type Legal } from './legal';

export function newGame(seed: number, options: GameOptions = DEFAULT_GAME_OPTIONS): GameState {
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
    doubling: 1,
    doublePassed: [],
    trick: { leader: 'forehand', plays: [] },
    tricks: [],
    turn: 'middlehand',
    result: null,
    options,
    ramsch: false,
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
    case 'doubling':
      return applyDoubling(state, role, action);
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
      if (state.options.ramschOnPassIn) {
        return ok({
          ...state,
          bidding: next,
          phase: 'playing',
          ramsch: true,
          trick: { leader: 'forehand', plays: [] },
          turn: 'forehand',
        });
      }
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
  if (state.declarer === null) {
    return wrongPhase();
  }
  return ok(openDoubling({ ...state, declaration: declared.value }, state.declarer));
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
