// Scenario A (docs/09-testing.md §5): three browsers play one complete game.

import { expect, test } from '@playwright/test';
import { closeAll, createTable, joinTable, newPlayer, startGame, waitForHand, type Player } from './helpers';
import { playUntilResult } from './robot';

test('three players play one game and everybody sees the result and the statistics', async ({ browser }) => {
  test.setTimeout(900_000);
  const players: Player[] = [];
  try {
    const host = await newPlayer(browser, 'Hanna');
    const anna = await newPlayer(browser, 'Anna');
    const ben = await newPlayer(browser, 'Ben');
    players.push(host, anna, ben);
    const pages = players.map((p) => p.page);

    const key = await createTable(host.page);
    await joinTable(anna.page, key);
    await joinTable(ben.page, key);
    await startGame(host.page);
    for (const page of pages) {
      await waitForHand(page);
    }

    await playUntilResult(pages);

    const results = await Promise.all(pages.map((page) => page.getByTestId('result-dialog').innerText()));
    expect(new Set(results).size).toBe(1);

    for (const page of pages) {
      await page.getByTestId('open-stats').click();
      await page.getByTestId('stats-tab-history').click();
      await expect(page.getByTestId('history-row')).toHaveCount(1);
      await page.keyboard.press('Escape');
    }
  } finally {
    await closeAll(players);
  }
});
