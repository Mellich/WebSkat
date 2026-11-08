// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSettings } from '../store/settings';
import { Home } from './Home';

// The directory needs the network; the form validation does not.
vi.mock('../net/transport', () => ({
  getTransport: () => new Promise<never>(() => undefined),
}));

const hostTable = vi.fn<(input: Record<string, unknown>) => Promise<string>>(() => Promise.resolve('ABCDEFGH'));
vi.mock('../net/actions', () => ({
  hostTable: (input: Record<string, unknown>) => hostTable(input),
  resumeHostedTable: () => Promise.resolve(),
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

  it('rejects an invalid invite code before navigating', () => {
    useNameForTest('Anna');
    render(<Home />);
    fireEvent.change(screen.getByPlaceholderText('ABCD-EFGH'), { target: { value: 'ABCD-EFGH' } });
    fireEvent.change(screen.getByTestId('join-invite-input'), { target: { value: 'WXYZ0000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(screen.getByRole('alert').textContent).toContain('not a valid invite code');
    expect(window.location.hash).toBe('');
  });

  it('passes a valid invite code to the table route', () => {
    useNameForTest('Anna');
    render(<Home />);
    fireEvent.change(screen.getByPlaceholderText('ABCD-EFGH'), { target: { value: 'ABCD-EFGH' } });
    fireEvent.change(screen.getByTestId('join-invite-input'), { target: { value: 'wxyz-2345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(window.location.hash).toBe('#/t/ABCDEFGH?invite=WXYZ2345');
  });

  it('navigates to a valid key with a name', () => {
    useNameForTest('Anna');
    render(<Home />);
    fireEvent.change(screen.getByPlaceholderText('ABCD-EFGH'), { target: { value: 'abcd-efgh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(window.location.hash).toBe('#/t/ABCDEFGH');
  });
});

describe('Create table', () => {
  it('asks only for a name and the public flag: no seat count, no bot strength', async () => {
    useNameForTest('Anna');
    render(<Home />);
    expect(screen.queryByLabelText('Seats')).toBeNull();
    expect(screen.queryByTestId('create-bot-level')).toBeNull();
    fireEvent.click(screen.getByTestId('create-table'));
    await waitFor(() => {
      expect(hostTable).toHaveBeenCalledWith({ hostName: 'Anna', tableName: "Anna's table", isPublic: false });
    });
  });
});

/** Puts a name into the settings store (which Home reads). */
function useNameForTest(name: string): void {
  useSettings.setState({ name });
}
