# Tech stack and configuration

## 1. Runtime requirements

- **Node.js ≥ 22.12** (`engines` in `package.json`; Vite 8 and Vitest 5 need it). Development so
  far used Node 26. Check with `node -v`; if Node is missing, tell the user.
- Use **npm** (not pnpm/yarn). `package-lock.json` is committed.
- Browsers: current Chrome/Edge/Firefox/Safari (iOS 16+), phone (portrait and landscape) and
  desktop. WebRTC needs a secure context (HTTPS or `localhost`).

## 2. Dependencies (exact list; do not add others)

Runtime (`dependencies`):

| Package | Purpose |
|---|---|
| `react`, `react-dom` ^19.3 | UI |
| `zustand` ^5.1 | UI stores (`src/ui/store`) |
| `zod` ^4.6 | validation of network messages and stored data (`src/net`, `src/ui/persist`) |
| `trystero` ^0.26 | WebRTC rooms; Nostr signaling (default) |
| `@trystero-p2p/ws-relay` ^0.26 | self-hosted signaling (client + `scripts/relay.mjs`) |

Development (`devDependencies`): `vite` ^8.3, `@vitejs/plugin-react` ^6.2, `typescript` ~6.0.3
(**not 7.x**: `typescript-eslint` 8.72 supports < 6.1), `eslint` ^10.14, `typescript-eslint`
^8.72, `eslint-plugin-react-hooks` ^7.1, `vitest` ^5.1, `jsdom` ^31, `@testing-library/react`
^16, `@testing-library/dom` ^10, `@testing-library/user-event` ^14, `fast-check` ^4 (installed;
the tests use seeded loops instead), `@playwright/test` ^1.65, `sharp` ^0.35, `@types/*`.

**Rule:** no new dependency (no UI framework, Tailwind, router, chart, animation, state machine,
i18n or test-assertion library such as jest-dom) unless the user agrees. Record the reason in
`decisions.md`.

## 3. npm scripts

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server on http://localhost:5173 (`predev` generates card images if missing) |
| `npm run build` | `tsc -b && vite build` into `dist/` (`prebuild` generates card images if missing) |
| `npm run preview` | Serves `dist/` |
| `npm run typecheck` | `tsc -b` (all TS projects, see §4) |
| `npm run lint` | `eslint .` |
| `npm run test` | `vitest run` (unit, property, component tests; about 30 s) |
| `npm run test:watch` | Vitest watch mode |
| `npm run check` | typecheck + lint + test. **Must be green before you finish** |
| `npm run assets` | Regenerates `public/cards/*.webp` and `public/backs/*.webp` from `assets/` |
| `npm run textures` | Regenerates the committed table textures `public/felt-stamp.webp` and `public/textures/oak-old.webp` (`docs/assets.md` §5) |
| `npm run relay` | Local signaling relay on port 8787 (`PORT` overrides) |
| `npm run e2e` | Playwright tests (starts relay + dev server itself; `dev/e2e.md`) |
| `npm run publish:pages` | Check, build and prepare a `gh-pages` commit (`deployment.md`) |
| `npm run release -- X.Y.Z` | Release: version, release commit, tag `vX.Y.Z`, publish and push `gh-pages` (`dev/versioning.md` §4) |

Run one test file: `npx vitest run src/engine/bidding.test.ts`. One test by name: add
`-t "part of the name"`.

## 4. TypeScript projects (`tsconfig*.json`)

| File | Covers | Notes |
|---|---|---|
| `tsconfig.base.json` | shared options | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`, `noUnusedLocals/Parameters`, `noEmit`, target ES2022, `moduleResolution: bundler` |
| `tsconfig.core.json` | `src/engine`, `src/table` | `lib: ["ES2022"]`, `types: []`: **no DOM, no Node types**. Using `window`, `console`, `setTimeout` there is a compile error |
| `tsconfig.app.json` | all of `src` | DOM libs, `vite/client` types, `jsx: react-jsx` |
| `tsconfig.node.json` | `vite.config.ts` | Node types |
| `tsconfig.e2e.json` | `playwright.config.ts`, `e2e/` | Node + DOM |
| `tsconfig.json` | references all four | `tsc -b` builds them all |

Consequences of the strict options you will hit:
- `noUncheckedIndexedAccess`: `arr[i]` is `T | undefined`. Handle `undefined`.
- `exactOptionalPropertyTypes`: an optional field cannot be set to `undefined` unless typed
  `?: T | undefined`. Build objects with conditional spreads: `...(x === undefined ? {} : { x })`.
- `verbatimModuleSyntax`: type-only imports must use `import type` / `type` modifiers.

## 5. ESLint (`eslint.config.js`)

- `typescript-eslint` `strictTypeChecked` for all TS; react-hooks recommended for `src/**`.
- Errors: `no-explicit-any`, `ban-ts-comment`, `switch-exhaustiveness-check`.
- `src/engine/**` and `src/table/**`: no `console`; forbidden globals `window`, `document`,
  `localStorage`, `sessionStorage`, `navigator`, `location`, `fetch`, `WebSocket`,
  `RTCPeerConnection`, `crypto`, `Date`, `setTimeout`, `setInterval`, `performance`;
  `Math.random` forbidden; no imports of `react*`, `zustand`, `trystero`, `@trystero-p2p/*`.
- Layering: `engine` must not import `table`/`net`/`ui` or `zod`; `table` must not import
  `net`/`ui`; `net` must not import `ui`.

## 6. Other config files

- `vite.config.ts`: `base: './'` (works under a sub-path), React plugin, `define.__APP_VERSION__`
  (the `package.json` version, read at startup; `dev/versioning.md`), Vitest `environment:
  'node'`, excludes `e2e/**`. Component tests opt into jsdom with `// @vitest-environment jsdom`.
- `playwright.config.ts`: see `dev/e2e.md` §2.
- `.env.example`: build-time variables, see `deployment.md` §3. Copy to `.env.local` (ignored).
- `.gitignore`: `node_modules`, `dist`, `public/cards`, `public/backs`, `test-results`,
  `playwright-report`, `.env.local`.
- `index.html`: viewport meta with `viewport-fit=cover`, favicon `./skatastisches-logo.png`.
- `.github/workflows/pages.yml` ("Validate"): on push to `main`, runs `npm ci`, `npm run check`,
  `npm run build`. It does not deploy and does not run e2e.
