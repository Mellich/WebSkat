import { describe, expect, it } from 'vitest';
import { KEY_ALPHABET, formatKey, generateKey, isValidKey, joinLink, normalizeKey } from './keys';
import { randomBytes } from './random';
import { tableRoom } from './constants';

describe('KEY_ALPHABET', () => {
  it('has 32 unique symbols without the look-alikes 0, O, 1 and I', () => {
    expect(KEY_ALPHABET).toHaveLength(32);
    expect(new Set(KEY_ALPHABET).size).toBe(32);
    for (const c of '0O1I') {
      expect(KEY_ALPHABET).not.toContain(c);
    }
  });
});

describe('generateKey', () => {
  it('produces 8 symbols from the alphabet in the ABCD-EFGH form', () => {
    const key = generateKey((n) => new Uint8Array(Array.from({ length: n }, (_, i) => i * 37)));
    expect(key).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(isValidKey(key)).toBe(true);
  });

  it('maps every byte value onto the alphabet without bias', () => {
    const bytes = Uint8Array.from({ length: 8 }, (_, i) => i);
    expect(generateKey(() => bytes)).toBe('ABCD-EFGH');
    expect(generateKey(() => Uint8Array.from({ length: 8 }, () => 255))).toBe('9999-9999');
  });

  it('gives 1000 different keys from the system randomness', () => {
    const keys = new Set(Array.from({ length: 1000 }, () => generateKey(randomBytes)));
    expect(keys.size).toBe(1000);
  });
});

describe('normalizeKey, formatKey and isValidKey', () => {
  it('uppercases and strips spaces and dashes', () => {
    expect(normalizeKey(' abcd-efgh ')).toBe('ABCDEFGH');
  });

  it('formats an 8-symbol key with a dash in the middle', () => {
    expect(formatKey('abcdefgh')).toBe('ABCD-EFGH');
    expect(formatKey('ABC')).toBe('ABC');
  });

  it.each([
    ['ABCD-EFGH', true],
    ['abcd efgh', true],
    ['ABCD-EFG', false],
    ['ABCD-EFGHJ', false],
    ['ABC0-EFGH', false],
    ['ABCO-EFGH', false],
    ['', false],
  ])('isValidKey(%j) is %s', (input, valid) => {
    expect(isValidKey(input)).toBe(valid);
  });
});

describe('links and room names', () => {
  it('builds the join link with the formatted key', () => {
    expect(joinLink('abcdefgh', 'https://example.org/webskat/')).toBe('https://example.org/webskat/#/t/ABCD-EFGH');
  });

  it('builds the room name from the normalized key', () => {
    expect(tableRoom('abcd-efgh')).toBe('webskat-t-ABCDEFGH');
  });
});
