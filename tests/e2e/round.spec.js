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

async function playPerfectRound(page, tile = 'tile-quantity') {
  await page.getByTestId(tile).click();
  for (let i = 0; i < 10; i++) {
    const { choices, answer } = await waitForChoices(page);
    await choices.locator(`button[data-value="${answer}"]`).click();
  }
  await expect(page.getByTestId('round-end')).toBeVisible({ timeout: 6000 });
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

test('the board stays during the answer phase and a right answer is cheered', async ({ page }) => {
  await seed(page, fixed(500));
  await page.goto('/');
  await page.getByTestId('tile-digits').click();
  const { choices, answer } = await waitForChoices(page);
  await expect(page.getByTestId('board')).toBeVisible();
  await expect(page.getByTestId('board-waiting')).toBeVisible();
  await choices.locator(`button[data-value="${answer}"]`).click();
  await expect(page.getByTestId('cheer')).toBeVisible();
  await expect(page.locator('.round-stars .slot.earned')).toHaveCount(1);
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

test('a syllables round with the default letters runs to the end with colored syllables', async ({ page }) => {
  await seed(page, fixed(500));
  await page.goto('/');
  await page.getByTestId('tile-syllables').click();
  for (let i = 0; i < 10; i++) {
    const { choices, answer } = await waitForChoices(page);
    await expect(choices.locator('button.choice')).toHaveCount(4);
    await expect(choices.locator('.syl-a').first()).toBeVisible();
    await choices.locator(`button[data-value="${answer}"]`).click();
  }
  await expect(page.getByTestId('round-end')).toBeVisible({ timeout: 6000 });
  const p = (await readState(page)).profiles[0];
  expect(p.history.at(-1)).toMatchObject({ exercise: 'syllables', correct: 10, total: 10 });
});

const onTopAddition = (p) => {
  p.settings.speech = 'off';
  p.settings.sounds = false;
  p.settings.timing = { startMs: 400, minMs: 300, maxMs: 3000, adaptive: true };
  p.levels.quantity = { ...p.levels.quantity, complexity: 99, durationMs: 400 };
  p.levels.digits = { ...p.levels.digits, complexity: 99, durationMs: 400 };
};

test('top quantity stage shows two groups with a plus and accepts the sum', async ({ page }) => {
  await seed(page, onTopAddition);
  await page.goto('/');
  await page.getByTestId('tile-quantity').click();
  await expect(page.getByTestId('add-stimulus')).toBeVisible({ timeout: 6000 });
  const { choices, answer } = await waitForChoices(page);
  await choices.locator(`button[data-value="${answer}"]`).click();
  await expect(page.getByTestId('cheer')).toBeVisible(); // robot cheers on a correct answer
});

test('top digits stage shows "a + b" on one line, also on a 360 px phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await seed(page, onTopAddition);
  await page.goto('/');
  await page.getByTestId('tile-digits').click();
  const sum = page.locator('.flash-text.sum');
  await expect(sum).toBeVisible({ timeout: 6000 });
  await expect(sum).toHaveText(/^\d+ \+ \d+$/);
  const box = await sum.boundingBox();
  const stage = await page.getByTestId('stage').boundingBox();
  expect(box.width).toBeLessThanOrEqual(stage.width + 1);
  expect(box.height).toBeLessThan(stage.height);
});

test('addition stimuli stay inside the board in landscape', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 700 });
  await seed(page, (p) => {
    onTopAddition(p);
    p.settings.timing = { startMs: 3000, minMs: 3000, maxMs: 3000, adaptive: true };
    p.levels.quantity.durationMs = 3000;
    p.levels.digits.durationMs = 3000;
  });
  const inside = async (locator) => {
    const b = await page.getByTestId('board').boundingBox();
    const s = await locator.boundingBox();
    expect(s.x).toBeGreaterThanOrEqual(b.x - 1);
    expect(s.x + s.width).toBeLessThanOrEqual(b.x + b.width + 1);
  };
  await page.goto('/');
  await page.getByTestId('tile-quantity').click();
  const fields = page.getByTestId('add-stimulus').locator('.field');
  await expect(fields.first()).toBeVisible({ timeout: 6000 });
  await inside(fields.first());
  await inside(fields.last());
  await page.getByTestId('back').click();
  await page.getByTestId('tile-digits').click();
  const sum = page.locator('.flash-text.sum');
  await expect(sum).toBeVisible({ timeout: 6000 });
  await inside(sum);
});

test('the new sticker flies into the album button, which counts it', async ({ page }) => {
  await seed(page, fixed(500));
  await page.goto('/');
  await playPerfectRound(page);
  await expect(page.getByTestId('new-sticker')).toBeVisible();
  await expect(page.getByTestId('album-count')).toHaveText('0');
  await expect(page.getByTestId('album-count')).toHaveText('1', { timeout: 5000 });
  await expect(page.getByTestId('to-album')).toHaveClass(/\bbump\b/);
});

test('leaving the round end mid-animation leaves nothing behind', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seed(page, fixed(500));
  await page.goto('/');
  await playPerfectRound(page);
  await page.getByTestId('round-done').click();
  await expect(page.getByTestId('tile-quantity')).toBeVisible();
  await page.waitForTimeout(3000);
  await expect(page.locator('.sticker-reveal, .rays')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('with reduced motion the sticker stays put and the count is final', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, fixed(500));
  await page.goto('/');
  await playPerfectRound(page);
  await expect(page.getByTestId('album-count')).toHaveText('1');
  await page.waitForTimeout(3000);
  await expect(page.locator('.sticker-reveal')).toBeVisible();
});
