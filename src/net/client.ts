// The client controller (docs/networking.md §6). Sends commands to the host and renders the
// views it receives. It never changes game state itself.

import type { TableCommand } from '../table';
import { JOIN_TIMEOUT_MS, LEAVE_CLOSE_DELAY_MS, PROTOCOL_VERSION, tableRoom } from './constants';
import { type ConnectionStatus, type Emitter, type GameConnection, createEmitter } from './connection';
import { type ClientMessage, HostMessageSchema, cmdMessage } from './protocol';
import type { RoomHandle, Transport } from './transport';

export interface ClientOptions {
  readonly transport: Transport;
  readonly key: string;
  readonly name: string;
  readonly token?: string;
  readonly onToken: (token: string, playerId: string) => void;
}

export function createClient(opts: ClientOptions): GameConnection {
  const emitter: Emitter = createEmitter();
  const room: RoomHandle = opts.transport.join(tableRoom(opts.key));
  let hostPeer: string | null = null;
  let playerId: string | null = null;
  let token: string | undefined = opts.token;
  let closed = false;
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;
  // After a kick or a closed table the seat is gone for good: do not re-join when other peers arrive.
  let ended = false;

  const setStatus = (status: ConnectionStatus, reason?: string): void => {
    emitter.emit(reason === undefined ? { t: 'status', status } : { t: 'status', status, reason });
  };

  function close(): void {
    if (closed) return;
    closed = true;
    clearTimeout(joinTimer);
    clearTimeout(leaveTimer);
    room.leave();
    setStatus('closed');
  }

  const joinTimer = setTimeout(() => {
    if (hostPeer === null && !closed && emitter.latestStatus() === 'connecting') {
      setStatus('rejected', 'TIMEOUT');
    }
  }, JOIN_TIMEOUT_MS);

  function sendJoin(peer: string): void {
    const join: ClientMessage = token === undefined
      ? { t: 'join', v: PROTOCOL_VERSION, name: opts.name }
      : { t: 'join', v: PROTOCOL_VERSION, name: opts.name, token };
    room.send('cmd', join, peer);
  }

  function onHostMessage(from: string, data: unknown): void {
    const parsed = HostMessageSchema.safeParse(data);
    if (!parsed.success) return;
    const msg = parsed.data;
    if (hostPeer === null) {
      if (msg.t === 'welcome') {
        hostPeer = from;
        playerId = msg.playerId;
        token = msg.token;
        clearTimeout(joinTimer);
        setStatus('connected');
        opts.onToken(msg.token, msg.playerId);
      } else if (msg.t === 'rejected' && emitter.latestStatus() === 'connecting') {
        clearTimeout(joinTimer);
        setStatus('rejected', msg.reason);
      }
      return;
    }
    if (from !== hostPeer) return;
    switch (msg.t) {
      case 'view':
        emitter.emit({ t: 'view', view: msg.view });
        return;
      case 'records':
        emitter.emit({ t: 'records', records: msg.records });
        return;
      case 'record':
        emitter.emit({ t: 'record', record: msg.record });
        return;
      case 'error':
        emitter.emit({ t: 'error', code: msg.code, message: msg.message });
        return;
      case 'kicked':
        hostPeer = null;
        ended = true;
        setStatus('kicked');
        return;
      case 'closed':
        hostPeer = null;
        ended = true;
        setStatus('closed');
        return;
      case 'welcome':
      case 'rejected':
        return;
      default: {
        const unused: never = msg;
        return unused;
      }
    }
  }

  room.onMessage((channel, data, from) => {
    if (!closed && channel === 'msg') onHostMessage(from, data);
  });
  room.onPeerJoin((peer) => {
    if (!closed && !ended) sendJoin(peer);
  });
  room.onPeerLeave((peer) => {
    if (closed || peer !== hostPeer) return;
    hostPeer = null;
    setStatus('host-lost');
  });
  for (const peer of room.peers()) sendJoin(peer);
  setStatus('connecting');

  return {
    playerId: () => playerId,
    send(command: TableCommand): void {
      if (hostPeer === null) {
        emitter.emit({ t: 'error', code: 'NOT_CONNECTED', message: 'The host is not reachable.' });
        return;
      }
      room.send('cmd', cmdMessage(command), hostPeer);
    },
    subscribe: (listener) => emitter.subscribe(listener),
    leave(): void {
      if (closed || leaveTimer !== undefined) return;
      if (hostPeer !== null && !ended) {
        room.send('cmd', cmdMessage({ type: 'leave' }), hostPeer);
      }
      ended = true;
      leaveTimer = setTimeout(close, LEAVE_CLOSE_DELAY_MS);
    },
    close,
  };
}
