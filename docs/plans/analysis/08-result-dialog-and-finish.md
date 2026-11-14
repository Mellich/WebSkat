# Step 08: "Analyze game" in the result dialog, e2e, docs, changelog

**Kind:** feature + cleanup. **Layers:** ui, e2e, docs. **Protocol:** no. **Needs:** steps 01–07.

## Read first

- `docs/ui-game-screen.md` §7 (result dialog), `src/ui/game/ResultDialog.tsx`,
  `src/ui/game/ResultDialog.test.tsx` (the "show all cards" tests around lines 210–235)
- `docs/dev/e2e.md`, `e2e/AGENTS.md`, `e2e/game.spec.ts`, skill `e2e-tests`
- `docs/dev/docs-maintenance.md` §3, `docs/dev/versioning.md`

## 1. Result dialog

In `src/ui/game/ResultDialog.tsx`:

- Remove the imports of `AllCards` and `revealedHands`.
- `const analysis = analysisInputFromView(view);` (from `../../table`).
- In `shell`, replace `allCards` by
  ```tsx
  analysis: analysis === null ? null : (
    <button type="button" onClick={() => { openAnalysis(analysis); }} data-testid="open-analysis">
      {t('result.analyze')}
    </button>
  ),
  ```
  (`openAnalysis` from `../analysis/link`). Rename the `Shell` prop `allCards` → `analysis` and
  update its doc comment ("The 'Analyze game' button, or null while the game is not finished").
- The button is shown for every finished game that carries the dealt hands (played, Ramsch,
  passed in) – the same condition as the old button.

i18n (`src/ui/i18n/parts/enGame.ts` / `deGame.ts`):

- add `result.analyze`: Analyze game / Spiel analysieren
- remove `result.showAllCards` and `result.hideAllCards` (check with
  `grep -rn "showAllCards\|hideAllCards" src` that nothing else uses them). Keep `result.skat`
  (still used in the dialog).

Delete (look at each file first; they are used only by the old button):
`src/ui/game/AllCards.tsx`, `AllCards.module.css`, `AllCards.test.tsx`, `revealedHands.ts`,
`revealedHands.test.ts`.

### Tests first: `src/ui/game/ResultDialog.test.tsx`

Replace the two "show all cards" tests:

1. No finished game (`initialHands: null`) → `queryByTestId('open-analysis')` is null.
2. Finished game → the button exists; with `const open = vi.spyOn(window, 'open').mockReturnValue(null)`
   a click calls `open` once with a URL containing `#/analysis?g=`, `'_blank'` and `'noopener'`;
   `decodeAnalysis` of the `g` parameter gives the names of the fixture players. Restore the spy
   in `afterEach`.

The fixture `finishedGameFixture` (`src/ui/game/viewFixtures.ts`) must yield a valid analysis
input: 30 distinct dealt cards, a Skat, `tricks` that replay legally. If it does not, either make
the fixture consistent (preferred: build it from a real finished game) or assert only on the URL
prefix and test decoding in `link.test.ts`. `analysisInputFromView` itself does not validate; the
analysis tab validates.

Run: `npx vitest run src/ui/game`

## 2. E2E

Extend `e2e/game.spec.ts` (scenario A already plays one full game) after the result checks:

```ts
// The analysis (docs/ui.md §analysis) opens in a new tab and replays the game.
const hostPage = host.page;
const [analysis] = await Promise.all([
  hostPage.context().waitForEvent('page'),
  hostPage.getByTestId('open-analysis').click(),
]);
await analysis.waitForLoadState();
await expect(analysis.getByTestId('analysis-screen')).toBeVisible();
await expect(analysis.getByTestId('analysis-deal')).toContainText('Anna');
// a passed-in game has no replay board; the robot game may end passed in
if (await analysis.getByTestId('analysis-board').count() > 0) {
  await analysis.getByTestId('analysis-forward').click();
  await expect(analysis.getByTestId('analysis-trick')).not.toBeEmpty();
  await expect(analysis.locator('[data-testid^="analysis-score-"]').first()).toBeVisible({ timeout: 15_000 });
}
await analysis.close();
```

Adapt to the helpers in `e2e/helpers.ts` (`closeAll` must still close everything; close the
analysis page yourself). If the result of the robot game can be "passed in", keep the `if`.

Run (environment in `docs/dev/e2e.md` §1): `npx playwright test e2e/game.spec.ts`.
Also run `npx playwright test e2e/layout.spec.ts` if you changed any shared CSS.

## 3. Docs (checklist; `docs/dev/docs-maintenance.md` §3)

- `docs/ui-game-screen.md` §7: replace the "Show all cards" paragraph by "Analyze game"
  (`open-analysis`): opens `#/analysis?g=…` in a new tab, shown when the view carries
  `game.initialHands`.
- `docs/ui.md`: the analysis section from steps 05–07 is complete (route, screen, worker).
- `docs/overview.md` §2/§3: feature list gets "game analysis with replay, variants and
  Monte-Carlo card scores"; status line if it lists features by phase.
- `docs/dev/e2e.md`: §6 remove `show-all-cards`, `all-cards`; add `open-analysis` (Result row);
  the scenario A description mentions the analysis tab.
- `docs/dev/testing.md` §4: remove `AllCards`/`revealedHands` tests, list the new ones.
- `src/ui/AGENTS.md` file map: remove `game/AllCards.tsx` and `game/revealedHands.ts` rows.
- `e2e/AGENTS.md`: scenario A row mentions the analysis.
- `docs/README.md` §1 `plans/` row: mention `plans/analysis/` (this plan).
- `docs/plans/analysis/README.md`: add a "Status" line at the top: implemented.
- `docs/decisions.md`: row "'Show all cards' removed" (README §3); make sure the rows of steps
  01–07 exist and have consecutive numbers.

## 4. Changelog

`CHANGELOG.md`, under `## [Unreleased]` (create the section above the newest release if it is
missing; never bump the version):

```markdown
### Added

- Game analysis: "Analyze game" in the result dialog opens a new tab with every player's starting cards and the Skat. Replay the game card by card, see for each playable card how often it wins (sampled play-outs that keep improving), optionally with the real cards of the others, and try other cards to explore variants.

### Changed

- "Show all cards" in the result dialog is replaced by the game analysis.
```

## Done when

- `npm run check` green; `npx playwright test e2e/game.spec.ts` green; `npm run build` green.
- Manual check from README §6 done (or say in the report that it was not done and why).
- Report: changed and deleted files, checks with results, what was not verified.
