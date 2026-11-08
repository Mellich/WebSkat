import { describe, expect, it } from 'vitest';
import { declarationOptions, validateDeclaration } from './declaration';
import type { Announce, Declaration } from './types';

const ANNOUNCES: readonly Announce[] = ['none', 'schneider', 'schwarz'];

/** Expected validity, written from the table in skat-rules §5.1. */
function expectedValid(d: Declaration, hand: boolean): boolean {
  if (d.hand !== hand) return false;
  if (d.kind === 'null') return true;
  if (!d.hand) return d.announce === 'none' && !d.ouvert;
  if (d.ouvert) return d.announce === 'schwarz';
  return true;
}

describe('validateDeclaration (skat-rules §5.1)', () => {
  it.each([
    ['suit without Hand', { kind: 'suit', trump: 'H', hand: false, announce: 'none', ouvert: false }, false, true],
    ['grand without Hand', { kind: 'grand', hand: false, announce: 'none', ouvert: false }, false, true],
    ['suit without Hand, Schneider', { kind: 'suit', trump: 'H', hand: false, announce: 'schneider', ouvert: false }, false, false],
    ['grand without Hand, Ouvert', { kind: 'grand', hand: false, announce: 'none', ouvert: true }, false, false],
    ['null without Hand', { kind: 'null', hand: false, ouvert: false }, false, true],
    ['null Ouvert without Hand', { kind: 'null', hand: false, ouvert: true }, false, true],
    ['suit Hand, Schneider', { kind: 'suit', trump: 'S', hand: true, announce: 'schneider', ouvert: false }, true, true],
    ['grand Hand, Schwarz', { kind: 'grand', hand: true, announce: 'schwarz', ouvert: false }, true, true],
    ['suit Hand Ouvert without Schwarz', { kind: 'suit', trump: 'S', hand: true, announce: 'none', ouvert: true }, true, false],
    ['grand Hand Ouvert with Schneider only', { kind: 'grand', hand: true, announce: 'schneider', ouvert: true }, true, false],
    ['suit Hand Ouvert with Schwarz', { kind: 'suit', trump: 'D', hand: true, announce: 'schwarz', ouvert: true }, true, true],
    ['null Hand', { kind: 'null', hand: true, ouvert: false }, true, true],
    ['null Hand Ouvert', { kind: 'null', hand: true, ouvert: true }, true, true],
    ['hand flag contradicts the way the game was played', { kind: 'grand', hand: true, announce: 'none', ouvert: false }, false, false],
  ] as const)('%s → valid=%s', (_name, d, hand, valid) => {
    expect(validateDeclaration(d as Declaration, hand).ok).toBe(valid);
  });

  it('accepts exactly the combinations of the validity matrix', () => {
    for (const hand of [false, true]) {
      for (const trump of ['C', 'S', 'H', 'D'] as const) {
        for (const announce of ANNOUNCES) {
          for (const ouvert of [false, true]) {
            const candidates: Declaration[] = [
              { kind: 'suit', trump, hand, announce, ouvert },
              { kind: 'grand', hand, announce, ouvert },
            ];
            for (const d of candidates) {
              expect(validateDeclaration(d, hand).ok).toBe(expectedValid(d, hand));
            }
          }
        }
        for (const ouvert of [false, true]) {
          const d: Declaration = { kind: 'null', hand, ouvert };
          expect(validateDeclaration(d, hand).ok).toBe(expectedValid(d, hand));
        }
      }
    }
  });

  it('returns the declaration unchanged when valid', () => {
    const d: Declaration = { kind: 'suit', trump: 'C', hand: true, announce: 'schwarz', ouvert: true };
    const result = validateDeclaration(d, true);
    expect(result).toEqual({ ok: true, value: d });
  });
});

describe('declarationOptions', () => {
  it('has 7 entries without Hand, all valid and unique', () => {
    const options = declarationOptions(false);
    expect(options).toHaveLength(7);
    expect(new Set(options.map((d) => JSON.stringify(d))).size).toBe(7);
    for (const d of options) {
      expect(validateDeclaration(d, false).ok).toBe(true);
    }
  });

  it('has 22 entries with Hand, all valid and unique', () => {
    const options = declarationOptions(true);
    expect(options).toHaveLength(22);
    expect(new Set(options.map((d) => JSON.stringify(d))).size).toBe(22);
    for (const d of options) {
      expect(validateDeclaration(d, true).ok).toBe(true);
    }
  });

  it('contains the Null variants and Ouvert Schwarz for every suit with Hand', () => {
    const options = declarationOptions(true);
    expect(options).toContainEqual({ kind: 'null', hand: true, ouvert: true });
    expect(options).toContainEqual({ kind: 'null', hand: true, ouvert: false });
    for (const trump of ['C', 'S', 'H', 'D'] as const) {
      expect(options).toContainEqual({ kind: 'suit', trump, hand: true, announce: 'schwarz', ouvert: true });
    }
  });
});
