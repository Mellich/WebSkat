import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../table';
import { LOG_VIEW_LIMIT, viewFor } from '../table';
import { tableWith } from '../table/testing';
import { LogEntrySchema } from './schemaLog';
import { TableViewSchema } from './schemaView';

const meta = { n: 1, at: 1000 };
const declaration = { kind: 'suit' as const, trump: 'D' as const, hand: false, announce: 'none' as const, ouvert: false };

/** One entry of every kind (plan 10, docs/networking.md §3). */
const EVERY_KIND: LogEntry[] = [
  { kind: 'joined', playerId: 'p1', name: 'Anna', isBot: false, pending: true, ...meta },
  { kind: 'reconnected', playerId: 'p1', name: 'Anna', ...meta },
  { kind: 'disconnected', playerId: 'p1', name: 'Anna', ...meta },
  { kind: 'left', playerId: 'p1', name: 'Anna', ...meta },
  { kind: 'kicked', playerId: 'p1', name: 'Anna', ...meta },
  { kind: 'replaced', playerId: 'p1', name: 'Anna', byId: 'bot-3', byName: 'Bot', ...meta },
  { kind: 'dealt', number: 1, dealerId: 'p0', dealerName: 'Host', bock: false, ...meta },
  { kind: 'dealt', number: 2, dealerId: 'p0', dealerName: 'Host', bock: true, ...meta },
  { kind: 'bid', playerId: 'p1', name: 'Anna', action: 'bid', value: 18, ...meta },
  { kind: 'bid', playerId: 'p1', name: 'Anna', action: 'pass', value: null, ...meta },
  { kind: 'skat', playerId: 'p1', name: 'Anna', pickedUp: true, ...meta },
  { kind: 'declared', playerId: 'p1', name: 'Anna', declaration, ...meta },
  { kind: 'ramsch', number: 1, ...meta },
  { kind: 'bock-started', games: 3, ...meta },
  { kind: 'aborted', number: 1, ...meta },
  {
    kind: 'result', number: 1, outcome: 'played', declarerId: 'p1', declarerName: 'Anna', game: 'diamonds',
    won: true, gameValue: 9, declarerPoints: 61, defenderPoints: 59, loserNames: [], durchmarschName: null, ...meta,
  },
  {
    kind: 'result', number: 2, outcome: 'passed-in', declarerId: null, declarerName: null, game: null,
    won: null, gameValue: null, declarerPoints: null, defenderPoints: null, loserNames: [], durchmarschName: null, ...meta,
  },
  {
    kind: 'result', number: 3, outcome: 'ramsch', declarerId: null, declarerName: null, game: null,
    won: null, gameValue: null, declarerPoints: null, defenderPoints: null, loserNames: ['Anna', 'Ben'],
    durchmarschName: null, ...meta,
  },
];

describe('LogEntrySchema', () => {
  it.each(EVERY_KIND.map((e) => [e.kind, e] as const))('accepts a %s entry', (_kind, entry) => {
    expect(LogEntrySchema.safeParse(entry).success).toBe(true);
  });

  it('rejects an unknown kind', () => {
    expect(LogEntrySchema.safeParse({ kind: 'mystery', number: 1, ...meta }).success).toBe(false);
  });

  it('rejects a result without the loser list of a Ramsch', () => {
    const result = {
      kind: 'result', number: 3, outcome: 'ramsch', declarerId: null, declarerName: null, game: null,
      won: null, gameValue: null, declarerPoints: null, defenderPoints: null, durchmarschName: null, ...meta,
    };
    expect(LogEntrySchema.safeParse(result).success).toBe(false);
  });

  it('rejects an entry without its time', () => {
    expect(LogEntrySchema.safeParse({ kind: 'left', playerId: 'p1', name: 'Anna', n: 1 }).success).toBe(false);
  });
});

describe('TableViewSchema.log', () => {
  it('accepts a view with every kind', () => {
    const view = { ...viewFor(tableWith(3), 'p0'), log: EVERY_KIND };
    expect(TableViewSchema.safeParse(view).success).toBe(true);
  });

  it('rejects more than LOG_VIEW_LIMIT entries', () => {
    const log = Array.from({ length: LOG_VIEW_LIMIT + 1 }, (_, i) => ({ ...EVERY_KIND[1], n: i + 1 }) as LogEntry);
    expect(TableViewSchema.safeParse({ ...viewFor(tableWith(3), 'p0'), log }).success).toBe(false);
  });
});
