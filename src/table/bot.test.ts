import { beforeAll, describe, expect, it } from 'vitest';
import { mulberry32 } from '../engine';
import { botAction, botStep, runBots } from './bot';
import { seegerBonus } from './records';
import { ctxFor, tableWith } from './testing';
import { applyCommand } from './table';
import type { GameRecord, TableState } from './types';

const GAMES = 50;

/** A table where every seat, the host included, is a bot: nobody has to press "ready". */
function botTable(n: number): TableState {
  const base = tableWith(n);
  return { ...base, players: base.players.map((p) => ({ ...p, isBot: true })) };
}

/** Plays bot-only games until `GAMES` records exist; the table keeps dealing by itself. */
function playBotGames(n: number, seed: number): TableState {
  const rand = mulberry32(seed);
  const ctx = () => ctxFor(Math.floor(rand() * 4294967296), 0);
  const started = applyCommand(botTable(n), 'p0', { type: 'start' }, ctx());
  if (!started.ok) throw new Error(started.error.message);
  let state = started.value.state;
  for (let steps = 0; state.records.length < GAMES; steps++) {
    if (steps > 100_000) throw new Error('bot table did not finish 50 games');
    const next = botStep(state, ctx, rand);
    if (next === null) throw new Error('bot table stopped waiting for a human');
    state = next;
  }
  return state;
}

describe.each([3, 4, 5, 6])('bot-only table with %i players', (n) => {
  let table: TableState;

  beforeAll(() => {
    table = playBotGames(n, n * 101);
  });

  it(`plays ${String(GAMES)} games to the end without errors`, () => {
    expect(table.records).toHaveLength(GAMES);
    expect(table.records.map((r) => r.number)).toEqual(Array.from({ length: GAMES }, (_, i) => i + 1));
    expect(table.records.filter((r) => r.outcome === 'played').length).toBeGreaterThan(0);
  });

  it('seats the expected number of players out in every game', () => {
    const sittingOut = n === 3 ? 0 : n - 3;
    for (const r of table.records) {
      expect(r.tableSize).toBe(n);
      expect(r.sittingOut).toHaveLength(sittingOut);
    }
  });

  it('moves the dealer one seat clockwise after every game', () => {
    const players = table.players.map((p) => p.id);
    const first = players.indexOf(table.records[0]?.dealerId ?? '');
    table.records.forEach((r, i) => {
      expect(r.dealerId).toBe(players[(first + i) % n]);
    });
  });

  it('gives the declarer the standard score and balances Seeger for every played game', () => {
    for (const r of table.records) {
      checkScores(r, n);
    }
  });

  it('keeps one dealt game running after the last record', () => {
    expect(table.gameCounter).toBe(GAMES + 1);
    expect(table.game?.number).toBe(GAMES + 1);
    expect(table.game?.engine.phase).not.toBe('finished');
  });
});

describe('runBots', () => {
  it('stops as soon as a human has to act', () => {
    const rand = mulberry32(5);
    const base = tableWith(3);
    const started = applyCommand(base, 'p0', { type: 'start' }, ctxFor(0, 0));
    if (!started.ok) throw new Error(started.error.message);
    const state = started.value.state;
    expect(runBots(state, () => ctxFor(1, 0), rand)).toBe(state);
  });

  it('plays the bots of a mixed table until a human is on turn', () => {
    const rand = mulberry32(9);
    const base = tableWith(3);
    const bots = { ...base, players: base.players.map((p) => (p.id === 'p1' ? { ...p, isBot: true } : p)) };
    const started = applyCommand(bots, 'p0', { type: 'start' }, ctxFor(3, 0));
    if (!started.ok) throw new Error(started.error.message);
    const after = runBots(started.value.state, () => ctxFor(3, 0), rand);
    const turn = after.game?.engine.turn;
    expect(turn).not.toBeNull();
    expect(after.game?.roles[turn ?? 'forehand']).not.toBe('p1');
  });
});

function checkScores(r: GameRecord, n: number): void {
  const standard = Object.values(r.scores.standard);
  if (r.outcome === 'passed-in' || r.declarerId === null) {
    expect(standard.every((v) => v === 0)).toBe(true);
    return;
  }
  const declarerScore = r.scores.standard[r.declarerId] ?? 0;
  expect(standard.reduce((sum, v) => sum + v, 0)).toBe(declarerScore);
  const seeger = Object.values(r.scores.seeger).reduce((sum, v) => sum + v, 0);
  const expected = r.won ? (r.gameValue ?? 0) + 50 : declarerScore - 50 + seegerBonus(n) * (n - 1);
  expect(seeger).toBe(expected);
}

describe('per-bot strength', () => {
  it('lets the bot on turn act with its own strength', () => {
    const base = tableWith(3, { bots: true });
    const players = base.players.map((p, i) => ({ ...p, isBot: true, botLevel: i === 0 ? ('easy' as const) : ('strong' as const) }));
    const started = applyCommand({ ...base, players }, 'p0', { type: 'start' }, ctxFor(3, 0));
    if (!started.ok) throw new Error(started.error.message);
    const state = started.value.state;
    const game = state.game;
    const role = game?.engine.turn ?? null;
    if (game === null || role === null) throw new Error('test data: a game on turn expected');
    const level = players.find((p) => p.id === game.roles[role])?.botLevel ?? 'normal';
    const expected = botAction(game.engine, role, level, mulberry32(9));
    const last = botStep(state, () => ctxFor(4, 0), mulberry32(9))?.game?.engine.bidding.history.at(-1);
    expect(last).toEqual({ role, ...expected });
  });
});
