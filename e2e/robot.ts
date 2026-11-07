// A "robot clicker" that plays a game through the UI, one browser page per player. It takes the
// first option the page offers, so it needs no knowledge of the rules; the engine decides what is
// legal and the test checks what the players see (docs/09-testing.md §5).

import type { Locator, Page } from '@playwright/test';

const POLL_MS = 150;
const MAX_ROUNDS = 3000;

/**
 * Hand cards overlap, so the centre of a card is covered by the next one. A player clicks the
 * visible left part of a card; the robot does the same.
 */
const VISIBLE_PART = { x: 6, y: 40 };

/** Clicks the element if it exists and is enabled. False when the view changed under us. */
async function clickIfEnabled(target: Locator, position?: { x: number; y: number }): Promise<boolean> {
  if ((await target.count()) === 0) return false;
  const first = target.first();
  if (!(await first.isEnabled())) return false;
  try {
    await first.click({ timeout: 2000, ...(position === undefined ? {} : { position }) });
    return true;
  } catch {
    return false;
  }
}

async function selectTwoDiscards(page: Page): Promise<boolean> {
  const unselected = page.locator('button[data-testid^="hand-card-"]:not([aria-pressed="true"])');
  let clicked = false;
  const selected = await page.locator('button[data-testid^="hand-card-"][aria-pressed="true"]').count();
  for (let i = selected; i < 2; i++) {
    if (!(await clickIfEnabled(unselected, VISIBLE_PART))) break;
    clicked = true;
  }
  return clicked;
}

/** One action for the player on this page, if the page offers one. True when something was clicked. */
export async function robotStep(page: Page, options: { continueAfterResult: boolean }): Promise<boolean> {
  if ((await page.getByTestId('result-dialog').count()) > 0) {
    return options.continueAfterResult && (await clickIfEnabled(page.getByTestId('continue')));
  }
  if (await clickIfEnabled(page.getByTestId('pickup'))) return true;
  if (await clickIfEnabled(page.getByTestId('play-hand'))) return true;

  if ((await page.getByTestId('discard-submit').count()) > 0) {
    if (await clickIfEnabled(page.getByTestId('discard-submit'))) return true;
    return selectTwoDiscards(page);
  }

  if ((await page.getByTestId('declare-submit').count()) > 0) {
    const option = page.locator('[data-testid^="declare-option-"]:enabled');
    if (!(await clickIfEnabled(option))) return false;
    return clickIfEnabled(page.getByTestId('declare-submit'));
  }

  for (const id of ['bid-submit', 'bid-hold', 'bid-claim', 'bid-pass']) {
    if (await clickIfEnabled(page.getByTestId(id))) return true;
  }
  return clickIfEnabled(page.locator('button[data-testid^="hand-card-"]'), VISIBLE_PART);
}

async function everyPageShowsResult(pages: readonly Page[]): Promise<boolean> {
  const counts = await Promise.all(pages.map((page) => page.getByTestId('result-dialog').count()));
  return counts.every((count) => count > 0);
}

/** Plays with the robots of all pages until every page shows the result of the game. */
export async function playUntilResult(pages: readonly Page[]): Promise<void> {
  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (await everyPageShowsResult(pages)) return;
    let acted = false;
    for (const page of pages) {
      if (await robotStep(page, { continueAfterResult: false })) acted = true;
    }
    if (!acted) await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`the game did not reach its result within ${String(MAX_ROUNDS)} rounds`);
}

/** Every page presses "Continue" on the result; the next game is dealt once all have. */
export async function continueAfterResult(pages: readonly Page[]): Promise<void> {
  for (const page of pages) {
    await page.getByTestId('continue').click();
  }
  for (const page of pages) {
    await page.getByTestId('result-dialog').waitFor({ state: 'detached' });
  }
}
