// Table statistics in a modal with three tabs: standings, history and charts (docs/statistics.md §3).

import { useMemo, useState } from 'react';
import { computeStats, type GameRecord, type PlayerId } from '../../table';
import { Dialog } from '../components/Dialog';
import { SegmentedControl } from '../components/SegmentedControl';
import { Tabs } from '../components/Tabs';
import { useT } from '../i18n';
import { useSettings } from '../store/settings';
import { History } from './History';
import { ScoreChart } from './ScoreChart';
import { Standings } from './Standings';
import { ByType } from './ByType';
import { downloadCsv, historyCsv } from './csv';
import styles from './StatsPanel.module.css';

export interface StatsPanelProps {
  readonly records: readonly GameRecord[];
  readonly players: readonly { readonly id: PlayerId; readonly name: string }[];
  readonly viewerId: PlayerId;
  /** Games to play in the series; 0 = unlimited (docs/statistics.md §3). */
  readonly gameLimit: number;
  readonly onClose: () => void;
}

type Tab = 'standings' | 'history' | 'charts';

export function StatsPanel({ records, players, viewerId, gameLimit, onClose }: StatsPanelProps) {
  const t = useT();
  const scoring = useSettings((s) => s.scoring);
  const update = useSettings((s) => s.update);
  const [tab, setTab] = useState<Tab>('standings');
  const stats = useMemo(() => computeStats(records, players), [records, players]);

  const tabs: readonly { readonly id: Tab; readonly label: string; readonly testId: string }[] = [
    { id: 'standings', label: t('stats.standings'), testId: 'stats-tab-standings' },
    { id: 'history', label: t('stats.history'), testId: 'stats-tab-history' },
    { id: 'charts', label: t('stats.charts'), testId: 'stats-tab-charts' },
  ];

  return (
    <Dialog
      title={t('stats.title')}
      onClose={onClose}
      size="lg"
      testId="stats-dialog"
      actions={
        <button
          type="button"
          data-testid="stats-export-csv"
          disabled={records.length === 0}
          onClick={() => {
            downloadCsv('webskat-stats.csv', historyCsv(records, stats.players, t));
          }}
        >
          {t('stats.exportCsv')}
        </button>
      }
      toolbar={
        <>
          <Tabs label={t('stats.title')} items={tabs} value={tab} onChange={setTab} />
          <SegmentedControl
            label={t('stats.scoring')}
            testId="stats-scoring"
            options={[
              { value: 'seeger', label: t('stats.seeger') },
              { value: 'standard', label: t('stats.standard') },
            ]}
            value={scoring}
            onChange={(next) => {
              update({ scoring: next });
            }}
          />
        </>
      }
    >
      <div className={styles.content}>
        <p className={styles.progress} data-testid="stats-games">
          {gameLimit > 0
            ? t('stats.gameCount', { played: records.length, limit: gameLimit })
            : t('stats.gameCountOpen', { played: records.length })}
        </p>
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
    </Dialog>
  );
}
