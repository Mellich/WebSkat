// Settings store (zustand). Every change is written to localStorage.

import { create } from 'zustand';
import { SettingsSchema, defaultSettings, loadSettings, saveSettings, type Settings } from '../persist/settings';
import { browserStorage } from '../persist/storage';

function browserLanguage(): string {
  return typeof navigator === 'undefined' ? 'en' : navigator.language;
}

function initial(): Settings {
  const storage = browserStorage();
  return storage === null ? defaultSettings(browserLanguage()) : loadSettings(storage, browserLanguage());
}

export interface SettingsState extends Settings {
  readonly update: (patch: Partial<Settings>) => void;
}

export const useSettings = create<SettingsState>()((set, get) => ({
  ...initial(),
  update: (patch) => {
    set(patch);
    const storage = browserStorage();
    // Parsing drops the action functions and keeps only the stored fields.
    if (storage !== null) saveSettings(storage, SettingsSchema.parse(get()));
  },
}));
