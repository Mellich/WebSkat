// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AllCards } from './AllCards';

afterEach(() => {
  cleanup();
});

const rows = {
  players: [
    { name: 'Anna', cards: ['C7', 'S8'] as const },
    { name: 'Ben', cards: ['H9'] as const },
  ],
  skat: ['CA', 'SK'] as const,
};

describe('AllCards', () => {
  it('hides the cards until the button is pressed, then shows every hand and the Skat', () => {
    render(<AllCards hands={rows} />);
    const button = screen.getByTestId('show-all-cards');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('all-cards')).toBeNull();

    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const list = screen.getByTestId('all-cards');
    expect(list.textContent).toContain('Anna');
    expect(list.textContent).toContain('Ben');
    expect(list.textContent).toContain('Skat');
    expect(screen.getAllByRole('img').length).toBe(5);

    fireEvent.click(button);
    expect(screen.queryByTestId('all-cards')).toBeNull();
  });
});
