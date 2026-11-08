// Bidding (Reizen): the caller bids or passes, the listener holds or passes, the forehand may
// claim 18 (docs/ui-game-screen.md §3). Only the options from `legal` are offered. The panel shows
// the current bid and whose turn it is; the bubbles over the seats show every single bid.

import type { GameAction, Legal } from '../../engine';
import type { GameView, ViewBidEvent } from '../../table';
import { useT } from '../i18n';

export interface BiddingPanelProps {
  readonly bidding: GameView['bidding'];
  readonly legal: Legal;
  readonly nameOf: (id: string) => string;
  readonly send: (action: GameAction) => void;
}

/** The player who made the current bid: the last `bid` or `claim` event. */
function bidderOf(history: readonly ViewBidEvent[]): string | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const ev = history[i];
    if (ev !== undefined && (ev.type === 'bid' || ev.type === 'claim')) return ev.playerId;
  }
  return null;
}

export function BiddingPanel({ bidding, legal, nameOf, send }: BiddingPanelProps) {
  const t = useT();
  const values = legal.bidValues ?? [];
  const selected = values[0] ?? null;
  const bidder = bidderOf(bidding.history);
  const currentText = bidding.currentBid === null || bidder === null
    ? t('bid.none')
    : t('bid.current', { value: bidding.currentBid, name: nameOf(bidder) });
  const turnText = (() => {
    switch (bidding.stage) {
      case 1:
      case 2:
        return t('bid.turn', { caller: nameOf(bidding.callerId), listener: nameOf(bidding.listenerId) });
      case 'claim':
        return t('bid.claimTurn', { name: nameOf(bidding.callerId) });
      case 'done':
      case 'passed-in':
        return null;
      default: {
        const unused: never = bidding.stage;
        return unused;
      }
    }
  })();

  return (
    <section className="bidding" aria-label={t('bid.title')}>
      <h3>{t('bid.title')}</h3>
      <p data-testid="bid-current" aria-live="polite">{currentText}</p>
      {turnText === null ? null : <p data-testid="bid-turn">{turnText}</p>}
      <div className="bidding-actions">
        {values.length > 0 ? (
          <button
            type="button"
            disabled={selected === null}
            data-testid="bid-submit"
            onClick={() => {
              if (selected !== null) send({ type: 'bid', value: selected });
            }}
          >
            {t('bid.bidValue', { value: selected ?? '' })}
          </button>
        ) : null}
        {legal.canHold === true && bidding.currentBid !== null ? (
          <button type="button" data-testid="bid-hold" onClick={() => { send({ type: 'hold' }); }}>
            {t('bid.hold', { value: bidding.currentBid })}
          </button>
        ) : null}
        {legal.canClaim === true ? (
          <button type="button" data-testid="bid-claim" onClick={() => { send({ type: 'claim' }); }}>{t('bid.claim')}</button>
        ) : null}
        {legal.canPassBid === true ? (
          <button type="button" data-testid="bid-pass" onClick={() => { send({ type: 'pass' }); }}>{t('bid.pass')}</button>
        ) : null}
      </div>
    </section>
  );
}
