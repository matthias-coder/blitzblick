import test from 'node:test';
import assert from 'node:assert/strict';
import { initialLevel, clampLevel, effectiveLevel, recordResult } from '../../js/adaptive.js';
import { mulberry32 } from '../../js/rng.js';

const T = { startMs: 1500, minMs: 300, maxMs: 3000, adaptive: true };
const lvl = (o = {}) => ({ durationMs: 1500, complexity: 2, streak: 0, recent: [], ...o });
const run = (level, results, maxC = 5, t = T) => results.reduce((l, r) => recordResult(l, r, t, maxC), level);

test('initialLevel uses startMs and the given complexity', () => {
  assert.deepEqual(initialLevel(T, 4), { durationMs: 1500, complexity: 4, streak: 0, recent: [] });
});

test('two correct answers only raise the streak', () => {
  const l = run(lvl(), [true, true]);
  assert.equal(l.durationMs, 1500);
  assert.equal(l.streak, 2);
});

test('three correct in a row shorten duration by 15 % floored to 50 ms and reset counters', () => {
  const l = run(lvl(), [true, true, true]);
  assert.equal(l.durationMs, 1250);
  assert.equal(l.complexity, 2);
  assert.equal(l.streak, 0);
  assert.deepEqual(l.recent, []);
});

test('duration never drops below minMs', () => {
  assert.equal(run(lvl({ durationMs: 320 }), [true, true, true]).durationMs, 300);
});

test('at minMs, harder raises complexity and sets duration to 2 × minMs', () => {
  const l = run(lvl({ durationMs: 300 }), [true, true, true]);
  assert.equal(l.complexity, 3);
  assert.equal(l.durationMs, 600);
});

test('at minMs and max complexity nothing gets harder', () => {
  const l = run(lvl({ durationMs: 300, complexity: 5 }), [true, true, true]);
  assert.equal(l.complexity, 5);
  assert.equal(l.durationMs, 300);
});

test('two errors in the last three lengthen duration by 20 % ceiled to 50 ms', () => {
  const l = run(lvl(), [false, true, false]);
  assert.equal(l.durationMs, 1800);
  assert.equal(l.complexity, 2);
});

test('duration never exceeds maxMs', () => {
  assert.equal(run(lvl({ durationMs: 2900 }), [false, false]).durationMs, 3000);
});

test('at maxMs, easier lowers complexity and sets duration to maxMs / 2', () => {
  const l = run(lvl({ durationMs: 3000 }), [false, false]);
  assert.equal(l.complexity, 1);
  assert.equal(l.durationMs, 1500);
});

test('at maxMs and complexity 0 nothing gets easier', () => {
  const l = run(lvl({ durationMs: 3000, complexity: 0 }), [false, false]);
  assert.equal(l.complexity, 0);
  assert.equal(l.durationMs, 3000);
});

test('a single error resets the streak without adjusting', () => {
  const l = run(lvl(), [true, true, false]);
  assert.equal(l.streak, 0);
  assert.equal(l.durationMs, 1500);
});

test('duration and complexity never move in the same direction in one step', () => {
  const rng = mulberry32(7);
  let l = lvl();
  for (let i = 0; i < 2000; i++) {
    const next = recordResult(l, rng() < 0.7, T, 5);
    assert.ok(!(next.durationMs < l.durationMs && next.complexity > l.complexity), 'both harder');
    assert.ok(!(next.durationMs > l.durationMs && next.complexity < l.complexity), 'both easier');
    l = next;
  }
});

test('with adaptive off, results never change duration or complexity', () => {
  const t = { ...T, adaptive: false };
  const l = run(lvl(), [true, true, true, false, false, false], 5, t);
  assert.equal(l.durationMs, 1500);
  assert.equal(l.complexity, 2);
});

test('effectiveLevel with adaptive off uses startMs and max complexity', () => {
  assert.deepEqual(effectiveLevel(lvl({ durationMs: 400 }), { ...T, startMs: 900, adaptive: false }, 4), { durationMs: 900, complexity: 4 });
});

test('effectiveLevel with adaptive on returns the clamped level', () => {
  assert.deepEqual(effectiveLevel(lvl({ durationMs: 100, complexity: 9 }), T, 4), { durationMs: 300, complexity: 4 });
});

test('clampLevel pulls a level into lowered parent limits', () => {
  const l = clampLevel(lvl({ durationMs: 200, complexity: 9 }), T, 3);
  assert.equal(l.durationMs, 300);
  assert.equal(l.complexity, 3);
});

test('recordResult clamps an out-of-range level first', () => {
  assert.equal(recordResult(lvl({ complexity: 9 }), true, T, 3).complexity, 3);
});
