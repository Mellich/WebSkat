// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardStat } from '../../table';
import { playedInput, startPosition } from './analysisFixtures';
import { ScoreList } from './ScoreList';

afterEach(() => { cleanup(); });

describe('ScoreList', () => {
  it('does not show the sample count of each card (the move control shows it)', () => {
    const position = startPosition(playedInput());
    const rows: CardStat[] = position.playable.map((card, i) => ({ card, samples: 137, wins: i, points: 0, histogram: [], worlds: [] }));
    render(
      <ScoreList rows={rows} declaration={null} best={[]} actualNext={null} notice={null} criterion="win" onCriterion={vi.fn()} onChoose={vi.fn()} />,
    );
    const first = screen.getByTestId(`analysis-score-${position.playable[0] ?? ''}`);
    expect(first.textContent).not.toContain('137');
    expect(screen.queryByText('Samples')).toBeNull();
    expect(screen.queryByText('Stichproben')).toBeNull();
  });

  it('marks one best card, or all cards that are about equal as tied', () => {
    const position = startPosition(playedInput());
    const [a, b] = position.playable;
    if (a === undefined || b === undefined) throw new Error('expected two playable cards');
    const rows: CardStat[] = position.playable.map((card) => ({ card, samples: 10, wins: 5, points: 0, histogram: [], worlds: [] }));
    const props = { rows, declaration: null, actualNext: null, notice: null, criterion: 'win' as const, onCriterion: vi.fn(), onChoose: vi.fn() };
    const one = render(<ScoreList {...props} best={[a]} />);
    expect(screen.getByTestId(`analysis-score-${a}`).textContent).toMatch(/best|beste/);
    expect(screen.getByTestId(`analysis-score-${a}`).textContent).not.toMatch(/tied|gleichauf/);
    one.unmount();
    render(<ScoreList {...props} best={[a, b]} />);
    expect(screen.getByTestId(`analysis-score-${a}`).textContent).toMatch(/tied|gleichauf/);
    expect(screen.getByTestId(`analysis-score-${b}`).textContent).toMatch(/tied|gleichauf/);
  });
});
