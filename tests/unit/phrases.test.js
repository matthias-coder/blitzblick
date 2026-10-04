import test from 'node:test';
import assert from 'node:assert/strict';
import { createPicker, PRAISE } from '../../js/phrases.js';
import { mulberry32 } from '../../js/rng.js';

test('the picker never repeats the same variant twice in a row per key', () => {
  const pick = createPicker(mulberry32(1));
  const options = ['a', 'b', 'c'];
  let last = null;
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const v = pick('k', options);
    assert.notEqual(v, last);
    assert.ok(options.includes(v));
    seen.add(v);
    last = v;
  }
  assert.equal(seen.size, 3);
});

test('keys are independent and a single option is always returned', () => {
  const pick = createPicker(mulberry32(2));
  assert.equal(pick('one', ['x']), 'x');
  assert.equal(pick('one', ['x']), 'x');
  assert.ok(['a', 'b'].includes(pick('other', ['a', 'b'])));
});

test('praise has at least three variants per level', () => {
  for (const level of ['great', 'good', 'practiced']) assert.ok(PRAISE[level].length >= 3, level);
});
