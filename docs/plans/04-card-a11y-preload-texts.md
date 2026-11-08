# Plan 04: Disabled cards as `aria-disabled` buttons, preloaded card images, no unused texts

User request: *"Illegal cards are plain images with no aria-disabled. The announce.* texts exist
but are never used, and card images aren't preloaded. Preload cards, actually use the disabling
for disabled cards during the game, remove unused texts."*

Read first: `docs/ui.md` §9–§10, `docs/ui-game-screen.md` §5 and §8, `docs/dev/e2e.md` §4,
`src/ui/AGENTS.md`, `e2e/AGENTS.md`.

## 1. Current state

- `src/ui/components/Card.tsx`: renders a `<button>` only when `onClick` is given, otherwise an
  `<img>`. The button has `disabled={state === 'disabled'}`, but no caller ever passes both.
- `src/ui/components/Hand.tsx`: only cards in `legal` (and not `paused`) get a handler; all other
  cards are plain `<img>`s with the grey `disabled` style. They are not focusable and have no
  `aria-disabled` (decisions I48, I70).
- `src/ui/styles/global.css` has `button:disabled { opacity: 0.5 }`. `Card.module.css` says the
  card face must never get a lower opacity (the grey overlay `.disabled::after` does the dimming).
- Card images (`public/cards/*.webp`, `public/backs/*.webp`; URLs from `src/ui/assets.ts`
  `cardUrl`, `backUrl`) load only when first shown, so the first trick and the first ouvert hand
  pop in late. `ALL_CARDS` (32 ids) is exported by `src/engine`.
- e2e: the robot clicks `button[data-testid^="hand-card-"]` (`e2e/robot.ts` lines ~30, ~32, ~62)
  and relies on "button = clickable". `e2e/layout.spec.ts` clicks `button[data-testid^="hand-card-"]`
  in the discard phase.
- Unused i18n keys (checked with the script in Step 3; `error.*` keys are used dynamically by
  `errorText` and must stay): `app.tagline`, `common.copy`, `common.back`, `home.localInfo`,
  `home.status`, `table.inGame`, `table.waitingFor`, `bid.bid`, `skat.discard`, `skat.marked`,
  `result.player`, `trick.none`, `announce.played`, `announce.yourTurn`, `sitOut.dealer`,
  `sitOut.turn`, `stats.won`, `stats.noGames` (and `result.change` if plan 01 did not remove it).

## 2. Decisions (log them in `docs/decisions.md`)

1. *Disabled cards*: in an interactive hand (a play or discard handler is passed and `showAll` is
   off), **every** card is a `<button>`. Cards that may not be clicked right now (not in `legal`,
   or the hand is `paused`) are `disabled` and `aria-disabled="true"`; illegal ones also keep the
   grey overlay, paused legal ones keep the normal look. Non-interactive displays (bidding hand,
   trick, opponents) stay images. *Supersedes I48 and I70.*
2. *Preloading*: when the table screen opens, the 32 card faces and the chosen back are preloaded
   once per page (`new Image()`), so trick and ouvert cards appear without delay.
3. *Unused texts*: all i18n keys that no code reads are removed (list in §1).

## 3. Steps

### Step 1: Card and Hand (tests first)

- Update `src/ui/components/Hand.test.tsx` first:
  1. "enables only the cards that are passed as legal": all 4 cards are buttons; the enabled ones
     (`!b.hasAttribute('disabled')`) are exactly "Jack of clubs" and "Nine of diamonds"; the others
     have `disabled` and `aria-disabled="true"`.
  2. Replace "shows the illegal cards without making them focusable" with "renders illegal cards
     as disabled buttons with the grey style": `legal={[]}` + `onPlay` → 4 buttons, all disabled,
     all `aria-disabled="true"`, 4 elements match `[class*="disabled"]`.
  3. "shows all cards at full brightness when legality is irrelevant" (`showAll`): unchanged
     (images, no buttons).
  4. "keeps legal cards bright but not clickable while paused": the legal card is a **disabled
     button** without the grey class; clicking it does not call `onPlay`; 3 grey cards.
  5. New: "renders images when no handler is given" (`<Hand … legal={['HA']} />` without
     `onPlay`/`onToggle`) → 0 buttons, 4 images.
  6. "marks the selected cards as pressed", "toggles cards in discard mode", "reports the card":
     unchanged.
- `src/ui/components/Card.tsx`: new prop `readonly disabled?: boolean`.
  - Image when `onClick === undefined && disabled !== true`.
  - Otherwise `<button type="button" … disabled={disabled === true} aria-disabled={disabled === true ? true : undefined} onClick={disabled === true ? undefined : onClick}>`.
  - Remove `disabled={state === 'disabled'}` (the visual state and the interactivity are now
    separate).
- `src/ui/components/Card.module.css`: add
  `button.card:disabled { opacity: 1; cursor: default; }` (overrides the global
  `button:disabled` opacity; the grey overlay still comes from `.disabled`).
- `src/ui/components/Hand.tsx`:
  - `const handlerFor = mode === 'discard' ? onToggle : onPlay;`
  - `const interactive = handlerFor !== undefined && props.showAll !== true;`
  - For each card: `enabled = legal.includes(card) && props.paused !== true`.
    - `!interactive` → `<Card … />` (image, as today).
    - `interactive && enabled` → `<Card … onClick={() => { handlerFor(card); }} />`.
    - `interactive && !enabled` → `<Card … disabled />`.
  - `stateOf` stays as is (grey for not-legal, normal for paused legal cards).
- Run: `npx vitest run src/ui/components`.

### Step 2: e2e selectors

- `e2e/robot.ts`: use `button[data-testid^="hand-card-"]:enabled` in `robotStep` (last line) and
  in `selectTwoDiscards` (both locators: `…:enabled:not([aria-pressed="true"])` and
  `…:enabled[aria-pressed="true"]`). Without this the robot would pick a disabled first card and
  stop.
- `e2e/layout.spec.ts`: the discard clicks use `button[data-testid^="hand-card-"]:enabled`.
- `e2e/helpers.ts`: `handCards`/`waitForHand` use `[data-testid^="hand-card-"]` (any element) and
  stay as they are.

### Step 3: preload card images

- New file `src/ui/preload.ts`:
  ```ts
  // Card images are preloaded once per page so that tricks and open hands show without delay.
  export function cardImageUrls(back: BackIndex): string[]  // 32 × cardUrl(ALL_CARDS[i]) + backUrl(back)
  export function preloadImages(urls: readonly string[], load: (url: string) => void = loadImage): number
  // remembers loaded urls in a module-level Set; calls `load` only for new urls; returns how many were new
  function loadImage(url: string): void { const img = new Image(); img.decoding = 'async'; img.src = url; }
  ```
  (UI code may hold module state; `src/engine`/`src/table` may not.)
- Test `src/ui/preload.test.ts` (node environment, inject `load`): `cardImageUrls(2)` has 33
  unique entries ending in `cards/CJ.webp` … and `backs/2.webp`; `preloadImages` calls `load` 33
  times the first time and 0 times for the same list again; a different back adds 1.
  Note: the module-level Set persists between tests in one file; use distinct url lists or export
  a `resetPreloadedForTests()` only if needed (prefer distinct lists).
- `src/ui/screens/TableScreen.tsx`: `const cardBack = useSettings((s) => s.cardBack);` and
  `useEffect(() => { preloadImages(cardImageUrls(cardBack)); }, [cardBack]);` (runs in the lobby,
  before the first game).

### Step 4: remove unused texts

- Find unused keys (prints candidates; `error.*` are false positives):
  ```sh
  node -e "const fs=require('fs'),cp=require('child_process');const keys=[...fs.readFileSync('src/ui/i18n/en.ts','utf8').matchAll(/^\s+'([^']+)':/gm)].map(m=>m[1]);const files=cp.execSync('find src -name \"*.ts\" -o -name \"*.tsx\"').toString().trim().split('\n').filter(f=>!f.includes('/i18n/'));const all=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');for(const k of keys)if(!all.includes(\"'\"+k+\"'\")&&!k.startsWith('error.'))console.log(k)"
  ```
- Delete each listed key from **both** `src/ui/i18n/en.ts` and `src/ui/i18n/de.ts`.
- `src/ui/i18n/i18n.test.ts` uses `table.waitingFor` in "leaves a placeholder without a value
  visible": switch it to `status.waitingFor` (same English text "Waiting for {name}…").
- Re-run the script: it must print nothing.

### Step 5: docs

- `docs/ui-game-screen.md` §5: "Illegal cards are images, not buttons …" → "Illegal cards are
  disabled buttons (`disabled`, `aria-disabled="true"`, grey overlay); while a trick is held the
  legal cards are disabled too but keep their look." §8: same correction.
- `docs/ui.md` §9: delete the bullet "Unused keys exist (`announce.played`, …)". §10: `Card` row
  (new `disabled` prop; image only when neither `onClick` nor `disabled`), `Hand` row
  (interactive hands render buttons), last sentence: "Card images are preloaded once per page
  when a table opens (`preload.ts`)".
- `docs/dev/e2e.md` §4: the robot clicks the first **enabled** hand card.
- `src/ui/AGENTS.md` file map: `preload.ts`.
- `docs/dev/testing.md` §4: `preload` test.
- `docs/decisions.md`: rows from §2; mark I48 and I70 "*Superseded by I…*".

## 4. Validation

- `npm run check` green.
- `npx playwright test e2e/layout.spec.ts e2e/game.spec.ts` (selectors and card look changed).
  Look at `test-results/layout-*-playing.png`: grey cards look as before (not half transparent).

## 5. Pitfalls

- The global `button:disabled { opacity: 0.5 }` would make disabled cards transparent; the
  `button.card:disabled { opacity: 1 }` override is required (`Card.module.css` comment: never
  lower the face opacity).
- Disabled buttons are still found by `getAllByRole('button')` in jsdom tests; assert on the
  `disabled` attribute.
- Do not remove `error.*` keys: they are looked up as `error.${code}`.
