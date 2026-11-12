import { describe, expect, it } from 'vitest';
import { ctxFor, playUntilRecords, tableWith } from './testing';
import { applyCommand } from './table';
import { seriesDone } from './series';
import { viewFor } from './view';
import type { TableCommand, TableState } from './types';

function step(s: TableState, actor: string, c: TableCommand): TableState {
  const r = applyCommand(s, actor, c, ctxFor(1));
  if (!r.ok) throw new Error(r.error.code);
  return r.value.state;
}

function started(limit: number): TableState {
  let s = tableWith(3, { bots: true });
  s = step(s, 'p0', { type: 'set-game-limit', limit });
  return step(s, 'p0', { type: 'start' });
}

/** Plays until `records` games are finished and the human host is the only one not ready. */
function finishGames(s: TableState, count: number): TableState {
  let n = 7;
  const rand = (): number => {
    n = (n * 1664525 + 1013904223) % 4294967296;
    return n / 4294967296;
  };
  return playUntilRecords(s, count, () => ctxFor(1), rand);
}

describe('set-game-limit', () => {
  it('is host only, clamped, and refused while a game runs', () => {
    const s = tableWith(3, { bots: true });
    expect(applyCommand(s, 'p1', { type: 'set-game-limit', limit: 6 }, ctxFor(1)).ok).toBe(false);
    expect(step(s, 'p0', { type: 'set-game-limit', limit: -4 }).gameLimit).toBe(0);
    expect(step(s, 'p0', { type: 'set-game-limit', limit: 5000 }).gameLimit).toBe(999);
    const running = step(s, 'p0', { type: 'start' });
    const r = applyCommand(running, 'p0', { type: 'set-game-limit', limit: 6 }, ctxFor(1));
    expect(r.ok ? null : r.error.code).toBe('GAME_RUNNING');
  });

  it('defaults to unlimited', () => {
    expect(tableWith(3).gameLimit).toBe(0);
    expect(viewFor(tableWith(3), 'p0').table.gameLimit).toBe(0);
  });
});

describe('series end', () => {
  it('ends the series instead of dealing once everyone is ready after the last game', () => {
    const s = finishGames(started(2), 2);
    expect(seriesDone(s)).toBe(true);
    expect(s.seriesOver).toBe(false);
    const over = step(s, 'p0', { type: 'ready' });
    expect(over.seriesOver).toBe(true);
    expect(over.gameCounter).toBe(2);
    expect(over.game?.engine.phase).toBe('finished');
    const view = viewFor(over, 'p0').table;
    expect(view.seriesOver).toBe(true);
    expect(view.gamesPlayed).toBe(2);
  });

  it('deals on as before while the limit is not reached', () => {
    const s = step(finishGames(started(3), 1), 'p0', { type: 'ready' });
    expect(s.seriesOver).toBe(false);
    expect(s.gameCounter).toBe(2);
  });

  it('never ends an unlimited table', () => {
    const s = step(finishGames(started(0), 2), 'p0', { type: 'ready' });
    expect(s.seriesOver).toBe(false);
    expect(s.gameCounter).toBe(3);
  });
});

describe('add-rounds', () => {
  it('is host only and only after the last game', () => {
    const early = finishGames(started(3), 1);
    const r = applyCommand(early, 'p0', { type: 'add-rounds' }, ctxFor(1));
    expect(r.ok ? null : r.error.code).toBe('WRONG_STATUS');
    const last = finishGames(started(1), 1);
    const notHost = applyCommand(last, 'p1', { type: 'add-rounds' }, ctxFor(1));
    expect(notHost.ok ? null : notHost.error.code).toBe('NOT_HOST');
  });

  it('adds one game per seat and keeps playing when the host adds before continuing', () => {
    const last = finishGames(started(1), 1);
    const added = step(last, 'p0', { type: 'add-rounds' });
    expect(added.gameLimit).toBe(4);
    expect(added.game?.engine.phase).toBe('finished');
    expect(step(added, 'p0', { type: 'ready' }).gameCounter).toBe(2);
  });

  it('reopens an ended series and deals right away', () => {
    const over = step(finishGames(started(1), 1), 'p0', { type: 'ready' });
    expect(over.seriesOver).toBe(true);
    const again = step(over, 'p0', { type: 'add-rounds' });
    expect(again.seriesOver).toBe(false);
    expect(again.gameCounter).toBe(2);
    expect(again.game?.engine.phase).not.toBe('finished');
  });
});
