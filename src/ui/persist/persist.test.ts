import { describe, expect, it } from 'vitest';
import { defaultSettings, loadSettings, saveSettings } from './settings';
import { clearSession, loadSession, saveSession } from './session';

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
    raw: (key: string) => data.get(key),
  };
}

describe('settings persistence', () => {
  it('uses German for German browsers and English otherwise', () => {
    expect(defaultSettings('de-AT').language).toBe('de');
    expect(defaultSettings('en-US').language).toBe('en');
    expect(defaultSettings('fr-FR').language).toBe('en');
  });

  it('returns the defaults when nothing is stored', () => {
    expect(loadSettings(memoryStorage(), 'en-GB')).toEqual(defaultSettings('en-GB'));
  });

  it('migrates the old bot delay setting to trick display time', () => {
    const old = { ...defaultSettings('en'), trickDisplayMs: undefined, botDelayMs: 1000 };
    expect(loadSettings(memoryStorage({ 'webskat.settings': JSON.stringify(old) }), 'en').trickDisplayMs).toBe(1000);
    const withoutValue = { ...defaultSettings('en'), trickDisplayMs: undefined };
    expect(loadSettings(memoryStorage({ 'webskat.settings': JSON.stringify(withoutValue) }), 'en').trickDisplayMs).toBe(600);
  });

  it('uses standard scoring by default', () => {
    expect(defaultSettings('en').scoring).toBe('standard');
  });

  it('round-trips valid settings', () => {
    const storage = memoryStorage();
    const settings = { ...defaultSettings('en'), name: 'Anna', cardBack: 3 as const, scoring: 'seeger' as const };
    saveSettings(storage, settings);
    expect(loadSettings(storage, 'en')).toEqual(settings);
  });

  it.each([
    ['not JSON', '{nope'],
    ['an unknown language', JSON.stringify({ ...defaultSettings('en'), language: 'fr' })],
    ['a card back out of range', JSON.stringify({ ...defaultSettings('en'), cardBack: 7 })],
    ['a name that is too long', JSON.stringify({ ...defaultSettings('en'), name: 'x'.repeat(21) })],
  ])('falls back to the defaults for %s', (_name, raw) => {
    expect(loadSettings(memoryStorage({ 'webskat.settings': raw }), 'de')).toEqual(defaultSettings('de'));
  });

  it('ignores the removed reducedMotion field of old settings', () => {
    const old = { ...defaultSettings('en'), name: 'Anna', reducedMotion: 'on' };
    const loaded = loadSettings(memoryStorage({ 'webskat.settings': JSON.stringify(old) }), 'en');
    expect(loaded).toEqual({ ...defaultSettings('en'), name: 'Anna' });
    expect('reducedMotion' in loaded).toBe(false);
  });
});

describe('session persistence', () => {
  const session = { key: 'ABCD-EFGH', name: 'Anna', token: 'a'.repeat(32) };

  it('stores and loads the seat session', () => {
    const storage = memoryStorage();
    saveSession(storage, session);
    expect(loadSession(storage)).toEqual(session);
  });

  it('clears the session', () => {
    const storage = memoryStorage();
    saveSession(storage, session);
    clearSession(storage);
    expect(loadSession(storage)).toBeNull();
  });

  it.each([
    ['a malformed token', { ...session, token: 'not-a-token' }],
    ['a missing name', { key: session.key, token: session.token }],
  ])('ignores a stored session with %s', (_name, value) => {
    expect(loadSession(memoryStorage({ 'webskat.session': JSON.stringify(value) }))).toBeNull();
  });
});
