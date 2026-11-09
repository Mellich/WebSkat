// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSettings } from '../store/settings';
import { ChangelogScreen } from './ChangelogScreen';

afterEach(() => { cleanup(); });

const TEXT = `# Changelog

## [2.0.0] - 2026-02-01

### Fixed

- Fixed \`x.ts\`.

## [1.0.0] - 2026-01-01

### Added

- Everything.
`;

describe('ChangelogScreen', () => {
  it('renders every release with translated section titles', () => {
    useSettings.getState().update({ language: 'de' });
    render(<ChangelogScreen text={TEXT} />);
    const releases = screen.getAllByTestId('changelog-release');
    expect(releases).toHaveLength(2);
    expect(releases[0]?.textContent).toContain('Version 2.0.0');
    expect(releases[0]?.textContent).toContain('Behoben');
    expect(releases[0]?.querySelector('code')?.textContent).toBe('x.ts');
    expect(releases[1]?.textContent).toContain('Neu');
    expect(releases[1]?.textContent).toContain('Everything.');
  });
});
