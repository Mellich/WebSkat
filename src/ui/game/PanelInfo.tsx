// The top of the phase panel: what the covered status row says and the panel needs (docs/ui-game-screen.md §3):
// the reconnect wait, the declarer line, the Bock line and the host's Abort button.
// Test ids: panel-info, panel-status, panel-summary, panel-bock.

import type { ReactNode } from 'react';
import styles from './PhasePanel.module.css';

export interface PanelInfoProps {
  /** "Waiting for X to reconnect…", or null while everybody is connected. */
  readonly status: string | null;
  readonly summary: string | null;
  readonly bockInfo: string | null;
  /** Buttons (the host's Abort game). */
  readonly actions?: ReactNode;
}

export function PanelInfo({ status, summary, bockInfo, actions }: PanelInfoProps) {
  const hasActions = actions !== undefined && actions !== null && actions !== false;
  if (status === null && summary === null && bockInfo === null && !hasActions) return null;
  return (
    <div className={styles.info} data-testid="panel-info">
      <div className={styles.infoLines}>
        {status === null ? null : <p className={styles.infoStatus} data-testid="panel-status">{status}</p>}
        {summary === null ? null : <p data-testid="panel-summary">{summary}</p>}
        {bockInfo === null ? null : <p data-testid="panel-bock">{bockInfo}</p>}
      </div>
      {hasActions ? actions : null}
    </div>
  );
}
