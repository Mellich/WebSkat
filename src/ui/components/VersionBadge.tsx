// The app version in the bottom left corner of every screen; opens the changelog in a new tab
// (docs/ui.md §1, docs/dev/versioning.md).

import { useT } from '../i18n';
import { APP_VERSION } from '../version';
import styles from './VersionBadge.module.css';

export function VersionBadge() {
  const t = useT();
  const label = t('version.open', { version: APP_VERSION });
  return (
    <a
      className={styles.badge}
      href="#/changelog"
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      data-testid="app-version"
    >
      {t('version.label', { version: APP_VERSION })}
    </a>
  );
}
