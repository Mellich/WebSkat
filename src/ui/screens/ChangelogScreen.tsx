// `#/changelog`: the releases from CHANGELOG.md (docs/ui.md §1, docs/dev/versioning.md).
// Headings go through t(); the release notes themselves are shown as written (English).

import { changelogText } from '../changelog/changelogText';
import { isUnreleased, parseChangelog, splitInlineCode, type ChangelogRelease } from '../changelog/parseChangelog';
import { useT, type Translator } from '../i18n';
import type { TranslationKey } from '../i18n/en';
import { APP_VERSION } from '../version';
import styles from './ChangelogScreen.module.css';

const SECTION_KEYS: Readonly<Record<string, TranslationKey>> = {
  Added: 'changelog.section.Added',
  Changed: 'changelog.section.Changed',
  Deprecated: 'changelog.section.Deprecated',
  Removed: 'changelog.section.Removed',
  Fixed: 'changelog.section.Fixed',
  Security: 'changelog.section.Security',
};

function sectionTitle(title: string, t: Translator): string {
  const key = SECTION_KEYS[title];
  return key === undefined ? title : t(key);
}

function Item({ text }: { readonly text: string }) {
  return (
    <li>
      {splitInlineCode(text).map((part, index) => (part.code ? <code key={index}>{part.text}</code> : <span key={index}>{part.text}</span>))}
    </li>
  );
}

function Release({ release, t }: { readonly release: ChangelogRelease; readonly t: Translator }) {
  return (
    <section className={styles.release} data-testid="changelog-release">
      <h2>
        {isUnreleased(release.version) ? t('changelog.unreleased') : t('changelog.release', { version: release.version })}
        {release.date === null ? null : <span className={styles.date}>{release.date}</span>}
      </h2>
      {release.sections.map((section) => (
        <div key={section.title}>
          <h3>{sectionTitle(section.title, t)}</h3>
          <ul>
            {section.items.map((item, index) => (
              <Item key={index} text={item} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

export function ChangelogScreen({ text = changelogText }: { readonly text?: string }) {
  const t = useT();
  const releases = parseChangelog(text);
  return (
    <main className={styles.page} data-testid="changelog">
      <h1>{t('changelog.title')}</h1>
      <p className={styles.current}>{t('changelog.current', { version: APP_VERSION })}</p>
      {releases.map((release) => (
        <Release key={release.version} release={release} t={t} />
      ))}
    </main>
  );
}
