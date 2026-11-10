// Kontra and Re (skat-rules §14): the doubling window between the declaration and the first card.
// Defenders in seat order may say Kontra (once, level 2) or no-double; then the declarer may say
// Re (level 4) or no-double. The window closes when the play starts.

import { err, ok, ROLES, type GameAction, type GameErrorCode, type GameState, type Result, type Role } from './types';

/** The two defenders (skat-rules §2): every active role but the declarer. */
export function defendersOf(declarer: Role): Role[] {
  return ROLES.filter((r) => r !== declarer);
}

/**
 * Opens the window after a declaration when the table rule is on: the first defender in seat
 * order is asked. Without the rule the play starts at once.
 */
export function openDoubling(state: GameState, declarer: Role): GameState {
  if (!state.options.kontra) return startPlay(state);
  return {
    ...state,
    phase: 'doubling',
    doubling: 1,
    doublePassed: [],
    turn: defendersOf(declarer)[0] ?? null,
  };
}

/** Closes the window: the play starts with forehand leading. */
function startPlay(state: GameState): GameState {
  return { ...state, phase: 'playing', trick: { leader: 'forehand', plays: [] }, turn: 'forehand' };
}

function wrongPhase(): Result<never, GameErrorCode> {
  return err('WRONG_PHASE', 'This action is not allowed in the current phase.');
}

function notYourTurn(): Result<never, GameErrorCode> {
  return err('NOT_YOUR_TURN', 'It is not your turn.');
}

/** Applies Kontra, Re or no-double (any other action is a wrong phase). */
export function applyDoubling(
  state: GameState,
  role: Role,
  action: GameAction,
): Result<GameState, GameErrorCode> {
  const declarer = state.declarer;
  if (declarer === null || (action.type !== 'kontra' && action.type !== 're' && action.type !== 'no-double')) {
    return wrongPhase();
  }
  if (role !== state.turn) {
    return notYourTurn();
  }
  switch (action.type) {
    case 'kontra':
      if (state.doubling !== 1) return wrongPhase();
      return ok({ ...state, doubling: 2, turn: declarer });
    case 're':
      if (state.doubling !== 2 || role !== declarer) return wrongPhase();
      return ok(startPlay({ ...state, doubling: 4 }));
    case 'no-double': {
      if (state.doubling === 2) return ok(startPlay(state));
      const passed = [...state.doublePassed, role];
      const next = defendersOf(declarer).find((r) => !passed.includes(r));
      if (next === undefined) return ok(startPlay({ ...state, doublePassed: passed }));
      return ok({ ...state, doublePassed: passed, turn: next });
    }
    default:
      return wrongPhase();
  }
}
