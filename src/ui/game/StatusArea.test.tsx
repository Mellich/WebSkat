// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StatusArea } from './StatusArea';

afterEach(() => {
  cleanup();
});

describe('StatusArea bock line', () => {
  it('shows the Bock line while a Bock game is played', () => {
    render(<StatusArea statusText="Your bid" summary={null} sittingOut={null} bockInfo="Bock game: points ×2 · 3 Bock games left incl. this one" />);
    expect(screen.getByTestId('bock-info').textContent).toBe('Bock game: points ×2 · 3 Bock games left incl. this one');
  });

  it('shows no Bock line for an ordinary game', () => {
    render(<StatusArea statusText="Your bid" summary={null} sittingOut={null} bockInfo={null} />);
    expect(screen.queryByTestId('bock-info')).toBeNull();
  });
});

describe('StatusArea under a phase panel', () => {
  it('keeps its content but hides it from screen readers and stops announcing', () => {
    render(<StatusArea statusText="Your turn" summary="Anna won the bidding at 18" sittingOut={null} bockInfo={null} covered />);
    const row = screen.getByTestId('status-line');
    expect(row.getAttribute('aria-live')).toBeNull();
    expect(row.parentElement?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByTestId('bid-summary').textContent).toBe('Anna won the bidding at 18');
  });

  it('announces the status while nothing covers it', () => {
    render(<StatusArea statusText="Your turn" summary={null} sittingOut={null} bockInfo={null} />);
    expect(screen.getByTestId('status-line').getAttribute('aria-live')).toBe('polite');
    expect(screen.getByTestId('status-line').parentElement?.getAttribute('aria-hidden')).toBeNull();
  });
});
