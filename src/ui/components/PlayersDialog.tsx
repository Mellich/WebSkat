// Players dialog: the seats, the waiting players and, for the host, the player controls
// (replace during a game, kick in the lobby, invite a disconnected human again). Docs: ui.md §3.

import { useState } from 'react';
import { ROLES, type Role } from '../../engine';
import { joinLink, type GameConnection } from '../../net';
import type { PlayerPublic, TableView } from '../../table';
import { AbortGameButton } from '../game/AbortGameButton';
import { useT, type Translator } from '../i18n';
import type { TranslationKey } from '../i18n/en';
import { ConfirmDialog } from './ConfirmDialog';
import { Dialog } from './Dialog';
import { InviteBox } from './InviteBox';
import { PlayerRow } from './PlayerRow';
import { ReplaceChooser } from './ReplaceChooser';
import styles from './PlayersDialog.module.css';

export interface PlayersDialogProps {
  readonly view: TableView;
  readonly connection: GameConnection;
  /** Host only: creates an invite code for a player; null for guests. */
  readonly invite: ((playerId: string) => string | null) | null;
  readonly onClose: () => void;
}

const ROLE_KEYS: Readonly<Record<Role, TranslationKey>> = {
  forehand: 'role.forehand',
  middlehand: 'role.middlehand',
  hindhand: 'role.hindhand',
};

/** The role of a seated player in the running game ("Sitting out" when not playing). */
function roleTextOf(view: TableView, id: string, t: Translator): string | null {
  const game = view.game;
  if (game === null) return null;
  if (game.sittingOut.includes(id)) return t('role.sittingOut');
  const role = ROLES.find((r) => game.roles[r] === id);
  return role === undefined ? null : t(ROLE_KEYS[role]);
}

interface Invitation {
  readonly code: string;
  readonly link: string;
}

export function PlayersDialog({ view, connection, invite, onClose }: PlayersDialogProps) {
  const t = useT();
  const [replacing, setReplacing] = useState<string | null>(null);
  const [kicking, setKicking] = useState<PlayerPublic | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [inviteFailed, setInviteFailed] = useState(false);

  const { table, you } = view;
  const tableLink = joinLink(table.key, `${window.location.origin}${window.location.pathname}`);
  const isHost = you.id === table.hostId;
  const gameRunning = view.game !== null && view.game.phase !== 'finished';

  const inviteAgain = (p: PlayerPublic): void => {
    const code = invite?.(p.id) ?? null;
    setInviteFailed(code === null);
    setInvitation(code === null ? null : { code, link: joinLink(table.key, `${window.location.origin}${window.location.pathname}`, code) });
  };

  /** The host's buttons for one seat (never for the host's own seat). */
  const hostControls = (p: PlayerPublic, seat: number) => (
    <>
      {gameRunning ? (
        <button
          type="button"
          data-testid={`replace-${String(seat)}`}
          onClick={() => {
            setReplacing(p.id);
          }}
        >
          {t('players.replace')}
        </button>
      ) : (
        <button
          type="button"
          data-testid={`players-kick-${String(seat)}`}
          onClick={() => {
            setKicking(p);
          }}
        >
          {t('lobby.kick')}
        </button>
      )}
      {!p.connected && !p.isBot && invite !== null ? (
        <button
          type="button"
          data-testid={`reinvite-${String(seat)}`}
          onClick={() => {
            inviteAgain(p);
          }}
        >
          {t('players.reinvite')}
        </button>
      ) : null}
    </>
  );

  return (
    <Dialog title={t('players.title')} onClose={onClose} testId="players-dialog">

        <section className={styles.tableInvite} data-testid="table-invite">
          <p className={styles.label}>{t('players.tableInvite')}</p>
          <InviteBox idPrefix="table-invite" code={table.key} link={tableLink} />
        </section>

        <div className={styles.list}>
          {table.players.map((p, seat) => {
            const showControls = isHost && p.id !== table.hostId;
            return (
              <div key={p.id} className={styles.entry}>
                <PlayerRow seat={seat} player={p} isHost={p.id === table.hostId} roleText={roleTextOf(view, p.id, t)}>
                  {showControls ? hostControls(p, seat) : undefined}
                </PlayerRow>
                {replacing === p.id ? (
                  <ReplaceChooser
                    name={p.name}
                    waiting={table.pending}
                    onCancel={() => {
                      setReplacing(null);
                    }}
                    onConfirm={(by) => {
                      connection.send({ type: 'replace-player', playerId: p.id, by });
                      setReplacing(null);
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        {table.pending.length > 0 ? (
          <section className={styles.pending} data-testid="players-pending">
            <p className={styles.label}>{t('players.pendingHint')}</p>
            <ul>
              {table.pending.map((p) => (
                <li key={p.id}>
                  {p.name} <span className={styles.badge}>{t('players.pending')}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {invitation !== null ? <InviteBox code={invitation.code} link={invitation.link} /> : null}
        {inviteFailed ? <p className={styles.hint}>{t('players.inviteFailed')}</p> : null}

        {isHost && gameRunning ? (
          <div className={styles.controls}>
            <AbortGameButton testId="players-abort-game" onAbort={() => { connection.send({ type: 'abort-game' }); }} />
          </div>
        ) : null}

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
    </Dialog>
  );
}
