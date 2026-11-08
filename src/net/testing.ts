// Test rig for host and clients on the in-memory network. Not exported from index.ts.

import { createClient } from './client';
import { type ConnectionEvent, type GameConnection } from './connection';
import { createFakeNetwork, type FakeNetwork } from './fake';
import { createHost, type Host } from './host';
import { createTable, type TableCommand, type TableView } from '../table';
import { KEY_ALPHABET } from './keys';

export const KEY = 'ABCD-EFGH';

/** Matches the card ids that may appear in a view (docs/dev/testing.md §4). */
export const CARD_PATTERN = /\b[CSHD](?:7|8|9|10|J|Q|K|A)\b/g;

/** The next action the player offered by this view should send; null when the view offers none. */
export function nextCommand(view: TableView | null): TableCommand | null {
  const g = view?.game;
  if (g === null || g === undefined || g.phase === 'finished') return null;
  const legal = g.legal;
  if (legal.canClaim === true) return { type: 'game', action: { type: 'claim' } };
  if (legal.bidValues?.includes(18) === true && g.bidding.currentBid === null) {
    return { type: 'game', action: { type: 'bid', value: 18 } };
  }
  if (legal.canPassBid === true) return { type: 'game', action: { type: 'pass' } };
  if (legal.canPickUp === true) return { type: 'game', action: { type: 'pickup-skat' } };
  const discard = legal.discardFrom;
  if (discard !== undefined && discard.length >= 2) {
    const [a, b] = discard;
    if (a !== undefined && b !== undefined) return { type: 'game', action: { type: 'discard', cards: [a, b] } };
  }
  const declaration = legal.declarations?.[0];
  if (declaration !== undefined) return { type: 'game', action: { type: 'declare', declaration } };
  const card = legal.playableCards?.[0];
  if (card !== undefined) return { type: 'game', action: { type: 'play', card } };
  return null;
}

export interface Rig {
  readonly net: FakeNetwork;
  readonly host: Host;
}

/** Invite codes 1, 2, ... as valid 8-symbol keys (unique for every test table). */
function inviteCode(n: number): string {
  let rest = n;
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += KEY_ALPHABET[rest % 32] ?? '';
    rest = Math.floor(rest / 32);
  }
  return code;
}

export function createRig(options: { maxSeats?: number; isPublic?: boolean; withLobby?: boolean } = {}): Rig {
  const net = createFakeNetwork();
  let ids = 0;
  let tokens = 0;
  let invites = 0;
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
    randomInvite: () => inviteCode(++invites),
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
export function joinClient(rig: Rig, peerId: string, name: string, token?: string, invite?: string): Joined {
  const events: ConnectionEvent[] = [];
  const tokens: string[] = [];
  const connection = createClient({
    transport: rig.net.transportFor(peerId),
    key: KEY,
    name,
    ...(token === undefined ? {} : { token }),
    ...(invite === undefined ? {} : { invite }),
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
