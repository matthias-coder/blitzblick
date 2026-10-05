import { expect } from '@playwright/test';
import { createProfile } from '../../js/profiles.js';
import { SCHEMA_VERSION } from '../../js/storage.js';

export function buildState(mutate = () => {}, name = 'Mia') {
  const p = createProfile({ name, avatar: 'astronaut' }, { id: 'p1' });
  p.settings.speech = 'off';
  p.settings.sounds = false;
  p.intro = { quantity: true, digits: true, letters: true, syllables: true }; // the first-start demo is tested on its own
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

// WCAG contrast of two computed colours ("rgb(r, g, b)"; alpha is ignored, use it on opaque colours only)
const channel = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = (s) => { const [r, g, b] = s.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
