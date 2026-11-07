// Seat arrangement relative to the viewer: the next player in play order is on the left.

import type { Role } from '../../engine';
import type { PlayerPublic, TableView } from '../../table';

export interface SeatedView {
  readonly player: PlayerPublic;
  readonly role: Role | 'sitting-out' | null;
  readonly isDealer: boolean;
}

export function namesById(view: TableView): ReadonlyMap<string, string> {
  return new Map([...view.table.players, ...view.table.pending].map((p) => [p.id, p.name]));
}

/** Players other than the viewer, in clockwise order from the viewer, with their roles. */
export function opponentsOf(view: TableView): { readonly active: SeatedView[]; readonly sittingOut: SeatedView[] } {
  const game = view.game;
  const players = view.table.players;
  if (game === null) return { active: [], sittingOut: [] };
  const viewerSeat = players.findIndex((p) => p.id === view.you.id);
  const start = viewerSeat < 0 ? 0 : viewerSeat;
  const ordered = players
    .map((_, k) => players[(start + k) % players.length])
    .filter((p): p is PlayerPublic => p !== undefined && p.id !== view.you.id);
  const roleOf = (id: string): Role | null => {
    const entry = (Object.entries(game.roles) as [Role, string][]).find(([, pid]) => pid === id);
    return entry === undefined ? null : entry[0];
  };
  const seated = (p: PlayerPublic): SeatedView => ({
    player: p,
    role: roleOf(p.id) ?? (game.sittingOut.includes(p.id) ? 'sitting-out' : null),
    isDealer: p.id === game.dealerId,
  });
  return {
    active: ordered.filter((p) => roleOf(p.id) !== null).map(seated),
    sittingOut: ordered.filter((p) => game.sittingOut.includes(p.id)).map(seated),
  };
}
