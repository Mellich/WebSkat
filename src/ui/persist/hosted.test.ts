import { describe, expect, it } from 'vitest';
import type { HostSnapshot } from '../../net';
import { addPlayer, type TableState } from '../../table';
import { tableWith } from '../../table/testing';
import { listHostedKeys, loadHostSnapshot, removeHostSnapshot, resumableSnapshot, saveHostSnapshot } from './hosted';

/** In-memory stand-in for localStorage. */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    get length() {
      return data.size;
    },
    key: (index: number) => [...data.keys()][index] ?? null,
  };
}

function snapshotOf(table: TableState): HostSnapshot {
  return { table, tokens: { 'token-anna': 'p1' } };
}

/** Host p0, humans p1 and p2, and a bot. */
function tableWithBot(): TableState {
  const added = addPlayer(tableWith(3), { id: 'bot-1', name: 'Bot', isBot: true });
  if (!added.ok) throw new Error(added.error.message);
  return added.value;
}

describe('host snapshots in localStorage', () => {
  it('returns the snapshot that was saved', () => {
    const storage = memoryStorage();
    const snapshot = snapshotOf(tableWith(3));
    saveHostSnapshot(storage, snapshot);
    expect(loadHostSnapshot(storage, 'TESTKEY')).toEqual(snapshot);
  });

  it.each([
    ['nothing is stored', null],
    ['the text is not JSON', '{nope'],
    ['the shape is wrong', JSON.stringify({ table: { key: 'TESTKEY' }, tokens: {} })],
  ])('loads nothing when %s', (_case, raw) => {
    const storage = memoryStorage(raw === null ? {} : { 'webskat.host.TESTKEY': raw });
    expect(loadHostSnapshot(storage, 'TESTKEY')).toBeNull();
  });

  it('lists only the keys of readable snapshots', () => {
    const storage = memoryStorage();
    saveHostSnapshot(storage, snapshotOf(tableWith(3)));
    saveHostSnapshot(storage, snapshotOf({ ...tableWith(3), key: 'OTHERKEY' }));
    storage.setItem('webskat.host.BROKEN', '{');
    storage.setItem('webskat.session', '{"key":"TESTKEY"}');
    expect(listHostedKeys(storage).sort()).toEqual(['OTHERKEY', 'TESTKEY']);
  });

  it('forgets a removed snapshot', () => {
    const storage = memoryStorage();
    saveHostSnapshot(storage, snapshotOf(tableWith(3)));
    removeHostSnapshot(storage, 'TESTKEY');
    expect(loadHostSnapshot(storage, 'TESTKEY')).toBeNull();
    expect(listHostedKeys(storage)).toEqual([]);
  });
});

describe('resumableSnapshot', () => {
  it('disconnects every human (seated or pending) and keeps the host and the bots', () => {
    const table: TableState = {
      ...tableWithBot(),
      pending: [{ id: 'p9', name: 'Late', connected: true, isBot: false }],
    };
    const resumed = resumableSnapshot(snapshotOf(table));
    expect(resumed.table.players.map((p) => [p.id, p.connected])).toEqual([
      ['p0', true],
      ['p1', false],
      ['p2', false],
      ['bot-1', true],
    ]);
    expect(resumed.table.pending.map((p) => p.connected)).toEqual([false]);
  });

  it('keeps the reconnect tokens, so the humans can reclaim their seats', () => {
    const snapshot = snapshotOf(tableWithBot());
    expect(resumableSnapshot(snapshot).tokens).toEqual(snapshot.tokens);
  });
});
