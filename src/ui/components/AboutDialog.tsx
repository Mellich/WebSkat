// About WebSkat: how it works, whom you trust, and what this browser stores (docs/deployment.md §4).

import { useT } from '../i18n';
import { Dialog } from './Dialog';
import styles from './AboutDialog.module.css';

export interface AboutDialogProps {
  readonly onClose: () => void;
}

export function AboutDialog({ onClose }: AboutDialogProps) {
  const t = useT();
  return (
    <Dialog title={t('about.title')} onClose={onClose} size="sm" testId="about-dialog">
      <div className={styles.text}>
        <p>{t('about.how')}</p>
        <p>{t('about.trust')}</p>
        <p>{t('about.privacy')}</p>
        <p>{t('about.storage')}</p>
      </div>
    </Dialog>
  );
}
