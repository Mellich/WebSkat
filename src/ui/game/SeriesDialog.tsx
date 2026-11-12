// The end of a limited series: podium of the best three, table statistics and small fireworks
// (docs/ui-game-screen.md §8). Shown when view.table.seriesOver; the host can add a round.

import { useMemo } from 'react';
import { computeStats, type GameRecord, type PlayerStats, type TableView } from '../../table';
import type { GameConnection } from '../../net';
import { cls } from '../classNames';
import { Dialog } from '../components/Dialog';
import { useT } from '../i18n';
import { signed } from '../stats/gameLabel';
import { Fireworks } from './Fireworks';
import styles from './SeriesDialog.module.css';

export interface SeriesDialogProps {
  readonly view: TableView;
  readonly records: readonly GameRecord[];
  readonly scoring: 'seeger' | 'standard';
  readonly connection: GameConnection;
  readonly onClose: () => void;
}

/** Podium order on screen: second, first, third. */
const PODIUM_ORDER = [1, 0, 2] as const;

export function SeriesDialog({ view, records, scoring, connection, onClose }: SeriesDialogProps) {
  const t = useT();
  const { players, hostId } = view.table;
  const stats = useMemo(() => computeStats(records, players), [records, players]);
  const ranked = useMemo(
    () => [...stats.players].sort((a, b) => b.total[scoring] - a.total[scoring]),
    [stats, scoring],
  );
  const winner = ranked[0];
  const isHost = view.you.id === hostId;
  const seats = players.length;

  return (
    <Dialog title={t('series.title')} onClose={onClose} size="lg" testId="series-dialog">
      <div className={styles.body}>
        <Fireworks />
        {winner === undefined ? null : <p className={styles.winner}>{t('series.winner', { name: winner.name })}</p>}
        <ol className={styles.podium} aria-label={t('series.podium')} data-testid="podium">
          {PODIUM_ORDER.map((index) => {
            const p = ranked[index];
            return p === undefined ? null : <Step key={p.playerId} place={index + 1} p={p} scoring={scoring} />;
          })}
        </ol>
        <p className={styles.muted}>{t('series.played', { games: stats.gamesTotal })}</p>
        <table className={styles.table} data-testid="series-stats">
          <thead>
            <tr>
              <th scope="col">{t('stats.rank')}</th>
              <th scope="col">{t('stats.name')}</th>
              <th scope="col">{t('stats.total')}</th>
              <th scope="col">{t('stats.declared')}</th>
              <th scope="col">{t('series.won')}</th>
              <th scope="col">{t('stats.winRate')}</th>
              <th scope="col">{t('stats.best')}</th>
              <th scope="col">{t('stats.worst')}</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p, i) => (
              <tr key={p.playerId} className={p.playerId === view.you.id ? styles.me : undefined}>
                <td>{i + 1}</td>
                <td>{p.name}</td>
                <td>{signed(p.total[scoring])}</td>
                <td>{p.declared}</td>
                <td>{p.won}</td>
                <td>{p.winRate === null ? '—' : `${String(Math.round(p.winRate * 100))} %`}</td>
                <td>{signed(p.best[scoring])}</td>
                <td>{signed(p.worst[scoring])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {isHost ? (
          <button
            type="button"
            data-testid="add-rounds"
            onClick={() => {
              connection.send({ type: 'add-rounds' });
            }}
          >
            {t('series.addRound', { games: seats })}
          </button>
        ) : null}
      </div>
    </Dialog>
  );
}

function Step({ place, p, scoring }: { place: number; p: PlayerStats; scoring: 'seeger' | 'standard' }) {
  const t = useT();
  return (
    <li className={cls(styles.step, place === 1 && styles.place1, place === 3 && styles.place3)} data-testid={`podium-${String(place)}`}>
      <span className={styles.name}>{p.name}</span>
      <span className={styles.points}>{t('series.points', { points: signed(p.total[scoring]) })}</span>
      <span className={styles.block}>{place}</span>
    </li>
  );
}
