import test from 'node:test';
import assert from 'node:assert/strict';
import { STICKER_NAMES, stickerName } from '../../js/sticker-names.js';
import { ALL_PAGES, SECRET_PAGE, stickerId } from '../../js/rewards.js';

const ids = [...ALL_PAGES, SECRET_PAGE].flatMap((p) => p.stickers.map((s) => stickerId(p.id, s)));

test('every sticker has a German name', () => {
  for (const id of ids) assert.ok(stickerName(id).trim().length > 0, id);
  assert.equal(stickerName('animals/lion'), 'Löwe');
  assert.equal(stickerName('mischief/toaster'), 'Toaster');
});

test('the name table has no unused entries', () => {
  const used = new Set(ids.map((id) => id.split('/')[1]));
  for (const key of Object.keys(STICKER_NAMES)) assert.ok(used.has(key), key);
});
