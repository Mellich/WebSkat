# AGENTS.md — `src/net` (transport, protocol, host/client controllers)

Read first: `docs/networking.md` and `docs/architecture.md` §3–4. Visibility rules:
`docs/hidden-information.md`.

## Rules for this folder

- May import `src/table` and `src/engine`; **never** `src/ui`.
- All game decisions are delegated to `src/table` (`applyCommand`, `addPlayer`, `viewFor`,
  `botStep`). This folder only moves messages, tracks peers and runs timers. No rule logic here.
- **Every message from the network is parsed with a zod schema** (`protocol.ts`,
  `schemaGame.ts`, `schemaView.ts`) before use. Invalid → drop (host warns once per peer). Never
  `as`-cast network data.
- Schemas are typed `z.ZodType<T>` against the table/engine types; keep them in sync.
- The actor of a command is the **sender's peer id → player id** mapping, never a field in the
  payload.
- Clients only receive `viewFor(state, thatPlayer)`, sent with a `target`. Never broadcast a view.
  Never put `TableState`, seeds or hands into a message.
- Code above `transport.ts` uses only `Transport`/`RoomHandle`, so it runs on the fake network.
  Only `trysteroTransport.ts` imports Trystero (dynamic `import()` per strategy).
- Trystero action names stay short: `'cmd'`, `'msg'`, `'ad'`.
- Randomness and time are injected (`now`, `randomSeed`, `randomId`, `randomToken`); production
  wiring is in `src/ui/net/actions.ts`.
- Controllers are single-threaded reducer loops: replace `state` only synchronously inside
  handlers, then broadcast.
- Timers (ad interval, join timeout, directory prune) are cleared in `stop()`/`close()` so tests
  with fake timers end.
- **Bump `PROTOCOL_VERSION`** (`constants.ts`) when any message, command or view changes shape.

## File map

| File | Contents |
|---|---|
| `constants.ts` | `APP_ID`, `PROTOCOL_VERSION`, `LOBBY_ROOM`, `AD_INTERVAL_MS`, `AD_TTL_MS`, `JOIN_TIMEOUT_MS`, `LEAVE_CLOSE_DELAY_MS`, `tableRoom(key)` |
| `transport.ts` | `Channel`, `RoomHandle`, `Transport` interfaces (no library imports) |
| `trysteroTransport.ts` | `createTrysteroTransport(config)`: Nostr or ws-relay, shared rooms per id, TURN |
| `signalingConfig.ts` | `SignalingConfig`, `signalingConfigFrom(env)` (pure) |
| `fake.ts` | `createFakeNetwork()`: in-memory network with `flush`, `members`, `drop` (tests, `#/dev/local`) |
| `schemaGame.ts` | `CardIdSchema`, `DeclarationSchema`, `GameActionSchema`, `TableCommandSchema` |
| `schemaView.ts` | `TableViewSchema`, `GameRecordSchema` and nested schemas |
| `protocol.ts` | message schemas (`ClientMessageSchema`, `HostMessageSchema`, `AdSchema`, …), types, builders `cmdMessage`, `viewMessage`, `recordMessage` |
| `connection.ts` | `ConnectionStatus`, `ConnectionEvent`, `GameConnection`, `createEmitter` (replays status/records/view) |
| `host.ts` | `createHost` → `Host` (`connection`, `stop`, `getState`, `snapshot`, `invite`), `HostSnapshot`; joins (token or invite), kicked notices |
| `peers.ts` | `createPeerMap()`: peer ↔ player bookkeeping (`bind`, `unbindPlayer`, `dropPeer`) |
| `advertise.ts` | `startAdvertising({lobby, getState, hostId, now})`: lobby ads for public tables |
| `invites.ts` | `createInvites(initial, newCode)`: single-use invite codes of disconnected players (`create`, `take`, `forget`, `toJSON`) |
| `client.ts` | `createClient` → `GameConnection` (`leave()` sends `leave`, then closes after `LEAVE_CLOSE_DELAY_MS`) |
| `directory.ts` | `createDirectory(lobby, onChange)`, `TableAd` (public table list) |
| `keys.ts` | `KEY_ALPHABET`, `normalizeKey`, `formatKey`, `isValidKey`, `generateKey`, `joinLink(key, base, invite?)` |
| `random.ts` | `randomBytes`, `randomHex`, `randomUint32` (Web Crypto) |
| `index.ts` | public re-exports (not `fake.ts`, not `testing.ts`) |
| `testing.ts` | test rig: `createRig`, `joinClient`, `settle`, `lastView`, `statusOf`, `errorsOf`, `nextCommand`, `CARD_PATTERN`, `KEY` |
| `*.test.ts` | `protocol`, `keys`, `signalingConfig`, `directory`, `host`, `integration` (full game, no foreign cards), `resume`, `invite` (invites and replacement over the wire) |

## Testing

Use the fake network: `createRig()` gives a host on `net`; `joinClient(rig, 'P1', 'Anna')` adds a
client; call `settle(rig)` to deliver queued messages; inspect `events` with `lastView`,
`statusOf`, `errorsOf`. Assert that clients never see foreign cards (`CARD_PATTERN`). Timeouts:
`vi.useFakeTimers()`. Real WebRTC is only exercised by the Playwright tests (`e2e/`).

## Pitfalls

- Keys: store normalized (`ABCDEFGH`), show formatted (`ABCD-EFGH`); `generateKey` returns the
  formatted form.
- A kicked or closed client must not send `join` again (`ended` flag in `client.ts`).
- `trysteroTransport.ts` shares one Trystero room per room id between handles; Trystero itself
  returns the same room for repeated joins and ends it for all on `leave()`.
