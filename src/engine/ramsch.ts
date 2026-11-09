import { sumPoints } from './cards';
import { modeOf, type PlayMode } from './trump';
import { ROLES, type GameResult, type GameState, type Role } from './types';

const TOTAL_POINTS = 120;
const TRICKS_PER_GAME = 10;

/** Mode used for card play: the declaration's mode, or Grand (Jacks only) in a Ramsch. */
export function playModeOf(state: GameState): PlayMode | null {
  if (state.declaration !== null) {
    return modeOf(state.declaration);
  }
  return state.ramsch ? { kind: 'grand' } : null;
}

function perRole(value: (role: Role) => number): Record<Role, number> {
  return { forehand: value('forehand'), middlehand: value('middlehand'), hindhand: value('hindhand') };
}

export interface RamschScoring {
  readonly losers: readonly Role[];
  readonly jungfrau: boolean;
  readonly durchmarsch: Role | null;
  readonly scores: Readonly<Record<Role, number>>;
}

/** Ramsch scores from card points and trick counts (skat-rules §12.4). */
export function ramschScores(
  points: Readonly<Record<Role, number>>,
  tricks: Readonly<Record<Role, number>>,
): RamschScoring {
  const durchmarsch = ROLES.find((role) => tricks[role] === TRICKS_PER_GAME) ?? null;
  if (durchmarsch !== null) {
    return {
      losers: [],
      jungfrau: false,
      durchmarsch,
      scores: perRole((role) => (role === durchmarsch ? TOTAL_POINTS : 0)),
    };
  }
  const most = Math.max(...ROLES.map((role) => points[role]));
  const losers = ROLES.filter((role) => points[role] === most);
  const jungfrau = ROLES.some((role) => tricks[role] === 0);
  const factor = jungfrau ? 2 : 1;
  return {
    losers,
    jungfrau,
    durchmarsch: null,
    scores: perRole((role) => (losers.includes(role) ? -points[role] * factor : 0)),
  };
}

/** Scores a finished Ramsch; `passed-in` only if no trick was played (defensive, never reached). */
export function scoreRamsch(state: GameState): GameResult {
  const last = state.tricks.at(-1);
  if (last === undefined) {
    return { kind: 'passed-in' };
  }
  const skatTo = last.winner;
  const tricks = perRole((role) => state.tricks.filter((t) => t.winner === role).length);
  const cardsWon = (role: Role): number =>
    sumPoints(state.tricks.filter((t) => t.winner === role).flatMap((t) => t.plays.map((p) => p.card)));
  const points = perRole(
    (role) => cardsWon(role) + (role === skatTo ? sumPoints(state.skat) : 0),
  );
  const scoring = ramschScores(points, tricks);
  return {
    kind: 'ramsch',
    points,
    tricks,
    skatTo,
    losers: scoring.losers,
    jungfrau: scoring.jungfrau,
    durchmarsch: scoring.durchmarsch,
    scores: scoring.scores,
  };
}
