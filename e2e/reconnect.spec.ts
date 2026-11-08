// Reloading a tab during a game (docs/dev/e2e.md, scenario C; docs/networking.md §9).

import { expect, test } from '@playwright/test';
import {
  createTable,
  handCards,
  hasHostSnapshot,
  joinTable,
  newPlayer,
  startGame,
  waitForHand,
  type Player,
} from './helpers';

test.describe('leaving the table', () => {
  test('a client that leaves the lobby disappears from the host seats', async ({ browser }) => {
    const players: Player[] = [];
    try {
      const host = await newPlayer(browser, 'Hanna');
      const anna = await newPlayer(browser, 'Anna');
      const ben = await newPlayer(browser, 'Ben');
      players.push(host, anna, ben);

      const key = await createTable(host.page);
      await joinTable(anna.page, key);
      await joinTable(ben.page, key);
      await expect(host.page.getByTestId('seat-2')).toBeVisible({ timeout: 15_000 });

      await ben.page.getByTestId('leave-table').click();
      await expect(host.page.getByTestId('seat-2')).toHaveCount(0, { timeout: 15_000 });
    } finally {
      await Promise.all(players.map((p) => p.context.close()));
    }
  });
});

test.describe('reloading during a game', () => {
  test('a client that reloads gets its seat and its hand back', async ({ browser }) => {
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
      await waitForHand(ben.page);

      const annaHand = await handCards(anna.page);
      const statusBefore = await anna.page.getByTestId('status-line').innerText();

      await anna.page.reload();
      await waitForHand(anna.page);
      await expect(anna.page.getByTestId('connection-status')).toHaveAttribute('data-state', 'ok');
      expect(await handCards(anna.page)).toEqual(annaHand);
      await expect(anna.page.getByTestId('status-line')).toHaveText(statusBefore);

      await expect(ben.page.getByTestId('connection-status')).toHaveAttribute('data-state', 'ok');
    } finally {
      await Promise.all(players.map((p) => p.context.close()));
    }
  });

  test('the start page goes back to the stored table on load', async ({ browser }) => {
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
      const annaHand = await handCards(anna.page);

      await anna.page.goto('/');
      await waitForHand(anna.page);
      expect(await handCards(anna.page)).toEqual(annaHand);
    } finally {
      await Promise.all(players.map((p) => p.context.close()));
    }
  });

  test('a host that reloads resumes its table and the clients reconnect to the same game', async ({ browser }) => {
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
      await waitForHand(ben.page);
      await expect.poll(() => hasHostSnapshot(host.page, key)).toBe(true);

      const hostHand = await handCards(host.page);
      const annaHand = await handCards(anna.page);
      const hostStatus = await host.page.getByTestId('status-line').innerText();
      const annaStatus = await anna.page.getByTestId('status-line').innerText();

      await host.page.reload();
      await waitForHand(host.page);
      expect(await handCards(host.page)).toEqual(hostHand);
      await expect(host.page.getByTestId('status-line')).toHaveText(hostStatus);

      for (const client of [anna, ben]) {
        await expect(client.page.getByTestId('connection-status')).toHaveAttribute('data-state', 'ok', { timeout: 60_000 });
      }
      expect(await handCards(anna.page)).toEqual(annaHand);
      await expect(anna.page.getByTestId('status-line')).toHaveText(annaStatus);
    } finally {
      await Promise.all(players.map((p) => p.context.close()));
    }
  });
});
