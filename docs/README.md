# WebSkat documentation: start here

These docs describe the **current** implementation: what the code does, why, and where it lives.
The original phase plan is archived in `history/`; it is no longer a to-do list.

Read `../AGENTS.md` first (hard rules and commands). Then use the tables below to pick only the
files you need for your task.

## 1. Map of the docs

| File | Answers |
|---|---|
| `overview.md` | What the app is, feature list, what is out of scope, project status, glossary |
| `tech-stack.md` | Libraries and versions, config files, npm scripts, env variables |
| `architecture.md` | Layers, import rules, purity, data flow of a move, time/randomness, error handling |
| `hidden-information.md` | Trust model and **who may see which card** (the security boundary) |
| `skat-rules.md` | **Rules and scoring. Single source of truth.** Worked examples = test vectors |
| `engine.md` | `src/engine`: types, state machine, reducer, module API |
| `table.md` | `src/table`: table state, commands, seating, dealer rotation, records, views |
| `bots.md` | `src/table/bot/`: bot levels easy/normal/strong, algorithms, constants |
| `networking.md` | `src/net`: transport, protocol messages, host/client controllers, lobby, keys |
| `ui.md` | `src/ui`: routes, screens, stores, persistence, settings, i18n, components |
| `ui-game-screen.md` | The in-game screen: layout, phase panels, trick display, result dialog |
| `statistics.md` | Game records, score deltas, aggregations, the Stats dialog |
| `assets.md` | Card sprites, generated images, logo |
| `deployment.md` | Build, hosting, signaling relay, TURN, privacy notes |
| `decisions.md` | Decision log (D = planning, Q = open questions, I = implementation). **Append here** |
| `dev/workflow.md` | **How to make a change**, step by step, with cross-layer checklists |
| `dev/testing.md` | Unit, property and component tests: where they are, helpers, how to write and run them |
| `dev/e2e.md` | Playwright end-to-end tests: setup, specs, robot clicker, test ids |
| `dev/debugging.md` | Fixing bugs: reproduce, locate the layer, common pitfalls, dev tools |
| `dev/docs-maintenance.md` | Which doc owns which fact; how to keep docs in sync |
| `history/` | Archived plan (`implementation-plan.md`, phases 0–14) and the Phase 12 spec |

Each source folder also has an `AGENTS.md` with its rules and a **file map** (one line per file):
`src/engine/AGENTS.md`, `src/table/AGENTS.md`, `src/net/AGENTS.md`, `src/ui/AGENTS.md`,
`e2e/AGENTS.md`.

## 2. Which files to read for a task

| Task | Read (in this order) |
|---|---|
| Change a Skat rule or the scoring | `skat-rules.md`, `engine.md`, `src/engine/AGENTS.md`, `dev/testing.md` |
| Change table behavior (seats, dealer, ready, kick, bots joining) | `table.md`, `src/table/AGENTS.md` |
| Add or change a command or a view field | `dev/workflow.md` §4, `table.md`, `networking.md` §3, `hidden-information.md`, skill `change-protocol` |
| Change bot behavior or strength | `bots.md`, `src/table/AGENTS.md` |
| Change networking, joining, reconnect | `networking.md`, `src/net/AGENTS.md` |
| Change a screen, a button or a text | `ui.md`, `src/ui/AGENTS.md`, `ui-game-screen.md` (in-game) |
| Change the in-game layout (phones, desktop) | `ui-game-screen.md` §2, `dev/e2e.md` §5 (layout test) |
| Change statistics | `statistics.md` |
| Fix a bug | `dev/debugging.md`, then the layer doc |
| Write or fix tests | `dev/testing.md`, `dev/e2e.md` |
| Deploy | `deployment.md` |
| Finish any change | `dev/docs-maintenance.md` |

## 3. Conventions in these docs

- `§N` means section N of the named file. Code comments cite rules as `skat-rules §N`; **never
  renumber the sections of `skat-rules.md`**.
- Paths are relative to the repository root.
- "Must" is a hard requirement (tests or lint enforce it). "Currently" marks a known limitation of
  the implementation, not the intended final state.
- If a doc and the code disagree, do not guess. For rules and scoring, `skat-rules.md` is right and
  the code is wrong. For everything else, check the tests, fix the side that is wrong, and note the
  fix in `decisions.md`.
