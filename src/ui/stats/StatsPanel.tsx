// Table statistics in a modal with three tabs: standings, history and charts (docs/statistics.md §3).

import { useEffect, useMemo, useState } from 'react';
import { computeStats, type GameRecord, type PlayerId } from '../../table';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { History } from './History';
import { ScoreChart } from './ScoreChart';
import { Standings } from './Standings';
import { ByType } from './ByType';
import styles from './StatsPanel.module.css';

export interface StatsPanelProps {
  readonly records: readonly GameRecord[];
  readonly players: readonly { readonly id: PlayerId; readonly name: string }[];
  readonly viewerId: PlayerId;
  readonly onClose: () => void;
}

type Tab = 'standings' | 'history' | 'charts';

export function StatsPanel({ records, players, viewerId, onClose }: StatsPanelProps) {
  const t = useT();
  const scoring = useSettings((s) => s.scoring);
  const update = useSettings((s) => s.update);
  const [tab, setTab] = useState<Tab>('standings');
  const stats = useMemo(() => computeStats(records, players), [records, players]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const tabs: readonly { readonly id: Tab; readonly label: string }[] = [
    { id: 'standings', label: t('stats.standings') },
    { id: 'history', label: t('stats.history') },
    { id: 'charts', label: t('stats.charts') },
  ];

  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={t('stats.title')}>
        <header className={styles.header}>
          <h2>{t('stats.title')}</h2>
          <button type="button" onClick={onClose}>{t('common.close')}</button>
        </header>

        <div className={styles.toolbar}>
          <div role="tablist" className={styles.tabs}>
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                data-testid={`stats-tab-${item.id}`}
                aria-selected={tab === item.id}
                className={tab === item.id ? styles.active : undefined}
                onClick={() => {
                  setTab(item.id);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className={styles.scoring} role="group" aria-label={t('stats.scoring')}>
            <button
              type="button"
              aria-pressed={scoring === 'seeger'}
              onClick={() => {
                update({ scoring: 'seeger' });
              }}
            >
              {t('stats.seeger')}
            </button>
            <button
              type="button"
              aria-pressed={scoring === 'standard'}
              onClick={() => {
                update({ scoring: 'standard' });
              }}
            >
              {t('stats.standard')}
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {records.length === 0 ? <p className={styles.empty}>{t('stats.empty')}</p> : null}
          {records.length > 0 && tab === 'standings' ? (
            <Standings stats={stats} scoring={scoring} viewerId={viewerId} />
          ) : null}
          {records.length > 0 && tab === 'history' ? (
            <History records={records} players={stats.players} scoring={scoring} />
          ) : null}
          {records.length > 0 && tab === 'charts' ? (
            <>
              <h3>{t('stats.chartTitle')}</h3>
              <ScoreChart
                series={stats.series}
                players={stats.players.map((p) => ({ id: p.playerId, name: p.name }))}
                scoring={scoring}
              />
              <h3>{t('stats.byType')}</h3>
              <ByType byGame={stats.byGame} ramsch={stats.ramsch} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
