import { describe, expect, it } from 'vitest';
import { newGame, type GameResult, type Role } from '../engine';
import { finishedGame } from './fixtures';
import { makeRecord } from './records';
import { computeStats } from './stats';
import { ctxFor, tableWith } from './testing';
import type { ActiveGame, TableState } from './types';
import { viewFor } from './view';

// Forehand p0 loses 50 points; middlehand p1 and hindhand p2 score 0 (3-player table).
const RAMSCH_ONE: GameResult = {
  kind: 'ramsch',
  points: { forehand: 50, middlehand: 40, hindhand: 30 },
  tricks: { forehand: 4, middlehand: 3, hindhand: 3 },
  skatTo: 'hindhand',
  losers: ['forehand'],
  jungfrau: false,
  durchmarsch: null,
  scores: { forehand: -50, middlehand: 0, hindhand: 0 },
};

const ROLES3: Readonly<Record<Role, string>> = { forehand: 'p0', middlehand: 'p1', hindhand: 'p2' };

function ramschGame(table: TableState, roles: Readonly<Record<Role, string>>): ActiveGame {
  const game = finishedGame(table, roles, RAMSCH_ONE, 1);
  return { ...game, engine: { ...game.engine, ramsch: true } };
}

describe('records of a Ramsch', () => {
  it('has outcome ramsch, no declarer and a ramsch block keyed by player id', () => {
    const table = tableWith(3);
    const record = makeRecord(table, ramschGame(table, ROLES3), ctxFor(1, 5));
    expect(record.outcome).toBe('ramsch');
    expect(record.declarerId).toBeNull();
    expect(record.bid).toBeNull();
    expect(record.ramsch).toEqual({
      points: { p0: 50, p1: 40, p2: 30 },
      tricks: { p0: 4, p1: 3, p2: 3 },
      loserIds: ['p0'],
      jungfrau: false,
      durchmarschId: null,
    });
  });

  it('scores the loser and gives both systems the same deltas', () => {
    const table = tableWith(3);
    const record = makeRecord(table, ramschGame(table, ROLES3), ctxFor(1, 5));
    expect(record.scores.standard).toEqual({ p0: -50, p1: 0, p2: 0 });
    expect(record.scores.seeger).toEqual(record.scores.standard);
  });

  it('gives a sitting-out player 0 on a four-player table', () => {
    const table = tableWith(4);
    const roles = { forehand: 'p1', middlehand: 'p2', hindhand: 'p3' };
    const record = makeRecord(table, ramschGame(table, roles), ctxFor(1, 5));
    expect(record.sittingOut).toEqual([]);
    expect(record.scores.standard['p0']).toBe(0);
    expect(record.scores.standard['p1']).toBe(-50);
  });

  it('other outcomes carry ramsch null', () => {
    const table = tableWith(3);
    const game = finishedGame(table, ROLES3, { kind: 'passed-in' }, 1);
    expect(makeRecord(table, game, ctxFor(1, 5)).ramsch).toBeNull();
  });
});

describe('stats of a Ramsch', () => {
  it('adds Ramsch scores to the totals and counts the Ramsch games', () => {
    const table = tableWith(3);
    const record = makeRecord(table, ramschGame(table, ROLES3), ctxFor(1, 5));
    const stats = computeStats([record], table.players);
    const p0 = stats.players.find((p) => p.playerId === 'p0');
    expect(stats.ramsch).toBe(1);
    expect(p0?.total.standard).toBe(-50);
    expect(p0?.games).toBe(1);
    expect(p0?.declared).toBe(0);
  });
});

describe('views of a Ramsch', () => {
  it('shows the Ramsch flag and the result by player id', () => {
    const table = tableWith(3);
    const view = viewFor({ ...table, game: ramschGame(table, ROLES3) }, 'p1');
    expect(view.game?.ramsch).toBe(true);
    expect(view.game?.result).toEqual({
      kind: 'ramsch',
      points: { p0: 50, p1: 40, p2: 30 },
      tricks: { p0: 4, p1: 3, p2: 3 },
      skatToId: 'p2',
      loserIds: ['p0'],
      jungfrau: false,
      durchmarschId: null,
      scores: { p0: -50, p1: 0, p2: 0 },
    });
  });

  it('shows the Skat to everybody once a Ramsch is finished', () => {
    const table = tableWith(3);
    const game = ramschGame(table, ROLES3);
    expect(viewFor({ ...table, game }, 'p1').game?.skat).toEqual(game.engine.skat);
  });

  it('hides the Skat while the Ramsch is still being played', () => {
    const table = tableWith(3);
    const engine = { ...newGame(9, { ramschOnPassIn: true, kontra: false }), ramsch: true, phase: 'playing' as const, turn: 'forehand' as const };
    const game = { ...ramschGame(table, ROLES3), engine };
    expect(viewFor({ ...table, game }, 'p1').game?.skat).toBeNull();
  });

  it('gives the rules to the table view', () => {
    expect(viewFor(tableWith(3), 'p1').table.rules).toEqual({ ramsch: false, bock: false, kontra: false });
  });
});
