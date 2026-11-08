import { describe, expect, it } from 'vitest';
import type { GameErrorCode } from '../../engine';
import type { TableErrorCode } from '../../table';
import { de } from './de';
import { en } from './en';
import { translate } from './index';

/** Every error code the engine, the table and the network can send to the UI (typed, so a new code must be listed). */
const ERROR_CODES: Record<TableErrorCode | GameErrorCode | 'NOT_CONNECTED', true> = {
  WRONG_PHASE: true,
  NOT_YOUR_TURN: true,
  ILLEGAL_BID: true,
  CANNOT_HOLD: true,
  INVALID_DISCARD: true,
  INVALID_DECLARATION: true,
  ILLEGAL_CARD: true,
  UNKNOWN_CARD: true,
  NOT_HOST: true,
  NOT_SEATED: true,
  NOT_ACTIVE_PLAYER: true,
  WRONG_STATUS: true,
  TOO_FEW_PLAYERS: true,
  TABLE_FULL: true,
  UNKNOWN_PLAYER: true,
  GAME_RUNNING: true,
  INVALID_NAME: true,
  CANNOT_KICK_HOST: true,
  HOST_CANNOT_LEAVE: true,
  NOT_A_BOT: true,
  NOT_CONNECTED: true,
};

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
    expect(translate('en', 'status.waitingFor')).toBe('Waiting for {name}…');
  });
});

describe('dictionaries', () => {
  it('have the same keys and no empty strings', () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
    for (const value of Object.values(de)) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it('have a message for every error code, in both languages', () => {
    for (const code of Object.keys(ERROR_CODES)) {
      expect(Object.keys(en)).toContain(`error.${code}`);
      expect(Object.keys(de)).toContain(`error.${code}`);
    }
  });

  it('keep the placeholders of the English text in the German text', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const placeholders = (en[key].match(/\{\w+\}/g) ?? []).sort();
      expect((de[key].match(/\{\w+\}/g) ?? []).sort()).toEqual(placeholders);
    }
  });
});
