// The game part of a view, as allowed for one viewer (allow-list; see viewTypes.ts).

import {
  ROLES,
  assertNever,
  countSpitzen,
  getLegal,
  type BidEvent,
  type CardId,
  type GameResult,
  type PlayMode,
  type Role,
  type Suit,
} from '../engine';
import { roleOf } from './rotation';
import type { ActiveGame, PlayerId, TableState } from './types';
import type {
  DeclarerSpitzen,
  GameView,
  SpitzenInfo,
  ViewBidEvent,
  ViewResult,
  ViewTrick,
} from './viewTypes';

function spitzenOf(twelve: readonly CardId[], mode: PlayMode): SpitzenInfo {
  return countSpitzen(twelve, mode) ?? { with: false, count: 0 };
}

/** Spitzen of the declarer's 12 original cards plus the Skat, for every trump option. */
function declarerSpitzen(game: ActiveGame, declarer: Role): DeclarerSpitzen {
  const e = game.engine;
  const twelve = [...e.initialHands[declarer], ...e.skat];
  const suit = (trump: Suit): SpitzenInfo => spitzenOf(twelve, { kind: 'suit', trump });
  return {
    grand: spitzenOf(twelve, { kind: 'grand' }),
    suit: { C: suit('C'), S: suit('S'), H: suit('H'), D: suit('D') },
  };
}

function byId(values: Readonly<Record<Role, number>>, idOf: (r: Role) => PlayerId): Record<PlayerId, number> {
  return Object.fromEntries(ROLES.map((r) => [idOf(r), values[r]]));
}

function viewResult(result: GameResult, idOf: (r: Role) => PlayerId): ViewResult {
  switch (result.kind) {
    case 'passed-in':
      return { kind: 'passed-in' };
    case 'played': {
      const { declarer, ...rest } = result;
      return { ...rest, declarerId: idOf(declarer) };
    }
    case 'ramsch':
      return {
        kind: 'ramsch',
        points: byId(result.points, idOf),
        tricks: byId(result.tricks, idOf),
        skatToId: idOf(result.skatTo),
        loserIds: result.losers.map(idOf),
        jungfrau: result.jungfrau,
        durchmarschId: result.durchmarsch === null ? null : idOf(result.durchmarsch),
        scores: byId(result.scores, idOf),
      };
    default:
      return assertNever(result);
  }
}

function viewBid(ev: BidEvent, idOf: (r: Role) => PlayerId): ViewBidEvent {
  const playerId = idOf(ev.role);
  return ev.type === 'bid' ? { playerId, type: 'bid', value: ev.value } : { playerId, type: ev.type };
}

function isDisconnected(s: TableState, id: PlayerId | null): boolean {
  if (id === null) return false;
  const player = [...s.players, ...s.pending].find((p) => p.id === id);
  return player !== undefined && !player.connected;
}

/** Ouvert declarer's hand, only while the game is being played (and after it, when empty). */
function openHands(game: ActiveGame, declarerId: PlayerId | null): Record<PlayerId, readonly CardId[]> {
  const e = game.engine;
  const declarer = e.declarer;
  if (declarer === null || declarerId === null || e.declaration?.ouvert !== true) return {};
  if (e.phase !== 'playing' && e.phase !== 'finished') return {};
  return { [declarerId]: e.hands[declarer] };
}

/** The game as seen by `viewer`. Every field is chosen explicitly. */
export function gameViewFor(s: TableState, game: ActiveGame, viewer: PlayerId): GameView {
  const e = game.engine;
  const idOf = (r: Role): PlayerId => game.roles[r];
  const viewerRole = roleOf(game, viewer);
  const declarer = e.declarer;
  const declarerId = declarer === null ? null : idOf(declarer);
  const turnId = e.turn === null ? null : idOf(e.turn);
  const finishedPlayed = e.phase === 'finished' && (declarer !== null || e.ramsch);
  const skatVisible = declarer !== null && viewerRole === declarer && e.pickedUpSkat &&
    (e.phase === 'discarding' || e.phase === 'declaring');
  const lastTrick = e.tricks.at(-1);
  const trickView = (plays: readonly { role: Role; card: CardId }[], leader: Role): ViewTrick => ({
    leaderId: idOf(leader),
    plays: plays.map((p) => ({ playerId: idOf(p.role), card: p.card })),
  });

  return {
    number: game.number,
    phase: e.phase,
    ramsch: e.ramsch,
    dealerId: game.dealerId,
    roles: game.roles,
    sittingOut: game.sittingOut,
    turnId,
    waitingFor: isDisconnected(s, turnId) ? turnId : null,
    bidding: {
      stage: e.bidding.stage,
      callerId: idOf(e.bidding.caller),
      listenerId: idOf(e.bidding.listener),
      currentBid: e.bidding.currentBid,
      history: e.bidding.history.map((ev) => viewBid(ev, idOf)),
    },
    declarerId,
    bid: e.bid,
    pickedUpSkat: e.pickedUpSkat,
    declaration: e.declaration,
    myHand: viewerRole === null ? [] : e.hands[viewerRole],
    openHands: openHands(game, declarerId),
    handCounts: Object.fromEntries(ROLES.map((r) => [idOf(r), e.hands[r].length])),
    skat: skatVisible || finishedPlayed ? e.skat : null,
    discarded: finishedPlayed ? e.discarded : null,
    trick: trickView(e.trick.plays, e.trick.leader),
    lastTrick: lastTrick === undefined
      ? null
      : { ...trickView(lastTrick.plays, lastTrick.leader), winnerId: idOf(lastTrick.winner) },
    tricksWon: Object.fromEntries(
      ROLES.map((r) => [idOf(r), e.tricks.filter((t) => t.winner === r).length]),
    ),
    legal: viewerRole === null ? {} : getLegal(e, viewerRole),
    result: e.result === null ? null : viewResult(e.result, idOf),
    declarerSpitzen: declarer !== null && viewerRole === declarer && e.phase === 'declaring'
      ? declarerSpitzen(game, declarer)
      : null,
  };
}
