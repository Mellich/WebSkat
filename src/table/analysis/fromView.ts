// Builds the analysis input from the view of a finished game (the result dialog's view).

import { ALL_CARDS, type CardId, type Role } from '../../engine';
import type { PlayerId } from '../types';
import type { TableView, ViewBidEvent } from '../viewTypes';
import { byRole } from './roles';
import type { AnalysisBid, AnalysisInput } from './types';

function bidOf(ev: ViewBidEvent, roleById: ReadonlyMap<PlayerId, Role>): AnalysisBid | null {
  const role = roleById.get(ev.playerId);
  if (role === undefined) return null;
  return ev.type === 'bid' && ev.value !== undefined
    ? { role, type: ev.type, value: ev.value }
    : { role, type: ev.type };
}

/** The analysis input of the finished game in `view`, or null while no finished game is shown. */
export function analysisInputFromView(view: TableView): AnalysisInput | null {
  const game = view.game;
  if (game === null || game.phase !== 'finished' || game.result === null || game.initialHands === null) {
    return null;
  }
  const roleById = new Map<PlayerId, Role>(
    (['forehand', 'middlehand', 'hindhand'] as const).map((r) => [game.roles[r], r]),
  );
  const declarerRole = game.declarerId === null ? null : (roleById.get(game.declarerId) ?? undefined);
  if (game.declarerId !== null && declarerRole === undefined) return null;

  const hands = byRole((r) => [...(game.initialHands?.[game.roles[r]] ?? [])]);
  const bidding: AnalysisBid[] = [];
  for (const ev of game.bidding.history) {
    const bid = bidOf(ev, roleById);
    if (bid === null) return null;
    bidding.push(bid);
  }
  const dealt = new Set<CardId>([...hands.forehand, ...hands.middlehand, ...hands.hindhand]);
  const skat = game.skat ?? ALL_CARDS.filter((c) => !dealt.has(c));

  return {
    version: 1,
    kind: game.result.kind,
    names: byRole((r) => view.table.players.find((p) => p.id === game.roles[r])?.name ?? '?'),
    hands,
    skat: [...skat],
    declarer: declarerRole ?? null,
    declaration: game.declaration,
    bid: game.bid,
    pickedUpSkat: game.pickedUpSkat,
    discarded: [...(game.discarded ?? [])],
    doubling: game.doubling,
    bidding,
    plays: (game.tricks ?? []).flatMap((t) => t.plays.map((p) => p.card)),
  };
}
