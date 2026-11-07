// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameAction, Legal } from '../../engine';
import type { GameView } from '../../table';
import { BiddingPanel } from './BiddingPanel';

afterEach(() => {
  cleanup();
});

const names = (id: string): string => (id === 'a' ? 'Anna' : 'Ben');

function bidding(overrides: Partial<GameView['bidding']> = {}): GameView['bidding'] {
  return {
    stage: 1,
    callerId: 'a',
    listenerId: 'b',
    currentBid: null,
    history: [],
    ...overrides,
  };
}

describe('BiddingPanel', () => {
  it('offers one button for the single bid value the engine lists as legal', () => {
    const legal: Legal = { bidValues: [18], canPassBid: true };
    render(<BiddingPanel bidding={bidding()} legal={legal} nameOf={names} send={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Bid 18' })).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('sends the only legal next value', () => {
    const send = vi.fn<(action: GameAction) => void>();
    render(<BiddingPanel bidding={bidding()} legal={{ bidValues: [20], canPassBid: true }} nameOf={names} send={send} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bid 20' }));
    expect(send).toHaveBeenCalledWith({ type: 'bid', value: 20 });
  });

  it('offers hold only to the listener after a bid', () => {
    const send = vi.fn<(action: GameAction) => void>();
    render(
      <BiddingPanel
        bidding={bidding({ currentBid: 20 })}
        legal={{ canHold: true, canPassBid: true }}
        nameOf={names}
        send={send}
      />,
    );
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Hold 20' }));
    expect(send).toHaveBeenCalledWith({ type: 'hold' });
  });

  it('does not offer hold when nothing has been bid', () => {
    render(<BiddingPanel bidding={bidding()} legal={{ canHold: true }} nameOf={names} send={() => undefined} />);
    expect(screen.queryByRole('button', { name: /Hold/ })).toBeNull();
  });

  it('offers claim and pass in the claim stage', () => {
    const send = vi.fn<(action: GameAction) => void>();
    render(
      <BiddingPanel
        bidding={bidding({ stage: 'claim' })}
        legal={{ canClaim: true, canPassBid: true }}
        nameOf={names}
        send={send}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Play (18)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pass' }));
    expect(send.mock.calls).toEqual([[{ type: 'claim' }], [{ type: 'pass' }]]);
  });

  it('lists the bidding so far with names', () => {
    render(
      <BiddingPanel
        bidding={bidding({
          history: [
            { playerId: 'a', type: 'bid', value: 18 },
            { playerId: 'b', type: 'pass' },
          ],
        })}
        legal={{}}
        nameOf={names}
        send={() => undefined}
      />,
    );
    expect(document.body.textContent).toContain('Anna 18 · Ben passes');
  });
});
