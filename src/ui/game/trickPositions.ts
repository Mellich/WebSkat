// Where each card of the trick lies on the table: the player on the left, the player on the right
// and the viewer (or the third active player) at the bottom (docs/ui-game-screen.md §1).

import type { TableView } from '../../table';
import type { TrickPosition } from '../components/TrickArea';
import { opponentsOf } from './seats';

export interface TrickSeats {
  readonly left: string | null;
  readonly right: string | null;
  readonly bottom: string | null;
}

/** Who sits where around the trick for this viewer. Positions follow play order around the table only. */
export function trickSeats(view: TableView): TrickSeats {
  const game = view.game;
  if (game === null) return { left: null, right: null, bottom: null };
  const others = opponentsOf(view).active.map((s) => s.player.id);
  const left = others[0] ?? null;
  const right = others[1] ?? null;
  const viewerActive = Object.values(game.roles).includes(view.you.id);
  if (viewerActive) return { left, right, bottom: view.you.id };
  return { left, right, bottom: others[2] ?? null };
}

/** Puts each play at the position of the player who made it; plays of unknown players are dropped. */
export function placeTrick<T extends { readonly playerId: string }>(
  plays: readonly T[],
  seats: TrickSeats,
): Readonly<Record<TrickPosition, T | null>> {
  const at = (id: string | null): T | null => (id === null ? null : plays.find((p) => p.playerId === id) ?? null);
  return { left: at(seats.left), right: at(seats.right), bottom: at(seats.bottom) };
}
