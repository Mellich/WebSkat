# 06 — UI / UX (`src/ui`)

Minimal graphics, mobile-first (portrait phone and desktop must both work). React 19 function
components, plain CSS (CSS modules + CSS variables in `styles/tokens.css`). **The UI never decides
legality**: it enables exactly the cards/buttons the `view.game.legal` object allows
(`04-game-engine.md` B4).

## 1. Screens and navigation

No router library. `App.tsx` reads `location.hash`:

| Hash | Screen |
|---|---|
| `` / `#/` | **Home** |
| `#/t/ABCD-EFGH` | auto-join that table (asks for a name first if none stored), then **Table** |

State: `useSession` store (zustand): `{ screen, connection, view, records, status, toast }`.
Screen **Table** renders `TableLobby` when `view.table.status === 'lobby'` (or the viewer is
`pending`) and `GameScreen` otherwise. A top bar is always visible: table name, key (tap to copy),
connection status dot, buttons **Stats**, **Settings**, **Leave**.

### Home
- Show the supplied raster Skatastischer Hirsch logo centered at three times its original display size above a centered page title. The title is “Skatastisches Onlineturniersystem” in German and “Skatastic Online Tournament System” in English; use the public copy described in `10-assets.md` and provide empty alternative text because the adjacent title names the app.
- Name input (stored in `localStorage`).
- **Create table**: name (default "<Player>'s table"), max seats (3–6, default 3), public toggle →
  generates key, starts a host, navigates to `#/t/KEY`.
- **Join with key**: input accepting `ABCD-EFGH` (any case/spaces) + Join button (validate with
  `isValidKey`).
- **Public tables**: live list (`createDirectory`), each row: table name, host, seats `2/3`,
  status, **Join** button. Empty state: "No public tables found yet". Shows a subtle spinner
  while connecting to the lobby.
- **Resume** cards: "Rejoin table ABCD-EFGH" (stored client session) and "Resume hosted table
  ABCD-EFGH" (host snapshot, Phase 9).
- Footer: About + trust note ("The host's browser shuffles and sees all cards, like a friend
  dealing at a real table.").

### TableLobby
- Big key `ABCD-EFGH` with **Copy key** and **Copy link** buttons.
- Seat list in order (seat numbers), each with name, connection dot, host crown, bot icon.
- Host only: **Start game** (enabled with ≥ 3 players), **Add bot**, per-player **Kick**.
- Non-host: "Waiting for host to start…".
- Info text: "3 players: classic Skat. 4–6 players: Geberskat — the dealer (and extra players) sit
  out, rotating each game."
- `pending` viewers see: "You'll be seated when the current game ends".

### GameScreen layout (portrait, relative to the viewer)

```
┌──────────────────────────────────────────────┐
│ TopBar: table · KEY · ● · [Stats][⚙][Leave]  │
├──────────────────────────────────────────────┤
│ [Opp A: name · role · 🂠🂠🂠 ×10 ] [Opp B …]   │  OpponentSeat ×2 (card backs, overlapped, count)
│   sitting out: Dave (dealer)                 │  SittingOutBar (only with 4+ players)
│                                              │
│          ┌────┐ ┌────┐ ┌────┐                │
│          │ A  │ │ B  │ │ me │                │  TrickArea: 3 slots, played cards, names below
│          └────┘ └────┘ └────┘                │  (+ last-trick ghost, + Skat 🂠🂠 during bidding)
│   Status line: "Your turn — play a card"     │
│   [ phase panel: Bidding / Skat / Declare ]  │  PhasePanel (changes with view.game.phase)
├──────────────────────────────────────────────┤
│  ╭─ own hand: 10 cards, overlapped, sorted ─╮ │  Hand (+ Skat/discard selection state)
└──────────────────────────────────────────────┘
```
Clockwise seating: viewer at the bottom; the next player in play order sits at the **left-top**,
the one after at the **right-top** (triangle). On wide screens use the same arrangement with more
space; the trick area is the center.

If the viewer is **sitting out** or pending: no hand; the bottom area shows "You are sitting out
this game" plus the dealer/role names; everything else is a spectator view (backs and trick).

### PhasePanel by `game.phase`

| Phase | What the viewer sees |
|---|---|
| `bidding` | `BiddingPanel`. Header: who bids/holds now. When it is my turn: as **caller** a value `<select>`/stepper limited to `legal.bidValues` (default = the lowest) + **Bid** + **Pass**; as **listener** **Hold (“Ja”) at N** + **Pass**; claim stage: **Play (18)** / **Pass**. Others: compact **bid history** list ("Anna 18 · Ben ja · Anna 20 · Ben weg"). |
| `skat-decision` | Declarer: **Pick up Skat** / **Play Hand**. Others: "X won the bidding with N". |
| `discarding` | Declarer: the two Skat cards are shown in the hand (highlighted *new*). Tap cards to select exactly 2 (checkmark), **Discard** button enabled when 2 selected (`legal.discardFrom`). |
| `declaring` | Declarer: `DeclarationPicker` (see below). Others: waiting text. |
| `playing` | Top status shows declared game ("Grand Hand · Schneider announced · Ouvert") and who is declarer; hand cards enabled/disabled per `legal.playableCards`. |
| `finished` | `ResultDialog` (below). |

### DeclarationPicker (step-by-step, no overload)
1. Game: five tiles ♣ ♠ ♥ ♦ **Grand** and **Null**.
2. If the declarer is playing **Hand** and chose suit/grand: choose extra: *Normal*, *Schneider
   announced*, *Schwarz announced*, *Ouvert* (ouvert implies schwarz). If Null: toggle *Ouvert*.
   Not-hand games: only Null offers *Ouvert* toggle.
3. A summary line: "Hearts · Hand — **minimum value 30** (mit 2, bid was 27) ✓" or a warning
   "Below your bid (36): you must win Schneider or you overbid." (non-blocking, from
   `declarationFloorValue`). **Declare** button sends the matching entry from `legal.declarations`
   (find by structural equality; never construct illegal declarations).

### ResultDialog (modal, non-blocking for stats)
Passed in: "Everybody passed". Otherwise:
- Headline: "Anna won Grand Hand" / "Anna lost (overbid)".
- Table: declarer card points vs defenders (`83 – 37`), tricks, Schneider/Schwarz flags,
  "Mit 2, Spiel 3, Hand 4 × 24 = 96", bid, game value, score delta per player (both systems if toggle).
- Revealed Skat/discarded cards, and (for passed-in nothing).
- **Continue** button → sends `ready`; shows "Waiting for: Ben, Carl" with ready checkmarks.

## 2. Components (`src/ui/components`)

| Component | Props (essential) | Notes |
|---|---|---|
| `Card` | `id: CardId \| 'back'`, `state?: 'normal'\|'disabled'\|'selected'\|'highlight'`, `onClick?`, `size` | `<button>` when clickable, else `<img>`. `alt`/`aria-label` from i18n ("Jack of clubs"). Image `src = ${BASE}cards/${id}.webp`. Illegal card = `disabled` (opaque card face with a translucent grey overlay + not focusable). During bidding, show every card at full brightness because the hand is needed for bidding; cards remain non-interactive. |
| `Hand` | `cards`, `legal: CardId[]\|null`, `mode: 'play'\|'discard'`, `selected`, `onPlay`, `onToggle` | Overlapped fan (negative margin; overlap shrinks to fit width). Sorted via `sortHand(cards, declaration)`. Selected card raised by 12px. |
| `OpponentSeat` | `player`, `role`, `count`, `isTurn`, `isDeclarer`, `openCards?` | Shows `Card back` stack (overlapped ×min(count,10)) + count badge; highlights when it is their turn; ouvert → real cards face up. |
| `TrickArea` | `trick`, `lastTrick`, `players` | Three fixed slots mapped to seat positions; card appears with CSS transition; after a trick completes show it for ~1.2 s (UI timer) with a winner highlight, then clear — see §4. |
| `SkatPile` | `visible: boolean` | Two small backs in the table center during bidding/skat-decision. |
| `SittingOutBar` | `players`, `dealerId` | chips |
| `BiddingPanel`, `SkatDecision`, `DiscardPanel`, `DeclarationPicker`, `ResultDialog` | as above | one file each |
| `TopBar`, `Toast`, `ConfirmDialog`, `SettingsDialog` | | |
| `stats/*` | see `07-statistics.md` | |

## 3. Interaction details

- **Play a card**: mouse: single click. Touch (`(pointer: coarse)`): first tap selects (raises
  card), second tap on the same card plays (prevents mis-taps). Setting "Confirm card play" =
  *auto* (default) / *always* / *never*.
- Illegal cards stay fully opaque under a translucent grey overlay (never reduce the card face opacity) and are disabled with `aria-disabled`; tapping them shows a small tooltip/toast:
  "You must follow suit (♥)" — text keyed by a UI-side reason helper that only *describes* (it is
  fine to infer a message from the led card; it must not change enablement).
- Keyboard: Tab through enabled cards, Enter/Space plays. `aria-live="polite"` region announces
  "Your turn", "Anna played ♥J", "Anna wins the trick".
- Turn indicator: glow on the seat/hand whose turn it is; when it is the viewer's turn the status
  line says so and the tab title prefixes "● " (so background tabs notice). Optional sound: **none
  in v1**.
- "Waiting for X to reconnect…" banner when `game.waitingFor !== null`.
- Host disconnected banner (`status === 'host-lost'`): "Connection to host lost. Retrying…" +
  **Leave** button.
- Errors from host (`error` events) → toast with `t('error.' + code)`.

## 4. Trick display timing (UI only)

The engine clears the trick the moment the third card is played. The UI keeps a local
`displayTrick` state: when `view.game.lastTrick` changes to a new completed trick, show its 3 cards
in the trick area for 1200 ms (winner's card highlighted, then slide towards the winner's seat),
**while the hand is already interactive** — if the viewer is the winner and plays immediately, the
new card replaces the display. A "Last trick" button/long-press shows the previous trick
(`lastTrick`) in a popover. Respect `prefers-reduced-motion` (no slide, only a fade).

## 5. Responsiveness and style

- Card natural size 128×178 (aspect 0.719). CSS variable `--card-w`: clamp so that 10 cards fit:
  `--card-w: clamp(52px, 11vw, 96px)` for the hand; opponents' backs `--card-w * 0.5`; trick cards
  `--card-w * 1.1`.
- Hand overlap: `margin-left: calc(-1 * (--card-w * 10 - available) / 9)` computed in a small
  `useHandOverlap` hook using `ResizeObserver` (max overlap 60% of the card).
- Table background: dark green felt (flat color + subtle radial gradient). Cards get a soft
  `filter: drop-shadow`. Palette and spacing tokens in `tokens.css`; dark theme only in v1.
- Safe areas: use `env(safe-area-inset-*)` paddings. Minimum tap target 44×44 px for buttons.
- Card back: user selectable in Settings from the four backs (`/backs/0..3.webp`), default 2.

## 6. i18n (`src/ui/i18n`)

`en.ts` and `de.ts` are typed dictionaries (`type Dict = typeof en` so missing keys are compile
errors). `t(key, params?)` with `{name}` interpolation. Default language from
`navigator.language` (`de*` → de, else en), changeable in Settings. **All user-visible strings go
through `t`** from the start. Game terms:

| EN label | DE label |
|---|---|
| Clubs / Spades / Hearts / Diamonds | Kreuz / Pik / Herz / Karo |
| Grand / Null | Grand / Null |
| Hand / Ouvert | Hand / Ouvert |
| Schneider / Schwarz | Schneider / Schwarz |
| Bid / Hold / Pass | Reizen / Halten („Ja") / Weg |
| Pick up Skat / Discard | Skat aufnehmen / Drücken |
| with N / without N | mit N / ohne N |
| Dealer / Forehand / Middlehand / Hindhand | Geber / Vorhand / Mittelhand / Hinterhand |
| Passed in | Eingepasst |

Suit symbols ♣ ♠ ♥ ♦ are language independent; hearts and diamonds rendered in red.
Error codes map to messages under `error.<CODE>`.

## 7. Settings (persisted, zod-validated, `ui/persist/settings.ts`)

`{ name, language, cardBack: 0|1|2|3, confirmPlay: 'auto'|'always'|'never', scoring: 'seeger'|'standard',
`reducedMotion: 'system'|'on'|'off', botDelayMs: 0|300|600|1000 }`. The bot-play delay defaults to 600 ms and controls the pause between successive bot actions; 0 disables it. It is read live by the host for bot turns (so changing the setting takes effect during a game) and persisted locally.

## 8. Accessibility

Buttons are real `<button>`s; modals trap focus and close on Esc; color is never the only signal
(suit symbols have shapes; disabled cards also get a grey overlay **and** `aria-disabled`);
contrast ratio ≥ 4.5:1 for text.

## 9. Component tests (few, `@testing-library/react`)

`Hand` enables only the cards passed as legal; `BiddingPanel` offers only `legal.bidValues`;
`DeclarationPicker` emits an entry from `legal.declarations`; `Home` rejects invalid keys.
Everything else is covered by engine/table/net tests and the e2e test.
