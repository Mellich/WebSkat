# Engine (`src/engine`): one Skat game

Pure TypeScript (`architecture.md` §1). Rules and numbers: `skat-rules.md`. File map and folder
rules: `src/engine/AGENTS.md`. The public API is everything re-exported by
`src/engine/index.ts`; `testing.ts` is test-only and not exported.

## 1. Core types (`types.ts`, read the file for exact definitions)

| Type | Meaning |
|---|---|
| `Suit` = `'C' \| 'S' \| 'H' \| 'D'` | Clubs, Spades, Hearts, Diamonds |
| `Rank` = `'7' … '10', 'J', 'Q', 'K', 'A'` | `'10'` has two characters: rank = `id.slice(1)`, suit = `id[0]` |
| `CardId` = `` `${Suit}${Rank}` `` | e.g. `'CJ'`, `'S10'`, `'HA'` |
| `Role` | `'forehand' \| 'middlehand' \| 'hindhand'`; `ROLES` lists them in play order |
| `Declaration` | `{kind:'suit', trump, hand, announce, ouvert}` \| `{kind:'grand', hand, announce, ouvert}` \| `{kind:'null', hand, ouvert}` |
| `TrumpDeclaration` | the suit/grand members (have a multiplier) |
| `GamePhase` | `'bidding' \| 'skat-decision' \| 'discarding' \| 'declaring' \| 'playing' \| 'finished'` |
| `BiddingState` | `stage` (`1 \| 2 \| 'claim' \| 'done' \| 'passed-in'`), `caller`, `listener`, `awaiting`, `currentBid`, `history` |
| `GameAction` | `bid{value}`, `hold`, `pass`, `claim`, `pickup-skat`, `play-hand`, `discard{cards:[a,b]}`, `declare{declaration}`, `play{card}` |
| `GameState` | `phase`, `hands`, `initialHands` (as dealt), `skat` (as dealt, never changes), `bidding`, `declarer`, `bid`, `pickedUpSkat`, `discarded`, `declaration`, `trick`, `tricks`, `turn`, `result`, `options` (`GameOptions`), `ramsch` (true while/after a Ramsch) |
| `GameOptions` | `{ ramschOnPassIn }`; `DEFAULT_GAME_OPTIONS` = off. Set per game at deal time from the table rules (`table.md` §1) |
| `GameResult` | `{kind:'passed-in'}`, `{kind:'played', …}` with points, tricks, flags, `base`, `multiplier`, `gameValue`, `playedWon`, `overbid`, `won`, `loseValue`, `declarerScore` (standard counting), or `{kind:'ramsch', points, tricks, skatTo, losers, jungfrau, durchmarsch, scores}` (skat-rules §12) |
| `Result<T, E>` | `{ok:true, value}` \| `{ok:false, error:{code, message}}`; helpers `ok()`, `err()`, `assertNever()` |

## 2. State machine

```
newGame(seed): phase 'bidding', turn = middlehand (the first caller!)
bidding ──(all pass, forehand passes in claim stage)──▶ finished (result passed-in)
   │                                                     (options.ramschOnPassIn: ▶ playing, ramsch = true, §12)
   │ declarer + bid
   ▼
skat-decision ──pickup-skat──▶ discarding ──discard──▶ declaring
   │ play-hand                                            ▲
   └──────────────────────────────────────────────────────┘
declaring ──declare──▶ playing (leader = forehand) ──10 tricks, or Null declarer takes a trick──▶ finished
```

## 3. The reducer (`game.ts`)

```ts
newGame(seed: number, options: GameOptions = DEFAULT_GAME_OPTIONS): GameState
applyAction(state, role, action): Result<GameState, GameErrorCode>
getLegal(state, role): Legal                 // {} when role is not on turn      (legal.ts)
enumerateActions(state, role): GameAction[]  // derived from getLegal; [] when not on turn  (legal.ts)
isFinished(state): boolean
```

`legal.ts` holds `Legal`, `getLegal` and `enumerateActions` (re-exported from `game.ts`).

Checks in `applyAction`: the phase first (an action that does not belong to the phase →
`WRONG_PHASE`), then the role (`NOT_YOUR_TURN`), then the action itself.

| Phase | Action | Effect |
|---|---|---|
| `bidding` | `bid`/`hold`/`pass`/`claim` | `applyBid` (§4). Outcome `declarer` → phase `skat-decision`, set `declarer`, `bid`, `turn = declarer`. Outcome `passed-in` → phase `finished`, `result = {kind:'passed-in'}`, `turn = null`; with `options.ramschOnPassIn` instead: phase `playing`, `ramsch = true`, `trick` led by forehand, `turn = 'forehand'` (no declarer, no bid) |
| `skat-decision` | `pickup-skat` | declarer's hand += Skat (12 cards), `pickedUpSkat = true`, phase `discarding` |
| | `play-hand` | phase `declaring` |
| `discarding` | `discard` | two distinct cards from the 12; removed from the hand, stored in `discarded`; phase `declaring`. Else `INVALID_DISCARD` |
| `declaring` | `declare` | `validateDeclaration(d, hand = !pickedUpSkat)`; phase `playing`, `trick = {leader:'forehand', plays:[]}`, `turn = 'forehand'` |
| `playing` | `play` | `playCard` (§5) |
| `finished` | any | `WRONG_PHASE` |

`Legal` (all fields optional; absent = not allowed): `bidValues` (one value at most, strict
bidding), `canPassBid`, `canHold`, `canClaim`, `canPickUp`, `canPlayHand`, `discardFrom` (the 12
cards), `declarations` (`declarationOptions(!pickedUpSkat)`: 7 or 22 entries), `playableCards`.
The view passes `Legal` unchanged to the viewer (`table.md` §6), and the UI enables exactly these
options.

## 4. Bidding (`bidding.ts`)

```ts
initialBidding(): BiddingState      // stage 1, caller middlehand, listener forehand, awaiting caller
nextBidValue(current: number | null): number | null   // 18, else next BID_VALUES entry; null after 264
legalBidValues(b): number[]          // [nextBidValue] when the caller must act in stage 1/2, else []
applyBid(b, role, action): Result<BiddingState, GameErrorCode>
biddingOutcome(b): {kind:'running'} | {kind:'declarer', role, bid} | {kind:'passed-in'}
```

| Stage | Awaiting | Action | Effect / error |
|---|---|---|---|
| 1, 2 | caller | `bid v` | only `v === nextBidValue(currentBid)` (no jumps); else `ILLEGAL_BID`. `currentBid = v`, awaiting listener |
| 1, 2 | caller | `pass` | caller out → end of stage, listener survives |
| 1, 2 | listener | `hold` | needs a standing bid, else `CANNOT_HOLD`; awaiting caller |
| 1, 2 | listener | `pass` | listener out → end of stage, caller survives |
| 1, 2 | listener | `bid` | `ILLEGAL_BID` |
| 1, 2 | any | `claim` | `ILLEGAL_BID` |
| `claim` | caller (forehand) | `claim` | stage `done`, `currentBid = 18` |
| `claim` | caller | `pass` | stage `passed-in` |
| `claim` | caller | `bid` / `hold` | `ILLEGAL_BID` / `CANNOT_HOLD` |
| `done`, `passed-in` | — | any | `WRONG_PHASE` |

End of stage: stage 1 → stage 2 with `caller = hindhand`, `listener = survivor`, `currentBid`
kept. Stage 2 with a bid → `done` (`caller` field = the declarer). Stage 2 without any bid →
`claim` stage (caller = listener = forehand). Every accepted action is appended to `history`.

## 5. Card play (`trump.ts`, `play.ts`)

```ts
type PlayMode = {kind:'suit', trump} | {kind:'grand'} | {kind:'null'}
modeOf(decl): PlayMode
isTrump(card, mode); effectiveSuit(card, mode): Suit | 'trump'
cardStrength(card, mode): number     // compare only within one effective suit
trickWinner(trick, mode): Role       // empty trick → leader
legalCards(hand, trick, mode): CardId[]   // empty trick → whole hand; else follow effective suit if possible
playCard(state, role, card): Result<GameState, GameErrorCode>
nextRole(role): Role                 // forehand → middlehand → hindhand → forehand
```

`playCard`: phase `playing` with a play mode (`playModeOf`, below), role on turn, card in hand and
in `legalCards` (else `ILLEGAL_CARD`). After the third card: winner leads the next trick. The game
finishes when 10 tricks are done, or in Null when the declarer wins a trick. Finishing sets
`phase = 'finished'`, `turn = null`, `result = scoreGame(state)`.

`playModeOf(state)` (`ramsch.ts`): the declaration's mode; in a Ramsch (`declaration` null,
`ramsch` true) it is `{kind:'grand'}`, so only the Jacks are trump; `null` outside card play. The
reducer and `getLegal` use it instead of `state.declaration`.

## 6. Values and scoring (`values.ts`, `spitzen.ts`, `scoring.ts`, `declaration.ts`)

| Function | Notes |
|---|---|
| `SUIT_BASE` (C12 S11 H10 D9), `GRAND_BASE` 24, `nullValue(d)` 23/35/46/59, `baseValue(d)` | `skat-rules.md` §10.1 |
| `BID_VALUES` | 63 values, 18 … 264 (`skat-rules.md` §4.1) |
| `gameMultiplier(d: TrumpDeclaration, spitzen, schneider, schwarz)` | §10.2 |
| `declarationFloorValue(d, spitzenCount)` | minimum value without achieved Schneider/Schwarz; only for the UI hint and bots |
| `countSpitzen(twelve, mode)` | from the declarer's original 10 cards + the Skat; `null` for Null |
| `validateDeclaration(d, hand)`, `declarationOptions(hand)` | §5.1 matrix; 7 options (not hand) / 22 (hand) |
| `computeScore(input)` | pure number version used by the scoring tests (§10.7 vectors) |
| `scoreGame(state)` | full `GameResult`; `state.ramsch` → `scoreRamsch`; a state without declarer/bid/declaration gives `passed-in` |
| `scoreRamsch(state)` | Ramsch result: card points per player (the Skat counts for the last trick winner), tricks, losers, Jungfrau, Durchmarsch (`ramsch.ts`) |
| `ramschScores(points, tricks)` | numbers in: losers, Jungfrau, Durchmarsch and scores (skat-rules §12.4); used by the R1–R5 tests |
| `skatPointsForDeclarer(state)` | discarded cards if picked up, else the Skat |

Other helpers: `cards.ts` (`ALL_CARDS`, `SUITS` = `['C','H','S','D']`, `RANKS`, `card`, `suitOf`,
`rankOf`, `isCardId`, `cardPoints`, `sumPoints`, `sortHand`), `rng.ts` (`mulberry32(seed)`,
`shuffle(items, seed)` Fisher–Yates), `deck.ts` (`deal(seed)`: indices 0–2 F, 3–5 M, 6–8 H, 9–10
Skat, 11–14 F, 15–18 M, 19–22 H, 23–25 F, 26–28 M, 29–31 H).

`sortHand(cards, decl)` (display only): no declaration, suit or Grand → Jacks `CJ SJ HJ DJ`, then
the trump suit (suit game), then the other suits in the order C, H, S, D, each `A 10 K Q 9 8 7`.
Null → suits C, H, S, D, each `A K Q J 10 9 8 7`.

Error codes (`GameErrorCode`): `WRONG_PHASE`, `NOT_YOUR_TURN`, `ILLEGAL_BID`, `CANNOT_HOLD`,
`INVALID_DISCARD`, `INVALID_DECLARATION`, `ILLEGAL_CARD`, `UNKNOWN_CARD`.

## 7. Invariants (checked by `game.fuzz.test.ts`, 2000 seeded games)

- Every action from `enumerateActions` is accepted by `applyAction`.
- Rejected actions leave the state deep-equal to the old state.
- All 32 cards are always in exactly one place (hands, Skat/discard, tricks).
- Finished suit/grand games: `declarerPoints + defenderPoints === 120`.
- Null games end at the declarer's first trick.
- `declarerScore` matches `won` and `loseValue`.
- Ramsch (`ramsch.fuzz.test.ts`, 500 seeds with `ramschOnPassIn`): all 10 tricks, card points add up
  to 120, the Skat points go to the last trick winner, `scores` equal `ramschScores` of the result.
- Default options never produce a Ramsch (`game.fuzz.test.ts`).
