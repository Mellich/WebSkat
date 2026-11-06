// In-memory network for tests. Messages are queued and delivered only by `flush()`, so tests
// control the order and can check the state between deliveries. Not used by the app.

import type { Channel, RoomHandle, Transport } from './transport';

type Event =
  | { readonly kind: 'message'; readonly to: string; readonly channel: Channel; readonly data: unknown; readonly from: string }
  | { readonly kind: 'join'; readonly to: string; readonly peer: string }
  | { readonly kind: 'leave'; readonly to: string; readonly peer: string };

interface Member {
  readonly peerId: string;
  onMessage: ((channel: Channel, data: unknown, from: string) => void) | null;
  onJoin: ((peer: string) => void) | null;
  onLeave: ((peer: string) => void) | null;
}

export interface FakeNetwork {
  transportFor(selfId: string): Transport;
  /** Delivers every queued event, including events queued by the handlers, in order. */
  flush(): void;
  /** Peers currently in a room (for assertions). */
  members(roomId: string): string[];
  /** Removes a peer from every room without a goodbye, like a crashed browser tab. */
  drop(peerId: string): void;
}

export function createFakeNetwork(): FakeNetwork {
  const rooms = new Map<string, Member[]>();
  const queue: Array<{ readonly roomId: string; readonly event: Event }> = [];

  const room = (roomId: string): Member[] => {
    const existing = rooms.get(roomId);
    if (existing !== undefined) return existing;
    const created: Member[] = [];
    rooms.set(roomId, created);
    return created;
  };

  const enqueue = (roomId: string, event: Event): void => {
    queue.push({ roomId, event });
  };

  const deliver = (roomId: string, event: Event): void => {
    const target = room(roomId).find((m) => m.peerId === event.to);
    if (target === undefined) return;
    if (event.kind === 'message') target.onMessage?.(event.channel, event.data, event.from);
    if (event.kind === 'join') target.onJoin?.(event.peer);
    if (event.kind === 'leave') target.onLeave?.(event.peer);
  };

  const transportFor = (selfId: string): Transport => ({
    join(roomId: string): RoomHandle {
      const members = room(roomId);
      const member: Member = {
        peerId: selfId,
        onMessage: null,
        onJoin: null,
        onLeave: null,
      };
      const handle: RoomHandle = {
        selfId,
        peers: () => room(roomId).filter((m) => m.peerId !== selfId).map((m) => m.peerId),
        send(channel, data, target) {
          const recipients = target === undefined
            ? room(roomId).filter((m) => m.peerId !== selfId).map((m) => m.peerId)
            : [target];
          for (const to of recipients) {
            enqueue(roomId, { kind: 'message', to, channel, data, from: selfId });
          }
        },
        onMessage: (cb) => {
          member.onMessage = cb;
        },
        onPeerJoin: (cb) => {
          member.onJoin = cb;
        },
        onPeerLeave: (cb) => {
          member.onLeave = cb;
        },
        leave() {
          const index = room(roomId).indexOf(member);
          if (index < 0) return;
          room(roomId).splice(index, 1);
          for (const other of room(roomId)) {
            enqueue(roomId, { kind: 'leave', to: other.peerId, peer: selfId });
          }
        },
      };
      for (const other of members) {
        enqueue(roomId, { kind: 'join', to: selfId, peer: other.peerId });
        enqueue(roomId, { kind: 'join', to: other.peerId, peer: selfId });
      }
      members.push(member);
      return handle;
    },
  });

  return {
    transportFor,
    flush() {
      for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
        deliver(next.roomId, next.event);
      }
    },
    members: (roomId) => room(roomId).map((m) => m.peerId),
    drop(peerId) {
      for (const [roomId, members] of rooms) {
        const index = members.findIndex((m) => m.peerId === peerId);
        if (index < 0) continue;
        members.splice(index, 1);
        for (const other of members) {
          enqueue(roomId, { kind: 'leave', to: other.peerId, peer: peerId });
        }
      }
    },
  };
}
