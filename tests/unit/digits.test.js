import test from 'node:test';
import assert from 'node:assert/strict';
import * as digits from '../../js/exercises/digits.js';
import { mulberry32 } from '../../js/rng.js';

const S = (range = 20) => ({ digits: { range } });
const task = (complexity, seed, range = 20) =>
  digits.createTask({ complexity }, S(range), mulberry32(seed));

test('stages are limited by the configured range', () => {
  assert.deepEqual(digits.stages(S(9)), [5, 9]);
  assert.deepEqual(digits.stages(S(10)), [5, 9, 10]);
  assert.deepEqual(digits.stages(S(20)), [5, 9, 10, 20]);
  assert.equal(digits.maxComplexity(S(10)), 2);
  assert.equal(digits.startComplexity(S(10)), 0);
});

test('answer lies in the stage range and is among 4 unique in-range choices', () => {
  const his = [5, 9, 10, 20];
  for (let c = 0; c < 4; c++) {
    for (let seed = 0; seed < 200; seed++) {
      const t = task(c, seed);
      assert.ok(t.answer >= 0 && t.answer <= his[c]);
      assert.equal(t.choices.length, 4);
      assert.equal(new Set(t.choices).size, 4);
      assert.ok(t.choices.includes(t.answer));
      assert.ok(t.choices.every((v) => v >= 0 && v <= his[c]));
      assert.equal(t.stimulus.text, String(t.answer));
      assert.equal(t.exercise, 'digits');
    }
  }
});

test('complexity above the range is capped', () => {
  for (let seed = 0; seed < 100; seed++) assert.ok(task(3, seed, 9).answer <= 9);
});

test('confusable digits are preferred: 6 comes with 9', () => {
  let seen = 0;
  for (let seed = 0; seed < 500 && seen < 5; seed++) {
    const t = task(1, seed);
    if (t.answer === 6) { assert.ok(t.choices.includes(9)); seen++; }
  }
  assert.ok(seen > 0);
});

test('reversed numbers outside the range are never offered', () => {
  for (let seed = 0; seed < 2000; seed++) {
    const t = task(3, seed);
    assert.ok(t.choices.every((v) => v <= 20));
  }
});

test('the reversed number is preferred when it stays in range (20 → 2)', () => {
  for (let seed = 0; seed < 3000; seed++) {
    const t = task(3, seed);
    if (t.answer === 20) { assert.ok(t.choices.includes(2)); return; }
  }
  assert.fail('no task with answer 20 found');
});

test('prompt and solution texts', () => {
  const t = task(0, 1);
  assert.equal(digits.speakPrompt(t, S()), 'Welche Zahl war das?');
  assert.equal(digits.speakSolution(t, S())[0], `Das war die ${t.answer}.`);
  for (const v of digits.speakSolution(t, S())) assert.ok(v.includes(String(t.answer)));
});
