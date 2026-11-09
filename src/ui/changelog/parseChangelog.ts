// Parses the subset of Markdown that CHANGELOG.md uses (Keep a Changelog, docs/dev/versioning.md):
// `## [x.y.z] - YYYY-MM-DD` releases, `### Added|Changed|...` sections and `- ` items whose text
// may continue on indented lines. Everything else (title, intro) is ignored.

export interface ChangelogSection {
  readonly title: string;
  readonly items: readonly string[];
}

export interface ChangelogRelease {
  readonly version: string;
  readonly date: string | null;
  readonly sections: readonly ChangelogSection[];
}

interface MutableSection {
  title: string;
  items: string[];
}

interface MutableRelease {
  version: string;
  date: string | null;
  sections: MutableSection[];
}

const RELEASE = /^## \[([^\]]+)\](?:\s*-\s*(\S+))?\s*$/;
const SECTION = /^### (.+?)\s*$/;
const ITEM = /^- (.*)$/;
const CONTINUATION = /^\s+(\S.*)$/;

export function parseChangelog(text: string): readonly ChangelogRelease[] {
  const releases: MutableRelease[] = [];
  let release: MutableRelease | null = null;
  let section: MutableSection | null = null;
  for (const line of text.split(/\r?\n/)) {
    const releaseMatch = RELEASE.exec(line);
    if (releaseMatch !== null) {
      release = { version: releaseMatch[1] ?? '', date: releaseMatch[2] ?? null, sections: [] };
      releases.push(release);
      section = null;
      continue;
    }
    if (line.startsWith('## ')) {
      release = null;
      section = null;
      continue;
    }
    if (release === null) continue;
    const sectionMatch = SECTION.exec(line);
    if (sectionMatch !== null) {
      section = { title: sectionMatch[1] ?? '', items: [] };
      release.sections.push(section);
      continue;
    }
    if (section === null) continue;
    const itemMatch = ITEM.exec(line);
    if (itemMatch !== null) {
      section.items.push(itemMatch[1] ?? '');
      continue;
    }
    const continuation = CONTINUATION.exec(line);
    const last = section.items.length - 1;
    if (continuation !== null && last >= 0) {
      section.items[last] = `${section.items[last] ?? ''} ${continuation[1] ?? ''}`;
    }
  }
  return releases;
}

/** Splits an item at backticks: odd parts are inline code. */
export function splitInlineCode(text: string): readonly { readonly code: boolean; readonly text: string }[] {
  return text
    .split('`')
    .map((part, index) => ({ code: index % 2 === 1, text: part }))
    .filter((part) => part.text !== '');
}

/** Parses `x.y.z` into numbers, or null when the version is not plain semver. */
export function parseSemver(version: string): readonly [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (match === null) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
