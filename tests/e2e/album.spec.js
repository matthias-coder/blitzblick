import { test, expect } from '@playwright/test';
import { seed } from './helpers.js';

test('the album opens on the last played world; chips switch worlds and show four level pages', async ({ page }) => {
  await seed(page, (p) => {
    p.levels.letters.level = 1;
    p.history = [{ date: '2026-10-04', exercise: 'letters', correct: 5, total: 5, confusions: {} }];
    p.rewards = { stars: 60, stickers: ['animals/lion', 'sea/fish', 'food/pizza'], reached: { quantity: 0, digits: 0, letters: 1, syllables: 0 } };
  });
  await page.goto('/');
  await page.getByTestId('open-album').click();
  await expect(page.locator('h1')).toHaveText('Sammelalbum');
  await expect(page.getByTestId('album-world-letters')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('album-tab-sea')).toHaveClass(/active/); // current level page
  await expect(page.locator('.album-tabs .album-tab')).toHaveCount(4);
  await expect(page.getByTestId('album-world-bonus')).toHaveCount(0);
  await expect(page.getByTestId('sticker-sea/fish')).toHaveAttribute('aria-label', 'Fisch');
  await expect(page.getByTestId('sticker-sea/whale')).toHaveAttribute('aria-label', 'Wal, fehlt');
  await expect(page.getByTestId('sticker-sea/whale').locator('.sticker-missing')).toBeVisible();
  await page.getByTestId('album-tab-animals').click();
  await expect(page.getByTestId('sticker-animals/lion')).toHaveClass(/collected/);
  await page.getByTestId('album-world-quantity').click();
  await expect(page.getByTestId('album-tab-animals')).toHaveCount(0);
  await page.getByTestId('album-tab-food').click();
  await expect(page.getByTestId('sticker-food/pizza')).toHaveClass(/collected/);
  await page.getByTestId('album-world-digits').click();
  await page.getByTestId('album-tab-vehicles').click();
  await expect(page.getByTestId('locked-page')).toContainText('Level 2');
  await page.getByTestId('back').click();
  await expect(page.getByTestId('tile-quantity')).toBeVisible();
});

test('without any played round the album opens on Mengen', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.getByTestId('open-album').click();
  await expect(page.getByTestId('album-world-quantity')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('album-tab-fruit')).toHaveClass(/active/);
});

test('the pack result is a dialog: focus moves in, Escape closes, focus returns to the pack button', async ({ page }) => {
  await seed(page, (p) => { p.rewards.stars = 25; });
  await page.goto('/');
  await page.getByTestId('open-album').click();
  await page.getByTestId('open-pack').click();
  const dlg = page.getByTestId('pack-result');
  await expect(dlg).toHaveAttribute('role', 'dialog');
  await expect(dlg).toHaveAttribute('aria-modal', 'true');
  await expect(page.getByTestId('pack-close')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  await expect(page.getByTestId('open-pack')).toBeFocused();
});

test('album tab rows fade at the edge while more tabs are hidden', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await seed(page, (p) => { p.rewards.stickers = ['mischief/toast', 'garden/bee']; });
  await page.goto('/');
  await page.getByTestId('open-album').click();
  const row = page.locator('.album-worlds');
  expect(await row.evaluate((n) => n.scrollWidth > n.clientWidth)).toBe(true);
  await expect(row).toHaveClass(/fade-end/);
  for (const tab of await page.locator('.album-tab').all()) {
    const t = await tab.boundingBox();
    const b = await tab.locator('.album-tab-level').boundingBox();
    expect(b.x + b.width).toBeLessThanOrEqual(t.x + t.width + 1);
    expect(b.y + b.height).toBeLessThanOrEqual(t.y + t.height + 1);
  }
});

test('menu album button shows the sticker count', async ({ page }) => {
  await seed(page, (p) => { p.rewards.stickers = ['animals/lion', 'animals/zebra']; });
  await page.goto('/');
  await expect(page.getByTestId('open-album')).toHaveText('2');
});

test('trading stars for a pack adds a sticker and lowers the balance', async ({ page }) => {
  await seed(page, (p) => { p.rewards.stars = 12; });
  await page.goto('/');
  await page.getByTestId('open-album').click();
  await expect(page.getByTestId('open-pack')).toContainText('10');
  await page.getByTestId('open-pack').click();
  await expect(page.getByTestId('pack-result')).toBeVisible();
  await expect(page.getByTestId('star-badge')).toHaveText('2');
  await expect(page.locator('.sticker.collected')).toHaveCount(1);
  await expect(page.getByTestId('open-pack')).toBeDisabled();
  await page.getByTestId('open-pack').click({ force: true });
  await expect(page.getByTestId('star-badge')).toHaveText('2');
});

test('duplicates show a count badge; complete pages cannot be traded', async ({ page }) => {
  const fruit = ['pear', 'orange', 'lemon', 'pineapple', 'cherry', 'peach', 'kiwi', 'plum'].map((s) => `fruit/${s}`);
  await seed(page, (p) => { p.rewards.stickers = fruit; p.rewards.counts = { 'fruit/kiwi': 3 }; });
  await page.goto('/');
  await page.getByTestId('open-album').click();
  await expect(page.getByTestId('sticker-count-fruit/kiwi')).toHaveText('3');
  await expect(page.getByTestId('sticker-count-fruit/pear')).toHaveCount(0);
  await expect(page.getByTestId('page-complete')).toBeVisible();
  await expect(page.getByTestId('open-pack')).toHaveCount(0);
});

test('the bonus tab is locked until the exercise pages are full', async ({ page }) => {
  await seed(page, () => {});
  await page.goto('/');
  await page.getByTestId('open-album').click();
  await expect(page.getByTestId('album-world-bonus')).toHaveCount(0);
});

test('a full exercise opens its bonus page for trading at 30 stars', async ({ page }) => {
  const pages = { fruit: ['pear', 'orange', 'lemon', 'pineapple', 'cherry', 'peach', 'kiwi', 'plum'],
    veggies: ['carrot', 'tomato', 'broccoli', 'corn', 'pepper', 'pumpkin', 'mushroom', 'toadstool'],
    treats: ['icecream', 'cake', 'grapes', 'banana', 'cocoa', 'cheese', 'watermelon', 'strawberry'],
    food: ['pizza', 'burger', 'taco', 'roastchicken', 'popsicle', 'birthdaycake', 'spaghetti', 'hotdog'] };
  await seed(page, (p) => {
    p.rewards.stars = 30;
    p.rewards.reached.quantity = 3;
    p.rewards.stickers = Object.entries(pages).flatMap(([id, s]) => s.map((n) => `${id}/${n}`));
  });
  await page.goto('/');
  await page.getByTestId('open-album').click();
  await page.getByTestId('album-world-bonus').click();
  await page.getByTestId('album-tab-garden').click();
  await expect(page.getByTestId('open-pack')).toContainText('30');
  await page.getByTestId('open-pack').click();
  await expect(page.locator('.sticker.collected')).toHaveCount(1);
});

test('a visible page whose level is not reached offers no pack button', async ({ page }) => {
  await seed(page, (p) => { p.rewards.stars = 120; p.rewards.reached.quantity = 1; p.rewards.stickers = ['food/pizza']; });
  await page.goto('/');
  await page.getByTestId('open-album').click();
  await page.getByTestId('album-tab-food').click();
  await expect(page.getByTestId('sticker-food/pizza')).toHaveClass(/collected/);
  await expect(page.getByTestId('open-pack')).toHaveCount(0);
});

// the album route can ask for a bonus page (trade hint) or a secret sticker (highlight) although the world chip would not show on its own
async function renderAlbum(page, profile, params) {
  await page.goto('/');
  return page.evaluate(async ({ profile, params }) => {
    const { render } = await import('/js/ui/album.js');
    const root = document.createElement('div');
    root.id = 'album-probe';
    document.body.append(root);
    const ctx = { profile, state: {}, setState() {}, go() {}, pick: (k, l) => l[0], sounds: { fanfare() {} }, speech: { speak() {} } };
    window.__cleanup = render(root, ctx, params);
    return true;
  }, { profile, params });
}

test('a trade hint for a bonus page opens the bonus world even before it is unlocked', async ({ page }) => {
  const state = await seed(page);
  await renderAlbum(page, state.profiles[0], { page: 'garden' });
  await expect(page.getByTestId('album-world-bonus')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('album-tab-garden')).toHaveClass(/active/);
  await expect(page.locator('#album-probe .album-tabs .album-tab')).toHaveCount(4);
});

test('a highlighted secret sticker opens the secret world', async ({ page }) => {
  const state = await seed(page, (p) => { p.rewards.stickers = ['mischief/toast']; });
  await renderAlbum(page, state.profiles[0], { highlight: 'mischief/toast' });
  await expect(page.getByTestId('album-tab-mischief')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('sticker-mischief/toast')).toHaveClass(/highlight/);
});

test('closing the pack dialog and leaving the album remove the key listener', async ({ page }) => {
  await seed(page, (p) => { p.rewards.stars = 25; });
  await page.goto('/');
  await page.evaluate(() => {
    window.__keys = 0;
    const add = document.addEventListener.bind(document);
    document.addEventListener = (t, f, o) => { if (t === 'keydown') window.__keys++; return add(t, f, o); };
    const rem = document.removeEventListener.bind(document);
    document.removeEventListener = (t, f, o) => { if (t === 'keydown') window.__keys--; return rem(t, f, o); };
  });
  await page.getByTestId('open-album').click();
  await page.getByTestId('open-pack').click();
  await expect(page.getByTestId('pack-result')).toBeVisible();
  expect(await page.evaluate(() => window.__keys)).toBe(1);
  await page.getByTestId('back').dispatchEvent('click'); // leave with the dialog still open
  await expect(page.getByTestId('tile-quantity')).toBeVisible();
  expect(await page.evaluate(() => window.__keys)).toBe(0);
});

test('the world chips row holds only chips, no stray text', async ({ page }) => {
  await seed(page, (p) => { p.rewards.stickers = ['animals/lion']; });
  await page.goto('/');
  await page.getByTestId('open-album').click();
  await expect(page.getByTestId('album-world-quantity')).toBeVisible();
  await expect(page.locator('.album-worlds')).toHaveText(/^\s*Mengen\s*Zahlen\s*Buchstaben\s*Silben\s*$/);
  expect(await page.locator('.album-worlds').evaluate((n) => [...n.childNodes].filter((c) => c.nodeType === 3).length)).toBe(0);
});
