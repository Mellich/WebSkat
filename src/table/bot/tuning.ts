// All numeric bot constants in one place (docs/bots.md). Results of tuning: docs/decisions.md I101.

/** Easy level: probability to pass when passing is allowed in the auction. */
export const EASY_PASS_PROBABILITY = 0.6;

/** Suit game: minimum evaluation score to play with Skat pickup / as Hand. */
export const SUIT_MIN = 8;
export const SUIT_MIN_HAND = 9.5;
/** Extra score needed when holding only four trumps. */
export const FOUR_TRUMP_PENALTY = 2;
export const GRAND_MIN = 9.5;
export const GRAND_MIN_HAND = 11;

export const JACK_WEIGHT = { C: 3, S: 2.5, H: 2, D: 1.5 } as const;
export const TRUMP_ACE = 1.5;
export const TRUMP_TEN = 1.2;
export const TRUMP_OTHER = 0.8;
export const SIDE_ACE = 1.2;
export const SIDE_TEN_WITH_ACE = 1.0;
export const SIDE_TEN_GUARDED = 0.5;
export const VOID_BONUS = 0.5;
export const GRAND_ACE = 1.5;

/** Weight of discarded card points when choosing the two cards to put away. */
export const DISCARD_POINTS_WEIGHT = 0.05;

/** Trick points from which a declarer/defender spends a high winner. */
export const VALUABLE_TRICK = 10;

/**
 * Strong level: sampled deals per card decision (at most), the total rollout budget per decision
 * (samples = budget / playable cards, at least MIN_SAMPLES), and sampled Skats per auction decision.
 * Measured with BOT_BENCH=1 on an 8-core machine: budget 250 gives a median card decision of about
 * 110 ms and a slowest one of about 400 ms (budget 120: median 33 ms, slowest 230 ms).
 */
export const SAMPLES = 150;
export const MIN_SAMPLES = 12;
export const ROLLOUT_BUDGET = 250;
export const SKAT_SAMPLES = 16;
/** Strong auction: share of sampled Skats in which a game must be playable. */
export const SKAT_CONFIDENCE = 0.6;
export const SAMPLE_TRIES = 50;

/** Strong card play: bonuses on top of the team's card points. */
export const WIN_BONUS = 30;
export const SCHNEIDER_BONUS = 15;
export const SCHWARZ_BONUS = 15;
export const NULL_WIN_SCORE = 100;
