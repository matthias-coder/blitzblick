import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { PAGES, stickerId, stickerUrl } from '../../js/rewards.js';
import { OBJECTS, objectUrl } from '../../js/exercises/quantity.js';
import { AVATARS } from '../../js/profiles.js';

const UI = ['gear', 'back', 'album', 'again', 'check', 'lock', 'star'];
const file = (p) => new URL(`../../${p}`, import.meta.url);

function checkSvg(path) {
  assert.ok(existsSync(file(path)), `${path} fehlt`);
  const s = readFileSync(file(path), 'utf8').trim();
  assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 100 100">/, `${path}: Root-Element`);
  assert.match(s, /<\/svg>$/, `${path}: Ende`);
  assert.doesNotMatch(s, /<(text|image|script|filter|linearGradient|radialGradient)\b/, `${path}: verbotenes Element`);
  assert.doesNotMatch(s, /<svg[^>]*\s(width|height)=/, `${path}: width/height`);
  assert.ok(s.length < 6000, `${path}: zu groß (${s.length})`);
}

test('quantity objects exist as WebP', () => { for (const o of OBJECTS) checkWebp(objectUrl(o)); });
test('avatars exist as WebP', () => { for (const a of AVATARS) checkWebp(`assets/avatars/${a}.webp`); });
test('ui icons exist', () => { for (const u of UI) checkSvg(`assets/ui/${u}.svg`); });
test('app icon exists', () => checkSvg('assets/icons/icon.svg'));
test('all stickers exist as WebP', () => {
  for (const p of PAGES) for (const s of p.stickers) checkWebp(stickerUrl(stickerId(p.id, s)));
});
test('Andika, Grundschrift and license are bundled', () => {
  for (const f of ['andika-latin-400-normal.woff2', 'andika-latin-700-normal.woff2', 'playwrite-de-grund-latin-400-normal.woff2', 'OFL.txt']) {
    assert.ok(existsSync(file(`assets/fonts/${f}`)), f);
    assert.ok(statSync(file(`assets/fonts/${f}`)).size > 1000, `${f} leer`);
  }
});

const MASCOT = ['robot-wave', 'robot-cheer', 'robot-trophy'];
const MENU = ['quantity', 'digits', 'letters', 'syllables'];
const DECOR = ['star-big', 'badge-winner', 'bubble-yay', 'bubble-wow', 'confetti-1', 'confetti-2', 'confetti-3', 'confetti-4', 'confetti-5', 'confetti-6', 'medal'];

function checkWebp(path) {
  assert.ok(existsSync(file(path)), `${path} fehlt`);
  const b = readFileSync(file(path));
  assert.equal(b.subarray(0, 4).toString() + b.subarray(8, 12).toString(), 'RIFFWEBP', `${path}: kein WebP`);
}

test('decor sprites exist', () => { for (const d of DECOR) checkWebp(`assets/decor/${d}.webp`); });
test('menu tile sprites exist', () => { for (const m of MENU) checkWebp(`assets/menu/${m}.webp`); });
test('mascot sprites exist', () => { for (const m of MASCOT) checkWebp(`assets/mascot/${m}.webp`); });
test('raster assets stay small enough for offline caching', () => {
  const paths = [
    ...AVATARS.map((a) => `assets/avatars/${a}.webp`),
    ...DECOR.map((d) => `assets/decor/${d}.webp`),
    ...MASCOT.map((m) => `assets/mascot/${m}.webp`),
    ...MENU.map((m) => `assets/menu/${m}.webp`),
    ...OBJECTS.map(objectUrl),
    ...PAGES.flatMap((p) => p.stickers.map((s) => stickerUrl(stickerId(p.id, s)))),
  ];
  const total = paths.reduce((sum, p) => sum + statSync(file(p)).size, 0);
  assert.ok(total < 3_000_000, `Rastergrafiken zusammen ${total} Bytes (> 3 MB)`);
});
