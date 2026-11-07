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

/** The listeners of one handle on a shared room. */
interface Listeners {
  readonly messages: ((channel: Channel, data: unknown, from: string) => void)[];
  readonly joins: ((peer: string) => void)[];
  readonly leaves: ((peer: string) => void)[];
}

/**
 * One Trystero room with its actions and its listeners. Several handles may be attached to it; the
 * room is left when the last one leaves.
 */
function sharedRoom(room: TrysteroRoom, selfId: string, onEmpty: () => void): { attach(): RoomHandle } {
  const actions = {
    cmd: room.makeAction<Json>('cmd'),
    msg: room.makeAction<Json>('msg'),
    ad: room.makeAction<Json>('ad'),
  };
  const members = new Set<Listeners>();

  for (const channel of CHANNELS) {
    actions[channel].onMessage = (data, context) => {
      for (const member of members) {
        for (const cb of member.messages) cb(channel, data, context.peerId);
      }
    };
  }
  room.onPeerJoin = (peer) => {
    for (const member of members) {
      for (const cb of member.joins) cb(peer);
    }
  };
  room.onPeerLeave = (peer) => {
    for (const member of members) {
      for (const cb of member.leaves) cb(peer);
    }
  };

  return {
    attach() {
      const mine: Listeners = { messages: [], joins: [], leaves: [] };
      members.add(mine);
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
          mine.messages.push(cb);
        },
        onPeerJoin: (cb) => {
          mine.joins.push(cb);
        },
        onPeerLeave: (cb) => {
          mine.leaves.push(cb);
        },
        leave() {
          if (!members.delete(mine)) return;
          if (members.size > 0) return;
          onEmpty();
          room.leave().catch((error: unknown) => {
            console.warn('leave failed', error);
          });
        },
      };
    },
  };
}

/**
 * Trystero returns the same room object for every join of one room id, and leaving it ends the room
 * for everybody. The app joins the lobby room twice in one tab (the table list and an advertised
 * table), so each id gets one Trystero room here, shared by all handles.
 */
function transportOf(join: JoinRoom, selfId: string): Transport {
  const open = new Map<string, { attach(): RoomHandle }>();
  return {
    join(roomId) {
      let shared = open.get(roomId);
      if (shared === undefined) {
        shared = sharedRoom(join(roomId), selfId, () => {
          open.delete(roomId);
        });
        open.set(roomId, shared);
      }
      return shared.attach();
    },
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
