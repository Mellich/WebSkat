// Hash routing without a router library (docs/ui.md §1).

import { useSyncExternalStore } from 'react';
import { isValidKey, normalizeKey } from '../net';
import type { BotLevel } from '../table';

export type Route =
  | { readonly kind: 'home' }
  | { readonly kind: 'table'; readonly key: string; readonly invite: string | null }
  | { readonly kind: 'dev-local'; readonly seed: number | null; readonly players: number; readonly bots: BotLevel }
  | { readonly kind: 'dev-gallery' }
  | { readonly kind: 'changelog' };

export function parseRoute(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#/, '').split('?', 2);
  if (path === '/dev/local') {
    const params = new URLSearchParams(query);
    const seed = params.get('seed');
    const players = params.get('players');
    const bots = params.get('bots');
    return {
      kind: 'dev-local',
      seed: seed !== null && /^\d+$/.test(seed) ? Number(seed) : null,
      players: players !== null && /^[3-6]$/.test(players) ? Number(players) : 3,
      bots: bots === 'easy' || bots === 'strong' ? bots : 'normal',
    };
  }
  if (path === '/dev/gallery') return { kind: 'dev-gallery' };
  if (path === '/changelog') return { kind: 'changelog' };
  const table = /^\/t\/([^/]+)$/.exec(path);
  const raw = table?.[1];
  if (raw !== undefined && isValidKey(decodeURIComponent(raw))) {
    const invite = new URLSearchParams(query).get('invite');
    return {
      kind: 'table',
      key: normalizeKey(decodeURIComponent(raw)),
      invite: invite !== null && isValidKey(invite) ? normalizeKey(invite) : null,
    };
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

/** `#/t/KEY`, or `#/t/KEY?invite=CODE` when an invite code is given (docs/ui.md §1). */
export function tableHash(key: string, invite?: string): string {
  const query = invite === undefined ? '' : `?invite=${normalizeKey(invite)}`;
  return `#/t/${normalizeKey(key)}${query}`;
}
