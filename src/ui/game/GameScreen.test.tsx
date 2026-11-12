// @vitest-environment jsdom
// The phase panel lies over the felt and the status row; what the panel needs from the covered row moves into it.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameConnection } from '../../net';
import type { GameView } from '../../table';
import { useSettings } from '../store/settings';
import { GameScreen } from './GameScreen';
import { finishedGameFixture, tableViewFixture } from './viewFixtures';

function connection(): GameConnection {
  return { playerId: () => 'a', send: vi.fn(), subscribe: () => () => undefined, leave: vi.fn(), close: vi.fn() };
}

/** Anna (the viewer and host) won the bidding at 18 and decides about the Skat. */
function skatDecision(overrides: Partial<GameView> = {}): GameView {
  return finishedGameFixture({
    phase: 'skat-decision',
    turnId: 'a',
    pickedUpSkat: false,
    myHand: ['CJ', 'SJ'],
    handCounts: { a: 10, b: 10, c: 10 },
    legal: { canPickUp: true, canPlayHand: true },
    ...overrides,
  });
}

function renderGame(game: GameView) {
  return render(<GameScreen view={tableViewFixture(game)} game={game} connection={connection()} />);
}

beforeEach(() => {
  useSettings.getState().update({ language: 'en' });
});

afterEach(() => {
  cleanup();
});

describe('GameScreen phase panel', () => {
  it('covers the status area and shows the declarer line in the panel', () => {
    renderGame(skatDecision());
    expect(screen.getByTestId('panel-summary').textContent).toBe('Anna won the bidding at 18');
    expect(screen.getByTestId('pickup')).toBeTruthy();
    const status = screen.getByTestId('status-line');
    expect(status.getAttribute('aria-live')).toBeNull();
    expect(status.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByTestId('bid-bubble-bottom')).toBeNull();
  });

  it('moves the reconnect wait, the Bock line and the host Abort button into the panel', () => {
    renderGame(skatDecision({ turnId: 'b', waitingFor: 'b', bock: true, legal: {} }));
    expect(screen.getByTestId('panel-status').textContent).toBe('Waiting for Ben to reconnect…');
    expect(screen.getByTestId('panel-bock').textContent).toContain('Bock game');
    const abort = screen.getAllByTestId('abort-game');
    expect(abort).toHaveLength(1);
    expect(screen.getByTestId('panel-info').contains(abort[0] ?? null)).toBe(true);
  });

  it('keeps the status row visible and live while the cards are played', () => {
    renderGame(skatDecision({
      phase: 'playing',
      declaration: { kind: 'grand', hand: false, announce: 'none', ouvert: false },
      pickedUpSkat: true,
      waitingFor: 'b',
      turnId: 'b',
      legal: {},
    }));
    expect(screen.queryByTestId('phase-panel')).toBeNull();
    const status = screen.getByTestId('status-line');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.closest('[aria-hidden="true"]')).toBeNull();
    expect(status.contains(screen.getByTestId('abort-game'))).toBe(true);
  });

  it('draws the stamped logo and the Skat on the felt', () => {
    renderGame(finishedGameFixture({ phase: 'bidding', turnId: 'b', declarerId: null, bid: null, legal: {} }));
    const felt = screen.getByTestId('felt');
    expect(felt.contains(screen.getByTestId('felt-stamp'))).toBe(true);
    expect(felt.contains(screen.getByTestId('skat-pile'))).toBe(true);
    expect(screen.getByTestId('felt-stamp').getAttribute('aria-hidden')).toBe('true');
  });
});
