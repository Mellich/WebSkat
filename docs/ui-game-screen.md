# In-game screen (`src/ui/game/`)

`GameScreen.tsx` renders one dealt game from `view` + `view.game`. It is shown by `TableScreen`
under the `TopBar` and is re-mounted for each game number.

## 1. Areas and what they show

| Area (CSS grid name) | Content | Test id |
|---|---|---|
| `oppL`, `oppR` | `OpponentSeat` of the two other **active** players: `oppL` = next player in clockwise seat order after the viewer, `oppR` = the one after (`seats.ts` `opponentsOf`). Role text, "· Dealer" if dealer, card count, backs or ouvert cards, glow on turn | `opponent-seat` |
| `table` | `SkatPile` (bidding, Skat decision), `TrickArea` (3 slots), the "last trick" bubble | `trick-area`, `last-trick` |
| `status` | status line (`aria-live`), "Last trick" toggle button, declared game line ("Grand Hand, declared by Anna"), sitting-out line (4+ players: "Sitting out: X, Y · Dealer: Z") | `status-line`, `sitting-out` |
| `phase` | phase panel (§3); not rendered during `playing`/`finished` | `phase-panel` |
| `hand` | the viewer's `Hand`; "You are sitting out this game … Dealer: X." for sitting-out viewers | `hand-card-<ID>`, `sitting-out-you` |
| overlay | `ResultDialog` when finished (after the trick hold) | `result-dialog` |

Sitting-out viewers see the table like a spectator: backs, trick, status; no hand. The document
title gets a `● ` prefix while it is the viewer's turn.

## 2. Responsive layout (`GameScreen.module.css`, `styles/tokens.css`)

Hard requirement: **the game screen never scrolls** at any viewport from 360×640 / 640×360 to large
desktops. `e2e/layout.spec.ts` checks 7 viewports (`dev/e2e.md` §5). Only dialogs scroll inside
(`max-height: calc(100dvh - 16px)`).

| Layout | Media query | Grid |
|---|---|---|
| Portrait / default (mobile first) | — | areas `"oppL oppR" "table table" "status status" "phase phase" "hand hand"`, rows `auto minmax(0,1fr) auto auto auto`, `max-width: 960px` |
| Compact landscape (phones sideways) | `(orientation: landscape) and (max-height: 520px)` | areas `"oppL table oppR" "oppL status oppR" "hand hand hand"`, columns `minmax(96px,20%) 1fr minmax(96px,20%)`; the phase panel is placed **over** the table + status rows (`grid-area: 1 / 2 / 3 / 3`, near-opaque background); headings/legends in the panel hidden; trick cards `0.8 × --card-w` |
| Large screens | `(min-width: 900px) and (min-height: 600px)` | portrait areas, `max-width: 1040px`, `max-height: 900px` |

Card size tokens (`tokens.css`):
```css
--card-w: clamp(44px, min((100vw - 24px) / 5.2, 17dvh), 100px);   /* ≈ 61–70 px on phones, 100 px cap */
--card-h: calc(var(--card-w) * 178 / 128);
--card-w-opponent: calc(var(--card-w) * 0.42);
--card-w-trick: calc(var(--card-w) * 0.95);
```

Hand overlap is pure CSS: `Hand` sets `--hand-n` (card count, min 2); each card after the first
gets `margin-left: clamp(-0.7·w, (100% − n·w)/(n − 1), −0.15·w)`, so 10 or 12 cards always fit.
The **left edge** of each card is the visible part, so clicks (and the e2e robot) target the left
edge. Hover raise only under `@media (hover: hover)`.

Compact parts (`max-width: 600px` or compact landscape): TopBar icon-only buttons; opponent seats
show at most 4 backs (the count badge shows the real number); ouvert cards wrap; the bidding
history is one line with ellipsis; `DeclarationPicker` tiles are 3 × 2.

## 3. Phase panel by `game.phase`

| Phase | Viewer on turn | Others |
|---|---|---|
| `bidding` | `BiddingPanel`: history line ("Anna 18 · Ben yes · …"), then buttons from `legal`: **Bid N** (`bid-submit`, N = the single `legal.bidValues` entry), **Hold at N** (`bid-hold`), **Play (18)** (`bid-claim`, claim stage), **Pass** (`bid-pass`) | the same panel with history, no buttons |
| `skat-decision` | `SkatDecision`: **Pick up Skat** (`pickup`), **Play Hand** (`play-hand`) | "X won the bidding with N" |
| `discarding` | `DiscardPanel`: "n of 2 selected" + **Discard** (`discard-submit`, enabled with exactly 2). The hand shows 12 cards, the two Skat cards highlighted; tapping toggles selection (max 2) | "Waiting for X" |
| `declaring` | `DeclarationPicker` (§4) | "Waiting for X to declare the game…" |
| `playing`, `finished` | no panel | — |

During bidding the hand is shown at full brightness but not clickable (`showAll`).

## 4. DeclarationPicker (`DeclarationPicker.tsx`)

1. Six game tiles `declare-option-0..5`: ♣ Clubs, ♠ Spades, ♥ Hearts, ♦ Diamonds, Grand, Null.
   A tile is disabled when no entry of `legal.declarations` has that game.
2. Extras appear when the chosen game offers more than one variant: radio buttons Normal /
   Schneider announced / Schwarz announced, and an Ouvert checkbox (only the combinations present
   in `legal.declarations`, e.g. Ouvert for suit/Grand only with Hand + Schwarz).
3. Hint line: "minimum value N" from `declarationFloorValue(option, spitzen)` (spitzen from
   `game.declarerSpitzen`) and, if below the bid, a warning that the game would be overbid. The
   warning never blocks.
4. **Declare** (`declare-submit`) sends the matching entry of `legal.declarations` (never a
   self-built declaration).

## 5. Playing and the trick display (`useShownTrick.ts`)

- Clicking a card in `legal.playableCards` sends `play`. Two-tap mode (setting `confirmPlay`:
  `auto` on coarse pointers, or `always`): the first tap raises the card, the second plays it.
  Illegal cards are images, not buttons: not focusable, not clickable, grey overlay.
- The engine clears the trick when the third card is played. `useShownTrick(game, trickDisplayMs)`
  holds a **newly completed** `lastTrick` on the table for the viewer's `trickDisplayMs`
  (default 600 ms; 0 = off). While holding:
  - cards of the next trick are not drawn yet; the winner's card is highlighted;
  - the hand is paused (looks normal, no click handlers) and a pending two-tap selection is cleared;
  - the status line says "{name} takes the trick";
  - clicking the trick area (`trick-dismiss`) ends the hold for this viewer only;
  - `ResultDialog` opens only after the hold ends.
  A trick already present on the first render (reload/reconnect) does not start a hold. A new
  trick during a hold restarts it. Bots are never delayed by the host; this client-side hold is
  what makes finished tricks visible.
- "Last trick" button (when a trick exists) toggles a bubble over the table: one line per play
  "Name ♥10" (`CardChip`), the winner marked.

## 6. Status line texts (priority order)

1. Holding a trick → "{winner} takes the trick".
2. Finished → empty.
3. Viewer's turn → "Your turn".
4. Player on turn is disconnected (`waitingFor`) → "Waiting for {name} to reconnect…".
5. Otherwise → "Waiting for {name}…".

Host only: while the game runs and the player on turn is disconnected (`waitingFor`), the status row
also shows an **Abort game** button (`data-testid="abort-game"`, `AbortGameButton.tsx`). A confirm
dialog comes first; the confirmed click sends `abort-game`, and the next game is dealt.

## 7. ResultDialog (`ResultDialog.tsx`)

A bottom sheet whose backdrop lets clicks through, so TopBar (Stats, Settings) stays usable.

- Passed in: "Everybody passed".
- Played: headline "{name} won/lost {game}", overbid line (bid vs value), calculation
  ("base × multiplier = value" or the Null value), card points declarer–defenders, tricks, Skat and
  discarded cards as `CardChips`.
- Score table: one row per seated player with the delta of the **selected** scoring system
  (setting `scoring`, default standard), taken from the game's `GameRecord` in the session store
  (`records`, matched by `record.number === game.number`). Cells show `…` until the record has
  arrived. The caption names the system ("Score change (Standard)" / "Score change (Seeger–Fabian)").
  The dialog computes no scores itself.
- **Continue** (`continue`) sends `ready`; then it is disabled and shows "Waiting for: A, B"
  (connected humans not yet ready).

## 8. Accessibility notes

Real buttons; `aria-pressed` on toggles and selected cards; illegal cards are plain `<img>`s
with a grey overlay (not buttons, so not focusable; there is no `aria-disabled`); status line
`aria-live="polite"`; dialogs close on Esc; suits have symbols and colors (♥ ♦ red). Hand cards
are buttons, so Tab + Enter/Space plays them.
