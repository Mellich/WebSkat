// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameAction, Legal } from '../../engine';
import { DoublingPanel } from './DoublingPanel';

afterEach(() => {
  cleanup();
});

describe('DoublingPanel', () => {
  it('a defender may say Kontra or no Kontra and sends the chosen action', () => {
    const send = vi.fn<(action: GameAction) => void>();
    const legal: Legal = { canKontra: true, canNoDouble: true };
    render(<DoublingPanel legal={legal} isMine waitingFor="Ben" send={send} />);
    expect(screen.queryByTestId('re')).toBeNull();
    fireEvent.click(screen.getByTestId('kontra'));
    expect(send).toHaveBeenLastCalledWith({ type: 'kontra' });
    fireEvent.click(screen.getByTestId('no-double'));
    expect(send).toHaveBeenLastCalledWith({ type: 'no-double' });
  });

  it('the declarer after Kontra may say Re or no Re', () => {
    const send = vi.fn<(action: GameAction) => void>();
    render(<DoublingPanel legal={{ canRe: true, canNoDouble: true }} isMine waitingFor="Anna" send={send} />);
    expect(screen.queryByTestId('kontra')).toBeNull();
    fireEvent.click(screen.getByTestId('re'));
    expect(send).toHaveBeenLastCalledWith({ type: 're' });
  });

  it('shows only the waiting text to the other players', () => {
    render(<DoublingPanel legal={{}} isMine={false} waitingFor="Anna" send={() => undefined} />);
    expect(screen.queryByTestId('no-double')).toBeNull();
    expect(screen.getByText(/Anna/)).toBeTruthy();
  });
});
