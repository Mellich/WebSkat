// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSettings } from '../store/settings';
import { Home } from './Home';

// The directory needs the network; the form validation does not.
vi.mock('../net/transport', () => ({
  getTransport: () => new Promise<never>(() => undefined),
}));

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('Home form validation', () => {
  it('rejects an invalid table key before navigating', () => {
    useNameForTest('Anna');
    render(<Home />);
    fireEvent.change(screen.getByPlaceholderText('ABCD-EFGH'), { target: { value: 'ABCD-EF0H' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(screen.getByRole('alert').textContent).toContain('not a valid table key');
    expect(window.location.hash).toBe('');
  });

  it('asks for a name before joining a table', () => {
    useNameForTest('');
    render(<Home />);
    fireEvent.change(screen.getByPlaceholderText('ABCD-EFGH'), { target: { value: 'ABCD-EFGH' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(screen.getByRole('alert').textContent).toContain('Please enter a name');
    expect(window.location.hash).toBe('');
  });

  it('navigates to a valid key with a name', () => {
    useNameForTest('Anna');
    render(<Home />);
    fireEvent.change(screen.getByPlaceholderText('ABCD-EFGH'), { target: { value: 'abcd-efgh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(window.location.hash).toBe('#/t/ABCDEFGH');
  });
});

/** Puts a name into the settings store (which Home reads). */
function useNameForTest(name: string): void {
  useSettings.setState({ name });
}
