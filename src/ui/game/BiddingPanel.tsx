// Bidding (Reizen): the caller bids or passes, the listener holds or passes, the forehand may
// claim 18 (docs/06-ui-ux.md §1). Only the options from `legal` are offered.


import type { GameAction, Legal } from '../../engine';
import type { GameView, ViewBidEvent } from '../../table';
import { useT, type Translator } from '../i18n';

export interface BiddingPanelProps {
  readonly bidding: GameView['bidding'];
  readonly legal: Legal;
  readonly nameOf: (id: string) => string;
  readonly send: (action: GameAction) => void;
}

function historyText(ev: ViewBidEvent, name: string, t: Translator): string {
  switch (ev.type) {
    case 'bid':
      return `${name} ${String(ev.value ?? '')}`;
    case 'hold':
      return `${name} ${t('bid.holdWord')}`;
    case 'pass':
      return `${name} ${t('bid.passWord')}`;
    case 'claim':
      return `${name} ${t('bid.claimWord')}`;
    default: {
      const unused: never = ev.type;
      return unused;
    }
  }
}

export function BiddingPanel({ bidding, legal, nameOf, send }: BiddingPanelProps) {
  const t = useT();
  const values = legal.bidValues ?? [];
  const selected = values[0] ?? null;

  return (
    <section className="bidding" aria-label={t('bid.title')}>
      <h3>{t('bid.title')}</h3>
      {bidding.history.length === 0 ? (
        <p>{t('bid.none')}</p>
      ) : (
        <p>
          <span>{t('bid.history')}: </span>
          {bidding.history.map((ev, i) => (
            <span key={i}>{i > 0 ? ' · ' : ''}{historyText(ev, nameOf(ev.playerId), t)}</span>
          ))}
        </p>
      )}
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
