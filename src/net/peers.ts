// Peer bookkeeping on the host: which transport peer (browser tab) holds which player seat
// (docs/networking.md §4). A player has at most one peer and a peer at most one player.

import type { PlayerId } from '../table';

export interface PeerMap {
  /** Binds `peer` to `id`; a previous binding of either side is dropped. */
  bind(peer: string, id: PlayerId): void;
  /** Forgets the peer of `id` (the seat stays). */
  unbindPlayer(id: PlayerId): void;
  playerOf(peer: string): PlayerId | undefined;
  peerOf(id: PlayerId): string | undefined;
  /** Forgets a peer that left; returns the player it was bound to, if any. */
  dropPeer(peer: string): PlayerId | undefined;
}

export function createPeerMap(): PeerMap {
  const peerOf = new Map<PlayerId, string>();
  const playerOf = new Map<string, PlayerId>();

  return {
    bind(peer, id) {
      const previousPeer = peerOf.get(id);
      if (previousPeer !== undefined && previousPeer !== peer) playerOf.delete(previousPeer);
      const previousId = playerOf.get(peer);
      if (previousId !== undefined && previousId !== id) peerOf.delete(previousId);
      playerOf.set(peer, id);
      peerOf.set(id, peer);
    },
    unbindPlayer(id) {
      const peer = peerOf.get(id);
      peerOf.delete(id);
      if (peer !== undefined) playerOf.delete(peer);
    },
    playerOf: (peer) => playerOf.get(peer),
    peerOf: (id) => peerOf.get(id),
    dropPeer(peer) {
      const id = playerOf.get(peer);
      if (id === undefined) return undefined;
      playerOf.delete(peer);
      peerOf.delete(id);
      return id;
    },
  };
}
