// One row per game, newest first, with the score change of every player (docs/statistics.md §3).

import type { GameRecord, PlayerId, PlayerStats } from '../../table';
import { useT, type Translator } from '../i18n';
import { gameLabel, signed } from './gameLabel';
import styles from './StatsPanel.module.css';

export interface HistoryProps {
  readonly records: readonly GameRecord[];
  readonly players: readonly PlayerStats[];
  readonly scoring: 'seeger' | 'standard';
}

function flags(r: GameRecord, t: Translator): string {
  const parts: string[] = [];
  if (r.schneider || r.announce === 'schneider') parts.push(t('game.schneider'));
  if (r.schwarz || r.announce === 'schwarz') parts.push(t('game.schwarz'));
  if (r.overbid) parts.push(t('stats.overbid'));
  return parts.join(', ');
}

function spitzen(r: GameRecord, t: Translator): string {
  if (r.spitzenCount === null || r.spitzenWith === null) return '';
  return r.spitzenWith ? t('game.with', { count: r.spitzenCount }) : t('game.without', { count: r.spitzenCount });
}

function delta(r: GameRecord, id: PlayerId, scoring: 'seeger' | 'standard'): string {
  return signed(r.scores[scoring][id] ?? 0);
}

export function History({ records, players, scoring }: HistoryProps) {
  const t = useT();
  const newestFirst = [...records].reverse();
  return (
    <div className={styles.scroll}>
      <table>
        <thead>
          <tr>
            <th scope="col">{t('stats.rank')}</th>
            <th scope="col">{t('stats.declarer')}</th>
            <th scope="col">{t('stats.game')}</th>
            <th scope="col">{t('stats.bid')}</th>
            <th scope="col">{t('stats.points')}</th>
            <th scope="col">{t('stats.flags')}</th>
            <th scope="col">{t('stats.result')}</th>
            {players.map((p) => (
              <th key={p.playerId} scope="col">{p.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {newestFirst.map((r) => {
            const declarer = r.declarerId === null ? '' : (players.find((p) => p.playerId === r.declarerId)?.name ?? '?');
            const played = r.outcome === 'played';
            return (
              <tr key={r.id} className={played ? undefined : styles.passed} data-testid="history-row">
                <td>{r.number}</td>
                <td>{declarer}</td>
                <td>
                  {gameLabel(r, t)}
                  {played && spitzen(r, t) !== '' ? ` · ${spitzen(r, t)}` : ''}
                </td>
                <td>{played ? String(r.bid) : '—'}</td>
                <td>{played && r.declarerPoints !== null ? `${String(r.declarerPoints)} : ${String(120 - r.declarerPoints)}` : '—'}</td>
                <td>{played ? flags(r, t) : ''}</td>
                <td>{played && r.declarerId !== null ? delta(r, r.declarerId, scoring) : '—'}</td>
                {players.map((p) => (
                  <td key={p.playerId}>{delta(r, p.playerId, scoring)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
