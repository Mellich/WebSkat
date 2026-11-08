// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSettings } from '../store/settings';
import { AbortGameButton } from './AbortGameButton';

afterEach(() => { cleanup(); });

describe('AbortGameButton', () => {
  it('asks for confirmation and aborts only when confirmed', () => {
    useSettings.getState().update({ language: 'en' });
    const onAbort = vi.fn();
    render(<AbortGameButton onAbort={onAbort} />);
    fireEvent.click(screen.getByTestId('abort-game'));
    expect(onAbort).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not abort when the confirmation is cancelled', () => {
    useSettings.getState().update({ language: 'en' });
    const onAbort = vi.fn();
    render(<AbortGameButton onAbort={onAbort} />);
    fireEvent.click(screen.getByTestId('abort-game'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onAbort).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
