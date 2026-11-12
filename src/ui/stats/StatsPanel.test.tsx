// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StatsPanel } from './StatsPanel';

afterEach(() => {
  cleanup();
});

const PLAYERS = [
  { id: 'p1', name: 'Anna' },
  { id: 'p2', name: 'Ben' },
  { id: 'p3', name: 'Cem' },
] as const;

describe('StatsPanel games count', () => {
  it('shows the games played as a fraction of the series limit', () => {
    render(<StatsPanel records={[]} players={PLAYERS} viewerId="p1" gameLimit={12} onClose={() => undefined} />);
    expect(screen.getByTestId('stats-games').textContent).toBe('0 / 12 games');
  });

  it('shows only the count when the series has no limit', () => {
    render(<StatsPanel records={[]} players={PLAYERS} viewerId="p1" gameLimit={0} onClose={() => undefined} />);
    expect(screen.getByTestId('stats-games').textContent).toBe('0 games played (no limit)');
  });
});
