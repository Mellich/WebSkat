// Scenario D (docs/dev/e2e.md, docs/history/phase-12-playtest-fixes.md F3): the game screen fits phones in
// portrait and landscape without scrolling, and cards stay readable but not oversized.

import { expect, test, type Browser, type Page } from '@playwright/test';

interface Target {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}

const TARGETS: readonly Target[] = [
  { name: 'phone-s-portrait', width: 360, height: 640 },
  { name: 'phone-portrait', width: 390, height: 844 },
  { name: 'phone-landscape', width: 844, height: 390 },
  { name: 'phone-s-landscape', width: 640, height: 360 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 720 },
  { name: 'desktop', width: 1920, height: 1080 },
];

/**
 * With a fixed seed the practice host restarts the bot RNG for every bot turn, so an easy bot repeats
 * its first choice; with this seed that choice is "pass" and the viewer wins the bidding.
 */
const SEED = 6;

async function openPractice(browser: Browser, target: Target): Promise<Page> {
  const mobile = target.width <= 900;
  const context = await browser.newContext({
    viewport: { width: target.width, height: target.height },
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await context.newPage();
  await page.goto('/#/');
  await page.getByLabel('Your name').fill('You');
  await page.goto(`/#/dev/local?seed=${String(SEED)}&bots=easy`);
  await page.getByTestId('start-game').click();
  await expect(page.locator('[data-testid^="hand-card-"]').first()).toBeVisible();
  return page;
}

async function checkLayout(page: Page, target: Target, phase: string): Promise<void> {
  await page.screenshot({ path: `test-results/layout-${target.name}-${phase}.png` });
  const size = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
  }));
  expect(size.scrollHeight, `${phase}: page scrolls vertically`).toBeLessThanOrEqual(size.innerHeight + 1);
  expect(size.scrollWidth, `${phase}: page scrolls horizontally`).toBeLessThanOrEqual(size.innerWidth + 1);

  const selectors = ['[data-testid^="hand-card-"]', '[data-testid="opponent-seat"]', '[data-testid="trick-area"]', '[data-testid="status-line"]', '[data-testid="phase-panel"]'];
  for (const selector of selectors) {
    for (const element of await page.locator(selector).all()) {
      const box = await element.boundingBox();
      if (box === null) continue;
      const where = `${phase}: ${selector} at ${JSON.stringify(box)}`;
      expect(box.x, where).toBeGreaterThanOrEqual(-1);
      expect(box.y, where).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width, where).toBeLessThanOrEqual(target.width + 1);
      expect(box.y + box.height, where).toBeLessThanOrEqual(target.height + 1);
    }
  }

  const card = await page.locator('[data-testid^="hand-card-"]').first().boundingBox();
  if (card !== null) {
    if (Math.min(target.width, target.height) <= 480) expect(card.width, `${phase}: hand card too small`).toBeGreaterThanOrEqual(60);
    expect(card.width, `${phase}: hand card too large`).toBeLessThanOrEqual(104);
  }
}

async function clickIfThere(page: Page, testId: string): Promise<boolean> {
  const target = page.getByTestId(testId);
  if ((await target.count()) === 0 || !(await target.first().isEnabled())) return false;
  await target.first().click();
  return true;
}

/** Bids/holds until the viewer declares; returns false if a bot won the bidding. */
async function winBidding(page: Page): Promise<boolean> {
  for (let i = 0; i < 80; i++) {
    if ((await page.getByTestId('pickup').count()) > 0) return true;
    if ((await page.getByTestId('phase-panel').count()) === 0) return false;
    if (!(await clickIfThere(page, 'bid-submit')) && !(await clickIfThere(page, 'bid-hold')) && !(await clickIfThere(page, 'bid-claim'))) {
      await page.waitForTimeout(100);
    }
  }
  return false;
}

for (const target of TARGETS) {
  test(`layout fits ${target.name} (${String(target.width)}×${String(target.height)})`, async ({ browser }) => {
    const page = await openPractice(browser, target);
    await checkLayout(page, target, 'bidding');
    expect(await winBidding(page), `seed ${String(SEED)} must let the viewer win the bidding`).toBe(true);
    await checkLayout(page, target, 'skat-decision');

    await page.getByTestId('pickup').click();
    await expect(page.getByTestId('discard-submit')).toBeVisible();
    await expect(page.locator('[data-testid^="hand-card-"]')).toHaveCount(12);
    await checkLayout(page, target, 'discarding');

    const cards = page.locator('button[data-testid^="hand-card-"]');
    await cards.nth(10).click({ position: { x: 6, y: 30 } });
    await cards.nth(11).click({ position: { x: 6, y: 30 } });
    await page.getByTestId('discard-submit').click();
    await expect(page.getByTestId('declare-submit')).toBeVisible();
    await page.locator('[data-testid^="declare-option-"]:enabled').first().click();
    await checkLayout(page, target, 'declaring');

    await page.getByTestId('declare-submit').click();
    await expect(page.getByTestId('phase-panel')).toHaveCount(0);
    await checkLayout(page, target, 'playing');
    await page.context().close();
  });
}
