import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChoices } from '../../js/exercises/choices.js';
import { mulberry32 } from '../../js/rng.js';

const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

test('returns count unique values including the answer', () => {
  const c = buildChoices(4, [], pool, 4, mulberry32(1));
  assert.equal(c.length, 4);
  assert.equal(new Set(c).size, 4);
  assert.ok(c.includes(4));
});

test('preferred distractors are used first', () => {
  const c = buildChoices(6, [9, 5], pool, 3, mulberry32(2));
  assert.deepEqual([...c].sort(), [5, 6, 9]);
});

test('preferred values outside the pool and the answer itself are ignored', () => {
  const c = buildChoices(6, [6, 42, -1, 9], pool, 2, mulberry32(3));
  assert.deepEqual([...c].sort(), [6, 9]);
});

test('a pool smaller than count yields the whole pool', () => {
  const c = buildChoices('A', [], ['A', 'B'], 4, mulberry32(4));
  assert.deepEqual([...c].sort(), ['A', 'B']);
});
