// The version label (docs/ui.md §1, docs/dev/versioning.md): shown bottom left, opens the changelog
// in a new tab.

import { expect, test } from '@playwright/test';

test('the version label opens the changelog in a new tab', async ({ page, context }) => {
  await page.goto('/#/');
  const badge = page.getByTestId('app-version');
  await expect(badge).toHaveText(/^v\d+\.\d+\.\d+$/);
  const box = await badge.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (box !== null && viewport !== null) {
    expect(box.x).toBeLessThan(20);
    expect(box.y + box.height).toBeGreaterThan(viewport.height - 20);
  }

  const [changelog] = await Promise.all([context.waitForEvent('page'), badge.click()]);
  await expect(changelog.getByTestId('changelog')).toBeVisible();
  const version = (await badge.textContent())?.slice(1) ?? '';
  // an Unreleased section may come first (docs/dev/versioning.md), so look for the release itself
  await expect(changelog.getByTestId('changelog-release').filter({ hasText: `Version ${version}` })).toHaveCount(1);
  await expect(changelog.getByTestId('app-version')).toHaveCount(0);
  await expect(page).toHaveURL(/#\/$/);
});
