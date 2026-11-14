// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AnalysisInput } from '../../table';
import { encodeAnalysis } from './link';
import { AnalysisScreen } from './AnalysisScreen';
import { fakeWorker, otherFirstCard, passedInInput, playedInput, ramschInput, startPosition } from './analysisFixtures';

afterEach(() => { cleanup(); });

function renderScreen(input: AnalysisInput) {
  const worker = fakeWorker();
  render(<AnalysisScreen data={encodeAnalysis(input)} workerFactory={worker.factory} />);
  return worker;
}

function trickCards(): number {
  return within(screen.getByTestId('analysis-trick')).queryAllByRole('img').length;
}

describe('AnalysisScreen', () => {
  it('shows an error and a link home for missing data', () => {
    render(<AnalysisScreen data={null} />);
    expect(screen.getByTestId('analysis-invalid')).toBeTruthy();
    expect(screen.queryByTestId('analysis-screen')).toBeNull();
    expect(screen.getByRole('link').getAttribute('href')).toBe('#/');
  });

  it('shows an error for data that is not a valid analysis', () => {
    render(<AnalysisScreen data="abc" />);
    expect(screen.getByTestId('analysis-invalid')).toBeTruthy();
  });

  it('shows the screen without the error for a valid analysis', () => {
    renderScreen(playedInput());
    expect(screen.getByTestId('analysis-screen')).toBeTruthy();
    expect(screen.queryByTestId('analysis-invalid')).toBeNull();
  });

  it('starts with the forehand to play and no card in the trick', () => {
    renderScreen(playedInput());
    expect(screen.getByTestId('analysis-seat-forehand').getAttribute('aria-current')).toBe('true');
    expect(trickCards()).toBe(0);
  });

  it('plays one card forward and takes it back', () => {
    renderScreen(playedInput());
    fireEvent.click(screen.getByTestId('analysis-forward'));
    expect(trickCards()).toBe(1);
    fireEvent.click(screen.getByTestId('analysis-back'));
    expect(trickCards()).toBe(0);
  });

  it('goes to the end and shows the result', () => {
    renderScreen(playedInput());
    fireEvent.click(screen.getByTestId('analysis-end'));
    expect(screen.getByTestId('analysis-result')).toBeTruthy();
    expect(screen.queryByTestId('analysis-scores')).toBeNull();
  });

  it('shows one score row per playable card after a batch', () => {
    const input = playedInput();
    const worker = renderScreen(input);
    worker.drain(1);
    const rows = document.querySelectorAll('[data-testid^="analysis-score-"]');
    expect(rows).toHaveLength(startPosition(input).playable.length);
  });

  it('starts a variant when a different card is played, and resets it', () => {
    const input = playedInput();
    renderScreen(input);
    fireEvent.click(screen.getByTestId(`analysis-card-${otherFirstCard(input)}`));
    expect(screen.getByTestId('analysis-variant')).toBeTruthy();
    expect(screen.getByTestId('analysis-reset')).toBeTruthy();
    fireEvent.click(screen.getByTestId('analysis-reset'));
    expect(screen.queryByTestId('analysis-variant')).toBeNull();
  });

  it('does not start a variant for the actual next card', () => {
    const input = playedInput();
    renderScreen(input);
    const actual = input.plays[0];
    if (actual === undefined) throw new Error('expected a first card');
    fireEvent.click(screen.getByTestId(`analysis-card-${actual}`));
    expect(screen.queryByTestId('analysis-variant')).toBeNull();
    expect(trickCards()).toBe(1);
  });

  it('sends a new analysis with the real hands when the switch is on', () => {
    const worker = renderScreen(playedInput());
    fireEvent.click(screen.getByTestId('analysis-real-hands'));
    expect(worker.sent.at(-1)).toMatchObject({ type: 'analyze', useRealHands: true });
  });

  it('sends a new analysis with the chosen share of random moves', () => {
    const worker = renderScreen(playedInput());
    expect(worker.sent.at(-1)).toMatchObject({ type: 'analyze', epsilon: 0.1 });
    fireEvent.change(screen.getByTestId('analysis-epsilon'), { target: { value: '0.3' } });
    expect(worker.sent.at(-1)).toMatchObject({ type: 'analyze', epsilon: 0.3, initial: null });
  });

  it('stops on pause and resumes from the shown stats', () => {
    const input = playedInput();
    const worker = renderScreen(input);
    worker.drain(1);
    fireEvent.click(screen.getByTestId('analysis-pause'));
    expect(worker.sent.at(-1)).toEqual({ type: 'stop' });
    fireEvent.click(screen.getByTestId('analysis-pause'));
    const last = worker.sent.at(-1);
    expect(last).toMatchObject({ type: 'analyze' });
    if (last?.type !== 'analyze' || last.initial === null) throw new Error('expected analyze with initial stats');
    expect(last.initial).toHaveLength(startPosition(input).playable.length);
  });

  it('moves forward with the arrow key', () => {
    renderScreen(playedInput());
    fireEvent.keyDown(screen.getByTestId('analysis-board'), { key: 'ArrowRight' });
    expect(trickCards()).toBe(1);
  });

  it('shows the deal and no board for a passed-in game', () => {
    renderScreen(passedInInput());
    expect(screen.getByTestId('analysis-deal')).toBeTruthy();
    expect(screen.queryByTestId('analysis-board')).toBeNull();
  });

  it('shows no scores and no pause button for a Ramsch game', () => {
    renderScreen(ramschInput());
    expect(screen.getByText('No scores for Ramsch games.')).toBeTruthy();
    expect(screen.queryByTestId('analysis-pause')).toBeNull();
  });
});
