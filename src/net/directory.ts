// Public table list: collects advertisements from the lobby room (docs/05-networking.md §6).
// An advertisement only says where a table is; joining always goes through the table room.

import { AD_TTL_MS, LOBBY_ROOM } from './constants';
import { AdSchema } from './protocol';
import type { Transport } from './transport';

export interface TableAd {
  readonly key: string;
  readonly name: string;
  readonly hostName: string;
  readonly seats: number;
  readonly maxSeats: number;
  readonly status: 'lobby' | 'in-game';
  readonly seenAt: number;
}

export interface Directory {
  stop(): void;
}

const PRUNE_INTERVAL_MS = 1000;

export function createDirectory(
  lobby: Transport,
  onChange: (tables: TableAd[]) => void,
  now: () => number = () => Date.now(),
): Directory {
  const room = lobby.join(LOBBY_ROOM);
  const entries = new Map<string, TableAd>();

  const notify = (): void => {
    const sorted = [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
    onChange(sorted);
  };

  room.onMessage((channel, data) => {
    if (channel !== 'ad') return;
    const parsed = AdSchema.safeParse(data);
    if (!parsed.success) return;
    const ad = parsed.data;
    entries.set(ad.key, {
      key: ad.key,
      name: ad.name,
      hostName: ad.hostName,
      seats: ad.seats,
      maxSeats: ad.maxSeats,
      status: ad.status,
      seenAt: now(),
    });
    notify();
  });

  const pruner = setInterval(() => {
    const cutoff = now() - AD_TTL_MS;
    let removed = false;
    for (const [key, ad] of entries) {
      if (ad.seenAt < cutoff) {
        entries.delete(key);
        removed = true;
      }
    }
    if (removed) notify();
  }, PRUNE_INTERVAL_MS);

  return {
    stop(): void {
      clearInterval(pruner);
      room.leave();
    },
  };
}
