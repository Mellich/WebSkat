> **ARCHIVED.** Detailed spec of Phase 12 (done). Kept for its reasoning. The behavior it describes
> is now documented in `skat-rules.md` §4.1 (strict bidding), `ui-game-screen.md` §2 and §5
> (layout, trick display) and `ui.md` §10 (card chips). Old doc numbers map to new files as listed
> at the top of `history/implementation-plan.md`.

# 13 — Playtest fixes (Phase 12)

Problems found while playing with two humans and one bot. This file is the **detailed spec for
Phase 12** in `08-implementation-plan.md`. It changes four things:

- **F1** Bids must go up one step at a time (18, 20, 22, …), for humans and bots.
- **F2** A finished trick stays on the table for the time set in Settings.
- **F3** The game screen fits phones in portrait and landscape without scrolling, has bigger cards
  there, and stays a sensible size on desktops.
- **F4** Cards mentioned in text (last trick, Skat in the result) are shown as small symbols
  ("♥10") instead of written-out names ("Ten of hearts").

The spec docs (`03`, `04`, `06`, `09`, `12`) are already updated to match. If this file and a spec doc
disagree, the spec doc wins: fix this file.

Work in the order F1 → F2 → F3 → F4. Run `npm run check` after each one.

---

## F1 — Bids go up one step at a time (house rule)

### Problem
`legalBidValues` returns every bid value above `currentBid`. The UI offers a `<select>` with all of
them, and the bot (`src/table/bot.ts`) picks one of the lowest three. So a bot may open with 20 or
22, and a human may jump straight to 30.

### Rule (now in `03-skat-rules.md` §4.1)
The caller's **only** possible bid is the next value in `BID_VALUES`: `18` when `currentBid` is
`null`, otherwise the smallest value `> currentBid`. Nobody can jump. After 264 (the last value) the
caller can only pass. The claim stage is unchanged (forehand claims 18 or passes).

### Tasks
1. `src/engine/bidding.ts`
   - Add `export function nextBidValue(currentBid: number | null): number | null`. It returns
     `BID_VALUES[0]` when `currentBid` is `null`, otherwise the first `BID_VALUES` entry greater than
     `currentBid`, or `null` when there is none.
   - In `applyStage` replace `isRaise(...)` with `action.value === nextBidValue(b.currentBid)`. The error
     stays `ILLEGAL_BID`, with the message "Only the next bid value N is allowed."
   - `legalBidValues(b)` returns `[next]` (or `[]` when `next === null` or it is not a bid
     situation). Keep the return type `number[]`: the protocol (`bidValues` in
     `src/net/schemaView.ts`) and `Legal` stay as they are.
   - Remove `isRaise` if nothing uses it any more.
2. `src/engine/index.ts`: export `nextBidValue`.
3. Tests (`src/engine/bidding.test.ts`):
   - first bid 20 → `ILLEGAL_BID`; first bid 18 → ok;
   - after 18 (held) only 20 is accepted; 22 and 18 are rejected;
   - stage 2 continues from the carried-over value: M:18, F:hold, M:20, F:pass → H may only bid 22;
   - after 264 → `legalBidValues` is `[]`, and pass still works;
   - `nextBidValue` table: null→18, 18→20, 20→22, 22→23, 23→24, 24→27, 27→30, 30→33, 33→35,
     35→36, 36→40, 240→264, 264→null.
   - Change the existing test "requires bids to increase" (it bids 20 first). Move it to the new
     rules.
4. Fix every other test that jumps:
   - `src/engine/game.legal.test.ts` (expects `[...BID_VALUES]` → now `[18]`);
   - `src/table/view.test.ts` (expects length 63 → now 1);
   - scripted, fuzz and table tests that bid more than 18 directly.

   *(Implemented without a helper: the only engine test that needed a higher bid, the scripted
   Null game in `game.scripted.test.ts`, spells out 18, 20, 22, 23 with holds. Add a `bidUpTo`
   helper to `src/engine/testing.ts` if more such tests appear.)* Fixtures that only set `bid: 48` on a finished-game record
   (`src/table/fixtures.ts`) do not need changes.
5. `src/table/bot.ts`: the logic stays as it is (pass with probability 0.6, otherwise bid/hold/claim).
   It becomes the `easy` level in Phase 13 (`14-bots.md`).
   `LOWEST_BIDS` has no effect any more, so delete it. Update the comment and `04` B3 (already done).
   *(Covered in Phase 13 by `src/table/bot/levels.test.ts`: every normal/strong `bid` equals
   `nextBidValue(currentBid)`; easy bots only choose from the legal actions, which contain only
   that value.)*
6. `src/ui/game/BiddingPanel.tsx`: remove the `<select>` and the `chosen` state. When
   `legal.bidValues` has a value `v`, show one button labelled `t('bid.bidValue', { value: v })`
   ("Bid 20" / "Reize 20"), with `data-testid="bid-submit"`. Remove `bid.select` from both i18n files
   if nothing else uses it. Add `bid.bidValue` to `en.ts` and `de.ts`. Update
   `BiddingPanel.test.tsx`.
7. Check `e2e/robot.ts` and `e2e/helpers.ts`: `bid-value` is gone. Use `bid-submit` if a helper
   needs to bid.

**Done when** `npm run check` is green, and in `#/dev/local` the bots always open with 18 and the
panel only offers "Bid N" for the next N.

---

## F2 — A finished trick stays visible for the configured time

### Problem
`src/ui/game/useShownTrick.ts` shows the finished trick for a fixed 1200 ms (`LAST_TRICK_MS`), and
it **drops the display as soon as the next trick has a card**. The host lets the next bot act after
`botDelayMs` (600 ms by default), and right away when a human finished the trick. So when a bot
wins or leads, the trick disappears after 0.6 s or sooner. The only timing setting is the bot delay. When the last trick ends the game,
`ResultDialog` opens at once on top of it.

### Behaviour (now in `06-ui-ux.md` §4 and §7)
- The existing bot-delay setting becomes the **trick display time only**. It is renamed from
  `botDelayMs` to `trickDisplayMs` and gets a 2 s option: `0 | 300 | 600 | 1000 | 2000`, default
  600. Label: "Show finished trick" / "Fertigen Stich zeigen". Options: Off, 0.3 s, 0.6 s, 1 s, 2 s.
- **Bots are no longer delayed.** The host runs bot actions one after another without pauses.
  A trick that is still being played stays visible anyway, so only finished tricks need the hold.
- When a trick is finished, every client shows its cards (winner highlighted) for the full
  `trickDisplayMs` of **that client's** settings, **no matter what happens next**. While it is
  shown:
  - cards of the next trick that arrive meanwhile are **not** drawn yet. They appear when the hold
    ends;
  - the viewer's hand is **paused**: cards look normal (no grey overlay) but cannot be clicked. Any
    pending two-tap selection is cleared;
  - the status line says "{name} takes the trick";
  - tapping or clicking the trick area (or pressing Enter/Space on it) ends the hold early **for
    this viewer only**.
- `trickDisplayMs = 0` ("Off") means no hold: the next trick is shown at once.
- When the finished trick is the last one, `ResultDialog` opens only after the hold ends.
- After a reload or reconnect there is no hold: the current state is shown at once.
- The hold starts when `lastTrick` changes between renders. This works even when React batches
  several quick views (trick finished + bot leads) into one render, because `lastTrick` still
  differs from the one seen before.

### Tasks
1. Settings (`src/ui/persist/settings.ts`, `SettingsDialog.tsx`, i18n)
   - Replace `botDelayMs` with
     `trickDisplayMs: z.union([z.literal(0), z.literal(300), z.literal(600), z.literal(1000), z.literal(2000)]).default(600)`.
     Set the default in `defaultSettings` too.
   - Migration in `loadSettings`: if the stored object has `botDelayMs` (one of 0/300/600/1000) and
     no `trickDisplayMs`, copy the value over before parsing, and drop `botDelayMs`. Tests: an old
     object with `botDelayMs: 1000` loads as `trickDisplayMs: 1000`; an object with neither loads
     with 600.
   - `SettingsDialog.tsx`: the same `<select>` with the 5 options, bound to `trickDisplayMs`, with
     `data-testid="setting-trick-display"`.
   - i18n (`en`/`de`): rename the `settings.botDelay*` keys to `settings.trickDisplay`,
     `settings.trickDisplayOff`, `…Short` (0.3 s), `…Default` (0.6 s), `…Long` (1 s), and add
     `…VeryLong` ("2 s" / "2 s"). Label "Show finished trick" / "Fertigen Stich zeigen". Add
     `trick.takesNow` ("{name} takes the trick" / "{name} bekommt den Stich") and `trick.continue`
     ("Continue" / "Weiter").
2. `src/ui/game/useShownTrick.ts`: rewrite.
   ```ts
   export interface ShownTrick {
     readonly plays: readonly ShownPlay[];
     readonly holding: boolean;        // a finished trick is being held on the table
     readonly winnerId: string | null; // set while holding
     readonly dismiss: () => void;     // ends the hold early (local only)
   }
   export function useShownTrick(game: GameView, displayMs: number): ShownTrick;
   ```
   - Keep the "seen key" logic: a `lastTrick` that is already there on the first render does not
     start a hold.
   - A **new** `lastTrick` key starts a hold that lasts `displayMs` (a `setTimeout`, cleared on
     unmount and on dismiss). With `displayMs <= 0` no hold starts.
   - While holding, return the held trick's plays **even if `game.trick.plays.length > 0`**.
   - Otherwise return the current trick (no winner).
   - Delete `LAST_TRICK_MS`.
   - Tests (`useShownTrick.test.tsx`, fake timers):
     (a) the hold lasts exactly `displayMs`;
     (b) a card of the next trick arriving at 100 ms is not shown until the hold ends;
     (c) a view where `lastTrick` changed **and** the next trick already has a card (batched) still
     holds;
     (d) `dismiss()` ends it at once;
     (e) no hold on the first render;
     (f) a second finished trick during a hold restarts the hold with the new trick;
     (g) `displayMs = 0` never holds.
     *(All seven are covered in `useShownTrick.test.tsx`.)*
3. `src/ui/game/GameScreen.tsx`
   - `const trickDisplayMs = useSettings((s) => s.trickDisplayMs)` →
     `const shown = useShownTrick(game, trickDisplayMs)`.
   - Hand: pass a new prop `paused={shown.holding}`. In `Hand.tsx`, `paused` means no click handlers
     are attached but card states are calculated as usual, so legal cards do not turn grey. Add a
     `Hand.test.tsx` case for this.
   - Clear `pending` when a hold starts (`useEffect` on `shown.holding`; while holding the hand also
     shows no selection).
   - Status line: while holding → `t('trick.takesNow', { name })`.
   - `TrickArea`: add optional `onDismiss` and `dismissLabel` props (set only while holding; the
     label is `t('trick.continue')`, passed in because `TrickArea` has no i18n). When `onDismiss` is
     set, wrap the slots in a `<button type="button" className={styles.dismiss}
     aria-label={dismissLabel} data-testid="trick-dismiss">`. Style it with no visible button chrome and keep the full trick
     size.
   - Render `ResultDialog` only when `game.phase === 'finished' && !shown.holding`.
   - Update `06` §3 and §4 if the details turn out different (the docs already describe this).
4. Remove bot pacing from the host
   - `src/net/host.ts`: remove the `botDelayMs` option, `botTimer` and the `await` in
     `runBotTurns`. It becomes a plain synchronous loop (`botStep` until `null`, broadcasting and
     persisting after each step as now). Keep the `stopped` check. Make the function non-async, and
     remove the `void` at the call site.
   - `src/ui/net/actions.ts` (and `src/ui/dev/localTable.ts` if it passes one): stop passing
     `botDelayMs`.
   - Update `host.test.ts` and any other tests that used `botDelayMs` or fake timers for bots. Add a
     test: after one human command, all following bot actions have run at once
     (`host.test.ts` "runs every bot turn right away, without pauses, until a human must act").
5. `09-testing.md` §6: the new hook and settings tests are listed there (already done).

**Done when** `npm run check` is green, and in `#/dev/local` with "Show finished trick" at 2 s every
finished trick stays visible for 2 s, including the last trick before the result dialog, also when a
bot leads the next trick, and bots act without pauses.
---

## F3 — Mobile and desktop layout that fits the screen

### Problem
- `--card-w: clamp(52px, 11vw, 96px)` is based on width only: 52 px on a 390 px phone (too small to
  read and hit), and nothing limits it by height.
- The game screen is a plain column (opponents, table, status, panel, hand). In landscape on a phone
  (about 390 px high, less with browser bars) it is far taller than the screen, so the page scrolls.
- The hand overlap is a fixed −55%, so 12 cards (discarding) can overflow.

### Target viewports (must all pass the layout e2e test)
| Name | Size (CSS px) | Notes |
|---|---|---|
| phone-s portrait | 360 × 640 | smallest supported |
| phone portrait | 390 × 844 | |
| phone landscape | 844 × 390 | |
| phone-s landscape | 640 × 360 | smallest supported landscape |
| tablet portrait | 768 × 1024 | |
| laptop | 1280 × 720 | |
| desktop | 1920 × 1080 | cards must not grow past the cap |

Requirements for every viewport, in every game phase:
- no page scrolling;
- hand, both opponent seats, trick area, status line and phase panel are fully inside the viewport;
- hand cards are ≥ 60 px wide on phones and ≤ 104 px wide on all screens.

Dialogs (Result, Settings, Stats, About) may scroll **inside** themselves.

### Layout decisions (now in `06-ui-ux.md` §1 "GameScreen layout" and §5)
1. **Card size from both axes** (`src/ui/styles/tokens.css`):
   ```css
   --card-w: clamp(44px, min((100vw - 24px) / 5.2, 17dvh), 100px);
   --card-h: calc(var(--card-w) * 178 / 128);
   --card-w-opponent: calc(var(--card-w) * 0.42);
   --card-w-trick: calc(var(--card-w) * 0.95);
   ```
   `5.2` makes 10 overlapped cards (46% of each card visible) fill the width of a portrait phone, and
   `17dvh` keeps the hand at about a quarter of the screen height in landscape. Check:
   390 × 844 → 70 px; 360 × 640 → 64 px; 844 × 390 → 66 px; 640 × 360 → 61 px; desktop → 100 px.
   In compact landscape set `--card-w-trick: calc(var(--card-w) * 0.8)`.
2. **Hand overlap fits any card count** (`Hand.tsx` + `Hand.module.css`). `Hand` sets
   `style={{ '--hand-n': Math.max(2, cards.length) }}` (type it as
   `React.CSSProperties & Record<'--hand-n', number>`). The CSS:
   ```css
   .hand { width: 100%; justify-content: center; }
   .hand > * + * {
     margin-left: clamp(calc(var(--card-w) * -0.7),
                        calc((100% - var(--hand-n) * var(--card-w)) / (var(--hand-n) - 1)),
                        calc(var(--card-w) * -0.15));
   }
   ```
   Percentages in `margin-left` refer to the hand's width, so 10 or 12 cards always fit. Delete the
   "useHandOverlap hook" idea in `06` §5 (already replaced there). Card raise on hover only under
   `@media (hover: hover)`, so touch devices do not keep cards stuck up.
3. **Screen height is fixed during a game.** `TableScreen` adds a class while `GameScreen` is shown:
   `height: 100dvh; overflow: hidden; display: flex; flex-direction: column`. `GameScreen` uses
   `flex: 1; min-height: 0`. The lobby and other screens may still scroll.
4. **`GameScreen` becomes a CSS grid** with named areas. Each existing block gets a `grid-area`; the
   left/right opponent need separate wrappers instead of the shared `.opponents` row (use
   `opponents.active[0]` = left, `[1]` = right; keep the seat order from `seats.ts`).
   - **Portrait / default** (mobile first):
     ```
     grid-template-areas: "oppL oppR" "table table" "status status" "phase phase" "hand hand";
     grid-template-rows: auto minmax(0, 1fr) auto auto auto;
     ```
   - **Compact landscape** `@media (orientation: landscape) and (max-height: 520px)`:
     ```
     grid-template-areas: "oppL table oppR" "oppL status oppR" "hand hand hand";
     grid-template-columns: minmax(96px, 20%) 1fr minmax(96px, 20%);
     grid-template-rows: minmax(0, 1fr) auto auto;
     ```
     The **phase panel is put over the `table` and `status` rows** (`grid-area: 1 / 2 / 3 / 3;
     align-self: center; z-index: 1; max-height: 100%; overflow: auto`, near-opaque background; the
     panel itself says whose turn it is). During bidding, skat decision, discarding and declaring the
     trick area is empty, so nothing is hidden. The Skat pile shows next to the panel. The sitting-out
     bar becomes part of the status row (smaller font).
   - **Large screens** `@media (min-width: 900px) and (min-height: 600px)`: the portrait areas, with
     `max-width: 1040px` centered and `max-height: 900px` for the grid. Cards are capped by the token
     (100 px). The phase panel is at most 640 px wide and centered.
5. **Compact parts** in the compact landscape media query and on portrait phones (`max-width: 480px`):
   - `TopBar`: one row, `padding: 4px 8px`, `font-size: 0.85rem`. The title and key truncate with an
     ellipsis. Buttons keep the 44 px tap size, but use icon-only labels with `aria-label`
     (⚙ settings, 📊 stats, ⎋ leave), so they fit.
   - `OpponentSeat`: name + count badge on one line. Role on a second small line. Backs are shown as a
     short fan: show at most 4 backs (`.cards > :nth-child(n+5) { display: none }`); the count badge
     shows the real number. Open (ouvert) cards always all show: small face cards in a wrapping row
     (`flex-wrap: wrap`), using `--card-w-opponent`.
   - `BiddingPanel`: the history is one line with `text-overflow: ellipsis` (the full text in `title`).
     Buttons in one row.
   - `DeclarationPicker`: 3 × 2 tiles everywhere (a row of 6 was tried: the labels wrapped), labels
     never wrap; in compact landscape the tiles are 36 px high and the heading/legend are hidden; the
     panel scrolls inside if needed.
   - `.status` min-height 28 px, font 0.9rem; the last-trick popover is shown as an absolutely
     positioned bubble over the table area, not as a flow paragraph (so it does not push the hand off
     screen).
6. **Dialogs**: `ResultDialog`, `SettingsDialog`, Stats and About use `max-height: calc(100dvh - 16px);
   overflow: auto`. Change `ResultDialog` from `80dvh`.

### Tasks
1. Tokens, global hover rule, `Card.module.css` hover under `@media (hover: hover)`.
2. `Hand.tsx`/`Hand.module.css` overlap (decision 2). Extend `Hand.test.tsx`: the `--hand-n` style is
   set.
3. `TableScreen` fixed-height class; `GameScreen.tsx` grid wrappers (`oppL`, `oppR`, `table`,
   `status`, `phase`, `hand`) + `GameScreen.module.css` with the three layouts.
4. Compact `TopBar`, `OpponentSeat`, `BiddingPanel`, `DeclarationPicker`, status/last-trick bubble,
   dialogs.
5. Look at the result in `#/dev/local?seed=123` and `#/dev/gallery` with the browser device toolbar
   at every target viewport, in every phase (bidding, skat decision, discarding with 12 cards,
   declaring, playing, ouvert opponent, result dialog, 4-player sitting-out bar).
6. New e2e test `e2e/layout.spec.ts` (see `09` §5):
   - for each target viewport: a new context with that `viewport`. For width ≤ 900, also set
     `isMobile: true, hasTouch: true`. Open `/#/dev/local?seed=123` and start the game the way
     `src/ui/dev/localTable.ts` / the existing e2e helpers do. Wait for `hand-card-*`.
   - assert `document.documentElement.scrollHeight <= innerHeight + 1` and
     `scrollWidth <= innerWidth + 1`;
   - assert every `[data-testid^="hand-card-"]`, every `[data-testid="opponent-seat"]` (add this
     test id to `OpponentSeat`), `[data-testid="trick-area"]` (add to `TrickArea`),
     `[data-testid="status-line"]` and `[data-testid="phase-panel"]` (add to the phase panel
     wrapper when it is not empty) has a bounding box inside the viewport;
   - card width: ≥ 60 when `min(width, height) ≤ 480`; ≤ 104 always;
   - save a screenshot per viewport to `test-results/layout-<name>.png` for review by hand.
   - the test also drives the viewer through skat decision → pick up → discarding (12 cards) →
     declaring → playing and checks every phase. It uses `?seed=6&bots=easy`: with a fixed seed the
     practice host restarts the bot RNG on every bot turn, so an easy bot repeats its first choice
     (with seed 6: pass) and the viewer wins the bidding.

**Done when** `npm run check` and `npm run e2e` (incl. `layout.spec.ts`) are green, and the
screenshots look right: nothing is cut off, cards are readable, and the desktop does not have
oversized cards.

---

## F4 — Small card symbols instead of written-out card names

### Problem
Wherever cards appear as text, the UI writes out the full name with `cardName()`
(`src/ui/game/labels.ts`): "Anna: Ten of hearts · Ben: Jack of clubs · …" in the last-trick
line (`GameScreen.tsx`), and "Skat: Seven of spades, Ace of diamonds" / "Discarded: …" in
`ResultDialog.tsx`. That is long, hard to scan, and takes too much room on phones (F3).

### Behaviour (now in `06-ui-ux.md` §2, §4 and ResultDialog)
- A card in text is shown as a **card chip**: a small white rounded box (like a mini card face)
  holding the coloured suit symbol and a short rank, e.g. `♥10`, `♣B`, `♠A`.
  - Suit symbols ♣ ♠ ♥ ♦: ♥/♦ in `--suit-red`, ♣/♠ in `--suit-black`, on a white background so the
    colours have good contrast on the green felt.
  - Short ranks are translated: en `7 8 9 10 J Q K A`, de `7 8 9 10 B D K A`.
  - Size: font about `0.95rem`, padding `1px 4px`, `border-radius: 4px`, `white-space: nowrap`,
    `font-variant-numeric: tabular-nums`. It sits inline with text.
- Accessibility: the chip has `role="img"` and `aria-label` = the full name from `cardName()`
  ("Ten of hearts"), plus the same text in `title` (tooltip on hover). Screen readers still hear
  the full names. Do **not** change the `alt`/`aria-label` of the real card images (`Card`).
- Places:
  1. **Last trick** (the "Last trick" button in `GameScreen`): show the bubble as one row per play,
     `Anna ♥10`, with the winner's row marked (bold + "takes the trick" text). Separate the plays
     with a gap, not " · " strings.
  2. **ResultDialog**: "Skat:" and "Discarded:" lists as chips.
  3. Any other place that uses `cardName()` for **visible** text (search with
     `grep -rn "cardName(" src/ui`). Uses for `aria-label`/`alt` stay as they are.
- `aria-live` announcements stay as full text.

### Tasks
1. i18n (`en`/`de`): add `rankShort.7` … `rankShort.A` (en: `7 8 9 10 J Q K A`; de: `7 8 9 10 B D K
   A`).
2. `src/ui/game/labels.ts`: add `export function cardShort(card: CardId, t: Translator): { suit: string;
   rank: string; red: boolean }`, using `suitSymbol` and `rankShort.*`. Unit test in `labels.test.ts`
   (en and de, e.g. `HJ` → `♥` + `J` / `B`, red; `C10` → `♣` + `10`, not red).
3. `src/ui/components/CardChip.tsx` + `CardChip.module.css` (new):
   `export function CardChip({ card }: { readonly card: CardId })`. Uses `useT()`, renders
   `<span role="img" aria-label={cardName(card, t)} title={…} className={…}>` with the suit symbol and
   short rank. Also `CardChips({ cards })`: chips in a row with a small gap (`display: inline-flex;
   flex-wrap: wrap; gap: 4px`). Component test `CardChip.test.tsx`: the visible text is `♥10`, the
   accessible name is "Ten of hearts", and the red class is set for ♥/♦.
4. `GameScreen.tsx`: replace the joined text string of the last trick with a small list
   (`<ul className={styles.lastTrick}>`, one `<li>` per play: name + `CardChip`, the winner's `<li>`
   gets a class and the `trick.takes` text). Keep `data-testid="last-trick"` on the list (add it if
   missing; also add the id to `09` §5). With F3 this list is the bubble over the table area.
5. `ResultDialog.tsx`: replace `cardText(...)` with `<CardChips cards={…} />`. Remove `cardText`.
6. Gallery (`#/dev/gallery`): add a row with all 32 chips for a visual check.

**Done when** `npm run check` is green. In `#/dev/local`, "Last trick" shows something like
`Anna ♥10 · Ben ♣B · You ♥A` as chips (German UI: B/D for Bube/Dame), the result dialog shows the
Skat as chips, and a screen reader (or the accessibility tree in dev tools) still reads the full card
names.

---

## Not in scope
- Bot playing strength (that is Phase 13, `14-bots.md`).
- A user setting for card size (could follow later if needed).
- A shared, host-controlled trick time for all players: each viewer uses their own `trickDisplayMs`
  (see `12` I97).
