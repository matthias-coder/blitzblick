import test from 'node:test';
import assert from 'node:assert/strict';
import { worldOf, pagesOf, bonusWorldVisible, lastPlayed, defaultPage, albumStart, WORLD_LABELS } from '../../js/album-nav.js';
import { pageById, SECRET_PAGE, BONUS_PAGES } from '../../js/rewards.js';
import { createProfile } from '../../js/profiles.js';

const profile = () => createProfile({ name: 'Mia', avatar: 'cat' }, { id: 'p1' });

test('pages belong to one world each', () => {
  assert.equal(worldOf(pageById('fruit')), 'quantity');
  assert.equal(worldOf(pageById('sea')), 'letters');
  assert.equal(worldOf(pageById('garden')), 'bonus');
  assert.equal(worldOf(SECRET_PAGE), 'secret');
  assert.deepEqual(pagesOf('digits').map((p) => p.id), ['toys', 'vehicles', 'space', 'blockworld']);
  assert.equal(pagesOf('bonus').length, 4);
  assert.deepEqual(pagesOf('secret'), [SECRET_PAGE]);
  assert.equal(WORLD_LABELS.syllables, 'Silben');
});

test('the bonus world shows up once a bonus page is visible', () => {
  const p = profile();
  assert.equal(bonusWorldVisible(p.rewards), false);
  assert.equal(bonusWorldVisible({ ...p.rewards, stickers: ['garden/bee'] }), true);
  const full = pagesOf('quantity').flatMap((pg) => pg.stickers.map((s) => `${pg.id}/${s}`));
  assert.equal(bonusWorldVisible({ ...p.rewards, stickers: full }), true);
});

test('the album opens on the last played exercise at its current level', () => {
  const p = profile();
  assert.equal(lastPlayed([]), 'quantity');
  assert.equal(lastPlayed([{ exercise: 'nope' }]), 'quantity');
  assert.deepEqual(albumStart(p), { world: 'quantity', pageId: 'fruit' });
  const played = { ...p, history: [{ exercise: 'digits' }, { exercise: 'letters' }], levels: { ...p.levels, letters: { ...p.levels.letters, level: 2 } } };
  assert.deepEqual(albumStart(played), { world: 'letters', pageId: 'dinos' });
});

test('an asked-for page or highlighted sticker wins', () => {
  const p = profile();
  assert.deepEqual(albumStart(p, { page: 'garden' }), { world: 'bonus', pageId: 'garden' });
  assert.deepEqual(albumStart(p, { highlight: 'mischief/toast' }), { world: 'secret', pageId: 'mischief' });
  assert.deepEqual(albumStart(p, { highlight: 'sea/fish' }), { world: 'letters', pageId: 'sea' });
  assert.deepEqual(albumStart(p, { page: 'nope' }), { world: 'quantity', pageId: 'fruit' });
});

test('defaultPage per world', () => {
  const p = profile();
  assert.equal(defaultPage(p, 'syllables').id, 'room');
  assert.equal(defaultPage(p, 'bonus').id, BONUS_PAGES[0].id);
  assert.equal(defaultPage({ ...p, rewards: { ...p.rewards, stickers: ['bugs/ladybug'] } }, 'bonus').id, 'bugs');
  assert.equal(defaultPage(p, 'secret'), SECRET_PAGE);
});
