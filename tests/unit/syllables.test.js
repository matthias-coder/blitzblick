import test from 'node:test';
import assert from 'node:assert/strict';
import * as syl from '../../js/exercises/syllables.js';
import { letterKey, WORDS } from '../../js/exercises/words.js';
import { mulberry32 } from '../../js/rng.js';

const S = (known, extra = {}) => ({
  letters: { known }, syllables: { colors: true, custom: [] }, speech: 'little', ...extra,
});
const KIND = ['syllable', 'open', 'all'];
const step = (k, choices = 4, colors = true) => ({ kind: typeof k === 'number' ? KIND[Math.min(k, 2)] : k, choices, colors });
const make = (settings, kind, seed, ctx = { last: null }) => syl.createTask(step(kind), settings, mulberry32(seed), ctx);
const capitalized = (t) => t[0] === letterKey(t[0]) && t.slice(1) === t.slice(1).toLowerCase();

test('availability needs at least 4 playable entries', () => {
  assert.equal(syl.isAvailable(S(['A', 'M'])), false);
  assert.equal(syl.isAvailable(S(['M', 'N'])), false);
  assert.equal(syl.isAvailable(S(['A', 'M', 'O'])), true);
});

test('levels are playable only with enough material of their kind', () => {
  const [syll, open, all] = syl.LADDERS.g1;
  assert.equal(syl.levelAvailable(syll, S(['A', 'M', 'O'])), true);
  assert.equal(syl.levelAvailable(open, S(['A', 'M', 'O'])), false); // only Mama, Oma
  assert.equal(syl.levelAvailable(open, S(['A', 'M', 'O', 'L', 'E', 'N', 'I'])), true);
  assert.equal(syl.levelAvailable(all, S(['A', 'M', 'O', 'L', 'E', 'N', 'I'])), true);
  assert.equal(syl.levelAvailable(syll, S(['A', 'M'])), false);
});

test('ladders: three answers first in Vorschule, no colour help on level 4', () => {
  assert.equal(syl.LADDERS.pre[0].steps[0].choices, 3);
  for (const g of ['pre', 'g1']) assert.equal(syl.LADDERS[g][3].steps[0].colors, false);
});

test('a step without colour help switches colours off, the parent switch can only switch them off too', () => {
  const s = S(['A', 'M', 'O', 'L', 'E', 'N', 'I']);
  assert.equal(syl.createTask(step('all', 4, false), s, mulberry32(1)).colors, false);
  assert.equal(syl.createTask(step('all'), s, mulberry32(1)).colors, true);
  assert.equal(syl.createTask(step('all'), { ...s, syllables: { colors: false, custom: [] } }, mulberry32(1)).colors, false);
});

test('three-answer steps offer three choices', () => {
  for (let seed = 0; seed < 100; seed++) {
    const t = syl.createTask(step('syllable', 3), S(['A', 'M', 'O', 'L']), mulberry32(seed));
    assert.equal(t.choices.length, 3);
    assert.ok(t.choices.includes(t.answer));
  }
});

test('tasks with A, M, O: 4 distinct choices from known letters, all capitalized like the answer', () => {
  const known = ['A', 'M', 'O'];
  for (const c of [0, 1]) {
    for (let seed = 0; seed < 300; seed++) {
      const t = make(S(known), c, seed);
      assert.equal(t.choices.length, 4);
      assert.equal(new Set(t.choices).size, 4);
      assert.ok(t.choices.includes(t.answer));
      for (const ch of t.choices) {
        assert.ok([...ch].every((x) => known.includes(letterKey(x))), ch);
        assert.equal(capitalized(ch), capitalized(t.answer), `${ch} vs ${t.answer}`);
        assert.deepEqual(t.parts[ch].join(''), ch);
      }
    }
  }
});

test('syllable steps ask for syllables, word steps only for words of their kind', () => {
  const s = S(['A', 'M', 'O', 'L', 'E', 'N', 'I']);
  for (let seed = 0; seed < 50; seed++) assert.equal(make(s, 'syllable', seed).kind, 'syllable');
  for (let seed = 0; seed < 50; seed++) assert.equal(make(s, 'all', seed).kind, 'word');
  for (let seed = 0; seed < 50; seed++) assert.equal(make(s, 'open', seed).stimulus.parts.length, 2);
});

test('a kind without material falls back to the whole pool', () => {
  assert.doesNotThrow(() => make(S(['A', 'M', 'O']), 'all', 1));
});

test('the same entry does not come twice in a row when there is a choice', () => {
  const s = S(['A', 'M', 'O', 'L', 'E']);
  const ctx = syl.prepareRound();
  let last = null;
  for (let seed = 0; seed < 100; seed++) {
    const t = make(s, 0, seed, ctx);
    assert.notEqual(t.answer, last);
    last = t.answer;
  }
});

test('custom words are used and keep their split', () => {
  const s = S(['M', 'O', 'A'], { syllables: { colors: false, custom: [{ text: 'Momo', split: 'Mo|mo' }] } });
  const tasks = Array.from({ length: 200 }, (_, seed) => make(s, 1, seed));
  const momo = tasks.find((t) => t.answer === 'Momo');
  assert.ok(momo);
  assert.deepEqual(momo.stimulus.parts, ['Mo', 'mo']);
  assert.equal(momo.colors, false);
});

test('distractors prefer swapped and similar-looking variants', () => {
  const pool = [{ text: 'Lea', parts: ['Le', 'a'], level: 1 }];
  const d = syl.buildDistractors('Lea', pool, ['A', 'E', 'L', 'I'], mulberry32(3));
  assert.equal(d.length, 3);
  assert.ok(d.some((x) => ['Ela', 'Lae'].includes(x)), d.join());
  assert.ok(!d.includes('Lea'));
});

test('speech: prompt by kind, syllable spelling only in mode lots', () => {
  const t = { answer: 'Ella', stimulus: { text: 'Ella', parts: ['El', 'la'] }, kind: 'word' };
  assert.equal(syl.speakPrompt(t), 'Welches Wort war das?');
  assert.equal(syl.speakPrompt({ ...t, kind: 'syllable' }), 'Welche Silbe war das?');
  assert.ok(syl.speakSolution(t, { speech: 'little' }).every((l) => l.includes('Ella') && !l.includes('–')));
  assert.ok(syl.speakSolution(t, { speech: 'lots' }).every((l) => l.startsWith('El – la. ')));
});

test('made-up distractors are split like the answer, so colors never give it away', () => {
  const s = S([...'ABDEFGHIKLMNOPRSTUZÄÖÜ']);
  const realTexts = new Set(WORDS.map((w) => w.replaceAll('|', '')));
  const shape = (parts) => parts.map((p) => [...p].length).join(',');
  for (let seed = 0; seed < 600; seed++) {
    const t = make(s, 2, seed);
    for (const c of t.choices) {
      if (c === t.answer || realTexts.has(c) || [...c].length !== [...t.answer].length) continue;
      assert.equal(shape(t.parts[c]), shape(t.stimulus.parts), `${t.answer} vs ${c}`);
    }
  }
});

test('distractors never put ß where the answer has a capital letter', () => {
  const keys = ['S', 'ß', 'O', 'F', 'A'];
  const pool = [{ text: 'Sofa', parts: ['So', 'fa'], level: 1 }];
  for (let seed = 1; seed <= 300; seed++) {
    const ds = syl.buildDistractors('Sofa', pool, keys, mulberry32(seed));
    for (const d of ds) assert.notEqual(d[0], 'ß', `seed ${seed}: ${d}`);
  }
  // lowercase positions may still use ß
  const seen = new Set();
  for (let seed = 1; seed <= 300; seed++) for (const d of syl.buildDistractors('Masse', [], ['M', 'A', 'S', 'E', 'ß'], mulberry32(seed))) seen.add(d);
  assert.equal([...seen].some((d) => d.includes('ß')), true);
});
