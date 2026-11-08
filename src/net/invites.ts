// Invite codes for disconnected human players (docs/networking.md §4). Host-only secrets: they
// are returned to the host's own UI and stored in the host snapshot, never sent in a view.

import type { PlayerId } from '../table';
import { normalizeKey } from './keys';

export interface Invites {
  /** The code of `playerId`: the existing one, or a new one. Returned normalized. */
  create(playerId: PlayerId): string;
  /** Single use: returns the player of a known code and removes the code. */
  take(code: string): PlayerId | null;
  /** Drops every code of a player who left the table. */
  forget(playerId: PlayerId): void;
  toJSON(): Record<string, PlayerId>;
}

export function createInvites(initial: Readonly<Record<string, PlayerId>>, newCode: () => string): Invites {
  const byCode = new Map<string, PlayerId>(
    Object.entries(initial).map(([code, id]) => [normalizeKey(code), id]),
  );
  return {
    create(playerId) {
      for (const [code, id] of byCode) {
        if (id === playerId) return code;
      }
      const code = normalizeKey(newCode());
      byCode.set(code, playerId);
      return code;
    },
    take(code) {
      const normalized = normalizeKey(code);
      const id = byCode.get(normalized);
      if (id === undefined) return null;
      byCode.delete(normalized);
      return id;
    },
    forget(playerId) {
      for (const [code, id] of byCode) {
        if (id === playerId) byCode.delete(code);
      }
    },
    toJSON: () => Object.fromEntries(byCode),
  };
}
