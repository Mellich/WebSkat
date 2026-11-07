import { describe, expect, it } from 'vitest';
import { de } from './de';
import { en } from './en';
import { translate } from './index';

describe('translate', () => {
  it('returns the string of the chosen language', () => {
    expect(translate('en', 'common.leave')).toBe('Leave');
    expect(translate('de', 'common.leave')).toBe('Verlassen');
  });

  it('fills in the named placeholders', () => {
    expect(translate('en', 'table.needName', { key: 'ABCD-EFGH' })).toBe(
      'Enter your name to join table ABCD-EFGH.',
    );
    expect(translate('de', 'lobby.kickConfirm', { name: 'Ben' })).toBe('Ben vom Tisch entfernen?');
  });

  it('leaves a placeholder without a value visible', () => {
    expect(translate('en', 'table.waitingFor')).toBe('Waiting for {name}…');
  });
});

describe('dictionaries', () => {
  it('have the same keys and no empty strings', () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
    for (const value of Object.values(de)) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it('keep the placeholders of the English text in the German text', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const placeholders = (en[key].match(/\{\w+\}/g) ?? []).sort();
      expect((de[key].match(/\{\w+\}/g) ?? []).sort()).toEqual(placeholders);
    }
  });
});
