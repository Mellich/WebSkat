# Versioning and changelog

WebSkat follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html). Every change is
listed in `CHANGELOG.md` (repository root, format
[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)).

**Every change that touches code, behavior, texts, styles or dependencies bumps the version and
adds a changelog entry, in the same change.** Changes to docs, tests or tooling only (no file under
`src/`, `public/`, `index.html` or the build config changes) need neither.

## 1. Where the version lives

| Place | Role |
|---|---|
| `package.json` `"version"` | **The single source.** Also mirrored in `package-lock.json` (the two top `"version"` fields) |
| `CHANGELOG.md` | The newest `## [x.y.z] - YYYY-MM-DD` heading must equal the `package.json` version |
| `vite.config.ts` `define.__APP_VERSION__` | Reads `package.json` at build and test time |
| `src/ui/version.ts` `APP_VERSION` | The version in the app |
| `src/ui/components/VersionBadge.tsx` | Shows `vX.Y.Z` bottom left on every screen; opens `#/changelog` in a new tab |
| `src/ui/screens/ChangelogScreen.tsx` | `#/changelog`: renders `CHANGELOG.md` (bundled with `?raw`, `src/ui/changelog/`) |

`src/ui/changelog/changelog.test.ts` (part of `npm run check`) fails when the newest changelog
release is not the `package.json` version, when versions are not strictly decreasing, when a
release has no date or no item, or when a section name is not one of the six below.

## 2. Which number to bump

The project is in `0.x`: the public API is the game the players see and the network protocol.

| The change … | Bump | Example |
|---|---|---|
| breaks compatibility: `PROTOCOL_VERSION` changes, or old host snapshots / stored settings can no longer be loaded | **minor** while `0.x` (major from `1.0.0` on) | 0.7.3 → 0.8.0 |
| adds a feature or changes visible behavior, compatibly | **minor** | 0.7.3 → 0.8.0 |
| only fixes bugs, texts, styles, performance, refactors without visible change | **patch** | 0.7.3 → 0.7.4 |

`1.0.0` is released only when the user decides so. After `1.0.0`: breaking → major, feature →
minor, fix → patch. A minor or major bump resets the lower numbers to 0.

Several changes in one work session (one branch, not yet merged) share **one** bump: if the
newest changelog release is already part of the unmerged work, add your items to it and raise the
bump only if your change needs a larger one (a patch release that gains a feature becomes a minor
release). Check with `git diff main -- CHANGELOG.md`.

## 3. How to do it

1. Pick the bump (§2). Set the version without creating a git tag:
   `npm version <x.y.z> --no-git-tag-version` (updates `package.json` and `package-lock.json`).
2. Add a release at the top of `CHANGELOG.md`, below the intro, with today's date:

   ```markdown
   ## [0.8.0] - 2026-11-10

   ### Added

   - Short sentence a player understands, with the most important detail.
   ```

3. Use only these sections, in this order, and leave out empty ones: `Added`, `Changed`,
   `Deprecated`, `Removed`, `Fixed`, `Security`.
4. Write items for players and hosts, in English, one sentence each (continuation lines indented
   by two spaces). Mention a protocol change as "(protocol version N)". Inline code in backticks is
   shown as code; other Markdown (links, bold) is shown as plain text.
5. Run `npx vitest run src/ui/changelog` (or `npm run check`).

Never edit the items of releases that are already merged to `main`, except to fix a typo.
