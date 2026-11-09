// Game-log entries for connection events, written by the host (docs/networking.md §4, plan 10).
// Each helper returns the state unchanged when there is nothing to log.

import { allPlayers, appendLog, setConnected, type PlayerId, type TableState } from '../table';

/** A new player was seated or queued: `joined` with the stored name. */
export function logJoined(s: TableState, id: PlayerId, now: number): TableState {
  const player = allPlayers(s).find((p) => p.id === id);
  if (player === undefined) return s;
  return appendLog(
    s,
    [{ kind: 'joined', playerId: id, name: player.name, isBot: player.isBot, pending: s.pending.some((p) => p.id === id) }],
    now,
  );
}

/**
 * Connects or disconnects a player and logs the change. Only a real change is logged, so a second
 * tab of a connected player, or a peer that leaves after `leave`, adds no entry.
 */
export function setConnectedLogged(s: TableState, id: PlayerId, connected: boolean, now: number): TableState {
  const player = allPlayers(s).find((p) => p.id === id);
  const next = setConnected(s, id, connected);
  if (player === undefined || player.connected === connected) return next;
  return appendLog(next, [{ kind: connected ? 'reconnected' : 'disconnected', playerId: id, name: player.name }], now);
}
