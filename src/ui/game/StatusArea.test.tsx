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
