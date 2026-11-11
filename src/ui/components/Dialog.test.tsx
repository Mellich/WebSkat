// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettings } from '../store/settings';
import { Dialog } from './Dialog';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useSettings.getState().update({ language: 'en' });
});

describe('Dialog', () => {
  it('shows the title and an icon close button labelled Close', () => {
    render(<Dialog title="Sample" onClose={() => undefined}><p>body</p></Dialog>);
    expect(screen.getByRole('dialog', { name: 'Sample' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Sample' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('calls onClose from the close button and from Escape', () => {
    const onClose = vi.fn();
    render(<Dialog title="Sample" onClose={onClose}><p>body</p></Dialog>);
    fireEvent.click(screen.getByTestId('dialog-close'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('keeps the toolbar and the actions outside the scrolling body', () => {
    render(
      <Dialog title="Sample" onClose={() => undefined} actions={<button type="button">Export</button>} toolbar={<span>tools</span>}>
        <p>body</p>
      </Dialog>,
    );
    expect(screen.getByRole('button', { name: 'Export' })).toBeTruthy();
    expect(screen.getByText('tools').parentElement).not.toBe(screen.getByText('body').parentElement);
  });
});
