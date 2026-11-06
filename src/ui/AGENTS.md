# AGENTS.md — `src/ui` (React)

Read first: `docs/06-ui-ux.md`, `docs/07-statistics.md` §3, `docs/10-assets.md`.

## Rules for this folder

- React 19 function components + hooks; TypeScript strict; plain CSS (CSS modules + variables in
  `styles/tokens.css`). **No** UI frameworks, Tailwind, router, chart or animation libraries.
- **The UI never decides whether a move is legal.** Enable cards/buttons strictly from
  `view.game.legal` (`playableCards`, `bidValues`, `canHold`, `canPassBid`, `declarations`,
  `discardFrom`, …). Do not import `legalCards`/`applyAction` into components.
  Read-only pure helpers from `engine`/`table` are fine: `sortHand`, `cardPoints`,
  `declarationFloorValue`, `computeStats`, `BID_VALUES` (for display only).
- The UI talks to the game **only** through a `GameConnection` (`src/net/connection.ts`) held in
  the session store. Components get data from selectors on the store, not from props drilled
  through five levels.
- All user-visible text through `t('key')` (`src/ui/i18n`); add keys to **both** `en.ts` and
  `de.ts` (the `Dict` type makes a missing key a compile error). Error codes: `error.<CODE>`.
- Image URLs via `src/ui/assets.ts` using `import.meta.env.BASE_URL`.
- `localStorage` access only in `src/ui/persist/*`, always zod-validated on read, wrapped in
  try/catch (private mode / quota).
- Accessibility: real `<button>`s, `aria-disabled` on illegal cards, `aria-live="polite"` status
  region, focus trap in dialogs, Esc closes dialogs.
- Mobile-first: test at 360×640 and 1280×800. Minimum tap target 44 px. Respect
  `prefers-reduced-motion`.
- Give interactive elements stable `data-testid`s as listed in `docs/09-testing.md` §5.
- Keep components small (< 300 lines); one component per file; co-locate `X.module.css`.
- DEV-only helpers (`#/dev/gallery`, `#/dev/local`) must be tree-shaken from production
  (`if (import.meta.env.DEV)` + dynamic import).

## State handling

- `useSession` (zustand): `connection`, `view`, `records`, `status`, `toast`. Updated only from
  `ConnectionEvent`s.
- Local UI state (selected card, open dialogs, trick display timer) stays in components or a tiny
  `useUiStore`; it must never be sent over the network.
- Trick display timer (`06 §4`) is a pure UI effect keyed on `view.game.lastTrick`.
