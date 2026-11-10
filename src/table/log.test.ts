import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../engine';
import { LOG_LIMIT, LOG_VIEW_LIMIT, appendLog, type LogEntry, type LogEvent } from './log';
import { addPlayer } from './seating';
import { ctxFor, playUntilRecords, tableWith } from './testing';
import { applyCommand } from './table';
import { commandLog } from './logEvents';
import type { Ctx, TableState } from './types';
import { viewFor } from './view';

const ctxOf = (seed: number) => (): Ctx => ctxFor(seed);

/** Starts a game with `count` humans (host p0, players p1..). */
function started(count: number, seed = 7): TableState {
  const result = applyCommand(tableWith(count), 'p0', { type: 'start' }, ctxFor(seed));
  if (!result.ok) throw new Error(result.error.message);
  return result.value.state;
}

/** Runs one command and returns the new state; throws on error. */
function run(s: TableState, actor: string, command: Parameters<typeof applyCommand>[2], seed = 1, now = 0): TableState {
  const result = applyCommand(s, actor, command, ctxFor(seed, now));
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code}`);
  return result.value.state;
}

const kinds = (entries: readonly LogEntry[]): string[] => entries.map((e) => e.kind);
const last = (s: TableState): LogEntry => {
  const entry = s.log[s.log.length - 1];
  if (entry === undefined) throw new Error('empty log');
  return entry;
};

function event(kind: LogEvent['kind']): LogEvent {
  return { kind, playerId: 'p1', name: 'Anna' } as LogEvent;
}

describe('appendLog', () => {
  it('numbers entries, sets the time and keeps the last LOG_LIMIT entries', () => {
    const s = tableWith(3);
    const many = Array.from({ length: LOG_LIMIT + 5 }, () => event('reconnected'));
    const out = appendLog(s, many, 42);
    expect(out.log).toHaveLength(LOG_LIMIT);
    expect(out.log[0]?.n).toBe(6);
    expect(out.log[LOG_LIMIT - 1]?.n).toBe(LOG_LIMIT + 5);
    expect(out.log[LOG_LIMIT - 1]?.at).toBe(42);
  });

  it('continues the running numbers and does not change an empty event list', () => {
    const once = appendLog(tableWith(3), [event('left')], 1);
    const twice = appendLog(once, [event('kicked'), event('left')], 2);
    expect(twice.log.map((e) => e.n)).toEqual([1, 2, 3]);
    expect(appendLog(twice, [], 3)).toBe(twice);
  });
});

describe('log of a game', () => {
  it('starts with a dealt entry and logs every bid, pickup and declaration', () => {
    const s = started(3, 11);
    expect(kinds(s.log)).toEqual(['dealt']);
    expect(s.log[0]).toMatchObject({ kind: 'dealt', number: 1 });
    expect(typeof (s.log[0] as { dealerName?: unknown }).dealerName).toBe('string');

    const finished = playUntilRecords(s, 1, ctxOf(11), mulberry32(11));
    const game = finished.records[0];
    if (game === undefined) throw new Error('no record');
    const bids = finished.log.filter((e): e is LogEntry & { kind: 'bid' } => e.kind === 'bid');
    const history = finished.game?.engine.bidding.history ?? [];
    expect(bids).toHaveLength(history.length);
    bids.forEach((entry, i) => {
      const ev = history[i];
      if (ev === undefined) throw new Error('missing bid event');
      expect(entry.playerId).toBe(finished.players.find((p) => p.id === finished.game?.roles[ev.role])?.id);
      if (ev.type === 'bid') expect(entry.value).toBe(ev.value);
    });

    const result = finished.log.find((e) => e.kind === 'result');
    expect(result).toMatchObject({
      kind: 'result',
      number: 1,
      outcome: game.outcome,
      won: game.outcome === 'played' ? game.won : null,
      gameValue: game.gameValue,
      declarerPoints: game.declarerPoints,
      defenderPoints: game.defenderPoints,
    });
    expect(kinds(finished.log).slice(-1)).toEqual(['result']);
  });

  it('logs the declaration before the result of a played game', () => {
    // Random play is seeded; scan seeds until one game is played (not passed in).
    let found: TableState | null = null;
    for (let seed = 1; seed <= 30 && found === null; seed++) {
      const finished = playUntilRecords(started(3, seed), 1, ctxOf(seed), mulberry32(seed));
      if (finished.records[0]?.outcome === 'played') found = finished;
    }
    if (found === null) throw new Error('no played game in 30 seeds');
    const ks = kinds(found.log);
    expect(ks).toContain('skat');
    expect(ks).toContain('declared');
    expect(ks.indexOf('declared')).toBeLessThan(ks.indexOf('result'));
  });
});

describe('commands that change players', () => {
  it('logs a join by add-bot, with the bot name', () => {
    const s = run(tableWith(3), 'p0', { type: 'add-bot' });
    expect(last(s)).toMatchObject({ kind: 'joined', isBot: true, pending: false, name: 'Guguurz' });
  });

  it('logs a kick with the name from before the kick', () => {
    const s = run(tableWith(4), 'p0', { type: 'kick', playerId: 'p2' });
    expect(last(s)).toMatchObject({ kind: 'kicked', playerId: 'p2', name: 'Player 2' });
  });

  it('logs a leave in the lobby', () => {
    const s = run(tableWith(4), 'p1', { type: 'leave' });
    expect(last(s)).toMatchObject({ kind: 'left', playerId: 'p1', name: 'Player 1' });
  });

  it('logs a replacement by a waiting player', () => {
    let s = started(3);
    const added = addPlayer(s, { id: 'p9', name: 'Pending' });
    if (!added.ok) throw new Error(added.error.message);
    s = added.value;
    s = run(s, 'p0', { type: 'replace-player', playerId: 'p1', by: { kind: 'pending', playerId: 'p9' } });
    expect(last(s)).toMatchObject({
      kind: 'replaced',
      playerId: 'p1',
      name: 'Player 1',
      byId: 'p9',
      byName: 'Pending',
    });
  });

  it('logs a replacement by a bot', () => {
    const s = run(started(3), 'p0', { type: 'replace-player', playerId: 'p2', by: { kind: 'bot', level: 'easy' } });
    const entry = last(s);
    if (entry.kind !== 'replaced') throw new Error('expected replaced');
    expect(entry.byId.startsWith('bot-')).toBe(true);
    expect(entry.byName).toBe('Guguurz');
  });

  it('logs an aborted game, then the deal of the next one', () => {
    const s = run(started(3), 'p0', { type: 'abort-game' });
    expect(s.log.slice(-2)).toMatchObject([
      { kind: 'aborted', number: 1 },
      { kind: 'dealt', number: 2 },
    ]);
  });

  it('logs nothing for a rejected command', () => {
    const s = started(3);
    const result = applyCommand(s, 'p1', { type: 'abort-game' }, ctxFor(1));
    expect(result.ok).toBe(false);
    expect(s.log).toHaveLength(1);
  });
});

describe('view and limits', () => {
  it('sends at most LOG_VIEW_LIMIT entries, the newest ones', () => {
    let s = tableWith(3);
    s = { ...s, log: appendLog(s, Array.from({ length: 150 }, () => event('reconnected')), 1).log };
    const view = viewFor(s, 'p0');
    expect(view.log).toHaveLength(LOG_VIEW_LIMIT);
    expect(view.log[view.log.length - 1]?.n).toBe(150);
  });
});

describe('Ramsch and Bock', () => {
  it('logs a Ramsch: the passes, the start of Ramsch, then its result', () => {
    // Random bidding: scan seeds until everybody passes and the Ramsch rule plays the game.
    let found: TableState | null = null;
    for (let seed = 1; seed <= 200 && found === null; seed++) {
      const ramschOn = run(tableWith(3), 'p0', { type: 'set-rules', rules: { ramsch: true, bock: false, kontra: false } });
      const finished = playUntilRecords(run(ramschOn, 'p0', { type: 'start' }, seed), 1, ctxOf(seed), mulberry32(seed));
      if (finished.records[0]?.outcome === 'ramsch') found = finished;
    }
    if (found === null) throw new Error('no Ramsch in 200 seeds');
    const ks = kinds(found.log);
    expect(ks).toContain('ramsch');
    expect(ks.indexOf('ramsch')).toBeLessThan(ks.indexOf('result'));
    expect(found.log.find((e) => e.kind === 'result')).toMatchObject({ outcome: 'ramsch', won: null, game: null });
  });

  it('marks the deal of a Bock game', () => {
    const s: TableState = { ...tableWith(3), rules: { ramsch: false, bock: true, kontra: false }, bockGamesLeft: 2 };
    expect(last(run(s, 'p0', { type: 'start' }))).toMatchObject({ kind: 'dealt', number: 1, bock: true });
  });

  it('logs the start of Bock games after a 60 : 60 game', () => {
    const finished = playUntilRecords(started(3, 5), 1, ctxOf(5), mulberry32(5));
    const record = finished.records[0];
    if (record === undefined) throw new Error('no record');
    const events = commandLog(finished, finished, 'p0', { type: 'ready' }, { ...record, bockTriggered: true });
    expect(events).toContainEqual({ kind: 'bock-started', games: 3 });
  });
});
