// The table while a game runs: seats, trick, status, the phase panel and the viewer's hand.
// Everything that is clickable comes from view.game.legal; the UI never decides legality.

import { useEffect, useState } from 'react';
import { ROLES, type CardId, type Declaration, type GameAction, type Role } from '../../engine';
import type { GameConnection } from '../../net';
import type { GameView, TableView } from '../../table';
import { Hand } from '../components/Hand';
import { OpponentSeat } from '../components/OpponentSeat';
import { SkatPile } from '../components/SkatPile';
import { TrickArea } from '../components/TrickArea';
import { useT, type Translator } from '../i18n';
import { useSettings } from '../store/settings';
import { BiddingPanel } from './BiddingPanel';
import { DeclarationPicker } from './DeclarationPicker';
import { cardName, declarationLabel } from './labels';
import { ResultDialog } from './ResultDialog';
import { SkatDecision, DiscardPanel } from './SkatPanels';
import { namesById, opponentsOf, type SeatedView } from './seats';
import { useShownTrick } from './useShownTrick';
import styles from './GameScreen.module.css';

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
  const names = namesById(view);
  const nameOf = (id: string): string => names.get(id) ?? '?';
  const viewer = view.you.id;
  const myRole = activeRoleOf(game, viewer);
  const myTurn = game.turnId === viewer && game.phase !== 'finished';
  const shown = useShownTrick(game);
  const opponents = opponentsOf(view);
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
    if (game.phase === 'finished') return '';
    if (myTurn) return t('status.yourTurn');
    if (game.turnId === null) return '';
    if (game.waitingFor !== null) return t('status.reconnecting', { name: nameOf(game.waitingFor) });
    return t('status.waitingFor', { name: nameOf(game.turnId) });
  })();

  const declarer = game.declarerId === null ? '' : nameOf(game.declarerId);
  const declared = game.declaration === null ? null : declarationLabel(game.declaration, t);
  const amSittingOut = view.you.role === 'sitting-out';
  const dealerName = nameOf(game.dealerId);
  const trickSlots = shown.map((p) => ({ card: p.card, name: nameOf(p.playerId), winner: p.winner }));
  const showSkat = game.phase === 'bidding' || game.phase === 'skat-decision';

  return (
    <div className={styles.screen}>
      <div className={styles.opponents}>
        {opponents.active.map((seat) => (
          <OpponentSeat
            key={seat.player.id}
            name={seat.player.name}
            role={roleText(seat, t)}
            count={game.handCounts[seat.player.id] ?? 0}
            isTurn={game.turnId === seat.player.id}
            isDeclarer={game.declarerId === seat.player.id}
            openCards={game.openHands[seat.player.id] ?? []}
            back={cardBack}
            labelOf={label}
          />
        ))}
      </div>

      {opponents.sittingOut.length > 0 ? (
        <p className={styles.sittingOut} aria-label={t('sitOut.bar')} data-testid="sitting-out">
          {t('sitOut.bar')}: {opponents.sittingOut.map((s) => s.player.name).join(', ')}
          {' · '}{t('role.dealer')}: {dealerName}
        </p>
      ) : null}

      <div className={styles.table}>
        <SkatPile visible={showSkat} back={cardBack} label={t('skat.onTable')} />
        <TrickArea slots={trickSlots} labelOf={label} />
      </div>

      <div className={styles.status} aria-live="polite" data-testid="status-line">
        <span>{statusLine}</span>
        {game.lastTrick === null ? null : (
          <button type="button" onClick={() => { setShowLast((v) => !v); }}>{t('trick.last')}</button>
        )}
      </div>
      {showLast && game.lastTrick !== null ? (
        <p className={styles.lastTrick}>
          {game.lastTrick.plays.map((p) => `${nameOf(p.playerId)}: ${label(p.card)}`).join(' · ')}
          {' → '}{t('trick.takes', { name: nameOf(game.lastTrick.winnerId) })}
        </p>
      ) : null}
      {declared === null ? null : (
        <p className={styles.declared}>{t('status.declared', { game: declared, name: declarer })}</p>
      )}

      <div className={styles.phase}>
        {game.phase === 'bidding' ? (
          <BiddingPanel bidding={game.bidding} legal={game.legal} nameOf={nameOf} send={send} />
        ) : null}
        {game.phase === 'skat-decision' ? (
          <SkatDecision
            legal={game.legal}
            isMine={myTurn}
            declarerName={declarer}
            bid={game.bid}
            send={send}
          />
        ) : null}
        {isDiscarding ? (
          <DiscardPanel
            selected={discardPick.length}
            onDiscard={() => {
              const [a, b] = discardPick;
              if (a !== undefined && b !== undefined) {
                setDiscardPick([]);
                send({ type: 'discard', cards: [a, b] });
              }
            }}
          />
        ) : null}
        {game.phase === 'discarding' && !myTurn ? <p>{t('status.waitingFor', { name: declarer })}</p> : null}
        {game.phase === 'declaring' && myTurn && game.legal.declarations !== undefined ? (
          <DeclarationPicker
            options={game.legal.declarations}
            spitzen={game.declarerSpitzen}
            bid={game.bid}
            onDeclare={(d: Declaration) => {
              send({ type: 'declare', declaration: d });
            }}
          />
        ) : null}
        {game.phase === 'declaring' && !myTurn ? <p>{t('declare.waiting', { name: declarer })}</p> : null}
      </div>

      <div className={styles.hand}>
        {amSittingOut ? <p data-testid="sitting-out-you">{t('sitOut.you', { name: dealerName })}</p> : null}
        {view.you.role === 'pending' || view.you.role === 'lobby' ? <p>{t('lobby.pending')}</p> : null}
        {myRole === null ? null : (
          <Hand
            cards={game.myHand}
            declaration={game.declaration}
            legal={isDiscarding ? discardable : playable}
            showAll={game.phase === 'bidding'}
            mode={isDiscarding ? 'discard' : 'play'}
            selected={isDiscarding ? discardPick : pending === null ? [] : [pending]}
            highlight={isDiscarding && game.skat !== null ? game.skat : []}
            {...(isDiscarding ? { onToggle: toggleDiscard } : {})}
            {...(isPlaying ? { onPlay: playCard } : {})}
            label={label}
            back={cardBack}
          />
        )}
      </div>

      {game.phase === 'finished' && game.result !== null ? (
        <ResultDialog
          view={view}
          result={game.result}
          onContinue={() => {
            connection.send({ type: 'ready' });
          }}
        />
      ) : null}
    </div>
  );
}

