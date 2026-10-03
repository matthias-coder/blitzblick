import { test, expect } from '@playwright/test';
import { seed, readState } from './helpers.js';

test('first start asks for a profile and then shows the menu', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-profile').click();
  await expect(page.locator('.form-msg')).toHaveText(/Namen/);
  await page.locator('#profile-name').fill('Mia');
  await page.getByTestId('avatar-dragon').click();
  await page.getByTestId('create-profile').click();
  await expect(page.getByTestId('tile-quantity')).toBeVisible();
  await expect(page.getByTestId('tile-digits')).toBeVisible();
  await expect(page.getByTestId('tile-letters')).toBeVisible();
  const state = await readState(page);
  expect(state.profiles[0].name).toBe('Mia');
  expect(state.profiles[0].avatar).toBe('dragon');
  await page.reload();
  await expect(page.getByTestId('tile-quantity')).toBeVisible();
});

test('letters tile is hidden with fewer than two known letters', async ({ page }) => {
  await seed(page, (p) => { p.settings.letters.known = ['A']; });
  await page.goto('/');
  await expect(page.getByTestId('tile-digits')).toBeVisible();
  await expect(page.getByTestId('tile-letters')).toHaveCount(0);
});

test('with two profiles the picker is shown and switches the active profile', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    const base = (id, name) => ({ id, name, avatar: 'astronaut', createdAt: '2026-10-03T00:00:00.000Z', settings: {}, levels: {}, rewards: { stars: 0, stickers: [], unlockedPages: 1 }, history: [] });
    localStorage.setItem('blitzblick.v1', JSON.stringify({ schemaVersion: 1, activeProfileId: 'a', profiles: [base('a', 'Mia'), base('b', 'Ben')] }));
    sessionStorage.setItem('seeded', '1');
  });
  await page.goto('/');
  await page.getByTestId('profile-b').click();
  await expect(page.getByTestId('tile-quantity')).toBeVisible();
  expect((await readState(page)).activeProfileId).toBe('b');
  await page.getByTestId('switch-profile').click();
  await expect(page.getByTestId('profile-a')).toBeVisible();
});

test('star badge shows the profile stars', async ({ page }) => {
  await seed(page, (p) => { p.rewards.stars = 42; });
  await page.goto('/');
  await expect(page.getByTestId('star-badge')).toHaveText('42');
});
