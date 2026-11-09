// Names for bots (docs/bots.md §7). The first bot is always Guguurz; the next bots take the next
// unused name of the pool. Only when the pool is used up does a bot get a numbered "Bot" name.

import { uniqueName } from './seating';

export const BOT_NAMES = [
  'Guguurz',
  'Blubb',
  'Kartoffel',
  'Schnurrli',
  'Brummel',
  'Zwackel',
  'Pumpernickel',
  'Knorz',
  'Mopsi',
  'Flitz',
  'Rumpel',
  'Wuschel',
] as const;

/** The name for a new bot at a table whose players are `existing` (pure and deterministic). */
export function botName(existing: readonly string[]): string {
  const free = BOT_NAMES.find((name) => !existing.includes(name));
  return free ?? uniqueName(existing, 'Bot');
}
