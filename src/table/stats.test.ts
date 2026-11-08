import { describe, expect, it } from 'vitest';
import type { GameResult, Role } from '../engine';
import { DIAMONDS_LOST, GRAND_144, NULL_OUVERT_WON, finishedGame } from './fixtures';
import { makeRecord } from './records';
import { computeStats } from './stats';
import { ctxFor, tableWith } from './testing';
import type { GameRecord } from './types';

const table = tableWith(3);
const [A, B, C] = ['p0', 'p1', 'p2'] as const;
const known = table.players.map((p) => ({ id: p.id, name: p.name }));

function record(
  result: GameResult,
  number: number,
  roles: Readonly<Record<Role, string>> = { forehand: A, middlehand: B, hindhand: C },
): GameRecord {
  return makeRecord(table, finishedGame(table, roles, result, number), ctxFor(number));
}

const passedIn = (number: number): GameRecord => record({ kind: 'passed-in' }, number);

/** The three games of skat-rules §10.7: A declares games 1 and 2 (lost), C declares game 3. */
const threeGames = (): GameRecord[] => [
  record(GRAND_144, 1),
  record(DIAMONDS_LOST, 2),
  record(NULL_OUVERT_WON, 3, { forehand: C, middlehand: A, hindhand: B }),
];

describe('computeStats series (docs/statistics.md §2 Seeger vectors)', () => {
  it('ends at Seeger totals A=90, B=40, C=136 and standard totals A=90, B=0, C=46', () => {
    const last = computeStats(threeGames(), known).series.at(-1)?.cumulative;
    expect(last).toEqual({
      [A]: { standard: 90, seeger: 90 },
      [B]: { standard: 0, seeger: 40 },
      [C]: { standard: 46, seeger: 136 },
    });
  });

  it('has one point per record, with the cumulative values after each game', () => {
    const stats = computeStats(threeGames(), known);
    expect(stats.series.map((s) => s.gameNumber)).toEqual([1, 2, 3]);
    expect(stats.series[0]?.cumulative[A]?.seeger).toBe(194);
    expect(stats.series[1]?.cumulative[A]?.seeger).toBe(90);
    expect(stats.series[1]?.cumulative[B]?.seeger).toBe(40);
    expect(stats.series[2]?.cumulative[C]?.seeger).toBe(136);
  });
});

describe('player statistics', () => {
  it('counts games, declared games, wins and the win rate', () => {
    const stats = computeStats(threeGames(), known);
    expect(stats.players.find((p) => p.playerId === A)).toMatchObject({
      games: 3,
      played: 3,
      declared: 2,
      won: 1,
      lost: 1,
      winRate: 0.5,
    });
    expect(stats.players.find((p) => p.playerId === B)).toMatchObject({
      declared: 0,
      winRate: null,
      asDefender: 3,
      defenderWins: 1,
    });
  });

  it('computes totals, averages, best and worst single deltas', () => {
    const a = computeStats(threeGames(), known).players.find((p) => p.playerId === A);
    expect(a?.total).toEqual({ standard: 90, seeger: 90 });
    expect(a?.average.seeger).toBe(30);
    expect(a?.best.seeger).toBe(194);
    expect(a?.worst.seeger).toBe(-104);
  });

  it('counts Grand, Diamonds and Null games by type', () => {
    const stats = computeStats(threeGames(), known);
    expect(stats.byGame.grand).toEqual({ played: 1, declarerWon: 1 });
    expect(stats.byGame.diamonds).toEqual({ played: 1, declarerWon: 0 });
    expect(stats.byGame.null).toEqual({ played: 1, declarerWon: 1 });
    const a = stats.players.find((p) => p.playerId === A);
    expect(a?.byGame.grand).toEqual({ declared: 1, won: 1 });
  });

  it('sorts the standings by the standard total', () => {
    const stats = computeStats(threeGames(), known);
    expect(stats.players.map((p) => p.playerId)).toEqual([A, C, B]);
  });
});

describe('passed-in games and sitting out', () => {
  it('counts a passed-in game as a game without play', () => {
    const stats = computeStats([...threeGames(), passedIn(4)], known);
    expect(stats).toMatchObject({ gamesTotal: 4, passedIn: 1 });
    expect(stats.players.find((p) => p.playerId === B)).toMatchObject({ games: 4, played: 3 });
    expect(stats.series).toHaveLength(4);
    expect(stats.series[3]?.cumulative[A]?.seeger).toBe(90);
  });

  it('counts sitting-out games and their Seeger bonus in a 4-player table', () => {
    const four = tableWith(4);
    const ids = four.players.map((p) => p.id);
    const [p0, p1, p2, p3] = ids as [string, string, string, string];
    const r = makeRecord(
      four,
      finishedGame(four, { forehand: p0, middlehand: p1, hindhand: p3 }, DIAMONDS_LOST, 1, [p2]),
      ctxFor(0),
    );
    const stats = computeStats([r], four.players.map((p) => ({ id: p.id, name: p.name })));
    expect(stats.players.find((p) => p.playerId === p2)).toMatchObject({
      games: 1,
      played: 0,
      satOut: 1,
      total: { seeger: 30, standard: 0 },
    });
  });
});

describe('names', () => {
  it('prefers the names stored in the records over the known names', () => {
    const stats = computeStats(threeGames(), [{ id: A, name: 'Anna' }]);
    expect(stats.players.find((p) => p.playerId === A)?.name).toBe('Host');
    expect(stats.players.find((p) => p.playerId === B)?.name).toBe('Player 1');
  });

  it('keeps the name of a kicked player, which only the records know', () => {
    const stats = computeStats(threeGames(), []);
    expect(stats.players.find((p) => p.playerId === B)?.name).toBe('Player 1');
  });

  it('falls back to the known name, then to the id', () => {
    const stats = computeStats([], [{ id: 'zz', name: 'Zed' }]);
    expect(stats.players).toEqual([
      expect.objectContaining({ playerId: 'zz', name: 'Zed', games: 0, average: { standard: 0, seeger: 0 } }),
    ]);
  });

  it('is empty for an empty history', () => {
    expect(computeStats([], [])).toMatchObject({ gamesTotal: 0, passedIn: 0, players: [], series: [] });
  });
});
