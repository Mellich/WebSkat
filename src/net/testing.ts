// Test rig for host and clients on the in-memory network. Not exported from index.ts.

import { createClient } from './client';
import { type ConnectionEvent, type GameConnection } from './connection';
import { createFakeNetwork, type FakeNetwork } from './fake';
import { createHost, type Host } from './host';
import { createTable, type TableView } from '../table';

export const KEY = 'ABCD-EFGH';

export interface Rig {
  readonly net: FakeNetwork;
  readonly host: Host;
}

export function createRig(options: { maxSeats?: number; isPublic?: boolean; withLobby?: boolean } = {}): Rig {
  const net = createFakeNetwork();
  let ids = 0;
  let tokens = 0;
  const table = createTable({
    key: KEY,
    name: 'Friday game',
    isPublic: options.isPublic ?? false,
    hostId: 'host',
    hostName: 'Host',
    maxSeats: options.maxSeats ?? 6,
  });
  const host = createHost({
    transport: net.transportFor('H'),
    table,
    now: () => 1000,
    randomSeed: () => 7,
    randomId: () => `id${String(++ids)}`,
    randomToken: () => (++tokens).toString(16).padStart(32, '0'),
    ...(options.withLobby === true ? { lobby: net.transportFor('H') } : {}),
  });
  return { net, host };
}

export interface Joined {
  readonly connection: GameConnection;
  readonly events: ConnectionEvent[];
  readonly tokens: string[];
}

/** Connects a client from peer `peerId`; the events are recorded from the start. */
export function joinClient(rig: Rig, peerId: string, name: string, token?: string): Joined {
  const events: ConnectionEvent[] = [];
  const tokens: string[] = [];
  const connection = createClient({
    transport: rig.net.transportFor(peerId),
    key: KEY,
    name,
    ...(token === undefined ? {} : { token }),
    onToken: (t) => {
      tokens.push(t);
    },
  });
  connection.subscribe((e) => events.push(e));
  return { connection, events, tokens };
}

/** Delivers queued messages until nothing is left. */
export function settle(rig: Rig): void {
  rig.net.flush();
}

export function lastView(events: readonly ConnectionEvent[]): TableView | null {
  const views = events.filter((e): e is Extract<ConnectionEvent, { t: 'view' }> => e.t === 'view');
  return views.at(-1)?.view ?? null;
}

export function statusOf(events: readonly ConnectionEvent[]): string | null {
  const statuses = events.filter((e): e is Extract<ConnectionEvent, { t: 'status' }> => e.t === 'status');
  return statuses.at(-1)?.status ?? null;
}

export function errorsOf(events: readonly ConnectionEvent[]): string[] {
  return events.flatMap((e) => (e.t === 'error' ? [e.code] : []));
}
