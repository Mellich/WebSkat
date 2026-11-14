// Numeric constants of the game analysis (docs/table.md "Game analysis", decision I183).

export const ROLLOUT_EPSILON = 0.1; // chance of a random legal card per simulated move (default)
export const ROLLOUT_EPSILONS = [0, 0.05, 0.1, 0.2, 0.3] as const; // the choices of the analysis screen
export const SAMPLES_PER_BATCH = 8; // worlds per scoreBatch call (each card is played in each)
export const MAX_SAMPLES_PER_CARD = 3000; // the worker stops here (step 06)
export const CONFIDENCE_Z = 1.96; // a card is clearly worse than the best one at 95 % (paired, two-sided)
export const ELIMINATION_Z = 3; // a card stops being sampled when it is this many standard errors behind (stricter than CONFIDENCE_Z: it is checked after every batch)
export const MIN_SAMPLES_TO_ELIMINATE = 200; // no card is dropped before this many samples
