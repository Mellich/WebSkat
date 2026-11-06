// Transport abstraction: everything above this file is independent of Trystero, which makes it
// testable with an in-memory network (fake.ts). docs/05-networking.md §2.

/** Action names are short on purpose (≤ 12 bytes). */
export type Channel = 'cmd' | 'msg' | 'ad';

export interface RoomHandle {
  readonly selfId: string;
  peers(): string[];
  /** Without a target the message goes to every peer in the room. */
  send(channel: Channel, data: unknown, target?: string): void;
  onMessage(cb: (channel: Channel, data: unknown, fromPeerId: string) => void): void;
  onPeerJoin(cb: (peerId: string) => void): void;
  onPeerLeave(cb: (peerId: string) => void): void;
  leave(): void;
}

export interface Transport {
  join(roomId: string): RoomHandle;
}
