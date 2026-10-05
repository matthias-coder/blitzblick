import { test, expect } from '@playwright/test';
import { seed, readState, contrast } from './helpers.js';

test('first start asks for a profile and then shows the menu', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('welcome')).toContainText('Hallo! Schön, dass du da bist.');
  await expect(page.getByTestId('create-profile')).toHaveCount(0);
  await page.getByTestId('welcome-start').click();
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
  await expect(page.getByTestId('welcome')).toHaveCount(0);
  await expect(page.getByTestId('star-badge')).toHaveText('42');
});

test('buttons use the candy system and sink when pressed', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  const album = page.getByTestId('open-album');
  await expect(album).toHaveClass(/\bcandy\b/);
  await expect(album).toHaveClass(/\bcandy-pill\b/);
  const shadow = await album.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).toMatch(/0px 5px 0px/);
  await expect(page.getByTestId('gear')).toHaveClass(/\bcandy-round\b/);
});

const fiveLetters = (p) => { p.settings.letters.known = ['A', 'E', 'L', 'M', 'O']; };

test('menu shows four illustrated tiles in a 2×2 grid with a greeting', async ({ page }) => {
  await seed(page, fiveLetters);
  await page.goto('/');
  const tiles = page.locator('.menu .tile');
  await expect(tiles).toHaveCount(4);
  for (const id of ['quantity', 'digits', 'letters', 'syllables']) {
    await expect(page.getByTestId(`tile-${id}`).locator('img')).toHaveAttribute('src', `assets/menu/${id}.webp`);
  }
  const b = await Promise.all([0, 1, 2, 3].map((i) => tiles.nth(i).boundingBox()));
  expect(Math.abs(b[0].y - b[1].y)).toBeLessThan(2);
  expect(b[2].y).toBeGreaterThan(b[0].y + b[0].height - 1);
  await expect(page.getByTestId('greet')).toHaveText('Hallo Mia! Was möchtest du üben?');
});

test('menu stays usable on a phone in landscape', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await seed(page, fiveLetters);
  await page.goto('/');
  const tiles = page.locator('.menu .tile');
  await expect(tiles).toHaveCount(4);
  for (let i = 0; i < 4; i++) expect((await tiles.nth(i).boundingBox()).height).toBeGreaterThanOrEqual(100);
  const album = await page.getByTestId('open-album').boundingBox();
  expect(album.y + album.height).toBeLessThanOrEqual(375);
});

test('menu fits a narrow phone without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await seed(page, fiveLetters);
  await page.goto('/');
  const tiles = page.locator('.menu .tile');
  await expect(tiles).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    const box = await tiles.nth(i).boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(667);
    expect(box.width).toBeGreaterThan(120);
  }
  const album = await page.getByTestId('open-album').boundingBox();
  expect(album.y + album.height).toBeLessThanOrEqual(667);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('three enabled exercises: the third tile is centred below', async ({ page }) => {
  await seed(page, (p) => { fiveLetters(p); p.settings.exercises.syllables = false; });
  await page.goto('/');
  const tiles = page.locator('.menu .tile');
  await expect(tiles).toHaveCount(3);
  const [a, b, c] = await Promise.all([0, 1, 2].map((i) => tiles.nth(i).boundingBox()));
  expect(Math.abs(c.width - a.width)).toBeLessThan(2);
  expect(Math.abs((c.x + c.width / 2) - (a.x + b.x + b.width) / 2)).toBeLessThan(2);
});

test('the child name in the greeting is plain text and wraps', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await seed(page, (p) => { p.name = '<b>Mia</b>-Sophie Alexandra'; });
  await page.goto('/');
  const greet = page.getByTestId('greet');
  await expect(greet).toContainText('<b>Mia</b>-Sophie Alexandra');
  await expect(greet.locator('b')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('three enabled exercises on a 375 px phone: third tile as wide as the others', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await seed(page, (p) => { fiveLetters(p); p.settings.exercises.syllables = false; });
  await page.goto('/');
  const tiles = page.locator('.menu .tile');
  await expect(tiles).toHaveCount(3);
  const [a, , c] = await Promise.all([0, 1, 2].map((i) => tiles.nth(i).boundingBox()));
  expect(Math.abs(c.width - a.width)).toBeLessThanOrEqual(1);
});

test('menu tiles carry their names and fit them on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await seed(page);
  await page.goto('/');
  const names = { quantity: 'Mengenblitz', digits: 'Zahlenblitz', letters: 'Buchstabenblitz', syllables: 'Silbenblitz' };
  for (const [id, name] of Object.entries(names)) {
    const tile = page.getByTestId(`tile-${id}`);
    await expect(tile).toHaveAttribute('aria-label', name);
    const label = tile.locator('.tile-name');
    await expect(label).toHaveText(name);
    const [t, l] = [await tile.boundingBox(), await label.boundingBox()];
    expect(l.x).toBeGreaterThanOrEqual(t.x - 1);
    expect(l.x + l.width).toBeLessThanOrEqual(t.x + t.width + 1);
  }
});

test('menu: hidden heading, tile names 18–20 px at 390 px, AA contrast, distinct Zahlen/Buchstaben tiles', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Blitzblick – Übungen');
  const css = (loc, prop) => loc.evaluate((e, p) => getComputedStyle(e)[p], prop);
  const bg = {};
  for (const id of ['quantity', 'digits', 'letters', 'syllables']) {
    const tile = page.getByTestId(`tile-${id}`);
    const label = tile.locator('.tile-name');
    const size = parseFloat(await css(label, 'fontSize'));
    expect(size).toBeGreaterThanOrEqual(id === 'letters' ? 16.5 : 18); // Buchstabenblitz may shrink to fit
    expect(size).toBeLessThanOrEqual(20.5);
    bg[id] = await css(tile, 'backgroundColor');
    expect(contrast(await css(label, 'color'), bg[id])).toBeGreaterThanOrEqual(4.5);
  }
  const rgb = (s) => s.match(/\d+/g).slice(0, 3).map(Number);
  const diff = rgb(bg.digits).reduce((sum, v, i) => sum + Math.abs(v - rgb(bg.letters)[i]), 0);
  expect(diff).toBeGreaterThan(80);
});

test('the album button shows a mini sticker next to the count', async ({ page }) => {
  await seed(page, (p) => { p.rewards.stickers = ['animals/lion', 'sea/fish']; });
  await page.goto('/');
  const mini = page.getByTestId('open-album').locator('.mini-sticker');
  await expect(mini).toBeVisible();
  await expect(mini).toHaveAttribute('src', 'assets/stickers/sea/fish.webp');
  await expect(page.getByTestId('open-album')).toHaveText('2');
});
