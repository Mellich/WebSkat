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

/**
 * Snapshots before the Ramsch rule (protocol 4) have no table `rules`, no engine `options` and
 * `ramsch` flag (the engine would crash on the first pass-in), and records without a `ramsch` block.
 */
function migrateRamschRule(parsed: unknown): void {
  if (typeof parsed !== 'object' || parsed === null || !('table' in parsed)) return;
  const table = parsed.table;
  if (typeof table !== 'object' || table === null) return;
  const t = table as Record<string, unknown>;
  if (!('rules' in t)) t.rules = { ramsch: false, bock: false };
  const game = t.game;
  if (typeof game === 'object' && game !== null && 'engine' in game) {
    const engine = game.engine;
    if (typeof engine === 'object' && engine !== null) {
      const e = engine as Record<string, unknown>;
      if (!('options' in e)) e.options = { ramschOnPassIn: false, kontra: false };
      if (!('ramsch' in e)) e.ramsch = false;
    }
  }
  if (!Array.isArray(t.records)) return;
  for (const record of t.records as unknown[]) {
    if (typeof record === 'object' && record !== null && !('ramsch' in record)) {
      (record as Record<string, unknown>).ramsch = null;
    }
  }
}

/**
 * Snapshots before the Bockrunden rule (protocol 5) have no `bock` in the table rules, no
 * `bockGamesLeft`, no `bock` flag on the running game, and no `bock`/`bockTriggered` on records.
 * No Bock game existed, so every value is false / 0.
 */
function migrateBockRule(parsed: unknown): void {
  if (typeof parsed !== 'object' || parsed === null || !('table' in parsed)) return;
  const table = parsed.table;
  if (typeof table !== 'object' || table === null) return;
  const t = table as Record<string, unknown>;
  const rules = t.rules;
  if (typeof rules === 'object' && rules !== null && !('bock' in rules)) {
    (rules as Record<string, unknown>).bock = false;
  }
  if (!('bockGamesLeft' in t)) t.bockGamesLeft = 0;
  const game = t.game;
  if (typeof game === 'object' && game !== null && !('bock' in game)) {
    (game as Record<string, unknown>).bock = false;
  }
  if (!Array.isArray(t.records)) return;
  for (const record of t.records as unknown[]) {
    if (typeof record !== 'object' || record === null) continue;
    const r = record as Record<string, unknown>;
    if (!('bock' in r)) r.bock = false;
    if (!('bockTriggered' in r)) r.bockTriggered = false;
  }
}

/** Snapshots from protocol version 6 have no game log: the table starts with an empty one. */
function migrateLog(parsed: unknown): void {
  if (typeof parsed !== 'object' || parsed === null || !('table' in parsed)) return;
  const table = parsed.table;
  if (typeof table !== 'object' || table === null) return;
  const t = table as Record<string, unknown>;
  if (!Array.isArray(t.log)) t.log = [];
}

/**
 * Snapshots before Kontra and Re (protocol 8) have no Kontra table rule (off), no doubling window
 * (level 1, no defender passed), and finished played results and records have factor 1.
 */
function migrateDoubling(parsed: unknown): void {
  if (typeof parsed !== 'object' || parsed === null || !('table' in parsed)) return;
  const table = parsed.table;
  if (typeof table !== 'object' || table === null) return;
  const t = table as Record<string, unknown>;
  const rules = t.rules;
  if (typeof rules === 'object' && rules !== null && !('kontra' in rules)) {
    (rules as Record<string, unknown>).kontra = false;
  }
  const game = t.game;
  if (typeof game === 'object' && game !== null && 'engine' in game) {
    const engine = (game as Record<string, unknown>).engine;
    if (typeof engine === 'object' && engine !== null) {
      const e = engine as Record<string, unknown>;
      const options = e.options;
      if (typeof options === 'object' && options !== null && !('kontra' in options)) {
        (options as Record<string, unknown>).kontra = false;
      }
      if (!('doubling' in e)) e.doubling = 1;
      if (!('doublePassed' in e)) e.doublePassed = [];
      const result = e.result;
      if (typeof result === 'object' && result !== null && !('doubling' in result)) {
        (result as Record<string, unknown>).doubling = 1;
      }
    }
  }
  if (!Array.isArray(t.records)) return;
  for (const record of t.records as unknown[]) {
    if (typeof record === 'object' && record !== null && !('doubling' in record)) {
      (record as Record<string, unknown>).doubling = 1;
    }
  }
}

/** Snapshots before game limits have no `gameLimit` (unlimited) and `seriesOver`. */
function migrateGameLimit(parsed: unknown): void {
  if (typeof parsed !== 'object' || parsed === null || !('table' in parsed)) return;
  const t = parsed.table;
  if (typeof t !== 'object' || t === null) return;
  const table = t as Record<string, unknown>;
  if (!('gameLimit' in table)) table.gameLimit = 0;
  if (!('seriesOver' in table)) table.seriesOver = false;
}

/** Runs every migration step on a parsed snapshot. */
export function migrateSnapshot(parsed: unknown): void {
  migrateBotLevel(parsed);
  migrateRamschRule(parsed);
  migrateBockRule(parsed);
  migrateLog(parsed);
  migrateDoubling(parsed);
  migrateGameLimit(parsed);
}
