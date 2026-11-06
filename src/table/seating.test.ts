import { describe, expect, it } from 'vitest';
import { addPlayer, removePlayer, setConnected, uniqueName } from './seating';
import { ctxFor, tableWith } from './testing';
import { dealNext } from './table';
import type { TableState } from './types';

describe('uniqueName', () => {
  it('keeps a free name', () => {
    expect(uniqueName(['Ben'], 'Anna')).toBe('Anna');
  });

  it('adds a counter to a taken name', () => {
    expect(uniqueName(['Anna'], 'Anna')).toBe('Anna (2)');
    expect(uniqueName(['Anna', 'Anna (2)'], 'Anna')).toBe('Anna (3)');
  });

  it('trims and keeps the name within 20 characters', () => {
    const long = 'abcdefghijklmnopqrst';
    expect(uniqueName([], '  Anna  ')).toBe('Anna');
    expect(uniqueName([long], long)).toHaveLength(20);
    expect(uniqueName([long], long).endsWith(' (2)')).toBe(true);
  });
});

describe('addPlayer', () => {
  it('seats immediately while no game is dealt', () => {
    const added = addPlayer(tableWith(1), { id: 'x', name: 'Xavier' });
    expect(added.ok && added.value.players.map((p) => p.id)).toEqual(['p0', 'x']);
  });

  it('puts the player in pending while a game is dealt', () => {
    const dealt = dealNext(tableWith(3), ctxFor(1));
    const added = addPlayer(dealt, { id: 'x', name: 'Xavier' });
    expect(added.ok && added.value.pending.map((p) => p.id)).toEqual(['x']);
    expect(added.ok && added.value.players).toHaveLength(3);
  });

  it('rejects a full table', () => {
    const result = addPlayer(tableWith(3, { maxSeats: 3 }), { id: 'x', name: 'Xavier' });
    expect(result).toMatchObject({ ok: false, error: { code: 'TABLE_FULL' } });
  });

  it.each(['', '   ', 'a'.repeat(21)])('rejects the invalid name %j', (name) => {
    const result = addPlayer(tableWith(1), { id: 'x', name });
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_NAME' } });
  });

  it('accepts a 20 character name', () => {
    const result = addPlayer(tableWith(1), { id: 'x', name: 'a'.repeat(20) });
    expect(result.ok).toBe(true);
  });

  it('reconnects a player who is already at the table', () => {
    const disconnected = setConnected(tableWith(2), 'p1', false);
    const result = addPlayer(disconnected, { id: 'p1', name: 'Ignored' });
    expect(result.ok && result.value.players.find((p) => p.id === 'p1')?.connected).toBe(true);
    expect(result.ok && result.value.players).toHaveLength(2);
  });

  it('makes duplicate names unique', () => {
    const result = addPlayer(tableWith(1), { id: 'x', name: 'Host' });
    expect(result.ok && result.value.players.map((p) => p.name)).toEqual(['Host', 'Host (2)']);
  });
});

describe('removePlayer dealer pointer', () => {
  const fiveSeats = (nextDealerIdx: number): TableState => ({ ...tableWith(5), nextDealerIdx });

  it('shifts the pointer down when a seat before it is removed', () => {
    const s = removePlayer(fiveSeats(2), 'p0');
    expect(s.nextDealerIdx).toBe(1);
    expect(s.players.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('keeps the pointer when the seat at the pointer is removed', () => {
    const s = removePlayer(fiveSeats(2), 'p2');
    expect(s.nextDealerIdx).toBe(2);
    expect(s.players[2]?.id).toBe('p3');
  });

  it('keeps the pointer when a seat after it is removed', () => {
    expect(removePlayer(fiveSeats(2), 'p4').nextDealerIdx).toBe(2);
  });

  it('wraps the pointer when it points past the last seat', () => {
    expect(removePlayer(fiveSeats(4), 'p4').nextDealerIdx).toBe(0);
  });

  it('removes pending players without touching the pointer', () => {
    const withPending: TableState = {
      ...fiveSeats(2),
      pending: [{ id: 'q', name: 'Queen', connected: true, isBot: false }],
    };
    const s = removePlayer(withPending, 'q');
    expect(s.pending).toEqual([]);
    expect(s.nextDealerIdx).toBe(2);
  });

  it('forgets the ready flag of a removed player', () => {
    expect(removePlayer({ ...fiveSeats(0), ready: ['p3'] }, 'p3').ready).toEqual([]);
  });
});

describe('setConnected', () => {
  it('marks a seated player as disconnected', () => {
    const s = setConnected(tableWith(3), 'p2', false);
    expect(s.players.find((p) => p.id === 'p2')?.connected).toBe(false);
  });
});
