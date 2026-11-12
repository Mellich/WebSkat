// The table while a game runs: seats, trick, status, the phase panel and the viewer's hand.
// Everything that is clickable comes from view.game.legal; the UI never decides legality.

import { useEffect, useState } from 'react';
import { ROLES, type CardId, type Declaration, type GameAction, type Role } from '../../engine';
import type { GameConnection } from '../../net';
import type { GameView, TableView } from '../../table';
import { Hand } from '../components/Hand';
import { OpponentSeat } from '../components/OpponentSeat';
import { SpeechBubble } from '../components/SpeechBubble';
import { cls } from '../classNames';
import { useT, type Translator } from '../i18n';
import { useSettings } from '../store/settings';
import { useSession } from '../store/session';
import { AbortGameButton } from './AbortGameButton';
import { bubbleText, type BidBubble } from './bidBubbles';
import { cardName } from './labels';
import { declarerSummary } from './declarerSummary';
import { PanelInfo } from './PanelInfo';
import { phasePanelContent } from './phasePanelContent';
import { StatusArea } from './StatusArea';
import { ResultDialog } from './ResultDialog';
import { SeriesDialog } from './SeriesDialog';
import { namesById, opponentsOf, type SeatedView } from './seats';
import { useBidBubbles } from './useBidBubbles';
import { useShownTrick } from './useShownTrick';
import { TableCenter } from './TableCenter';
import styles from './GameScreen.module.css';
import panelStyles from './PhasePanel.module.css';

/** Ramsch has no declaration; its hand is sorted in Grand order (only Jacks are trump). */
const RAMSCH_ORDER: Declaration = { kind: 'grand', hand: false, announce: 'none', ouvert: false };

export interface GameScreenProps {
  readonly view: TableView;
  readonly game: GameView;
  readonly connection: GameConnection;
}

function activeRoleOf(game: GameView, viewer: string): Role | null {
  return ROLES.find((r) => game.roles[r] === viewer) ?? null;
}

function roleText(seat: SeatedView, t: Translator): string {
  const role = seat.role;
  const roleName = role === null || role === 'sitting-out'
    ? t('role.sittingOut')
    : t(role === 'forehand' ? 'role.forehand' : role === 'middlehand' ? 'role.middlehand' : 'role.hindhand');
  return seat.isDealer ? `${roleName} · ${t('role.dealer')}` : roleName;
}

/** Touch devices use two taps to play a card; media queries are missing in some test setups. */
function isCoarsePointer(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export function GameScreen({ view, game, connection }: GameScreenProps) {
  const t = useT();
  const confirmPlay = useSettings((s) => s.confirmPlay);
  const cardBack = useSettings((s) => s.cardBack);
  const scoring = useSettings((s) => s.scoring);
  const records = useSession((s) => s.records);
  // the final dialog is closed for this many played games; a further round reopens it at its end
  const [seriesClosedAt, setSeriesClosedAt] = useState<number | null>(null);
  const seriesClosed = seriesClosedAt === view.table.gamesPlayed;
  const names = namesById(view);
  const nameOf = (id: string): string => names.get(id) ?? '?';
  const viewer = view.you.id;
  const myRole = activeRoleOf(game, viewer);
  const myTurn = game.turnId === viewer && game.phase !== 'finished';
  const trickDisplayMs = useSettings((s) => s.trickDisplayMs);
  const shown = useShownTrick(game, trickDisplayMs);
  const opponents = opponentsOf(view);
  const bidBubbleMs = useSettings((s) => s.bidBubbleMs);
  const bubbles = useBidBubbles(game.bidding.history, bidBubbleMs);
  const label = (c: CardId): string => cardName(c, t);
  const send = (action: GameAction): void => {
    connection.send({ type: 'game', action });
  };

  const [pending, setPending] = useState<CardId | null>(null);
  const [discardPick, setDiscardPick] = useState<CardId[]>([]);
  const [showLast, setShowLast] = useState(false);

  useEffect(() => {
    document.title = myTurn ? `● ${t('app.name')}` : t('app.name');
  }, [myTurn, t]);

  const isDiscarding = game.phase === 'discarding' && myTurn;
  const isPlaying = game.phase === 'playing';
  const playable = isPlaying ? (game.legal.playableCards ?? []) : [];
  const discardable = isDiscarding ? (game.legal.discardFrom ?? []) : [];

  const toggleDiscard = (card: CardId): void => {
    setDiscardPick((cur) => (cur.includes(card) ? cur.filter((c) => c !== card) : cur.length < 2 ? [...cur, card] : cur));
  };
  const playCard = (card: CardId): void => {
    const twoTap = confirmPlay === 'always' || (confirmPlay === 'auto' && isCoarsePointer());
    if (twoTap && pending !== card) {
      setPending(card);
      return;
    }
    setPending(null);
    send({ type: 'play', card });
  };

  const statusLine = ((): string => {
    if (shown.holding && shown.winnerId !== null) return t('trick.takesNow', { name: nameOf(shown.winnerId) });
    if (game.phase === 'finished') return '';
    if (myTurn) return t('status.yourTurn');
    if (game.turnId === null) return '';
    if (game.waitingFor !== null) return t('status.reconnecting', { name: nameOf(game.waitingFor) });
    return t('status.waitingFor', { name: nameOf(game.turnId) });
  })();

  const declarer = game.declarerId === null ? '' : nameOf(game.declarerId);
  const summary = declarerSummary(game, nameOf, t);
  useEffect(() => {
    if (!shown.holding) return;
    const timer = window.setTimeout(() => { setPending(null); }, 0);
    return () => { window.clearTimeout(timer); };
  }, [shown.holding]);
  const amSittingOut = view.you.role === 'sitting-out';
  const dealerName = nameOf(game.dealerId);
  // Bubbles sit at the seat boxes (left, right) and at the bottom: the viewer, or the third active player when the viewer sits out.
  const leftId = opponents.active[0]?.player.id;
  const rightId = opponents.active[1]?.player.id;
  const bottomId = myRole !== null ? viewer : opponents.active[2]?.player.id;
  const bubbleAt = (id: string | undefined, placement: 'below' | 'above', testId: string, className: string | undefined) => {
    const b: BidBubble | undefined = id === undefined ? undefined : bubbles[id];
    return b === undefined ? null : (
      <div className={className}>
        <SpeechBubble text={bubbleText(b.event, t)} placement={placement} testId={testId} />
      </div>
    );
  };

  const seat = (index: number) => {
    const s = opponents.active[index];
    return s === undefined ? null : (
      <OpponentSeat
        name={s.player.name}
        connected={s.player.connected}
        role={roleText(s, t)}
        count={game.handCounts[s.player.id] ?? 0}
        isTurn={game.turnId === s.player.id}
        isDeclarer={game.declarerId === s.player.id}
        openCards={game.openHands[s.player.id] ?? []}
        back={cardBack}
        labelOf={label}
      />
    );
  };

  const phaseContent = phasePanelContent({
    game,
    myTurn,
    isDiscarding,
    discardPick,
    onDiscard: (cards) => {
      setDiscardPick([]);
      send({ type: 'discard', cards });
    },
    declarer,
    nameOf,
    send,
    t,
  });

  // The phase panel lies over the felt and the status row; what the panel needs from the covered row moves into it.
  const covered = phaseContent !== null;
  const abortButton = view.you.id === view.table.hostId && game.phase !== 'finished' && game.waitingFor !== null
    ? <AbortGameButton onAbort={() => { connection.send({ type: 'abort-game' }); }} />
    : null;
  const bockInfo = game.bock ? t('bock.active', { count: view.table.bockGamesLeft }) : null;

  return (
    <div className={styles.screen}>
      <div className={styles.oppL}>{seat(0)}{bubbleAt(leftId, 'below', 'bid-bubble-left', styles.bidBubble)}</div>
      <div className={styles.oppR}>{seat(1)}{bubbleAt(rightId, 'below', 'bid-bubble-right', styles.bidBubble)}</div>

      <TableCenter
        className={styles.table}
        view={view}
        game={game}
        shown={shown}
        showLast={showLast}
        cardBack={cardBack}
        nameOf={nameOf}
        label={label}
        bottomBubble={covered ? null : bubbleAt(bottomId, 'above', 'bid-bubble-bottom', styles.bidBubbleBottom)}
      />

      <div className={styles.status}>
        <StatusArea
          statusText={statusLine}
          covered={covered}
          actions={covered ? null : (
            <>
              {abortButton}
              {game.lastTrick === null ? null : (
                <button type="button" aria-pressed={showLast} onClick={() => { setShowLast((v) => !v); }}>{t('trick.last')}</button>
              )}
            </>
          )}
          summary={summary}
          bockInfo={bockInfo}
          sittingOut={opponents.sittingOut.length === 0 ? null : (
            <p className={styles.sittingOut} aria-label={t('sitOut.bar')} data-testid="sitting-out">
              {t('sitOut.bar')}: {opponents.sittingOut.map((o) => o.player.name).join(', ')}
              {' · '}{t('role.dealer')}: {dealerName}
            </p>
          )}
        />
      </div>

      {phaseContent === null ? null : (
        <div className={cls(styles.overlay, panelStyles.overlay)}>
          {bubbleAt(bottomId, 'above', 'bid-bubble-bottom', panelStyles.bubble)}
          <div className={panelStyles.panel} data-testid="phase-panel">
            <PanelInfo
              status={game.waitingFor === null ? null : statusLine}
              summary={summary}
              bockInfo={bockInfo}
              actions={abortButton}
            />
            {phaseContent}
          </div>
        </div>
      )}

      <div className={styles.hand}>
        {amSittingOut ? <p data-testid="sitting-out-you">{t('sitOut.you', { name: dealerName })}</p> : null}
        {view.you.role === 'pending' || view.you.role === 'lobby' ? <p>{t('lobby.pending')}</p> : null}
        {myRole === null ? null : (
          <Hand
            cards={game.myHand}
            declaration={game.declaration ?? (game.ramsch ? RAMSCH_ORDER : null)}
            legal={isDiscarding ? discardable : playable}
            showAll={game.phase === 'bidding'}
            paused={shown.holding}
            mode={isDiscarding ? 'discard' : 'play'}
            selected={isDiscarding ? discardPick : shown.holding || pending === null ? [] : [pending]}
            highlight={isDiscarding && game.skat !== null ? game.skat : []}
            {...(isDiscarding ? { onToggle: toggleDiscard } : {})}
            {...(isPlaying ? { onPlay: playCard } : {})}
            label={label}
            back={cardBack}
          />
        )}
      </div>

      {view.table.seriesOver && !seriesClosed ? (
        <SeriesDialog
          view={view}
          records={records}
          scoring={scoring}
          connection={connection}
          onClose={() => {
            setSeriesClosedAt(view.table.gamesPlayed);
          }}
        />
      ) : null}

      {game.phase === 'finished' && game.result !== null && !shown.holding && !view.table.seriesOver ? (
        <ResultDialog
          view={view}
          result={game.result}
          record={records.find((r) => r.number === game.number) ?? null}
          scoring={scoring}
          onContinue={() => {
            connection.send({ type: 'ready' });
          }}
          onAddRounds={() => {
            connection.send({ type: 'add-rounds' });
          }}
        />
      ) : null}
    </div>
  );
}

