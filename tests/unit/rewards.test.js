import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGES, STICKER_MIN_CORRECT, unlockedPagesFor, applyRoundRewards, missingStickers, stickerUrl } from '../../js/rewards.js';
import { mulberry32 } from '../../js/rng.js';

const fresh = () => ({ stars: 0, stickers: [], unlockedPages: 1 });

test('ten pages with eight unique stickers each', () => {
  assert.equal(PAGES.length, 10);
  for (const p of PAGES) assert.equal(new Set(p.stickers).size, 8);
});

test('a page unlocks every 50 stars, capped at the page count', () => {
  assert.equal(unlockedPagesFor(0), 1);
  assert.equal(unlockedPagesFor(49), 1);
  assert.equal(unlockedPagesFor(50), 2);
  assert.equal(unlockedPagesFor(10_000), 10);
});

test('a round adds one star per correct answer and one new sticker from 8 correct', () => {
  assert.equal(STICKER_MIN_CORRECT, 8);
  const r = applyRoundRewards(fresh(), 8, mulberry32(1));
  assert.equal(r.rewards.stars, 8);
  assert.equal(r.rewards.stickers.length, 1);
  assert.ok(r.sticker.startsWith('animals/'));
  assert.equal(r.bonusStars, 0);
  assert.equal(r.earned, true);
});

test('below 8 correct there are only stars, no sticker and no bonus', () => {
  const r = applyRoundRewards(fresh(), 7, mulberry32(2));
  assert.equal(r.rewards.stars, 7);
  assert.deepEqual(r.rewards.stickers, []);
  assert.equal(r.sticker, null);
  assert.equal(r.bonusStars, 0);
  assert.equal(r.earned, false);
  const all = PAGES[0].stickers.map((s) => `animals/${s}`);
  const full = applyRoundRewards({ stars: 0, stickers: all, unlockedPages: 1 }, 0, mulberry32(2));
  assert.equal(full.bonusStars, 0);
  assert.equal(full.rewards.stars, 0);
});

test('no duplicates until the unlocked pages are complete, then bonus stars', () => {
  const rng = mulberry32(3);
  let rewards = fresh();
  for (let i = 0; i < 8; i++) rewards = { ...applyRoundRewards(rewards, 8, rng).rewards, stars: 0 };
  assert.equal(new Set(rewards.stickers).size, 8);
  assert.deepEqual(missingStickers(rewards), []);
  const r = applyRoundRewards({ ...rewards, stars: 0 }, 8, rng);
  assert.equal(r.sticker, null);
  assert.equal(r.bonusStars, 3);
  assert.equal(r.rewards.stars, 11);
});

test('reaching 50 stars unlocks the second page', () => {
  const r = applyRoundRewards({ stars: 45, stickers: [], unlockedPages: 1 }, 5, mulberry32(4));
  assert.equal(r.rewards.unlockedPages, 2);
  assert.deepEqual(r.newlyUnlockedPages, ['vehicles']);
});

test('bonus stars can unlock a page', () => {
  const all = PAGES[0].stickers.map((s) => `animals/${s}`);
  const r = applyRoundRewards({ stars: 39, stickers: all, unlockedPages: 1 }, 8, mulberry32(5));
  assert.equal(r.rewards.stars, 50);
  assert.deepEqual(r.newlyUnlockedPages, ['vehicles']);
});

test('input rewards are not mutated', () => {
  const before = fresh();
  applyRoundRewards(before, 5, mulberry32(6));
  assert.deepEqual(before, fresh());
});

test('stickerUrl', () => {
  assert.equal(stickerUrl('sea/fish'), 'assets/stickers/sea/fish.svg');
  assert.equal(stickerUrl('toys/teddy'), 'assets/stickers/toys/teddy.png');
});
