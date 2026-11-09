// The host controller: the one browser that owns the TableState (docs/networking.md §4–5).
// Clients send commands; the host validates them with the table reducer and broadcasts
// redacted views. Callbacks from the transport run one at a time, so `state` is only replaced
// synchronously inside a handler.

import { mulberry32 } from '../engine';
import {
  MAX_NAME_LENGTH,
  addPlayer,
  allPlayers,
  applyCommand,
  botStep,
  viewFor,
  type Ctx,
  type GameRecord,
  type PlayerId,
  type TableCommand,
  type TableState,
} from '../table';
import { startAdvertising } from './advertise';
import { PROTOCOL_VERSION, tableRoom } from './constants';
import { type Emitter, type GameConnection, createEmitter } from './connection';
import { createInvites, type Invites } from './invites';
import { generateKey } from './keys';
import { type HostMessage, type JoinMessage, ClientMessageSchema, recordMessage, viewMessage } from './protocol';
import { logJoined, setConnectedLogged } from './hostLog';
import { createPeerMap } from './peers';
import { randomBytes, randomHex } from './random';
import type { Channel, RoomHandle, Transport } from './transport';

export interface HostSnapshot {
  readonly table: TableState;
  readonly tokens: Readonly<Record<string, PlayerId>>;
  /** Unused invite codes (normalized) of disconnected players. */
  readonly invites?: Readonly<Record<string, PlayerId>>;
}

export interface HostOptions {
  readonly transport: Transport;
  readonly table: TableState;
  readonly tokens?: Readonly<Record<string, PlayerId>>;
  readonly invites?: Readonly<Record<string, PlayerId>>;
  readonly now: () => number;
  readonly randomSeed: () => number;

  readonly randomId?: () => string;
  readonly randomToken?: () => string;
  readonly randomInvite?: () => string;
  readonly persist?: (snapshot: HostSnapshot) => void;
  /** Transport for the lobby room; used only for public tables. */
  readonly lobby?: Transport;
}

export interface Host {
  readonly connection: GameConnection;
  stop(): void;
  getState(): TableState;
  snapshot(): HostSnapshot;
  /** An invite code for a disconnected human player; null for anybody else (docs/networking.md §4). */
  invite(playerId: PlayerId): string | null;
}

export function createHost(opts: HostOptions): Host {
  const hostId = opts.table.hostId;
  let state = opts.table;
  let stopped = false;

  const tokens = new Map<string, PlayerId>(Object.entries(opts.tokens ?? {}));
  const tokenOf = new Map<PlayerId, string>([...tokens].map(([token, id]) => [id, token]));
  const peers = createPeerMap();
  const warned = new Set<string>();
  const emitter: Emitter = createEmitter();
  const room: RoomHandle = opts.transport.join(tableRoom(state.key));
  const newId = opts.randomId ?? (() => randomHex(8));
  const newToken = opts.randomToken ?? (() => randomHex(16));
  const invites: Invites = createInvites(opts.invites ?? {}, opts.randomInvite ?? (() => generateKey(randomBytes)));
  const ctx = (): Ctx => ({ now: opts.now(), seed: opts.randomSeed() });

  const snapshot = (): HostSnapshot => ({
    table: state,
    tokens: Object.fromEntries(tokens),
    invites: invites.toJSON(),
  });
  const persist = (): void => opts.persist?.(snapshot());
  const sendTo = (peer: string, msg: HostMessage): void => {
    room.send('msg', msg, peer);
  };

  function broadcastViews(): void {
    emitter.emit({ t: 'view', view: viewFor(state, hostId) });
    for (const p of allPlayers(state)) {
      const peer = peers.peerOf(p.id);
      if (peer !== undefined && p.connected && !p.isBot) {
        sendTo(peer, viewMessage(viewFor(state, p.id)));
      }
    }
  }

  /** Remote clients get each new record; this browser's own listeners get the whole history. */
  function broadcastRecords(created: readonly GameRecord[]): void {
    for (const record of created) room.send('msg', recordMessage(record));
    emitter.emit({ t: 'records', records: [...state.records] });
  }

  function reportError(actor: PlayerId, code: string, message: string): void {
    if (actor === hostId) {
      emitter.emit({ t: 'error', code, message });
      return;
    }
    const peer = peers.peerOf(actor);
    if (peer !== undefined) sendTo(peer, { t: 'error', code, message });
  }

  function runBotTurns(recordsBefore: number): void {
    const rand = mulberry32(opts.randomSeed());
    for (let step = 0; step < 100_000 && !stopped; step++) {
      const next = botStep(state, ctx, rand);
      if (next === null) break;
      state = next;
      const created = state.records.slice(recordsBefore);
      if (created.length > 0) broadcastRecords(created);
      broadcastViews();
      persist();

    }
  }

  /** Forgets a player who left the table: its peer is told, its tokens and invites stop working. */
  function forgetPlayer(id: PlayerId): void {
    const peer = peers.peerOf(id);
    if (peer !== undefined) sendTo(peer, { t: 'kicked' });
    peers.unbindPlayer(id);
    for (const [token, owner] of tokens) {
      if (owner === id) tokens.delete(token);
    }
    tokenOf.delete(id);
    invites.forget(id);
  }

  function handleCommand(actor: PlayerId, command: TableCommand): void {
    const recordsBefore = state.records.length;
    const result = applyCommand(state, actor, command, ctx());
    if (!result.ok) {
      reportError(actor, result.error.code, result.error.message);
      return;
    }
    const before = allPlayers(state);
    state = result.value.state;
    if (command.type === 'kick' || command.type === 'replace-player') {
      const remaining = new Set(allPlayers(state).map((p) => p.id));
      for (const p of before) {
        if (!remaining.has(p.id)) forgetPlayer(p.id);
      }
    }
    const created = state.records.slice(recordsBefore);
    if (created.length > 0) broadcastRecords(created);
    broadcastViews();
    persist();
    runBotTurns(state.records.length);
  }

  function onJoin(peer: string, msg: JoinMessage): void {
    if (msg.v !== PROTOCOL_VERSION) {
      sendTo(peer, { t: 'rejected', reason: 'PROTOCOL_MISMATCH' });
      return;
    }
    const admitted = msg.invite !== undefined ? takeInvite(peer, msg.invite) : admitByToken(peer, msg.token, msg.name);
    if (!admitted) return;
    const id = peers.playerOf(peer);
    const token = id === undefined ? undefined : tokenOf.get(id);
    if (id === undefined || token === undefined) return;
    sendTo(peer, { t: 'welcome', v: PROTOCOL_VERSION, playerId: id, token });
    sendTo(peer, { t: 'records', records: [...state.records] });
    broadcastViews();
    persist();
  }

  /** Takes over a disconnected human's seat with a single-use invite; false when it is rejected. */
  function takeInvite(peer: string, code: string): boolean {
    const id = invites.take(code);
    const player = id === null ? undefined : allPlayers(state).find((p) => p.id === id);
    if (id === null || player === undefined || player.isBot || player.connected) {
      sendTo(peer, { t: 'rejected', reason: 'INVITE_INVALID' });
      return false;
    }
    issueToken(id);
    peers.bind(peer, id);
    state = setConnectedLogged(state, id, true, opts.now());
    return true;
  }

  /** A new token for `id`; the old tokens of that player stop working. */
  function issueToken(id: PlayerId): void {
    for (const [oldToken, owner] of tokens) {
      if (owner === id) tokens.delete(oldToken);
    }
    const token = newToken();
    tokens.set(token, id);
    tokenOf.set(id, token);
  }

  /** Re-binds a known token, or seats a new player. False when the table rejects the newcomer. */
  function admitByToken(peer: string, token: string | undefined, name: string): boolean {
    const known = token === undefined ? undefined : tokens.get(token);
    if (known !== undefined && allPlayers(state).some((p) => p.id === known)) {
      peers.bind(peer, known);
      state = setConnectedLogged(state, known, true, opts.now());
      return true;
    }
    if (peers.playerOf(peer) !== undefined) return true;
    const id = newId();
    const added = addPlayer(state, { id, name: name.trim().slice(0, MAX_NAME_LENGTH) });
    if (!added.ok) {
      sendTo(peer, { t: 'rejected', reason: added.error.code === 'TABLE_FULL' ? 'TABLE_FULL' : 'BAD_NAME' });
      return false;
    }
    state = logJoined(added.value, id, opts.now());
    issueToken(id);
    peers.bind(peer, id);
    return true;
  }

  function onMessage(channel: Channel, data: unknown, from: string): void {
    if (stopped || channel !== 'cmd') return;
    const parsed = ClientMessageSchema.safeParse(data);
    if (!parsed.success) {
      if (!warned.has(from)) {
        warned.add(from);
        console.warn('dropped an invalid message from a peer');
      }
      return;
    }
    const msg = parsed.data;
    if (msg.t === 'join') {
      onJoin(from, msg);
      return;
    }
    const actor = peers.playerOf(from);
    if (actor !== undefined) handleCommand(actor, msg.command);
  }

  function onPeerLeave(peer: string): void {
    const id = peers.dropPeer(peer);
    if (id === undefined) return;
    state = setConnectedLogged(state, id, false, opts.now());
    broadcastViews();
    persist();
  }

  // Public tables advertise themselves in the lobby room (directory.ts reads them).
  const advertising = opts.lobby !== undefined && state.isPublic
    ? startAdvertising({ lobby: opts.lobby, getState: () => state, hostId, now: opts.now })
    : null;

  room.onMessage(onMessage);
  room.onPeerLeave(onPeerLeave);
  emitter.emit({ t: 'status', status: 'connected' });
  emitter.emit({ t: 'records', records: [...state.records] });
  broadcastViews();

  const connection: GameConnection = {
    playerId: () => hostId,
    send: (command) => {
      if (!stopped) handleCommand(hostId, command);
    },
    subscribe: (listener) => emitter.subscribe(listener),
    leave: () => {
      stop();
    },
    close: () => {
      stop();
    },
  };

  function stop(): void {
    if (stopped) return;
    stopped = true;

    room.send('msg', { t: 'closed' });
    advertising?.stop();
    room.leave();
    emitter.emit({ t: 'status', status: 'closed' });
  }

  function invite(playerId: PlayerId): string | null {
    const player = allPlayers(state).find((p) => p.id === playerId);
    if (player === undefined || player.isBot || playerId === hostId || player.connected) return null;
    const code = invites.create(playerId);
    persist();
    return code;
  }

  return { connection, stop, getState: () => state, snapshot, invite };
}
