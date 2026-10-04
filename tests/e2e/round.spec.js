import { test, expect } from '@playwright/test';
import { seed, readState } from './helpers.js';

const fixed = (ms, extra = () => {}) => (p) => {
  p.settings.timing = { startMs: ms, minMs: 300, maxMs: 3000, adaptive: false };
  extra(p);
};

async function waitForChoices(page) {
  const choices = page.getByTestId('choices');
  await expect(choices.locator('button.choice:enabled').first()).toBeVisible({ timeout: 6000 });
  return { choices, answer: await choices.getAttribute('data-answer') };
}

test('a full quantity round awards stars and a sticker', async ({ page }) => {
  await seed(page, fixed(500));
  await page.goto('/');
  await page.getByTestId('tile-quantity').click();
  for (let i = 0; i < 10; i++) {
    const { choices, answer } = await waitForChoices(page);
    await choices.locator(`button[data-value="${answer}"]`).click();
  }
  await expect(page.getByTestId('round-end')).toBeVisible({ timeout: 6000 });
  await expect(page.getByTestId('new-sticker')).toBeVisible();
  const p = (await readState(page)).profiles[0];
  expect(p.rewards.stars).toBe(10);
  expect(p.rewards.stickers).toHaveLength(1);
  expect(p.history).toHaveLength(1);
  await page.getByTestId('round-done').click();
  await expect(page.getByTestId('star-badge')).toHaveText('10');
});

test('with fewer than 8 correct answers there are stars but no sticker', async ({ page }) => {
  await seed(page, fixed(500));
  await page.goto('/');
  await page.getByTestId('tile-quantity').click();
  for (let i = 0; i < 10; i++) {
    const { choices, answer } = await waitForChoices(page);
    const value = i < 3 ? await choices.locator(`button.choice:not([data-value="${answer}"])`).first().getAttribute('data-value') : answer;
    await choices.locator(`button[data-value="${value}"]`).click();
  }
  await expect(page.getByTestId('round-end')).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('sticker-hint')).toContainText('7 von 10');
  await expect(page.getByTestId('new-sticker')).toHaveCount(0);
  const p = (await readState(page)).profiles[0];
  expect(p.rewards.stars).toBe(7);
  expect(p.rewards.stickers).toHaveLength(0);
});

test('the flash disappears after the configured duration', async ({ page }) => {
  await seed(page, fixed(1000));
  await page.goto('/');
  await page.getByTestId('tile-digits').click();
  const stim = page.getByTestId('stimulus');
  await expect(stim).toBeVisible();
  const t0 = Date.now();
  await expect(stim).toBeHidden({ timeout: 3000 });
  const dt = Date.now() - t0;
  expect(dt).toBeGreaterThan(700);
  expect(dt).toBeLessThan(1700);
});

test('a wrong answer shows the solution and marks the right button', async ({ page }) => {
  await seed(page, fixed(500));
  await page.goto('/');
  await page.getByTestId('tile-digits').click();
  const { choices, answer } = await waitForChoices(page);
  await choices.locator(`button.choice:not([data-value="${answer}"])`).first().click();
  await expect(choices.locator(`button[data-value="${answer}"]`)).toHaveClass(/right/);
  await expect(page.locator('.stimulus.solution')).toBeVisible();
  await expect(page.locator('.round-stars .slot.missed')).toHaveCount(1);
});

test('a double tap on an answer counts once', async ({ page }) => {
  await seed(page, fixed(500));
  await page.goto('/');
  await page.getByTestId('tile-digits').click();
  const { choices, answer } = await waitForChoices(page);
  await choices.locator(`button[data-value="${answer}"]`).dblclick({ force: true });
  await expect(page.locator('.round-stars .slot.earned, .round-stars .slot.missed')).toHaveCount(1);
});

test('back aborts the round without rewards but keeps difficulty changes', async ({ page }) => {
  await seed(page, (p) => { p.settings.timing.startMs = 500; p.levels.digits.durationMs = 500; });
  await page.goto('/');
  await page.getByTestId('tile-digits').click();
  for (let i = 0; i < 3; i++) {
    const { choices, answer } = await waitForChoices(page);
    await choices.locator(`button[data-value="${answer}"]`).click();
  }
  await page.getByTestId('back').click();
  await expect(page.getByTestId('tile-digits')).toBeVisible();
  const p = (await readState(page)).profiles[0];
  expect(p.rewards.stars).toBe(0);
  expect(p.history).toHaveLength(0);
  expect(p.levels.digits.durationMs).toBe(400);
});

test('only known letters are asked', async ({ page }) => {
  await seed(page, fixed(500, (p) => { p.settings.letters.known = ['B', 'D']; }));
  await page.goto('/');
  await page.getByTestId('tile-letters').click();
  const { choices } = await waitForChoices(page);
  const values = await choices.locator('button.choice').evaluateAll((bs) => bs.map((b) => b.dataset.value));
  expect(values.sort()).toEqual(['B', 'D']);
});

test('small phone viewport: ten answer buttons fit without scrolling', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'viewport test runs once');
  await page.setViewportSize({ width: 360, height: 640 });
  await seed(page, fixed(500, (p) => { p.settings.quantity = { max: 10, layout: 'mixed' }; }));
  await page.goto('/');
  await page.getByTestId('tile-quantity').click();
  const { choices } = await waitForChoices(page);
  const buttons = choices.locator('button.choice');
  await expect(buttons).toHaveCount(10);
  for (const box of await buttons.evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect().toJSON()))) {
    expect(box.width).toBeGreaterThanOrEqual(64);
    expect(box.height).toBeGreaterThanOrEqual(64);
    expect(box.right).toBeLessThanOrEqual(360);
    expect(box.bottom).toBeLessThanOrEqual(640);
  }
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
});
