// One sampled world's result for one card, packed in a number: the mover's team card points and
// whether the team won. Every card is played in the same worlds, so index i of the `worlds` of two
// stats is the same deal and the two can be compared pair-wise (`compare.ts`).

const POINTS_STEP = 2; // code = points * 2 + (won ? 1 : 0)

export function encodeWorld(won: boolean, points: number): number {
  return points * POINTS_STEP + (won ? 1 : 0);
}

export function worldWon(world: number): boolean {
  return world % POINTS_STEP === 1;
}

export function worldPoints(world: number): number {
  return Math.floor(world / POINTS_STEP);
}
