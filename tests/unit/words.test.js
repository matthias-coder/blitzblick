import test from 'node:test';
import assert from 'node:assert/strict';
import {
  letterKey, applyCase, syllabify, wordLevel, parseCustomWord, sanitizeCustom, buildPool, WORDS, MAX_CUSTOM,
} from '../../js/exercises/words.js';
import { LETTERS } from '../../js/exercises/letters.js';

const S = (known, custom = []) => ({ letters: { known }, syllables: { colors: true, custom } });

test('letterKey keeps ß and upper-cases everything else', () => {
  assert.equal(letterKey('ß'), 'ß');
  assert.equal(letterKey('ö'), 'Ö');
  assert.equal(letterKey('m'), 'M');
});

test('applyCase copies the casing pattern position by position', () => {
  assert.equal(applyCase(['E', 'L', 'A'], [...'Lea']), 'Ela');
  assert.equal(applyCase(['ß', 'A'], [...'Ma']), 'ßa');
  assert.equal(applyCase(['m', 'o'], [...'Om']), 'Mo');
});

test('syllabify follows the simple German rules', () => {
  const cases = {
    Oma: ['O', 'ma'], Ella: ['El', 'la'], Lea: ['Le', 'a'], Mai: ['Mai'], Banane: ['Ba', 'na', 'ne'],
    Tasche: ['Ta', 'sche'], Emil: ['E', 'mil'], Zucker: ['Zu', 'cker'], Lampe: ['Lam', 'pe'], Auto: ['Au', 'to'],
    Ma: ['Ma'], Om: ['Om'], Mm: ['Mm'], Möwe: ['Mö', 'we'],
  };
  for (const [w, parts] of Object.entries(cases)) assert.deepEqual(syllabify(w), parts, w);
});

test('wordLevel: two open syllables are level 1, everything else level 2', () => {
  assert.equal(wordLevel(['Ma', 'ma']), 1);
  assert.equal(wordLevel(['Le', 'a']), 1);
  assert.equal(wordLevel(['El', 'la']), 2);
  assert.equal(wordLevel(['Ba', 'na', 'ne']), 2);
  assert.equal(wordLevel(['Ben']), 2);
});

test('built-in list: valid letters, capitalized, split joins to the word', () => {
  assert.ok(WORDS.length >= 80 && WORDS.length <= 120, `got ${WORDS.length}`);
  for (const w of WORDS) {
    const text = w.replaceAll('|', '');
    assert.ok([...text].every((c) => LETTERS.includes(letterKey(c))), w);
    assert.equal(text[0], text[0].toUpperCase(), w);
    assert.equal(text.slice(1), text.slice(1).toLowerCase(), w);
  }
  assert.equal(new Set(WORDS.map((w) => w.replaceAll('|', '').toLowerCase())).size, WORDS.length);
});

test('parseCustomWord accepts letters and |, splits automatically otherwise', () => {
  assert.deepEqual(parseCustomWord(' El|la '), { text: 'Ella', split: 'El|la' });
  assert.deepEqual(parseCustomWord('Oma'), { text: 'Oma', split: 'O|ma' });
  assert.deepEqual(parseCustomWord('Jörß'), { text: 'Jörß', split: 'Jörß' });
  for (const bad of ['', 'A', 'Max1', 'Ma x', 'Ma||x', '|Max', 'Abcdefghijklm', 'Café']) assert.ok(parseCustomWord(bad).error, bad);
});

test('sanitizeCustom drops invalid, mismatched and duplicate entries and caps the list', () => {
  const list = [
    { text: 'Ella', split: 'El|la' }, { text: 'X1', split: 'X1' }, { text: 'ella', split: 'el|la' },
    'Lea', null, { text: 'Lea', split: 'Lo|a' }, { text: 'Mia' },
  ];
  assert.deepEqual(sanitizeCustom(list), [{ text: 'Ella', split: 'El|la' }, { text: 'Mia', split: 'Mi|a' }]);
  assert.deepEqual(sanitizeCustom('nope'), []);
  const L = ['A', 'B', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L'];
  const many = Array.from({ length: 60 }, (_, i) => ({ text: `M${L[i % 10].toLowerCase()}${L[Math.floor(i / 10)].toLowerCase()}` }));
  assert.equal(sanitizeCustom(many).length, MAX_CUSTOM);
});

test('pool for A, M, O: generated syllables and matching words only', () => {
  const pool = buildPool(S(['A', 'M', 'O']));
  const texts = pool.map((e) => e.text).sort();
  assert.deepEqual(texts, ['Am', 'Ma', 'Mama', 'Mo', 'Om', 'Oma']);
  assert.deepEqual(pool.find((e) => e.text === 'Oma'), { text: 'Oma', parts: ['O', 'ma'], level: 1 });
  assert.equal(pool.find((e) => e.text === 'Ma').level, 0);
});

test('pool respects umlauts and ignores case when matching known letters', () => {
  const pool = buildPool(S(['M', 'Ö', 'W', 'E']));
  assert.ok(pool.some((e) => e.text === 'Möwe'));
  assert.ok(!pool.some((e) => e.text === 'Oma'));
});

test('custom words join the pool and override the stored split', () => {
  const pool = buildPool(S(['M', 'O', 'A'], [{ text: 'Momo', split: 'Mo|mo' }, { text: 'Oma', split: 'Om|a' }]));
  assert.deepEqual(pool.find((e) => e.text === 'Momo'), { text: 'Momo', parts: ['Mo', 'mo'], level: 1 });
  assert.deepEqual(pool.find((e) => e.text === 'Oma').parts, ['Om', 'a']);
  assert.ok(!buildPool(S(['M', 'O'], [{ text: 'Lola', split: 'Lo|la' }])).some((e) => e.text === 'Lola'));
});

test('no syllables are generated with ß or for unknown vowels', () => {
  const pool = buildPool(S(['ß', 'A', 'S']));
  assert.ok(pool.every((e) => !e.text.includes('ß') || e.level > 0));
  assert.deepEqual(buildPool(S(['M', 'N'])), []);
});

test('doubled vowels aa/ee/oo stay together', () => {
  assert.deepEqual(syllabify('Kaffee'), ['Kaf', 'fee']);
  assert.deepEqual(syllabify('Saal'), ['Saal']);
  assert.deepEqual(syllabify('Boot'), ['Boot']);
  assert.deepEqual(syllabify('Tee'), ['Tee']);
});

test('custom words only accept the explicit letter whitelist', () => {
  assert.ok(parseCustomWord('Pıa').error);
  assert.ok(parseCustomWord('ſofa').error);
  for (const w of ['Ella', 'ella', 'Straße', 'Öl']) assert.equal(parseCustomWord(w).error, undefined, w);
});
