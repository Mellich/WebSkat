// The route #/t/KEY: joins the table if needed, then shows the lobby or the game.

import { useEffect, useState } from 'react';
import type { ConnectionStatus } from '../../net';
import { TopBar } from '../components/TopBar';
import { cls } from '../classNames';
import { useT, type Translator } from '../i18n';
import type { TranslationKey } from '../i18n/en';
import { leaveTable, openTable } from '../net/actions';
import { navigate } from '../router';
import { cardImageUrls, preloadImages } from '../preload';
import { useSession } from '../store/session';
import { useSettings } from '../store/settings';
import { GameScreen } from '../game/GameScreen';
import { TableLobby } from './TableLobby';
import styles from './TableScreen.module.css';

export function TableScreen({ tableKey }: { readonly tableKey: string }) {
  const t = useT();
  const attachedKey = useSession((s) => s.key);
  const connection = useSession((s) => s.connection);
  const status = useSession((s) => s.status);
  const reason = useSession((s) => s.reason);
  const view = useSession((s) => s.view);
  const name = useSettings((s) => s.name).trim();
  const cardBack = useSettings((s) => s.cardBack);

  useEffect(() => {
    preloadImages(cardImageUrls(cardBack));
  }, [cardBack]);

  const attached = attachedKey === tableKey && connection !== null;
  useEffect(() => {
    if (attached || name === '') return;
    void openTable(tableKey, name);
  }, [attached, name, tableKey]);

  if (!attached) {
    return name === '' ? <NameForm tableKey={tableKey} /> : <p className={styles.note}>{t('table.loading')}</p>;
  }

  const inGame = view !== null && view.table.status !== 'lobby' && view.you.role !== 'pending' && view.game !== null;
  return (
    <div className={cls(styles.screen, inGame && styles.fixed)}>
      <TopBar />
      <ConnectionBanner status={status} reason={reason} />
      {view === null ? (
        <p className={styles.note}>{t('table.loading')}</p>
      ) : view.table.status === 'lobby' || view.you.role === 'pending' || view.game === null ? (
        <TableLobby view={view} connection={connection} tableKey={tableKey} />
      ) : (
        <GameScreen
          key={String(view.game.number)}
          view={view}
          game={view.game}
          connection={connection}
        />
      )}
    </div>
  );
}

const REJECTION_KEYS: Readonly<Record<string, TranslationKey>> = {
  TIMEOUT: 'table.rejected.TIMEOUT',
  TABLE_FULL: 'table.rejected.TABLE_FULL',
  PROTOCOL_MISMATCH: 'table.rejected.PROTOCOL_MISMATCH',
  BAD_NAME: 'table.rejected.BAD_NAME',
};

/** The part of a form event that the handlers use. */
interface PreventableEvent {
  preventDefault(): void;
}

function rejectionKey(reason: string | null): TranslationKey {
  return REJECTION_KEYS[reason ?? ''] ?? 'table.rejected.generic';
}

function bannerText(status: ConnectionStatus | null, reason: string | null, t: Translator): string | null {
  switch (status) {
    case 'connecting':
      return t('table.loading');
    case 'host-lost':
      return t('table.hostLost');
    case 'rejected':
      return t(rejectionKey(reason));
    case 'kicked':
      return t('table.kicked');
    case 'closed':
      return t('table.closed');
    case 'connected':
    case null:
      return null;
    default: {
      const unused: never = status;
      return unused;
    }
  }
}

function ConnectionBanner({ status, reason }: { readonly status: ConnectionStatus | null; readonly reason: string | null }) {
  const t = useT();
  const text = bannerText(status, reason, t);
  if (text === null) return null;
  const leaving = status === 'rejected' || status === 'kicked' || status === 'closed' || status === 'host-lost';
  return (
    <div className={styles.banner} role="alert" data-testid="connection-banner">
      <span>{text}</span>
      {leaving ? (
        <button
          type="button"
          onClick={() => {
            leaveTable();
            navigate('#/');
          }}
        >
          {status === 'host-lost' ? t('table.hostLostLeave') : t('table.back')}
        </button>
      ) : null}
    </div>
  );
}

function NameForm({ tableKey }: { readonly tableKey: string }) {
  const t = useT();
  const [draft, setDraft] = useState('');
  const submit = (e: PreventableEvent): void => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (trimmed.length === 0 || trimmed.length > 20) return;
    useSettings.getState().update({ name: trimmed });
  };
  return (
    <form className={styles.nameForm} onSubmit={submit}>
      <p>{t('table.needName', { key: tableKey })}</p>
      <input
        type="text"
        maxLength={20}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        aria-label={t('home.name')}
        autoFocus
      />
      <div className={styles.row}>
        <button type="submit" disabled={draft.trim() === ''}>{t('table.join')}</button>
        <button
          type="button"
          onClick={() => {
            navigate('#/');
          }}
        >
          {t('table.back')}
        </button>
      </div>
    </form>
  );
}
