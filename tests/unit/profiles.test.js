import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, EXERCISE_ORDER } from '../../js/exercises/index.js';
import {
  DEFAULT_SETTINGS, createProfile, addProfile, removeProfile, setActive, getActive,
  updateProfile, updateSettings, resetLevels, normalizeProfile, setGrade, setLevel,
} from '../../js/profiles.js';
import { GRADES, LEVEL_COUNT } from '../../js/levels.js';
import { parseImport } from '../../js/storage.js';

const empty = () => ({ schemaVersion: 1, activeProfileId: null, profiles: [] });
const mk = (id, name = 'Mia') => createProfile({ name, avatar: 'astronaut' }, { id, now: new Date(2026, 9, 3) });

test('every exercise implements the module contract', () => {
  const fns = ['isAvailable', 'createTask', 'renderStimulus', 'renderChoices', 'speakPrompt', 'speakSolution'];
  assert.deepEqual(Object.keys(EXERCISES).sort(), [...EXERCISE_ORDER].sort());
  for (const [key, ex] of Object.entries(EXERCISES)) {
    assert.equal(ex.id, key);
    assert.equal(typeof ex.title, 'string');
    assert.match(ex.menuTitle, /blitz$/);
    for (const f of fns) assert.equal(typeof ex[f], 'function', `${key}.${f}`);
  }
});

test('every exercise has exactly four levels with steps for every grade', () => {
  for (const [key, ex] of Object.entries(EXERCISES)) {
    for (const g of GRADES) {
      const ladder = ex.LADDERS[g];
      assert.equal(ladder?.length, LEVEL_COUNT, `${key}/${g}`);
      for (const l of ladder) {
        assert.equal(typeof l.label, 'string');
        assert.ok(l.steps.length >= 1, `${key}/${g}/${l.label}`);
      }
    }
  }
});

test('createProfile uses defaults, trims the name and creates a level per exercise', () => {
  const p = createProfile({ name: '  Mia ', avatar: 'cat' }, { id: 'p1', now: new Date(2026, 9, 3) });
  assert.equal(p.name, 'Mia');
  assert.equal(p.avatar, 'cat');
  assert.deepEqual(p.settings, DEFAULT_SETTINGS);
  assert.notEqual(p.settings, DEFAULT_SETTINGS);
  assert.equal(p.settings.grade, 'pre');
  for (const key of Object.keys(EXERCISES)) {
    assert.deepEqual(p.levels[key], { level: 0, step: 0, durationMs: 2000, streak: 0, recent: [], mastered: false });
  }
  assert.deepEqual(p.rewards, { stars: 0, stickers: [], reached: { quantity: 0, digits: 0, letters: 0, syllables: 0 } });
  assert.deepEqual(p.history, []);
});

test('createProfile generates distinct ids', () => {
  assert.notEqual(createProfile({ name: 'A', avatar: 'astronaut' }).id, createProfile({ name: 'B', avatar: 'astronaut' }).id);
});

test('addProfile activates the first profile only', () => {
  let s = addProfile(empty(), mk('p1'));
  assert.equal(s.activeProfileId, 'p1');
  s = addProfile(s, mk('p2', 'Ben'));
  assert.equal(s.activeProfileId, 'p1');
  assert.equal(setActive(s, 'p2').activeProfileId, 'p2');
  assert.equal(getActive(setActive(s, 'p2')).name, 'Ben');
});

test('removing the active profile activates the next one, removing the last leaves none', () => {
  let s = addProfile(addProfile(empty(), mk('p1')), mk('p2'));
  s = removeProfile(s, 'p1');
  assert.equal(s.activeProfileId, 'p2');
  s = removeProfile(s, 'p2');
  assert.equal(s.activeProfileId, null);
  assert.equal(getActive(s), null);
});

test('updateProfile changes only the target profile', () => {
  const s = addProfile(addProfile(empty(), mk('p1')), mk('p2', 'Ben'));
  const next = updateProfile(s, 'p2', (p) => ({ ...p, name: 'Benno' }));
  assert.equal(next.profiles[0].name, 'Mia');
  assert.equal(next.profiles[1].name, 'Benno');
});

test('updateSettings merges nested values and replaces arrays', () => {
  const p = updateSettings(mk('p1'), { letters: { known: ['B', 'D'] }, timing: { startMs: 1000 } });
  assert.deepEqual(p.settings.letters.known, ['B', 'D']);
  assert.equal(p.settings.letters.speak, 'sound');
  assert.equal(p.settings.timing.startMs, 1000);
  assert.equal(p.settings.timing.maxMs, 3500);
});

test('updateSettings normalizes timing so that min ≤ start ≤ max', () => {
  const p = updateSettings(mk('p1'), { timing: { startMs: 4000, minMs: 3500, maxMs: 2000 } });
  assert.deepEqual([p.settings.timing.minMs, p.settings.timing.startMs, p.settings.timing.maxMs], [2000, 3500, 3500]);
});

test('updateSettings clamps levels when the parent lowers limits', () => {
  let p = mk('p1');
  p = { ...p, levels: { ...p.levels, quantity: { ...p.levels.quantity, level: 2, step: 9, durationMs: 300 } } };
  p = updateSettings(p, { timing: { minMs: 500 } });
  assert.equal(p.levels.quantity.step, 2); // Vorschule level 3 has three steps
  assert.equal(p.levels.quantity.durationMs, 500);
});

test('resetLevels returns every exercise to level 1 but keeps hold switches', () => {
  let p = updateSettings(setLevel(mk('p1'), 'digits', 3), { hold: { digits: true } });
  p = resetLevels(p);
  assert.deepEqual(p.levels.digits, { level: 0, step: 0, durationMs: 2000, streak: 0, recent: [], mastered: false });
  assert.equal(p.settings.hold.digits, true);
});

test('setLevel starts the chosen level and opens its sticker page', () => {
  const p = setLevel(mk('p1'), 'letters', 2);
  assert.equal(p.levels.letters.level, 2);
  assert.equal(p.levels.letters.step, 0);
  assert.equal(p.rewards.reached.letters, 2);
  assert.equal(setLevel(p, 'letters', 0).rewards.reached.letters, 2);
  assert.equal(setLevel(p, 'letters', 7), p);
});

test('setGrade restarts at level 1 with the grade timing and keeps album, letters and hold', () => {
  let p = updateSettings(setLevel(mk('p1'), 'quantity', 3), { hold: { quantity: true }, letters: { known: ['A', 'M', 'L'] } });
  p = { ...p, rewards: { ...p.rewards, stars: 40, stickers: ['fruit/pear'] } };
  const g = setGrade(p, 'g1');
  assert.equal(g.settings.grade, 'g1');
  assert.deepEqual(g.settings.timing, { startMs: 1500, minMs: 300, maxMs: 3000, adaptive: true });
  assert.equal(g.levels.quantity.level, 0);
  assert.equal(g.levels.quantity.durationMs, 1500);
  assert.equal(g.settings.hold.quantity, true);
  assert.deepEqual(g.settings.letters.known, ['A', 'M', 'L']);
  assert.deepEqual(g.rewards, p.rewards);
  assert.equal(setGrade(g, 'g1'), g);
  assert.equal(setGrade(g, 'g9'), g);
});

test('grade, hold and lineature are sanitized', () => {
  const raw = mk('p1');
  raw.settings.grade = 'uni';
  raw.settings.hold = { digits: 'yes', letters: true };
  raw.settings.letters.lineature = 'no';
  const p = normalizeProfile(raw);
  assert.equal(p.settings.grade, 'pre');
  assert.deepEqual(p.settings.hold, { quantity: false, digits: false, letters: true, syllables: false });
  assert.equal(p.settings.letters.lineature, true);
});

test('reached is never below the current level', () => {
  const raw = mk('p1');
  raw.levels.digits.level = 2;
  raw.rewards.reached = { digits: 1, letters: 'x' };
  const p = normalizeProfile(raw);
  assert.equal(p.rewards.reached.digits, 2);
  assert.equal(p.rewards.reached.letters, 0);
});

test('normalizeProfile fills missing settings, levels and rewards', () => {
  const raw = mk('p1');
  delete raw.settings.sounds;
  delete raw.levels.letters;
  raw.avatar = 'unicorn';
  const p = normalizeProfile(raw);
  assert.equal(p.settings.sounds, true);
  assert.ok(p.levels.letters);
  assert.equal(p.avatar, 'astronaut');
});

test('normalizeProfile does not share references to DEFAULT_SETTINGS', () => {
  const raw = mk('p1');
  delete raw.settings.letters;
  const p = normalizeProfile(raw);
  assert.notEqual(p.settings.letters, DEFAULT_SETTINGS.letters);
  assert.notEqual(p.settings.letters.known, DEFAULT_SETTINGS.letters.known);
  assert.deepEqual(p.settings.letters, DEFAULT_SETTINGS.letters);
});

test('updateSettings refuses fewer than 2 letters or zero exercises', () => {
  const p = mk('p1');
  assert.equal(updateSettings(p, { letters: { known: ['A'] } }), p);
  assert.equal(updateSettings(p, { exercises: { quantity: false, digits: false, letters: false, syllables: false } }), p);
  assert.deepEqual(updateSettings(p, { letters: { known: ['A', 'B'] } }).settings.letters.known, ['A', 'B']);
});

test('a hand-damaged backup normalizes to a playable profile', () => {
  const raw = mk('p1');
  raw.rewards = { stars: '5', stickers: 'x', unlockedPages: null };
  raw.settings = { timing: null, quantity: { max: 'many', layout: 7 }, digits: { range: 99 }, letters: { known: ['A', 'B', 'A', 5], case: 'x', speak: 1 }, exercises: { quantity: false, digits: false, letters: false } };
  raw.levels = { quantity: {}, digits: { durationMs: 'fast', complexity: null, streak: 'a', recent: 'no' }, letters: null };
  raw.history = [null, { date: 1 }, { date: '2026-10-01', exercise: 'nope', correct: 1, total: 2 }, { date: '2026-10-01', exercise: 'digits', correct: '1', total: 2 }, { date: '2026-10-01', exercise: 'digits', correct: 1, total: 2 }];
  const data = { schemaVersion: 1, activeProfileId: 'p1', profiles: [raw] };
  const p = parseImport(JSON.stringify(data)).profiles[0];
  assert.equal(p.rewards.stars, 0);
  assert.deepEqual(p.rewards.stickers, []);
  assert.deepEqual(Object.keys(p.rewards.reached).sort(), Object.keys(EXERCISES).sort());
  assert.equal('unlockedPages' in p.rewards, false);
  assert.equal(p.history.length, 1);
  assert.deepEqual(p.settings.letters.known, ['A', 'B']);
  assert.ok(Object.values(p.settings.exercises).some(Boolean));
  for (const t of Object.values(p.settings.timing).filter((v) => typeof v !== 'boolean')) assert.ok(Number.isFinite(t));
  for (const [key, ex] of Object.entries(EXERCISES)) {
    const l = p.levels[key];
    for (const f of ['level', 'step', 'durationMs', 'streak']) assert.ok(Number.isFinite(l[f]), key + f);
    assert.ok(Array.isArray(l.recent));
    const step = ex.LADDERS[p.settings.grade][l.level].steps[l.step];
    const task = ex.createTask(step, p.settings, Math.random, ex.prepareRound ? ex.prepareRound(Math.random) : {});
    assert.ok(task.choices.length >= 2, key);
  }
});

test('normalizeProfile migrates the old speech switch to speech modes', () => {
  const base = createProfile({ name: 'Mia', avatar: 'cat' });
  const withSpeech = (v) => normalizeProfile({ ...base, settings: { ...base.settings, speech: v } }).settings.speech;
  assert.equal(base.settings.speech, 'little');
  assert.equal(withSpeech(true), 'little');
  assert.equal(withSpeech(false), 'off');
  assert.equal(withSpeech('lots'), 'lots');
  assert.equal(withSpeech('loud'), 'little');
});

test('defaults include the syllables exercise and its settings', () => {
  assert.equal(DEFAULT_SETTINGS.exercises.syllables, true);
  assert.deepEqual(DEFAULT_SETTINGS.syllables, { colors: true, custom: [] });
});

test('old profiles without syllables settings get defaults', () => {
  const old = mk('p1');
  delete old.settings.syllables;
  delete old.settings.exercises.syllables;
  const p = normalizeProfile(old);
  assert.deepEqual(p.settings.syllables, { colors: true, custom: [] });
  assert.equal(p.settings.exercises.syllables, true);
});

test('invalid custom words are dropped when loading or importing', () => {
  const raw = mk('p1');
  raw.settings.syllables = {
    colors: false,
    custom: [{ text: 'Ella', split: 'El|la' }, { text: '<b>', split: '<b>' }, { text: 'ELLA', split: 'EL|LA' }, 42],
  };
  const p = normalizeProfile(raw);
  assert.deepEqual(p.settings.syllables, { colors: false, custom: [{ text: 'Ella', split: 'El|la' }] });
  const data = { schemaVersion: 1, activeProfileId: 'p1', profiles: [raw] };
  assert.deepEqual(parseImport(JSON.stringify(data)).profiles[0].settings.syllables.custom, [{ text: 'Ella', split: 'El|la' }]);
});

test('updateSettings replaces the custom word list', () => {
  const p = updateSettings(mk('p1'), { syllables: { custom: [{ text: 'Mia', split: 'Mi|a' }] } });
  assert.deepEqual(p.settings.syllables.custom, [{ text: 'Mia', split: 'Mi|a' }]);
  const q = updateSettings(p, { syllables: { custom: [] } });
  assert.deepEqual(q.settings.syllables.custom, []);
});

test('settings that would leave no playable exercise are refused or reset', () => {
  const only = updateSettings(mk('p1'), { exercises: { quantity: false, digits: false, letters: false } });
  assert.deepEqual(Object.keys(only.settings.exercises).filter((k) => only.settings.exercises[k]), ['syllables']);
  assert.equal(updateSettings(only, { letters: { known: ['A', 'M'] } }), only);
  const raw = structuredClone(only);
  raw.settings.letters.known = ['A', 'M'];
  const p = normalizeProfile(raw);
  assert.equal(p.settings.exercises.quantity, true);
});

test('secretDay is kept only as a date string', () => {
  const raw = mk('p1');
  raw.rewards.secretDay = '2026-10-05';
  assert.equal(normalizeProfile(raw).rewards.secretDay, '2026-10-05');
  for (const bad of [42, 'gestern', { d: 1 }]) {
    raw.rewards.secretDay = bad;
    assert.equal('secretDay' in normalizeProfile(raw).rewards, false);
  }
});
