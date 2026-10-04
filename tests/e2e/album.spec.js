import { test, expect } from '@playwright/test';
import { seed } from './helpers.js';

test('album groups pages by exercise and opens them by level', async ({ page }) => {
  await seed(page, (p) => {
    p.levels.letters.level = 1;
    p.rewards = { stars: 60, stickers: ['animals/lion', 'sea/fish', 'food/pizza'], reached: { quantity: 0, digits: 0, letters: 1, syllables: 0 } };
  });
  await page.goto('/');
  await page.getByTestId('open-album').click();
  for (const ex of ['quantity', 'digits', 'letters', 'syllables']) await expect(page.getByTestId(`album-group-${ex}`).locator('.album-tab')).toHaveCount(4);
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
