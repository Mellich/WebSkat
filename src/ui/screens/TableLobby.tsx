// The lobby of a table before the first game: key, seats, and the host's controls.

import { useState } from 'react';
import { formatKey, joinLink, type GameConnection } from '../../net';
import type { TableView } from '../../table';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useT } from '../i18n';
import styles from './TableLobby.module.css';

export interface TableLobbyProps {
  readonly view: TableView;
  readonly connection: GameConnection;
  readonly tableKey: string;
}

const MIN_PLAYERS = 3;

/** Not available in insecure contexts, so the value may be undefined at runtime. */
function clipboardOf(): Clipboard | undefined {
  return navigator.clipboard;
}

export function TableLobby({ view, connection, tableKey }: TableLobbyProps) {
  const t = useT();
  const [copied, setCopied] = useState<'key' | 'link' | null>(null);
  const [kicking, setKicking] = useState<{ id: string; name: string } | null>(null);
  const { table, you } = view;
  const isHost = you.id === table.hostId;
  const seated = table.players.length;
  const full = seated + table.pending.length >= table.maxSeats;
  const gameRunning = view.game !== null && view.game.phase !== 'finished';
  const canStart = seated >= MIN_PLAYERS;

  const copy = (kind: 'key' | 'link', text: string): void => {
    void clipboardOf()?.writeText(text).then(() => {
      setCopied(kind);
      setTimeout(() => {
        setCopied(null);
      }, 2000);
    });
  };
  const link = joinLink(tableKey, `${window.location.origin}${window.location.pathname}`);

  return (
    <section className={styles.lobby}>
      <div className={styles.keyBlock}>
        <p className={styles.label}>{t('lobby.key')}</p>
        <p className={styles.key} data-testid="table-key">{formatKey(tableKey)}</p>
        <div className={styles.row}>
          <button type="button" onClick={() => { copy('key', formatKey(tableKey)); }}>
            {copied === 'key' ? t('common.copied') : t('lobby.copyKey')}
          </button>
          <button type="button" onClick={() => { copy('link', link); }}>
            {copied === 'link' ? t('common.copied') : t('lobby.copyLink')}
          </button>
        </div>
      </div>

      <h2 className={styles.heading}>
        {t('lobby.seats')} {String(seated)}/{String(table.maxSeats)}
      </h2>
      <ol className={styles.seats}>
        {table.players.map((p, seat) => (
          <li key={p.id} className={styles.seat} data-testid={`seat-${String(seat)}`}>
            <span className={styles.seatNo}>{String(seat + 1)}</span>
            <span className={styles.name}>
              {p.name}
              {p.id === table.hostId ? <span className={styles.badge}> ♛ {t('lobby.host')}</span> : null}
              {p.isBot ? <span className={styles.badge}> {t('lobby.bot')} · {t(`botLevel.${table.botLevel}`)}</span> : null}
            </span>
            <span
              className={p.connected ? styles.online : styles.offline}
              title={p.connected ? t('lobby.connected') : t('lobby.offline')}
              aria-label={p.connected ? t('lobby.connected') : t('lobby.offline')}
            >
              ●
            </span>
            {isHost && p.id !== table.hostId ? (
              <button
                type="button"
                onClick={() => {
                  setKicking({ id: p.id, name: p.name });
                }}
              >
                {t('lobby.kick')}
              </button>
            ) : null}
          </li>
        ))}
      </ol>

      {table.pending.length > 0 ? (
        <ul className={styles.pending}>
          {table.pending.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
      ) : null}

      {isHost ? (
        <div className={styles.hostControls}>
          <button
            type="button"
            disabled={full || gameRunning}
            data-testid="add-bot"
            onClick={() => {
              connection.send({ type: 'add-bot' });
            }}
          >
            {t('lobby.addBot')}
          </button>
          <button
            type="button"
            disabled={!canStart}
            data-testid="start-game"
            onClick={() => {
              connection.send({ type: 'start' });
            }}
          >
            {t('lobby.start')}
          </button>
          {canStart ? null : <p className={styles.hint}>{t('lobby.needPlayers')}</p>}
        </div>
      ) : (
        <p className={styles.hint}>
          {you.role === 'pending' ? t('lobby.pending') : t('lobby.waitingHost')}
        </p>
      )}

      <p className={styles.info}>{t('lobby.info')} {t('lobby.botsLevel', { level: t(`botLevel.${table.botLevel}`) })}</p>
      {kicking === null ? null : (
        <ConfirmDialog
          message={t('lobby.kickConfirm', { name: kicking.name })}
          onCancel={() => {
            setKicking(null);
          }}
          onConfirm={() => {
            connection.send({ type: 'kick', playerId: kicking.id });
            setKicking(null);
          }}
        />
      )}
    </section>
  );
}
