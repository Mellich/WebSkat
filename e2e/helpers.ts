// Shared steps for the end-to-end tests. Every player is a separate browser context, so each one
// has its own localStorage, like a real player on a real device.

import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export interface Player {
  readonly name: string;
  readonly context: BrowserContext;
  readonly page: Page;
}

/** A new browser profile on the start page with the player's name entered. */
export async function newPlayer(browser: Browser, name: string): Promise<Player> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/#/');
  await page.getByLabel('Your name').fill(name);
  return { name, context, page };
}

export async function closeAll(players: readonly Player[]): Promise<void> {
  await Promise.all(players.map((p) => p.context.close()));
}

/** Creates a table as the host and returns its key as shown in the lobby (ABCD-EFGH). */
export async function createTable(
  page: Page,
  options: { tableName?: string; maxSeats?: number; isPublic?: boolean } = {},
): Promise<string> {
  if (options.tableName !== undefined) await page.getByLabel('Table name').fill(options.tableName);
  if (options.maxSeats !== undefined) await page.getByLabel('Seats').selectOption(String(options.maxSeats));
  if (options.isPublic === true) await page.getByLabel('List publicly').check();
  await page.getByTestId('create-table').click();
  const key = page.getByTestId('table-key');
  await expect(key).toBeVisible();
  return (await key.innerText()).trim();
}

/** Joins a table by its key from the start page. */
export async function joinTable(page: Page, key: string): Promise<void> {
  await page.goto('/#/');
  await page.getByTestId('join-key-input').fill(key);
  await page.getByTestId('join-submit').click();
  await expect(page.getByTestId('table-key')).toBeVisible();
}

/** Starts the game from the host's lobby, once enough players are seated. The game screen replaces the lobby. */
export async function startGame(host: Page): Promise<void> {
  const start = host.getByTestId('start-game');
  await expect(start).toBeEnabled();
  await start.click();
  await expect(start).toBeHidden();
}

/** The ids of the cards in the viewer's hand, in display order (e.g. "CJ", "H10"). */
export async function handCards(page: Page): Promise<string[]> {
  const cards = page.locator('[data-testid^="hand-card-"]');
  const ids = await cards.evaluateAll((elements) => elements.map((el) => el.getAttribute('data-testid') ?? ''));
  return ids.map((id) => id.replace('hand-card-', ''));
}

export async function waitForHand(page: Page): Promise<void> {
  await expect(page.locator('[data-testid^="hand-card-"]')).toHaveCount(10);
}

/** The table key as the app stores it (no dash). */
export function storageKey(formatted: string): string {
  return formatted.replace('-', '');
}

export async function hasHostSnapshot(page: Page, formatted: string): Promise<boolean> {
  const storedKey = storageKey(formatted);
  return page.evaluate((k) => localStorage.getItem(`webskat.host.${k}`) !== null, storedKey);
}
