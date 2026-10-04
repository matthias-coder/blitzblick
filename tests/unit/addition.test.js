import test from 'node:test';
import assert from 'node:assert/strict';
import { ADD_SUMS, ADD_DURATION_FACTOR, addends, addStages, addLabel } from '../../js/exercises/addition.js';
import { mulberry32 } from '../../js/rng.js';

test('addends are at least 1 and sum to at most the stage sum', () => {
  const rng = mulberry32(7);
  for (const sum of ADD_SUMS) for (let i = 0; i < 500; i++) {
    const { a, b } = addends(rng, sum);
    assert.ok(a >= 1 && b >= 1 && a + b <= sum, `${a}+${b} for ${sum}`);
  }
});

test('addends reach the stage sum', () => {
  const rng = mulberry32(1);
  const sums = new Set(Array.from({ length: 500 }, () => { const { a, b } = addends(rng, 10); return a + b; }));
  assert.ok(sums.has(10) && sums.has(2));
});

test('addStages respects the switch and the max sum', () => {
  assert.deepEqual(addStages(false), []);
  assert.deepEqual(addStages(true), [{ add: true, sum: 5 }, { add: true, sum: 10 }]);
  assert.deepEqual(addStages(true, 8), [{ add: true, sum: 5 }]);
  assert.deepEqual(addStages(true, 4), []);
  assert.equal(addLabel(10), 'Plus bis 10');
  assert.equal(ADD_DURATION_FACTOR, 2.5);
});
