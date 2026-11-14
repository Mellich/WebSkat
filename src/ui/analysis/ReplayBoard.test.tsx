// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardId } from '../../engine';
import { percent } from './scoreFormat';
import { winRate, type CardStat } from '../../table';
import { playedInput, startPosition } from './analysisFixtures';
import { ReplayBoard } from './ReplayBoard';

afterEach(() => { cleanup(); });

describe('ReplayBoard', () => {
  it('makes only the playable cards of the mover buttons', () => {
    const input = playedInput();
    const position = startPosition(input);
    render(<ReplayBoard input={input} position={position} stats={[]} best={[]} actualNext={input.plays[0] ?? null} onChoose={vi.fn()} />);
    const board = screen.getByTestId('analysis-board');
    const buttons = within(board).getAllByRole('button');
    expect(buttons).toHaveLength(position.playable.length);
    for (const card of position.playable) {
      const button = within(board).getByTestId(`analysis-card-${card}`);
      expect(button.tagName).toBe('BUTTON');
      expect((button as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it('shows the win rate of every playable card as its badge', () => {
    const input = playedInput();
    const position = startPosition(input);
    const stats: CardStat[] = position.playable.map((card, i) => ({ card, samples: 10, wins: i, points: 0, histogram: [], worlds: [] }));
    render(<ReplayBoard input={input} position={position} stats={stats} best={[]} actualNext={null} onChoose={vi.fn()} />);
    for (const stat of stats) {
      const cell = screen.getByTestId(`analysis-card-${stat.card}`).parentElement;
      if (cell === null) throw new Error('expected a card cell');
      expect(within(cell).getByText(percent(winRate(stat)))).toBeTruthy();
    }
  });

  it('chooses the card that was clicked', () => {
    const input = playedInput();
    const position = startPosition(input);
    const onChoose = vi.fn();
    const card: CardId | undefined = position.playable[0];
    if (card === undefined) throw new Error('expected a playable card');
    render(<ReplayBoard input={input} position={position} stats={[]} best={[]} actualNext={null} onChoose={onChoose} />);
    fireEvent.click(screen.getByTestId(`analysis-card-${card}`));
    expect(onChoose).toHaveBeenCalledWith(card);
  });

  it('marks the mover', () => {
    const input = playedInput();
    const position = startPosition(input);
    if (position.mover === null) throw new Error('expected a mover');
    render(<ReplayBoard input={input} position={position} stats={[]} best={[]} actualNext={null} onChoose={vi.fn()} />);
    expect(screen.getByTestId(`analysis-seat-${position.mover}`).getAttribute('aria-current')).toBe('true');
  });
});
