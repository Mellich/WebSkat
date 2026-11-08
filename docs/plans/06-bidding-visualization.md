# Plan 06: Bidding visualization (speech bubbles, last bid only, declarer summary)

User request: *"Improve bidding visualization: currently, bidding is hard to follow for players
that are currently not part of the bidding. Also, the bidding screen does not give a good
overview. Instead of a plain concatenated string in the bidding screen, only show the last bid and
also show speech bubbles below the player that does the bid. The speech bubble should contain the
number of the bid, i.e. 18, 20, … It should be visible for a second; the duration the bubble is
visible should be configurable in the settings. After the bidding is over and the player chooses
the game, the status bar (the bar above your own cards) for all players should also show at which
bid the player won the bidding. It should also give updates if the player took the Skat."*

Read first: `docs/ui-game-screen.md` (all), `docs/ui.md` §6 and §9, `src/ui/AGENTS.md`,
`src/ui/game/useShownTrick.ts` + its test (the pattern for UI timers), plan 05 (positions).

## 1. Current state

- `src/ui/game/BiddingPanel.tsx` shows `bid.history` as one long line
  ("Anna 18 · Ben yes · …") plus the buttons from `legal`. Every viewer gets the same panel.
- The view already contains everything needed, **no protocol change**: `game.bidding.history`
  (`ViewBidEvent[]`: `playerId`, `type` `bid|hold|pass|claim`, `value` for bids),
  `bidding.callerId`, `listenerId`, `currentBid`, `stage`; after the bidding `game.declarerId`,
  `game.bid`, `game.pickedUpSkat`, `game.phase`, `game.declaration`.
- The host runs bots synchronously and sends one view per bot step; the host's own UI may receive
  several views in one React batch. So bubbles must be derived from the **growth of
  `history`**, not from "one view = one event".
- Status area (`GameScreen.tsx`, `styles.status`): status line, "Last trick" toggle, the
  "declared" line (`status.declared`, only once a game is declared), the sitting-out line.
- `src/ui/i18n/en.ts` has ~255 lines after plan 04; this plan and the next ones add many keys, so
  the dictionaries are split first.
- Positions of players around the table: plan 05's `trickSeats(view)` (left / right / bottom).

## 2. Decisions (log them in `docs/decisions.md`)

1. *Speech bubbles*: every new bidding event shows a bubble at the player who made it: below the
   left/right seat box, and for the bottom position (the viewer, or the third active player for a
   sitting-out viewer) at the bottom of the table area just above the hand. Text: the bid value
   for `bid` ("20"), "Yes"/"Ja" for `hold`, "Pass"/"Weg" for `pass`, "Play"/"Spiel" for `claim`. A
   newer event of the same player replaces the bubble. Events already in the history when the
   screen opens (reload) show no bubble.
2. *Bubble duration*: new setting `bidBubbleMs` with options 0 (off), 500, 1000 (default),
   2000, 3000 ms. Each viewer's own setting; no host pacing (like `trickDisplayMs`, I97).
3. *Bidding panel*: shows only the current bid ("Current bid: 20 (Anna)" or "No bid yet") and who
   bids to whom ("Anna bids, Ben answers"); the history line is removed.
4. *Declarer summary*: from the Skat decision on, the status area shows for everyone
   "Anna won the bidding at 23", then "· took the Skat" or "· plays Hand", and while playing
   "Grand by Anna (bid 23) · took the Skat". It replaces the old "declared by" line.
5. *i18n split*: `en.ts`/`de.ts` are split into three part files each to stay under 300 lines.

## 3. Steps

### Step 1: split the dictionaries (pure refactor, no text changes)

- Create `src/ui/i18n/parts/`:
  - `enApp.ts`: keys `app.*`, `common.*`, `home.*`, `about.*`, `table.*`, `lobby.*`,
    `topbar.*`, `error.*` → `export const enApp = { … } as const;`
  - `enGame.ts`: `rank.*`, `rankShort.*`, `suit.*`, `card.*`, `role.*`, `game.*`, `status.*`,
    `bid.*`, `skat.*`, `declare.*`, `result.*`, `trick.*`, `sitOut.*` → `enGame`.
  - `enPanels.ts`: `stats.*`, `settings.*`, `botLevel.*`, `lobby.botLevel` (move it here so all
    remaining keys are covered) → `enPanels`.
  - `deApp.ts`, `deGame.ts`, `dePanels.ts`:
    `export const deApp: Record<keyof typeof enApp, string> = { … };` etc. (the explicit type
    makes a missing or extra key a compile error per part).
- `src/ui/i18n/en.ts` becomes:
  `export const en = { ...enApp, ...enGame, ...enPanels } as const;` plus the existing
  `TranslationKey` and `Dict` types. `de.ts`: `export const de: Dict = { ...deApp, ...deGame, ...dePanels };`
- `src/ui/i18n/i18n.test.ts`: add "has no key in two parts":
  `Object.keys(enApp).length + Object.keys(enGame).length + Object.keys(enPanels).length === Object.keys(en).length`.
- Move keys verbatim (copy/paste blocks); `git diff --stat` should show only moves.
- Run `npm run check` now (typecheck proves nothing was lost). From now on **new keys go into the
  matching part file** (en and de).
- `src/ui/AGENTS.md` file map and `docs/ui.md` §9: describe the parts.

### Step 2: setting `bidBubbleMs`

- `src/ui/persist/settings.ts`: `bidBubbleMs: z.union([z.literal(0), z.literal(500), z.literal(1000), z.literal(2000), z.literal(3000)]).default(1000)`;
  `defaultSettings`: `bidBubbleMs: 1000`.
- Test (`persist.test.ts`): stored settings without the field load with `1000`; round trip with
  `2000`.
- `src/ui/components/SettingsDialog.tsx`: a `<select data-testid="setting-bid-bubble">` like the
  trick display select, label `settings.bidBubble`, options `settings.bidBubbleOff` (0),
  `settings.bidBubbleShort` (500), `settings.bidBubbleDefault` (1000), `settings.bidBubbleLong`
  (2000), `settings.bidBubbleVeryLong` (3000).
- i18n (`enPanels`/`dePanels`): `settings.bidBubble`: "Show bids as speech bubbles" / "Gebote als
  Sprechblasen zeigen"; Off/Aus, "0.5 s", "1 s", "2 s", "3 s".

### Step 3: bubble logic (pure helper + hook, tests first)

- New `src/ui/game/bidBubbles.ts` (pure):
  ```ts
  export interface BidBubble { readonly event: ViewBidEvent; readonly index: number } // index in history
  /** Latest new event per player among history[from..]. */
  export function latestPerPlayer(history: readonly ViewBidEvent[], from: number): Readonly<Record<string, BidBubble>>
  export function bubbleText(ev: ViewBidEvent, t: Translator): string
  //   bid → String(ev.value), hold → t('bubble.hold'), pass → t('bubble.pass'), claim → t('bubble.claim')
  ```
  Test `bidBubbles.test.ts`: two events of the same player → only the later one; `from` skips old
  events; texts per type.
- New hook `src/ui/game/useBidBubbles.ts`:
  `useBidBubbles(history: readonly ViewBidEvent[], durationMs: number): Readonly<Record<string, BidBubble>>`
  - `const [seen, setSeen] = useState(history.length)` (no bubbles for events present at mount).
  - During render (same pattern as `useShownTrick`, no setState inside effects): if
    `history.length !== seen` → `setSeen(history.length)`; if it grew and `durationMs > 0` →
    `setBubbles((cur) => ({ ...cur, ...latestPerPlayer(history, seen) }))`.
  - Timers in an effect, without restarting timers of bubbles that did not change: keep
    `useRef(new Map<string, { index: number; handle: ReturnType<typeof setTimeout> }>())`; in
    `useEffect(() => { … }, [bubbles, durationMs])` schedule a timeout for each bubble whose
    `index` differs from the stored one (clear the old handle first); the timeout callback deletes
    the map entry and calls `setBubbles((cur) => cur[id]?.index === index ? omit(cur, id) : cur)`.
    A separate unmount effect clears all handles (copy `ref.current` to a local variable inside
    the effect for the cleanup).
  - Test `useBidBubbles.test.tsx` (jsdom, `renderHook`, `vi.useFakeTimers()`, `act`, see
    `useShownTrick.test.tsx`): initial history → no bubbles; append a bid → bubble for that
    player; after `durationMs` → gone; a second event of another player 500 ms later does **not**
    extend the first bubble; a newer event of the same player restarts its time; `durationMs = 0`
    → never any bubble; several events appended at once → one bubble per player (latest).

### Step 4: bubble component and placement

- New `src/ui/components/SpeechBubble.tsx` + `SpeechBubble.module.css`: props
  `{ text: string; placement: 'below' | 'above'; testId?: string }`. A small rounded box (accent
  border, panel background, bold, `font-size: 1.1rem`, `padding: 2px 10px`) with a CSS triangle
  tail pointing to the speaker (up for `below`, down for `above`). Absolutely positioned by the
  parent (`position: absolute; left: 50%; transform: translateX(-50%); z-index: 3;
  pointer-events: none; white-space: nowrap`), `below` → `top: calc(100% + 6px)`, `above` →
  `bottom: 6px`. A 150 ms fade/scale-in animation (the global `prefers-reduced-motion` rule turns
  it off). `aria-hidden="true"` (the panel line in Step 5 is the accessible text).
- `GameScreen.tsx`:
  - `const bidBubbleMs = useSettings((s) => s.bidBubbleMs); const bubbles = useBidBubbles(game.bidding.history, bidBubbleMs); const seats = trickSeats(view);`
  - `.oppL` and `.oppR` (`GameScreen.module.css`) get `position: relative`; render
    `<SpeechBubble placement="below" text={bubbleText(…)} testId="bid-bubble-left" />` inside the
    oppL div when `bubbles[seats.left]` exists (same for right).
  - Bottom position: pass the bottom bubble to `TableCenter` (plan 05) and render it there with
    `placement="above"`, test id `bid-bubble-bottom`, positioned at the bottom center of `.table`
    (`.table` already has `position: relative`).
  - Compact landscape: the seat boxes are side columns over two rows; there, place the left/right
    bubbles inside the box: in the landscape media block of `GameScreen.module.css` override the
    bubble wrapper to `top: auto; bottom: 4px`. Simplest: wrap the bubble in a
    `<div className={styles.bubbleBelow}>` whose position rules live in `GameScreen.module.css`
    (portrait: `top: 100%`; landscape: `bottom: 4px`).
- Bubbles are absolutely positioned, so the grid does not move and nothing can scroll.

### Step 5: BiddingPanel shows the current bid and the turn

- Test first (`BiddingPanel.test.tsx`): replace "lists the bidding so far with names" by:
  1. No bid yet → text "No bid yet".
  2. History `[a bid 18, b hold, a bid 20]`, `currentBid: 20` → `bid-current` shows
     "Current bid: 20 (Anna)" and the text "18" alone does not appear in the panel.
  3. Stage 1, caller `a`, listener `b` → `bid-turn` shows "Anna bids, Ben answers".
  4. Claim stage, caller `a` → "Anna may play (18) or pass".
  The button tests stay unchanged.
- `src/ui/game/BiddingPanel.tsx`: delete `historyText` and the history paragraph. Add:
  - `<p data-testid="bid-current" aria-live="polite">`: `currentBid === null ? t('bid.none') : t('bid.current', { value: currentBid, name })`
    where `name` = `nameOf` of the last history event of type `bid` or `claim` (claim → value 18).
  - `<p data-testid="bid-turn">`: stage 1/2 → `t('bid.turn', { caller, listener })`; `'claim'` →
    `t('bid.claimTurn', { name: caller })`; other stages → nothing.
- i18n (`enGame`/`deGame`):
  - `bid.none`: "No bid yet." / "Noch kein Gebot." (existing key, new text)
  - `bid.current`: "Current bid: {value} ({name})" / "Aktuelles Gebot: {value} ({name})"
  - `bid.turn`: "{caller} bids, {listener} answers" / "{caller} sagt, {listener} hört"
  - `bid.claimTurn`: "{name} may play (18) or pass" / "{name} kann spielen (18) oder passen"
  - `bubble.hold`: "Yes" / "Ja"; `bubble.pass`: "Pass" / "Weg"; `bubble.claim`: "Play" / "Spiel"
  - Remove `bid.history`, `bid.holdWord`, `bid.passWord`, `bid.claimWord` if unused afterwards
    (`grep`).

### Step 6: declarer summary in the status area (extract `StatusArea` first)

- Extract `src/ui/game/StatusArea.tsx` from `GameScreen.tsx` (the `<div className={styles.status}>`
  block): props `statusText: string`, `actions?: ReactNode` (the abort button of plan 03 and the
  "Last trick" toggle), `summary: string | null`, `sittingOut: string | null`. Keep the test ids
  `status-line`, `sitting-out`.
- New pure helper `src/ui/game/declarerSummary.ts`:
  `declarerSummary(game: GameView, nameOf: (id: string) => string, t: Translator): string | null`
  - `declarerId === null` or phase `bidding` → `null`;
  - `won = t('summary.won', { name, bid })`;
  - `skat-decision` → `won`;
  - `discarding` → `` `${won} · ${t('summary.skatTaken')}` ``;
  - `declaring` → `won` + `· skatTaken` or `· t('summary.hand')` (`pickedUpSkat`);
  - `playing` / `finished` with a declaration → `t('summary.playing', { game: declarationLabel(d, t), name, bid })`
    + (`pickedUpSkat` ? `· skatTaken` : ''). (Hand is already part of the declaration label.)
- Test `declarerSummary.test.ts`: each phase; Hand vs. Skat taken; passed-in finished → `null`.
- `StatusArea` renders the summary as `<p className={styles.declared} data-testid="bid-summary">`
  in place of the old `status.declared` line. Remove `status.declared` from both dictionaries if
  unused.
- i18n (`enGame`/`deGame`): `summary.won`: "{name} won the bidding at {bid}" / "{name} hat bei {bid}
  das Reizen gewonnen"; `summary.skatTaken`: "took the Skat" / "hat den Skat aufgenommen";
  `summary.hand`: "plays Hand" / "spielt Hand"; `summary.playing`: "{game} by {name} (bid {bid})" /
  "{game} von {name} (gereizt bis {bid})".
- `GameScreen.tsx` must end below 300 lines (`wc -l`).

### Step 7: docs

- `docs/ui-game-screen.md`: §1 (bubbles, `bid-summary` line), §3 bidding row (new panel content),
  new subsection "Bid bubbles" (rules from §2.1, duration setting, positions), §6 status area.
- `docs/ui.md` §6 settings table: `bidBubbleMs`; §9 dictionary parts; §10 `SpeechBubble`.
- `docs/dev/e2e.md` §6: `setting-bid-bubble`, `bid-current`, `bid-turn`, `bid-bubble-left`,
  `bid-bubble-right`, `bid-bubble-bottom`, `bid-summary`.
- `src/ui/AGENTS.md` file map: new files (`i18n/parts/*`, `game/bidBubbles.ts`,
  `game/useBidBubbles.ts`, `game/declarerSummary.ts`, `game/StatusArea.tsx`,
  `components/SpeechBubble.tsx`).
- `docs/dev/testing.md` §4; `README.md` if it lists settings.
- `docs/decisions.md`: rows from §2.

## 4. Validation

- `npm run check` green.
- `npx playwright test e2e/layout.spec.ts` (status area has one more line during the Skat
  decision; bubbles must not cause scrolling) and `e2e/game.spec.ts`.
- Manual: `#/dev/local?bots=normal`: bot bids appear as bubbles at the bot seats for about 1 s;
  set 3 s in Settings and check; set Off. After the bidding every viewer sees the summary line.

## 5. Pitfalls

- Do not call `setState` directly inside `useEffect` bodies (the React hooks lint rules flag it);
  derive during render like `useShownTrick`, and set state only in timer callbacks.
- `GameScreen` is keyed by game number, so bubbles reset per game; do not add a reset for that.
- The UI must not interpret bidding rules (who may bid next); it only displays the view's
  `callerId`/`listenerId`/`history`.
