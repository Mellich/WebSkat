# 04 — Game Engine and Table Layer (pure TypeScript)

Part A = `src/engine` (one game). Part B = `src/table` (a table playing many games).
Rules and numbers: `03-skat-rules.md`. Both parts are **pure** (see `02-architecture.md` §1).
All exported data types are **JSON-serializable** (no classes, `Map`, `Set`, `Date`, `undefined`
in persisted fields) so state can be stored and sent. Use `readonly` everywhere; never mutate.

---

# Part A — `src/engine`

## A1. Core types (`types.ts`)

```ts
export type Suit = 'C' | 'S' | 'H' | 'D';                 // Clubs, Spades, Hearts, Diamonds
export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type CardId = `${Suit}${Rank}`;                    // 'CJ', 'S10', 'HA', 'D7'

export type Role = 'forehand' | 'middlehand' | 'hindhand';
export const ROLES: readonly Role[] = ['forehand', 'middlehand', 'hindhand']; // clockwise order

export type Announce = 'none' | 'schneider' | 'schwarz';

export type Declaration =
  | { readonly kind: 'suit'; readonly trump: Suit; readonly hand: boolean;
      readonly announce: Announce; readonly ouvert: boolean }
  | { readonly kind: 'grand'; readonly hand: boolean;
      readonly announce: Announce; readonly ouvert: boolean }
  | { readonly kind: 'null'; readonly hand: boolean; readonly ouvert: boolean };

export type GamePhase =
  | 'bidding' | 'skat-decision' | 'discarding' | 'declaring' | 'playing' | 'finished';

export type BidEvent =
  | { readonly role: Role; readonly type: 'bid'; readonly value: number }
  | { readonly role: Role; readonly type: 'hold' }
  | { readonly role: Role; readonly type: 'pass' }
  | { readonly role: Role; readonly type: 'claim' };

export type BiddingStage = 1 | 2 | 'claim' | 'done' | 'passed-in';

export interface BiddingState {
  readonly stage: BiddingStage;
  readonly caller: Role;              // stage 1: middlehand; stage 2: hindhand; 'claim': forehand
  readonly listener: Role;            // stage 1: forehand;  stage 2: stage-1 survivor
  readonly awaiting: 'caller' | 'listener';
  readonly currentBid: number | null;
  readonly history: readonly BidEvent[];
}

export interface TrickPlay { readonly role: Role; readonly card: CardId }
export interface Trick { readonly leader: Role; readonly plays: readonly TrickPlay[] }
export interface CompletedTrick extends Trick { readonly winner: Role }

export type GameAction =
  | { readonly type: 'bid'; readonly value: number }
  | { readonly type: 'hold' }
  | { readonly type: 'pass' }
  | { readonly type: 'claim' }
  | { readonly type: 'pickup-skat' }
  | { readonly type: 'play-hand' }
  | { readonly type: 'discard'; readonly cards: readonly [CardId, CardId] }
  | { readonly type: 'declare'; readonly declaration: Declaration }
  | { readonly type: 'play'; readonly card: CardId };

export interface GameState {
  readonly phase: GamePhase;
  readonly hands: Readonly<Record<Role, readonly CardId[]>>;         // current cards in hand
  readonly initialHands: Readonly<Record<Role, readonly CardId[]>>;  // as dealt (10 each)
  readonly skat: readonly CardId[];                                   // as dealt (2), never changes
  readonly bidding: BiddingState;
  readonly declarer: Role | null;
  readonly bid: number | null;
  readonly pickedUpSkat: boolean;
  readonly discarded: readonly CardId[];                              // [] until discarded
  readonly declaration: Declaration | null;
  readonly trick: Trick;                                              // current (possibly empty) trick
  readonly tricks: readonly CompletedTrick[];                         // completed tricks, in order
  readonly turn: Role | null;                                         // who must act now
  readonly result: GameResult | null;                                 // set when phase = 'finished'
}

export type GameResult =
  | { readonly kind: 'passed-in' }
  | {
      readonly kind: 'played';
      readonly declarer: Role;
      readonly bid: number;
      readonly declaration: Declaration;
      readonly spitzen: { readonly with: boolean; readonly count: number } | null; // null for Null
      readonly declarerPoints: number;     // 0 for Null
      readonly defenderPoints: number;     // 0 for Null
      readonly declarerTricks: number;
      readonly defenderTricks: number;
      readonly schneider: boolean;         // schneiderAchieved (false for Null)
      readonly schwarz: boolean;           // schwarzAchieved   (false for Null)
      readonly base: number;               // 9..12, 24, or the Null value
      readonly multiplier: number | null;  // null for Null
      readonly gameValue: number;
      readonly playedWon: boolean;
      readonly overbid: boolean;
      readonly won: boolean;
      readonly loseValue: number | null;   // value that is doubled when lost; null when won
      readonly declarerScore: number;      // standard counting, see 03 §10.5
    };

export type GameErrorCode =
  | 'WRONG_PHASE' | 'NOT_YOUR_TURN' | 'ILLEGAL_BID' | 'CANNOT_HOLD'
  | 'INVALID_DISCARD' | 'INVALID_DECLARATION' | 'ILLEGAL_CARD' | 'UNKNOWN_CARD';

export type Result<T, E extends string = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: E; readonly message: string } };
```

## A2. Modules and functions

### `cards.ts`
```ts
export const SUITS: readonly Suit[];  export const RANKS: readonly Rank[];
export const ALL_CARDS: readonly CardId[];                 // 32, stable order
export function card(suit: Suit, rank: Rank): CardId;
export function suitOf(c: CardId): Suit;
export function rankOf(c: CardId): Rank;                   // careful: '10' has 2 chars → slice(1)
export function isCardId(s: string): s is CardId;
export function cardPoints(c: CardId): number;             // A11 10:10 K4 Q3 J2 else 0
export function sumPoints(cs: readonly CardId[]): number;
export function sortHand(cards: readonly CardId[], decl: Declaration | null): CardId[];
```
`sortHand` (display order, pure): `decl === null` or suit/grand → Jacks first (`CJ SJ HJ DJ`), then
(suit game) trump suit `A 10 K Q 9 8 7`, then the remaining suits in order `C H S D` (alternating
colors), each `A 10 K Q 9 8 7`. For Null (`decl.kind === 'null'`) no jack group; suits in order
`C H S D`, each `A K Q J 10 9 8 7`.

### `rng.ts`
```ts
export function mulberry32(seed: number): () => number;            // returns floats in [0,1)
export function shuffle<T>(items: readonly T[], seed: number): T[]; // Fisher–Yates, returns new array
```
Mulberry32 reference:
```ts
export function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```
(The closure-local `a` is internal state of a *generator*, not shared module state — allowed.)
Fisher–Yates: `for i = n-1 down to 1: j = floor(rand() * (i+1)); swap(i, j)` on a copy.

### `deck.ts`
```ts
export function deal(seed: number): {
  hands: Record<Role, CardId[]>; skat: CardId[];
}
```
`deck = shuffle(ALL_CARDS, seed)`; deal order per 03 §3: indices
`0-2 → forehand, 3-5 → middlehand, 6-8 → hindhand, 9-10 → skat, 11-14 → F, 15-18 → M, 19-22 → H,
23-25 → F, 26-28 → M, 29-31 → H`.

### `trump.ts`
```ts
export type PlayMode = { kind: 'suit'; trump: Suit } | { kind: 'grand' } | { kind: 'null' };
export function modeOf(decl: Declaration): PlayMode;
export function isTrump(c: CardId, mode: PlayMode): boolean;
export function effectiveSuit(c: CardId, mode: PlayMode): Suit | 'trump';
export function cardStrength(c: CardId, mode: PlayMode): number;   // higher wins within same effectiveSuit
export function trickWinner(trick: Trick, mode: PlayMode): Role;
export function legalCards(hand: readonly CardId[], trick: Trick, mode: PlayMode): CardId[];
```
`cardStrength` tables:
- trump jacks: `CJ=200, SJ=199, HJ=198, DJ=197`
- trump-suit cards (suit game): `A=111 10=110 K=104 Q=103 9=100 8=99 7=98`  (any order-preserving numbers)
- plain suit cards: same numbers as above (compared only within the same effective suit)
- Null: `A=8 K=7 Q=6 J=5 10=4 9=3 8=2 7=1`.
`trickWinner`: take `plays`; if any `isTrump` → best by strength among trumps; else best by strength
among plays whose `effectiveSuit` equals the effective suit of `plays[0]`.
`legalCards`: if `trick.plays.length === 0` → whole hand; else `led = effectiveSuit(plays[0].card)`;
`followers = hand.filter(c => effectiveSuit(c) === led)`; return `followers.length ? followers : hand`.

### `spitzen.ts`
```ts
export function countSpitzen(twelve: readonly CardId[], mode: PlayMode): { with: boolean; count: number } | null;
```
`null` for Null mode. Sequence per 03 §7.

### `values.ts`
```ts
export const SUIT_BASE: Record<Suit, number>;  // C12 S11 H10 D9
export const GRAND_BASE = 24;
export function nullValue(d: { hand: boolean; ouvert: boolean }): 23 | 35 | 46 | 59;
export function baseValue(d: Declaration): number;
export const BID_VALUES: readonly number[];                 // 03 §4.1
export function declarationFloorValue(d: Declaration, spitzenCount: number | null): number;
export function gameMultiplier(d: Declaration, spitzen: number, schneider: boolean, schwarz: boolean): number;
```

### `declaration.ts`
```ts
export function validateDeclaration(d: Declaration, hand: boolean): Result<Declaration, 'INVALID_DECLARATION'>;
export function declarationOptions(hand: boolean): Declaration[];   // 7 (not hand) or 22 (hand) canonical entries
```
Validation per the table in 03 §5.1, plus `d.hand === hand`.

### `bidding.ts`
```ts
export function initialBidding(): BiddingState;
//  stage 1, caller 'middlehand', listener 'forehand', awaiting 'caller', currentBid null, history []
export function applyBid(b: BiddingState, role: Role, a: GameAction): Result<BiddingState, GameErrorCode>;
export function nextBidValue(currentBid: number | null): number | null; // 18, else next BID_VALUES entry > currentBid; null after 264
export function legalBidValues(b: BiddingState): number[];       // [nextBidValue] or [] (not a bid situation / after 264)
export function biddingOutcome(b: BiddingState):
  | { kind: 'running' } | { kind: 'declarer'; role: Role; bid: number } | { kind: 'passed-in' };
```
Transition table (implement as a `switch` on `stage`, `awaiting`, `action.type`):

| stage | awaiting | action | effect |
|---|---|---|---|
| 1 or 2 | caller | `bid v` (v === nextBidValue(currentBid); no jumps, 03 §4.1) | `currentBid = v`; awaiting = listener |
| 1 or 2 | caller | `pass` | caller out → **end of stage** (see below) |
| 1 or 2 | listener | `hold` (only if `currentBid !== null` and last event was a caller bid) | awaiting = caller |
| 1 or 2 | listener | `pass` | listener out → **end of stage** |
| `claim` | caller (=forehand) | `claim` | stage `done`, declarer forehand, bid 18 |
| `claim` | caller (=forehand) | `pass` | stage `passed-in` |

End of stage: let `survivor` = the one who did not pass.
- stage 1 → stage 2: `caller = hindhand`, `listener = survivor`, `awaiting = 'caller'`,
  `currentBid` unchanged.
- stage 2: if `currentBid !== null` → stage `done` (declarer = survivor, bid = currentBid).
  Else (no bid at all): stage `claim`, `caller = forehand`, `listener = forehand`, awaiting caller.
  (Only reachable when middlehand and hindhand passed immediately; the survivor is forehand.)

`history` is appended with every accepted action. Always compare `role` to who is expected;
mismatch → `NOT_YOUR_TURN`.

Check against the example table in 03 §4.2 — each row must be a unit test.

### `play.ts`
```ts
export function playCard(state: GameState, role: Role, card: CardId): Result<GameState, GameErrorCode>;
export function nextRole(r: Role): Role;                 // forehand→middlehand→hindhand→forehand
```
Steps: phase must be `playing`; `role === state.turn`; `card` in `hands[role]` else `ILLEGAL_CARD`;
`card ∈ legalCards(...)` else `ILLEGAL_CARD`; remove from hand, append to `trick.plays`.
If the trick now has 3 plays: `winner = trickWinner`; push `CompletedTrick`; new empty trick with
`leader = winner`; `turn = winner`. Then check end: Null and `winner === declarer` → finish;
or `tricks.length === 10` → finish. Finish = `phase 'finished'`, `turn null`,
`result = scoreGame(state)`.
If the trick is incomplete: `turn = nextRole(role)`.

### `scoring.ts`
```ts
export function scoreGame(state: GameState): GameResult;   // state must be a finished 'played' game
export function skatPointsForDeclarer(state: GameState): number;
//   pickedUpSkat ? sumPoints(discarded) : sumPoints(skat)
```
Algorithm exactly per 03 §8–§10. `spitzen` is computed from
`[...initialHands[declarer], ...skat]` (12 cards). Unit tests: all vectors in 03 §10.7 — to make
them easy, also export a **pure helper** that takes plain numbers:
```ts
export interface ScoreInput {
  declaration: Declaration; bid: number; spitzen: number;       // spitzen.count (0 for null)
  declarerPoints: number; declarerTricks: number;
}
export function computeScore(i: ScoreInput): Omit<GameResult & {kind:'played'}, 'declarer'|'declaration'|'spitzen'|'declarerTricks'|'defenderTricks'|'declarerPoints'|'defenderPoints'|'bid'>;
```
(Simplify the type as you see fit — the point is that tests call `computeScore` with the table's
inputs without having to play a game.)

### `game.ts` — the reducer
```ts
export function newGame(seed: number): GameState;
export function applyAction(state: GameState, role: Role, action: GameAction): Result<GameState, GameErrorCode>;
export function getLegal(state: GameState, role: Role): Legal;
export function enumerateActions(state: GameState, role: Role): GameAction[];   // for bots/tests
export function isFinished(state: GameState): boolean;
```
`newGame(seed)`: `deal(seed)`, phase `bidding`, `bidding = initialBidding()`, `turn = 'middlehand'`
(stage 1 caller). Note: the *first* to act is the **middlehand** (caller), not the forehand.

`applyAction` dispatch (any action in a wrong phase → `WRONG_PHASE`; right phase but wrong role →
`NOT_YOUR_TURN`):

| phase | actions | details |
|---|---|---|
| `bidding` | bid/hold/pass/claim | `applyBid`; then `biddingOutcome`: `declarer` → `phase='skat-decision'`, set `declarer`, `bid`, `turn=declarer`; `passed-in` → `phase='finished'`, `result={kind:'passed-in'}`, `turn=null`; `running` → `turn` = caller or listener per `awaiting` |
| `skat-decision` | `pickup-skat` | `hands[declarer] += skat` (12 cards), `pickedUpSkat = true`, `phase='discarding'` |
| | `play-hand` | `phase='declaring'` |
| `discarding` | `discard` | two **distinct** cards, both in declarer's 12; remove from hand, set `discarded`, `phase='declaring'`. Else `INVALID_DISCARD` |
| `declaring` | `declare` | `validateDeclaration(d, hand = !pickedUpSkat)`; set `declaration`, `phase='playing'`, `trick = {leader:'forehand', plays:[]}`, `turn='forehand'` |
| `playing` | `play` | `playCard` |
| `finished` | any | `WRONG_PHASE` |

`Legal` (info for the acting role; all fields optional, absent = not allowed):
```ts
export interface Legal {
  bidValues?: number[];        // caller may bid one of these (ascending)
  canPassBid?: boolean;        // caller or listener may pass (also in claim stage)
  canHold?: boolean;
  canClaim?: boolean;
  canPickUp?: boolean;         // skat-decision
  canPlayHand?: boolean;       // skat-decision
  discardFrom?: CardId[];      // the 12 cards, when discarding
  declarations?: Declaration[];// when declaring: declarationOptions(!pickedUpSkat)
  playableCards?: CardId[];    // when playing
}
```
`getLegal` returns `{}` if `role !== state.turn`.

## A3. Engine test requirements
See `09-testing.md` §2. Summary: unit tests for every function above; the 20 scoring vectors;
trick/legal tables from 03 §6; the bidding example table; a **fuzz test** playing 2000 random games
to completion with `enumerateActions` asserting invariants:
`declarerPoints + defenderPoints === 120` (suit/grand), every card appears exactly once among
hands + skat + tricks, no action returned by `enumerateActions` is rejected by `applyAction`,
and rejected actions never change the state.

---

# Part B — `src/table`

The table owns everything that survives between games. It is a **reducer**:
`applyCommand(state, actorId, command, ctx) → Result<{ state, record? }>`.

## B1. Types (`types.ts`)

```ts
export type PlayerId = string;       // uuid-like, generated by the host on join

export interface Player {
  readonly id: PlayerId;
  readonly name: string;             // 1..20 chars, trimmed, unique at the table
  readonly connected: boolean;
  readonly isBot: boolean;
}

export type TableStatus = 'lobby' | 'in-game';   // 'in-game' while `game !== null` (incl. finished, waiting for ready)

export interface ActiveGame {
  readonly number: number;                              // 1-based, counts every dealt game
  readonly engine: GameState;
  readonly roles: Readonly<Record<Role, PlayerId>>;
  readonly sittingOut: readonly PlayerId[];
  readonly dealerId: PlayerId;
  readonly seed: number;                                // SECRET (host only)
  readonly seatsAtDeal: number;                         // N when dealt (for Seeger bonus)
  readonly recorded: boolean;                           // record already created
}

export interface TableState {
  readonly key: string;
  readonly name: string;
  readonly isPublic: boolean;
  readonly hostId: PlayerId;
  readonly maxSeats: number;                            // 3..6
  readonly botLevel: BotLevel;                          // 'easy' | 'normal' | 'strong', set at creation (14-bots.md)
  readonly status: TableStatus;
  readonly players: readonly Player[];                  // index = seat (clockwise)
  readonly pending: readonly Player[];                  // joined while a game runs; seated after it
  readonly nextDealerIdx: number;                       // seat index of the NEXT dealer
  readonly gameCounter: number;                         // number of games dealt so far (incl. aborted)
  readonly game: ActiveGame | null;
  readonly ready: readonly PlayerId[];                  // who pressed "continue" after the finished game
  readonly records: readonly GameRecord[];              // see 07-statistics.md
  readonly seq: number;                                 // increments on every state change
}

export type TableCommand =
  | { readonly type: 'start' }                          // host: lobby → first game
  | { readonly type: 'game'; readonly action: GameAction }
  | { readonly type: 'ready' }                          // after a finished game
  | { readonly type: 'abort-game' }                     // host: discard running game, no record
  | { readonly type: 'kick'; readonly playerId: PlayerId }  // host; lobby or finished/no game only
  | { readonly type: 'add-bot' }                        // host; lobby or finished/no game only
  | { readonly type: 'leave' };

export interface Ctx { readonly now: number; readonly seed: number }

export type TableErrorCode = GameErrorCode
  | 'NOT_HOST' | 'NOT_SEATED' | 'NOT_ACTIVE_PLAYER' | 'WRONG_STATUS' | 'TOO_FEW_PLAYERS'
  | 'TABLE_FULL' | 'UNKNOWN_PLAYER' | 'GAME_RUNNING';
```

## B2. Functions

```ts
// table.ts
export function createTable(args: { key: string; name: string; isPublic: boolean;
  hostId: PlayerId; hostName: string; maxSeats: number; botLevel?: BotLevel /* default 'normal' */ }): TableState;
export function addPlayer(s: TableState, p: { id: PlayerId; name: string; isBot?: boolean }):
  Result<TableState, 'TABLE_FULL'>;
  // lobby or no running game → seat immediately; game running → `pending`.
  // Full = players.length + pending.length >= maxSeats.
export function setConnected(s: TableState, id: PlayerId, connected: boolean): TableState;
export function applyCommand(s: TableState, actor: PlayerId, c: TableCommand, ctx: Ctx):
  Result<{ state: TableState; record: GameRecord | null }, TableErrorCode>;
export function uniqueName(existing: readonly string[], wanted: string): string;  // "Anna", "Anna (2)"

// rotation.ts
export function rolesForDealer(players: readonly Player[], dealerIdx: number):
  { roles: Record<Role, PlayerId>; sittingOut: PlayerId[]; dealerId: PlayerId };
export function pickFirstDealer(seed: number, n: number): number;     // seed % n

// records.ts   → see 07-statistics.md
export function makeRecord(table: TableState, game: ActiveGame, ctx: Ctx): GameRecord;

// view.ts      → see B4
export function viewFor(s: TableState, viewer: PlayerId): TableView;

// bot.ts
export function botAction(game: GameState, role: Role, rand: () => number): GameAction;
export function runBots(s: TableState, ctx: () => Ctx, rand: () => number): TableState;
//  while the player to act is a bot: apply botAction through applyCommand. Also auto-'ready' bots.
```

### `applyCommand` rules

| command | who | allowed when | effect |
|---|---|---|---|
| `start` | host | `status==='lobby'`, `players.length >= 3` | `nextDealerIdx = pickFirstDealer(ctx.seed, N)`; then `dealNext` |
| `game` | an **active** player of the running game (look up role by `playerId`) | `game !== null && phase !== 'finished'` | `engine.applyAction(game.engine, role, action)`; if result `finished` → create the record (once), `recorded = true`, `ready = bots` |
| `ready` | any seated player | `game !== null && phase === 'finished'` | add to `ready`; if every seated **connected** human is in `ready` → `dealNext` |
| `abort-game` | host | `game !== null && phase !== 'finished'` | discard the running game (no record), then immediately `dealNext` (the dealer pointer already advanced when that game was dealt) |
| `kick` | host | `game === null` or `phase==='finished'` | remove player (seat or pending) via `removePlayer`; if `players.length < 3` → `game = null`, `status = 'lobby'` |
| `add-bot` | host | same as kick; seats free | `addPlayer({ isBot: true, name: 'Bot 1'… })` |
| `leave` | any | seated: only if `game === null` or finished → `removePlayer`; if a game is running → just `connected=false` (they may rejoin); pending → removed |

`dealNext(state, ctx)`:
1. Move `pending` into `players` (append). If `players.length < 3` → `status='lobby'`, `game=null`.
2. `dealerIdx = nextDealerIdx % N`; `nextDealerIdx = (dealerIdx + 1) % N`.
3. `rolesForDealer(players, dealerIdx)`; `engine = newGame(ctx.seed)`; `gameCounter += 1`;
   `number = gameCounter`; `ready = bots`.
4. `status = 'in-game'`.

`removePlayer(state, id)`: removes from `players` or `pending`; if a seat `i` was removed:
`if (i < nextDealerIdx) nextDealerIdx -= 1`; then `nextDealerIdx %= max(1, players.length)`.
The host cannot be kicked.

`ready` bookkeeping: bots are always ready. The *connected human* condition means a disconnected
player does not block the next deal; the new game simply waits on their turn when it comes (see
view `waitingFor`).

## B3. Bots (`bot.ts`, `bot/`)

Three levels, chosen per table at creation (`TableState.botLevel`, default `normal`). The full spec
is in `14-bots.md`:
- **easy**: `botAction` picks **uniformly at random** among `enumerateActions(game, role)`. In bidding
  it prefers `pass` with probability 0.6 and otherwise picks the legal bid (always the single next
  value, 03 §4.1), hold or claim.
- **normal**: bids, holds or claims up to the value of its best playable game from a hand
  evaluation. Rule-based Skat decision, discard and declaration. Heuristic card play that maximizes
  its team's card points (Null: declarer avoids tricks, defenders force one).
- **strong**: like normal, plus Monte-Carlo sampling of the hidden cards (Skat estimate for bidding;
  for card play, rollouts with the normal heuristics).

Bots only see a `BotView` (no hidden cards). Every chosen action is checked against
`enumerateActions`. All randomness comes from the injected `rand`. Bots are also used for fuzz tests,
demos, e2e tests and "Add bot". The UI labels bots with a robot icon and the level.

## B4. Views (`view.ts`) — redaction

```ts
export interface PlayerPublic { id: PlayerId; name: string; connected: boolean; isBot: boolean; seat: number }

export interface ViewLegal {            // for the viewer, only when it is the viewer's turn
  bidValues?: number[]; canPassBid?: boolean; canHold?: boolean; canClaim?: boolean;
  canPickUp?: boolean; canPlayHand?: boolean;
  discardFrom?: CardId[]; declarations?: Declaration[]; playableCards?: CardId[];
}

export interface ViewTrick { leaderId: PlayerId; plays: { playerId: PlayerId; card: CardId }[] }

export interface GameView {
  number: number;
  phase: GamePhase;
  dealerId: PlayerId;
  roles: Record<Role, PlayerId>;
  sittingOut: PlayerId[];
  turnId: PlayerId | null;
  waitingFor: PlayerId | null;          // turnId if that player is disconnected, else null
  bidding: {
    stage: BiddingStage; callerId: PlayerId; listenerId: PlayerId;
    currentBid: number | null;
    history: { playerId: PlayerId; type: 'bid' | 'hold' | 'pass' | 'claim'; value?: number }[];
  };
  declarerId: PlayerId | null;
  bid: number | null;
  pickedUpSkat: boolean;
  declaration: Declaration | null;
  myHand: CardId[];                     // viewer's own cards ([] when sitting out/pending)
  openHands: Record<PlayerId, CardId[]>;// only the ouvert declarer's current hand (phase playing/finished)
  handCounts: Record<PlayerId, number>; // for the three active players
  skat: CardId[] | null;                // declarer after pickup (phase discarding/declaring) or everybody when finished (not passed-in)
  discarded: CardId[] | null;           // everybody when finished
  trick: ViewTrick;
  lastTrick: (ViewTrick & { winnerId: PlayerId }) | null;
  tricksWon: Record<PlayerId, number>;
  legal: ViewLegal;
  result: ViewResult | null;            // finished: GameResult with roles replaced by player ids
  spitzen: { with: boolean; count: number } | null;  // declarer only while declaring; null otherwise (everybody gets it inside `result` when finished)
}

export interface TableView {
  seq: number;
  table: {
    key: string; name: string; hostId: PlayerId; maxSeats: number; botLevel: BotLevel; status: TableStatus;
    players: PlayerPublic[]; pending: PlayerPublic[];
    nextDealerId: PlayerId | null; readyIds: PlayerId[];
  };
  you: { id: PlayerId; seat: number | null;
         role: Role | 'sitting-out' | 'pending' | 'lobby' };
  game: GameView | null;
}
```
The declaring UI shows, per declaration option, the guaranteed minimum value
`declarationFloorValue(option, view.spitzen.count)` (pure engine helper) next to the bid, so the
declarer sees whether the game can still be overbid. `spitzen` is computed on the declarer's 12
original cards in `view.ts` (host side) — the UI never needs hidden cards for this.

Redaction rules: exactly the table in `02-architecture.md` §3. Implementation hints:
- Start from an *empty* GameView and add only allowed things (allow-list, never "copy then delete").
- `myHand`: `engine.hands[viewerRole]` if the viewer is active.
- `openHands`: if `declaration?.ouvert && (phase==='playing'||phase==='finished')` →
  `{[declarerId]: engine.hands[declarerRole]}`.
- `legal` = `getLegal(engine, viewerRole)` mapped 1:1 (empty object for non-active viewers or when
  it is not their turn).
- `handCounts` and `tricksWon` are public.
- `seed`, `initialHands`, other players' `hands` must **never** be read in the "public" branch.

## B5. Table test requirements
`09-testing.md` §3: dealer rotation for N=3..6, pending/seating, removePlayer index maths,
`ready` logic, abort, view redaction property test, records for passed-in games, bot-driven full
tables (3, 4, 5, 6 players, 50 games each) that always terminate with consistent records.
