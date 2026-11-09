import { describe, expect, it } from 'vitest';
import type { HostSnapshot } from '../../net';
import { addPlayer, applyCommand, type TableState } from '../../table';
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

/** A three-player table whose first game was passed in (one record). */
function passedInTable(): TableState {
  let s = applyCommand(tableWith(3), 'p0', { type: 'start' }, { now: 1, seed: 7 });
  if (!s.ok) throw new Error(s.error.message);
  const game = s.value.state.game;
  for (const id of [game?.roles.middlehand, game?.roles.hindhand, game?.roles.forehand]) {
    s = applyCommand(s.value.state, id ?? '', { type: 'game', action: { type: 'pass' } }, { now: 2, seed: 7 });
    if (!s.ok) throw new Error(s.error.message);
  }
  return s.value.state;
}

/** Host p0, humans p1 and p2, and a bot. */
function tableWithBot(): TableState {
  const added = addPlayer(tableWith(3), { id: 'bot-1', name: 'Bot', isBot: true });
  if (!added.ok) throw new Error(added.error.message);
  return added.value;
}

describe('host snapshots in localStorage', () => {
  it('keeps the invite codes of a snapshot', () => {
    const storage = memoryStorage();
    const snapshot: HostSnapshot = { ...snapshotOf(tableWith(3)), invites: { WXYZ2345: 'p1' } };
    saveHostSnapshot(storage, snapshot);
    expect(loadHostSnapshot(storage, 'TESTKEY')?.invites).toEqual({ WXYZ2345: 'p1' });
    expect(resumableSnapshot(snapshot).invites).toEqual({ WXYZ2345: 'p1' });
  });

  it('loads a snapshot from before invites without them', () => {
    const storage = memoryStorage();
    saveHostSnapshot(storage, snapshotOf(tableWith(3)));
    const loaded = loadHostSnapshot(storage, 'TESTKEY');
    expect(loaded).not.toBeNull();
    expect(loaded?.invites).toBeUndefined();
  });

  it('upgrades a snapshot from before the Ramsch rule', () => {
    const storage = memoryStorage();
    const table = passedInTable();
    saveHostSnapshot(storage, snapshotOf(table));
    const key = storage.key(0);
    if (key === null) throw new Error('nothing saved');
    const old = JSON.parse(JSON.stringify(snapshotOf(table))) as {
      table: { rules?: unknown; game: { engine: { options?: unknown; ramsch?: unknown } }; records: { ramsch?: unknown }[] };
    };
    delete old.table.rules;
    delete old.table.game.engine.options;
    delete old.table.game.engine.ramsch;
    for (const record of old.table.records) delete record.ramsch;
    storage.setItem(key, JSON.stringify(old));

    const loaded = loadHostSnapshot(storage, 'TESTKEY');
    expect(loaded?.table.rules).toEqual({ ramsch: false, bock: false });
    expect(loaded?.table.game?.engine.options).toEqual({ ramschOnPassIn: false });
    expect(loaded?.table.game?.engine.ramsch).toBe(false);
    expect(loaded?.table.records[0]?.ramsch).toBeNull();
  });

  it('upgrades a snapshot from before the Bockrunden rule', () => {
    const storage = memoryStorage();
    const table = passedInTable();
    saveHostSnapshot(storage, snapshotOf(table));
    const key = storage.key(0);
    if (key === null) throw new Error('nothing saved');
    const old = JSON.parse(JSON.stringify(snapshotOf(table))) as {
      table: {
        rules: { bock?: unknown };
        bockGamesLeft?: unknown;
        game: { bock?: unknown };
        records: { bock?: unknown; bockTriggered?: unknown }[];
      };
    };
    delete old.table.rules.bock;
    delete old.table.bockGamesLeft;
    delete old.table.game.bock;
    for (const record of old.table.records) {
      delete record.bock;
      delete record.bockTriggered;
    }
    storage.setItem(key, JSON.stringify(old));

    const loaded = loadHostSnapshot(storage, 'TESTKEY');
    expect(loaded?.table.rules).toEqual({ ramsch: false, bock: false });
    expect(loaded?.table.bockGamesLeft).toBe(0);
    expect(loaded?.table.game?.bock).toBe(false);
    expect(loaded?.table.records[0]).toMatchObject({ bock: false, bockTriggered: false });
  });

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

  it('gives each bot of an older snapshot the table-wide strength it had', () => {
    const storage = memoryStorage();
    const old = JSON.parse(JSON.stringify(snapshotOf(tableWith(3, { bots: true })))) as {
      table: { botLevel?: string; players: { isBot: boolean; botLevel?: string }[] };
      tokens: Record<string, string>;
    };
    for (const p of old.table.players) delete p.botLevel;
    old.table.botLevel = 'strong';
    storage.setItem('webskat.host.TESTKEY', JSON.stringify(old));
    const loaded = loadHostSnapshot(storage, 'TESTKEY')?.table;
    expect(loaded?.players.filter((p) => p.isBot).map((p) => p.botLevel)).toEqual(['strong', 'strong']);
    expect(loaded !== undefined && 'botLevel' in loaded).toBe(false);
  });

  it('gives bots of an older snapshot without a table strength the normal strength', () => {
    const storage = memoryStorage();
    const old = JSON.parse(JSON.stringify(snapshotOf(tableWith(3, { bots: true })))) as {
      table: { players: { botLevel?: string }[] };
      tokens: Record<string, string>;
    };
    for (const p of old.table.players) delete p.botLevel;
    storage.setItem('webskat.host.TESTKEY', JSON.stringify(old));
    expect(loadHostSnapshot(storage, 'TESTKEY')?.table.players.map((p) => p.botLevel)).toEqual([undefined, 'normal', 'normal']);
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
