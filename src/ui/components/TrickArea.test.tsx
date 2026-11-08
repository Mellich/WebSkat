// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrickArea, type TrickPosition, type TrickSlot } from './TrickArea';

afterEach(() => {
  cleanup();
});

const labelOf = (card: string): string => `card ${card}`;

describe('TrickArea', () => {
  it('draws each card in its fixed slot with the player name on it', () => {
    const slots: Record<TrickPosition, TrickSlot | null> = {
      left: { card: 'CA', name: 'Anna' },
      right: null,
      bottom: { card: 'C10', name: 'Ben' },
    };
    render(<TrickArea slots={slots} labelOf={labelOf} />);

    const left = screen.getByTestId('trick-slot-left');
    expect(within(left).getByRole('img', { name: 'card CA' })).toBeTruthy();
    expect(within(left).getByText('Anna')).toBeTruthy();
    expect(left.dataset['playerName']).toBe('Anna');

    const right = screen.getByTestId('trick-slot-right');
    expect(within(right).queryByRole('img')).toBeNull();
    expect(right.querySelector('[class*="empty"]')).not.toBeNull();
    expect(right.dataset['playerName']).toBeUndefined();

    const bottom = screen.getByTestId('trick-slot-bottom');
    expect(within(bottom).getByRole('img', { name: 'card C10' })).toBeTruthy();
  });

  it('marks the winning card', () => {
    const slots: Record<TrickPosition, TrickSlot | null> = {
      left: null,
      right: null,
      bottom: { card: 'SJ', name: 'Carl', winner: true },
    };
    render(<TrickArea slots={slots} labelOf={labelOf} />);
    const bottom = screen.getByTestId('trick-slot-bottom');
    expect(bottom.querySelector('[class*="winner"]')).not.toBeNull();
  });

  it('is a dismiss button when the trick is held', () => {
    const onDismiss = vi.fn();
    const slots: Record<TrickPosition, TrickSlot | null> = { left: { card: 'CA', name: 'Anna' }, right: null, bottom: null };
    render(<TrickArea slots={slots} labelOf={labelOf} onDismiss={onDismiss} dismissLabel="Continue" />);
    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button.dataset['testid']).toBe('trick-dismiss');
    expect(within(button).getByTestId('trick-area')).toBeTruthy();
    fireEvent.click(button);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
