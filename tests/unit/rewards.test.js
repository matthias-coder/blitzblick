import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGES, unlockedPagesFor, applyRoundRewards, missingStickers, stickerUrl } from '../../js/rewards.js';
import { mulberry32 } from '../../js/rng.js';

const fresh = () => ({ stars: 0, stickers: [], unlockedPages: 1 });

test('five pages with eight unique stickers each', () => {
  assert.equal(PAGES.length, 5);
  for (const p of PAGES) assert.equal(new Set(p.stickers).size, 8);
});

test('a page unlocks every 50 stars, capped at the page count', () => {
  assert.equal(unlockedPagesFor(0), 1);
  assert.equal(unlockedPagesFor(49), 1);
  assert.equal(unlockedPagesFor(50), 2);
  assert.equal(unlockedPagesFor(10_000), 5);
});

test('a round adds one star per correct answer and one new sticker', () => {
  const r = applyRoundRewards(fresh(), 7, mulberry32(1));
  assert.equal(r.rewards.stars, 7);
  assert.equal(r.rewards.stickers.length, 1);
  assert.ok(r.sticker.startsWith('animals/'));
  assert.equal(r.bonusStars, 0);
});

test('a round with zero correct answers still gives a sticker', () => {
  assert.ok(applyRoundRewards(fresh(), 0, mulberry32(2)).sticker);
});

test('no duplicates until the unlocked pages are complete, then bonus stars', () => {
  const rng = mulberry32(3);
  let rewards = fresh();
  for (let i = 0; i < 8; i++) rewards = applyRoundRewards(rewards, 0, rng).rewards;
  assert.equal(new Set(rewards.stickers).size, 8);
  assert.deepEqual(missingStickers(rewards), []);
  const r = applyRoundRewards(rewards, 0, rng);
  assert.equal(r.sticker, null);
  assert.equal(r.bonusStars, 3);
  assert.equal(r.rewards.stars, 3);
});

test('reaching 50 stars unlocks the second page', () => {
  const r = applyRoundRewards({ stars: 45, stickers: [], unlockedPages: 1 }, 5, mulberry32(4));
  assert.equal(r.rewards.unlockedPages, 2);
  assert.deepEqual(r.newlyUnlockedPages, ['vehicles']);
});

test('bonus stars can unlock a page', () => {
  const all = PAGES[0].stickers.map((s) => `animals/${s}`);
  const r = applyRoundRewards({ stars: 48, stickers: all, unlockedPages: 1 }, 0, mulberry32(5));
  assert.equal(r.rewards.stars, 51);
  assert.deepEqual(r.newlyUnlockedPages, ['vehicles']);
});

test('input rewards are not mutated', () => {
  const before = fresh();
  applyRoundRewards(before, 5, mulberry32(6));
  assert.deepEqual(before, fresh());
});

test('stickerUrl', () => {
  assert.equal(stickerUrl('sea/fish'), 'assets/stickers/sea/fish.svg');
});
