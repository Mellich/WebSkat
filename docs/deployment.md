# Deployment

WebSkat is a **static site**. The only optional server is the signaling relay (not needed with
the default Nostr signaling). The user-facing summary is in `README.md`; keep both in sync.

## 1. Build

```sh
npm ci
npm run build      # prebuild generates card images if missing; tsc -b && vite build → dist/
npm run preview    # serve dist/ locally
```

`base: './'` makes the site work at a domain root and under a sub-path. The hash router needs no
server rewrites. **HTTPS is mandatory** in production (Trystero needs Web Crypto, which exists only
in secure contexts; `localhost` is fine for development).

## 2. Hosting

| Host | How |
|---|---|
| GitHub Pages | Pages source: **Deploy from a branch**, `gh-pages`, `/ (root)`. Run `npm run publish:pages`, then `git push origin gh-pages` |
| Cloudflare Pages / Netlify / Vercel | build command `npm run build`, output `dist`, Node 22 |
| Any static server | copy `dist/` |

`scripts/publish-gh-pages.mjs`: runs `npm run check` and `npm run build`, adds a temporary git
worktree for `gh-pages` (creates an orphan branch if missing), replaces its content with `dist/`
plus `.nojekyll`, and commits there. It does not push and does not change the current branch.
The GitHub workflow (`.github/workflows/pages.yml`, "Validate") only checks and builds `main`.

## 3. Signaling configuration (build-time, `.env.local`, see `.env.example`)

| Variable | Default | Meaning |
|---|---|---|
| `VITE_SIGNALING` | `nostr` | `nostr` (public relays) or `ws-relay` (own relay) |
| `VITE_RELAY_URLS` | library defaults | comma-separated Nostr relays (`wss://…`) |
| `VITE_RELAY_URL` | — | required for `ws-relay`, e.g. `wss://relay.example.com` (startup throws without it) |
| `VITE_TURN_URL`, `VITE_TURN_USER`, `VITE_TURN_CREDENTIAL` | — | optional TURN server |

Every `VITE_*` value ends up in the public JavaScript bundle: only use low-value or short-lived
TURN credentials.

- **Own relay:** `npm run relay` (port 8787, `PORT` overrides). Deploy `scripts/relay.mjs` to a
  Node host behind TLS, build with `VITE_SIGNALING=ws-relay VITE_RELAY_URL=wss://…`. It forwards
  signaling only.
- **TURN:** needed behind symmetric NATs and some corporate/mobile networks (symptom: two specific
  players cannot connect while others can). Any TURN server works; data stays encrypted.

## 4. Privacy notes (also in the About dialog and README)

- No accounts, analytics or cookies. `localStorage` holds name, settings, the client seat token,
  cached records and, for hosted tables, the full table state including cards.
- Signaling relays and STUN servers learn that a browser joined a room `webskat-t-<KEY>` and the
  network addresses. They never see game messages.
- The host sees all hands (`hidden-information.md`).
- Suggested CSP where headers are possible: `default-src 'self'; img-src 'self' data:;
  connect-src 'self' wss: https:; style-src 'self' 'unsafe-inline'`.

## 5. Release checklist

- [ ] Released with `npm run release -- X.Y.Z` (`dev/versioning.md` §4: version, commit, tag,
      `gh-pages` push); the deployed app shows the version bottom left
- [ ] `npm run check` and `npm run e2e` green
- [ ] `npm run build && npm run preview`; main JS chunk < 300 kB gzipped (last measured: 129 kB)
- [ ] Create a table on a laptop, join from a phone on another network, play a full game
      (never done so far)
- [ ] README and this file match the current behavior
