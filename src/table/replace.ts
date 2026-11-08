// Replacing a seated player by a waiting player or a bot (docs/table.md §2, plan 07).
// The seat index, the roles and the engine state stay; only the person holding them changes.

import { err, ok, type Result } from '../engine';
import { allPlayers, touch, uniqueName } from './seating';
import type { ActiveGame, Player, PlayerId, ReplaceBy, TableErrorCode, TableState } from './types';

function newcomer(s: TableState, by: ReplaceBy): Player | null {
  if (by.kind === 'bot') {
    return {
      id: `bot-${String(s.seq)}`,
      name: uniqueName(
        allPlayers(s).map((p) => p.name),
        'Bot',
      ),
      connected: true,
      isBot: true,
      botLevel: by.level,
    };
  }
  return s.pending.find((p) => p.id === by.playerId) ?? null;
}

function takeOverGame(game: ActiveGame, target: PlayerId, newId: PlayerId): ActiveGame {
  const mapId = (id: PlayerId): PlayerId => (id === target ? newId : id);
  return {
    ...game,
    roles: {
      forehand: mapId(game.roles.forehand),
      middlehand: mapId(game.roles.middlehand),
      hindhand: mapId(game.roles.hindhand),
    },
    sittingOut: game.sittingOut.map(mapId),
    dealerId: mapId(game.dealerId),
  };
}

/**
 * The host gives `target`'s seat to `by`. The target is removed from the table; its reconnect
 * token and invites are dropped by the host (src/net). Bots are always ready, so a bot
 * replacement can complete a finished game's "continue" round (the caller deals if so).
 */
export function replacePlayer(
  s: TableState,
  actor: PlayerId,
  target: PlayerId,
  by: ReplaceBy,
): Result<TableState, TableErrorCode> {
  if (actor !== s.hostId) return err('NOT_HOST', 'Only the host can do this.');
  if (target === s.hostId) return err('CANNOT_KICK_HOST', 'The host cannot be replaced.');
  const seat = s.players.findIndex((p) => p.id === target);
  if (seat < 0) return err('UNKNOWN_PLAYER', 'No such player at this table.');
  const incoming = newcomer(s, by);
  if (incoming === null) return err('UNKNOWN_PLAYER', 'No such waiting player.');

  const players = s.players.map((p, i) => (i === seat ? incoming : p));
  const pending = by.kind === 'pending' ? s.pending.filter((p) => p.id !== incoming.id) : s.pending;
  const ready = s.ready.filter((id) => id !== target);
  const withReady = incoming.isBot && !ready.includes(incoming.id) ? [...ready, incoming.id] : ready;
  return ok(
    touch({
      ...s,
      players,
      pending,
      ready: withReady,
      game: s.game === null ? null : takeOverGame(s.game, target, incoming.id),
    }),
  );
}
