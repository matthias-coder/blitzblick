import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, SCHEMA_VERSION } from '../../js/storage.js';

// a profile as 1.6.x stored it
function v1(settings = {}, levels = {}, rewards = { stars: 120, stickers: ['animals/lion', 'sea/fish'], unlockedPages: 3 }) {
  return {
    id: 'a', name: 'Mia', avatar: 'cat', createdAt: '2026-10-01T00:00:00.000Z',
    settings: {
      exercises: { quantity: true, digits: true, letters: true, syllables: true },
      timing: { startMs: 1500, minMs: 300, maxMs: 3000, adaptive: true },
      quantity: { max: 10, layout: 'mixed', addition: true },
      digits: { range: 9, addition: true },
      letters: { known: ['A', 'M', 'O'], case: 'upper', speak: 'sound' },
      syllables: { colors: true, custom: [] },
      speech: 'little', sounds: true,
      ...settings,
    },
    levels: {
      quantity: { durationMs: 1500, complexity: 4, streak: 0, recent: [] },
      digits: { durationMs: 1500, complexity: 0, streak: 0, recent: [] },
      letters: { durationMs: 1500, complexity: 0, streak: 0, recent: [] },
      syllables: { durationMs: 1500, complexity: 0, streak: 0, recent: [] },
      ...levels,
    },
    rewards,
    history: [],
  };
}
const up = (p) => migrate({ schemaVersion: 1, activeProfileId: 'a', profiles: [p] }).profiles[0];
const where = (p) => Object.fromEntries(Object.entries(p.levels).map(([k, l]) => [k, [l.level, l.step]]));

test('the schema version is 2', () => assert.equal(SCHEMA_VERSION, 2));

test('a 1.6 default profile (bis 5, capitals, syllables) becomes Vorschule at comparable levels', () => {
  const p = up(v1());
  assert.equal(p.settings.grade, 'pre');
  assert.deepEqual(where(p), { quantity: [1, 1], digits: [1, 0], letters: [1, 0], syllables: [1, 0] });
  assert.deepEqual(p.rewards.reached, { quantity: 1, digits: 1, letters: 1, syllables: 1 });
});

test('old settings are dropped, own timing, stars and stickers are kept', () => {
  const p = up(v1({ timing: { startMs: 1200, minMs: 250, maxMs: 2800, adaptive: true } }));
  assert.equal(p.settings.quantity, undefined);
  assert.equal(p.settings.digits, undefined);
  assert.equal(p.settings.letters.case, undefined);
  assert.deepEqual(p.settings.timing, { startMs: 1200, minMs: 250, maxMs: 2800, adaptive: true });
  assert.equal(p.rewards.stars, 120);
  assert.deepEqual(p.rewards.stickers, ['animals/lion', 'sea/fish']);
  assert.equal('unlockedPages' in p.rewards, false);
  assert.equal(p.levels.quantity.durationMs, 1500);
});

test('Plus, 0–20, small letters or words make it Klasse 1', () => {
  assert.equal(up(v1({}, { digits: { durationMs: 900, complexity: 3, streak: 0, recent: [] } })).settings.grade, 'g1'); // Plus bis 10
  assert.equal(up(v1({ digits: { range: 20, addition: false } }, { digits: { durationMs: 900, complexity: 3, streak: 0, recent: [] } })).settings.grade, 'g1');
  assert.equal(up(v1({ letters: { known: ['A', 'M', 'O'], case: 'lower' } })).settings.grade, 'g1');
  assert.equal(up(v1({ letters: { known: [...'AMOLENI'], case: 'upper' } }, { syllables: { durationMs: 900, complexity: 2, streak: 0, recent: [] } })).settings.grade, 'g1');
});

test('Klasse 1 mapping keeps the old difficulty', () => {
  const p = up(v1(
    { digits: { range: 20, addition: true }, letters: { known: [...'AMOLENI'], case: 'both' } },
    {
      quantity: { durationMs: 700, complexity: 13, streak: 0, recent: [] }, // Plus bis 10
      digits: { durationMs: 700, complexity: 3, streak: 0, recent: [] }, // 0–20
      letters: { durationMs: 700, complexity: 2, streak: 0, recent: [] }, // mixed
      syllables: { durationMs: 700, complexity: 1, streak: 0, recent: [] },
    },
  ));
  assert.equal(p.settings.grade, 'g1');
  assert.deepEqual(where(p), { quantity: [2, 1], digits: [1, 0], letters: [2, 0], syllables: [1, 0] });
  assert.equal(p.levels.digits.durationMs, 700);
});

test('fixed display duration maps the stage the old app really used', () => {
  // fixed: quantity used the top regular stage (bis 10 gemischt), digits the top range (0–9),
  // syllables the top of the pool (Mama, Oma → words), which makes it Klasse 1
  const p = up(v1({ timing: { startMs: 1500, minMs: 300, maxMs: 3000, adaptive: false } }));
  assert.equal(p.settings.grade, 'g1');
  assert.deepEqual(where(p), { quantity: [1, 1], digits: [0, 0], letters: [0, 0], syllables: [1, 0] });
  const pre = up(v1({ timing: { startMs: 1500, minMs: 300, maxMs: 3000, adaptive: false }, quantity: { max: 6, layout: 'structured', addition: false }, letters: { known: ['B', 'I'], case: 'upper' } }));
  assert.equal(pre.settings.grade, 'pre');
  assert.deepEqual(where(pre).quantity, [2, 1]);
});

test('broken v1 data still migrates to a valid profile', () => {
  const raw = v1({ quantity: 'x', digits: null, letters: { known: 'AM', case: 7 }, timing: null }, { quantity: null, digits: { complexity: 'x' } }, {});
  const p = up(raw);
  assert.ok(['pre', 'g1'].includes(p.settings.grade));
  for (const l of Object.values(p.levels)) for (const f of ['level', 'step', 'durationMs']) assert.ok(Number.isFinite(l[f]));
  assert.deepEqual(p.rewards.stickers, []);
});
