import { test, expect } from '@playwright/test';
import { seed, readState } from './helpers.js';

const N = 5; // tasks per round

const fixed = (ms, extra = () => {}) => (p) => {
  p.settings.timing = { startMs: ms, minMs: 300, maxMs: 3000, adaptive: false };
  extra(p);
};

async function waitForChoices(page) {
  const choices = page.getByTestId('choices');
  await expect(choices.locator('button.choice:enabled').first()).toBeVisible({ timeout: 6000 });
  return { choices, answer: await choices.getAttribute('data-answer') };
}

async function playZeroRound(page, tile = 'tile-digits') {
  await page.getByTestId(tile).click();
  for (let i = 0; i < N; i++) {
    const { choices, answer } = await waitForChoices(page);
    await choices.locator(`button:not([data-value="${answer}"])`).first().click();
  }
  await expect(page.getByTestId('round-end')).toBeVisible({ timeout: 6000 });
}

async function playPerfectRound(page, tile = 'tile-quantity') {
  await page.getByTestId(tile).click();
  for (let i = 0; i < N; i++) {
    const { choices, answer } = await waitForChoices(page);
    await choices.locator(`button[data-value="${answer}"]`).click();
  }
  await expect(page.getByTestId('round-end')).toBeVisible({ timeout: 6000 });
}

test('a full quantity round awards stars and no sticker', async ({ page }) => {
  await seed(page, fixed(500));
  await page.goto('/');
  await page.getByTestId('tile-quantity').click();
  for (let i = 0; i < N; i++) {
    const { choices, answer } = await waitForChoices(page);
    await choices.locator(`button[data-value="${answer}"]`).click();
  }
  await expect(page.getByTestId('round-end')).toBeVisible({ timeout: 6000 });
  await expect(page.getByTestId('pack-progress')).toContainText('Noch 5');
  await expect(page.getByTestId('new-sticker')).toHaveCount(0);
  const p = (await readState(page)).profiles[0];
  expect(p.rewards.stars).toBe(5);
  expect(p.rewards.stickers).toHaveLength(0);
  expect(p.history).toHaveLength(1);
  await page.getByTestId('round-done').click();
  await expect(page.getByTestId('star-badge')).toHaveText('5');
});

test('with fewer correct answers there are fewer stars and progress towards the next pack', async ({ page }) => {
  await seed(page, fixed(500));
  await page.goto('/');
  await page.getByTestId('tile-quantity').click();
  for (let i = 0; i < N; i++) {
    const { choices, answer } = await waitForChoices(page);
    const value = i < 2 ? await choices.locator(`button.choice:not([data-value="${answer}"])`).first().getAttribute('data-value') : answer;
    await choices.locator(`button[data-value="${value}"]`).click();
  }
  await expect(page.getByTestId('round-end')).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('pack-progress')).toContainText('Noch 7');
  await expect(page.getByTestId('new-sticker')).toHaveCount(0);
  const p = (await readState(page)).profiles[0];
  expect(p.rewards.stars).toBe(3);
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
  await seed(page, fixed(500, (p) => { p.levels.quantity.level = 3; p.settings.quantity = { compare: false }; })); // Vorschule level 4: bis 10
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
  for (let i = 0; i < N; i++) {
    const { choices, answer } = await waitForChoices(page);
    await expect(choices.locator('button.choice')).toHaveCount(3); // Vorschule level 1: three answers
    await expect(choices.locator('.syl-a').first()).toBeVisible();
    await choices.locator(`button[data-value="${answer}"]`).click();
  }
  await expect(page.getByTestId('round-end')).toBeVisible({ timeout: 6000 });
  const p = (await readState(page)).profiles[0];
  expect(p.history.at(-1)).toMatchObject({ exercise: 'syllables', correct: 5, total: 5 });
});

const onTopAddition = (p) => {
  p.settings.speech = 'off';
  p.settings.sounds = false;
  p.settings.timing = { startMs: 400, minMs: 300, maxMs: 3000, adaptive: true };
  p.settings.grade = 'g1';
  p.levels.quantity = { ...p.levels.quantity, level: 2, step: 1, durationMs: 400 };
  p.levels.digits = { ...p.levels.digits, level: 2, step: 1, durationMs: 400 };
};

test('Klasse 1 Plus level in quantity shows two groups with a plus and accepts the sum', async ({ page }) => {
  await seed(page, onTopAddition);
  await page.goto('/');
  await page.getByTestId('tile-quantity').click();
  await expect(page.getByTestId('add-stimulus')).toBeVisible({ timeout: 6000 });
  const { choices, answer } = await waitForChoices(page);
  await choices.locator(`button[data-value="${answer}"]`).click();
  await expect(page.getByTestId('cheer')).toBeVisible(); // robot cheers on a correct answer
});

test('Klasse 1 Plus level in digits shows "a + b" on one line, also on a 360 px phone', async ({ page }) => {
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

test('enough stars after a round: trade hint opens the album on the played page', async ({ page }) => {
  await seed(page, fixed(500, (p) => { p.rewards.stars = 8; }));
  await page.goto('/');
  await playPerfectRound(page);
  await expect(page.getByTestId('trade-hint')).toBeVisible();
  await page.getByTestId('trade-hint').click();
  await expect(page.getByTestId('open-pack')).toBeEnabled();
  await expect(page.getByTestId('album-tab-fruit')).toHaveClass(/active/);
});

test('the secret sticker flies into the album button, which counts it', async ({ page }) => {
  await seed(page, fixed(500));
  await page.goto('/');
  await playZeroRound(page);
  await expect(page.getByTestId('new-sticker')).toBeVisible();
  await expect(page.getByTestId('album-count')).toHaveText('0');
  await expect(page.getByTestId('album-count')).toHaveText('1', { timeout: 5000 });
  await expect(page.getByTestId('to-album')).toHaveClass(/\bbump\b/);
});

test('leaving the round end mid-animation leaves nothing behind', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.__anims = 0;
    const orig = Element.prototype.animate;
    Element.prototype.animate = function (...args) { window.__anims++; return orig.apply(this, args); };
  });
  await seed(page, fixed(500));
  await page.goto('/');
  await playPerfectRound(page);
  await page.getByTestId('round-done').click();
  await expect(page.getByTestId('tile-quantity')).toBeVisible();
  const before = await page.evaluate(() => window.__anims);
  await page.waitForTimeout(3000);
  expect(await page.evaluate(() => window.__anims)).toBe(before);
  await expect(page.locator('.sticker-reveal, .rays')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('with reduced motion the sticker stays put and the count is final', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, fixed(500));
  await page.goto('/');
  await playZeroRound(page);
  await expect(page.getByTestId('album-count')).toHaveText('1');
  await page.waitForTimeout(3000);
  await expect(page.locator('.sticker-reveal')).toBeVisible();
});

test.describe('round end in phone landscape', () => {
  test.use({ viewport: { width: 740, height: 360 } });

  async function expectActionsInside(page) {
    const vp = page.viewportSize();
    for (const id of ['play-again', 'to-album', 'round-done']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, id).not.toBeNull();
      expect(box.x, id).toBeGreaterThanOrEqual(0);
      expect(box.y, id).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, id).toBeLessThanOrEqual(vp.width);
      expect(box.y + box.height, id).toBeLessThanOrEqual(vp.height);
    }
  }

  test('buttons stay fully visible with a new sticker', async ({ page }) => {
    await seed(page, fixed(500));
    await page.goto('/');
    await playZeroRound(page);
    await expect(page.getByTestId('new-sticker')).toBeVisible();
    await expectActionsInside(page);
  });

  test('buttons stay fully visible without a sticker', async ({ page }) => {
    await seed(page, fixed(500));
    await page.goto('/');
    await page.getByTestId('tile-quantity').click();
    for (let i = 0; i < N; i++) {
      const { choices, answer } = await waitForChoices(page);
      const value = i < 2 ? await choices.locator(`button.choice:not([data-value="${answer}"])`).first().getAttribute('data-value') : answer;
      await choices.locator(`button[data-value="${value}"]`).click();
    }
    await expect(page.getByTestId('pack-progress')).toBeVisible({ timeout: 8000 });
    await expectActionsInside(page);
  });
});

test('letters are shown on Lineatur 1 with the little house, in the Grundschrift', async ({ page }) => {
  await seed(page, fixed(3000));
  await page.goto('/');
  await page.getByTestId('tile-letters').click();
  const lin = page.getByTestId('stimulus').getByTestId('lineatur');
  await expect(lin).toBeVisible({ timeout: 6000 });
  await expect(lin.locator('.lin-house')).toHaveCount(1);
  await expect(lin.locator('line')).toHaveCount(4);
  const font = await lin.locator('text').evaluate((t) => getComputedStyle(t).fontFamily);
  expect(font).toContain('Playwrite DE Grund');
  expect(await page.evaluate(() => document.fonts.check('40px "Playwrite DE Grund"'))).toBe(true);
});

test('without the lineature switch the letter is plain text', async ({ page }) => {
  await seed(page, fixed(3000, (p) => { p.settings.letters.lineature = false; }));
  await page.goto('/');
  await page.getByTestId('tile-letters').click();
  await expect(page.getByTestId('stimulus').locator('.flash-text.school')).toBeVisible({ timeout: 6000 });
  await expect(page.getByTestId('lineatur')).toHaveCount(0);
});

test('a mastered level moves up at the round end and opens the next sticker page', async ({ page }) => {
  await seed(page, (p) => {
    p.settings.timing = { startMs: 400, minMs: 400, maxMs: 3000, adaptive: true };
    p.levels.digits = { ...p.levels.digits, step: 0, durationMs: 400 };
  });
  await page.goto('/');
  await playPerfectRound(page, 'tile-digits');
  await expect(page.getByTestId('level-up')).toHaveAttribute('aria-label', 'Level 2');
  await expect(page.getByTestId('level-up-num')).toHaveText('2');
  await expect(page.getByTestId('level-gift')).toContainText('15');
  await expect(page.getByTestId('end-mascot')).toHaveAttribute('src', /robot-trophy\.webp$/);
  await expect(page.getByTestId('page-unlocked')).toBeVisible();
  const p = (await readState(page)).profiles[0];
  expect(p.levels.digits.level).toBe(1);
  expect(p.rewards.reached.digits).toBe(1);
});

test('Zwanzigerfeld: twenty objects fit on the board', async ({ page }) => {
  await seed(page, fixed(3000, (p) => {
    p.settings.grade = 'g1';
    p.levels.quantity = { ...p.levels.quantity, level: 3 };
    p.settings.quantity = { compare: false }; // compare tasks would hide the twenty field
  }));
  await page.goto('/');
  await page.getByTestId('tile-quantity').click();
  const field = page.getByTestId('stimulus').locator('.field.twenty');
  await expect(field).toBeVisible({ timeout: 6000 });
  const board = await page.getByTestId('board').boundingBox();
  for (const b of await field.locator('.obj').evaluateAll((os) => os.map((o) => o.getBoundingClientRect().toJSON()))) {
    expect(b.left).toBeGreaterThanOrEqual(board.x - 1);
    expect(b.right).toBeLessThanOrEqual(board.x + board.width + 1);
    expect(b.top).toBeGreaterThanOrEqual(board.y - 1);
    expect(b.bottom).toBeLessThanOrEqual(board.y + board.height + 1);
  }
  const { choices } = await waitForChoices(page);
  await expect(choices.locator('button.choice')).toHaveCount(4);
});

test('quantity can count album stickers, and the sticker image loads', async ({ page }) => {
  // stubbing Math.random to 0.99 ensures the task is always an object task (not fingers or compare)
  // and the random draw picks the round's object: the last one in the pool is a sticker
  await stubRandom(page, 0.99);
  await seed(page, fixed(3000));
  await page.goto('/');
  await page.getByTestId('tile-quantity').click();
  const obj = page.getByTestId('stimulus').locator('.obj').first();
  await expect(obj).toBeVisible({ timeout: 6000 });
  await expect(obj).toHaveAttribute('src', /^assets\/stickers\/[a-z]+\/[a-z]+\.webp$/);
  expect(await obj.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
});

test('a round with no correct answer gives a secret sticker, and the album shows the secret page', async ({ page }) => {
  await seed(page, fixed(500));
  await page.goto('/');
  await page.getByTestId('open-album').click();
  await expect(page.getByTestId('album-group-quantity')).toBeVisible();
  await expect(page.getByTestId('album-group-secret')).toHaveCount(0);
  await page.getByTestId('back').click();
  await page.getByTestId('tile-digits').click();
  for (let i = 0; i < N; i++) {
    const { choices, answer } = await waitForChoices(page);
    await choices.locator(`button:not([data-value="${answer}"])`).first().click();
  }
  await expect(page.getByTestId('round-end')).toBeVisible({ timeout: 6000 });
  await expect(page.getByTestId('new-sticker')).toHaveAttribute('data-sticker', /^mischief\//);
  await expect(page.getByTestId('trade-hint')).toHaveCount(0);
  await page.getByTestId('round-done').click();
  await page.getByTestId('open-album').click();
  await page.getByTestId('album-tab-mischief').click();
  await expect(page.locator('[data-testid^="sticker-mischief/"].collected')).toHaveCount(1);
  const p = (await readState(page)).profiles[0];
  expect(p.rewards.secretDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

// "Mama" with its wide M and m was cut off on the right: the length-based font size ignores glyph widths
test('flash words with wide letters stay inside the board and the answer buttons', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, (p) => {
    fixed(3000)(p);
    p.settings.letters.known = ['A', 'M', 'O'];
    p.levels.syllables = { ...p.levels.syllables, level: 2, step: 0 };
  });
  await page.goto('/');
  await page.getByTestId('tile-syllables').click();
  const word = page.locator('.board .flash-word');
  await expect(word).toBeVisible({ timeout: 6000 });
  const b = await page.getByTestId('board').boundingBox();
  const w = await word.boundingBox();
  expect(w.x).toBeGreaterThanOrEqual(b.x - 1);
  expect(w.x + w.width).toBeLessThanOrEqual(b.x + b.width + 1);
  const { choices } = await waitForChoices(page);
  for (const btn of await choices.locator('button.choice').all()) {
    const bb = await btn.boundingBox();
    const wb = await btn.locator('.word').boundingBox();
    expect(wb.width).toBeLessThanOrEqual(bb.width);
  }
});

test('screen readers hear the question and the result', async ({ page }) => {
  await seed(page, fixed(500));
  await page.goto('/');
  await page.getByTestId('tile-quantity').click();
  const status = page.getByTestId('round-status');
  const { choices, answer } = await waitForChoices(page);
  await expect(status).toHaveText('Wie viele waren es?');
  await choices.locator(`button[data-value="${answer}"]`).click();
  await expect(status).toHaveText('Richtig!');
});

// Math.random is stubbed to a constant: the first quantity task on a compare level is then a compare task
const stubRandom = (page, v = 0.05) => page.addInitScript((x) => { Math.random = () => x; }, v);
const compareLevel = (extra = () => {}) => (p) => {
  p.settings.grade = 'g1';
  p.settings.timing = { startMs: 800, minMs: 300, maxMs: 3000, adaptive: true };
  p.levels.quantity = { ...p.levels.quantity, level: 0, step: 0, durationMs: 800 };
  extra(p);
};

test('Wo ist mehr? tapping the side with more counts as correct', async ({ page }) => {
  await stubRandom(page);
  await seed(page, compareLevel());
  await page.goto('/');
  await page.getByTestId('tile-quantity').click();
  await expect(page.getByTestId('compare-stimulus')).toBeVisible({ timeout: 6000 });
  const { choices, answer } = await waitForChoices(page);
  expect(['left', 'right']).toContain(answer);
  await choices.locator(`button[data-value="${answer}"]`).click();
  await expect(page.getByTestId('cheer')).toBeVisible();
});

test('Wo ist mehr? a wrong side shows both groups again as the solution', async ({ page }) => {
  await stubRandom(page);
  await seed(page, compareLevel());
  await page.goto('/');
  await page.getByTestId('tile-quantity').click();
  const { choices, answer } = await waitForChoices(page);
  await choices.locator(`button:not([data-value="${answer}"])`).first().click();
  await expect(page.locator('.stimulus.solution [data-testid="compare-stimulus"] .field')).toHaveCount(2);
});

test('no compare tasks when the parents switched them off', async ({ page }) => {
  await stubRandom(page);
  await seed(page, compareLevel((p) => { p.settings.quantity = { compare: false }; }));
  await page.goto('/');
  await page.getByTestId('tile-quantity').click();
  const { answer } = await waitForChoices(page);
  expect(Number(answer)).toBeGreaterThan(0);
  await expect(page.getByTestId('compare-stimulus')).toHaveCount(0);
});

for (const [w, hgt] of [[360, 640], [640, 360]]) {
  test(`compare fields sit side by side inside the board at ${w}×${hgt}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: hgt });
    await stubRandom(page);
    await seed(page, compareLevel((p) => {
      p.settings.timing = { startMs: 3000, minMs: 3000, maxMs: 3000, adaptive: true };
      p.levels.quantity.durationMs = 3000;
    }));
    await page.goto('/');
    await page.getByTestId('tile-quantity').click();
    const fields = page.getByTestId('compare-stimulus').locator('.field');
    await expect(fields.first()).toBeVisible({ timeout: 6000 });
    const a = await fields.first().boundingBox();
    const b = await fields.last().boundingBox();
    const board = await page.getByTestId('board').boundingBox();
    expect(a.x + a.width).toBeLessThanOrEqual(b.x + 1); // left field ends before the right one starts
    expect(Math.abs(a.y - b.y)).toBeLessThan(2);         // same row
    for (const f of [a, b]) {
      expect(f.x).toBeGreaterThanOrEqual(board.x - 1);
      expect(f.x + f.width).toBeLessThanOrEqual(board.x + board.width + 1);
    }
  });
}

test('👁 shows the flash once more per task, 🔊 is hidden with speech off', async ({ page }) => {
  await seed(page, fixed(500));
  await page.goto('/');
  await page.getByTestId('tile-digits').click();
  await expect(page.locator('h1')).toHaveText('Zahlenblitz');
  const eye = page.getByTestId('show-again');
  await expect(eye).toBeDisabled(); // flash still running
  await waitForChoices(page);
  await expect(page.getByTestId('say-again')).toBeHidden();
  await expect(eye).toBeEnabled();
  await eye.click();
  await expect(page.getByTestId('choices')).toHaveClass(/pending/);
  await expect(page.getByTestId('board-waiting')).toBeVisible({ timeout: 4000 });
  await expect(page.getByTestId('choices')).not.toHaveClass(/pending/);
  await expect(eye).toBeDisabled(); // once per task
  const { choices, answer } = await waitForChoices(page);
  await choices.locator(`button[data-value="${answer}"]`).click();
  await expect(page.locator('.round-stars .slot.earned')).toHaveCount(1); // the star still counts
  await waitForChoices(page);
  await expect(eye).toBeEnabled(); // next task: one replay again
});

test('🔊 is shown with speech on and only active while the answers wait', async ({ page }) => {
  await seed(page, fixed(500, (p) => { p.settings.speech = 'little'; }));
  await page.goto('/');
  await page.getByTestId('tile-quantity').click();
  const say = page.getByTestId('say-again');
  await expect(say).toBeVisible();
  await expect(say).toBeDisabled();
  const { choices, answer } = await waitForChoices(page);
  await expect(say).toBeEnabled();
  await say.click();
  await choices.locator(`button[data-value="${answer}"]`).click();
  await expect(say).toBeDisabled();
});
