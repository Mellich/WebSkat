// Replacing and re-inviting players during a game (docs/dev/e2e.md §3, plan 07).

import { expect, test } from '@playwright/test';
import { createTable, joinTable, newPlayer, startGame, waitForHand, handCards, type Player, closeAll } from './helpers';

test.describe('replacing and re-inviting players', () => {
  test('the host seats a waiting player in the seat of a player who is gone', async ({ browser }) => {
    const players: Player[] = [];
    try {
      const host = await newPlayer(browser, 'Hanna');
      const anna = await newPlayer(browser, 'Anna');
      const ben = await newPlayer(browser, 'Ben');
      const carl = await newPlayer(browser, 'Carl');
      players.push(host, anna, ben, carl);

      const key = await createTable(host.page);
      await joinTable(anna.page, key);
      await joinTable(ben.page, key);
      await startGame(host.page);
      await waitForHand(anna.page);
      await waitForHand(ben.page);

      await ben.context.close();
      await joinTable(carl.page, key);
      await expect(carl.page.getByTestId('table-key')).toBeVisible();

      await host.page.getByTestId('open-players').click();
      await host.page.getByTestId('replace-2').click();
      await host.page.getByTestId('replace-with').selectOption({ label: 'Carl' });
      await host.page.getByTestId('replace-confirm').click();

      await waitForHand(carl.page);
      expect(await handCards(carl.page)).toHaveLength(10);
    } finally {
      await closeAll(players);
    }
  });

  test('a disconnected player takes the seat back with an invite link', async ({ browser }) => {
    const players: Player[] = [];
    try {
      const host = await newPlayer(browser, 'Hanna');
      const anna = await newPlayer(browser, 'Anna');
      const ben = await newPlayer(browser, 'Ben');
      players.push(host, anna, ben);

      const key = await createTable(host.page);
      await joinTable(anna.page, key);
      await joinTable(ben.page, key);
      await startGame(host.page);
      await waitForHand(anna.page);

      await anna.context.close();
      await expect(host.page.getByTestId('connection-status')).toHaveAttribute('data-state', 'ok');
      await host.page.getByTestId('open-players').click();
      await host.page.getByTestId('reinvite-1').click();
      const link = (await host.page.getByTestId('invite-link').innerText()).trim();

      const annaAgain = await newPlayer(browser, 'Anna');
      players.push(annaAgain);
      await annaAgain.page.goto(link);
      await waitForHand(annaAgain.page);
      expect(await handCards(annaAgain.page)).toHaveLength(10);
      await expect(host.page.getByTestId('players-row-1').getByLabel('connected')).toBeVisible({ timeout: 15_000 });
    } finally {
      await closeAll(players);
    }
  });
});
