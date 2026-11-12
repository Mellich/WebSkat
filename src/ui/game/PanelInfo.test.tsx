// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PanelInfo } from './PanelInfo';

afterEach(() => {
  cleanup();
});

describe('PanelInfo', () => {
  it('renders nothing when there is nothing to tell', () => {
    const { container } = render(<PanelInfo status={null} summary={null} bockInfo={null} actions={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the given lines and buttons', () => {
    render(<PanelInfo status="Waiting for Ben to reconnect…" summary="Anna plays Grand" bockInfo="Bock game" actions={<button type="button">Abort</button>} />);
    expect(screen.getByTestId('panel-status').textContent).toBe('Waiting for Ben to reconnect…');
    expect(screen.getByTestId('panel-summary').textContent).toBe('Anna plays Grand');
    expect(screen.getByTestId('panel-bock').textContent).toBe('Bock game');
    expect(screen.getByRole('button', { name: 'Abort' })).toBeTruthy();
  });
});
