import { describe, expect, it } from 'vitest';
import { parseRoute, tableHash } from './router';

describe('parseRoute', () => {
  it.each([
    ['', { kind: 'home' }],
    ['#/', { kind: 'home' }],
    ['#/t/ABCD-EFGH', { kind: 'table', key: 'ABCDEFGH', invite: null }],
    ['#/t/abcd-efgh', { kind: 'table', key: 'ABCDEFGH', invite: null }],
    ['#/t/ABCD%2DEFGH', { kind: 'table', key: 'ABCDEFGH', invite: null }],
    ['#/t/ABCD-EFGH?invite=wxyz-2345', { kind: 'table', key: 'ABCDEFGH', invite: 'WXYZ2345' }],
    ['#/t/ABCD-EFGH?invite=WXYZ0000', { kind: 'table', key: 'ABCDEFGH', invite: null }],
    ['#/t/ABCD-EFGH?other=1', { kind: 'table', key: 'ABCDEFGH', invite: null }],
    ['#/t/ABCD-EF0H', { kind: 'home' }],
    ['#/t/', { kind: 'home' }],
    ['#/t/ABCD-EFGH/extra', { kind: 'home' }],
    ['#/dev/local', { kind: 'dev-local', seed: null, players: 3, bots: 'normal' }],
    ['#/dev/local?seed=123', { kind: 'dev-local', seed: 123, players: 3, bots: 'normal' }],
    ['#/dev/local?seed=abc&players=5', { kind: 'dev-local', seed: null, players: 5, bots: 'normal' }],
    ['#/dev/local?players=9', { kind: 'dev-local', seed: null, players: 3, bots: 'normal' }],
    ['#/dev/local?bots=strong', { kind: 'dev-local', seed: null, players: 3, bots: 'strong' }],
    ['#/dev/local?bots=hard', { kind: 'dev-local', seed: null, players: 3, bots: 'normal' }],
    ['#/dev/gallery', { kind: 'dev-gallery' }],
  ] as const)('%j → %j', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
  });

  it('builds the hash for a table key, with an optional invite', () => {
    expect(tableHash('abcd efgh')).toBe('#/t/ABCDEFGH');
    expect(tableHash('abcd efgh', 'wxyz-2345')).toBe('#/t/ABCDEFGH?invite=WXYZ2345');
  });
});
