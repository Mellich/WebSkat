// The Skat decision (pick up or play Hand) and the discard step (choose two cards to drücken).

import type { GameAction, Legal } from '../../engine';
import { useT } from '../i18n';

export interface SkatDecisionProps {
  readonly legal: Legal;
  readonly isMine: boolean;
  readonly declarerName: string;
  readonly bid: number | null;
  readonly send: (action: GameAction) => void;
}

export function SkatDecision({ legal, isMine, declarerName, bid, send }: SkatDecisionProps) {
  const t = useT();
  if (!isMine) {
    return <p>{t('skat.wonBy', { name: declarerName, bid: bid ?? 0 })}</p>;
  }
  return (
    <div className="skat-actions">
      {legal.canPickUp === true ? (
        <button type="button" data-testid="pickup" onClick={() => { send({ type: 'pickup-skat' }); }}>{t('skat.pickUp')}</button>
      ) : null}
      {legal.canPlayHand === true ? (
        <button type="button" data-testid="play-hand" onClick={() => { send({ type: 'play-hand' }); }}>{t('skat.playHand')}</button>
      ) : null}
    </div>
  );
}

export interface DiscardPanelProps {
  readonly selected: number;
  readonly onDiscard: () => void;
}

export function DiscardPanel({ selected, onDiscard }: DiscardPanelProps) {
  const t = useT();
  return (
    <div className="discard-panel">
      <p>{t('skat.selected', { count: selected })}</p>
      <button type="button" disabled={selected !== 2} data-testid="discard-submit" onClick={onDiscard}>
        {t('skat.discardButton')}
      </button>
    </div>
  );
}
