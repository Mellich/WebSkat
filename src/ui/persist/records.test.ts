import { describe, expect, it } from 'vitest';
import { makeRecord, type GameRecord } from '../../table';
import { GRAND_144, finishedGame } from '../../table/fixtures';
import { ctxFor, tableWith } from '../../table/testing';
import { RECORD_CACHE_LIMIT, loadRecordCache, saveRecordCache } from './records';

/** In-memory stand-in for localStorage. */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

function recordNumbered(number: number): GameRecord {
  const table = tableWith(3);
  const roles = { forehand: 'p0', middlehand: 'p1', hindhand: 'p2' };
  return makeRecord(table, finishedGame(table, roles, GRAND_144, number), ctxFor(0));
}

describe('client record cache', () => {
  it('returns the records that were saved for the table', () => {
    const storage = memoryStorage();
    const records = [recordNumbered(1), recordNumbered(2)];
    saveRecordCache(storage, 'TESTKEY', records);
    expect(loadRecordCache(storage, 'TESTKEY')).toEqual(records);
  });

  it('keeps the caches of different tables apart', () => {
    const storage = memoryStorage();
    saveRecordCache(storage, 'TESTKEY', [recordNumbered(1)]);
    expect(loadRecordCache(storage, 'OTHERKEY')).toEqual([]);
  });

  it.each([
    ['nothing is stored', null],
    ['the text is not JSON', '[{'],
    ['the entries are not records', JSON.stringify([{ id: 1 }])],
  ])('loads nothing when %s', (_case, raw) => {
    const storage = memoryStorage(raw === null ? {} : { 'webskat.records.TESTKEY': raw });
    expect(loadRecordCache(storage, 'TESTKEY')).toEqual([]);
  });

  it('keeps only the newest records when the cap is exceeded', () => {
    const storage = memoryStorage();
    const sample = recordNumbered(1);
    const many = Array.from({ length: RECORD_CACHE_LIMIT + 3 }, (_, i) => ({ ...sample, number: i + 1 }));
    saveRecordCache(storage, 'TESTKEY', many);
    const loaded = loadRecordCache(storage, 'TESTKEY');
    expect(loaded).toHaveLength(RECORD_CACHE_LIMIT);
    expect(loaded[0]?.number).toBe(4);
    expect(loaded.at(-1)?.number).toBe(RECORD_CACHE_LIMIT + 3);
  });
});
