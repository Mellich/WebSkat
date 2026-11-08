# AGENTS.md — `src/ui` (React)

Read first: `docs/ui.md` (routes, screens, stores, settings, storage, i18n) and, for the in-game
screen, `docs/ui-game-screen.md`. Stats UI: `docs/statistics.md` §3. Test ids: `docs/dev/e2e.md` §6.

## Rules for this folder

- React 19 function components + hooks; TypeScript strict; plain CSS modules + variables in
  `styles/tokens.css`. **No** UI framework, Tailwind, router, chart or animation library.
- **The UI never decides whether a move is legal.** Enable cards/buttons strictly from
  `view.game.legal` (`playableCards`, `bidValues`, `canHold`, `canPassBid`, `canClaim`,
  `canPickUp`, `canPlayHand`, `discardFrom`, `declarations`). Do not import `legalCards`,
  `applyAction` or `applyCommand` into components. Read-only helpers are fine: `sortHand`,
  `declarationFloorValue`, `computeStats`, `formatKey`, …
- Send declarations/actions that come from `legal` (find by equality); never build your own.
- The UI talks to the game **only** through the `GameConnection` in the session store
  (`connection.send(command)`). Network setup lives in `net/actions.ts` only.
- All user-visible text through `useT()` / `t('key', params)`; add keys to **both**
  `i18n/parts/enApp|enGame|enPanels.ts` and the matching `de*.ts` part (`en.ts`/`de.ts` only merge). Error toasts use `error.<CODE>`.
- Image URLs only via `assets.ts` (`import.meta.env.BASE_URL`).
- `localStorage` only through `persist/storage.ts` and `persist/*`; zod-validate on read; wrap in
  try/catch.
- Accessibility: real `<button>`s, `aria-label` on icon buttons, `aria-live` status line, Esc
  closes dialogs, tap targets ≥ 44 px.
- Mobile first. The game screen must fit the viewport without scrolling (360×640 … 1920×1080).
- Stable `data-testid` on interactive elements used by tests; list new ones in `docs/dev/e2e.md` §6.
- Components < 300 lines, one per file, `X.module.css` next to `X.tsx`.
- DEV-only screens are lazy imports behind `import.meta.env.DEV` (`App.tsx`).

## File map

| Path | Contents |
|---|---|
| `router.ts` | `Route`, `parseRoute`, `useRoute`, `navigate`, `tableHash` |
| `assets.ts` | `cardUrl`, `backUrl`, `logoUrl`, `BackIndex`, `DEFAULT_BACK` |
| `preload.ts` | `cardImageUrls(back)`, `preloadImages(urls)`: loads card faces and back once per page |
| `cardNames.ts` | `cardLabel` (English fallback card name, default prop of components) |
| `classNames.ts` | `cls(...)` joins class names |
| `screens/Home.tsx` | start page: name, rejoin/resume, create, join by key, public list, About |
| `screens/TableScreen.tsx` | `#/t/KEY`: name form, `openTable`, TopBar, connection banner, lobby or game |
| `screens/TableLobby.tsx` | key + copy, seats, bot strength selects, Add bot, Start, Kick |
| `game/GameScreen.tsx` | in-game layout, bid bubbles, phase panel switch, hand, result |
| `game/StatusArea.tsx` (+ `.module.css`) | status line row, declarer summary (`bid-summary`), sitting-out line |
| `game/TableCenter.tsx` | the table area: Skat pile, bottom bid bubble, trick at fixed positions, last-trick bubble |
| `game/AbortGameButton.tsx` | host's "Abort game" button in the status row, with a confirm dialog |
| `game/BiddingPanel.tsx` | current bid, whose turn, Bid N / Hold / Play (18) / Pass |
| `game/bidBubbles.ts` | `latestPerPlayer`, `bubbleText` (pure) for the bid bubbles |
| `game/useBidBubbles.ts` | bubbles per player from the growth of `bidding.history`, timers per bubble |
| `game/declarerSummary.ts` | the declarer line per phase (`declarerSummary`, pure) |
| `game/SkatPanels.tsx` | `SkatDecision` (pick up / Hand), `DiscardPanel` |
| `game/DeclarationPicker.tsx` | game tiles, extras, floor-value hint, Declare |
| `game/ResultDialog.tsx` | result sheet, score table of the selected scoring system, Continue / ready state |
| `game/useShownTrick.ts` | holds a finished trick for `trickDisplayMs` |
| `game/seats.ts` | `opponentsOf` (seat order relative to the viewer), `namesById` |
| `game/trickPositions.ts` | `trickSeats` (who is left / right / bottom), `placeTrick` (plays → positions) |
| `game/labels.ts` | `cardName`, `cardShort`, `declarationLabel`, `spitzenLabel`, `suitKey`, `suitSymbol` |
| `components/` | `Card` (`disabled` = button that cannot be clicked), `Hand` (interactive hands are all buttons), `OpponentSeat`, `TrickArea`, `SkatPile`, `SpeechBubble`, `CardChip(s)`, `TopBar`, `Toast(s)`, `ConfirmDialog`, `SettingsDialog`, `AboutDialog` (+ `.module.css`) |
| `stats/` | `StatsPanel`, `Standings`, `History`, `ScoreChart`, `ByType`, `chartGeometry.ts`, `gameLabel.ts` |
| `store/session.ts` | `useSession` (connection, host, status, view, records, toasts), `errorText` |
| `store/settings.ts` | `useSettings` (settings + `update`) |
| `persist/` | `storage.ts` (`browserStorage`), `settings.ts`, `session.ts`, `hosted.ts` (host snapshots + migration), `records.ts` (record cache) |
| `net/actions.ts` | `hostTable`, `openTable`, `resumeHostedTable`, `leaveTable` |
| `net/transport.ts` | `getTransport()` (one Trystero transport per page) |
| `i18n/` | `en.ts` (source, `TranslationKey`), `de.ts`, `index.ts` (`translate`, `useT`, `translateNow`, `Language`) |
| `i18n/parts/` | `enApp`, `enGame`, `enPanels` and their `de*` twins: the dictionary split (each key in one part) |
| `styles/` | `tokens.css` (colors, `--card-w`…), `global.css` |
| `dev/` | `DevLocal.tsx` + `localTable.ts` (`#/dev/local`), `Gallery.tsx` (`#/dev/gallery`) |
| `*.test.ts(x)` | component/hook tests (jsdom pragma) and pure UI helper tests |

## State handling

- `useSession` is updated only from `ConnectionEvent`s (`attach` subscribes). Components read it
  with selectors (`useSession((s) => s.view)`).
- Local UI state (selected card, discard picks, open dialog, trick hold) stays in components and
  is never sent over the network.
- `GameScreen` is keyed by the game number, so local state resets for each game.

## Recipes

- **New button that sends a command:** read the permission from `view.game.legal` (or
  `view.table` / `view.you` for lobby actions), call `connection.send(...)`, add `data-testid`,
  add i18n keys, write a jsdom test that checks enabled/disabled and the sent command.
- **New setting:** `persist/settings.ts` (schema with `.default()`, `defaultSettings`) →
  `SettingsDialog.tsx` → i18n → `persist.test.ts` → `docs/ui.md` §6.
- **Layout change in the game screen:** edit `GameScreen.module.css` (three layouts) and check
  with `npx playwright test e2e/layout.spec.ts` plus a look at the screenshots in `test-results/`.
