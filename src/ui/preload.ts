// Card images are preloaded once per page so that tricks and open hands show without delay.
// Module state is fine here: this is UI code, not engine/table code.

import { ALL_CARDS } from '../engine';
import { backUrl, cardUrl, type BackIndex } from './assets';

const loaded = new Set<string>();

function loadImage(url: string): void {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
}

/** All 32 card faces plus the given card back. */
export function cardImageUrls(back: BackIndex): string[] {
  return [...ALL_CARDS.map((card) => cardUrl(card)), backUrl(back)];
}

/** Starts loading the urls that were not loaded before. Returns how many were new. */
export function preloadImages(urls: readonly string[], load: (url: string) => void = loadImage): number {
  let fresh = 0;
  for (const url of urls) {
    if (loaded.has(url)) continue;
    loaded.add(url);
    load(url);
    fresh++;
  }
  return fresh;
}
