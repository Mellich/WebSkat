// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogEntry } from '../../table';
import { useSettings } from '../store/settings';
import { GameLogDialog } from './GameLogDialog';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useSettings.getState().update({ language: 'en' });
});

const entries: LogEntry[] = [
  { kind: 'dealt', number: 1, dealerId: 'p0', dealerName: 'Hanna', bock: false, n: 1, at: 0 },
  { kind: 'joined', playerId: 'p1', name: 'Anna', isBot: false, pending: false, n: 2, at: 0 },
  { kind: 'bid', playerId: 'p1', name: 'Anna', action: 'bid', value: 18, n: 3, at: 0 },
];

describe('GameLogDialog', () => {
  it('lists the entries oldest first, with their texts', () => {
    render(<GameLogDialog entries={entries} onClose={() => undefined} />);
    const rows = screen.getAllByTestId('log-entry');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Game 1 — dealer: Hanna'),
      expect.stringContaining('Anna joined'),
      expect.stringContaining('Anna bids 18'),
    ]);
    expect(screen.getByTestId('log-list').querySelectorAll('li')).toHaveLength(3);
  });

  it('shows the empty text when nothing has happened', () => {
    render(<GameLogDialog entries={[]} onClose={() => undefined} />);
    expect(screen.queryByTestId('log-entry')).toBeNull();
    expect(screen.getByText('Nothing has happened yet.')).toBeTruthy();
  });

  it('closes with Escape and with the Close button', () => {
    const onClose = vi.fn();
    render(<GameLogDialog entries={entries} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
