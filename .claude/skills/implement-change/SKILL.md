---
name: implement-change
description: Step-by-step checklist for implementing a feature or behavior change in WebSkat (engine, table, net, ui), test-first and bottom-up, ending with green checks and updated docs. Use for any "add", "change", "make it so that" request in this repo.
---

# Implement a change in WebSkat

Full guide: `docs/dev/workflow.md`. Hard rules: `AGENTS.md` §3.

## 1. Understand (do not skip)

1. `node -v` ≥ 22.12; `npm install` if `node_modules/` is missing.
2. Open `docs/README.md` §2 and read only the docs listed for this task.
3. Read the `AGENTS.md` of each folder you will touch (file map + rules).
4. Decide the **lowest layer** that must change:
   - legality, bidding, scoring → `src/engine`
   - seats, dealer, ready, kick, records, what a player sees, bots → `src/table`
   - messages, joining, reconnect, lobby list → `src/net`
   - screens, texts, layout, settings, storage → `src/ui`
5. Conflict with `docs/skat-rules.md` or a hard rule → ask the user. Ambiguous → choose the
   simplest option and add a row to `docs/decisions.md`.

## 2. Test first

1. Add or change a test in the lowest layer (helpers: `docs/dev/testing.md` §3).
2. Run it and see it fail: `npx vitest run <file>`.

## 3. Implement bottom-up

engine → table → net → ui. For cross-layer changes use the checklists in
`docs/dev/workflow.md` §4. The most common ones:

- New/changed command, action, view field or message → use skill `change-protocol`.
- New visible text → key in `src/ui/i18n/parts/enApp|enGame|enPanels.ts` **and** the matching `de*.ts` part; use `t('key')`.
- New setting → `src/ui/persist/settings.ts` (`.default()`), `SettingsDialog.tsx`, i18n, test.
- New clickable element → enable it only from `view.game.legal` / view data; add `data-testid`.
- `TableState` shape change → migrate old host snapshots in `src/ui/persist/hosted.ts`.

Keep: pure engine/table (no `Date`, `Math.random`, DOM, `console`), immutable updates, `Result`
instead of throw, exhaustive `switch` + `assertNever`, no `any`/`@ts-ignore`/eslint-disable,
files < 300 lines, new file → line in the folder `AGENTS.md` file map.

## 4. Verify

1. Targeted tests pass.
2. `npm run check` green (skill `run-checks` for failures).
3. UI flow, layout, test ids or networking changed → `npm run e2e` (skill `e2e-tests`).
4. Visible change → look at it: `npm run dev`, `#/dev/local?seed=1` (add `&players=4` for
   Geberskat), phone (360×640) and desktop size.

## 5. Finish

1. Docs updated (skill `update-docs`).
2. Decisions logged in `docs/decisions.md`.
3. `CHANGELOG.md` entry added under `## [Unreleased]` (`docs/dev/versioning.md`); no version bump;
   then `npm run check` again. On a release request: `docs/dev/versioning.md` §4.
4. Report: what changed, files, tests run + results, what was not verified.
5. No commit/push/branch unless asked (a release request allows the release script's commit, tag and gh-pages push). Never touch `assets/`.
