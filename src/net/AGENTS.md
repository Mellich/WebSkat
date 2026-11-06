# AGENTS.md — `src/net` (transport, protocol, host/client controllers)

Read first: `docs/05-networking.md` and `docs/02-architecture.md` §3–4.

## Rules for this folder

- May import `src/table` and `src/engine`; **never** `src/ui`.
- All game decisions are delegated to `src/table` (`applyCommand`, `viewFor`, `runBots`).
  This folder only moves messages, tracks peers and schedules timers. No rule logic here.
- **Every message that arrives from the network is parsed with a zod schema from `protocol.ts`
  before use.** Invalid → drop silently (warn once). Never `as`-cast network data.
- The actor of a command is derived from the **sender's Trystero peerId → playerId map**, never from
  a field in the payload.
- Clients must only ever receive `viewFor(state, thatPlayer)` output. Never broadcast a view;
  always `send(..., target)` per player. Never put `TableState`, seeds or hands into any message.
- Everything above `transport.ts` talks to the `Transport`/`RoomHandle` interface so it can run on
  the in-memory fake network (`fake.ts`). Only `transport.ts` imports `trystero`.
- Trystero action names must be short: `'cmd'`, `'msg'`, `'ad'`.
- Before writing the Trystero binding, **read the actual type definitions** in
  `node_modules/trystero/dist/*.d.mts` and `node_modules/@trystero-p2p/*/dist/*.d.mts`; the README
  API may differ in details (callback signatures, `makeAction` options).
- Use dynamic `import()` for signaling strategies. Only `nostr` and `ws-relay` are implemented.
- Randomness/time are injected (`now`, `randomSeed`, `randomBytes`); production wiring uses
  `crypto.getRandomValues` and `Date.now()` in `src/ui` bootstrap code, not in the controllers.
- Controllers are single-threaded reducer loops: replace `state` only synchronously inside event
  handlers, then broadcast.
- Timers (ad interval, join timeout) must be cancellable in `stop()`/`close()` so tests with fake
  timers terminate.

## Test with the fake network

Integration tests (`docs/09-testing.md` §4) must run host + 3 clients in-process, play a scripted
game and assert (a) correct flow and (b) that no client message contains foreign cards (regex check
from the redaction test). Real WebRTC is only exercised by the Playwright tests in Phase 10.
