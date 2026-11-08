// Card image URLs (docs/assets.md). Always relative to BASE_URL so a sub-path deployment works.

import type { CardId } from '../engine';

export type BackIndex = 0 | 1 | 2 | 3;

export const DEFAULT_BACK: BackIndex = 2;

export function logoUrl(): string {
  return `${import.meta.env.BASE_URL}skatastisches-logo.png`;
}

export function cardUrl(id: CardId): string {
  return `${import.meta.env.BASE_URL}cards/${id}.webp`;
}

export function backUrl(index: BackIndex): string {
  return `${import.meta.env.BASE_URL}backs/${String(index)}.webp`;
}
