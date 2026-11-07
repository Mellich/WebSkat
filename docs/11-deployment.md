# 11 — Deployment

WebSkat is a **static site**. There is no application server. The only optional server-side
component is a signaling relay, which is not needed with the default Nostr signaling.

## 1. Build

```sh
npm ci
npm run assets        # generates public/cards and public/backs (needs the originals in assets/)
npm run build         # tsc -b && vite build  →  dist/
npm run preview       # test the production build locally
```
`vite.config.ts` uses `base: './'` so the site works at the domain root **and** under a sub-path
(GitHub Pages `https://user.github.io/WebSkat/`). The hash router means no server rewrite rules are
needed.

## 2. Hosting options (all free tiers)

| Host | Notes |
|---|---|
| GitHub Pages | Set source to **Deploy from a branch**, `gh-pages` / root. Run `npm run publish:pages`, then `git push origin gh-pages`. The script runs checks/build and prepares a commit containing only `dist/` plus `.nojekyll`. |
| Cloudflare Pages / Netlify / Vercel | Build command `npm run build`, output `dist`, Node 22. |
| Any static web server | Copy `dist/`. |

**HTTPS is mandatory in production**: WebRTC signaling in Trystero uses Web Crypto
(`crypto.subtle`), which only exists in secure contexts (HTTPS or `localhost`). All hosts above
provide HTTPS.

## 3. Signaling configuration (build-time env, see `.env.example`)

| Variable | Default | Meaning |
|---|---|---|
| `VITE_SIGNALING` | `nostr` | `nostr` or `ws-relay` |
| `VITE_RELAY_URLS` | (library defaults) | Comma-separated Nostr relay URLs (`wss://…`) to use instead of the defaults |
| `VITE_RELAY_URL` | – | Required when `VITE_SIGNALING=ws-relay`: `wss://relay.example.com` |
| `VITE_TURN_URL`, `VITE_TURN_USER`, `VITE_TURN_CREDENTIAL` | – | Optional TURN server for players behind strict NAT |

### Why TURN may be needed
WebRTC connects peers directly. Most home/mobile networks work via STUN (Trystero ships default
public STUN servers). Symmetric NATs and some corporate/CGNAT networks need a TURN relay;
symptom: two specific players cannot connect while others can. Options: Cloudflare's free TURN tier,
Open Relay, or self-hosted coturn. Data through TURN stays end-to-end encrypted. Note that anything in
`VITE_*` variables ends up in the public JS bundle — use short-lived or low-value credentials.

### Fallback: self-hosted signaling relay
If public Nostr relays prove unreliable:
```sh
npm run relay                # scripts/relay.mjs → ws://localhost:8787
```
Deploy `scripts/relay.mjs` to any Node host (Fly.io, a small VPS, Render free tier) behind TLS
(`wss://`), then build the client with `VITE_SIGNALING=ws-relay VITE_RELAY_URL=wss://…`.
The relay only forwards signaling messages. It contains no game logic and sees no game data. It is
the "simple websocket server that forwards messages" fallback required by the project brief.

## 4. Privacy / security notes (put a short version into the in-app About dialog)

- No accounts, no analytics, no cookies. `localStorage` holds: display name, settings, reconnect
  token(s), hosted-table snapshot, cached game records.
- Signaling relays learn: that *some* browser joined a room named `webskat-t-<key>` and IP-level
  metadata of the WebRTC handshake (STUN). They never see game messages.
- The table host sees all hands (trust model in `02-architecture.md`).
- Content-Security-Policy suggestion (static hosts that allow headers): `default-src 'self';
  img-src 'self' data:; connect-src 'self' wss: https:; style-src 'self' 'unsafe-inline'`
  (WebRTC itself is not governed by `connect-src`).

## 5. Release checklist

- [x] `npm run check` and `npm run e2e` green (e2e: three specs, see `12` I89)
- [ ] `npm run build && npm run preview`: create a table on a laptop, join from a phone over
      mobile data (different network) → plays a full game *(not done: needs real devices)*
- [ ] Verify the 4-player Geberskat rotation manually once *(covered by the e2e test on local relay; not on real WebRTC)*
- [x] Bundle size check (`dist/assets/*.js` gzipped < 300 kB): main chunk 129 kB, lazy chunks 21 kB and 6 kB
- [x] README updated (how to host, trust model, relay/TURN)
