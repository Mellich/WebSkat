// Geberskat seating (docs/03-skat-rules.md §9): forehand, middlehand and hindhand follow the
// dealer; everybody else sits out. With 3 players nobody sits out.

import { ROLES, type Role } from '../engine';
import type { ActiveGame, Player, PlayerId } from './types';

/** Seat index of the first dealer, chosen from the seed (decision D21). */
export function pickFirstDealer(seed: number, n: number): number {
  return seed % n;
}

/** Seats that sit out for a dealer at `dealerIdx`. */
export function sittingOutSeats(n: number, dealerIdx: number): number[] {
  if (n <= 3) return [];
  const seats = [dealerIdx];
  for (let offset = 4; offset < n; offset++) {
    seats.push((dealerIdx + offset) % n);
  }
  return seats;
}

export interface Rotation {
  readonly roles: Readonly<Record<Role, PlayerId>>;
  readonly sittingOut: PlayerId[];
  readonly dealerId: PlayerId;
}

export function rolesForDealer(players: readonly Player[], dealerIdx: number): Rotation {
  const n = players.length;
  if (n < 3 || n > 6) {
    throw new Error(`rolesForDealer needs 3 to 6 players, got ${String(n)}`);
  }
  const seatId = (seat: number): PlayerId => {
    const player = players[seat % n];
    if (player === undefined) {
      throw new Error(`no player at seat ${String(seat)}`);
    }
    return player.id;
  };
  return {
    roles: {
      forehand: seatId(dealerIdx + 1),
      middlehand: seatId(dealerIdx + 2),
      hindhand: seatId(dealerIdx + 3),
    },
    sittingOut: sittingOutSeats(n, dealerIdx).map(seatId),
    dealerId: seatId(dealerIdx),
  };
}

/** The role a seated player has in a game, or null when sitting out or not in the game. */
export function roleOf(game: ActiveGame, playerId: PlayerId): Role | null {
  return ROLES.find((role) => game.roles[role] === playerId) ?? null;
}
