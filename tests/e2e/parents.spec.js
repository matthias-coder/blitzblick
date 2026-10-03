import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { seed, readState, longPress, openParents, buildState } from './helpers.js';

test('a short press does not open the parent area, a wrong answer returns to the menu', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await longPress(page, page.getByTestId('gear'), 800);
  await expect(page.getByTestId('tile-quantity')).toBeVisible();
  await longPress(page, page.getByTestId('gear'));
  await page.getByTestId('gate-answer').fill('1');
  await page.getByTestId('gate-submit').click();
  await expect(page.getByTestId('tile-quantity')).toBeVisible();
});

test('known letters can be changed and are saved', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('letter-B').check();
  await page.getByTestId('letter-A').uncheck();
  const known = (await readState(page)).profiles[0].settings.letters.known;
  expect(known.sort()).toEqual(['B', 'M', 'O']);
});

test('lowering the quantity maximum clamps the level', async ({ page }) => {
  await seed(page, (p) => { p.levels.quantity.complexity = 11; });
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('qty-max').selectOption('5');
  const p = (await readState(page)).profiles[0];
  expect(p.settings.quantity.max).toBe(5);
  expect(p.levels.quantity.complexity).toBe(5);
});

test('timing inputs are saved', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('timing-start').fill('1000');
  await page.getByTestId('timing-start').press('Enter');
  await expect.poll(async () => (await readState(page)).profiles[0].settings.timing.startMs).toBe(1000);
});

test('progress tab shows a card per exercise', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('tab-progress').click();
  for (const id of ['quantity', 'digits', 'letters']) await expect(page.getByTestId(`stat-${id}`)).toBeVisible();
});

test('export downloads a valid backup', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('tab-data').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export').click()]);
  expect(download.suggestedFilename()).toMatch(/^blitzblick-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(data.schemaVersion).toBe(1);
  expect(data.profiles[0].name).toBe('Mia');
});

test('import replaces the state after confirmation; invalid files are rejected', async ({ page }) => {
  await seed(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('tab-data').click();
  await page.getByTestId('import-file').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('nope') });
  await expect(page.getByTestId('import-message')).toContainText('keine gültige');
  expect((await readState(page)).profiles[0].name).toBe('Mia');
  const backup = JSON.stringify(buildState(() => {}, 'Ben'));
  await page.getByTestId('import-file').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await expect(page.getByTestId('import-message')).toContainText('eingespielt');
  expect((await readState(page)).profiles[0].name).toBe('Ben');
});

test('profiles can be added, renamed and deleted; deleting the last shows the create screen', async ({ page }) => {
  await seed(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('tab-profiles').click();
  await page.getByTestId('new-profile-name').fill('Ben');
  await page.getByTestId('add-profile').click();
  expect((await readState(page)).profiles.map((p) => p.name)).toEqual(['Mia', 'Ben']);
  await page.getByTestId('rename-p1').fill('Mia-Sophie');
  await page.getByTestId('rename-p1').press('Enter');
  await expect.poll(async () => (await readState(page)).profiles[0].name).toBe('Mia-Sophie');
  const benId = (await readState(page)).profiles[1].id;
  await page.getByTestId('delete-p1').click();
  await page.getByTestId(`delete-${benId}`).click();
  expect((await readState(page)).profiles).toHaveLength(0);
  await page.getByTestId('close-parents').click();
  await expect(page.getByTestId('create-profile')).toBeVisible();
});
