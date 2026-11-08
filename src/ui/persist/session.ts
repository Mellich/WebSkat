// The client's seat session for reconnecting after a reload (docs/networking.md §4).

import { z } from 'zod';

export const SessionSchema = z.object({
  key: z.string().min(8).max(9),
  name: z.string().min(1).max(40),
  token: z.string().regex(/^[0-9a-f]{32}$/),
});

export type StoredSession = z.infer<typeof SessionSchema>;

const STORAGE_KEY = 'webskat.session';

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function loadSession(storage: KeyValueStorage): StoredSession | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  try {
    const parsed = SessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveSession(storage: KeyValueStorage, session: StoredSession): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(storage: KeyValueStorage): void {
  storage.removeItem(STORAGE_KEY);
}
