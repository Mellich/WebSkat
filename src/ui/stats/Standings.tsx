// Standings: one row per player, sorted by the chosen total (docs/07 §3).

import type { PlayerStats, TableStats } from '../../table';
import { useT } from '../i18n';
import { signed } from './gameLabel';
import styles from './StatsPanel.module.css';

export interface StandingsProps {
  readonly stats: TableStats;
  readonly scoring: 'seeger' | 'standard';
  readonly viewerId: string;
}

function average(p: PlayerStats, scoring: 'seeger' | 'standard'): string {
  return p.games === 0 ? '—' : p.average[scoring].toFixed(1);
}

export function Standings({ stats, scoring, viewerId }: StandingsProps) {
  const t = useT();
  const ranked = [...stats.players].sort((a, b) => b.total[scoring] - a.total[scoring]);
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">{t('stats.rank')}</th>
          <th scope="col">{t('stats.name')}</th>
          <th scope="col">{t('stats.total')}</th>
          <th scope="col">{t('stats.games')}</th>
          <th scope="col">{t('stats.declared')}</th>
          <th scope="col">{t('stats.winRate')}</th>
          <th scope="col">{t('stats.average')}</th>
          <th scope="col">{t('stats.best')}</th>
          <th scope="col">{t('stats.worst')}</th>
        </tr>
      </thead>
      <tbody>
        {ranked.map((p, i) => (
          <tr key={p.playerId} className={p.playerId === viewerId ? styles.me : undefined}>
            <td>{i + 1}</td>
            <td>{p.name}</td>
            <td>{signed(p.total[scoring])}</td>
            <td>{p.games}</td>
            <td>{p.declared}</td>
            <td>{p.winRate === null ? '—' : `${String(Math.round(p.winRate * 100))} %`}</td>
            <td>{average(p, scoring)}</td>
            <td>{signed(p.best[scoring])}</td>
            <td>{signed(p.worst[scoring])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
