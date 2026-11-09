# Skat rules and scoring (single source of truth)

Based on the International Skat Order (ISkO) and the German Wikipedia articles *Skat* and
*Skatabrechnung*. **Implement exactly this.** The only house rule is the strictly ascending
bidding of §4.1 (user request); do not add others. If a case is not covered, choose the simplest
behavior and record it in `decisions.md`. Never change a number here unless the user asks.

Code comments and tests cite this file as `skat-rules §N` (e.g. `skat-rules §10.7`). **Do not
renumber sections.** Implementation: `engine.md`.

## 1. Cards

32 cards: suits × ranks.

| Suit | Code | Strength order of suits (for Spitzen/trump jacks) | Base value |
|---|---|---|---|
| Clubs ♣ (Kreuz) | `C` | 1 (highest) | 12 |
| Spades ♠ (Pik) | `S` | 2 | 11 |
| Hearts ♥ (Herz) | `H` | 3 | 10 |
| Diamonds ♦ (Karo) | `D` | 4 (lowest) | 9 |

Ranks: `7 8 9 10 J Q K A` (J = Bube/Jack, Q = Dame/Queen, K = König/King, A = Ass/Ace).

**CardId** = suit code + rank, e.g. `CJ` (Jack of Clubs), `S10`, `HA`, `D7`.

**Card points (Augen)**: `A`=11, `10`=10, `K`=4, `Q`=3, `J`=2, `9`/`8`/`7`=0. Total in deck = **120**.

## 2. Roles at a game

Exactly three players are *active* in a game:

| Role (code) | German | Position |
|---|---|---|
| `forehand` | Vorhand | first player after the dealer; leads the first trick |
| `middlehand` | Mittelhand | second |
| `hindhand` | Hinterhand | third |

The dealer is the player directly before the forehand (with 3 players the dealer *is* the
hindhand). Play direction is **clockwise** = seat order ascending (`seat+1`).
For 4+ players see §9 (Geberskat).

## 3. Deal

Shuffled 32 cards (seeded Fisher–Yates, see `engine.md` §6). Deal order: 3 to each active
player (forehand, middlehand, hindhand), then 2 face-down to the **Skat**, then 4 each, then 3 each.
Result: 10 cards per active player + 2 Skat cards. (Cutting is skipped.) Sitting-out players
receive no cards.

## 4. Bidding (Reizen)

### 4.1 Valid bid values

A bid is a number from `BID_VALUES`: all products `base × m` for `base ∈ {9,10,11,12}` with
`m = 2..18` and `base = 24` (Grand) with `m = 2..11`, **plus** `23, 35, 46, 59` (Null values),
sorted ascending, de-duplicated, max 264. Begins:

```
18 20 22 23 24 27 30 33 35 36 40 44 45 46 48 50 54 55 59 60 63 66 70 72 77 80 81 84 88 90 96 99 100 …
```
(Compute it in code; add a unit test that the first 20 values equal
`[18,20,22,23,24,27,30,33,35,36,40,44,45,46,48,50,54,55,59,60]`.)

**House rule — strictly ascending bids (no jumps).** The caller can only bid the *next* value of
`BID_VALUES`: `18` when `currentBid` is `null`, otherwise the smallest value `> currentBid`
(`nextBidValue` in `src/engine/bidding.ts`). This applies to humans and bots equally. After `264` the caller can only
pass. (Official Skat allows jump bids; WebSkat deliberately does not, see `decisions.md` I95.)

### 4.2 Procedure

Two *stages*. In each stage there is a **caller** (Sager) and a **listener** (Hörer).

- **Stage 1**: caller = middlehand, listener = forehand.
- **Stage 2**: caller = hindhand, listener = the player who did **not** pass in stage 1
  (the *survivor*).

Within a stage, turn order is:

1. Caller either **bids** the next value (`nextBidValue(currentBid)`: `18` if `currentBid` is
   `null`, else the smallest `BID_VALUES` entry `> currentBid`, see §4.1) or **passes**.
2. After a bid, listener either **holds** (accepts the value; `currentBid` unchanged) or
   **passes**.
3. After a hold, go to step 1 (caller must raise or pass).

Ending a stage:

- Listener passes → the caller is the survivor with `currentBid` = caller's last bid.
- Caller passes →
  - if `currentBid !== null` (the listener has held a bid): listener is the survivor;
  - if `currentBid === null` (nobody bid anything yet): listener is the survivor with no bid yet.

After stage 1 → stage 2 starts (caller hindhand, listener survivor, `currentBid` carried over).
After stage 2 the survivor of stage 2 is the **declarer**:

- If `currentBid !== null` → bidding is **done**, declarer = survivor, `bid = currentBid`.
- If `currentBid === null` (both middlehand and hindhand passed without any bid) → **claim
  stage**: the forehand may `claim` the game (declarer = forehand, `bid = 18`) or `pass`
  → game is **passed in** (*eingepasst*): no points, no cards played, next dealer.
  (If the table rule *Ramsch* is on, a Ramsch game is played instead, §12.)

`currentBid` semantic: the highest value that has been *bid by the caller and not rejected*.
`bid` of the declarer is the final `currentBid`.

Examples (F = forehand, M = middlehand, H = hindhand):

| Sequence | Result |
|---|---|
| M:18, F:hold, M:20, F:pass → H:pass | M declarer, bid 20 |
| M:pass → H:18, F:hold, H:20, F:pass | H declarer, bid 20 |
| M:18, F:pass → H:20, M:pass | H declarer, bid 20 |
| M:18, F:pass → H:pass | M declarer, bid 18 |
| M:pass → H:pass → F:claim | F declarer, bid 18 |
| M:pass → H:pass → F:pass | passed in (eingepasst) |

## 5. After bidding

The declarer decides, **before looking at the Skat**:

- **Pick up Skat** (normal game): the 2 Skat cards join the hand (12 cards); the declarer
  **discards** (drückt) any 2 cards face-down (may be the cards just picked up, may be Jacks or
  high cards). Afterwards the declarer **declares** the game.
- **Hand** (*Handspiel*): the Skat stays untouched and face-down; the declarer immediately
  **declares** the game (hand = true).

The Skat (picked up and discarded cards, or untouched Skat in a Hand game) counts for the
declarer's card points at the end (not for tricks).

### 5.1 Declaration

```
kind:     suit(trump) | grand | null
hand:     boolean            (fixed by the path above)
announce: 'none' | 'schneider' | 'schwarz'     (suit/grand with hand only)
ouvert:   boolean            (declarer plays with open cards)
```

Valid combinations:

| hand | kind | allowed `announce` | allowed `ouvert` |
|---|---|---|---|
| false | suit / grand | `none` | **no** |
| false | null | `none` | yes |
| true | suit / grand | `none`, `schneider`, `schwarz` | yes — **requires** `announce = 'schwarz'` |
| true | null | `none` | yes |

So there are 7 declarations without Hand (4 suits, grand, null, null ouvert) and
(5 × 4) + 2 = 22 with Hand (suit/grand × {none, schneider, schwarz, ouvert}, null hand,
null ouvert hand).

**Ouvert**: right after the declaration, the declarer's remaining cards are turned face-up for
everyone, for the whole game (the declarer's hand shrinks as cards are played).

The declaration is **not** checked against the bid at declaration time. If the final game value
turns out lower than the bid the declarer has *overbid* (§10.5) and loses. The UI shows the
guaranteed minimum (`declarationFloorValue`) as a hint but must not block.

## 6. Trump, ranks and following suit

### 6.1 Trump per game type

| Game | Trump cards |
|---|---|
| Suit game (Clubs/Spades/Hearts/Diamonds) | the 4 Jacks + all 7 other cards of the trump suit (11 trumps) |
| Grand | only the 4 Jacks |
| Null | **none** |

### 6.2 Strength order (high → low)

- **Trumps (suit game)**: `CJ SJ HJ DJ`, then trump suit `A 10 K Q 9 8 7`.
- **Trumps (grand)**: `CJ SJ HJ DJ`.
- **Non-trump suits (suit game and grand)**: `A 10 K Q 9 8 7` (Jacks are *not* in their suit!).
- **Null (all suits)**: `A K Q J 10 9 8 7` (10 and Jack are "eingereiht").

### 6.3 Effective suit

`effectiveSuit(card)` = `'trump'` if the card is a trump (see 6.1), otherwise its own suit.
In Null every card has its own suit.

### 6.4 Following suit (the legal-move rule)

The first card of a trick is the **lead**; the leader may play any card.
Other players **must follow**: if they hold at least one card with the same `effectiveSuit` as the
lead card they must play such a card; otherwise they may play any card.

Examples (test vectors):

| Game | Led card | Hand of follower | Legal cards |
|---|---|---|---|
| Hearts | `D10` | `DJ D9 C7` | `D9` (DJ is trump, not diamonds) |
| Hearts | `HJ` | `SJ H7 C7 D7` | `SJ H7` (lead is trump) |
| Hearts | `H8` | `CJ C9 S7` | `CJ` (trump must be followed) |
| Grand | `C8` | `CJ C9 S7` | `C9` |
| Grand | `CJ` | `SJ C9 S7` | `SJ` |
| Null | `C10` | `CJ C7 S7` | `CJ C7` |
| Clubs | `S7` | `H7 D7` (no spades in hand; neither is a trump) | `H7 D7` |

### 6.5 Trick winner

Among the 3 cards: if any trump was played, the **highest trump** wins; otherwise the **highest
card of the led effective suit** wins. Cards of other suits can never win.
The winner collects the trick and leads the next trick. Ten tricks are played.

Examples:

| Game | Cards in play order | Winner |
|---|---|---|
| Hearts | `CA`, `H7`, `SJ` | `SJ` (third) |
| Hearts | `CA`, `C10`, `DA` | `CA` (first) |
| Grand | `DA`, `D10`, `DJ` | `DJ` (jack is trump) |
| Grand | `H7`, `HA`, `S7` | `HA` |
| Null | `S10`, `SJ`, `SK` | `SK` |
| Null | `S10`, `SJ`, `D9` | `SJ` |

### 6.6 Early end in Null

In Null the game ends **immediately** when the declarer wins a trick (lost); remaining tricks are
not played. Suit/grand games always play all 10 tricks.

## 7. Spitzen (Mit/Ohne)

Computed from the declarer's **12 cards** = original 10 hand cards + 2 Skat cards, regardless of
what was discarded and whether it is a Hand game. Not applicable to Null.

Sequence of "top" trumps:
- suit game: `CJ SJ HJ DJ` then `trump A, trump 10, trump K, trump Q, trump 9, trump 8, trump 7`
- grand: `CJ SJ HJ DJ`

Algorithm: if the declarer holds `CJ` → **"mit n"** where n = number of consecutive sequence cards
held from the top; else → **"ohne n"** where n = number of consecutive sequence cards **not** held
from the top. `spitzen = n`.

Examples: holds CJ SJ DJ (no HJ) → mit 2. Holds HJ DJ only (no CJ SJ) → ohne 2.
Hearts game, holds CJ SJ HJ DJ HA H10 H9 → mit 6 (…, HA, H10 then HK missing → stops at 6).
Hearts game holding DJ, HA, no CJ/SJ/HJ → ohne 3. Maximum 11 (suit) / 4 (grand).

## 8. Card points and trick counts at the end

```
declarerPoints = sum(points of cards in declarer's won tricks) + points of the 2 Skat/discard cards
defenderPoints = 120 - declarerPoints
declarerTricks = number of tricks won by the declarer (Skat does not count as a trick)
defenderTricks = 10 - declarerTricks   (suit/grand; Null may end early)
```

## 9. Geberskat (4–6 players)

- Table with N seated players (3 ≤ N ≤ 6), seats `0..N-1` in clockwise order.
- A `nextDealerIdx` pointer moves **one seat clockwise after every game** (also after a passed-in
  game). The very first dealer is chosen from the seed.
- For a game with dealer seat `d`: `forehand = (d+1) mod N`, `middlehand = (d+2) mod N`,
  `hindhand = (d+3) mod N`. Everybody else sits out (for N=3 nobody sits out; for N=4 only the
  dealer; for N=5 the dealer and seat `d+4`; for N=6 dealer, `d+4`, `d+5`).
  *(Simplification of the official 5/6-player seating; recorded in `decisions.md` D7.)*
- Sitting-out players see the public table (backs, trick area) but no hands, and take part in
  Seeger bonus scoring when the declarer loses (§10.6).
- New players are seated **between games only** (appended as last seat). Players can be removed
  between games only. A game never changes its participants once dealt.

## 10. Scoring

### 10.1 Base values

| Game | Base |
|---|---|
| Clubs | 12 |
| Spades | 11 |
| Hearts | 10 |
| Diamonds | 9 |
| Grand | 24 |
| Null | 23 |
| Null Hand | 35 |
| Null Ouvert | 46 |
| Null Ouvert Hand | 59 |

Null values are fixed (no multiplier, no Spitzen).

### 10.2 Multiplier (suit and grand)

```
multiplier = spitzen + 1                                  // "Spiel"
           + (hand ? 1 : 0)
           + (announce === 'schneider' ? 1 : announce === 'schwarz' ? 2 : 0)   // schwarz announced
                                                         // implies schneider announced → +2
           + (ouvert ? 1 : 0)
           + (schneiderAchieved ? 1 : 0)
           + (schwarzAchieved ? 1 : 0)
gameValue  = base × multiplier
```

with, from the **actual result** (both for won *and* lost games):

```
schneiderAchieved = declarerPoints >= 90 || declarerPoints <= 30
schwarzAchieved   = declarerTricks === 10 || declarerTricks === 0
```

(i.e. the *losing side* has ≤ 30 points / took no trick. Schwarz always implies Schneider.)

Cross-check against the ISkO level list (levels = multiplier − spitzen): 1 Spiel; 2 Hand; 3 Hand+
Schneider; 4 Hand+Schwarz *or* Hand+Schneider announced (+won Schneider); 5 … ; 6 Schwarz announced
and achieved; 7 Ouvert.

`declarationFloorValue(declaration, spitzen)` = same formula **without** `schneiderAchieved` and
`schwarzAchieved` (the minimum value the game will have). Used for the UI hint and nothing else.

### 10.3 Did the declarer win?

**Suit / Grand**

```
base condition:   declarerPoints >= 61
announce schneider: additionally declarerPoints >= 90
announce schwarz / ouvert: additionally declarerTricks === 10
playedWon = all conditions above
```

**Null**: `playedWon = (declarerTricks === 0)`.

### 10.4 Final win

```
overbid = gameValue < bid
won     = playedWon && !overbid
```

### 10.5 Declarer's score (standard counting)

```
if won:                       declarerScore = +gameValue
else if !overbid:             declarerScore = -2 × gameValue
else (overbid) and suit/grand: loseValue = ceil(bid / base) × base
                               declarerScore = -2 × loseValue
else (overbid) and null:      declarerScore = -2 × gameValue      // decision, see open-questions
```

Defenders (and sitting-out players) get 0 in standard counting.

### 10.6 Extended Seeger–Fabian counting (tournament standard)

```
if won:   declarer: +gameValue + 50;                      others: 0
if lost:  declarer: -2 × loseValue - 50;                  every other seated player: +bonus(N)
passed in: everybody 0
bonus(N): N=3 → 40, N=4 → 30, N=5 → 24, N=6 → 20          // 6 is our own extension
```
where `loseValue` is as in 10.5 (`gameValue` if not overbid).
"Every other seated player" = both defenders **and** all sitting-out players.

Both systems are computed and stored for every game (`statistics.md`); the UI chooses which
one to display (default: standard, `decisions.md` I108).

### 10.7 Worked examples = test vectors

| # | Game | spitzen | bid | declPts | declTricks | multiplier | gameValue | won | overbid | std score |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Grand, not hand | mit 4 | 48 | 100 | 8 | 4+1+1(Schneider)=6 | 144 | ✔ | ✘ | +144 |
| 2 | Grand, not hand | mit 4 | 48 | 120 | 10 | 4+1+1+1=7 | 168 | ✔ | ✘ | +168 |
| 3 | Diamonds, not hand | ohne 2 | 18 | 40 | 3 | 2+1=3 | 27 | ✘ | ✘ | −54 |
| 4 | Diamonds, not hand | ohne 2 | 18 | 25 | 1 | 2+1+1=4 | 36 | ✘ | ✘ | −72 |
| 5 | Clubs, not hand | mit 1 (bid 36, was ohne 2 before Skat) | 36 | 70 | 6 | 1+1=2 | 24 | ✘ | ✔ | −72 (ceil(36/12)·12=36) |
| 6 | Clubs, not hand | mit 1 | 36 | 95 | 8 | 1+1+1=3 | 36 | ✔ | ✘ | +36 |
| 7 | Clubs, not hand | mit 1 | 40 | 70 | 6 | 2 | 24 | ✘ | ✔ | −96 (ceil(40/12)=4 → 48 → −96) |
| 8 | Hearts, **hand** | mit 1 | 30 | 65 | 6 | 1+1+1=3 | 30 | ✔ | ✘ | +30 |
| 9 | Spades, hand, announce **schneider** | mit 2 | 55 | 85 | 7 | 2+1+1+1=5 | 55 | ✘ (needs ≥90) | ✘ | −110 |
| 10 | Clubs, hand, announce **schwarz** | mit 1 | 84 | 120 | 10 | 1+1+1+2+1+1=7 | 84 | ✔ | ✘ | +84 |
| 11 | Grand, hand, **ouvert** (announce schwarz) | mit 2 | 100 | 120 | 10 | 2+1+1+2+1+1+1=9 | 216 | ✔ | ✘ | +216 |
| 12 | Grand, hand, ouvert | mit 2 | 100 | 70 | 5 | 2+1+1+2+1=7 | 168 | ✘ | ✘ | −336 |
| 13 | Null | – | 23 | – | 0 | – | 23 | ✔ | ✘ | +23 |
| 14 | Null | – | 23 | – | 1 | – | 23 | ✘ | ✘ | −46 |
| 15 | Null hand | – | 35 | – | 0 | – | 35 | ✔ | ✘ | +35 |
| 16 | Null ouvert | – | 46 | – | 0 | – | 46 | ✔ | ✘ | +46 |
| 17 | Null ouvert hand | – | 59 | – | 3 | – | 59 | ✘ | ✘ | −118 |
| 18 | Null | – | 24 | – | 0 | – | 23 | ✘ | ✔ | −46 |
| 19 | Diamonds, not hand | mit 1 | 18 | 61 | 6 | 2 | 18 | ✔ | ✘ | +18 |
| 20 | Diamonds, not hand | mit 1 | 18 | 60 | 5 | 2 | 18 | ✘ (60 is not enough) | ✘ | −36 |

Notes: in #5 the "was ohne 2 before the Skat" is only narrative; the engine just receives `bid=36`
and the actual 12 cards giving "mit 1". In #12 `declPts=70` means declarer lost because Schwarz was
announced, `schneiderAchieved=false`, `schwarzAchieved=false`.

Seeger–Fabian vectors (N=3), from the *Skatabrechnung* article:

| Game | declarer | other two |
|---|---|---|
| Won Grand mit 4 Schneider (144) | +194 | 0, 0 |
| Lost Diamonds ohne 2, value 27 | −54 − 50 = **−104** | +40, +40 |
| Won Null Ouvert (46) | +96 | 0, 0 |

Played in this order (games 1 and 2 declared by A, game 3 by C), the cumulative totals are:
A = 194 − 104 = **90**, B = 0 + 40 + 0 = **40**, C = 0 + 40 + 96 = **136**. This matches the table in
the *Skatabrechnung* article. Use it as an integration test for `records.ts`/`stats.ts`.

## 11. Game flow summary (state machine)

```
dealt → bidding ──(all passed)──▶ passed-in (finished, no result)
          │
          ▼ declarer + bid
     skat-decision ──pickUp──▶ discarding ──discard──▶ declaring
          │ hand                                          ▲
          └───────────────────────────────────────────────┘
                                                          ▼ declare
                                                       playing (10 tricks; Null may end early)
                                                          ▼
                                                       finished (GameResult)
```
With the Ramsch rule, `passed-in` becomes `playing` (Ramsch, §12).

## 12. Ramsch (table rule, off by default)

### 12.1 When
Only when the table rule "Ramsch" is on, and only instead of a passed-in game (§4.2: middlehand,
hindhand and forehand all pass). There is no declarer and no bid.

### 12.2 Play
- Trumps: only the four Jacks, order `CJ SJ HJ DJ` (as in Grand, §6.1–§6.2). Suits `A 10 K Q 9 8 7`.
- Following suit and trick winner as in Grand (§6.4–§6.5). Forehand leads the first trick.
- All 10 tricks are played. Nobody picks up or looks at the Skat during play.

### 12.3 Card points
Each player's card points = the cards of the tricks they won. The Skat (2 cards) counts for the
winner of the last trick (it is not a trick). The three totals add up to 120.

### 12.4 Scoring (standard and Seeger–Fabian alike)
- **Durchmarsch**: one player won all 10 tricks → that player scores **+120**, the others 0.
- Otherwise the **loser(s)** = the player(s) with the most card points. Each loser scores
  **−(own card points)**; everybody else 0. Ties for the most points: every tied player loses.
- **Jungfrau**: if a player won no trick (and there is no Durchmarsch), the losers' scores are
  doubled.
- Sitting-out players (§9) score 0.

### 12.5 Worked examples = test vectors

| # | Points F/M/H | Tricks F/M/H | Result |
|---|---|---|---|
| R1 | 50 / 40 / 30 | 4 / 3 / 3 | F −50 |
| R2 | 72 / 48 / 0 | 6 / 4 / 0 | Jungfrau: F −144 |
| R3 | 120 / 0 / 0 | 10 / 0 / 0 | Durchmarsch: F +120 |
| R4 | 45 / 45 / 30 | 4 / 3 / 3 | F −45, M −45 |
| R5 | 40 / 40 / 40 | 4 / 3 / 3 | F −40, M −40, H −40 |
| R6 | scripted | — | H wins the last trick, the Skat is `SA D7` (11 points): H's card points include these 11 |

## 13. Bockrunden (table rule, off by default)

- **Trigger**: a suit or Grand game ends with 60 : 60 card points (§8). Null and Ramsch never
  trigger.
- **Effect**: the next 3 games are Bock games. A trigger inside a Bock game adds 3 more.
  Every finished game (played, passed in, Ramsch) uses up one Bock game; aborted games do not.
- **Scoring in a Bock game**: the game value part counts double.
  - Standard: `2 × declarerScore` (§10.5).
  - Seeger–Fabian: won `2 × gameValue + 50`; lost `2 × declarerScore − 50`; the bonus for the
    other seated players (§10.6) is unchanged.
  - Ramsch: `2 ×` the scores of §12.4.
- The game that triggers is not doubled itself (unless it is a Bock game already).

### 13.1 Worked examples = test vectors

| # | Situation | Standard | Seeger–Fabian |
|---|---|---|---|
| B1 | Bock game, won Grand, value 144 (§10.7 #1) | declarer +288 | declarer +338, others 0 |
| B2 | Bock game, lost Diamonds, value 27 (§10.7 #3), N = 3 | declarer −108 | declarer −158, others +40 |
| B3 | Bock game, Ramsch R1 (§12.5) | F −100 | F −100 |
| B4 | Counter: 0 left, a 60 : 60 game | → 3 left | |
| B5 | Counter: 3 left, a Bock game without trigger | → 2 left | |
| B6 | Counter: 2 left, a Bock game ending 60 : 60 | → 2 − 1 + 3 = 4 left | |
| B7 | Counter: 1 left, a passed-in Bock game | → 0 left | |
