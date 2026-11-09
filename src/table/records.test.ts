import { describe, expect, it } from 'vitest';
import { makeRecord, seegerBonus } from './records';
import { DIAMONDS_LOST, GRAND_144, NULL_OUVERT_WON, finishedGame } from './fixtures';
import { ctxFor, tableWith } from './testing';

describe('seegerBonus', () => {
  it.each([
    [3, 40],
    [4, 30],
    [5, 24],
    [6, 20],
  ])('%i seats → %i', (seats, bonus) => {
    expect(seegerBonus(seats)).toBe(bonus);
  });
});

describe('makeRecord scores (skat-rules §10.6 vectors)', () => {
  const table = tableWith(3);
  const [a, b, c] = table.players.map((p) => p.id) as [string, string, string];
  const roles = { forehand: a, middlehand: b, hindhand: c };

  it('won Grand: declarer +194 under Seeger, +144 standard, nobody else scores', () => {
    const record = makeRecord(table, finishedGame(table, roles, GRAND_144, 1), ctxFor(0));
    expect(record.scores.seeger).toEqual({ [a]: 194, [b]: 0, [c]: 0 });
    expect(record.scores.standard).toEqual({ [a]: 144, [b]: 0, [c]: 0 });
  });

  it('lost Diamonds: declarer −104, both defenders +40 under Seeger', () => {
    const record = makeRecord(table, finishedGame(table, roles, DIAMONDS_LOST, 2), ctxFor(0));
    expect(record.scores.seeger).toEqual({ [a]: -104, [b]: 40, [c]: 40 });
    expect(record.scores.standard).toEqual({ [a]: -54, [b]: 0, [c]: 0 });
  });

  it('won Null Ouvert: declarer +96 under Seeger', () => {
    const record = makeRecord(table, finishedGame(table, roles, NULL_OUVERT_WON, 3), ctxFor(0));
    expect(record.scores.seeger).toEqual({ [a]: 96, [b]: 0, [c]: 0 });
  });

  it('sums to the Seeger vector totals A=90, B=40, C=136 over the three games', () => {
    const g1 = makeRecord(table, finishedGame(table, roles, GRAND_144, 1), ctxFor(0));
    const g2 = makeRecord(table, finishedGame(table, roles, DIAMONDS_LOST, 2), ctxFor(0));
    const rolesC = { forehand: c, middlehand: a, hindhand: b };
    const g3 = makeRecord(table, finishedGame(table, rolesC, NULL_OUVERT_WON, 3), ctxFor(0));
    const totals = [g1, g2, g3].reduce<Record<string, number>>((acc, r) => {
      for (const [id, v] of Object.entries(r.scores.seeger)) acc[id] = (acc[id] ?? 0) + v;
      return acc;
    }, {});
    expect(totals).toEqual({ [a]: 90, [b]: 40, [c]: 136 });
  });
});

describe('makeRecord details', () => {
  it('describes a played game with its label, flags and names', () => {
    const table = tableWith(3);
    const roles = { forehand: 'p0', middlehand: 'p1', hindhand: 'p2' };
    const record = makeRecord(table, finishedGame(table, roles, GRAND_144, 7), ctxFor(0, 555));
    expect(record).toMatchObject({
      id: 'TESTKEY-7',
      number: 7,
      timestamp: 555,
      outcome: 'played',
      declarerId: 'p0',
      game: 'grand',
      bid: 48,
      multiplier: 6,
      gameValue: 144,
      declarerPoints: 100,
      schneider: true,
      won: true,
      announce: 'none',
      spitzenWith: true,
      spitzenCount: 4,
    });
    expect(record.names).toEqual({ p0: 'Host', p1: 'Player 1', p2: 'Player 2' });
  });

  it('records a passed-in game with zero scores', () => {
    const table = tableWith(3);
    const roles = { forehand: 'p0', middlehand: 'p1', hindhand: 'p2' };
    const record = makeRecord(table, finishedGame(table, roles, { kind: 'passed-in' }, 4), ctxFor(0));
    expect(record).toMatchObject({ outcome: 'passed-in', declarerId: null, game: null, won: false });
    expect(record.scores.seeger).toEqual({ p0: 0, p1: 0, p2: 0 });
    expect(record.scores.standard).toEqual({ p0: 0, p1: 0, p2: 0 });
  });

  it('gives the Seeger bonus to a sitting-out player in a 4-player table when the declarer loses', () => {
    const table = tableWith(4);
    const roles = { forehand: 'p0', middlehand: 'p1', hindhand: 'p3' };
    const game = finishedGame(table, roles, DIAMONDS_LOST, 5, ['p2']);
    const record = makeRecord(table, { ...game, dealerId: 'p2' }, ctxFor(0));
    expect(record.scores.seeger).toEqual({ p0: -104, p1: 30, p2: 30, p3: 30 });
    expect(record.scores.standard).toEqual({ p0: -54, p1: 0, p2: 0, p3: 0 });
    expect(record.sittingOut).toEqual(['p2']);
    expect(record.tableSize).toBe(4);
  });

  it('gives no bonus when the declarer wins', () => {
    const table = tableWith(4);
    const roles = { forehand: 'p0', middlehand: 'p1', hindhand: 'p3' };
    const record = makeRecord(table, finishedGame(table, roles, GRAND_144, 6), ctxFor(0));
    expect(Object.values(record.scores.seeger).reduce((a, b) => a + b, 0)).toBe(194);
  });
});

describe('makeRecord Bock doubling (skat-rules §13.1 B1–B3)', () => {
  const table = tableWith(3);
  const [a, b, c] = table.players.map((p) => p.id) as [string, string, string];
  const roles = { forehand: a, middlehand: b, hindhand: c };
  const bockGame = (game: ReturnType<typeof finishedGame>) => ({ ...game, bock: true });

  it('B1: a Bock won Grand is +288 standard and +338 Seeger, others 0', () => {
    const record = makeRecord(table, bockGame(finishedGame(table, roles, GRAND_144, 1)), ctxFor(0));
    expect(record.scores.standard).toEqual({ [a]: 288, [b]: 0, [c]: 0 });
    expect(record.scores.seeger).toEqual({ [a]: 338, [b]: 0, [c]: 0 });
    expect(record.bock).toBe(true);
  });

  it('B2: a Bock lost Diamonds (N = 3) is −108 standard, −158 Seeger, others +40', () => {
    const record = makeRecord(table, bockGame(finishedGame(table, roles, DIAMONDS_LOST, 2)), ctxFor(0));
    expect(record.scores.standard).toEqual({ [a]: -108, [b]: 0, [c]: 0 });
    expect(record.scores.seeger).toEqual({ [a]: -158, [b]: 40, [c]: 40 });
  });

  it('B3: a Bock Ramsch doubles every Ramsch score', () => {
    const ramsch = {
      kind: 'ramsch' as const,
      points: { forehand: 50, middlehand: 40, hindhand: 30 },
      tricks: { forehand: 4, middlehand: 3, hindhand: 3 },
      skatTo: 'forehand' as const,
      losers: ['forehand' as const],
      jungfrau: false,
      durchmarsch: null,
      scores: { forehand: -50, middlehand: 0, hindhand: 0 },
    };
    const record = makeRecord(table, bockGame(finishedGame(table, roles, ramsch, 3)), ctxFor(0));
    expect(record.scores.standard).toEqual({ [a]: -100, [b]: 0, [c]: 0 });
    expect(record.scores.seeger).toEqual({ [a]: -100, [b]: 0, [c]: 0 });
  });

  it('keeps the plain engine values and sets bockTriggered only when asked', () => {
    const plain = makeRecord(table, finishedGame(table, roles, DIAMONDS_LOST, 4), ctxFor(0));
    expect(plain).toMatchObject({ bock: false, bockTriggered: false, gameValue: 27 });
    const trig = makeRecord(table, finishedGame(table, roles, DIAMONDS_LOST, 5), ctxFor(0), true);
    expect(trig).toMatchObject({ bock: false, bockTriggered: true });
  });

  it('does not double a passed-in Bock game (all zero)', () => {
    const record = makeRecord(table, bockGame(finishedGame(table, roles, { kind: 'passed-in' }, 6)), ctxFor(0));
    expect(record).toMatchObject({ bock: true, bockTriggered: false });
    expect(record.scores.standard).toEqual({ [a]: 0, [b]: 0, [c]: 0 });
  });
});
