# Hidden information and trust model

This is the security boundary of the app. A bug here lets players see other players' cards.

## 1. Trust model

- **Clients cannot cheat.** They cannot play illegal cards or act out of turn (the host's engine
  checks every command), and they never receive hidden cards.
- **The host can see all cards.** Its browser holds the whole state, like a friend dealing at a
  real table. There is no mental-poker cryptography. The About dialog and README say so.
- The actor of a command is the player bound to the **Trystero peer id of the sender**, never an
  id inside the payload (`src/net/host.ts` `playerOf`). Peers that have not joined can only send
  `join`.
- Private tables are protected only by the key (8 symbols, 40 bits; `networking.md` §6).
- The host snapshot in the host's `localStorage` (`webskat.host.<KEY>`) contains the full state,
  including seed and hands, unencrypted. It is the host's own data.

## 2. Who may see which card

A `TableView` for player P may contain card identities only for:

| Card set | Visible to | Field |
|---|---|---|
| P's own hand | P | `game.myHand` |
| Declarer's current hand when the game is **ouvert**, from the declaration on (phase `playing` and `finished`) | everyone | `game.openHands[declarerId]` |
| The two Skat cards after the declarer picked them up (phases `discarding`, `declaring`) | declarer only | `game.skat` |
| Skat and discarded cards when a **played** game is finished | everyone | `game.skat`, `game.discarded` |
| Skat of a **Ramsch** (during and after the game; nobody picks it up) | everyone | `game.skat` |
| Cards of the current trick and of the last completed trick | everyone | `game.trick`, `game.lastTrick` |
| Other players' hands | **nobody**; only the count | `game.handCounts` |
| Shuffle seed, `initialHands` | nobody (never in a view, record or message) | — |
| Spitzen of the declarer's 12 cards (for the declaration hint) | declarer only, phase `declaring` | `game.declarerSpitzen` |

Passed-in games reveal no Skat. A Ramsch reveals it to everybody only once it is finished
(the Skat is on the table during the Ramsch, but it is never picked up). The ouvert hand stays visible after an early Null end
(`decisions.md` I21).

**Takeover (plan 07, I125).** A replacement (`replace-player`) or an invite takes over exactly what
the seat may see: the newcomer gets `viewFor(state, newId)`, so its own hand and, as the declarer,
the Skat in the same phases as anyone else. Nothing of the replaced player stays in the view. The
replaced player receives only `kicked`. Invite codes are host-only secrets, like tokens: they are
returned to the host's own UI by `host.invite`, stored in the host snapshot and travel only in the
invite link; they are never in a view, record or broadcast.

## 3. Where it is enforced

- `src/table/view.ts` (`viewFor`) and `src/table/viewGame.ts` (`gameViewFor`) build every view
  from an **allow-list**: each field is chosen explicitly. Never copy the `ActiveGame` or
  `GameState` and delete fields.
- `src/net/host.ts` sends each player only `viewFor(state, thatPlayer)` with a `target` peer.
  Views are never broadcast. Records are broadcast; they contain no card identities.
- Bots run in the host and could read everything. Strategy code only receives a `BotView` built by
  `botViewOf` (`src/table/bot/knowledge.ts`), which holds what a human in that seat knows
  (`bots.md` §2).

## 4. Tests that guard it (must stay green)

| Test | Checks |
|---|---|
| `src/table/view.redaction.test.ts` | Random games; after every action, for every viewer (active, sitting out, pending, stranger), every card id in `JSON.stringify(view)` is in the allowed set; the JSON never contains `"seed"` or `"initialHands"` |
| `src/table/view.test.ts` | Field-level cases (Skat visibility, ouvert, spitzen, legal only for the viewer) |
| `src/net/integration.test.ts`, `src/net/host.test.ts` | Messages received by each client contain no foreign cards (`CARD_PATTERN` in `src/net/testing.ts`); a payload claiming another player id has no effect |
| `src/table/bot/knowledge.test.ts` | Swapping cards a bot cannot see changes neither its `BotView` nor its chosen action |

## 5. Rules when you change views or messages

1. Add the new field in `src/table/viewTypes.ts`, fill it in `view.ts`/`viewGame.ts`, and decide
   explicitly who may see it. If it can contain card ids, extend the `allowed()` oracle in
   `view.redaction.test.ts` and add a case in `view.test.ts`.
2. Update the zod schema in `src/net/schemaView.ts` (the compiler flags drift because the schema
   is typed `z.ZodType<TableView>`).
3. Never put `TableState`, `ActiveGame`, `GameState`, seeds or hands into any message.
4. Update §2 of this file.
