import { describe, expect, it } from 'vitest';
import { mulberry32, type Role } from '../engine';
import { addPlayer, setConnected } from './seating';
import { ctxFor, randomStep, tableWith } from './testing';
import { applyCommand } from './table';
import type { Ctx, PlayerId, TableCommand, TableState } from './types';
import { viewFor } from './view';

const CTX: Ctx = ctxFor(42, 1000);

function step(s: TableState, actor: PlayerId, c: TableCommand): TableState {
  const result = applyCommand(s, actor, c, CTX);
  if (!result.ok) throw new Error(`${c.type} by ${actor} rejected: ${result.error.code}`);
  return result.value.state;
}

function game(s: TableState): NonNullable<TableState['game']> {
  if (s.game === null) throw new Error('no game');
  return s.game;
}

function idOf(s: TableState, role: Role): PlayerId {
  return game(s).roles[role];
}

const started = (n = 3): TableState => step(tableWith(n), 'p0', { type: 'start' });

/** With seed 42 and three players: dealer p0, forehand p1, middlehand p2, hindhand p0. */
/** Middlehand bids 18, both others pass; middlehand picks up the Skat (discarding phase). */
function declarerPickedUp(): TableState {
  let s = started(3);
  s = step(s, 'p2', { type: 'game', action: { type: 'bid', value: 18 } });
  s = step(s, 'p1', { type: 'game', action: { type: 'pass' } });
  s = step(s, 'p0', { type: 'game', action: { type: 'pass' } });
  return step(s, 'p2', { type: 'game', action: { type: 'pickup-skat' } });
}

describe('lobby and seats', () => {
  it('shows the lobby to a seated player with the seat number', () => {
    const view = viewFor(tableWith(3), 'p1');
    expect(view.game).toBeNull();
    expect(view.you).toEqual({ id: 'p1', seat: 1, role: 'lobby' });
    expect(view.table.players.map((p) => p.seat)).toEqual([0, 1, 2]);
    expect(view.table.nextDealerId).toBe('p0');
  });

  it('shows strangers as lobby visitors without a seat or cards', () => {
    const view = viewFor(started(3), 'stranger');
    expect(view.you).toEqual({ id: 'stranger', seat: null, role: 'lobby' });
    expect(view.game?.myHand).toEqual([]);
    expect(view.game?.legal).toEqual({});
  });

  it('marks a player who joins during a game as pending', () => {
    const added = addPlayer(started(3), { id: 'late', name: 'Late' });
    if (!added.ok) throw new Error(added.error.message);
    const view = viewFor(added.value, 'late');
    expect(view.you).toEqual({ id: 'late', seat: null, role: 'pending' });
    expect(view.table.pending.map((p) => p.id)).toEqual(['late']);
  });

  it('marks the dealer of a 4-player table as sitting out, without cards', () => {
    const s = started(4);
    const dealer = game(s).dealerId;
    const view = viewFor(s, dealer);
    expect(view.you.role).toBe('sitting-out');
    expect(view.game?.myHand).toEqual([]);
  });
});

describe('what one viewer sees of the cards', () => {
  it('gives the active player their own hand and the bidding options on turn', () => {
    const s = started(3);
    const view = viewFor(s, idOf(s, 'middlehand'));
    expect(view.you.role).toBe('middlehand');
    expect(view.game?.myHand).toEqual(game(s).engine.hands.middlehand);
    expect(view.game?.legal.bidValues).toEqual([18]);
    expect(view.game?.legal.canPassBid).toBe(true);
  });

  it('gives a player off turn their own hand but no legal moves', () => {
    const s = started(3);
    const view = viewFor(s, idOf(s, 'forehand'));
    expect(view.game?.legal).toEqual({});
    expect(view.game?.myHand).toEqual(game(s).engine.hands.forehand);
  });

  it('shows only the hand counts of the others', () => {
    const s = started(3);
    const view = viewFor(s, idOf(s, 'forehand'));
    expect(Object.values(view.game?.handCounts ?? {})).toEqual([10, 10, 10]);
    for (const card of game(s).engine.hands.middlehand) {
      expect(JSON.stringify(view.game?.myHand)).not.toContain(card);
    }
  });

  it('names the turn holder as waiting when that player is disconnected', () => {
    const s = started(3);
    const m = idOf(s, 'middlehand');
    expect(viewFor(s, 'p0').game?.waitingFor).toBeNull();
    expect(viewFor(setConnected(s, m, false), 'p0').game?.waitingFor).toBe(m);
  });
});

describe('Skat and Spitzen', () => {
  it('shows the picked-up Skat only to the declarer', () => {
    const s = declarerPickedUp();
    expect(s.game?.engine.phase).toBe('discarding');
    expect(viewFor(s, 'p2').game?.skat).toEqual(game(s).engine.skat);
    expect(viewFor(s, 'p1').game?.skat).toBeNull();
  });

  it('shows the declarer Spitzen for every trump option while declaring', () => {
    let s = declarerPickedUp();
    const [a, b] = game(s).engine.hands.middlehand;
    s = step(s, 'p2', { type: 'game', action: { type: 'discard', cards: [a ?? 'C7', b ?? 'C8'] } });
    expect(game(s).engine.phase).toBe('declaring');
    const spitzen = viewFor(s, 'p2').game?.declarerSpitzen;
    expect(Object.keys(spitzen?.suit ?? {}).sort()).toEqual(['C', 'D', 'H', 'S']);
    expect(viewFor(s, 'p1').game?.declarerSpitzen).toBeNull();
  });

  it('shows the Hand declarer no Skat before the declaration', () => {
    let s = started(3);
    s = step(s, 'p2', { type: 'game', action: { type: 'bid', value: 18 } });
    s = step(s, 'p1', { type: 'game', action: { type: 'pass' } });
    s = step(s, 'p0', { type: 'game', action: { type: 'pass' } });
    s = step(s, 'p2', { type: 'game', action: { type: 'play-hand' } });
    expect(viewFor(s, 'p2').game?.skat).toBeNull();
    expect(viewFor(s, 'p2').game?.declarerSpitzen).not.toBeNull();
  });
});

describe('open hands of an ouvert declarer', () => {
  it('shows the declarer hand to everybody during an ouvert Null Hand game', () => {
    let s = started(3);
    s = step(s, 'p2', { type: 'game', action: { type: 'bid', value: 18 } });
    s = step(s, 'p1', { type: 'game', action: { type: 'hold' } });
    s = step(s, 'p2', { type: 'game', action: { type: 'bid', value: 20 } });
    s = step(s, 'p1', { type: 'game', action: { type: 'hold' } });
    s = step(s, 'p2', { type: 'game', action: { type: 'bid', value: 22 } });
    s = step(s, 'p1', { type: 'game', action: { type: 'hold' } });
    s = step(s, 'p2', { type: 'game', action: { type: 'bid', value: 23 } });
    s = step(s, 'p1', { type: 'game', action: { type: 'pass' } });
    s = step(s, 'p0', { type: 'game', action: { type: 'pass' } });
    s = step(s, 'p2', { type: 'game', action: { type: 'play-hand' } });
    s = step(s, 'p2', {
      type: 'game',
      action: { type: 'declare', declaration: { kind: 'null', hand: true, ouvert: true } },
    });
    const hand = game(s).engine.hands.middlehand;
    expect(viewFor(s, 'stranger').game?.openHands).toEqual({ p2: hand });
    expect(viewFor(s, 'p1').game?.openHands).toEqual({ p2: hand });
  });

  it('shows no open hands in a normal game', () => {
    const s = declarerPickedUp();
    expect(viewFor(s, 'p1').game?.openHands).toEqual({});
  });
});

describe('finished games', () => {
  it('shows a passed-in game without Skat or discards', () => {
    let s = started(3);
    for (const id of ['p2', 'p0', 'p1']) {
      s = step(s, id, { type: 'game', action: { type: 'pass' } });
    }
    const view = viewFor(s, 'stranger');
    expect(view.game?.result).toEqual({ kind: 'passed-in' });
    expect(view.game?.skat).toBeNull();
    expect(view.game?.discarded).toBeNull();
  });

  it('reveals the Skat and the discards to a stranger once a played game ends', () => {
    const rand = mulberry32(3);
    let s = declarerPickedUp();
    const [a, b] = game(s).engine.hands.middlehand;
    s = step(s, 'p2', { type: 'game', action: { type: 'discard', cards: [a ?? 'C7', b ?? 'C8'] } });
    s = step(s, 'p2', { type: 'game', action: { type: 'declare', declaration: { kind: 'suit', trump: 'H', hand: false, announce: 'none', ouvert: false } } });
    for (let i = 0; i < 500 && game(s).engine.phase !== 'finished'; i++) {
      const next = randomStep(s, CTX, rand);
      if (next === null) break;
      s = next;
    }
    const view = viewFor(s, 'stranger');
    expect(view.game?.result?.kind).toBe('played');
    expect(view.game?.skat).toHaveLength(2);
    expect(view.game?.discarded).toHaveLength(2);
    expect(view.game?.lastTrick).not.toBeNull();
  });
});


describe('bot strength in the view', () => {
  it('shows each bot its strength and humans none', () => {
    const s = applyCommand(tableWith(2), 'p0', { type: 'add-bot' }, ctxFor(1));
    if (!s.ok) throw new Error(s.error.message);
    const players = viewFor(s.value.state, 'p1').table.players;
    expect(players.map((p) => p.botLevel)).toEqual([null, null, 'normal']);
  });
});

describe('Bockrunden in views (skat-rules §13)', () => {
  it('shows the Bock rule and the games left to every seated player', () => {
    let s = step(tableWith(3), 'p0', { type: 'set-rules', rules: { ramsch: false, bock: true, kontra: false } });
    s = { ...s, bockGamesLeft: 2 };
    const view = viewFor(s, 'p1');
    expect(view.table.rules).toEqual({ ramsch: false, bock: true, kontra: false });
    expect(view.table.bockGamesLeft).toBe(2);
  });

  it('marks a running Bock game in the game view', () => {
    const s = step(tableWith(3), 'p0', { type: 'start' });
    const game = s.game;
    if (game === null) throw new Error('no game dealt');
    expect(viewFor(s, 'p1').game?.bock).toBe(false);
    expect(viewFor({ ...s, game: { ...game, bock: true } }, 'p1').game?.bock).toBe(true);
  });
});
