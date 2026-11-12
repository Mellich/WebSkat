// Test helper: a finished-game view for UI tests (players a = forehand, b = middlehand, c = hindhand).
// Not used by the app; tests override the fields they need.

import type { GameView, TableView } from '../../table';

export const FIXTURE_PLAYERS = [
  { id: 'a', name: 'Anna', connected: true, isBot: false, botLevel: null, seat: 0 },
  { id: 'b', name: 'Ben', connected: true, isBot: false, botLevel: null, seat: 1 },
  { id: 'c', name: 'Cem', connected: true, isBot: false, botLevel: null, seat: 2 },
] as const;

export function finishedGameFixture(overrides: Partial<GameView> = {}): GameView {
  return {
    number: 1,
    phase: 'finished',
    ramsch: false,
    bock: false,
    doubling: 1,
    dealerId: 'c',
    roles: { forehand: 'a', middlehand: 'b', hindhand: 'c' },
    sittingOut: [],
    turnId: null,
    waitingFor: null,
    bidding: { stage: 'done', callerId: 'a', listenerId: 'b', currentBid: 18, history: [] },
    declarerId: 'a',
    bid: 18,
    pickedUpSkat: true,
    declaration: null,
    myHand: [],
    openHands: {},
    initialHands: null,
    handCounts: { a: 0, b: 0, c: 0 },
    skat: null,
    discarded: null,
    trick: { leaderId: 'a', plays: [] },
    lastTrick: null,
    tricksWon: { a: 0, b: 0, c: 0 },
    legal: {},
    result: null,
    declarerSpitzen: null,
    ...overrides,
  };
}

export function tableViewFixture(game: GameView | null): TableView {
  return {
    seq: 1,
    log: [],
    table: {
      key: 'k',
      name: 'Table',
      hostId: 'a',
      maxSeats: 3,
      status: 'in-game',
      players: FIXTURE_PLAYERS.map((p) => ({ ...p })),
      pending: [],
      nextDealerId: null,
      readyIds: [],
      rules: { ramsch: false, bock: false, kontra: false },
      bockGamesLeft: 0,
    },
    you: { id: 'a', seat: 0, role: 'forehand' },
    game,
  };
}
