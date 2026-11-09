// Table rules (skat-rules §12): set by the host while no game is running (docs/table.md §2).

import { err, ok, type Result } from '../engine';
import type { PlayerId, TableErrorCode, TableRules, TableState } from './types';
import { touch } from './seating';

export const DEFAULT_RULES: TableRules = { ramsch: false };

export function setRules(
  s: TableState,
  actor: PlayerId,
  rules: TableRules,
): Result<TableState, TableErrorCode> {
  if (actor !== s.hostId) return err('NOT_HOST', 'Only the host can do this.');
  if (s.game !== null && s.game.engine.phase !== 'finished') {
    return err('GAME_RUNNING', 'Wait until the game is finished.');
  }
  return ok(touch({ ...s, rules }));
}
