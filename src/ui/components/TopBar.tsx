// Always visible at the top of a table: name, key, connection status, statistics, game log, players, settings, Leave.

import { useMemo, useState } from 'react';
import { formatKey } from '../../net';
import { cls } from '../classNames';
import { useT } from '../i18n';
import { leaveTable } from '../net/actions';
import { navigate } from '../router';
import { StatsPanel } from '../stats/StatsPanel';
import { useSession } from '../store/session';
import { ConfirmDialog } from './ConfirmDialog';
import { GameLogDialog } from './GameLogDialog';
import { PlayersDialog } from './PlayersDialog';
import { SettingsDialog } from './SettingsDialog';
import styles from './TopBar.module.css';

export function TopBar() {
  const t = useT();
  const key = useSession((s) => s.key);
  const status = useSession((s) => s.status);
  const view = useSession((s) => s.view);
  const records = useSession((s) => s.records);
  const connection = useSession((s) => s.connection);
  const host = useSession((s) => s.host);
  const [confirming, setConfirming] = useState(false);
  const [panel, setPanel] = useState<'stats' | 'log' | 'players' | 'settings' | null>(null);
  const players = useMemo(
    () => (view === null ? [] : view.table.players.map((p) => ({ id: p.id, name: p.name }))),
    [view],
  );

  const inGame = view?.game !== null && view?.game !== undefined && view.game.phase !== 'finished';
  const leave = (): void => {
    leaveTable();
    navigate('#/');
  };
  const dot = status === 'connected' ? 'ok' : status === 'connecting' || status === null ? 'wait' : 'bad';
  const statusText = dot === 'ok'
    ? t('topbar.status.connected')
    : dot === 'wait' ? t('topbar.status.connecting') : t('topbar.status.lost');

  return (
    <header className={styles.bar}>
      <div className={styles.title}>
        <strong>{view?.table.name ?? t('app.name')}</strong>
        {key === null ? null : <span className={styles.key}>{t('common.key')} {formatKey(key)}</span>}
      </div>
      <div className={styles.right}>
        <span className={styles.status} title={statusText} data-testid="connection-status" data-state={dot}>
          <span className={cls(styles.dot, styles[dot])} aria-hidden="true" />
          <span className={styles.statusText}>{statusText}</span>
        </span>
        <button
          type="button"
          data-testid="open-stats"
          aria-label={t('stats.open')}
          title={t('stats.open')}
          onClick={() => {
            setPanel('stats');
          }}
        >
          <span className={styles.icon} aria-hidden="true">📊</span>
          <span className={styles.label}>{t('stats.open')}</span>
        </button>
        <button
          type="button"
          data-testid="open-log"
          aria-label={t('log.open')}
          title={t('log.open')}
          onClick={() => {
            setPanel('log');
          }}
        >
          <span className={styles.icon} aria-hidden="true">📜</span>
          <span className={styles.label}>{t('log.open')}</span>
        </button>
        <button
          type="button"
          data-testid="open-players"
          aria-label={t('players.open')}
          title={t('players.open')}
          onClick={() => {
            setPanel('players');
          }}
        >
          <span className={styles.icon} aria-hidden="true">👥</span>
          <span className={styles.label}>{t('players.open')}</span>
        </button>
        <button
          type="button"
          data-testid="open-settings"
          aria-label={t('settings.open')}
          title={t('settings.open')}
          onClick={() => {
            setPanel('settings');
          }}
        >
          <span className={styles.icon} aria-hidden="true">⚙</span>
          <span className={styles.label}>{t('settings.open')}</span>
        </button>
        <button
          type="button"
          data-testid="leave-table"
          aria-label={t('common.leave')}
          title={t('common.leave')}
          onClick={() => {
            if (inGame) setConfirming(true);
            else leave();
          }}
        >
          <span className={styles.icon} aria-hidden="true">⎋</span>
          <span className={styles.label}>{t('common.leave')}</span>
        </button>
      </div>
      {confirming ? (
        <ConfirmDialog
          message={t('topbar.leaveConfirm')}
          onConfirm={leave}
          onCancel={() => {
            setConfirming(false);
          }}
        />
      ) : null}
      {panel === 'stats' && view !== null ? (
        <StatsPanel
          records={records}
          players={players}
          viewerId={view.you.id}
          onClose={() => {
            setPanel(null);
          }}
        />
      ) : null}
      {panel === 'log' && view !== null ? (
        <GameLogDialog
          entries={view.log}
          onClose={() => {
            setPanel(null);
          }}
        />
      ) : null}
      {panel === 'players' && view !== null && connection !== null ? (
        <PlayersDialog
          view={view}
          connection={connection}
          invite={host === null ? null : (id) => host.invite(id)}
          onClose={() => {
            setPanel(null);
          }}
        />
      ) : null}
      {panel === 'settings' ? (
        <SettingsDialog
          onClose={() => {
            setPanel(null);
          }}
        />
      ) : null}
    </header>
  );
}
