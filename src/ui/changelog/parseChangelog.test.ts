import { describe, expect, it } from 'vitest';
import { parseChangelog, parseSemver, splitInlineCode } from './parseChangelog';

const SAMPLE = `# Changelog

Intro text with a [link](https://example.com).

## [Unreleased]

### Added

- Not released yet.

## [1.2.0] - 2026-01-02

### Added

- First item.
- Second item that goes on
  over two lines.

### Fixed

- A bug in \`foo.ts\`.

## [1.1.0] - 2026-01-01

### Changed

- Old change.
`;

describe('parseChangelog', () => {
  it('reads releases, sections and multi-line items', () => {
    const releases = parseChangelog(SAMPLE);
    expect(releases.map((release) => release.version)).toEqual(['Unreleased', '1.2.0', '1.1.0']);
    expect(releases[0]?.date).toBeNull();
    expect(releases[1]).toEqual({
      version: '1.2.0',
      date: '2026-01-02',
      sections: [
        { title: 'Added', items: ['First item.', 'Second item that goes on over two lines.'] },
        { title: 'Fixed', items: ['A bug in `foo.ts`.'] },
      ],
    });
  });

  it('ignores text outside of releases', () => {
    expect(parseChangelog('# Title\n\n- not an item\n')).toEqual([]);
  });
});

describe('splitInlineCode', () => {
  it('marks the parts between backticks as code', () => {
    expect(splitInlineCode('A bug in `foo.ts` now.')).toEqual([
      { code: false, text: 'A bug in ' },
      { code: true, text: 'foo.ts' },
      { code: false, text: ' now.' },
    ]);
  });
});

describe('parseSemver', () => {
  it('accepts plain x.y.z only', () => {
    expect(parseSemver('0.7.12')).toEqual([0, 7, 12]);
    expect(parseSemver('Unreleased')).toBeNull();
    expect(parseSemver('1.0')).toBeNull();
  });
});
