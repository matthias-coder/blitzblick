import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, EXERCISE_ORDER } from '../../js/exercises/index.js';
import {
  DEFAULT_SETTINGS, createProfile, addProfile, removeProfile, setActive, getActive,
  updateProfile, updateSettings, resetLevels, normalizeProfile,
} from '../../js/profiles.js';
import { parseImport } from '../../js/storage.js';

const empty = () => ({ schemaVersion: 1, activeProfileId: null, profiles: [] });
const mk = (id, name = 'Mia') => createProfile({ name, avatar: 'astronaut' }, { id, now: new Date(2026, 9, 3) });

test('every exercise implements the module contract', () => {
  const fns = ['isAvailable', 'stages', 'maxComplexity', 'startComplexity', 'describeLevel', 'createTask', 'renderStimulus', 'renderChoices', 'speakPrompt', 'speakSolution'];
  assert.deepEqual(Object.keys(EXERCISES).sort(), [...EXERCISE_ORDER].sort());
  for (const [key, ex] of Object.entries(EXERCISES)) {
    assert.equal(ex.id, key);
    assert.equal(typeof ex.title, 'string');
    for (const f of fns) assert.equal(typeof ex[f], 'function', `${key}.${f}`);
  }
});

test('createProfile uses defaults, trims the name and creates a level per exercise', () => {
  const p = createProfile({ name: '  Mia ', avatar: 'cat' }, { id: 'p1', now: new Date(2026, 9, 3) });
  assert.equal(p.name, 'Mia');
  assert.equal(p.avatar, 'cat');
  assert.deepEqual(p.settings, DEFAULT_SETTINGS);
  assert.notEqual(p.settings, DEFAULT_SETTINGS);
  assert.equal(p.levels.quantity.complexity, 4);
  assert.equal(p.levels.digits.durationMs, 1500);
  assert.deepEqual(p.rewards, { stars: 0, stickers: [], unlockedPages: 1 });
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
  assert.equal(p.settings.letters.case, 'upper');
  assert.equal(p.settings.timing.startMs, 1000);
  assert.equal(p.settings.timing.maxMs, 3000);
});

test('updateSettings normalizes timing so that min ≤ start ≤ max', () => {
  const p = updateSettings(mk('p1'), { timing: { startMs: 4000, minMs: 3500, maxMs: 2000 } });
  assert.deepEqual([p.settings.timing.minMs, p.settings.timing.startMs, p.settings.timing.maxMs], [2000, 3500, 3500]);
});

test('updateSettings clamps levels when the parent lowers limits', () => {
  let p = mk('p1');
  p = { ...p, levels: { ...p.levels, quantity: { ...p.levels.quantity, complexity: 11, durationMs: 300 } } };
  p = updateSettings(p, { quantity: { max: 5 }, timing: { minMs: 500 } });
  assert.equal(p.levels.quantity.complexity, 5);
  assert.equal(p.levels.quantity.durationMs, 500);
});

test('resetLevels returns to start values', () => {
  let p = mk('p1');
  p = { ...p, levels: { ...p.levels, digits: { durationMs: 300, complexity: 1, streak: 2, recent: [true] } } };
  assert.deepEqual(resetLevels(p).levels.digits, { durationMs: 1500, complexity: 0, streak: 0, recent: [] });
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
  assert.equal(updateSettings(p, { exercises: { quantity: false, digits: false, letters: false } }), p);
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
  assert.equal(p.rewards.unlockedPages, 1);
  assert.equal(p.history.length, 1);
  assert.deepEqual(p.settings.letters.known, ['A', 'B']);
  assert.ok(Object.values(p.settings.exercises).some(Boolean));
  for (const t of Object.values(p.settings.timing).filter((v) => typeof v !== 'boolean')) assert.ok(Number.isFinite(t));
  for (const [key, ex] of Object.entries(EXERCISES)) {
    const l = p.levels[key];
    for (const f of ['durationMs', 'complexity', 'streak']) assert.ok(Number.isFinite(l[f]), key + f);
    assert.ok(Array.isArray(l.recent));
    const task = ex.createTask({ durationMs: l.durationMs, complexity: l.complexity }, p.settings, Math.random, ex.prepareRound ? ex.prepareRound(Math.random) : {});
    assert.ok(task.choices.length >= 2, key);
  }
});
