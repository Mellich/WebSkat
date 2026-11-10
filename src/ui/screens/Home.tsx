// Start screen: name, create a table, join with a key, public tables, rejoin.

import { useEffect, useState } from 'react';
import { createDirectory, isValidKey, normalizeKey, type Directory, type TableAd } from '../../net';
import { AboutDialog } from '../components/AboutDialog';
import { cls } from '../classNames';
import { logoUrl } from '../assets';
import { useT } from '../i18n';
import { hostTable, resumeHostedTable } from '../net/actions';
import { getTransport } from '../net/transport';
import { listHostedKeys } from '../persist/hosted';
import { loadSession } from '../persist/session';
import { browserStorage } from '../persist/storage';
import { navigate, tableHash } from '../router';
import { useSettings } from '../store/settings';
import styles from './Home.module.css';


/** A reload of the app at its start page rejoins the seat from the last session, once per page load. */
let autoRejoinChecked = false;

/** The part of a form event that the handlers use. */
interface PreventableEvent {
  preventDefault(): void;
}

export function Home() {
  const t = useT();
  const name = useSettings((s) => s.name);
  const update = useSettings((s) => s.update);
  const [tableName, setTableName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [joinKey, setJoinKey] = useState('');
  const [inviteDraft, setInviteDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [tables, setTables] = useState<TableAd[] | null>(null);
  const [about, setAbout] = useState(false);
  const [stored] = useState(() => {
    const storage = browserStorage();
    return storage === null ? null : loadSession(storage);
  });
  const [hosted] = useState(() => {
    const storage = browserStorage();
    return storage === null ? [] : listHostedKeys(storage);
  });

  useEffect(() => {
    if (autoRejoinChecked) return;
    autoRejoinChecked = true;
    if (stored !== null && window.location.hash.replace(/^#\/?$/, '') === '') {
      navigate(tableHash(stored.key));
    }
  }, [stored]);

  useEffect(() => {
    let cancelled = false;
    let directory: Directory | null = null;
    void getTransport().then((transport) => {
      if (!cancelled) directory = createDirectory(transport, setTables);
    });
    return () => {
      cancelled = true;
      directory?.stop();
    };
  }, []);

  const requireName = (): string | null => {
    const trimmed = name.trim();
    if (trimmed === '' || trimmed.length > 20) {
      setMessage(t('home.nameRequired'));
      return null;
    }
    return trimmed;
  };

  const create = async (e: PreventableEvent): Promise<void> => {
    e.preventDefault();
    const hostName = requireName();
    if (hostName === null) return;
    const key = await hostTable({
      hostName,
      tableName: tableName.trim() === '' ? t('home.defaultTableName', { name: hostName }) : tableName.trim(),
      isPublic,
    });
    navigate(tableHash(key));
  };

  const join = (e: PreventableEvent): void => {
    e.preventDefault();
    if (!isValidKey(joinKey)) {
      setMessage(t('home.invalidKey'));
      return;
    }
    const invite = normalizeKey(inviteDraft);
    if (invite !== '' && !isValidKey(invite)) {
      setMessage(t('home.invalidInvite'));
      return;
    }
    if (requireName() === null) return;
    navigate(tableHash(joinKey, invite === '' ? undefined : invite));
  };

  return (
    <main className={styles.home}>
      <header className={styles.header}>
        <img className={styles.logo} src={logoUrl()} alt="" />
        <h1>{t('home.title')}</h1>
      </header>

      <section className={styles.card}>
        <label className={styles.field}>
          <span>{t('home.name')}</span>
          <input
            type="text"
            maxLength={20}
            value={name}
            onChange={(e) => {
              update({ name: e.target.value });
            }}
          />
        </label>
        {message === null ? null : <p className={styles.error} role="alert">{message}</p>}
      </section>

      {stored === null && hosted.length === 0 ? null : (
        <section className={styles.card}>
          <h2>{t('home.rejoinTitle')}</h2>
          {stored === null ? null : (
            <button
              type="button"
              onClick={() => {
                navigate(tableHash(stored.key));
              }}
            >
              {t('home.rejoin', { key: stored.key })}
            </button>
          )}
          {hosted.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                void resumeHostedTable(key).then((ok) => {
                  if (ok) navigate(tableHash(key));
                });
              }}
            >
              {t('home.resume', { key })}
            </button>
          ))}
        </section>
      )}

      <form className={cls(styles.card, styles.half)} onSubmit={(e) => { void create(e); }}>
        <h2>{t('home.createTitle')}</h2>
        <label className={styles.field}>
          <span>{t('home.tableName')}</span>
          <input type="text" maxLength={40} value={tableName} onChange={(e) => { setTableName(e.target.value); }} />
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={isPublic} onChange={(e) => { setIsPublic(e.target.checked); }} />
          <span>{t('home.public')}</span>
        </label>
        <button type="submit" data-testid="create-table">{t('home.create')}</button>
      </form>

      <form className={cls(styles.card, styles.half)} onSubmit={join}>
        <h2>{t('home.joinTitle')}</h2>
        <div className={styles.inline}>
          <input
            type="text"
            aria-label={t('home.joinTitle')}
            placeholder={t('home.keyPlaceholder')}
            value={joinKey}
            onChange={(e) => { setJoinKey(e.target.value.toUpperCase()); }}
            autoCapitalize="characters"
            autoComplete="off"
            data-testid="join-key-input"
          />
          <button type="submit" data-testid="join-submit">{t('home.join')}</button>
        </div>
        <div className={styles.inline}>
          <input
            type="text"
            aria-label={t('home.inviteCode')}
            placeholder={t('home.invitePlaceholder')}
            value={inviteDraft}
            onChange={(e) => { setInviteDraft(e.target.value.toUpperCase()); }}
            autoCapitalize="characters"
            autoComplete="off"
            data-testid="join-invite-input"
          />
        </div>
      </form>

      <section className={styles.card}>
        <h2>{t('home.publicTitle')}</h2>
        {tables === null ? <p className={styles.muted}>{t('home.searching')}</p> : null}
        {tables !== null && tables.length === 0 ? <p className={styles.muted}>{t('home.noPublic')}</p> : null}
        <ul className={styles.list}>
          {(tables ?? []).map((table) => (
            <li key={table.key} className={styles.row} data-testid="public-table">
              <span className={styles.rowName}>
                <strong>{table.name}</strong>
                <span className={styles.muted}> · {t('home.host')} {table.hostName}</span>
              </span>
              <span className={styles.muted}>
                {t('home.seats')} {String(table.seats)}/{String(table.maxSeats)}
              </span>
              <button
                type="button"
                data-testid="public-join"
                onClick={() => {
                  if (requireName() !== null) navigate(tableHash(table.key));
                }}
              >
                {t('home.join')}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {import.meta.env.DEV ? (
        <a className={styles.localLink} href="#/dev/local">{t('home.localGame')}</a>
      ) : null}

      <footer className={styles.footer}>
        <p>{t('home.trust')}</p>
        <button type="button" onClick={() => { setAbout(true); }}>{t('home.about')}</button>
      </footer>
      {about ? (
        <AboutDialog
          onClose={() => {
            setAbout(false);
          }}
        />
      ) : null}
    </main>
  );
}

