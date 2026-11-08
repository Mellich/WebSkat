// Upgrades stored host snapshots written by older app versions (docs/networking.md §8).
// Every change of the TableState or HostSnapshot shape adds a step here; each step must be safe
// to run on any older snapshot and mutates the parsed JSON in place (before the shape guard).

const LEVELS: readonly unknown[] = ['easy', 'normal', 'strong'];

/**
 * Snapshots from protocol version 2 kept one bot strength for the whole table. Each bot gets that
 * strength (or 'normal') as its own; the table field is dropped.
 */
function migrateBotLevel(parsed: unknown): void {
  if (typeof parsed !== 'object' || parsed === null || !('table' in parsed)) return;
  const table = parsed.table;
  if (typeof table !== 'object' || table === null) return;
  const t = table as Record<string, unknown>;
  const level = LEVELS.includes(t.botLevel) ? t.botLevel : 'normal';
  delete t.botLevel;
  for (const list of [t.players, t.pending]) {
    if (!Array.isArray(list)) continue;
    for (const p of list as unknown[]) {
      if (typeof p !== 'object' || p === null) continue;
      const player = p as Record<string, unknown>;
      if (player.isBot === true && !LEVELS.includes(player.botLevel)) player.botLevel = level;
    }
  }
}

/** Runs every migration step on a parsed snapshot. */
export function migrateSnapshot(parsed: unknown): void {
  migrateBotLevel(parsed);
}
