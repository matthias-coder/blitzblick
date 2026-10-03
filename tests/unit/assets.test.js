import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { PAGES, stickerId, stickerUrl } from '../../js/rewards.js';
import { OBJECTS } from '../../js/exercises/quantity.js';
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

test('quantity objects exist', () => { for (const o of OBJECTS) checkSvg(`assets/objects/${o}.svg`); });
test('avatars exist as PNG', () => {
  for (const a of AVATARS) {
    const f = file(`assets/avatars/${a}.png`);
    assert.ok(existsSync(f), `${a}.png fehlt`);
    assert.equal(readFileSync(f).subarray(1, 4).toString(), 'PNG');
  }
});
test('ui icons exist', () => { for (const u of UI) checkSvg(`assets/ui/${u}.svg`); });
test('app icon exists', () => checkSvg('assets/icons/icon.svg'));
test('all 40 stickers exist', () => {
  for (const p of PAGES) for (const s of p.stickers) checkSvg(stickerUrl(stickerId(p.id, s)));
});
test('Andika fonts and license are bundled', () => {
  for (const f of ['andika-latin-400-normal.woff2', 'andika-latin-700-normal.woff2', 'OFL.txt']) {
    assert.ok(existsSync(file(`assets/fonts/${f}`)), f);
    assert.ok(statSync(file(`assets/fonts/${f}`)).size > 1000, `${f} leer`);
  }
});

const DECOR = ['star-big', 'badge-winner', 'bubble-yay', 'bubble-wow', 'confetti-1', 'confetti-2', 'confetti-3', 'confetti-4', 'confetti-5', 'confetti-6'];

function checkPng(path) {
  assert.ok(existsSync(file(path)), `${path} fehlt`);
  assert.equal(readFileSync(file(path)).subarray(1, 4).toString(), 'PNG', `${path}: kein PNG`);
}

test('decor sprites exist', () => { for (const d of DECOR) checkPng(`assets/decor/${d}.png`); });
test('mascot exists', () => checkPng('assets/mascot/robot-wave.png'));
test('raster assets stay small enough for offline caching', () => {
  const paths = [
    ...AVATARS.map((a) => `assets/avatars/${a}.png`),
    ...DECOR.map((d) => `assets/decor/${d}.png`),
    'assets/mascot/robot-wave.png',
  ];
  const total = paths.reduce((sum, p) => sum + statSync(file(p)).size, 0);
  assert.ok(total < 1_500_000, `Rastergrafiken zusammen ${total} Bytes (> 1,5 MB)`);
});
