// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardId } from '../../engine';
import { Hand } from './Hand';

afterEach(() => {
  cleanup();
});

const HAND: CardId[] = ['CJ', 'HA', 'D9', 'C7'];

describe('Hand', () => {
  it('enables only the cards that are passed as legal', () => {
    render(<Hand cards={HAND} declaration={null} legal={['CJ', 'D9']} onPlay={() => undefined} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Jack of clubs', 'Nine of diamonds']);

    expect(screen.queryByRole('button', { name: 'Ace of hearts' })).toBeNull();
  });

  it('shows the illegal cards without making them focusable', () => {
    render(<Hand cards={HAND} declaration={null} legal={[]} onPlay={() => undefined} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByRole('img', { name: 'Ace of hearts' }).tagName).toBe('IMG');
  });

  it('shows all cards at full brightness when legality is irrelevant', () => {
    const { container } = render(<Hand cards={HAND} declaration={null} legal={[]} showAll />);
    expect(container.querySelectorAll('.disabled')).toHaveLength(0);
    expect(screen.getAllByRole('img')).toHaveLength(HAND.length);
  });

  it('reports the card that was played', () => {
    const onPlay = vi.fn<(card: CardId) => void>();
    render(<Hand cards={HAND} declaration={null} legal={['HA']} onPlay={onPlay} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ace of hearts' }));
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPlay).toHaveBeenCalledWith('HA');
  });

  it('toggles cards in discard mode instead of playing them', () => {
    const onPlay = vi.fn<(card: CardId) => void>();
    const onToggle = vi.fn<(card: CardId) => void>();
    render(
      <Hand cards={HAND} declaration={null} legal={['C7', 'D9']} mode="discard" onPlay={onPlay} onToggle={onToggle} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Seven of clubs' }));
    expect(onToggle).toHaveBeenCalledWith('C7');
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('marks the selected cards as pressed', () => {
    render(<Hand cards={HAND} declaration={null} legal={['HA', 'D9']} selected={['D9']} onPlay={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Nine of diamonds' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Ace of hearts' }).getAttribute('aria-pressed')).toBeNull();
  });
});
