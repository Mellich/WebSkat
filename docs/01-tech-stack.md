# 01 — Tech Stack

Versions were looked up on the npm registry during planning (Nov 2026). Use `^` ranges as listed.
**Node.js `>= 22.12`** is required (Vite 8, Vitest 5). The planning machine had no Node installed.
Use `npm` (not pnpm/yarn) so every environment behaves the same.

## Runtime dependencies

| Package | Version | Purpose |
|---|---|---|
| `react`, `react-dom` | `^19.3.1` | UI |
| `zustand` | `^5.1.0` | UI/session stores |
| `zod` | `^4.6.7` | schema validation of network messages and persisted data |
| `trystero` | `^0.26.0` | WebRTC peer discovery + messaging. Default signaling: Nostr relays |
| `@trystero-p2p/ws-relay` | `^0.26.0` | optional self-hosted signaling (also used by e2e tests) |

## Dev dependencies

| Package | Version | Purpose |
|---|---|---|
| `vite` | `^8.3.6` | dev server + bundler |
| `@vitejs/plugin-react` | `^6.2.1` | React for Vite |
| `typescript` | `~6.0.3` | **Do NOT use TS 7.x**: `typescript-eslint` 8.72 supports `<6.1.0` only |
| `eslint` | `^10.14.0` | lint |
| `typescript-eslint` | `^8.72.1` | TS lint rules (flat config) |
| `eslint-plugin-react-hooks` | latest compatible | hooks lint |
| `vitest` | `^5.1.0` | unit tests |
| `jsdom` + `@testing-library/react` + `@testing-library/user-event` | latest compatible | component tests (few) |
| `fast-check` | latest compatible | property-based tests for the engine |
| `@playwright/test` | `^1.65.0` | multi-browser e2e |
| `sharp` | `^0.35.5` | crop/convert card sprites (`npm run assets`) |
| `@types/react`, `@types/react-dom`, `@types/node` | matching | types |

Rule: **do not add anything else** without writing the reason into `docs/12-open-questions.md`.
No UI framework, no Tailwind, no router library, no chart library, no animation library,
no state machine library, no i18n library.

> If a version above cannot be installed, use the nearest compatible version and note it in
> `12-open-questions.md`. Always read the actual `.d.ts` files in `node_modules` for Trystero before
> writing the transport (API names may differ slightly from the README).

## Why Trystero (research summary)

Requirement: P2P if feasible, else a dumb websocket forwarder.

| Option | Verdict |
|---|---|
| **Trystero** | ✅ Chosen. Rooms + `makeAction` abstraction, TypeScript types, MIT, actively maintained (v0.26, Nov 2026). Signaling via Nostr/MQTT/BitTorrent trackers/Supabase/Firebase/IPFS **or a self-hosted ws-relay** – switching is a one-line import change. After the handshake all data goes peer-to-peer (encrypted by WebRTC). |
| PeerJS | Needs its PeerServer (default cloud instance is best-effort). Rooms must be built manually. |
| Raw WebRTC | Needs own signaling server + lots of glue. |
| Plain WebSocket server | Works but needs a server to be run and paid for; only as fallback. |
| Yjs / Automerge / CRDTs | Overkill. Skat has hidden information; a CRDT would replicate secrets to everyone. |

Known caveats (documented in `05-networking.md` and `11-deployment.md`):
- Public relays are best-effort → configurable relay URLs + ws-relay fallback.
- Some corporate/symmetric NATs need a **TURN** server → optional env configuration.
- WebRTC mesh is fine for ≤ 6 players (+ a small lobby room), not for large rooms.
- Trystero hashes/encrypts SDP with `appId`+`roomId`; Web Crypto needs a **secure context** (HTTPS or
  `localhost`).
- Action names passed to `room.makeAction(name)` should be **short (≤ 12 bytes)** — older Trystero
  versions enforced this; use `'cmd'`, `'msg'`, `'ad'`.

## Configuration files to create in Phase 0

- `package.json` (`"type": "module"`, `"engines": {"node": ">=22.12"}`), scripts:
  ```jsonc
  {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "npm run typecheck && npm run lint && npm run test",
    "assets": "node scripts/make-assets.mjs",
    "relay": "node scripts/relay.mjs",
    "e2e": "playwright test"
  }
  ```
- `tsconfig.json` with `"strict": true`, `"noUncheckedIndexedAccess": true`,
  `"exactOptionalPropertyTypes": true`, `"noImplicitOverride": true`, `"verbatimModuleSyntax": true`,
  `"moduleResolution": "bundler"`, `"target": "ES2022"`, `"jsx": "react-jsx"`, `"noEmit": true`.
  Use TS project references (or two tsconfigs) so that `src/engine` and `src/table` are compiled with
  `"lib": ["ES2022"]` **without `DOM`** — this makes accidental use of `window`/`localStorage`
  there a compile error.
- `eslint.config.js` (flat config): `typescript-eslint` strict + `no-explicit-any: error`,
  `ban-ts-comment: error`, `switch-exhaustiveness-check: error`, and **`no-restricted-imports`** /
  `no-restricted-globals` for `src/engine/**` and `src/table/**` forbidding `react`, `zustand`,
  `trystero`, `zod`(engine only), `window`, `document`, `localStorage`, `Date`, `Math.random`.
  Also forbid `src/engine` importing from `src/table|net|ui`, and `src/table` importing from
  `src/net|ui` (layering, see `02-architecture.md`).
- `vite.config.ts`: `base: './'`, React plugin, `test` block for Vitest
  (`environment: 'node'` default; component tests opt into jsdom with a
  `// @vitest-environment jsdom` pragma).
- `playwright.config.ts` (Phase 10).
- `.gitignore`: `node_modules`, `dist`, `public/cards`, `public/backs` (generated),
  `test-results`, `playwright-report`, `.env.local`.
- `.env.example`: `VITE_SIGNALING=nostr`, `VITE_RELAY_URL=`, `VITE_TURN_URL=`,
  `VITE_TURN_USER=`, `VITE_TURN_CREDENTIAL=`.
- `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.

## Browser support

Evergreen Chrome/Edge/Firefox/Safari (iOS 16+). Mobile portrait **and** desktop must work.
