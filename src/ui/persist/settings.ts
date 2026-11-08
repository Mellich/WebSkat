// User settings in localStorage, validated with zod on every load (docs/ui.md §6).

import { z } from 'zod';
import type { Language } from '../i18n';

export const SettingsSchema = z.object({
  name: z.string().max(20),
  language: z.enum(['en', 'de']),
  cardBack: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  confirmPlay: z.enum(['auto', 'always', 'never']),
  trickDisplayMs: z.union([z.literal(0), z.literal(300), z.literal(600), z.literal(1000), z.literal(2000)]).default(600),
  scoring: z.enum(['seeger', 'standard']),
  reducedMotion: z.enum(['system', 'on', 'off']),
});

export type Settings = z.infer<typeof SettingsSchema>;

const STORAGE_KEY = 'webskat.settings';

export function defaultSettings(browserLanguage: string): Settings {
  return {
    name: '',
    language: browserLanguage.toLowerCase().startsWith('de') ? 'de' : 'en',
    cardBack: 2,
    confirmPlay: 'auto',
    trickDisplayMs: 600,
    scoring: 'seeger',
    reducedMotion: 'system',
  };
}

interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Stored settings, or the defaults when nothing valid is stored. */
export function loadSettings(storage: Storage, browserLanguage: string): Settings {
  const fallback = defaultSettings(browserLanguage);
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return fallback;
  try {
    const stored: unknown = JSON.parse(raw);
    if (typeof stored === 'object' && stored !== null && !Array.isArray(stored)) {
      const legacy = stored as Record<string, unknown>;
      if (legacy.trickDisplayMs === undefined && [0, 300, 600, 1000].includes(legacy.botDelayMs as number)) {
        legacy.trickDisplayMs = legacy.botDelayMs;
      }
      delete legacy.botDelayMs;
    }
    const parsed = SettingsSchema.safeParse(stored);
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export function saveSettings(storage: Storage, settings: Settings): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function languageOf(settings: Settings): Language {
  return settings.language;
}
