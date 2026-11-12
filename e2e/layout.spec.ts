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
  { name: 'laptop-s', width: 1366, height: 768 },
  { name: 'laptop-wide', width: 1280, height: 800 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'desktop-s', width: 1440, height: 900 },
  { name: 'window-s', width: 900, height: 600 },
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

  const selectors = ['[data-testid^="hand-card-"]', '[data-testid="opponent-seat"]', '[data-testid="trick-area"]', '[data-testid="status-line"]', '[data-testid="bid-summary"]', '[data-testid="phase-panel"]'];
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

  await checkOnFelt(page, phase);

  // The phase panel lies over the felt and the status row, never over the hand.
  const panels = await page.getByTestId('phase-panel').all();
  const panel = panels[0] === undefined ? null : await panels[0].boundingBox();
  const firstCard = await page.locator('[data-testid^="hand-card-"]').first().boundingBox();
  if (panel !== null && firstCard !== null) {
    expect(panel.y + panel.height, `${phase}: phase panel covers the hand`).toBeLessThanOrEqual(firstCard.y + 1);
  }

  const card = await page.locator('[data-testid^="hand-card-"]').first().boundingBox();
  if (card !== null) {
    if (Math.min(target.width, target.height) <= 480) expect(card.width, `${phase}: hand card too small`).toBeGreaterThanOrEqual(60);
    expect(card.width, `${phase}: hand card too large`).toBeLessThanOrEqual(104);
  }
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Is the point inside the rounded rectangle `box` with corner radius `r`? */
function insideRounded(px: number, py: number, box: Box, r: number): boolean {
  const tol = 1;
  if (px < box.x - tol || px > box.x + box.width + tol || py < box.y - tol || py > box.y + box.height + tol) return false;
  const cx = Math.min(Math.max(px, box.x + r), box.x + box.width - r);
  const cy = Math.min(Math.max(py, box.y + r), box.y + box.height - r);
  return Math.hypot(px - cx, py - cy) <= r + tol;
}

/** The Skat and the trick (cards and empty spots) lie completely on the felt, inside the oak rim. */
async function checkOnFelt(page: Page, phase: string): Promise<void> {
  const felt = await page.getByTestId('felt').evaluate((el) => {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      radius: parseFloat(style.borderTopLeftRadius),
      rim: parseFloat(style.getPropertyValue('--felt-rim')),
    };
  });
  const inner: Box = { x: felt.x + felt.rim, y: felt.y + felt.rim, width: felt.width - 2 * felt.rim, height: felt.height - 2 * felt.rim };
  const radius = Math.max(0, Math.min(felt.radius, felt.width / 2, felt.height / 2) - felt.rim);
  const parts = page.locator('[data-testid="skat-pile"] img, [data-testid^="trick-slot-"] > *');
  for (const part of await parts.all()) {
    const box = await part.boundingBox();
    if (box === null) continue;
    const corners: readonly (readonly [number, number])[] = [
      [box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height],
    ];
    for (const [px, py] of corners) {
      expect(insideRounded(px, py, inner, radius), `${phase}: card at ${JSON.stringify(box)} leaves the felt ${JSON.stringify(felt)}`).toBe(true);
    }
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

    const cards = page.locator('button[data-testid^="hand-card-"]:enabled');
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
