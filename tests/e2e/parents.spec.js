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

test('the level can be set per exercise and opens its sticker page', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  await expect(page.getByTestId('level-digits')).toHaveAttribute('data-value', '0');
  await page.getByTestId('level-digits-2').click();
  await expect(page.getByTestId('level-digits-label')).toHaveText('Level 3: Zahlen 0–9');
  const p = (await readState(page)).profiles[0];
  expect(p.levels.digits.level).toBe(2);
  expect(p.rewards.reached.digits).toBe(2);
  await page.getByTestId('close-parents').click();
  await page.getByTestId('open-album').click();
  await page.getByTestId('album-world-digits').click();
  await page.getByTestId('album-tab-space').click();
  await expect(page.getByTestId('locked-page')).toHaveCount(0);
});

test('switching the grade asks first, then restarts at level 1 with the grade timing', async ({ page }) => {
  await seed(page, (p) => { p.levels.letters.level = 3; p.rewards.stickers = ['animals/lion']; });
  await page.goto('/');
  await openParents(page);
  page.once('dialog', (d) => d.dismiss());
  await page.getByTestId('grade-g1').click();
  await expect(page.getByTestId('grade')).toHaveAttribute('data-value', 'pre');
  expect((await readState(page)).profiles[0].settings.grade).toBe('pre');
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('grade-g1').click();
  await expect(page.getByTestId('grade')).toHaveAttribute('data-value', 'g1');
  const p = (await readState(page)).profiles[0];
  expect(p.settings.grade).toBe('g1');
  expect(p.levels.letters.level).toBe(0);
  expect(p.settings.timing.startMs).toBe(1500);
  expect(p.rewards.stickers).toEqual(['animals/lion']);
  await expect(page.getByTestId('level-quantity-label')).toHaveText('Level 1: bis 10 mit Muster');
});

test('"Level festhalten" is saved per exercise', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('hold-letters').check();
  const s = (await readState(page)).profiles[0].settings;
  expect(s.hold).toEqual({ quantity: false, digits: false, letters: true, syllables: false });
});

test('an unplayable level is explained', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('level-syllables-2').click(); // open words: A, M, O only give Mama and Oma
  await expect(page.getByTestId('level-row-syllables')).toContainText('gespielt wird Level 2');
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
  expect(data.schemaVersion).toBe(2);
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
  await expect(page.getByTestId('welcome-start')).toBeVisible();
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

test('the lineature switch is saved', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page); // the settings tab is the default tab
  await expect(page.getByTestId('letters-lineature')).toBeChecked();
  await page.getByTestId('letters-lineature').uncheck();
  expect((await readState(page)).profiles[0].settings.letters.lineature).toBe(false);
});

test('parent controls are custom toggles and segments that fit a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await seed(page);
  await page.goto('/');
  await openParents(page);
  // the voice select may or may not render in headless Chromium, so it is excluded
  await expect(page.locator('.panel-body select:not([data-testid="voice"])')).toHaveCount(0);
  await expect(page.getByTestId('grade')).toHaveAttribute('role', 'radiogroup');
  await expect(page.getByTestId('level-quantity')).toHaveAttribute('role', 'radiogroup');
  await expect(page.getByTestId('ex-quantity')).toHaveAttribute('role', 'switch');
  await page.getByTestId('sounds').check();
  expect((await readState(page)).profiles[0].settings.sounds).toBe(true);
  expect(await page.evaluate(() => { const a = document.getElementById('app'); return a.scrollWidth <= a.clientWidth; })).toBe(true);
  for (const box of await page.locator('.seg').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right))) expect(box).toBeLessThanOrEqual(375);
  await page.getByTestId('tab-progress').click();
  await expect(page.getByTestId('stat-quantity')).toContainText(/Vorschule · Level 1 von 4: bis 3 mit Muster · Anzeigedauer [\d,]+ s/);
});

test('keyboard focus survives a settings change', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('timing-start').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await readState(page)).profiles[0].settings.timing.startMs).toBe(2050);
  await expect(page.getByTestId('timing-start')).toBeFocused();
  await page.getByTestId('speech-little').click();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await readState(page)).profiles[0].settings.speech).toBe('lots');
  await expect(page.getByTestId('speech-lots')).toBeFocused();
});

test('an enabled but currently hidden exercise gets an explanatory hint', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  await expect(page.getByTestId('ex-syllables-hidden')).toHaveCount(0);
  await page.getByTestId('letter-A').uncheck();
  await page.getByTestId('letter-B').check();
  await expect(page.getByTestId('ex-syllables')).toBeChecked();
  await expect(page.getByTestId('ex-syllables-hidden')).toBeVisible();
  await expect(page.getByTestId('ex-syllables-hidden')).toContainText('Im Menü gerade ausgeblendet');
  await expect(page.getByTestId('ex-quantity-hidden')).toHaveCount(0);
});

test('all levels mastered shows the medal and suggests the next grade', async ({ page }) => {
  await seed(page, (p) => { p.levels.letters = { ...p.levels.letters, level: 3, mastered: true }; });
  await page.goto('/');
  await openParents(page);
  const done = page.getByTestId('level-letters-done');
  await expect(done).toContainText('Alle Level geschafft – nächste Klassenstufe?');
  await expect(done.locator('img')).toHaveAttribute('src', 'assets/decor/medal.webp');
});

test('the gear also opens with a held Enter key, a short key press does not', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  const gear = page.getByTestId('gear');
  await gear.focus();
  await page.keyboard.down('Enter');
  await page.waitForTimeout(500);
  await page.keyboard.up('Enter');
  await expect(page.getByTestId('gate-question')).toHaveCount(0);
  await page.keyboard.down('Enter');
  await page.waitForTimeout(1800);
  await page.keyboard.up('Enter');
  await expect(page.getByTestId('gate-question')).toBeVisible();
});

test('parents can switch compare tasks off', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  const toggle = page.getByTestId('quantity-compare');
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await page.reload();
  await openParents(page);
  await expect(page.getByTestId('quantity-compare')).not.toBeChecked();
  const state = await readState(page);
  expect(state.profiles[0].settings.quantity.compare).toBe(false);
});

test('a new profile in the parent area gets age and grade; the age can be changed', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await openParents(page);
  await page.getByTestId('tab-profiles').click();
  await page.getByTestId('new-profile-name').fill('Ben');
  await page.getByTestId('new-profile-age').fill('6');
  await expect(page.getByTestId('new-profile-grade')).toHaveAttribute('data-value', 'g1');
  await page.getByTestId('add-profile').click();
  let s = await readState(page);
  const ben = s.profiles.find((p) => p.name === 'Ben');
  expect(ben.age).toBe(6);
  expect(ben.settings.grade).toBe('g1');
  await page.getByTestId(`age-${ben.id}`).fill('5');
  await page.getByTestId(`age-${ben.id}`).press('Tab');
  s = await readState(page);
  expect(s.profiles.find((p) => p.id === ben.id).age).toBe(5);
});
