// User settings in localStorage, validated with zod on every load (docs/06-ui-ux.md §7).

import { z } from 'zod';
import type { Language } from '../i18n';

export const SettingsSchema = z.object({
  name: z.string().max(20),
  language: z.enum(['en', 'de']),
  cardBack: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  confirmPlay: z.enum(['auto', 'always', 'never']),
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
    const parsed = SettingsSchema.safeParse(JSON.parse(raw));
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
