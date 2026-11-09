import { playModeOf } from './ramsch';
import { scoreGame } from './scoring';
import { legalCards, trickWinner } from './trump';
import {
  assertNever,
  err,
  ok,
  type CardId,
  type GameErrorCode,
  type GameState,
  type Result,
  type Role,
} from './types';

const TRICKS_PER_GAME = 10;
const CARDS_PER_TRICK = 3;

export function nextRole(r: Role): Role {
  switch (r) {
    case 'forehand':
      return 'middlehand';
    case 'middlehand':
      return 'hindhand';
    case 'hindhand':
      return 'forehand';
    default:
      return assertNever(r);
  }
}

export function playCard(
  state: GameState,
  role: Role,
  card: CardId,
): Result<GameState, GameErrorCode> {
  const mode = playModeOf(state);
  if (state.phase !== 'playing' || mode === null) {
    return err('WRONG_PHASE', 'Cards can only be played during the play phase.');
  }
  if (role !== state.turn) {
    return err('NOT_YOUR_TURN', 'It is not your turn to play.');
  }
  const hand = state.hands[role];
  if (!hand.includes(card)) {
    return err('ILLEGAL_CARD', 'That card is not in your hand.');
  }
  if (!legalCards(hand, state.trick, mode).includes(card)) {
    return err('ILLEGAL_CARD', 'You must follow the led suit if you can.');
  }

  const hands = { ...state.hands, [role]: hand.filter((c) => c !== card) };
  const leader = state.trick.leader;
  const plays = [...state.trick.plays, { role, card }];
  if (plays.length < CARDS_PER_TRICK) {
    return ok({ ...state, hands, trick: { leader, plays }, turn: nextRole(role) });
  }

  const winner = trickWinner({ leader, plays }, mode);
  const tricks = [...state.tricks, { leader, plays, winner }];
  const next: GameState = {
    ...state,
    hands,
    trick: { leader: winner, plays: [] },
    tricks,
    turn: winner,
  };
  const nullEndedByDeclarer = state.declaration?.kind === 'null' && winner === state.declarer;
  if (!nullEndedByDeclarer && tricks.length < TRICKS_PER_GAME) {
    return ok(next);
  }
  const finished: GameState = { ...next, phase: 'finished', turn: null };
  return ok({ ...finished, result: scoreGame(finished) });
}
