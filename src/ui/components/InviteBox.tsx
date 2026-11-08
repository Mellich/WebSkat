// The invite code and link of a disconnected player, with copy buttons (clipboard pattern of TableLobby).

import { useState } from 'react';
import { formatKey } from '../../net';
import { useT } from '../i18n';
import styles from './PlayersDialog.module.css';

/** Not available in insecure contexts, so the value may be undefined at runtime. */
function clipboardOf(): Clipboard | undefined {
  return navigator.clipboard;
}

export interface InviteBoxProps {
  /** Normalized code. */
  readonly code: string;
  readonly link: string;
}

export function InviteBox({ code, link }: InviteBoxProps) {
  const t = useT();
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const copy = (kind: 'code' | 'link', text: string): void => {
    void clipboardOf()?.writeText(text).then(() => {
      setCopied(kind);
      setTimeout(() => {
        setCopied(null);
      }, 2000);
    });
  };
  return (
    <div className={styles.invite}>
      <div className={styles.controls}>
        <span className={styles.label}>{t('players.inviteCode')}</span>
        <span className={styles.code} data-testid="invite-code">{formatKey(code)}</span>
        <button type="button" onClick={() => { copy('code', formatKey(code)); }}>
          {copied === 'code' ? t('common.copied') : t('players.copy')}
        </button>
      </div>
      <div className={styles.controls}>
        <span className={styles.label}>{t('players.inviteLink')}</span>
        <span className={styles.link} data-testid="invite-link">{link}</span>
        <button type="button" onClick={() => { copy('link', link); }}>
          {copied === 'link' ? t('common.copied') : t('players.copy')}
        </button>
      </div>
    </div>
  );
}
