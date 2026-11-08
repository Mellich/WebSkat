# Plan 05: Trick cards at fixed positions (left, right, own card bottom center)

User request: *"Keep the order of played cards on the table the same: the left player card should
always show up as the left card, the right player card should show as the right card. The center
card should always be your own card. Move the center card down to form a triangle with the played
cards so it gets easier to understand who played the card. Keep the names on the card."*

Read first: `docs/ui-game-screen.md` (all), `docs/dev/e2e.md` §5, `src/ui/AGENTS.md`.

## 1. Current state

- `src/ui/components/TrickArea.tsx`: three slots filled **in play order** (`slots[0]` = first card
  played). So the leader's card is always left, whoever the leader is. The name is shown below
  each card (`.name`).
- `src/ui/game/GameScreen.tsx` (~line 112): `trickSlots = shown.plays.map(p => ({ card, name,
  winner }))` from `useShownTrick` (`src/ui/game/useShownTrick.ts`), which returns the plays of the
  current trick or of the held completed trick, in play order, each with `playerId`.
- Opponent seats: `opponentsOf(view)` (`src/ui/game/seats.ts`) returns the other **active** players
  in clockwise order starting after the viewer. `seat(0)` is drawn in grid area `oppL` (left),
  `seat(1)` in `oppR` (right). Play is clockwise, so the next player after the viewer sits on the
  left.
- Sitting-out viewers (Geberskat) have no hand; `opponents.active` then has **three** entries, and
  only the first two get a seat (`oppL`, `oppR`); the third active player is not drawn as a seat.
- `TrickArea.module.css`: one flex row; `min-height: card height + 28px`.
- `docs/ui-game-screen.md` §2 says trick cards are `0.8 × --card-w` in compact landscape; the CSS
  does not do that today (`--card-w-trick` is `0.95 × --card-w` everywhere).
- `src/ui/dev/Gallery.tsx` renders `<TrickArea slots={TRICK} />`.

## 2. Decisions (log them in `docs/decisions.md`)

1. *Trick positions*: each card is drawn at the position of the player who played it: the `oppL`
   player's card top left, the `oppR` player's card top right, the viewer's own card bottom center,
   lower than the other two (a triangle). For a viewer who sits out, the bottom position belongs
   to the third active player (the one without a seat box). Empty positions show the dashed
   placeholder. The player's name is shown as a small label **on** the lower edge of the card.
2. *Compact landscape*: trick cards use `0.8 × --card-w` so the triangle fits (this makes the
   existing doc statement true).

## 3. Steps

### Step 1: pure position mapping (test first)

- Do Step 2's type first: in `src/ui/components/TrickArea.tsx` add
  `export type TrickPosition = 'left' | 'right' | 'bottom';`.
- New `src/ui/game/trickPositions.ts`:
  ```ts
  import type { TrickPosition } from '../components/TrickArea'; // 'left' | 'right' | 'bottom', defined in Step 2
  export interface TrickSeats { readonly left: string | null; readonly right: string | null; readonly bottom: string | null }
  /** Who sits where around the trick for this viewer (see docs/ui-game-screen.md §1). */
  export function trickSeats(view: TableView): TrickSeats
  //   active viewer: left = opponentsOf(view).active[0], right = active[1], bottom = view.you.id
  //   otherwise (sitting out, pending): left = active[0], right = active[1], bottom = active[2]
  //   missing entries → null
  export function placeTrick<T extends { readonly playerId: string }>(plays: readonly T[], seats: TrickSeats): Readonly<Record<TrickPosition, T | null>>
  //   each play goes to the position whose id equals play.playerId; plays of unknown ids are dropped
  ```
- Test `src/ui/game/trickPositions.test.ts` (node env): build small `TableView` objects by hand
  (3 players; 4 players with the viewer sitting out). Cases:
  1. Viewer `b` at seats `[a, b, c]` with all three active → left `c`, right `a`, bottom `b`
     (clockwise from `b`: `c`, then `a`).
  2. Plays in the order `a`, `b`, `c` → `placeTrick` puts `a` right, `b` bottom, `c` left (order
     of play does not matter).
  3. Viewer sitting out in a 4-player game → bottom is the third active player.
  4. Fewer plays (one card) → the other two positions are `null`.

### Step 2: TrickArea takes positions

- `src/ui/components/TrickArea.tsx`: replace `slots: readonly TrickSlot[]` by
  `slots: Readonly<Record<TrickPosition, TrickSlot | null>>` (`TrickPosition` lives in this file;
  components must not import from `game/`).
- Render three wrappers in fixed DOM order left, right, bottom, each
  `<div className={cls(styles.slot, styles[pos])} data-testid={`trick-slot-${pos}`}>`; a filled
  slot gets `data-player-name={slot.name}`.
- Name label **on** the card: inside the card wrapper (`position: relative`), a
  `<span className={styles.name}>` absolutely positioned at the bottom (`bottom: 4px; left: 50%;
  transform: translateX(-50%)`), small pill (`background: rgb(0 0 0 / 65%)`, `color: #fff`,
  `font-size: 0.7rem`, `padding: 1px 6px`, `border-radius: 999px`, `max-width: 90%`, ellipsis).
- CSS (`TrickArea.module.css`), triangle with a grid:
  ```css
  .trick {
    display: grid;
    grid-template-columns: auto auto;
    grid-template-areas: 'left right' 'bottom bottom';
    column-gap: calc(var(--gap) * 2);
    justify-content: center;
    justify-items: center;
  }
  .left { grid-area: left; }
  .right { grid-area: right; }
  .bottom { grid-area: bottom; margin-top: calc(var(--card-w-trick) * 178 / 128 * -0.45); }
  ```
  (The negative top margin pulls the own card up so the three cards form a triangle and the area
  is only ~1.55 card heights tall.) Remove the old `min-height` rule or set it to
  `calc(var(--card-w-trick) * 178 / 128 * 1.55)` so the area does not jump when cards appear.
  Keep `.winner`, `.empty`, `.dismiss`. Give the bottom slot `z-index: 1` so it lies over the
  upper cards where they overlap.
- Compact landscape: in `src/ui/game/GameScreen.module.css` inside the
  `(orientation: landscape) and (max-height: 520px)` block, set
  `.table { --card-w-trick: calc(var(--card-w) * 0.8); }`.
- Update `src/ui/dev/Gallery.tsx` (`TRICK` constant) to the new shape (e.g. left + bottom filled,
  right empty, one winner).
- New test `src/ui/components/TrickArea.test.tsx` (jsdom): given `{ left: A, right: null, bottom:
  B }`, `trick-slot-left` contains the image of A and the name text; `trick-slot-right` has the
  empty placeholder; the winner slot has the winner class (`[class*="winner"]`); with `onDismiss`
  the whole area is the `trick-dismiss` button.

### Step 3: GameScreen uses the mapping (and extracts the table center)

GameScreen is ~250 lines; extract the table center first so later plans have room.

- New `src/ui/game/TableCenter.tsx`: moves the `<div className={styles.table}>` content out of
  `GameScreen` (SkatPile, TrickArea, last-trick bubble). Props: `game`, `view`, `shown`
  (`ShownTrick`), `showLast: boolean`, `cardBack`, `nameOf`, `label`. It may keep using
  `GameScreen.module.css` classes (pass `styles` in or import the module; importing
  `./GameScreen.module.css` from `TableCenter.tsx` is fine).
- Inside: `const seats = trickSeats(view); const placed = placeTrick(shown.plays, seats);` then
  map each position to `{ card, name: nameOf(p.playerId), winner: p.winner } | null`.
- `GameScreen.tsx` renders `<TableCenter … />` in place of the old block.
- Run: `npx vitest run src/ui`.

### Step 4: docs

- `docs/ui-game-screen.md`: §1 `table` row ("`TrickArea` with three fixed positions: left = oppL
  player, right = oppR player, bottom = viewer (or the third active player for sitting-out
  viewers); name label on each card"); §2 compact landscape (trick cards `0.8 × --card-w`,
  set on `.table`); test ids `trick-slot-left|right|bottom`.
- `docs/ui.md` §10 `TrickArea` row: positions instead of play order.
- `docs/dev/e2e.md` §6: add `trick-slot-left`, `trick-slot-right`, `trick-slot-bottom`.
- `src/ui/AGENTS.md` file map: `game/trickPositions.ts`, `game/TableCenter.tsx`.
- `docs/dev/testing.md` §4: new tests.
- `docs/decisions.md`: rows from §2.

## 4. Validation

- `npm run check` green.
- `npx playwright test e2e/layout.spec.ts`: no scrolling at all 7 viewports. Open
  `test-results/layout-*-playing.png` and check the triangle (play one card manually in
  `#/dev/local` if the screenshot has no trick yet).
- Manual: `npm run dev`, `#/dev/local?seed=6&bots=easy` and `#/dev/local?players=4` (sitting out
  as viewer happens every 4th game): the card of the left seat is always left, yours always bottom.

## 5. Pitfalls

- Do not compute positions from play order or from roles; only from player ids and
  `opponentsOf` (which already defines left/right for the seat boxes), so trick and seats always
  agree.
- `components/` must not import from `game/` (dependency direction inside `src/ui`: `game/`
  uses `components/`).
- The last-trick bubble (`last-trick`) stays a list; it is not part of this change.
