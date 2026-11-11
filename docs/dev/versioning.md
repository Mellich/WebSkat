# Versioning and changelog

WebSkat follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html). Every change is
listed in `CHANGELOG.md` (repository root, format
[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)).

**Every change that touches code, behavior, texts, styles or dependencies adds a changelog entry
under `## [Unreleased]`, in the same change. It does not bump the version.** The version is chosen
and set only when the user requests a release (§4). Changes to docs, tests or tooling only (no file under
`src/`, `public/`, `index.html` or the build config changes) need neither.

## 1. Where the version lives

| Place | Role |
|---|---|
| `package.json` `"version"` | **The single source.** Also mirrored in `package-lock.json` (the two top `"version"` fields) |
| `CHANGELOG.md` | The newest `## [x.y.z] - YYYY-MM-DD` heading must equal the `package.json` version. An optional `## [Unreleased]` section above it collects the changes since |
| `vite.config.ts` `define.__APP_VERSION__` | Reads `package.json` at build and test time |
| `src/ui/version.ts` `APP_VERSION` | The version in the app |
| `src/ui/components/VersionBadge.tsx` | Shows `vX.Y.Z` bottom left on every screen; opens `#/changelog` in a new tab |
| `src/ui/screens/ChangelogScreen.tsx` | `#/changelog`: renders `CHANGELOG.md` (bundled with `?raw`, `src/ui/changelog/`) |

`src/ui/changelog/changelog.test.ts` (part of `npm run check`) fails when the newest changelog
release (an `Unreleased` section is ignored) is not the `package.json` version, when versions are not strictly decreasing, when a
release has no date or no item, or when a section name is not one of the six below.

## 2. Which number to bump (at release time)

The project is in `0.x`: the public API is the game the players see and the network protocol.

| The change … | Bump | Example |
|---|---|---|
| breaks compatibility: `PROTOCOL_VERSION` changes, or old host snapshots / stored settings can no longer be loaded | **minor** while `0.x` (major from `1.0.0` on) | 0.7.3 → 0.8.0 |
| adds a feature or changes visible behavior, compatibly | **minor** | 0.7.3 → 0.8.0 |
| only fixes bugs, texts, styles, performance, refactors without visible change | **patch** | 0.7.3 → 0.7.4 |

`1.0.0` is released only when the user decides so. After `1.0.0`: breaking → major, feature →
minor, fix → patch. A minor or major bump resets the lower numbers to 0.

## 3. Recording a change (every change)

1. Do **not** run `npm version` and do not add a numbered release.
2. At the top of `CHANGELOG.md`, below the intro, use the section `## [Unreleased]` (no date; create
   it if missing). Add your items to it:

   ```markdown
   ## [Unreleased]

   ### Added

   - Short sentence a player understands, with the most important detail.
   ```

3. Use only these sections, in this order, and leave out empty ones: `Added`, `Changed`,
   `Deprecated`, `Removed`, `Fixed`, `Security`.
4. Write items for players and hosts, in English, one sentence each (continuation lines indented
   by two spaces). Mention a protocol change as "(protocol version N)" and mark a breaking change
   as "Breaking:" (it decides the bump in §2). Inline code in backticks is shown as code; other
   Markdown (links, bold) is shown as plain text.
5. Run `npx vitest run src/ui/changelog` (or `npm run check`).

Never edit the items of released versions, except to fix a typo.

## 4. Releasing (only when the user asks)

1. Read `## [Unreleased]` and pick the new version with the table in §2: the largest bump any item
   needs (breaking or feature → minor while `0.x`; only fixes → patch). Tell the user the version
   and why.
2. Commit pending work first (the release script refuses a dirty worktree). Run
   `npm run release -- X.Y.Z` on `main`. The script (`scripts/release.mjs`):
   - renames `## [Unreleased]` to `## [X.Y.Z] - <today>`, runs
     `npm version X.Y.Z --no-git-tag-version`, runs `npm run check`;
   - makes the commit `Release vX.Y.Z` (CHANGELOG.md, package.json, package-lock.json) and the
     annotated tag `vX.Y.Z`;
   - runs `npm run publish:pages` (check, build, `gh-pages` commit) and `git push origin gh-pages`.
3. Pushing `main` and the tag is not part of the script; do it only if the user asks
   (`git push origin main vX.Y.Z`).
4. Report the version, the tag, the check result and what was pushed.
