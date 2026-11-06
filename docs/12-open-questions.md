# 12 — Open Questions and Decisions

Planning-time decisions where the sources were ambiguous or silent. **Append new entries when you
decide something while implementing** (date, decision, reason). Format: `ID — Decision — Why`.

## Decided during planning

| ID | Topic | Decision | Why / alternative |
|---|---|---|---|
| D1 | Spitzen counting | Official ISkO: count jacks **and** following trump-suit cards (max 11 suit, 4 grand). Not the "jacks only" variant | Official rule; variant listed on Wikipedia as regional |
| D2 | Grand base value | 24 | Current ISkO (was 20 until 1932) |
| D3 | Overbid scoring (suit/grand) | Lost; value = next multiple of base ≥ bid, doubled | ISkO overbid rule; verified only via Wikipedia worked example (bid 36 / base 12), not the PDF |
| D4 | Overbid scoring (Null) | Lost; score `−2 × value of the declared Null` (no rounding) | Not clearly documented in sources; simplest. Revisit if the ISkO PDF says otherwise |
| D5 | Default scoring display | Extended Seeger–Fabian (tournament), with toggle to classic ("standard"); both stored per game | Both are cheap to store; Seeger is the official tournament system |
| D6 | Seeger bonus for N ≥ 5 | 24 (N=5, from DSkV list per Wikipedia), 20 (N=6, our own extension) — paid to *every* non-declarer seated player when the declarer loses | Sources only specify N=3 (40) and N=4 (30) |
| D7 | Geberskat seating for 5–6 | Active = the 3 players after the dealer; everyone else (incl. dealer) sits out; pointer advances one seat per game | User spec: "others skip, next game the next player skips". Official 5-player seating differs slightly |
| D8 | Ramsch / Kontra / Bock | Not implemented | Not part of ISkO; user asked for official game types |
| D9 | Passed-in game | No points, no replay, next dealer; stored as a record with `outcome: 'passed-in'` | ISkO |
| D10 | Forehand with no bids | Claim stage: forehand may take the game at 18 or pass (→ passed in) | ISkO: forehand may play if both others pass |
| D11 | Cutting the deck | Skipped (shuffle is by the host's CSPRNG-seeded PRNG) | No physical deck |
| D12 | Null early termination | Game ends when the declarer wins a trick | ISkO |
| D13 | Suit/grand early termination | Not implemented; all 10 tricks are always played | Simplicity |
| D14 | Declaration vs bid | Not blocked; UI warns if floor value < bid | ISkO lets the declarer overbid, he just loses |
| D15 | Host authority & trust | Host sees all cards; no mental poker | Casual game among friends |
| D16 | Table list without server | Hosts of public tables advertise in a shared Trystero "lobby" room | No server needed |
| D17 | Late joiners | Seated only between games (`pending` list) | Keeps rotation fair and engine simple |
| D18 | Spectators | None in v1 (pending players only see lobby-ish info) | Scope |
| D19 | TypeScript version | `~6.0.3`, not 7.x | typescript-eslint 8.72 peer range `<6.1.0` |
| D20 | Action names for Trystero | `cmd`, `msg`, `ad` (≤ 12 bytes) | Older Trystero versions enforce 12-byte limit |
| D21 | First dealer | `seed % N` chosen by the host at `start` | Fair, deterministic for tests |
| D22 | Timers / turn clock | None | Friends at a table; disconnected players are waited for |
| D23 | Language | EN + DE dictionaries, default by browser | Game terms are German |

## Open (answer when relevant; default shown)

| ID | Question | Default until answered |
|---|---|---|
| Q1 | Should `Null` overbid use the bid-based rounding like suit games? | No (D4) |
| Q2 | Should spectators be supported? | No |
| Q3 | Host migration if the host leaves? | No; host snapshot resume only (Phase 9) |
| Q4 | Optional turn timer / auto-play for AFK players? | No |
| Q5 | Sound effects? | None |
| Q6 | Strong AI opponents? | No, random bots only |
