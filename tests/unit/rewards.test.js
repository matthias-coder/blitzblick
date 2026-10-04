import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGES, SECRET_PAGE, STICKER_MIN_CORRECT, applyRoundRewards, isPageOpen, isPageVisible, stickerUrl, stickerId } from '../../js/rewards.js';
import { EXERCISE_ORDER } from '../../js/exercises/index.js';
import { LEVEL_COUNT } from '../../js/levels.js';
import { mulberry32 } from '../../js/rng.js';

const none = () => ({ quantity: 0, digits: 0, letters: 0, syllables: 0 });
const fresh = () => ({ stars: 0, stickers: [], reached: none() });
const ids = (pageId) => PAGES.find((p) => p.id === pageId).stickers.map((s) => stickerId(pageId, s));
const play = (rewards, correct, seed, exercise = 'quantity', level = 0, reached = rewards.reached) =>
  applyRoundRewards(rewards, correct, mulberry32(seed), { exercise, level, reached });

test('sixteen pages with unique stickers, eight each except the seven-sticker block world', () => {
  assert.equal(PAGES.length, 16);
  for (const p of PAGES) assert.equal(new Set(p.stickers).size, p.id === 'blockworld' ? 7 : 8);
});

test('exactly one page per exercise and level, grouped in menu order', () => {
  const keys = PAGES.map((p) => `${p.exercise}/${p.level}`);
  assert.deepEqual(keys, EXERCISE_ORDER.flatMap((ex) => Array.from({ length: LEVEL_COUNT }, (_, l) => `${ex}/${l}`)));
});

test('pages open with the level reached; pages with collected stickers stay visible', () => {
  const fruit = PAGES.find((p) => p.id === 'fruit');
  const food = PAGES.find((p) => p.id === 'food');
  assert.equal(isPageOpen(none(), fruit), true);
  assert.equal(isPageOpen(none(), food), false);
  assert.equal(isPageOpen({ ...none(), quantity: 3 }, food), true);
  assert.equal(isPageVisible({ ...fresh(), stickers: ['food/pizza'] }, food), true);
  assert.equal(isPageVisible(fresh(), food), false);
});

test('a round adds one star per correct answer and a sticker from 4 correct, from the page just played', () => {
  assert.equal(STICKER_MIN_CORRECT, 4);
  const reached = { ...none(), letters: 2 };
  const r = play({ ...fresh(), reached }, 4, 1, 'letters', 1);
  assert.equal(r.rewards.stars, 4);
  assert.equal(r.rewards.stickers.length, 1);
  assert.ok(r.sticker.startsWith('sea/'));
  assert.equal(r.bonusStars, 0);
  assert.equal(r.earned, true);
});

test('below 4 correct there are only stars, no sticker and no bonus', () => {
  const r = play(fresh(), 3, 2);
  assert.equal(r.rewards.stars, 3);
  assert.deepEqual(r.rewards.stickers, []);
  assert.equal(r.sticker, null);
  assert.equal(r.bonusStars, 0);
  assert.equal(r.earned, false);
});

test('full page: another open page of the same exercise, then any open page, then bonus stars', () => {
  const reached = { ...none(), quantity: 1 };
  let rewards = { ...fresh(), reached, stickers: ids('fruit') };
  let r = play(rewards, 5, 3, 'quantity', 0);
  assert.ok(r.sticker.startsWith('veggies/'));
  rewards = { ...rewards, stickers: [...ids('fruit'), ...ids('veggies')] };
  r = play(rewards, 5, 3, 'quantity', 0);
  assert.equal(r.sticker.split('/')[0] !== 'fruit' && r.sticker.split('/')[0] !== 'veggies', true);
  assert.ok(isPageOpen(reached, PAGES.find((p) => r.sticker.startsWith(`${p.id}/`))));
  const allOpen = PAGES.filter((p) => isPageOpen(reached, p)).flatMap((p) => ids(p.id));
  r = play({ ...rewards, stickers: allOpen }, 5, 3, 'quantity', 0);
  assert.equal(r.sticker, null);
  assert.equal(r.bonusStars, 3);
  assert.equal(r.rewards.stars, 8);
});

test('no duplicates until the page is complete', () => {
  let rewards = fresh();
  for (let i = 0; i < 8; i++) rewards = play(rewards, 5, 10 + i).rewards;
  assert.deepEqual([...rewards.stickers].sort(), [...ids('fruit')].sort());
});

test('a level-up opens the next page and reports it', () => {
  const r = play(fresh(), 5, 4, 'digits', 0, { ...none(), digits: 1 });
  assert.deepEqual(r.newlyUnlockedPages, ['vehicles']);
  assert.equal(r.rewards.reached.digits, 1);
  assert.ok(r.sticker.startsWith('toys/'));
});

test('input rewards are not mutated', () => {
  const before = fresh();
  play(before, 5, 6);
  assert.deepEqual(before, fresh());
});

test('stickerUrl', () => {
  assert.equal(stickerUrl('sea/fish'), 'assets/stickers/sea/fish.webp');
});

const secretIds = SECRET_PAGE.stickers.map((s) => stickerId(SECRET_PAGE.id, s));
const playOn = (rewards, correct, today, seed = 1) =>
  applyRoundRewards(rewards, correct, mulberry32(seed), { exercise: 'quantity', level: 0, reached: rewards.reached, today });

test('the secret page is separate from the level pages and has eight stickers', () => {
  assert.equal(SECRET_PAGE.stickers.length, 8);
  assert.ok(!PAGES.some((p) => p.id === SECRET_PAGE.id));
});

test('a round with no correct answer gives one secret sticker per day', () => {
  const r = playOn(fresh(), 0, '2026-10-05');
  assert.equal(r.secret, true);
  assert.ok(secretIds.includes(r.sticker));
  assert.deepEqual(r.rewards.stickers, [r.sticker]);
  assert.equal(r.rewards.secretDay, '2026-10-05');
  assert.equal(r.rewards.stars, 0);
  assert.equal(r.earned, false);
  const again = playOn(r.rewards, 0, '2026-10-05', 2);
  assert.equal(again.secret, false);
  assert.equal(again.sticker, null);
  assert.deepEqual(again.rewards.stickers, r.rewards.stickers);
  const next = playOn(r.rewards, 0, '2026-10-06', 3);
  assert.equal(next.secret, true);
  assert.notEqual(next.sticker, r.sticker);
});

test('no secret sticker with any correct answer, without a date or on a full page', () => {
  for (const c of [1, 2, 3]) assert.equal(playOn(fresh(), c, '2026-10-05').secret, false);
  assert.equal(play(fresh(), 0, 1).secret, false);
  const full = playOn({ ...fresh(), stickers: [...secretIds] }, 0, '2026-10-05');
  assert.equal(full.secret, false);
  assert.equal(full.sticker, null);
  assert.equal(full.rewards.secretDay, undefined);
});
