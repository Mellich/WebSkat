// The host controller: the one browser that owns the TableState (docs/05-networking.md §4–5).
// Clients send commands; the host validates them with the table reducer and broadcasts
// redacted views. Callbacks from the transport run one at a time, so `state` is only replaced
// synchronously inside a handler.

import { mulberry32 } from '../engine';
import {
  MAX_NAME_LENGTH,
  addPlayer,
  allPlayers,
  applyCommand,
  runBots,
  setConnected,
  viewFor,
  type Ctx,
  type GameRecord,
  type PlayerId,
  type TableCommand,
  type TableState,
} from '../table';
import { AD_INTERVAL_MS, LOBBY_ROOM, PROTOCOL_VERSION, tableRoom } from './constants';
import { type Emitter, type GameConnection, createEmitter } from './connection';
import { type AdMessage, type HostMessage, type JoinMessage, ClientMessageSchema, recordMessage, viewMessage } from './protocol';
import { randomHex } from './random';
import type { Channel, RoomHandle, Transport } from './transport';

export interface HostSnapshot {
  readonly table: TableState;
  readonly tokens: Readonly<Record<string, PlayerId>>;
}

export interface HostOptions {
  readonly transport: Transport;
  readonly table: TableState;
  readonly tokens?: Readonly<Record<string, PlayerId>>;
  readonly now: () => number;
  readonly randomSeed: () => number;
  readonly randomId?: () => string;
  readonly randomToken?: () => string;
  readonly persist?: (snapshot: HostSnapshot) => void;
  /** Transport for the lobby room; used only for public tables. */
  readonly lobby?: Transport;
}

export interface Host {
  readonly connection: GameConnection;
  stop(): void;
  getState(): TableState;
  snapshot(): HostSnapshot;
}

export function createHost(opts: HostOptions): Host {
  const hostId = opts.table.hostId;
  let state = opts.table;
  let stopped = false;
  const tokens = new Map<string, PlayerId>(Object.entries(opts.tokens ?? {}));
  const tokenOf = new Map<PlayerId, string>([...tokens].map(([token, id]) => [id, token]));
  const peerOf = new Map<PlayerId, string>();
  const playerOf = new Map<string, PlayerId>();
  const warned = new Set<string>();
  const emitter: Emitter = createEmitter();
  const room: RoomHandle = opts.transport.join(tableRoom(state.key));
  const newId = opts.randomId ?? (() => randomHex(8));
  const newToken = opts.randomToken ?? (() => randomHex(16));
  const ctx = (): Ctx => ({ now: opts.now(), seed: opts.randomSeed() });

  const snapshot = (): HostSnapshot => ({ table: state, tokens: Object.fromEntries(tokens) });
  const persist = (): void => opts.persist?.(snapshot());
  const sendTo = (peer: string, msg: HostMessage): void => {
    room.send('msg', msg, peer);
  };

  function bind(peer: string, id: PlayerId): void {
    const previousPeer = peerOf.get(id);
    if (previousPeer !== undefined && previousPeer !== peer) playerOf.delete(previousPeer);
    const previousId = playerOf.get(peer);
    if (previousId !== undefined && previousId !== id) peerOf.delete(previousId);
    playerOf.set(peer, id);
    peerOf.set(id, peer);
  }

  function unbind(id: PlayerId): void {
    const peer = peerOf.get(id);
    peerOf.delete(id);
    if (peer !== undefined) playerOf.delete(peer);
  }

  function broadcastViews(): void {
    emitter.emit({ t: 'view', view: viewFor(state, hostId) });
    for (const p of allPlayers(state)) {
      const peer = peerOf.get(p.id);
      if (peer !== undefined && p.connected && !p.isBot) {
        sendTo(peer, viewMessage(viewFor(state, p.id)));
      }
    }
  }

  function broadcastRecord(record: GameRecord): void {
    emitter.emit({ t: 'record', record });
    room.send('msg', recordMessage(record));
  }

  function reportError(actor: PlayerId, code: string, message: string): void {
    if (actor === hostId) {
      emitter.emit({ t: 'error', code, message });
      return;
    }
    const peer = peerOf.get(actor);
    if (peer !== undefined) sendTo(peer, { t: 'error', code, message });
  }

  function handleCommand(actor: PlayerId, command: TableCommand): void {
    const recordsBefore = state.records.length;
    const result = applyCommand(state, actor, command, ctx());
    if (!result.ok) {
      reportError(actor, result.error.code, result.error.message);
      return;
    }
    state = result.value.state;
    if (command.type === 'kick' && !allPlayers(state).some((p) => p.id === command.playerId)) {
      const peer = peerOf.get(command.playerId);
      if (peer !== undefined) sendTo(peer, { t: 'kicked' });
      unbind(command.playerId);
    }
    state = runBots(state, ctx, mulberry32(opts.randomSeed()));
    for (const record of state.records.slice(recordsBefore)) broadcastRecord(record);
    broadcastViews();
    persist();
  }

  function onJoin(peer: string, msg: JoinMessage): void {
    if (msg.v !== PROTOCOL_VERSION) {
      sendTo(peer, { t: 'rejected', reason: 'PROTOCOL_MISMATCH' });
      return;
    }
    const known = msg.token === undefined ? undefined : tokens.get(msg.token);
    if (known !== undefined && allPlayers(state).some((p) => p.id === known)) {
      bind(peer, known);
      state = setConnected(state, known, true);
    } else if (!playerOf.has(peer)) {
      const id = newId();
      const name = msg.name.trim().slice(0, MAX_NAME_LENGTH);
      const added = addPlayer(state, { id, name });
      if (!added.ok) {
        sendTo(peer, { t: 'rejected', reason: added.error.code === 'TABLE_FULL' ? 'TABLE_FULL' : 'BAD_NAME' });
        return;
      }
      state = added.value;
      const token = newToken();
      tokens.set(token, id);
      tokenOf.set(id, token);
      bind(peer, id);
    }
    const id = playerOf.get(peer);
    const token = id === undefined ? undefined : tokenOf.get(id);
    if (id === undefined || token === undefined) return;
    sendTo(peer, { t: 'welcome', v: PROTOCOL_VERSION, playerId: id, token });
    sendTo(peer, { t: 'records', records: [...state.records] });
    broadcastViews();
    persist();
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
    const actor = playerOf.get(from);
    if (actor !== undefined) handleCommand(actor, msg.command);
  }

  function onPeerLeave(peer: string): void {
    const id = playerOf.get(peer);
    if (id === undefined) return;
    playerOf.delete(peer);
    peerOf.delete(id);
    state = setConnected(state, id, false);
    broadcastViews();
    persist();
  }

  // Public tables advertise themselves in the lobby room (directory.ts reads them).
  const lobby = opts.lobby !== undefined && state.isPublic ? opts.lobby.join(LOBBY_ROOM) : null;
  function advertise(target?: string): void {
    if (lobby === null) return;
    const everyone = allPlayers(state);
    if (everyone.length >= state.maxSeats) return;
    const ad: AdMessage = {
      t: 'ad',
      v: PROTOCOL_VERSION,
      key: state.key,
      name: state.name,
      hostName: state.players.find((p) => p.id === hostId)?.name ?? '',
      seats: everyone.length,
      maxSeats: state.maxSeats,
      status: state.status,
      ts: opts.now(),
    };
    lobby.send('ad', ad, target);
  }
  const adTimer = lobby === null ? null : setInterval(() => {
    advertise();
  }, AD_INTERVAL_MS);
  lobby?.onPeerJoin((peer) => {
    advertise(peer);
  });

  room.onMessage(onMessage);
  room.onPeerLeave(onPeerLeave);
  emitter.emit({ t: 'status', status: 'connected' });
  broadcastViews();

  const connection: GameConnection = {
    playerId: () => hostId,
    send: (command) => {
      if (!stopped) handleCommand(hostId, command);
    },
    subscribe: (listener) => emitter.subscribe(listener),
    close: () => {
      stop();
    },
  };

  function stop(): void {
    if (stopped) return;
    stopped = true;
    room.send('msg', { t: 'closed' });
    if (adTimer !== null) clearInterval(adTimer);
    lobby?.leave();
    room.leave();
    emitter.emit({ t: 'status', status: 'closed' });
  }

  return { connection, stop, getState: () => state, snapshot };
}
