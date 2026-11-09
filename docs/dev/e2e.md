# End-to-end tests (Playwright, `e2e/`)

Several browser contexts (one per player, each with its own `localStorage`) play through the real
UI over real WebRTC, using a local signaling relay instead of public Nostr relays.

## 1. Setup and running

```sh
npx playwright install chromium        # once
npm run e2e                            # all specs (several minutes)
npx playwright test e2e/game.spec.ts   # one spec
npx playwright test -g "fits phone"    # tests whose title matches
```

- Use an installed Chromium instead: `WEBSKAT_CHROMIUM=/path/to/chromium npm run e2e`.
- In sandboxed shells Chromium may need to run unsandboxed (its single-instance socket is
  blocked); normal machines do not need this (`decisions.md` I86).
- Port 5173 (app) and 8787 (relay) must be free, or already serve this project (outside CI the
  servers are reused).

## 2. Configuration (`playwright.config.ts`)

- `webServer`: `node scripts/relay.mjs` (port 8787) and
  `npx vite --port 5173 --strictPort` with `VITE_SIGNALING=ws-relay`,
  `VITE_RELAY_URL=ws://localhost:8787`.
- Chromium only, `workers: 1`, not parallel, test timeout 240 s (long specs raise it with
  `test.setTimeout`), `expect` timeout 15 s.
- Launch arg `--disable-features=WebRtcHideLocalIpsWithMdns` (local WebRTC between contexts).
- `trace: 'retain-on-failure'`: on failure open the trace with
  `npx playwright show-trace test-results/<test>/trace.zip`.
- `tsconfig.e2e.json` types and lints the e2e code like the app code (`npm run check` covers it).

## 3. Specs

| Spec | Scenario | Duration |
|---|---|---|
| `game.spec.ts` (A) | Host + 2 players: create, join by key, start, robots play one game; all three see the same result and one history row | ~1.5 min |
| `geberskat.spec.ts` (B) | Public table found in the list by a 4th player; 4 players; the dealer sits out; after Continue the next game has another dealer/sitter | ~3.5 min |
| `reconnect.spec.ts` (C) | Client reload mid-game gets seat and hand back; start page goes back to the stored table; host reload resumes and clients reconnect to the same game; a client that leaves the lobby disappears from the host's seats | — |
| `layout.spec.ts` (D) | Offline `#/dev/local?seed=6&bots=easy` at 7 viewports; checks every phase (§5) | — |
| `replace.spec.ts` | Host replaces a player who is gone by a waiting player (Players dialog, `replace-with`); a disconnected player takes its seat back through the invite link from Players | ~40 s |

## 4. Helpers (`e2e/helpers.ts`, `e2e/robot.ts`)

- `newPlayer(browser, name)`: new context, opens `/#/`, fills "Your name".
- `createTable(page, {tableName?, isPublic?})` → key text `ABCD-EFGH`; `joinTable(page, key)`;
  `startGame(host)`; `waitForHand(page)` (10 cards); `handCards(page)`; `storageKey`,
  `hasHostSnapshot`; `closeAll(players)`.
- Robot clicker `robotStep(page)`: takes the first option the page offers, in this order:
  Continue (if allowed), `pickup`, `play-hand`, discard (select two cards, then
  `discard-submit`), declare (first enabled `declare-option-*`, then `declare-submit`),
  `bid-submit` / `bid-hold` / `bid-claim` / `bid-pass`, else the first **enabled** `hand-card-*`
  (illegal cards are disabled buttons).
  It needs no rule knowledge: the engine decides what is enabled.
- `playUntilResult(pages)` loops the robots until every page shows `result-dialog`;
  `continueAfterResult(pages)` presses Continue everywhere.
- Hand cards overlap: click the visible **left** part, `position: { x: 6, y: 40 }` (`decisions.md`
  I69, I88). A click on the center hits the next card.
- Labels and regexes are English (`getByLabel('Your name')`, `/Sitting out: …/`). They rely on a
  non-German browser locale; a `de*` locale would switch the UI to German.

## 5. Layout test details (`layout.spec.ts`)

Viewports: 360×640, 390×844, 844×390, 640×360, 768×1024, 1280×720, 1920×1080 (width ≤ 900 also
gets `isMobile` + `hasTouch`). The test opens `#/dev/local?seed=6&bots=easy`, presses Start, wins
the bidding (with seed 6 an easy bot always passes, because the fixed seed restarts the bot RNG on
each bot turn), picks up, discards (12 cards), declares, and plays. In each phase it asserts:

- no page scroll (`scrollHeight ≤ innerHeight + 1`, same for width);
- every `hand-card-*`, `opponent-seat`, `trick-area`, `status-line`, `phase-panel` box is inside
  the viewport;
- hand card width ≥ 60 px when `min(width, height) ≤ 480`, and ≤ 104 px always;
- saves `test-results/layout-<viewport>-<phase>.png` for review by eye.

If you change the seed logic, the bot RNG or `#/dev/local`, re-check that seed 6 still lets the
viewer win the bidding.

## 6. Test ids (`data-testid`, keep this list in sync with the code)

| Screen | Ids |
|---|---|
| Home | `create-table`, `join-key-input`, `join-invite-input`, `join-submit`, `public-table`, `public-join` |
| Table screen / TopBar | `connection-banner`, `connection-status`, `open-stats`, `open-players`, `open-settings`, `leave-table`, `retry-join` |
| Players dialog | `players-dialog`, `players-row-<i>`, `replace-<i>`, `replace-with`, `replace-level`, `replace-confirm`, `players-kick-<i>`, `reinvite-<i>`, `invite-code`, `invite-link`, `players-pending`, `players-abort-game` |
| Lobby | `table-key`, `seat-<i>`, `bot-level-<i>`, `rule-ramsch`, `add-bot`, `start-game` |
| Game | `opponent-seat`, `trick-area`, `trick-slot-left`, `trick-slot-right`, `trick-slot-bottom`, `trick-dismiss`, `last-trick`, `status-line`, `bid-summary`, `bid-bubble-left`, `bid-bubble-right`, `bid-bubble-bottom`, `sitting-out`, `sitting-out-you`, `phase-panel`, `hand-card-<CardId>`, `abort-game` (host, player on turn disconnected) |
| Bidding | `bid-submit`, `bid-hold`, `bid-claim`, `bid-pass`, `bid-current`, `bid-turn` |
| Skat / declare | `pickup`, `play-hand`, `discard-submit`, `declare-option-0..5` (♣ ♠ ♥ ♦ Grand Null), `declare-submit` |
| Result | `result-dialog`, `continue` |
| Stats / settings | `stats-tab-standings`, `stats-tab-history`, `stats-tab-charts`, `history-row`, `setting-trick-display`, `setting-bid-bubble` |

Find them all: `grep -rhoE 'data-testid=(\{`[^`]*`\}|"[^"]*")' src | sort -u`.

## 7. Writing a new e2e test

1. Prefer a unit or component test; use e2e only for multi-browser flows, real networking,
   reloads, or layout.
2. Reuse `helpers.ts` and `robot.ts`; add new shared steps there.
3. Address elements by `data-testid` (add one in the component if needed and list it in §6).
4. Wait with `expect(...).toBeVisible()` / `toHaveCount()`, not fixed sleeps.
5. Close every context in `finally` (`closeAll`).
6. Run the spec alone, then the whole suite, then `npm run check` (lint covers `e2e/`).
