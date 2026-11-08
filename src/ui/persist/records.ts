// Cache of the game records of a table on the client, so that the statistics show at once after
// a reload (docs/statistics.md §4). Capped at 500 records; validated with zod on load.

import { z } from 'zod';
import { GameRecordSchema } from '../../net';
import type { GameRecord } from '../../table';

export const RECORD_CACHE_LIMIT = 500;

const CacheSchema = z.array(GameRecordSchema);

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function storageKey(tableKey: string): string {
  return `webskat.records.${tableKey}`;
}

export function loadRecordCache(storage: KeyValueStorage, tableKey: string): GameRecord[] {
  const raw = storage.getItem(storageKey(tableKey));
  if (raw === null) return [];
  try {
    const parsed = CacheSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function saveRecordCache(storage: KeyValueStorage, tableKey: string, records: readonly GameRecord[]): void {
  storage.setItem(storageKey(tableKey), JSON.stringify(records.slice(-RECORD_CACHE_LIMIT)));
}
