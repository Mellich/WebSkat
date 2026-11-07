// Scenario B (docs/09-testing.md §5): a public table with four players (Geberskat). The fourth
// player finds the table in the public list. The dealer sits out, and the seat rotates.

import { expect, test } from '@playwright/test';
import { closeAll, createTable, joinTable, newPlayer, startGame, type Player } from './helpers';
import { continueAfterResult, playUntilResult } from './robot';

interface Seating {
  readonly sittingOut: string[];
  readonly dealers: string[];
}

/**
 * Who sits out, as the players see it. The bar lists the others; a player who sits out sees
 * their own line instead ("... Dealer: X."). Duplicates across pages are removed.
 */
async function seatingNow(players: readonly Player[]): Promise<Seating> {
  const sittingOut = new Set<string>();
  const dealers = new Set<string>();
  for (const player of players) {
    const bar = player.page.getByTestId('sitting-out');
    if ((await bar.count()) > 0) {
      const match = /Sitting out: (.+) · Dealer: (.+)$/.exec(await bar.innerText());
      if (match === null) throw new Error(`unexpected sitting-out bar: ${await bar.innerText()}`);
      for (const name of (match[1] ?? '').split(', ')) sittingOut.add(name);
      dealers.add((match[2] ?? '').trim());
    }
    const own = player.page.getByTestId('sitting-out-you');
    if ((await own.count()) > 0) {
      const match = /Dealer: (.+)\.$/.exec(await own.innerText());
      sittingOut.add(player.name);
      dealers.add((match?.[1] ?? '').trim());
    }
  }
  return { sittingOut: [...sittingOut], dealers: [...dealers] };
}

test('a public table of four: the dealer sits out, and the next game another player sits out', async ({ browser }) => {
  test.setTimeout(1_500_000);
  const players: Player[] = [];
  try {
    const host = await newPlayer(browser, 'Hanna');
    const ben = await newPlayer(browser, 'Ben');
    const carl = await newPlayer(browser, 'Carl');
    const dora = await newPlayer(browser, 'Dora');
    players.push(host, ben, carl, dora);

    const key = await createTable(host.page, { tableName: 'Friday game', maxSeats: 4, isPublic: true });
    await joinTable(ben.page, key);
    await joinTable(carl.page, key);

    const listed = dora.page.getByTestId('public-table').filter({ hasText: 'Friday game' });
    await expect(listed).toBeVisible({ timeout: 60_000 });
    await listed.getByTestId('public-join').click();
    await expect(dora.page.getByTestId('table-key')).toBeVisible();
    await expect(host.page.getByTestId('seat-3')).toBeVisible();

    await startGame(host.page);
    for (const player of players) {
      await expect(player.page.getByTestId('status-line')).toHaveCount(1);
    }

    await playUntilResult(players.map((p) => p.page));
    const first = await seatingNow(players);
    expect(first.sittingOut).toHaveLength(1);
    expect(first.dealers).toEqual(first.sittingOut);
    const firstSittingOut = first.sittingOut[0];

    await continueAfterResult(players.map((p) => p.page));
    await expect
      .poll(async () => {
        const next = await seatingNow(players);
        return next.sittingOut.length === 1 && next.sittingOut[0] !== firstSittingOut;
      })
      .toBe(true);
    const second = await seatingNow(players);
    expect(second.dealers).toEqual(second.sittingOut);

    await playUntilResult(players.map((p) => p.page));
    await host.page.getByTestId('open-stats').click();
    await host.page.getByTestId('stats-tab-history').click();
    await expect(host.page.getByTestId('history-row')).toHaveCount(2);
    await host.page.keyboard.press('Escape');
  } finally {
    await closeAll(players);
  }
});
