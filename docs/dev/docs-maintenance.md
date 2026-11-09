# Keeping the documentation up to date

The docs describe the **current** behavior. A change is not finished until the docs match it.
Update them in the same change, not later.

## 1. Which file owns which fact

Write each fact in **one** place and link to it from elsewhere.

| Fact | Owner |
|---|---|
| Skat rules, bid values, scoring formulas and vectors | `docs/skat-rules.md` |
| Engine types, reducer, error codes | `docs/engine.md` |
| Table state, commands, seating, rotation, records, view fields | `docs/table.md` |
| Who may see which card | `docs/hidden-information.md` |
| Bot algorithms and constants | `docs/bots.md` (numbers: `src/table/bot/tuning.ts`) |
| Messages, `PROTOCOL_VERSION`, host/client behavior, lobby, keys | `docs/networking.md` |
| Routes, screens outside the game, stores, settings, storage keys, i18n | `docs/ui.md` |
| In-game layout, phase panels, trick display, result dialog | `docs/ui-game-screen.md` |
| Records and statistics | `docs/statistics.md` |
| Dependencies, scripts, configs | `docs/tech-stack.md` |
| Build, hosting, env variables | `docs/deployment.md` (+ user summary in `README.md`) |
| Test helpers and test inventory | `docs/dev/testing.md` |
| e2e specs, helpers, **test ids** | `docs/dev/e2e.md` |
| Development process | `docs/dev/workflow.md` |
| Versioning rules | `docs/dev/versioning.md` |
| What changed in which version | `CHANGELOG.md` (version itself: `package.json`) |
| File list of a source folder | that folder's `AGENTS.md` ("File map") |
| Decisions and deviations | `docs/decisions.md` |
| Project status and open items | `docs/overview.md` §2 |
| Hard rules and commands | root `AGENTS.md` |

## 2. Rules

1. **Current state, plain words.** Describe what the code does now. No "will", no "Phase N
   should". Mark limitations with "currently".
2. **Be precise.** Use exact names (files, functions, fields, test ids, i18n keys) so a reader can
   grep them. Give values and defaults.
3. **One concept per file**, short sections, tables for lists. Keep files readable in one pass.
4. **Never renumber `skat-rules.md` sections**: code cites them (`skat-rules §10.7`). Add new
   sections at the end of a chapter.
5. Do not change rule numbers in `skat-rules.md` unless the user asks.
6. `docs/history/` is frozen. Do not update it.
7. `docs/decisions.md` is append-only: new row with the next `I` number; mark replaced rows
   *Superseded by I…*.
8. When you add, rename or delete a source file, update the folder's `AGENTS.md` file map.
9. When you add or rename a `data-testid`, update `docs/dev/e2e.md` §6.
10. When you change user-visible behavior, also check `README.md` ("How to play", settings,
    deployment) and the About dialog text (`about.*` keys).
11. Code comments may cite docs as `docs/<file>.md` or `skat-rules §N`. If you rename a doc,
    update the citations: `grep -rn "docs/" src e2e scripts`.

## 3. Checklist after a change

- [ ] Layer doc(s) updated (§1 table).
- [ ] `hidden-information.md` if a view or message changed.
- [ ] `networking.md` §1 if `PROTOCOL_VERSION` changed.
- [ ] Folder `AGENTS.md` file map if files were added/removed/renamed.
- [ ] `dev/e2e.md` §6 if test ids changed; `dev/testing.md` §4 if a new test file was added.
- [ ] `overview.md` §2 if an open item was closed or a new limitation appeared.
- [ ] `decisions.md` row for every decision.
- [ ] Version bumped in `package.json`/`package-lock.json` and a matching release at the top of
      `CHANGELOG.md` (`dev/versioning.md`) for every code change.
- [ ] `README.md` for user-visible changes.
- [ ] Links still point to existing files: `grep -rnoE 'docs/[a-z/-]+\.md' AGENTS.md src e2e docs | sort -u` and check each exists.
