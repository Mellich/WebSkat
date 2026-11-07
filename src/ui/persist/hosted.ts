// Snapshots of the tables this browser hosts, so that a reload can resume them (docs/05 §9).
// A snapshot is our own data: it is checked for the parts the app reads (a shape guard), not for
// every field of the engine state, which would duplicate the engine's types.

import type { HostSnapshot } from '../../net';
import type { TableState } from '../../table';

const PREFIX = 'webskat.host.';

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length: number;
  key(index: number): string | null;
}

export function isTableState(value: unknown): value is TableState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<Record<keyof TableState, unknown>>;
  return (
    typeof v.key === 'string' &&
    typeof v.name === 'string' &&
    typeof v.hostId === 'string' &&
    Array.isArray(v.players) &&
    Array.isArray(v.pending) &&
    Array.isArray(v.records) &&
    typeof v.nextDealerIdx === 'number' &&
    typeof v.gameCounter === 'number' &&
    (v.game === null || typeof v.game === 'object')
  );
}

function isSnapshot(value: unknown): value is HostSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<Record<keyof HostSnapshot, unknown>>;
  return isTableState(v.table) && typeof v.tokens === 'object' && v.tokens !== null;
}

/**
 * The snapshot to resume a table from: every human starts disconnected (they come back with their
 * token), while the bots and the host's own seat stay as they are.
 */
export function resumableSnapshot(snapshot: HostSnapshot): HostSnapshot {
  const reseat = (players: TableState['players']): TableState['players'] =>
    players.map((p) => (p.isBot || p.id === snapshot.table.hostId ? p : { ...p, connected: false }));
  return {
    ...snapshot,
    table: { ...snapshot.table, players: reseat(snapshot.table.players), pending: reseat(snapshot.table.pending) },
  };
}

export function saveHostSnapshot(storage: KeyValueStorage, snapshot: HostSnapshot): void {
  storage.setItem(PREFIX + snapshot.table.key, JSON.stringify(snapshot));
}

export function loadHostSnapshot(storage: KeyValueStorage, key: string): HostSnapshot | null {
  const raw = storage.getItem(PREFIX + key);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function removeHostSnapshot(storage: KeyValueStorage, key: string): void {
  storage.removeItem(PREFIX + key);
}

/** Keys of all hosted tables that have a readable snapshot. */
export function listHostedKeys(storage: KeyValueStorage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const name = storage.key(i);
    if (name !== null && name.startsWith(PREFIX)) keys.push(name.slice(PREFIX.length));
  }
  return keys.filter((key) => loadHostSnapshot(storage, key) !== null);
}
