import { test, expect } from '@playwright/test';
import { seed } from './helpers.js';

test('album groups pages by exercise and opens them by level', async ({ page }) => {
  await seed(page, (p) => {
    p.levels.letters.level = 1;
    p.rewards = { stars: 60, stickers: ['animals/lion', 'sea/fish', 'food/pizza'], reached: { quantity: 0, digits: 0, letters: 1, syllables: 0 } };
  });
  await page.goto('/');
  await page.getByTestId('open-album').click();
  for (const ex of ['quantity', 'digits', 'letters', 'syllables']) await expect(page.getByTestId(`album-group-${ex}`).locator('.album-tab')).toHaveCount(5);
  await expect(page.getByTestId('sticker-fruit/pear')).toBeVisible(); // first page: Mengen level 1
  await page.getByTestId('album-tab-animals').click();
  await expect(page.getByTestId('sticker-animals/lion')).toHaveClass(/collected/);
  await expect(page.getByTestId('sticker-animals/zebra')).not.toHaveClass(/collected/);
  await page.getByTestId('album-tab-sea').click();
  await expect(page.getByTestId('sticker-sea/fish')).toHaveClass(/collected/);
  // Essen = Mengen level 4 is not reached, but stays visible because a sticker from it was collected earlier
  await page.getByTestId('album-tab-food').click();
  await expect(page.getByTestId('sticker-food/pizza')).toHaveClass(/collected/);
  await page.getByTestId('album-tab-vehicles').click();
  await expect(page.getByTestId('locked-page')).toContainText('Level 2');
  await page.getByTestId('back').click();
  await expect(page.getByTestId('tile-quantity')).toBeVisible();
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
  await page.getByTestId('album-tab-garden').click();
  await expect(page.getByTestId('locked-page')).toBeVisible();
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
