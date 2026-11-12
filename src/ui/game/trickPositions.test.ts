import { describe, expect, it } from 'vitest';
import type { GameView, PlayerPublic, TableView } from '../../table';
import { placeTrick, trickSeats } from './trickPositions';

function player(id: string, seat: number): PlayerPublic {
  return { id, name: id.toUpperCase(), connected: true, isBot: false, botLevel: null, seat };
}

function gameWith(roles: GameView['roles'], sittingOut: readonly string[]): GameView {
  return {
    number: 1,
    phase: 'playing',
    ramsch: false,
    bock: false,
    doubling: 1,
    dealerId: 'a',
    roles,
    sittingOut,
    turnId: null,
    waitingFor: null,
    bidding: {
      stage: 'done',
      callerId: roles.forehand,
      listenerId: roles.middlehand,
      currentBid: null,
      history: [],
    },
    declarerId: roles.forehand,
    bid: 18,
    pickedUpSkat: false,
    declaration: null,
    myHand: [],
    openHands: {},
    initialHands: null,
    handCounts: {},
    skat: null,
    discarded: null,
    trick: { leaderId: roles.forehand, plays: [] },
    lastTrick: null,
    tricksWon: {},
    legal: {},
    result: null,
    declarerSpitzen: null,
  };
}

function viewOf(players: readonly PlayerPublic[], you: string, game: GameView | null): TableView {
  return {
    seq: 1,
    log: [],
    table: {
      key: 'k',
      name: 'Table',
      hostId: 'a',
      maxSeats: players.length,
      status: 'in-game',
      players,
      pending: [],
      nextDealerId: null,
      readyIds: [],
      rules: { ramsch: false, bock: false, kontra: false },
      bockGamesLeft: 0,
    },
    you: { id: you, seat: players.findIndex((p) => p.id === you), role: 'middlehand' },
    game,
  };
}

const THREE = [player('a', 0), player('b', 1), player('c', 2)];

describe('trickSeats', () => {
  it('puts the viewer at the bottom and the next two players clockwise left and right', () => {
    // Viewer b; clockwise from b: c, then a.
    const game = gameWith({ forehand: 'a', middlehand: 'b', hindhand: 'c' }, []);
    expect(trickSeats(viewOf(THREE, 'b', game))).toEqual({ left: 'c', right: 'a', bottom: 'b' });
  });

  it('gives the bottom position to the third active player when the viewer sits out', () => {
    const four = [player('a', 0), player('b', 1), player('c', 2), player('d', 3)];
    // Viewer d sits out; clockwise from d: a, b, c.
    const game = gameWith({ forehand: 'a', middlehand: 'b', hindhand: 'c' }, ['d']);
    expect(trickSeats(viewOf(four, 'd', game))).toEqual({ left: 'a', right: 'b', bottom: 'c' });
  });

  it('has no positions without a running game', () => {
    expect(trickSeats(viewOf(THREE, 'a', null))).toEqual({ left: null, right: null, bottom: null });
  });
});

describe('placeTrick', () => {
  const seats = { left: 'c', right: 'a', bottom: 'b' };

  it('places each play by player id, whatever the order of play', () => {
    const plays = [{ playerId: 'a', card: 'CA' }, { playerId: 'b', card: 'C10' }, { playerId: 'c', card: 'SJ' }];
    const placed = placeTrick(plays, seats);
    expect(placed.left?.card).toBe('SJ');
    expect(placed.right?.card).toBe('CA');
    expect(placed.bottom?.card).toBe('C10');
  });

  it('leaves the positions of players who have not played empty', () => {
    const placed = placeTrick([{ playerId: 'c', card: 'SJ' }], seats);
    expect(placed).toEqual({ left: { playerId: 'c', card: 'SJ' }, right: null, bottom: null });
  });

  it('drops plays of unknown players', () => {
    const placed = placeTrick([{ playerId: 'z', card: 'SJ' }], seats);
    expect(placed).toEqual({ left: null, right: null, bottom: null });
  });
});
