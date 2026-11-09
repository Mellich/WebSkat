// CSV export of the game history (docs/statistics.md §3). Pure: text in, text out.

import type { GameRecord, PlayerStats } from '../../table';
import type { Translator } from '../i18n';
import { gameLabel, recordFlags, spitzenLabel } from './gameLabel';

/** Quotes a field; a leading = + - @ is neutralised so spreadsheets do not run it as a formula. */
export function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** One row per game, oldest first. Both scoring systems are exported, one column per player each. */
export function historyCsv(records: readonly GameRecord[], players: readonly PlayerStats[], t: Translator): string {
  const header = [
    t('stats.rank'),
    t('stats.date'),
    t('stats.declarer'),
    t('stats.game'),
    t('stats.bid'),
    t('stats.declarerPoints'),
    t('stats.defenderPoints'),
    t('stats.flags'),
    ...players.map((p) => `${p.name} (${t('stats.seeger')})`),
    ...players.map((p) => `${p.name} (${t('stats.standard')})`),
  ];
  const rows = records.map((r) => {
    const played = r.outcome === 'played';
    const declarer = r.declarerId === null ? '' : (players.find((p) => p.playerId === r.declarerId)?.name ?? '?');
    const label = gameLabel(r, t);
    const spitzen = played ? spitzenLabel(r, t) : '';
    return [
      String(r.number),
      new Date(r.timestamp).toISOString(),
      declarer,
      spitzen === '' ? label : `${label} · ${spitzen}`,
      played && r.bid !== null ? String(r.bid) : '',
      r.declarerPoints === null ? '' : String(r.declarerPoints),
      r.defenderPoints === null ? '' : String(r.defenderPoints),
      played || r.outcome === 'ramsch' ? recordFlags(r, t) : '',
      ...players.map((p) => String(r.scores.seeger[p.playerId] ?? 0)),
      ...players.map((p) => String(r.scores.standard[p.playerId] ?? 0)),
    ];
  });
  return [header, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}

/** Browser download of a CSV text (UTF-8 with BOM so Excel reads umlauts). */
export function downloadCsv(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
