import { describe, expect, it } from 'vitest';
import { resolveAssetUrl } from './assets';

describe('resolveAssetUrl', () => {
  // The released build sits under a sub-path and uses BASE_URL './'; the stamp must still point at the page's folder.
  it('resolves a relative path against the page URL', () => {
    expect(resolveAssetUrl('./felt-stamp.webp', 'https://example.github.io/WebSkat/')).toBe(
      'https://example.github.io/WebSkat/felt-stamp.webp',
    );
  });

  it('keeps an absolute path on the same origin', () => {
    expect(resolveAssetUrl('/felt-stamp.webp', 'http://localhost:5173/')).toBe('http://localhost:5173/felt-stamp.webp');
  });
});
