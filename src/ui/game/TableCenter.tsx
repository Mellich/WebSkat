// The felt in the middle of the game screen: the stamped logo, the Skat pile, the trick at fixed positions,
// the bottom bid bubble and the last-trick list. Styles: TableCenter.module.css.

import type { CSSProperties, ReactNode } from 'react';
import type { CardId } from '../../engine';
import type { GameView, TableView } from '../../table';
import { SkatPile } from '../components/SkatPile';
import { CardChip } from '../components/CardChip';
import { TrickArea, type TrickSlot } from '../components/TrickArea';
import { stampUrl, type BackIndex } from '../assets';
import { cls } from '../classNames';
import { useT } from '../i18n';
import type { ShownTrick } from './useShownTrick';
import { placeTrick, trickSeats } from './trickPositions';
import styles from './TableCenter.module.css';

export interface TableCenterProps {
  readonly view: TableView;
  readonly game: GameView;
  readonly shown: ShownTrick;
  readonly showLast: boolean;
  readonly cardBack: BackIndex;
  readonly nameOf: (id: string) => string;
  readonly label: (card: CardId) => string;
  /** The bid bubble of the bottom seat while no phase panel covers the felt (null otherwise). */
  readonly bottomBubble: ReactNode;
  /** Grid placement from GameScreen. */
  readonly className?: string | undefined;
}

/** The stamp mask; the URL comes from assets.ts so a sub-path deployment works. */
const STAMP_STYLE = { '--felt-stamp': `url("${stampUrl()}")` } as CSSProperties & Record<'--felt-stamp', string>;

export function TableCenter({ view, game, shown, showLast, cardBack, nameOf, label, bottomBubble, className }: TableCenterProps) {
  const t = useT();
  const placed = placeTrick(shown.plays, trickSeats(view));
  const toSlot = (p: { readonly playerId: string; readonly card: CardId; readonly winner: boolean } | null): TrickSlot | null =>
    p === null ? null : { card: p.card, name: nameOf(p.playerId), winner: p.winner };
  const slots = { left: toSlot(placed.left), right: toSlot(placed.right), bottom: toSlot(placed.bottom) };
  // The Skat lies on the table during bidding and is public during a Ramsch (skat-rules §12).
  const showSkat = game.phase === 'bidding' || game.phase === 'skat-decision' || game.ramsch;

  return (
    <div className={cls(className, styles.felt, showSkat && styles.withSkat)} data-testid="felt">
      <div className={styles.stamp} style={STAMP_STYLE} aria-hidden="true" data-testid="felt-stamp" />
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
