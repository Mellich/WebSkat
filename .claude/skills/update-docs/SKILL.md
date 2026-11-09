---
name: update-docs
description: Bring WebSkat's documentation (docs/, AGENTS.md files, README) in sync after a code change - find the owning doc for each changed fact, write current-state text, update file maps, test ids and the decision log. Use at the end of every change or when docs and code disagree.
---

# Update the documentation

Rules and the full ownership table: `docs/dev/docs-maintenance.md`.

## 1. List what changed

From your diff (`git diff --stat`, `git status`), write down each changed **fact**: behavior,
rule, command, view field, message, setting, storage key, text, test id, file added/removed,
dependency, script, open item.

## 2. Update the owner of each fact

| Fact | File |
|---|---|
| rules / scoring numbers (only if the user asked) | `docs/skat-rules.md` (never renumber sections) |
| engine API, reducer, error codes | `docs/engine.md` |
| table state, commands, rotation, records, view fields | `docs/table.md` |
| who sees which card | `docs/hidden-information.md` |
| bots | `docs/bots.md` |
| protocol, `PROTOCOL_VERSION`, host/client | `docs/networking.md` |
| routes, screens, stores, settings, storage, i18n | `docs/ui.md` |
| in-game layout and panels | `docs/ui-game-screen.md` |
| statistics | `docs/statistics.md` |
| deps, scripts, configs | `docs/tech-stack.md` |
| build, hosting, env | `docs/deployment.md` + `README.md` |
| test helpers / new test areas | `docs/dev/testing.md` |
| e2e specs, test ids | `docs/dev/e2e.md` (§6 ids) + `e2e/AGENTS.md` |
| files in a folder | that folder's `AGENTS.md` file map |
| process / hard rules | `docs/dev/workflow.md`, root `AGENTS.md` |
| status, open items, limitations | `docs/overview.md` §2 |
| decisions, deviations | `docs/decisions.md` (append row, next `I` number) |
| what changed in this version | `CHANGELOG.md` + version in `package.json` (`docs/dev/versioning.md`) |

## 3. How to write

- Current state, present tense; no "will" or "Phase N should". Mark limitations "currently".
- Exact names (files, functions, fields, ids, i18n keys) and values/defaults.
- Short sections and tables. One fact in one place; link elsewhere.
- Do not edit `docs/history/` (frozen). Do not delete decision rows; mark them superseded.

## 4. Check

- Code changed → the version is bumped and `CHANGELOG.md` has a matching release at the top
  (`docs/dev/versioning.md`); `npx vitest run src/ui/changelog` passes.
- Links point to existing files:
  `grep -rnoE 'docs/[a-zA-Z/.-]+\.md' AGENTS.md src e2e docs .claude | sort -u` and check each path.
- Test ids in `docs/dev/e2e.md` §6 match
  `grep -rhoE 'data-testid=(\{`[^`]*`\}|"[^"]*")' src | sort -u`.
- File maps list every non-test file of the folder (`ls src/<folder>`).
- If code comments changed, run `npm run check`.
