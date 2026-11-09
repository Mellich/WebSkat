// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSettings } from '../store/settings';
import { APP_VERSION } from '../version';
import { VersionBadge } from './VersionBadge';

afterEach(() => { cleanup(); });

describe('VersionBadge', () => {
  it('shows the version and opens the changelog in a new tab', () => {
    useSettings.getState().update({ language: 'en' });
    render(<VersionBadge />);
    const link = screen.getByTestId('app-version');
    expect(link.textContent).toBe(`v${APP_VERSION}`);
    expect(link.getAttribute('href')).toBe('#/changelog');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.getAttribute('aria-label')).toBe(`Version ${APP_VERSION}: open the changelog in a new tab`);
  });
});
