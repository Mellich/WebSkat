// One seated player in the Players dialog: name, badges, role in the running game, online dot.

import type { ReactNode } from 'react';
import type { PlayerPublic } from '../../table';
import { useT } from '../i18n';
import styles from './PlayersDialog.module.css';

export interface PlayerRowProps {
  readonly seat: number;
  readonly player: PlayerPublic;
  readonly isHost: boolean;
  /** Role or "Sitting out" in the running game; null in the lobby. */
  readonly roleText: string | null;
  /** The host's buttons for this seat. */
  readonly children?: ReactNode;
}

export function PlayerRow({ seat, player, isHost, roleText, children }: PlayerRowProps) {
  const t = useT();
  const online = player.connected ? t('lobby.connected') : t('lobby.offline');
  return (
    <div className={styles.row} data-testid={`players-row-${String(seat)}`}>
      <span className={styles.name}>
        {player.name}
        {isHost ? <span className={styles.badge}> ♛ {t('lobby.host')}</span> : null}
        {player.isBot ? <span className={styles.badge}> {t('lobby.bot')}</span> : null}
      </span>
      {roleText === null ? null : <span className={styles.role}>{roleText}</span>}
      <span
        className={player.connected ? styles.online : styles.offline}
        title={online}
        aria-label={online}
      >
        ●
      </span>
      {children === undefined ? null : <span className={styles.controls}>{children}</span>}
    </div>
  );
}
