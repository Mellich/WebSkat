# Plan 01: Result dialog follows the scoring setting; standard scoring by default

User request: *"The result dialog shows only the standard score, even when Seeger scoring is
selected. Also show default score in statistics by default."*

Read first: `docs/ui-game-screen.md` §7, `docs/statistics.md`, `docs/ui.md` §5–§6,
`src/ui/AGENTS.md`.

## 1. Current state

- `src/ui/game/ResultDialog.tsx` (99 lines) renders the score table from the **engine** result:
  `p.id === result.declarerId ? result.declarerScore : 0` (around line 68). That is always the
  standard score (`skat-rules §10.5`); Seeger deltas are never shown.
- Both score systems already exist per game in the `GameRecord`
  (`record.scores.standard[playerId]`, `record.scores.seeger[playerId]`, built by
  `src/table/records.ts`). The UI holds all records of the table in `useSession((s) => s.records)`
  (`src/ui/store/session.ts`). The host broadcasts the record **before** the view of the finished
  game (`src/net/host.ts` `handleCommand`), so the record is available when the dialog opens.
- The chosen system is the setting `scoring` (`src/ui/persist/settings.ts`, default `'seeger'`),
  shared by the Settings dialog and the Stats dialog toggle (`src/ui/stats/StatsPanel.tsx`).
- `signed(value)` (`src/ui/stats/gameLabel.ts`) formats deltas as `+96` / `−54` / `0`.

## 2. Decisions (log them in `docs/decisions.md`)

1. *Result dialog scores*: the dialog shows the delta of the **selected** scoring system for every
   seated player, taken from the game's `GameRecord` (matched by `record.number === game.number`).
   If the record has not arrived yet, the cells show `…`. No protocol change.
2. *Default scoring*: "show default score in statistics by default" is read as: the default value
   of the `scoring` setting becomes `'standard'` (it was `'seeger'`, decision D5). It applies to the
   statistics and the result dialog alike, because both use the same setting. Settings that are
   already stored keep their value (they cannot be told apart from a deliberate choice). Mark D5 in
   `decisions.md` with *"Default display superseded by I…"* (do not delete or renumber D5).

## 3. Steps

### Step 1: default scoring = standard

- `src/ui/persist/settings.ts`: in `defaultSettings`, `scoring: 'standard'`.
- Test (`src/ui/persist/persist.test.ts`): add `it('uses standard scoring by default')` →
  `expect(defaultSettings('en').scoring).toBe('standard')`. The existing round-trip test still uses
  `'standard'` explicitly; change it to `'seeger'` so it still proves that a non-default value
  round-trips.
- Run: `npx vitest run src/ui/persist/persist.test.ts`.

### Step 2: ResultDialog takes the record and the scoring system

- Test first: new file `src/ui/game/ResultDialog.test.tsx` (`// @vitest-environment jsdom`, see
  `BiddingPanel.test.tsx` for the style). Build a `TableView` by hand (3 players `a`, `b`, `c`,
  `you.id = 'a'`, `game` can be a minimal object or `null`; the dialog reads `view.table.players`,
  `view.table.readyIds`, `view.you.id`, `view.game?.skat`, `view.game?.discarded`). Use a
  `ViewResult` like `DIAMONDS_LOST` from `src/table/fixtures.ts` (copy the fields, replace
  `declarer` by `declarerId: 'a'`). Build a `GameRecord` with
  `scores: { standard: { a: -54, b: 0, c: 0 }, seeger: { a: -104, b: 40, c: 40 } }`.
  Cases:
  1. `scoring="seeger"` → the table shows `−104`, `+40`, `+40` and the caption names
     "Seeger–Fabian".
  2. `scoring="standard"` → `−54`, `0`, `0` and the caption names "Standard".
  3. `record={null}` → every score cell shows `…`.
  4. Passed-in result → "Everybody passed" text, no score table (unchanged behavior).
- `src/ui/game/ResultDialog.tsx`:
  - New props: `readonly record: GameRecord | null; readonly scoring: 'seeger' | 'standard';`
  - Score cell: `record === null ? '…' : signed(record.scores[scoring][p.id] ?? 0)` (import
    `signed` from `../stats/gameLabel`).
  - Caption: `t('result.changeIn', { system: scoring === 'seeger' ? t('stats.seeger') : t('stats.standard') })`.
  - Remove the use of `result.declarerScore` in the table.
- i18n (`src/ui/i18n/en.ts` and `de.ts`): add `result.changeIn`: "Score change ({system})" /
  "Punkteänderung ({system})". Remove `result.change` if nothing else uses it
  (`grep -rn "result.change'" src`).
- Run: `npx vitest run src/ui/game/ResultDialog.test.tsx`.

### Step 3: GameScreen passes record and scoring

- `src/ui/game/GameScreen.tsx`: read
  `const records = useSession((s) => s.records);` (import from `../store/session`) and
  `const scoring = useSettings((s) => s.scoring);`. Compute
  `const record = records.find((r) => r.number === game.number) ?? null;` and pass
  `record={record} scoring={scoring}` to `<ResultDialog>`.
- GameScreen must stay < 300 lines (it is ~246 now; this adds ~4).

### Step 4: docs

- `docs/ui-game-screen.md` §7: replace the "Score table … **standard** delta … does not follow the
  Seeger/standard setting" bullet with: one row per seated player with the delta of the selected
  scoring system (setting `scoring`), taken from the game's `GameRecord` in the session store;
  `…` until the record has arrived; the caption names the system.
- `docs/statistics.md` §3: last paragraph ("The result dialog does not use these components") →
  add that it shows the record's delta for the selected system.
- `docs/ui.md` §6: `scoring` default `standard`.
- `docs/skat-rules.md` §10.6, last sentence: "(default: Seeger–Fabian)" → "(default: standard,
  `decisions.md` I…)". Do not change any number or section number.
- `docs/overview.md` §2: delete the row "Seeger score in the result dialog".
- `docs/dev/testing.md` §4 UI row: add `ResultDialog` to the component test list.
- `docs/decisions.md`: the two rows from §2, and the D5 note.

## 4. Validation

- `npm run check` green.
- `npx playwright test e2e/game.spec.ts` (the result dialog is part of the flow; its test ids did
  not change).
- Manual (optional): `npm run dev`, `#/dev/local?seed=6&bots=easy`, play a game, toggle the scoring
  in Settings while the result dialog is open: the numbers change.

## 5. Pitfalls

- Do **not** compute Seeger numbers in the UI. They come from the record (`src/table/records.ts`).
- `view.table.players` may contain a player who joined after the deal only after the next deal, so
  `record.scores[...]` has every seated player of that game; use `?? 0` for safety.
- The Stats panel toggle and the Settings radio already write the same setting; no change needed
  there.
