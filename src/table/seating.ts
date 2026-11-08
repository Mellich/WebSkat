// Seats and names: joining, leaving, dealer-pointer maintenance (docs/table.md §2).

import { err, ok, type Result } from '../engine';
import type { BotLevel, Player, PlayerId, TableState } from './types';

export const MIN_SEATS = 3;
export const MAX_SEATS = 6;
export const MAX_NAME_LENGTH = 20;

/** Every player at the table, seated or pending. */
export function allPlayers(s: TableState): Player[] {
  return [...s.players, ...s.pending];
}

export function touch(s: TableState): TableState {
  return { ...s, seq: s.seq + 1 };
}

/** `wanted` if free, otherwise "Name (2)", "Name (3)", ... (truncated to the name limit). */
export function uniqueName(existing: readonly string[], wanted: string): string {
  const base = wanted.trim();
  if (!existing.includes(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = ` (${String(n)})`;
    const candidate = `${base.slice(0, MAX_NAME_LENGTH - suffix.length).trimEnd()}${suffix}`;
    if (!existing.includes(candidate)) return candidate;
  }
}

/**
 * Adds a player. Seats immediately when no game is dealt, otherwise the player waits in `pending`.
 * An id that is already at the table reconnects that player instead.
 */
export function addPlayer(
  s: TableState,
  p: { readonly id: PlayerId; readonly name: string; readonly isBot?: boolean; readonly botLevel?: BotLevel },
): Result<TableState, 'TABLE_FULL' | 'INVALID_NAME'> {
  if (allPlayers(s).some((x) => x.id === p.id)) {
    return ok(setConnected(s, p.id, true));
  }
  const name = p.name.trim();
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
    return err('INVALID_NAME', `Names must have 1 to ${String(MAX_NAME_LENGTH)} characters.`);
  }
  const everyone = allPlayers(s);
  if (everyone.length >= s.maxSeats) {
    return err('TABLE_FULL', 'The table is full.');
  }
  const player: Player = {
    id: p.id,
    name: uniqueName(
      everyone.map((x) => x.name),
      name,
    ),
    connected: true,
    isBot: p.isBot ?? false,
    ...(p.isBot === true ? { botLevel: p.botLevel ?? 'normal' } : {}),
  };
  const next = s.game === null
    ? { ...s, players: [...s.players, player] }
    : { ...s, pending: [...s.pending, player] };
  return ok(touch(next));
}

/**
 * Removes a player from the seats or from `pending`. Keeps the dealer pointer on the same
 * upcoming dealer: a removed seat before the pointer shifts it down by one.
 */
export function removePlayer(s: TableState, id: PlayerId): TableState {
  const seat = s.players.findIndex((p) => p.id === id);
  const players = s.players.filter((p) => p.id !== id);
  let nextDealerIdx = s.nextDealerIdx;
  if (seat >= 0 && seat < nextDealerIdx) {
    nextDealerIdx -= 1;
  }
  return touch({
    ...s,
    players,
    pending: s.pending.filter((p) => p.id !== id),
    nextDealerIdx: nextDealerIdx % Math.max(1, players.length),
    ready: s.ready.filter((r) => r !== id),
  });
}

export function setConnected(s: TableState, id: PlayerId, connected: boolean): TableState {
  const update = (list: readonly Player[]): Player[] =>
    list.map((p) => (p.id === id ? { ...p, connected } : p));
  return touch({ ...s, players: update(s.players), pending: update(s.pending) });
}
