// Trystero binding of the Transport interface (docs/05-networking.md §2). Only the signaling
// strategy named in the config is imported, so the other one is not bundled.

import type * as NostrLib from 'trystero';
import { APP_ID } from './constants';
import type { SignalingConfig, TurnConfig } from './signalingConfig';
import type { Channel, RoomHandle, Transport } from './transport';

/** JSON data as Trystero's DataPayload expects it. */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type TrysteroRoom = ReturnType<typeof NostrLib.joinRoom>;
type JoinRoom = (roomId: string) => TrysteroRoom;

const CHANNELS: readonly Channel[] = ['cmd', 'msg', 'ad'];

function turnOptions(turn: TurnConfig | null): { turnConfig?: { urls: string; username?: string; credential?: string }[] } {
  if (turn === null) return {};
  return {
    turnConfig: [
      {
        urls: turn.url,
        ...(turn.username === undefined ? {} : { username: turn.username }),
        ...(turn.credential === undefined ? {} : { credential: turn.credential }),
      },
    ],
  };
}

function handleFor(room: TrysteroRoom, selfId: string): RoomHandle {
  const actions = {
    cmd: room.makeAction<Json>('cmd'),
    msg: room.makeAction<Json>('msg'),
    ad: room.makeAction<Json>('ad'),
  };
  const messageListeners: ((channel: Channel, data: unknown, from: string) => void)[] = [];
  const joinListeners: ((peer: string) => void)[] = [];
  const leaveListeners: ((peer: string) => void)[] = [];

  for (const channel of CHANNELS) {
    actions[channel].onMessage = (data, context) => {
      for (const cb of messageListeners) cb(channel, data, context.peerId);
    };
  }
  room.onPeerJoin = (peer) => {
    for (const cb of joinListeners) cb(peer);
  };
  room.onPeerLeave = (peer) => {
    for (const cb of leaveListeners) cb(peer);
  };

  return {
    selfId,
    peers: () => Object.keys(room.getPeers()),
    send(channel, data, target) {
      const options = target === undefined ? undefined : { target };
      actions[channel].send(data as Json, options).catch((error: unknown) => {
        console.warn('send failed', error);
      });
    },
    onMessage: (cb) => {
      messageListeners.push(cb);
    },
    onPeerJoin: (cb) => {
      joinListeners.push(cb);
    },
    onPeerLeave: (cb) => {
      leaveListeners.push(cb);
    },
    leave() {
      room.leave().catch((error: unknown) => {
        console.warn('leave failed', error);
      });
    },
  };
}

function transportOf(join: JoinRoom, selfId: string): Transport {
  return {
    join: (roomId) => handleFor(join(roomId), selfId),
  };
}

/** Builds the transport for the configured strategy; the library is loaded on demand. */
export async function createTrysteroTransport(config: SignalingConfig): Promise<Transport> {
  if (config.strategy === 'ws-relay') {
    const relayUrl = config.relayUrl;
    if (relayUrl === null) throw new Error('ws-relay needs a relay URL');
    const relay = await import('@trystero-p2p/ws-relay');
    const join: JoinRoom = (roomId) =>
      relay.joinRoom(
        { appId: APP_ID, relayConfig: { urls: [relayUrl] }, ...turnOptions(config.turn) },
        roomId,
      );
    return transportOf(join, relay.selfId);
  }
  const nostr = await import('trystero');
  const relayOptions = config.relayUrls.length > 0 ? { relayConfig: { urls: [...config.relayUrls] } } : {};
  const join: JoinRoom = (roomId) =>
    nostr.joinRoom({ appId: APP_ID, ...relayOptions, ...turnOptions(config.turn) }, roomId);
  return transportOf(join, nostr.selfId);
}
