# WebSkat

Skat in the browser, peer to peer. Three players, or four to six with Geberskat (the dealer and any
extra players sit out, and the seat rotates). No accounts, no server of our own: the browsers talk
to each other over WebRTC, and only the signaling step uses a relay.

The plan and the rules live in `docs/`. Start with `docs/00-overview.md` and `AGENTS.md`.

## Run it

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev          # http://localhost:5173, signaling through the public Nostr relays
npm run build        # production build into dist/
npm run preview      # serve dist/
```

Offline practice against two bots (development builds only): `#/dev/local`.

## Checks

```sh
npm run check        # typecheck + lint + unit and component tests
npm run e2e          # Playwright: several browsers play through the UI
```

`npm run e2e` starts its own signaling relay (`npm run relay`, port 8787) and a dev server with
`VITE_SIGNALING=ws-relay`, so the public relays are not used. The first time, install the browser
with `npx playwright install chromium`. To use an installed Chromium instead, set
`WEBSKAT_CHROMIUM=/path/to/chromium`.

## Signaling configuration

| Variable | Meaning |
|---|---|
| `VITE_SIGNALING` | `nostr` (default) or `ws-relay` |
| `VITE_RELAY_URLS` | optional comma-separated Nostr relays replacing the defaults |
| `VITE_RELAY_URL` | required for `ws-relay`, e.g. `wss://relay.example.com` |
| `VITE_TURN_URL`, `VITE_TURN_USER`, `VITE_TURN_CREDENTIAL` | optional TURN server |

Copy `.env.example` to `.env.local` to set them. Every `VITE_*` value ends up in the public bundle.
