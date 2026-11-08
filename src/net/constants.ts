// Network constants (docs/networking.md §1). Changing APP_ID or the protocol version
// makes old and new browsers unable to find each other, which is intended.

import { normalizeKey } from './keys';

export const APP_ID = 'webskat-v1-7c2f9a';
export const PROTOCOL_VERSION = 3;
export const LOBBY_ROOM = 'webskat-lobby-v1';
export const AD_INTERVAL_MS = 5000;
export const AD_TTL_MS = 15000;
export const JOIN_TIMEOUT_MS = 15000;

export function tableRoom(key: string): string {
  return `webskat-t-${normalizeKey(key)}`;
}
