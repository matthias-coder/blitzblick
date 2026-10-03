import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, randInt, pick, shuffle } from '../../js/rng.js';

test('mulberry32 is deterministic per seed', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('mulberry32 returns values in [0, 1)', () => {
  const r = mulberry32(1);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1);
  }
});

test('randInt stays within inclusive bounds and reaches both ends', () => {
  const r = mulberry32(1);
  const seen = new Set();
  for (let i = 0; i < 1000; i++) {
    const v = randInt(r, 2, 5);
    assert.ok(v >= 2 && v <= 5);
    seen.add(v);
  }
  assert.deepEqual([...seen].sort(), [2, 3, 4, 5]);
});

test('shuffle returns a permutation and does not mutate the input', () => {
  const input = [1, 2, 3, 4, 5];
  const out = shuffle(mulberry32(3), input);
  assert.deepEqual(input, [1, 2, 3, 4, 5]);
  assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5]);
});

test('pick returns an element of the array', () => {
  const r = mulberry32(9);
  for (let i = 0; i < 50; i++) assert.ok(['a', 'b', 'c'].includes(pick(r, ['a', 'b', 'c'])));
});
