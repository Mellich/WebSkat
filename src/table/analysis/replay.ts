// Replays the card play of a finished game (or any line of play) with the engine's reducer.
// The UI only shows `Position.playable`; it never calls applyAction itself.

import {
  applyAction,
  cardPoints,
  err,
  getLegal,
  ok,
  playingStateFrom,
  type CardId,
  type CompletedTrick,
  type GameErrorCode,
  type GameState,
  type Result,
} from '../../engine';
import { byRole } from './roles';
import type { AnalysisInput, AnalysisLine, Position } from './types';

/** The game at its first card; null for a passed-in game (nothing was played). */
export function analysisStart(input: AnalysisInput): Result<GameState | null, GameErrorCode> {
  if (input.kind === 'passed-in') return ok(null);
  return playingStateFrom({
    hands: input.hands,
    skat: input.skat,
    ramsch: input.kind === 'ramsch',
    declarer: input.declarer,
    declaration: input.declaration,
    bid: input.bid,
    pickedUpSkat: input.pickedUpSkat,
    discarded: input.discarded,
    doubling: input.doubling,
  });
}

function pointsOf(trick: CompletedTrick): number {
  return trick.plays.reduce((sum, p) => sum + cardPoints(p.card), 0);
}

function positionOf(state: GameState): Position {
  const mover = state.turn;
  return {
    state,
    hands: state.hands,
    trick: state.trick,
    lastTrick: state.tricks.at(-1) ?? null,
    tricks: state.tricks,
    tricksWon: byRole((r) => state.tricks.filter((t) => t.winner === r).length),
    points: byRole((r) =>
      state.tricks.filter((t) => t.winner === r).reduce((sum, t) => sum + pointsOf(t), 0),
    ),
    mover,
    playable: mover === null ? [] : [...(getLegal(state, mover).playableCards ?? [])],
    result: state.result,
  };
}

/** Applies `plays` (in order) to `start`; an error if a card is not legal or the game is already over. */
export function positionAt(start: GameState, plays: readonly CardId[]): Result<Position, GameErrorCode> {
  let state = start;
  for (const card of plays) {
    const role = state.turn;
    if (role === null) return err('WRONG_PHASE', 'The game is over before the last card.');
    const next = applyAction(state, role, { type: 'play', card });
    if (!next.ok) return next;
    state = next.value;
  }
  return ok(positionOf(state));
}

/** The actual game as a line, cursor at the start. */
export function actualLine(input: AnalysisInput): AnalysisLine {
  return { plays: input.plays, cursor: 0 };
}

/** Plays `card` at the cursor: follows the line if it is the next card, else starts a variant there. */
export function chooseCard(line: AnalysisLine, card: CardId): AnalysisLine {
  const { plays, cursor } = line;
  if (plays[cursor] === card) return { plays, cursor: cursor + 1 };
  return { plays: [...plays.slice(0, cursor), card], cursor: cursor + 1 };
}

/** Index of the first card where `line` leaves the actual game, or null if it never does. */
export function divergenceAt(actual: readonly CardId[], line: AnalysisLine): number | null {
  for (let i = 0; i < line.plays.length; i++) {
    if (line.plays[i] !== actual[i]) return i;
  }
  return null;
}

/** Checks the whole input: it starts, and the actual plays replay without error. */
export function validateInput(input: AnalysisInput): Result<null, GameErrorCode> {
  const start = analysisStart(input);
  if (!start.ok) return start;
  if (start.value === null) {
    return input.plays.length === 0 ? ok(null) : err('WRONG_PHASE', 'A passed-in game has no card play.');
  }
  const replayed = positionAt(start.value, input.plays);
  return replayed.ok ? ok(null) : replayed;
}
