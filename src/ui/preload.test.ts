import { describe, expect, it, vi } from 'vitest';
import { ALL_CARDS } from '../engine';
import { backUrl, cardUrl } from './assets';
import { cardImageUrls, preloadImages } from './preload';

describe('cardImageUrls', () => {
  it('lists the 32 card faces and the chosen back, each once', () => {
    const urls = cardImageUrls(2);
    expect(urls).toHaveLength(ALL_CARDS.length + 1);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain(cardUrl('CJ'));
    expect(urls).toContain(backUrl(2));
  });
});

describe('preloadImages', () => {
  it('loads each url once per page and reports how many were new', () => {
    const load = vi.fn<(url: string) => void>();
    expect(preloadImages(cardImageUrls(1), load)).toBe(ALL_CARDS.length + 1);
    expect(load).toHaveBeenCalledTimes(ALL_CARDS.length + 1);

    load.mockClear();
    expect(preloadImages(cardImageUrls(1), load)).toBe(0);
    expect(load).not.toHaveBeenCalled();

    // A different back is the only new image.
    expect(preloadImages(cardImageUrls(0), load)).toBe(1);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(backUrl(0));
  });
});
