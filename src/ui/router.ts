// Hash routing without a router library (docs/06-ui-ux.md §1).

import { useSyncExternalStore } from 'react';
import { isValidKey, normalizeKey } from '../net';

export type Route =
  | { readonly kind: 'home' }
  | { readonly kind: 'table'; readonly key: string }
  | { readonly kind: 'dev-local' }
  | { readonly kind: 'dev-gallery' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '');
  if (path === '/dev/local') return { kind: 'dev-local' };
  if (path === '/dev/gallery') return { kind: 'dev-gallery' };
  const table = /^\/t\/([^/]+)$/.exec(path);
  const raw = table?.[1];
  if (raw !== undefined && isValidKey(decodeURIComponent(raw))) {
    return { kind: 'table', key: normalizeKey(decodeURIComponent(raw)) };
  }
  return { kind: 'home' };
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
  };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '');
  return parseRoute(hash);
}

export function navigate(hash: string): void {
  window.location.hash = hash;
}

export function tableHash(key: string): string {
  return `#/t/${normalizeKey(key)}`;
}
