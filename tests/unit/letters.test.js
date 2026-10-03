import test from 'node:test';
import assert from 'node:assert/strict';
import * as letters from '../../js/exercises/letters.js';
import { mulberry32 } from '../../js/rng.js';

const S = (known, c = 'upper', speak = 'sound') => ({ letters: { known, case: c, speak } });
const make = (settings, complexity, seed) => letters.createTask({ complexity }, settings, mulberry32(seed));

test('alphabet contains umlauts and ß', () => {
  assert.equal(letters.LETTERS.length, 30);
  for (const l of ['A', 'Z', 'Ä', 'Ö', 'Ü', 'ß']) assert.ok(letters.LETTERS.includes(l));
});

test('available only with at least two known letters', () => {
  assert.equal(letters.isAvailable(S(['A'])), false);
  assert.equal(letters.isAvailable(S(['A', 'M'])), true);
});

test('answer and choices come only from known letters', () => {
  const s = S(['A', 'M', 'O', 'T', 'E']);
  for (let seed = 0; seed < 300; seed++) {
    const t = make(s, 0, seed);
    assert.ok(['A', 'M', 'O', 'T', 'E'].includes(t.answer));
    assert.equal(t.choices.length, 4);
    assert.equal(new Set(t.choices).size, 4);
    assert.ok(t.choices.includes(t.answer));
    assert.ok(t.choices.every((c) => ['A', 'M', 'O', 'T', 'E'].includes(c)));
  }
});

test('fewer known letters means fewer choices, at least two', () => {
  const t = make(S(['A', 'M']), 0, 1);
  assert.equal(t.choices.length, 2);
  assert.equal(make(S(['A', 'M', 'O']), 0, 1).choices.length, 3);
});

test('unknown entries in settings are ignored', () => {
  for (let seed = 0; seed < 50; seed++) {
    const t = make(S(['A', 'M', '7', 'xx']), 0, seed);
    assert.ok(['A', 'M'].includes(t.answer));
  }
});

test('lower case shows lower-case glyphs', () => {
  const t = make(S(['A', 'M', 'Ä', 'ß'], 'lower'), 0, 3);
  assert.ok(['a', 'm', 'ä', 'ß'].includes(t.answer));
  assert.ok(t.choices.every((c) => ['a', 'm', 'ä', 'ß'].includes(c)));
  assert.equal(t.stimulus.text, t.answer);
});

test('stages follow the case setting', () => {
  assert.deepEqual(letters.stages(S(['A', 'B'], 'upper')), ['upper']);
  assert.deepEqual(letters.stages(S(['A', 'B'], 'both')), ['upper', 'lower', 'mixed']);
  assert.equal(letters.maxComplexity(S(['A', 'B'], 'both')), 2);
});

test('mixed stage keeps stimulus and choices in the same case', () => {
  const s = S(['A', 'B', 'D', 'M', 'O'], 'both');
  for (let seed = 0; seed < 200; seed++) {
    const t = make(s, 2, seed);
    const upper = t.answer === t.answer.toUpperCase();
    assert.ok(t.choices.every((c) => (c === c.toUpperCase()) === upper));
  }
});

test('confusable letters are preferred as distractors (b/d/p/q)', () => {
  const s = S(['B', 'D', 'P', 'Q', 'A', 'M', 'O', 'T'], 'lower');
  let seen = 0;
  for (let seed = 0; seed < 400; seed++) {
    const t = make(s, 0, seed);
    if (t.base === 'B') { assert.deepEqual([...t.choices].sort(), ['b', 'd', 'p', 'q']); seen++; }
  }
  assert.ok(seen > 0);
});

test('solution text uses sound or name', () => {
  const t = { base: 'M', answer: 'M' };
  assert.equal(letters.speakSolution(t, S(['M', 'A'], 'upper', 'sound')), 'Das war mmm.');
  assert.equal(letters.speakSolution(t, S(['M', 'A'], 'upper', 'name')), 'Das war ein Em.');
  assert.equal(letters.speakPrompt(t, S(['M', 'A'])), 'Welcher Buchstabe war das?');
});

test('every letter has a name and a sound', () => {
  for (const l of letters.LETTERS) {
    assert.ok(letters.NAMES[l], `name ${l}`);
    assert.ok(letters.SOUNDS[l], `sound ${l}`);
  }
});
