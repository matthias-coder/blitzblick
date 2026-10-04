import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY, ImportError, emptyState, migrate, parseImport, serializeExport, exportFilename,
  pruneHistory, memoryBackend, createStore,
} from '../../js/storage.js';
import { createProfile, addProfile } from '../../js/profiles.js';

const stateWith = (...names) => names.reduce(
  (s, n, i) => addProfile(s, createProfile({ name: n, avatar: 'astronaut' }, { id: `p${i + 1}` })),
  emptyState(),
);

test('load returns an empty state when nothing is stored', () => {
  assert.deepEqual(createStore(memoryBackend()).load(), emptyState());
});

test('save then load round-trips the state', () => {
  const b = memoryBackend();
  const s = stateWith('Mia');
  createStore(b).save(s);
  assert.deepEqual(createStore(b).load(), s);
});

test('export then import round-trips the state', () => {
  const s = stateWith('Mia', 'Ben');
  assert.deepEqual(parseImport(serializeExport(s)), s);
});

test('invalid JSON is rejected with a German message', () => {
  assert.throws(() => parseImport('nope'), (e) => e instanceof ImportError && /keine gültige/.test(e.message));
});

test('JSON that is not a backup is rejected', () => {
  assert.throws(() => parseImport('{"foo":1}'), ImportError);
  assert.throws(() => parseImport('{"schemaVersion":1,"profiles":[{"id":1}]}'), ImportError);
});

test('a backup from a newer version is rejected', () => {
  assert.throws(() => parseImport('{"schemaVersion":3,"profiles":[]}'), (e) => /neueren Version/.test(e.message));
});

test('migrate fills defaults and repairs an unknown active profile', () => {
  const s = stateWith('Mia');
  delete s.profiles[0].settings.speech;
  s.activeProfileId = 'gone';
  const m = migrate(s);
  assert.equal(m.profiles[0].settings.speech, 'little');
  assert.equal(m.activeProfileId, 'p1');
});

test('corrupt stored data is backed up and replaced by an empty state', () => {
  const b = memoryBackend();
  b.setItem(STORAGE_KEY, '{broken');
  const store = createStore(b);
  assert.deepEqual(store.load(), emptyState());
  assert.ok(store.warnings.includes('corrupt'));
  assert.ok(b.keys().some((k) => k.startsWith('blitzblick.corrupt-')));
});

test('an unusable backend falls back to memory and reports it', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {} };
  const store = createStore(broken);
  assert.equal(store.available, false);
  assert.ok(store.warnings.includes('unavailable'));
  const s = stateWith('Mia');
  store.save(s);
  assert.deepEqual(store.load(), s);
});

test('importText keeps a backup of the previous state', () => {
  const b = memoryBackend();
  const store = createStore(b);
  store.save(stateWith('Mia'));
  const imported = store.importText(serializeExport(stateWith('Ben')));
  assert.equal(imported.profiles[0].name, 'Ben');
  assert.equal(JSON.parse(b.getItem('blitzblick.pre-import')).profiles[0].name, 'Mia');
  assert.equal(store.load().profiles[0].name, 'Ben');
});

test('importText with an invalid file leaves the stored state untouched', () => {
  const b = memoryBackend();
  const store = createStore(b);
  store.save(stateWith('Mia'));
  assert.throws(() => store.importText('nope'), ImportError);
  assert.equal(store.load().profiles[0].name, 'Mia');
});

test('pruneHistory drops entries older than 90 days', () => {
  const s = stateWith('Mia');
  s.profiles[0].history = [
    { date: '2026-07-04', exercise: 'digits', correct: 5, total: 10, confusions: {} },
    { date: '2026-07-05', exercise: 'digits', correct: 5, total: 10, confusions: {} },
  ];
  const pruned = pruneHistory(s, new Date(2026, 9, 3));
  assert.deepEqual(pruned.profiles[0].history.map((h) => h.date), ['2026-07-05']);
});

test('exportFilename uses the local date', () => {
  assert.equal(exportFilename(new Date(2026, 9, 3, 23, 30)), 'blitzblick-backup-2026-10-03.json');
});
