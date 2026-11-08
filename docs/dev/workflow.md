# Development workflow: how to make a change

Follow these steps for every feature, change or fix. Skills in `.claude/skills/` hold the same
steps as short checklists (`implement-change`, `fix-bug`, `write-tests`, `run-checks`,
`e2e-tests`, `change-protocol`, `update-docs`).

## 1. Before you write code

1. Run `node -v` (≥ 22.12). If `node_modules/` is missing, run `npm install`.
2. Read `AGENTS.md` (hard rules), `docs/README.md` §2 (which docs to read for your task), and the
   `AGENTS.md` of every folder you will touch.
3. Find the layer the change belongs to:

| The change is about … | Layer | Main files |
|---|---|---|
| a Skat rule, legality, scoring, bidding | `src/engine` | `bidding.ts`, `trump.ts`, `play.ts`, `scoring.ts`, `values.ts`, `game.ts` |
| seats, dealer, ready, kick, pending, records, what a player sees | `src/table` | `table.ts`, `seating.ts`, `rotation.ts`, `records.ts`, `view*.ts` |
| bot decisions | `src/table/bot/` | `auction.ts`, `heuristics.ts`, `strong.ts`, `tuning.ts` |
| statistics numbers | `src/table` | `stats.ts` |
| messages, joining, reconnect, lobby list | `src/net` | `host.ts`, `client.ts`, `protocol.ts`, `schema*.ts` |
| screens, buttons, texts, layout, settings, storage | `src/ui` | `screens/`, `game/`, `components/`, `i18n/`, `persist/` |

   Rule of thumb: if the answer to "is this move allowed / what is the score" changes, it is
   engine or table code, never UI code.
4. If the request conflicts with `skat-rules.md` or a hard rule, ask the user. If something is
   ambiguous, pick the simplest option and write it into `docs/decisions.md`.

## 2. Implement (bottom-up, tests first)

1. **Write or change a test first** in the lowest affected layer (`dev/testing.md`). Run it and see
   it fail: `npx vitest run path/to/file.test.ts`.
2. Implement in the lowest layer, then go up: engine → table → net → ui. Each layer only calls the
   one below through its `index.ts`.
3. Keep the rules of `AGENTS.md` §3: pure engine/table, immutable state, no `any`, no
   `@ts-ignore`, exhaustive `switch` with `assertNever`, `Result` instead of throwing, zod for
   network/stored data, `t()` for every visible string, files < 300 lines.
4. Run the tests of the files you touched until they pass.

## 3. Verify

1. `npm run check` (typecheck + lint + all unit tests, ~30 s). It must be green. Fix every error;
   never silence a lint rule.
2. Run `npm run e2e` (several minutes) when you changed: UI flows or test ids, the game screen
   layout or CSS, the protocol, host/client, joining or reconnecting. Run a single spec while
   working: `npx playwright test e2e/layout.spec.ts` (`dev/e2e.md`).
3. For visible changes, look at the result: `npm run dev`, open `#/dev/local` (offline: you + 2
   bots; `?seed=N` repeats a deal, `?players=4` for Geberskat, `?bots=easy`), or `#/dev/gallery`.
   Check a phone size (360×640) and a desktop size.

## 4. Cross-layer checklists

**New or changed `GameAction`** (engine): `types.ts` → reducer branch in `game.ts` →
`getLegal`/`enumerateActions` → engine tests (+ fuzz still green) → `GameActionSchema` in
`src/net/schemaGame.ts` → `PROTOCOL_VERSION` +1 → bots must still choose legal actions
(`levels.test.ts`) → UI button driven by `legal` → i18n → docs `engine.md`.

**New or changed `TableCommand`**: `TableCommand` in `src/table/types.ts` → case in
`applyCommand` (`table.ts`) with errors as `TableErrorCode` → `table.test.ts` →
`TableCommandSchema` → `PROTOCOL_VERSION` +1 → `protocol.test.ts` → UI sends it via
`connection.send` → `error.<CODE>` texts in `en.ts` and `de.ts` → docs `table.md` §3,
`networking.md` §3. Skill: `change-protocol`.

**New or changed view field**: `viewTypes.ts` → `view.ts` / `viewGame.ts` (decide who may see it;
`hidden-information.md` §5) → `view.test.ts` (+ redaction oracle if it holds cards) →
`schemaView.ts` → `PROTOCOL_VERSION` +1 → UI reads it → docs `table.md` §6.

**Changed `TableState` shape**: also handle old host snapshots in `src/ui/persist/hosted.ts`
(migration + `hosted.test.ts`), because hosts resume from `localStorage`.

**New setting**: `SettingsSchema` + `defaultSettings` (`src/ui/persist/settings.ts`; give new
fields a `.default()` so old stored settings still parse) → control in `SettingsDialog.tsx` →
i18n → `persist.test.ts` → `ui.md` §6.

**New visible text**: key in `src/ui/i18n/parts/enApp|enGame|enPanels.ts` **and** the matching `de*.ts` part (typecheck fails otherwise),
use `t('key', {param})`. Game terms: German names in `de.ts` (Reizen, Weg, Drücken, …).

**New interactive element used by tests**: stable `data-testid` (kebab-case) → list in
`dev/e2e.md` §6.

**New file**: one concept, < 300 lines, test next to it, add a line to the folder's
`AGENTS.md` file map. Export through the folder's `index.ts` only if other layers need it
(test helpers are never exported).

## 5. Finish

1. Update the docs (`dev/docs-maintenance.md`): every fact you changed, in the file that owns it.
2. Append decisions to `docs/decisions.md` (next `I` number).
3. `npm run check` once more after the doc edits if you touched code comments.
4. Report: what changed, which files, which tests ran (and their result), what was not verified.
   Do not claim success without a green `npm run check`.
5. Do not commit, push or create branches unless the user asks. Never touch `assets/`.
