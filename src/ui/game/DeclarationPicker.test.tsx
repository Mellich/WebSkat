// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { declarationOptions, type Declaration } from '../../engine';
import type { DeclarerSpitzen } from '../../table';
import { DeclarationPicker } from './DeclarationPicker';

afterEach(() => {
  cleanup();
});

const NO_SPITZEN: DeclarerSpitzen = {
  grand: { with: true, count: 0 },
  suit: {
    C: { with: true, count: 0 },
    S: { with: true, count: 0 },
    H: { with: true, count: 0 },
    D: { with: true, count: 0 },
  },
};

describe('DeclarationPicker', () => {
  it('emits only an entry of the legal declarations', () => {
    const options = declarationOptions(true);
    const onDeclare = vi.fn<(d: Declaration) => void>();
    render(<DeclarationPicker options={options} spitzen={NO_SPITZEN} bid={18} onDeclare={onDeclare} />);
    fireEvent.click(screen.getByRole('button', { name: '♥ Hearts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Declare' }));
    expect(onDeclare).toHaveBeenCalledTimes(1);
    const sent = onDeclare.mock.calls[0]?.[0];
    expect(options).toContainEqual(sent);
  });

  it('offers no announcements without Hand, and all announcements with Hand', () => {
    const { unmount } = render(
      <DeclarationPicker options={declarationOptions(false)} spitzen={NO_SPITZEN} bid={18} onDeclare={() => undefined} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '♥ Hearts' }));
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    unmount();

    render(<DeclarationPicker options={declarationOptions(true)} spitzen={NO_SPITZEN} bid={18} onDeclare={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: '♥ Hearts' }));
    expect(screen.getByRole('radiogroup', { name: 'Announcements' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Normal' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Schneider announced' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Schwarz announced' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Ouvert' })).toBeTruthy();
  });

  it('disables the Null entry when Null is not in the legal declarations', () => {
    const options = declarationOptions(false).filter((d) => d.kind !== 'null');
    render(<DeclarationPicker options={options} spitzen={NO_SPITZEN} bid={18} onDeclare={() => undefined} />);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Null' }).disabled).toBe(true);
  });

  it('warns when the guaranteed minimum is below the bid', () => {
    const options = declarationOptions(true);
    render(<DeclarationPicker options={options} spitzen={NO_SPITZEN} bid={84} onDeclare={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: '♣ Clubs' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Schwarz announced' }));
    expect(screen.getByText(/Below your bid of 84/)).toBeTruthy();
  });
});
