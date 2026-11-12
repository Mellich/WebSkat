// A table can play a limited number of games (a "series"); the host may add rounds afterwards.

import { err, ok, type Result } from '../engine';
import { touch } from './seating';
import type { PlayerId, TableErrorCode, TableState } from './types';

export const MAX_GAME_LIMIT = 999;

/** True when a limit is set and that many games are finished. */
export function seriesDone(s: TableState): boolean {
  return s.gameLimit > 0 && s.records.length >= s.gameLimit;
}

/** `set-game-limit`: host, no game running. 0 = unlimited. The value is clamped to 0..999. */
export function setGameLimit(
  s: TableState,
  actor: PlayerId,
  limit: number,
): Result<TableState, TableErrorCode> {
  if (actor !== s.hostId) return err('NOT_HOST', 'Only the host can do this.');
  if (s.game !== null && s.game.engine.phase !== 'finished') {
    return err('GAME_RUNNING', 'Wait until the game is finished.');
  }
  const clamped = Math.min(MAX_GAME_LIMIT, Math.max(0, Math.floor(Number.isFinite(limit) ? limit : 0)));
  return ok(touch({ ...s, gameLimit: clamped }));
}

/**
 * `add-rounds`: host, after the last game of the series. One round = one game per seated player,
 * so every player deals once more. Reopens a finished series (the caller then tries to deal).
 */
export function addRounds(s: TableState, actor: PlayerId): Result<TableState, TableErrorCode> {
  if (actor !== s.hostId) return err('NOT_HOST', 'Only the host can do this.');
  if (s.game === null || s.game.engine.phase !== 'finished' || !seriesDone(s)) {
    return err('WRONG_STATUS', 'The series is not over yet.');
  }
  const limit = Math.min(MAX_GAME_LIMIT, s.records.length + s.players.length);
  return ok(touch({ ...s, gameLimit: limit, seriesOver: false }));
}
