# Step 07: the analysis screen

**Kind:** feature. **Layers:** ui. **Protocol:** no. **Needs:** steps 03–06.

## Read first

- `src/ui/AGENTS.md` (rules: legality only from pure code, `t()`, CSS modules, a11y, test ids)
- `docs/ui.md` §9 (i18n), §10 (components and styling), `src/ui/styles/tokens.css`
- Components to reuse: `src/ui/components/Card.tsx` (`Card`, sizes `hand`/`opponent`/`trick`,
  `onClick`, `disabled`, `testId`), `CardChip.tsx` (`CardChips`), `Switch.tsx`,
  `src/ui/game/labels.ts` (`declarationLabel`, `cardName`, `suitSymbol`), `src/ui/cardNames.ts`
- `src/engine` read-only helpers allowed in the UI: `sortHand`, `cardPoints`, `ROLES`

## Layout (mobile first; this page scrolls, it is not the game screen)

```
┌ Game analysis ─────────────────────────────── [Home] ┐
│ Anna plays Grand Hand · bid 48 · won 78 : 42          │  summary
├ Starting cards ───────────────────────────────────────┤
│ Forehand  Anna*  [chips…10]                           │  DealOverview
│ Middlehand Ben   [chips…10]                           │  (* = declarer)
│ Hindhand  Cem    [chips…10]                           │
│ Skat [♣A][♥7]   Discarded [♠7][♦8]                    │
├ Replay ───────────────────────────────────────────────┤
│ Ben (Middlehand) – 12 points, 1 trick                 │  ReplayBoard:
│   [cards face up, small]                              │  three hands, all face up,
│ Cem (Hindhand) – …                                    │  the mover's hand highlighted,
│   [cards …]                                           │  playable cards are buttons
│            current trick: [♣J Anna] [♣7 Ben]          │  with a score badge
│ Anna (Forehand) ▶ to play – …                         │
│   [♠A 82%] [♠10 64%] …                                │
├───────────────────────────────────────────────────────┤
│ |◀  ◀  ▶  ▶|   Play best   Back to the actual game     │  ReplayControls
│ Trick 3 · card 2 · Variant from trick 2               │
│ [x] Use the real cards   [Pause]   1 240 samples/card │
├ Scores (Anna to play) ────────────────────────────────┤
│ ♠A   82 %   Ø 74 pts   ← played   ★ best              │  ScoreList
│ ♠10  64 %   Ø 69 pts                                  │
├ Tricks ───────────────────────────────────────────────┤
│ 1. Anna ♣J  Ben ♣7  Cem ♣8 → Anna                     │  TrickHistory (click = jump)
└───────────────────────────────────────────────────────┘
```

At ≥ 900 px width put the replay board left and the controls + scores + tricks right (CSS grid).
The game result (`AnalysisResult`) replaces the score list when the line reached the end.

## State

`AnalysisScreen.tsx` (decoding only):

```ts
const input = useMemo(() => (data === null ? null : decodeAnalysis(data)), [data]);
const start = useMemo(() => (input === null ? null : analysisStart(input)), [input]); // Result<GameState | null>
// input === null or !start.ok → invalid message; start.value === null → passed-in view;
// else <AnalysisReplay input={input} start={start.value} workerFactory={workerFactory} />
```

`AnalysisReplay.tsx` (replay state and sampling):

```ts
const [line, setLine] = useState<AnalysisLine>(() => actualLine(input));
const [useRealHands, setUseRealHands] = useState(false);
const [paused, setPaused] = useState(false);
const applied = useMemo(() => line.plays.slice(0, line.cursor), [line]);
const position = useMemo(() => positionAt(start, applied), [start, applied]); // Result<Position>; lines are built only from playable cards, so an error means a bug: show analysis.error
const scores = useCardScores(input, applied, useRealHands, paused, workerFactory);
```

- Invalid input or an error `Result` → the `analysis-invalid` message from step 05.
- `passed-in` (`start` is `ok(null)`): show the summary ("Everybody passed") and `DealOverview`
  only; no replay, no worker (call the hook only in a child component that is rendered for
  played/Ramsch games, because hooks cannot be conditional – e.g. `AnalysisReplay` holds
  `line`, `useRealHands`, `paused`, `useCardScores`).
- Navigation (pure updates of `line`):
  - start: `cursor = 0`; back: `max(0, cursor - 1)`; forward: `min(plays.length, cursor + 1)`;
    end: `cursor = plays.length`.
  - choose card `c` (click on a playable card or a score row): `setLine(chooseCard(line, c))`.
  - play best: `chooseCard(line, bestCard(scores.stats))` (disabled while `bestCard` is null).
  - back to the actual game: `{ plays: input.plays, cursor: min(line.cursor, divergence ?? cursor) }`
    – shown only when `divergenceAt(input.plays, line) !== null`.
  - jump to trick n (TrickHistory): `cursor = 3 * n` (after trick n), capped at `plays.length`.
- Keyboard: `ArrowLeft` / `ArrowRight` on the screen root (`tabIndex={-1}`, `onKeyDown`) = back /
  forward; `Home` / `End` = start / end. Do not capture keys while focus is in an input.
- When the line is at its end but the game is not over (a variant), forward is disabled; the user
  chooses the next card or presses "Play best".

## Components (one file each, CSS module next to it, all < 300 lines)

| File | Props (shape) | Notes |
|---|---|---|
| `AnalysisScreen.tsx` | `{ data: string \| null }` | decode, invalid state, summary, `DealOverview`, `AnalysisReplay` |
| `AnalysisReplay.tsx` | `{ input, start: GameState }` | owns line/switch/pause state and the hook; renders board, controls, scores/result, tricks |
| `analysisSummary.ts` (pure) | `summaryText(input, t): string` | "Anna plays Grand Hand · bid 48", Ramsch → "Ramsch", passed-in → "Everybody passed". Use `declarationLabel`. The final result line comes from `positionAt(start, input.plays).result` |
| `DealOverview.tsx` | `{ input }` | `data-testid="analysis-deal"`; rows per role: role label (`role.forehand` …), name, declarer mark, `CardChips` of `sortHand(hand, declaration)`; Skat; discarded (only when `pickedUpSkat`) |
| `ReplayBoard.tsx` | `{ input, position, stats, best, actualNext, onChoose }` | `data-testid="analysis-board"`; a seat per role (`analysis-seat-<role>`), mover gets `aria-current="true"` and a highlight; cards via `Card` size `opponent`; playable cards of the mover are clickable (`testId="analysis-card-<id>"`), others `state="disabled"` without handler; a badge with the win rate on playable cards; outline on `best`; a small "played" marker on `actualNext` (the actual game's next card when the line still follows the actual game); current trick in the middle (`analysis-trick`) |
| `ReplayControls.tsx` | `{ cursor, length, canForward, divergence, trickNo, cardNo, useRealHands, paused, samples, done, canPlayBest, on… }` | buttons with `aria-label`s: `analysis-start`, `analysis-back`, `analysis-forward`, `analysis-end`, `analysis-play-best`, `analysis-reset`; `Switch` `analysis-real-hands`; pause/resume button `analysis-pause`; status line `analysis-status` (`aria-live="polite"`); variant badge `analysis-variant` |
| `ScoreList.tsx` | `{ stats, declaration, best, actualNext, onChoose }` | `data-testid="analysis-scores"`; rows `analysis-score-<card>` sorted with `rankStats`; columns card, win %, Ø points (hidden for Null), samples; marks "played" / "best"; a row is a button that chooses the card; empty state "Calculating…"; `stats: []` and the game not scorable (Ramsch) → `analysis.noScoresRamsch` |
| `TrickHistory.tsx` | `{ input, tricks, divergence, onJump }` | `data-testid="analysis-tricks"`; one button per completed trick of the current line (`analysis-trick-<n>`, 1-based) with the three cards, player names and the winner; tricks after the divergence point are marked as variant |
| `AnalysisResult.tsx` | `{ input, result: GameResult }` | `data-testid="analysis-result"`; won/lost, points, tricks for a played game; Ramsch points per player; reuse wording of `result.*` keys where it fits |
| `scoreFormat.ts` (pure) | `percent(x: number \| null): string` ("82 %", "–"), `points(x)`, `rankStats(stats): CardStat[]` (win rate desc, then points desc, then card order) | tested |

Score colours: badge background by win rate (≥ 0.6 good, ≤ 0.4 bad, else neutral) using
existing tokens in `tokens.css` (add `--analysis-good` / `--analysis-bad` there only if no fitting
token exists).

Accessibility: every card button gets `aria-label` = card name + score
(`analysis.cardScore`); the switch has a visible label; tap targets ≥ 44 px.

## i18n (`src/ui/i18n/parts/enAnalysis.ts` / `deAnalysis.ts`)

| Key | English | German |
|---|---|---|
| `analysis.deal` | Starting cards | Ausgangskarten |
| `analysis.skat` | Skat | Skat |
| `analysis.discarded` | Discarded | Gedrückt |
| `analysis.declarer` | Declarer | Alleinspieler |
| `analysis.summary` | {name} plays {game} · bid {bid} | {name} spielt {game} · Reizwert {bid} |
| `analysis.ramsch` | Ramsch | Ramsch |
| `analysis.passedIn` | Everybody passed – nothing was played. | Alle haben gepasst – es wurde nicht gespielt. |
| `analysis.replay` | Replay | Nachspielen |
| `analysis.toPlay` | {name} to play | {name} ist am Zug |
| `analysis.seatInfo` | {points} points · {tricks} tricks | {points} Augen · {tricks} Stiche |
| `analysis.start` | To the first card | Zur ersten Karte |
| `analysis.back` | One card back | Eine Karte zurück |
| `analysis.forward` | One card forward | Eine Karte vor |
| `analysis.end` | To the last card | Zur letzten Karte |
| `analysis.playBest` | Play best card | Beste Karte spielen |
| `analysis.reset` | Back to the actual game | Zurück zum echten Spiel |
| `analysis.variant` | Variant from trick {trick} | Variante ab Stich {trick} |
| `analysis.position` | Trick {trick} · card {card} | Stich {trick} · Karte {card} |
| `analysis.realHands` | Use the real cards of the others | Echte Karten der anderen verwenden |
| `analysis.realHandsHint` | Off: the hidden cards are dealt at random, matching what the player to move knows. | Aus: Die verdeckten Karten werden zufällig verteilt, passend zu dem, was der Spieler am Zug weiß. |
| `analysis.pause` | Pause | Pause |
| `analysis.resume` | Resume | Fortsetzen |
| `analysis.samples` | {count} samples per card | {count} Stichproben pro Karte |
| `analysis.finished` | {count} samples per card (finished) | {count} Stichproben pro Karte (fertig) |
| `analysis.scores` | Scores | Bewertung |
| `analysis.card` | Card | Karte |
| `analysis.winRate` | Win | Gewinn |
| `analysis.avgPoints` | Ø points | Ø Augen |
| `analysis.calculating` | Calculating… | Wird berechnet… |
| `analysis.played` | played | gespielt |
| `analysis.best` | best | beste |
| `analysis.noScoresRamsch` | No scores for Ramsch games. | Für Ramsch gibt es keine Bewertung. |
| `analysis.error` | The scores could not be calculated. | Die Bewertung konnte nicht berechnet werden. |
| `analysis.tricks` | Tricks | Stiche |
| `analysis.trickWinner` | → {name} | → {name} |
| `analysis.cardScore` | {card}: {percent} win | {card}: {percent} Gewinn |
| `analysis.gameOver` | End of the game | Spielende |

(`analysis.title`, `analysis.invalid`, `analysis.home` exist from step 05.) Add more keys if the
UI needs them; every key in both files (the German dictionary is typed against the English one).

## Tests first (jsdom, `@testing-library/react`, no jest-dom; see existing component tests)

Fixture: `src/ui/analysis/analysisFixtures.ts` (test-only) builds an `AnalysisInput` from a fixed
seed via `src/table/testing.ts` helpers, or a hand-written input for a short known game; plus a
`fakeWorkerFactory` (reuse the one from step 06 tests – move it into the fixture file).

1. `scoreFormat.test.ts`: `percent(0.823)` → `"82 %"`, `percent(null)` → `"–"`; `rankStats` order.
2. `analysisSummary.test.ts`: played, Ramsch, passed-in texts (English).
3. `DealOverview.test.tsx`: three names, 30 card chips + 2 Skat chips; discarded only when
   `pickedUpSkat`.
4. `AnalysisScreen.test.tsx` (pass the fake factory down via an optional prop
   `workerFactory?: WorkerFactory` on `AnalysisScreen` → `AnalysisReplay` → `useCardScores`):
   - start: `analysis-board` shows forehand to play; `analysis-forward` → the trick shows one card;
     `analysis-back` → empty again; `analysis-end` → `analysis-result` visible.
   - after draining one worker step, `analysis-scores` has one row per playable card.
   - clicking a playable card that differs from the actual one → `analysis-variant` visible,
     `analysis-reset` visible; clicking reset → variant badge gone.
   - clicking the actual next card does **not** create a variant.
   - toggling `analysis-real-hands` sends a new `analyze` request with `useRealHands: true`.
   - `analysis-pause` → `stop` request; again → `analyze` with `initial` stats.
   - ArrowRight moves forward.
   - passed-in input: `analysis-deal` visible, no `analysis-board`.
5. `ReplayBoard.test.tsx`: only `position.playable` cards are enabled buttons; the badge text of a
   card equals `percent(winRate(stat))`.

Run: `npx vitest run src/ui/analysis`

## Docs

- `docs/ui.md` section "Analysis screen": layout, state (line/cursor), controls, scores display,
  worker (from step 06), keyboard, invalid link handling.
- `src/ui/AGENTS.md` file map: every new file.
- `docs/dev/e2e.md` §6: all new test ids (`analysis-deal`, `analysis-board`, `analysis-seat-<role>`,
  `analysis-card-<id>`, `analysis-trick`, `analysis-start`, `analysis-back`, `analysis-forward`,
  `analysis-end`, `analysis-play-best`, `analysis-reset`, `analysis-real-hands`, `analysis-pause`,
  `analysis-status`, `analysis-variant`, `analysis-scores`, `analysis-score-<card>`,
  `analysis-tricks`, `analysis-trick-<n>`, `analysis-result`).
- `docs/dev/testing.md` §4 test inventory: the new test files.

## Done when

- `npm run check` is green; every new file < 300 lines.
- Manual check with `npm run dev`: open a link produced in the browser console is awkward, so use
  step 08's button, or temporarily log `analysisHash(input)` in a test and paste it. Check 360 px
  and 1280 px widths: nothing overflows horizontally, cards wrap.
