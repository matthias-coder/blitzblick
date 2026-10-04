import test from 'node:test';
import assert from 'node:assert/strict';
import * as letters from '../../js/exercises/letters.js';
import { mulberry32 } from '../../js/rng.js';

const S = (known, speak = 'sound') => ({ letters: { known, speak, lineature: true } });
const st = (c = 'upper', choices = 4, similar = true) => ({ case: c, choices, similar });
const make = (settings, step, seed) => letters.createTask(step, settings, mulberry32(seed));

test('alphabet contains umlauts and ß', () => {
  assert.equal(letters.LETTERS.length, 30);
  for (const l of ['A', 'Z', 'Ä', 'Ö', 'Ü', 'ß']) assert.ok(letters.LETTERS.includes(l));
});

test('available only with at least two known letters', () => {
  assert.equal(letters.isAvailable(S(['A'])), false);
  assert.equal(letters.isAvailable(S(['A', 'M'])), true);
});

test('ladders: Vorschule stays with capitals until level 4, Klasse 1 ends with six answers', () => {
  assert.deepEqual(letters.LADDERS.pre.map((l) => l.steps[0].case), ['upper', 'upper', 'upper', 'lower']);
  assert.deepEqual(letters.LADDERS.pre.map((l) => l.steps[0].choices), [3, 4, 4, 4]);
  assert.deepEqual(letters.LADDERS.g1.map((l) => l.steps[0].case), ['upper', 'lower', 'mixed', 'mixed']);
  assert.equal(letters.LADDERS.g1[3].steps[0].choices, 6);
});

test('six answers need at least four known letters', () => {
  assert.equal(letters.levelAvailable(letters.LADDERS.g1[3], S(['A', 'M', 'O'])), false);
  assert.equal(letters.levelAvailable(letters.LADDERS.g1[3], S(['A', 'M', 'O', 'T'])), true);
  assert.equal(letters.levelAvailable(letters.LADDERS.g1[0], S(['A', 'M'])), true);
});

test('answer and choices come only from known letters, as many as the step asks for', () => {
  const known = ['A', 'M', 'O', 'T', 'E', 'L', 'I'];
  for (const n of [3, 4, 6]) {
    for (let seed = 0; seed < 200; seed++) {
      const t = make(S(known), st('upper', n), seed);
      assert.ok(known.includes(t.answer));
      assert.equal(t.choices.length, n);
      assert.equal(new Set(t.choices).size, n);
      assert.ok(t.choices.includes(t.answer));
      assert.ok(t.choices.every((c) => known.includes(c)));
    }
  }
});

test('fewer known letters means fewer choices, at least two', () => {
  assert.equal(make(S(['A', 'M']), st(), 1).choices.length, 2);
  assert.equal(make(S(['A', 'M', 'O']), st(), 1).choices.length, 3);
});

test('unknown entries in settings are ignored', () => {
  for (let seed = 0; seed < 50; seed++) assert.ok(['A', 'M'].includes(make(S(['A', 'M', '7', 'xx']), st(), seed).answer));
});

test('lower case shows lower-case glyphs', () => {
  const t = make(S(['A', 'M', 'Ä', 'ß']), st('lower'), 3);
  assert.ok(['a', 'm', 'ä', 'ß'].includes(t.answer));
  assert.ok(t.choices.every((c) => ['a', 'm', 'ä', 'ß'].includes(c)));
  assert.equal(t.stimulus.text, t.answer);
});

test('mixed step keeps stimulus and choices in the same case', () => {
  for (let seed = 0; seed < 200; seed++) {
    const t = make(S(['A', 'B', 'D', 'M', 'O']), st('mixed'), seed);
    const upper = t.answer === t.answer.toUpperCase();
    assert.ok(t.choices.every((c) => (c === c.toUpperCase()) === upper));
  }
});

test('confusable letters are preferred as distractors (b/d/p/q) only when the step asks for it', () => {
  const s = S(['B', 'D', 'P', 'Q', 'A', 'M', 'O', 'T']);
  let similar = 0, other = 0;
  for (let seed = 0; seed < 400; seed++) {
    const t = make(s, st('lower'), seed);
    if (t.base === 'B') { assert.deepEqual([...t.choices].sort(), ['b', 'd', 'p', 'q']); similar++; }
    const r = make(s, st('lower', 4, false), seed);
    if (r.base === 'B' && [...r.choices].sort().join() !== 'b,d,p,q') other++;
  }
  assert.ok(similar > 0 && other > 0);
});

test('the lineature flag follows the parent switch', () => {
  assert.equal(make(S(['A', 'M']), st(), 1).lineature, true);
  assert.equal(letters.createTask(st(), { letters: { known: ['A', 'M'], lineature: false } }, mulberry32(1)).lineature, false);
});

test('solution text uses sound or name', () => {
  const t = { base: 'M', answer: 'M' };
  assert.equal(letters.speakSolution(t, S(['M', 'A'], 'sound'))[0], 'Das war mmm.');
  assert.equal(letters.speakSolution(t, S(['M', 'A'], 'name'))[0], 'Das war ein Em.');
  assert.equal(letters.speakPrompt(t, S(['M', 'A'])), 'Welcher Buchstabe war das?');
});

test('every letter has a name and a sound', () => {
  for (const l of letters.LETTERS) {
    assert.ok(letters.NAMES[l], `name ${l}`);
    assert.ok(letters.SOUNDS[l], `sound ${l}`);
  }
});
