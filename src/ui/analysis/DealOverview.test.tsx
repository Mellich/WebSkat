// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { playedInput } from './analysisFixtures';
import { DealOverview } from './DealOverview';

afterEach(() => { cleanup(); });

describe('DealOverview', () => {
  it('shows the three names, the 30 dealt cards and the two Skat cards', () => {
    const input = { ...playedInput(), pickedUpSkat: false, discarded: [] };
    render(<DealOverview input={input} />);
    const deal = screen.getByTestId('analysis-deal');
    for (const name of Object.values(input.names)) {
      expect(within(deal).getByText(name, { exact: false })).toBeTruthy();
    }
    expect(within(deal).getAllByRole('img')).toHaveLength(32);
  });

  it('shows the discarded cards only when the declarer picked up the Skat', () => {
    const input = playedInput();
    const pickedUp = { ...input, pickedUpSkat: true, discarded: input.skat };
    render(<DealOverview input={pickedUp} />);
    const deal = screen.getByTestId('analysis-deal');
    expect(within(deal).getByText('Discarded')).toBeTruthy();
    expect(within(deal).getAllByRole('img')).toHaveLength(34);
  });

  it('hides the discarded cards when the Skat was not picked up', () => {
    const input = { ...playedInput(), pickedUpSkat: false, discarded: [] };
    render(<DealOverview input={input} />);
    expect(screen.queryByText('Discarded')).toBeNull();
  });
});
