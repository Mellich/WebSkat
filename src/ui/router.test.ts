import { describe, expect, it } from 'vitest';
import { parseRoute, tableHash } from './router';

describe('parseRoute', () => {
  it.each([
    ['', { kind: 'home' }],
    ['#/', { kind: 'home' }],
    ['#/t/ABCD-EFGH', { kind: 'table', key: 'ABCDEFGH' }],
    ['#/t/abcd-efgh', { kind: 'table', key: 'ABCDEFGH' }],
    ['#/t/ABCD%2DEFGH', { kind: 'table', key: 'ABCDEFGH' }],
    ['#/t/ABCD-EF0H', { kind: 'home' }],
    ['#/t/', { kind: 'home' }],
    ['#/t/ABCD-EFGH/extra', { kind: 'home' }],
    ['#/dev/local', { kind: 'dev-local' }],
    ['#/dev/gallery', { kind: 'dev-gallery' }],
  ] as const)('%j → %j', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
  });

  it('builds the hash for a table key', () => {
    expect(tableHash('abcd efgh')).toBe('#/t/ABCDEFGH');
  });
});
