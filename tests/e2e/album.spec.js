import { test, expect } from '@playwright/test';
import { seed } from './helpers.js';

test('album shows collected stickers and locked pages', async ({ page }) => {
  await seed(page, (p) => { p.rewards = { stars: 60, stickers: ['animals/lion', 'vehicles/bus'], unlockedPages: 2 }; });
  await page.goto('/');
  await page.getByTestId('open-album').click();
  await expect(page.getByTestId('sticker-animals/lion')).toHaveClass(/collected/);
  await expect(page.getByTestId('sticker-animals/zebra')).not.toHaveClass(/collected/);
  await page.getByTestId('album-tab-vehicles').click();
  await expect(page.getByTestId('sticker-vehicles/bus')).toHaveClass(/collected/);
  await page.getByTestId('album-tab-space').click();
  await expect(page.getByTestId('locked-page')).toContainText('100');
  await page.getByTestId('back').click();
  await expect(page.getByTestId('tile-quantity')).toBeVisible();
});

test('menu album button shows the sticker count', async ({ page }) => {
  await seed(page, (p) => { p.rewards.stickers = ['animals/lion', 'animals/zebra']; });
  await page.goto('/');
  await expect(page.getByTestId('open-album')).toHaveText('2');
});
