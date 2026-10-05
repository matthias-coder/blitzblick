import test from 'node:test';
import assert from 'node:assert/strict';
import { initialLevel, clampLevel, effectiveLevel, recordResult, advanceLevel } from '../../js/adaptive.js';
import { mulberry32 } from '../../js/rng.js';

const T = { startMs: 1500, minMs: 300, maxMs: 3000, adaptive: true };
const lvl = (o = {}) => ({ level: 1, step: 1, durationMs: 1500, streak: 0, recent: [], mastered: false, ...o });
const run = (state, results, maxStep = 2, t = T) => results.reduce((l, r) => recordResult(l, r, t, maxStep), state);

test('initialLevel starts a level at step 1 with startMs', () => {
  assert.deepEqual(initialLevel(T, 2), { level: 2, step: 0, durationMs: 1500, streak: 0, recent: [], mastered: false });
  assert.equal(initialLevel(T).level, 0);
});

test('two correct answers only raise the streak', () => {
  const l = run(lvl(), [true, true]);
  assert.equal(l.durationMs, 1500);
  assert.equal(l.streak, 2);
});

test('three correct in a row shorten duration by 15 % floored to 50 ms and reset counters', () => {
  const l = run(lvl(), [true, true, true]);
  assert.equal(l.durationMs, 1250);
  assert.equal(l.step, 1);
  assert.equal(l.streak, 0);
  assert.deepEqual(l.recent, []);
});

test('duration never drops below minMs', () => {
  assert.equal(run(lvl({ durationMs: 320 }), [true, true, true]).durationMs, 300);
});

test('at minMs, harder moves to the next step and sets duration to 2 × minMs', () => {
  const l = run(lvl({ durationMs: 300 }), [true, true, true]);
  assert.equal(l.step, 2);
  assert.equal(l.durationMs, 600);
  assert.equal(l.mastered, false);
});

test('at minMs on the top step the level is mastered; level and step stay', () => {
  const l = run(lvl({ durationMs: 300, step: 2 }), [true, true, true]);
  assert.equal(l.mastered, true);
  assert.equal(l.level, 1);
  assert.equal(l.step, 2);
  assert.equal(l.durationMs, 300);
});

test('two errors in the last three lengthen duration by 20 % ceiled to 50 ms', () => {
  const l = run(lvl(), [false, true, false]);
  assert.equal(l.durationMs, 1800);
  assert.equal(l.step, 1);
});

test('duration never exceeds maxMs', () => {
  assert.equal(run(lvl({ durationMs: 2900 }), [false, false]).durationMs, 3000);
});

test('at maxMs, easier goes back one step and sets duration to maxMs / 2', () => {
  const l = run(lvl({ durationMs: 3000 }), [false, false]);
  assert.equal(l.step, 0);
  assert.equal(l.durationMs, 1500);
});

test('at maxMs on step 1 nothing gets easier: the automatic never leaves the level downwards', () => {
  const l = run(lvl({ durationMs: 3000, step: 0 }), [false, false, false, false]);
  assert.equal(l.level, 1);
  assert.equal(l.step, 0);
  assert.equal(l.durationMs, 3000);
});

test('a single error resets the streak without adjusting', () => {
  const l = run(lvl(), [true, true, false]);
  assert.equal(l.streak, 0);
  assert.equal(l.durationMs, 1500);
});

test('duration and step never move in the same direction in one answer', () => {
  const rng = mulberry32(7);
  let l = lvl();
  for (let i = 0; i < 2000; i++) {
    const next = recordResult(l, rng() < 0.7, T, 2);
    assert.ok(!(next.durationMs < l.durationMs && next.step > l.step), 'both harder');
    assert.ok(!(next.durationMs > l.durationMs && next.step < l.step), 'both easier');
    assert.equal(next.level, 1);
    l = next;
  }
});

test('with adaptive off, results never change duration, step or mastery', () => {
  const t = { ...T, adaptive: false };
  const l = run(lvl({ durationMs: 300, step: 2 }), [true, true, true, true, false, false], 2, t);
  assert.equal(l.durationMs, 300);
  assert.equal(l.step, 2);
  assert.equal(l.mastered, false);
});

test('effectiveLevel with adaptive off uses startMs and the last step of the level', () => {
  assert.deepEqual(effectiveLevel(lvl({ durationMs: 400, step: 0 }), { ...T, startMs: 900, adaptive: false }, 2), { durationMs: 900, step: 2 });
});

test('effectiveLevel with adaptive on returns the clamped state', () => {
  assert.deepEqual(effectiveLevel(lvl({ durationMs: 100, step: 9 }), T, 2), { durationMs: 300, step: 2 });
});

test('clampLevel pulls a state into lowered parent limits', () => {
  const l = clampLevel(lvl({ durationMs: 200, step: 9 }), T, 0);
  assert.equal(l.durationMs, 300);
  assert.equal(l.step, 0);
});

test('recordResult clamps an out-of-range step first', () => {
  assert.equal(recordResult(lvl({ step: 9 }), true, T, 1).step, 1);
});

test('advanceLevel starts the next level fresh', () => {
  assert.deepEqual(advanceLevel(lvl({ mastered: true, durationMs: 300, step: 2 }), T), initialLevel(T, 2));
});

test('a neutral correct answer changes nothing, a neutral wrong one counts', () => {
  const timing = { startMs: 2000, minMs: 400, maxMs: 3500, adaptive: true };
  let s = initialLevel(timing);
  for (let i = 0; i < 5; i++) s = recordResult(s, true, timing, 0, { neutral: true });
  assert.equal(s.durationMs, 2000);
  assert.equal(s.streak, 0);
  assert.deepEqual(s.recent, []);
  const a = recordResult(initialLevel(timing), false, timing, 0, { neutral: true });
  const b = recordResult(initialLevel(timing), false, timing, 0);
  assert.deepEqual(a, b);
});
