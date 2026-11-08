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
    expect(buttons).toHaveLength(HAND.length);
    const enabled = buttons.filter((b) => !b.hasAttribute('disabled'));
    expect(enabled.map((b) => b.getAttribute('aria-label'))).toEqual(['Jack of clubs', 'Nine of diamonds']);
    const disabled = buttons.filter((b) => b.hasAttribute('disabled'));
    expect(disabled.map((b) => b.getAttribute('aria-disabled'))).toEqual(['true', 'true']);
  });

  it('renders illegal cards as disabled buttons with the grey style', () => {
    const { container } = render(<Hand cards={HAND} declaration={null} legal={[]} onPlay={() => undefined} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(HAND.length);
    buttons.forEach((b) => {
      expect(b.hasAttribute('disabled')).toBe(true);
      expect(b.getAttribute('aria-disabled')).toBe('true');
    });
    expect(container.querySelectorAll('[class*="disabled"]')).toHaveLength(HAND.length);
  });

  it('renders images when no handler is given', () => {
    render(<Hand cards={HAND} declaration={null} legal={['HA']} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getAllByRole('img')).toHaveLength(HAND.length);
  });

  it('shows all cards at full brightness when legality is irrelevant', () => {
    const { container } = render(<Hand cards={HAND} declaration={null} legal={[]} showAll />);
    expect(container.querySelectorAll('[class*="disabled"]')).toHaveLength(0);
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

  it('keeps legal cards bright but not clickable while paused', () => {
    const onPlay = vi.fn<(card: CardId) => void>();
    const { container } = render(<Hand cards={HAND} declaration={null} legal={['HA']} paused onPlay={onPlay} />);
    const ace = screen.getByRole('button', { name: 'Ace of hearts' });
    expect(ace.hasAttribute('disabled')).toBe(true);
    fireEvent.click(ace);
    expect(onPlay).not.toHaveBeenCalled();
    expect(container.querySelectorAll('[class*="disabled"]')).toHaveLength(HAND.length - 1);
  });

  it('tells the stylesheet how many cards to fit', () => {
    const { container } = render(<Hand cards={HAND} declaration={null} legal={[]} />);
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--hand-n')).toBe('4');
  });

  it('marks the selected cards as pressed', () => {
    render(<Hand cards={HAND} declaration={null} legal={['HA', 'D9']} selected={['D9']} onPlay={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Nine of diamonds' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Ace of hearts' }).getAttribute('aria-pressed')).toBeNull();
  });
});
