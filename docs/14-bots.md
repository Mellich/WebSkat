# 14 — Bots with selectable strength (Phase 13)

Detailed spec for **Phase 13** in `08-implementation-plan.md`. Start it only after Phase 12 (the strict
bidding of `03` §4.1 is assumed). Everything in this file is **pure TypeScript in `src/table/bot/`**
(rules of `AGENTS.md` §3 apply: no `Math.random`, no `Date.now`, randomness via the injected
`rand: () => number`, immutable data).

## 1. Goals and levels

The host picks the bot strength **when creating the table**. It applies to every bot at that table.

| Level | id | Bidding / Skat / declaring | Card play |
|---|---|---|---|
| Easy | `easy` | today's random bot (pass with p = 0.6, otherwise bid/hold/claim) | uniformly random legal card |
| Normal (default) | `normal` | hand evaluation (§4): bids up to the value of its best playable game | rule-based heuristics (§5) for its team |
| Strong | `strong` | like Normal, but the Skat is estimated by sampling (§6.3) | Monte-Carlo sampling of the hidden cards + rollouts with the Normal heuristics (§6) |

"Maximize the team's points" means:
- **Suit and Grand games**: the declarer maximizes its own card points. The two defenders together
  maximize the defenders' card points. Crossing the 61 / 90 / 120 thresholds gives an extra bonus
  (§6.2).
- **Null**: the declarer tries to take no trick. The defenders try to force the declarer to take one.

## 2. Fair play: bots must not see hidden cards

The host holds the full `GameState`, but a bot may use only what a human in its seat would know.
This is enforced by types: strategy code never receives a `GameState`, only a `BotView`:

```ts
// src/table/bot/knowledge.ts
export interface BotView {
  readonly role: Role;
  readonly phase: GamePhase;
  readonly hand: readonly CardId[];               // own current cards
  readonly declarer: Role | null;
  readonly declaration: Declaration | null;
  readonly bid: number | null;
  readonly bidding: BiddingState;                 // public
  readonly pickedUpSkat: boolean;
  readonly ownSkat: readonly CardId[];            // declarer after pickup: the 2 Skat cards; else []
  readonly ownDiscard: readonly CardId[];         // declarer after discarding; else []
  readonly trick: Trick;                          // current trick
  readonly tricks: readonly CompletedTrick[];     // completed tricks (public)
  readonly openHands: Partial<Record<Role, readonly CardId[]>>; // ouvert declarer's cards
  readonly handCounts: Readonly<Record<Role, number>>;
  readonly voids: Readonly<Record<Role, readonly (Suit | 'trump')[]>>; // known from failing to follow
  readonly legal: Legal;                          // getLegal(game, role)
}
export function botViewOf(game: GameState, role: Role): BotView;
```

- `botViewOf` is the **only** bot function that reads `GameState`. It copies the fields above and
  nothing else. `voids` is worked out from `tricks` + `trick`: a player who did not follow the led
  effective suit (`effectiveSuit` from `trump.ts`, needs the declaration) is void in it.
- Every strategy function takes `(view: BotView, rand)`.
- Test (`knowledge.test.ts`): for random seeds and every role/phase, take two games that differ only
  in cards the role cannot know (swap cards between the other players' hidden hands, and the Skat
  when it is unknown to the role). `botViewOf` must give equal views (`toEqual`), and so must the
  chosen action at level `normal` and `strong` with the same `rand` seed.

## 3. Module layout (`src/table/bot/`, each file < 300 lines)

| File | Content |
|---|---|
| `index.ts` | `botAction(game, role, level, rand): GameAction` dispatcher. Builds the `BotView`, calls the level's strategy, **checks the result against `enumerateActions(game, role)`**, and falls back to a random legal action if it is not there (tests assert the fallback never happens) |
| `knowledge.ts` | `PlayView` (what card play needs; also built by `simulate.ts`), `BotView extends PlayView` (+ phase, bid, bidding, Skat, counts, `legal`, `actions`), `botViewOf`, `voidsOf` |
| `cardsLeft.ts` | helpers on a `BotView`: `unknownCards(view)`, `remainingTrumps(view)`, `isTopRemaining(card, view)` (no higher card of the same effective suit is unplayed and outside own hand), `teamOf(role, view)`, `partnerOf(role, view)` |
| `easy.ts` | the current random logic (moved from `bot.ts`) |
| `evaluate.ts` | hand evaluation, best game, maximum bid (§4) |
| `auction.ts` | Normal/Strong decisions for `bid`/`hold`/`pass`/`claim`, Skat decision, discard, declare (§4) |
| `heuristics.ts` | Normal card play (§5) |
| `simulate.ts` | light play-out of a full-information deal using engine primitives (`legalCards`, `trickWinner`, `cardPoints`). Does not build a `GameState` |
| `sample.ts` | random hidden-card deals consistent with a `BotView` (§6.1) |
| `strong.ts` | Strong card play and Strong Skat estimate (§6) |
| `tuning.ts` | all numeric constants (weights, thresholds, sample counts) in one place |
| `arena.ts` | test support (not exported): engine-only games between levels (`playGame`, `match`), `envFlag`, `nowMs` |

`src/table/bot.ts` keeps `botStep` and `runBots`. They read
`s.botLevel` and call `botAction` from `bot/index.ts`. Engine helpers to reuse: `legalCards`,
`trickWinner`, `cardStrength`, `effectiveSuit`, `isTrump`, `modeOf` (`trump.ts`), `cardPoints`,
`sumPoints`, `suitOf`, `rankOf` (`cards.ts`), `countSpitzen` (`spitzen.ts`),
`declarationFloorValue`, `baseValue`, `nullValue` (`values.ts`), `nextBidValue` (`bidding.ts`).
Export anything missing from `src/engine/index.ts`. Do not copy rule logic into the bot.

## 4. Bidding, Skat and declaring (Normal; Strong adds §6.3)

### 4.1 Hand evaluation (`evaluate.ts`)
`evaluateGame(cards: readonly CardId[], game: 'C'|'S'|'H'|'D'|'grand'|'null', hand: boolean): { playable: boolean; score: number; value: number }`

- **Suit game (trump suit T)**. Trumps = the 4 Jacks + the 7 cards of T. Count `trumps`.
  - Score: CJ 3, SJ 2.5, HJ 2, DJ 1.5. Trump A 1.5, T 1.2, any other trump 0.8. Side ace 1.2. Side ten
    with the ace of its suit 1.0. Side ten with one other card of its suit 0.5. Each side-suit void
    +0.5 when `trumps ≥ 5`.
  - `playable = trumps ≥ 5 && score ≥ SUIT_MIN` (`SUIT_MIN = 8` with Skat pickup,
    `SUIT_MIN_HAND = 9.5`; tuned, see `12` I101). With only 4 trumps: playable when
    `score ≥ SUIT_MIN + 2`.
- **Grand**. `jacks` = Jacks held. Score: CJ 3, SJ 2.5, HJ 2, DJ 1.5, each ace 1.5, ten with its ace
  1.0, ten with one other card of its suit 0.5.
  - `playable = (jacks ≥ 3 || (jacks === 2 && hasCJ)) && score ≥ GRAND_MIN` (`GRAND_MIN = 9.5`,
    hand `11`).
- **Null**. Null order is 7 < 8 < 9 < T < J < Q < K < A, and Jacks belong to their suit. A suit is
  *safe* when, for its cards sorted low to high, the k-th card (k = 0, 1, …) has null rank index
  `≤ 2k` (index 7 = 0, 8 = 1, …, A = 7). An empty suit is safe.
  - Null Hand is playable when all 4 suits are safe.
  - Null with pickup is playable when at most one suit is unsafe and that suit has ≤ 2 cards (they
    will be discarded).
  - `score` = number of safe suits.
- **Value** = the expected game value if the game is won without announcements:
  `declarationFloorValue(decl, spitzen)` with `spitzen = countSpitzen(cards, …)` on the evaluated
  cards. Use `nullValue` for Null. Before the Skat is seen this uses the 10 cards only (the Skat may
  change "without" spitzen; accept that risk at Normal).

### 4.2 Best game and maximum bid
`bestGame(cards, hand)` = the playable game with the highest `value`. Ties: the higher `score`, then
the order grand > C > S > H > D > null. `maxBid` = its `value`, or `0` if nothing is playable.
Evaluate both `hand=false` and `hand=true` (with the stricter thresholds) and use the larger value.

### 4.3 Auction decisions (`auction.ts`), given `BotView.legal` (strict bidding)
- Caller: if `legal.bidValues[0] ≤ maxBid` → `bid` that value, else `pass`.
- Listener: if `currentBid ≤ maxBid` → `hold`, else `pass`.
- Claim stage: `claim` if `maxBid ≥ 18`, else `pass`.

### 4.4 Skat decision, discard, declare
- **Skat decision**: `playHand` if the best `hand=true` game is playable and its value ≥ `bid`,
  otherwise `pickUp`.
- **Discard** (12 cards): try all 66 pairs. For each pair and each game type, `evaluateGame` on the
  remaining 10. Rank by
  `score + DISCARD_POINTS_WEIGHT × points(pair)` (weight 0.05: discarded points count for the declarer).
  Only consider pairs and games whose value is ≥ `bid` if any exist. Never discard a Jack when the
  chosen game is suit or Grand. For Null, prefer discarding the highest cards of unsafe suits.
  Remember the chosen game for the declare step (recompute it there from the `BotView`; no hidden
  state between calls).
- **Declare**: from `legal.declarations` take the entry matching the best game with
  `declarationFloorValue ≥ bid`. If none reaches the bid, take the game with the highest value
  (accept the overbid). No Schneider/Schwarz/Ouvert announcements, except Null Ouvert Hand when every
  suit is *perfectly safe* (k-th card index ≤ k).

## 5. Normal card play (`heuristics.ts`)

Input: `BotView` with `legal.playableCards`. Always return one of them. Terms: *mode* =
`modeOf(declaration)`; a card *wins now* if it would beat the current trick leader
(`trickWinner` on the trick + this card); *safe winner* = wins now and (the bot is last in the trick
or `isTopRemaining`). *Cheapest* = lowest `cardPoints`, then lowest `cardStrength`. *Shortest suit* =
side suit with the fewest cards in hand.

### 5.1 Suit / Grand — declarer
- **Leading**: if opponents may still hold trumps (`remainingTrumps(view) > 0`) and the bot holds the
  top remaining trump → lead it. Else, if it holds ≥ 2 more trumps than are left outside → lead its
  lowest trump. Else, a side ace. Else, a side ten whose ace is gone. Else, the lowest card of the
  shortest side suit.
- **Following**: with a safe winner → play the safe winner with the most points if the trick
  already holds ≥ 10 points, otherwise the cheapest safe winner. Else, if it can win now and is not
  last → play its highest winner only if the trick holds ≥ 10 points, otherwise the cheapest card.
  Else → the cheapest card (from the shortest suit when it may choose).

### 5.2 Suit / Grand — defender
- **Partner is winning** the current trick and (the declarer has already played or the partner's
  card is top remaining) → *schmieren*: play the legal card with the most points, but not a trump
  ace/ten unless only trumps are legal.
- **Declarer is winning**: with a safe winner → the safe winner with the most points. Else → the
  cheapest card.
- **Leading**: a side ace; else a low card of a side suit the declarer is known void in **only if**
  the partner is not void in it either (to make the declarer trump); else the lowest card of the
  longest side suit; trumps only if nothing else is legal.

### 5.3 Null
- **Declarer**: following → the highest legal card that still loses to the current winner (stay
  under); if none loses → the highest card (the game is lost anyway). Leading → the lowest card of the
  suit with the most cards that are lower than anything still out.
- **Defenders**: if the declarer has already played and is currently losing → play under the
  declarer's card if possible (the lowest card), else the lowest card. If the declarer still has to
  play → play the lowest card of the led suit (leave room for the declarer to be forced over).
  Leading → the lowest card of the suit in which the declarer has shown the most high cards or no
  void; with open cards (Null Ouvert), lead a suit where the declarer's lowest card is higher than
  the bot's lowest card.

## 6. Strong level (`sample.ts`, `simulate.ts`, `strong.ts`)

### 6.1 Sampling hidden cards
- Unknown cards = 32 − own hand − all played cards − `ownSkat`/`ownDiscard` − `openHands`. The holders
  are the other active roles (exactly `handCounts[r]` cards each, minus open cards) and, when the bot
  does not know it, the Skat (2 cards; to defenders the Skat is the declarer's discard and is never
  played).
- Constraint: a role never gets a card of an effective suit it is void in (`voids`).
- Algorithm: shuffle the unknown cards with `rand` (Fisher–Yates), then deal them to holders,
  skipping holders that are void in the card's suit or already full. If dealing fails, reshuffle (up
  to 50 tries). After that, deal ignoring voids (never throw).
- Optional at Strong: weight Normal-bidding knowledge. If the declarer bid ≥ the value of a suit
  game, reject samples in which the declarer holds fewer than 4 trumps (≤ 20 extra tries, then
  accept).

### 6.2 Choosing a card (PIMC)
For each legal card `c` (skip sampling if only one is legal), for each of the sampled deals
(`sampleCount` = `ROLLOUT_BUDGET / playable cards` = 120 / n, clamped to 12…40; generate the
samples once and reuse them for every `c`): play `c`, then play out the rest of
the game in `simulate.ts`. In the play-out, **every** player uses the Normal heuristics on its own
(full-information-free) view of the sampled world. Build the `BotView` for each simulated player
from the simulated state, so `heuristics.ts` is reused unchanged. Score each play-out from the bot's
team view:
- Suit/Grand: `teamPoints` (declarer's card points incl. `ownDiscard`/Skat for the declarer; for
  defenders 120 − declarer points) + `30` if the team reaches the win threshold (declarer ≥ 61,
  defenders ≥ 60) + `15` if the team makes the other side Schneider (other side ≤ 30 points) + `15`
  if the other side takes no trick (Schwarz).
- Null: `100` if the bot's team wins the Null game in the play-out, else `0`.

Pick the card with the highest mean. Ties go to the Normal heuristic's choice. Budget: one decision
must take < 100 ms (median) on an idle mid-range laptop; measured ≈ 50 ms. If the perf test fails,
lower `ROLLOUT_BUDGET` in `tuning.ts`.

### 6.3 Strong auction
Same rules as §4.3, but `maxBid` is estimated with the Skat: draw `SKAT_SAMPLES = 16` random Skats
from the 22 unknown cards. For each, try discards on the 12 cards (suit/Grand: only pairs of side
cards; Null: only cards of unsafe suits) and keep the most valuable playable game. `maxBid` = the
highest game value that is playable in ≥ 60% of the samples (Hand games still use the 10-card
evaluation). The Skats are drawn with a seed derived from the 10 cards, so the estimate is a pure
function of the hand and is memoized (64 entries) across the bids of one auction; `strongMaxBid`
therefore takes no `rand`. Skat decision, discard and declare as in §4.4. Card play as §6.2.

## 7. Table, protocol and UI changes

- `src/table/types.ts`: `export type BotLevel = 'easy' | 'normal' | 'strong'`;
  `TableState.botLevel: BotLevel`. `createTable({ …, botLevel })` (optional argument, default
  `'normal'`).
- `src/table/bot.ts`: `botStep(s, ctx, rand)` calls `botAction(game.engine, role, s.botLevel, rand)`.
  `runBots` is unchanged. The host runs bots synchronously (Phase 12), so a strong decision
  (≈ 50 ms) briefly blocks the host tab; acceptable, see §9 for the Web Worker option.
- View: `TableView.table.botLevel` (`viewTypes.ts`, `view.ts`), zod in `src/net/schemaView.ts`
  (`z.enum(['easy','normal','strong'])`). Bump `PROTOCOL_VERSION` to 2 (`src/net/constants.ts`,
  `05` §1). Old clients get `rejected PROTOCOL_MISMATCH` instead of failing to parse views.
- Host snapshots (`src/ui/persist/hosted.ts`, resume): a snapshot without `botLevel` loads as
  `'normal'` (fill it in when loading; add a test).
- `src/ui/net/actions.ts`: `HostInput.botLevel` → `createTable`.
  `src/ui/dev/localTable.ts`: read `?bots=easy|normal|strong` (default normal) for practice.
- `Home.tsx` create form: a `<select>` "Bot strength" with Easy / Normal / Strong, default Normal,
  `data-testid="create-bot-level"`. It is remembered in settings as `lastBotLevel` (zod
  `.default('normal')`), so the next table uses the same choice.
- `TableLobby.tsx`: shows "Bots: Normal" in the info line, and the bot badge reads
  "Bot · Normal". The level cannot be changed after creation (`12` I100).
- i18n `en`/`de`: `home.botLevel` ("Bot strength" / "Bot-Stärke"), `botLevel.easy` ("Easy" /
  "Leicht"), `botLevel.normal` ("Normal" / "Normal"), `botLevel.strong` ("Strong" / "Stark"),
  `lobby.botsLevel` ("Bots: {level}" / "Bots: {level}").
- Statistics: no change. Records already mark bots via the player list. Showing the level in records
  is out of scope.

## 8. Tests (`09` §3 lists them)

1. `knowledge.test.ts`: the fairness property from §2; void detection cases.
2. `evaluate.test.ts`, table-driven with hands from `src/engine/testing.ts` helpers:
   - 4 Jacks + 3 aces + 2 tens → Grand playable, `maxBid ≥ 48`;
   - CJ SJ + 5 hearts incl. A, T + side ace → Hearts playable;
   - a junk hand (no Jack, no ace) → nothing playable, `maxBid = 0`;
   - 7, 8, 9 in every suit pattern → Null Hand playable;
   - a single unprotected ace in one suit → not Null Hand.
3. `auction.test.ts`: bids exactly up to `maxBid` (strict steps), holds up to `maxBid`, claims only
   with `maxBid ≥ 18`; discard never contains a Jack for suit/Grand; declare ≥ bid when possible.
4. `heuristics.test.ts` scenario tests (set up a `BotView` directly): the defender schmiert the ace
   when its partner wins and the declarer has played; the declarer pulls with the top trump; the
   declarer takes a 21-point trick with a safe winner; the Null declarer stays under; the defender
   does not trump its partner's winning trick.
5. `sample.test.ts`: samples respect hand counts and voids; deterministic for a seed; no known card
   is ever dealt to someone else.
6. `strong.test.ts`: deterministic for a seed; returns a legal card; a single legal card returns
   without sampling.
7. `levels.test.ts`: 300 seeded games for `easy` and `normal`, 6 for `strong` (slow), three bots of
   that level, calling `chooseBotAction` directly and asserting every choice is legal
   (`isLegalChoice`), so the fallback in `botAction` is never needed; normal/strong bids always equal
   `nextBidValue`.
8. **Strength check** (in `levels.test.ts`, via `arena.ts` `match`), kept in `npm run check`. Use 200 seeded deals; each deal
   is played twice with seat assignments swapped (A = level X in one seat, B = level Y in the other
   two, then the reverse), summing the Seeger score per level:
   - `normal` must beat `easy`: normal's total Seeger score > easy's total, and normal wins ≥ 55%
     of the games where it is the declarer.
   - `strong` vs `normal`: only behind `BOT_BENCH=1` (`it.skipIf`) because it is slow. It reports the
     totals with `console.table` and expects `strong ≥ normal`.
   - Document the measured results in `12` (I101) when tuning.
9. Performance (`strong.test.ts`, only with `BOT_BENCH=1` because wall-clock limits are flaky while
   the whole suite runs in parallel): one `strong` card decision < 100 ms (median of 20); one full
   game with three strong bots < 5 s.
10. UI: `Home.test.tsx` checks the create form passes the selected level and remembers it. The e2e
    scenarios play with humans only, so the bot level does not affect them.

## 9. Not in scope
- Per-bot levels, or changing the level after creation.
- Bots learning across games, or opening-book tables.
- Running bots in a Web Worker. Revisit only if the perf budget in §6.2 cannot be met with
  `SAMPLES ≥ 16`.
