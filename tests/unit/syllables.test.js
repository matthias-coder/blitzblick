import test from 'node:test';
import assert from 'node:assert/strict';
import * as syl from '../../js/exercises/syllables.js';
import { letterKey, WORDS } from '../../js/exercises/words.js';
import { mulberry32 } from '../../js/rng.js';

const S = (known, extra = {}) => ({
  letters: { known }, syllables: { colors: true, custom: [] }, speech: 'little', ...extra,
});
const make = (settings, complexity, seed, ctx = { last: null }) => syl.createTask({ complexity }, settings, mulberry32(seed), ctx);
const capitalized = (t) => t[0] === letterKey(t[0]) && t.slice(1) === t.slice(1).toLowerCase();

test('availability needs at least 4 playable entries', () => {
  assert.equal(syl.isAvailable(S(['A', 'M'])), false);
  assert.equal(syl.isAvailable(S(['M', 'N'])), false);
  assert.equal(syl.isAvailable(S(['A', 'M', 'O'])), true);
});

test('stages grow with the available material', () => {
  assert.equal(syl.maxComplexity(S(['A', 'M', 'O'])), 1);
  assert.equal(syl.maxComplexity(S(['A', 'M', 'O', 'L', 'E'])), 2);
  assert.equal(syl.startComplexity(), 0);
  assert.equal(syl.describeLevel(0, S(['A', 'M', 'O'])), 'Silben');
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

test('level 0 asks for syllables, higher levels mostly for words', () => {
  const s = S(['A', 'M', 'O', 'L', 'E', 'N', 'I']);
  for (let seed = 0; seed < 50; seed++) assert.equal(make(s, 0, seed).kind, 'syllable');
  const words = Array.from({ length: 100 }, (_, seed) => make(s, 2, seed)).filter((t) => t.kind === 'word');
  assert.ok(words.length >= 50);
});

test('thin level mixes in lower entries, complexity beyond the top still works', () => {
  const s = S(['A', 'M', 'O']);
  const kinds = new Set(Array.from({ length: 100 }, (_, seed) => make(s, 1, seed).kind));
  assert.deepEqual([...kinds].sort(), ['syllable', 'word']);
  assert.doesNotThrow(() => make(s, 5, 1));
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
