import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { seed, readState, longPress, openParents, buildState, setRange } from './helpers.js';

test('a short press does not open the parent area, 1.5 s does, a wrong answer returns to the menu', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await longPress(page, page.getByTestId('gear'), 1000);
  await expect(page.getByTestId('tile-quantity')).toBeVisible();
  await longPress(page, page.getByTestId('gear'), 1600);
  await expect(page.getByTestId('gate-answer')).toBeVisible();
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
  await page.getByTestId('qty-max-5').click();
  const p = (await readState(page)).profiles[0];
  expect(p.settings.quantity.max).toBe(5);
  expect(p.levels.quantity.complexity).toBe(6); // 6 regular stages up to 5 + "Plus bis 5"
});

test('timing sliders are saved and shown in seconds', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  const start = page.getByTestId('timing-start');
  await expect(start).toHaveAttribute('type', 'range');
  await setRange(start, 1000);
  await expect.poll(async () => (await readState(page)).profiles[0].settings.timing.startMs).toBe(1000);
  await expect(page.getByTestId('timing-start-label')).toHaveText('1 s');
  await setRange(page.getByTestId('timing-min'), 450);
  await expect(page.getByTestId('timing-min-label')).toHaveText('0,45 s');
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

test('at least two known letters and one exercise stay enabled', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('letter-A').uncheck();
  await expect(page.getByTestId('letter-M')).toBeDisabled();
  await expect(page.getByTestId('letter-O')).toBeDisabled();
  await expect(page.getByTestId('letter-B')).toBeEnabled();
  await page.getByTestId('letter-B').check();
  await expect(page.getByTestId('letter-M')).toBeEnabled();
  await page.getByTestId('ex-quantity').uncheck();
  await page.getByTestId('ex-digits').uncheck();
  // with M, O, B the syllables exercise is not playable, so letters is the last playable one
  await expect(page.getByTestId('ex-letters')).toBeDisabled();
  const s = (await readState(page)).profiles[0].settings;
  expect(s.letters.known.length).toBe(3);
  expect(Object.values(s.exercises).filter(Boolean)).toHaveLength(2);
});

test('the speech mode can be chosen and is saved', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  await expect(page.getByTestId('speech')).toHaveAttribute('data-value', 'off');
  await page.getByTestId('speech-lots').click();
  expect((await readState(page)).profiles[0].settings.speech).toBe('lots');
});

test('custom words can be added, are validated and can be removed', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  await expect(page.getByTestId('syllables-playable')).toContainText('4 Silben, 2 Wörter');
  await page.getByTestId('syllables-custom-input').fill('Lo|la');
  await page.getByTestId('syllables-custom-add').click();
  await expect(page.getByTestId('syllables-custom-0')).toContainText('fehlt: L');
  expect((await readState(page)).profiles[0].settings.syllables.custom).toEqual([{ text: 'Lola', split: 'Lo|la' }]);

  await page.getByTestId('syllables-custom-input').fill('Max1');
  await page.getByTestId('syllables-custom-add').click();
  await expect(page.getByTestId('syllables-custom-msg')).toContainText('Nur Buchstaben');
  await page.getByTestId('syllables-custom-input').fill('lola');
  await page.getByTestId('syllables-custom-add').click();
  await expect(page.getByTestId('syllables-custom-msg')).toContainText('schon in der Liste');
  expect((await readState(page)).profiles[0].settings.syllables.custom).toHaveLength(1);

  await page.getByTestId('syllables-custom-0-remove').click();
  await expect(page.getByTestId('syllables-custom-0')).toHaveCount(0);
  expect((await readState(page)).profiles[0].settings.syllables.custom).toEqual([]);
});

test('the syllable color switch is saved and survives a reload', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('syllables-colors').uncheck();
  expect((await readState(page)).profiles[0].settings.syllables.colors).toBe(false);
  await page.reload();
  expect((await readState(page)).profiles[0].settings.syllables.colors).toBe(false);
});

test('addition can be switched off per exercise', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page); // the settings tab is the default tab
  await page.getByTestId('qty-addition').uncheck();
  await page.getByTestId('digits-addition').uncheck();
  const s = (await readState(page)).profiles[0].settings;
  expect(s.quantity.addition).toBe(false);
  expect(s.digits.addition).toBe(false);
});

test('parent controls are custom toggles and segments that fit a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await seed(page);
  await page.goto('/');
  await openParents(page);
  // the voice select may or may not render in headless Chromium, so it is excluded
  await expect(page.locator('.panel-body select:not([data-testid="voice"])')).toHaveCount(0);
  await expect(page.getByTestId('qty-max')).toHaveAttribute('role', 'radiogroup');
  await expect(page.getByTestId('ex-quantity')).toHaveAttribute('role', 'switch');
  await page.getByTestId('sounds').check();
  expect((await readState(page)).profiles[0].settings.sounds).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.getByTestId('tab-progress').click();
  await expect(page.getByTestId('stat-quantity')).toContainText(/Anzeigedauer [\d,]+ s/);
});
