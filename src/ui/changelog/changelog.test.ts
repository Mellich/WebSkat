// Guards the versioning process (docs/dev/versioning.md): CHANGELOG.md and package.json agree.

import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../version';
import { changelogText } from './changelogText';
import { isUnreleased, parseChangelog, parseSemver } from './parseChangelog';

const allReleases = parseChangelog(changelogText);
// An optional `## [Unreleased]` section may come first; it has no version, date or fixed content.
const unreleased = allReleases.filter((release) => isUnreleased(release.version));
const releases = allReleases.filter((release) => !isUnreleased(release.version));

function compare(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < 3; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

describe('CHANGELOG.md', () => {
  it('has at most one Unreleased section and it is the first one', () => {
    expect(unreleased.length).toBeLessThanOrEqual(1);
    if (unreleased.length === 1) expect(allReleases[0]).toBe(unreleased[0]);
  });

  it('has the package.json version as its newest release', () => {
    expect(parseSemver(APP_VERSION)).not.toBeNull();
    expect(releases[0]?.version).toBe(APP_VERSION);
  });

  it('lists every release with a semver version, a date and at least one item, newest first', () => {
    expect(releases.length).toBeGreaterThan(0);
    let previous: readonly number[] | null = null;
    for (const release of releases) {
      const version = parseSemver(release.version);
      expect(version, release.version).not.toBeNull();
      expect(release.date, release.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(release.sections.some((section) => section.items.length > 0), release.version).toBe(true);
      if (version !== null && previous !== null) expect(compare(previous, version), release.version).toBeGreaterThan(0);
      previous = version;
    }
  });

  it('uses only the Keep a Changelog section names', () => {
    const allowed = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
    for (const release of allReleases) {
      for (const section of release.sections) expect(allowed, `${release.version}: ${section.title}`).toContain(section.title);
    }
  });
});
