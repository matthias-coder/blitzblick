import test from 'node:test';
import assert from 'node:assert/strict';
import * as digits from '../../js/exercises/digits.js';
import { mulberry32 } from '../../js/rng.js';

const S = { digits: {} };
const step = (grade, level, i = 0) => digits.LADDERS[grade][level].steps[i];
const task = (st, seed) => digits.createTask(st, S, mulberry32(seed));

test('ladders: Vorschule climbs from 1–3 to 0–10, Klasse 1 from 0–10 to Plus and Minus', () => {
  assert.deepEqual(digits.LADDERS.pre.map((l) => l.label), ['Zahlen 1–3', 'Zahlen 1–5', 'Zahlen 0–9', 'Zahlen 0–10']);
  assert.deepEqual(digits.LADDERS.g1.map((l) => l.label), ['Zahlen 0–10', 'Zahlen 0–20', 'Plus bis 10', 'Plus und Minus bis 10']);
});

test('answer lies in the step range and is among up to 4 unique in-range choices', () => {
  for (const grade of ['pre', 'g1']) {
    for (const level of digits.LADDERS[grade]) {
      for (const st of level.steps.filter((x) => x.hi !== undefined)) {
        for (let seed = 0; seed < 200; seed++) {
          const t = task(st, seed);
          assert.ok(t.answer >= st.lo && t.answer <= st.hi);
          assert.equal(t.choices.length, Math.min(4, st.hi - st.lo + 1));
          assert.equal(new Set(t.choices).size, t.choices.length);
          assert.ok(t.choices.includes(t.answer));
          assert.ok(t.choices.every((v) => v >= st.lo && v <= st.hi));
          assert.equal(t.stimulus.text, String(t.answer));
        }
      }
    }
  }
});

test('Vorschule level 1 offers only 1, 2 and 3', () => {
  for (let seed = 0; seed < 50; seed++) assert.deepEqual([...task(step('pre', 0), seed).choices].sort(), [1, 2, 3]);
});

test('confusable digits are preferred: 6 comes with 9', () => {
  let seen = 0;
  for (let seed = 0; seed < 500 && seen < 5; seed++) {
    const t = task(step('pre', 2), seed);
    if (t.answer === 6) { assert.ok(t.choices.includes(9)); seen++; }
  }
  assert.ok(seen > 0);
});

test('reversed numbers outside the range are never offered; inside they are preferred (20 → 2)', () => {
  let found = false;
  for (let seed = 0; seed < 3000; seed++) {
    const t = task(step('g1', 1), seed);
    assert.ok(t.choices.every((v) => v <= 20));
    if (t.answer === 20) { assert.ok(t.choices.includes(2)); found = true; }
  }
  assert.ok(found);
});

test('prompt and solution texts', () => {
  const t = task(step('g1', 0), 1);
  assert.equal(digits.speakPrompt(t, S), 'Welche Zahl war das?');
  assert.equal(digits.speakSolution(t, S)[0], `Das war die ${t.answer}.`);
});

test('Plus tasks show "a + b" and offer the sum among 4 unique choices', () => {
  const rng = mulberry32(5);
  for (let i = 0; i < 300; i++) {
    const t = digits.createTask(step('g1', 2, 1), S, rng);
    const { a, b } = t.stimulus;
    assert.equal(t.stimulus.text, `${a} + ${b}`);
    assert.equal(t.answer, a + b);
    assert.ok(a >= 1 && b >= 1 && t.answer <= 10);
    assert.equal(new Set(t.choices).size, 4);
    assert.ok(t.choices.includes(t.answer));
    assert.ok(t.choices.every((c) => c >= 0 && c <= 10));
    assert.equal(t.durationFactor, 2.5);
  }
});

test('Plus and Minus: both kinds appear, results stay in 0–10', () => {
  const rng = mulberry32(6);
  const ops = new Set();
  for (let i = 0; i < 300; i++) {
    const t = digits.createTask(step('g1', 3), S, rng);
    const { a, b, op } = t.stimulus;
    ops.add(op);
    assert.equal(t.answer, op === '+' ? a + b : a - b);
    assert.ok(t.answer >= 0 && t.answer <= 10 && a <= 10);
    assert.ok(t.stimulus.add);
    assert.ok(t.choices.includes(t.answer) && t.choices.every((c) => c >= 0 && c <= 10));
    if (op === '-') assert.equal(t.stimulus.text, `${a} – ${b}`);
  }
  assert.deepEqual([...ops].sort(), ['+', '-']);
});

test('arithmetic speech', () => {
  const plus = { answer: 5, stimulus: { add: true, op: '+', a: 3, b: 2 } };
  assert.equal(digits.speakPrompt(plus), 'Wie viel ist das zusammen?');
  assert.deepEqual(digits.speakSolution(plus), ['3 plus 2 ist 5.']);
  const minus = { answer: 4, stimulus: { add: true, op: '-', a: 7, b: 3 } };
  assert.equal(digits.speakPrompt(minus), 'Wie viel ist das?');
  assert.deepEqual(digits.speakSolution(minus), ['7 minus 3 ist 4.']);
});
