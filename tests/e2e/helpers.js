import { expect } from '@playwright/test';
import { createProfile } from '../../js/profiles.js';
import { SCHEMA_VERSION } from '../../js/storage.js';

export function buildState(mutate = () => {}, name = 'Mia') {
  const p = createProfile({ name, avatar: 'astronaut' }, { id: 'p1' });
  p.settings.speech = 'off';
  p.settings.sounds = false;
  mutate(p);
  return { schemaVersion: SCHEMA_VERSION, activeProfileId: 'p1', profiles: [p] };
}

export async function seed(page, mutate) {
  const state = buildState(mutate);
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('blitzblick.v1', JSON.stringify(s));
      sessionStorage.setItem('seeded', '1');
    }
  }, state);
  return state;
}

export async function readState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('blitzblick.v1')));
}

export async function longPress(page, locator, ms = 1800) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

export async function openParents(page) {
  await longPress(page, page.getByTestId('gear'));
  const answer = await page.getByTestId('gate-question').getAttribute('data-answer');
  await page.getByTestId('gate-answer').fill(answer);
  await page.getByTestId('gate-submit').click();
  await expect(page.getByTestId('parents')).toBeVisible();
}

export async function setRange(locator, value) {
  await locator.evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}
