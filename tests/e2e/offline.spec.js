import { test, expect } from '@playwright/test';
import { seed } from './helpers.js';

test('the app starts offline after the first visit', async ({ page, context }) => {
  await seed(page, (p) => { p.settings.timing = { startMs: 3000, minMs: 300, maxMs: 3000, adaptive: false }; });
  await page.addInitScript(() => { Math.random = () => 0.99; });
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('tile-quantity')).toBeVisible();
  await page.getByTestId('tile-quantity').click();
  await page.waitForFunction(() => document.querySelector('.obj')?.complete === true);
});

test('manifest is valid and linked', async ({ page }) => {
  await page.goto('/');
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.name).toBe('Blitzblick');
  expect(manifest.display).toBe('fullscreen');
  expect(manifest.icons.some((i) => i.sizes === '512x512')).toBe(true);
});
