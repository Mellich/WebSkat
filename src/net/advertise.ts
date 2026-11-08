// Public tables advertise themselves in the lobby room; directory.ts reads them (docs/networking.md §6).

import { allPlayers, type PlayerId, type TableState } from '../table';
import { AD_INTERVAL_MS, LOBBY_ROOM, PROTOCOL_VERSION } from './constants';
import type { AdMessage } from './protocol';
import type { Transport } from './transport';

export interface AdvertiseOptions {
  readonly lobby: Transport;
  readonly getState: () => TableState;
  readonly hostId: PlayerId;
  readonly now: () => number;
}

/** Sends an ad every few seconds and to every new lobby peer. Full tables send nothing. */
export function startAdvertising(opts: AdvertiseOptions): { stop(): void } {
  const room = opts.lobby.join(LOBBY_ROOM);

  function advertise(target?: string): void {
    const state = opts.getState();
    const everyone = allPlayers(state);
    if (everyone.length >= state.maxSeats) return;
    const ad: AdMessage = {
      t: 'ad',
      v: PROTOCOL_VERSION,
      key: state.key,
      name: state.name,
      hostName: state.players.find((p) => p.id === opts.hostId)?.name ?? '',
      seats: everyone.length,
      maxSeats: state.maxSeats,
      status: state.status,
      ts: opts.now(),
    };
    room.send('ad', ad, target);
  }

  const timer = setInterval(() => {
    advertise();
  }, AD_INTERVAL_MS);
  room.onPeerJoin((peer) => {
    advertise(peer);
  });

  return {
    stop() {
      clearInterval(timer);
      room.leave();
    },
  };
}
