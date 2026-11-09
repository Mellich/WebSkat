// The middle of the game screen: the Skat pile, the trick at fixed positions, the bottom bid bubble and the last-trick list.

import type { ReactNode } from 'react';
import type { CardId } from '../../engine';
import type { GameView, TableView } from '../../table';
import { SkatPile } from '../components/SkatPile';
import { CardChip } from '../components/CardChip';
import { TrickArea, type TrickSlot } from '../components/TrickArea';
import type { BackIndex } from '../assets';
import { useT } from '../i18n';
import type { ShownTrick } from './useShownTrick';
import { placeTrick, trickSeats } from './trickPositions';
import styles from './GameScreen.module.css';

export interface TableCenterProps {
  readonly view: TableView;
  readonly game: GameView;
  readonly shown: ShownTrick;
  readonly showLast: boolean;
  readonly cardBack: BackIndex;
  readonly nameOf: (id: string) => string;
  readonly label: (card: CardId) => string;
  /** The bid bubble of the bottom seat; it sits in the table area. */
  readonly bottomBubble: ReactNode;
}

export function TableCenter({ view, game, shown, showLast, cardBack, nameOf, label, bottomBubble }: TableCenterProps) {
  const t = useT();
  const placed = placeTrick(shown.plays, trickSeats(view));
  const toSlot = (p: { readonly playerId: string; readonly card: CardId; readonly winner: boolean } | null): TrickSlot | null =>
    p === null ? null : { card: p.card, name: nameOf(p.playerId), winner: p.winner };
  const slots = { left: toSlot(placed.left), right: toSlot(placed.right), bottom: toSlot(placed.bottom) };
  // The Skat lies on the table during bidding and is public during a Ramsch (skat-rules §12).
  const showSkat = game.phase === 'bidding' || game.phase === 'skat-decision' || game.ramsch;

  return (
    <div className={styles.table}>
      <SkatPile visible={showSkat} back={cardBack} label={t('skat.onTable')} />
      {bottomBubble}
      <TrickArea slots={slots} labelOf={label} {...(shown.holding ? { onDismiss: shown.dismiss, dismissLabel: t('trick.continue') } : {})} />
      {showLast && game.lastTrick !== null ? (
        <ul className={styles.lastTrick} data-testid="last-trick">
          {game.lastTrick.plays.map((p) => (
            <li key={p.playerId} className={p.playerId === game.lastTrick?.winnerId ? styles.trickWinner : undefined}>
              {nameOf(p.playerId)} <CardChip card={p.card} />
              {p.playerId === game.lastTrick?.winnerId ? ` — ${t('trick.takes', { name: nameOf(p.playerId) })}` : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
