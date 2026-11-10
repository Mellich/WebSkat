// Table rules (skat-rules §12): set by the host while no game is running (docs/table.md §2).

import { err, ok, type Result } from '../engine';
import type { PlayerId, TableErrorCode, TableRules, TableState } from './types';
import { touch } from './seating';

export const DEFAULT_RULES: TableRules = { ramsch: false, bock: false, kontra: false };

/** Replaces all table rules; they apply from the next deal (skat-rules §12–§14). */
export function setRules(
  s: TableState,
  actor: PlayerId,
  rules: Pick<TableRules, 'ramsch' | 'bock' | 'kontra'>,
): Result<TableState, TableErrorCode> {
  if (actor !== s.hostId) return err('NOT_HOST', 'Only the host can do this.');
  if (s.game !== null && s.game.engine.phase !== 'finished') {
    return err('GAME_RUNNING', 'Wait until the game is finished.');
  }
  // Turning Bockrunden off ends the running Bock series (skat-rules §13).
  return ok(touch({ ...s, rules: { ...rules }, bockGamesLeft: rules.bock ? s.bockGamesLeft : 0 }));
}
