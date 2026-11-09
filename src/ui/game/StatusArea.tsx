// The status area under the table: whose turn it is, optional actions, the declarer summary and
// the players who sit out (docs/ui-game-screen.md §6). Test ids: status-line, bid-summary, sitting-out, bock-info.

import type { ReactNode } from 'react';
import styles from './StatusArea.module.css';

export interface StatusAreaProps {
  readonly statusText: string;
  /** Buttons in the status row (abort, last trick). */
  readonly actions?: ReactNode;
  /** The declarer line, or null before somebody has won the bidding. */
  readonly summary: string | null;
  /** The sitting-out line, or null when nobody sits out. */
  readonly sittingOut: ReactNode;
  /** The Bock line while a Bock game is played, or null (skat-rules §13). */
  readonly bockInfo: string | null;
}

export function StatusArea({ statusText, actions, summary, sittingOut, bockInfo }: StatusAreaProps) {
  return (
    <div className={styles.status}>
      <div className={styles.statusRow} aria-live="polite" data-testid="status-line">
        <span className={styles.statusText}>{statusText}</span>
        <div className={styles.statusActions}>{actions}</div>
      </div>
      {summary === null ? null : <p className={styles.declared} data-testid="bid-summary">{summary}</p>}
      {bockInfo === null ? null : <p className={styles.declared} data-testid="bock-info">{bockInfo}</p>}
      {sittingOut}
    </div>
  );
}
