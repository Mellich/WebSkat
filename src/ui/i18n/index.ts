// Translation lookup. `t(key, params)` interpolates `{name}` placeholders.

import { de } from './de';
import { en, type TranslationKey } from './en';
import { useSettings } from '../store/settings';

export type Language = 'en' | 'de';

const DICTIONARIES: Readonly<Record<Language, Readonly<Record<TranslationKey, string>>>> = { en, de };

export type Params = Readonly<Record<string, string | number>>;

export function translate(lang: Language, key: TranslationKey, params: Params = {}): string {
  const template: string = DICTIONARIES[lang][key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export type Translator = (key: TranslationKey, params?: Params) => string;

/** Translator bound to the language chosen in the settings. */
export function useT(): Translator {
  const lang = useSettings((s) => s.language);
  return (key, params) => translate(lang, key, params);
}

/** Non-hook access for stores and event handlers. */
export function translateNow(key: TranslationKey, params?: Params): string {
  return translate(useSettings.getState().language, key, params);
}

