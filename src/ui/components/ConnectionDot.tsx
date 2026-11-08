// Green dot: the player is connected to the table; red dot: offline (lost or left the connection).

import { useT } from '../i18n';
import styles from './ConnectionDot.module.css';

export interface ConnectionDotProps {
  readonly connected: boolean;
}

export function ConnectionDot({ connected }: ConnectionDotProps) {
  const t = useT();
  const label = connected ? t('lobby.connected') : t('lobby.offline');
  return (
    <span
      className={connected ? styles.online : styles.offline}
      title={label}
      aria-label={label}
      data-state={connected ? 'online' : 'offline'}
    >
      ●
    </span>
  );
}
