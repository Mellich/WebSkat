// viewFor(state, viewer): the only thing that leaves the host towards a client (docs/02 §3).

import { roleOf } from './rotation';
import type { PlayerId, TableState } from './types';
import { gameViewFor } from './viewGame';
import type { PlayerPublic, TableView } from './viewTypes';

function publicPlayer(p: TableState['players'][number], seat: number | null): PlayerPublic {
  return { id: p.id, name: p.name, connected: p.connected, isBot: p.isBot, seat };
}

function youFor(s: TableState, viewer: PlayerId): TableView['you'] {
  const seatIndex = s.players.findIndex((p) => p.id === viewer);
  const seat = seatIndex >= 0 ? seatIndex : null;
  const game = s.game;
  if (game !== null) {
    const role = roleOf(game, viewer);
    if (role !== null) return { id: viewer, seat, role };
    if (game.sittingOut.includes(viewer)) return { id: viewer, seat, role: 'sitting-out' };
  }
  if (s.pending.some((p) => p.id === viewer)) return { id: viewer, seat, role: 'pending' };
  return { id: viewer, seat, role: 'lobby' };
}

function nextDealerId(s: TableState): PlayerId | null {
  if (s.players.length === 0) return null;
  return s.players[s.nextDealerIdx % s.players.length]?.id ?? null;
}

export function viewFor(s: TableState, viewer: PlayerId): TableView {
  return {
    seq: s.seq,
    table: {
      key: s.key,
      name: s.name,
      hostId: s.hostId,
      maxSeats: s.maxSeats,
      botLevel: s.botLevel,
      status: s.status,
      players: s.players.map((p, seat) => publicPlayer(p, seat)),
      pending: s.pending.map((p) => publicPlayer(p, null)),
      nextDealerId: nextDealerId(s),
      readyIds: [...s.ready],
    },
    you: youFor(s, viewer),
    game: s.game === null ? null : gameViewFor(s, s.game, viewer),
  };
}
