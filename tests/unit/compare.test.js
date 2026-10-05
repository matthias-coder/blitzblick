import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCounts, createCompareTask, AREA_SCALE, AREA_MAX_COUNT, COMPARE_DURATION_FACTOR } from '../../js/exercises/compare.js';
import { MIN_DIST } from '../../js/exercises/quantity-layout.js';
import { mulberry32 } from '../../js/rng.js';

const OBJECTS = ['apple', 'duck', 'ladybug', 'fish'];
const minDistance = (pts) => {
  let m = Infinity;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.min(m, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
  return m;
};

test('compareCounts stays in range and keeps the minimum difference', () => {
  for (const cfg of [{ max: 6, minDiff: 3 }, { max: 10, minDiff: 2 }, { max: 10, minDiff: 1 }]) {
    for (let seed = 0; seed < 300; seed++) {
      const { left, right } = compareCounts(mulberry32(seed), cfg);
      assert.ok(left >= 1 && left <= cfg.max && right >= 1 && right <= cfg.max);
      assert.ok(Math.abs(left - right) >= cfg.minDiff, `${left}/${right}`);
    }
  }
});

test('compareCounts gives equal counts only with equal, about a fifth of the time', () => {
  let equal = 0;
  for (let seed = 0; seed < 1000; seed++) {
    const { left, right } = compareCounts(mulberry32(seed), { max: 10, minDiff: 1, equal: true });
    if (left === right) { equal++; assert.ok(left >= 2); }
  }
  assert.ok(equal > 140 && equal < 260, String(equal));
});

test('compareCounts puts the bigger group on both sides', () => {
  const sides = new Set();
  for (let seed = 0; seed < 100; seed++) {
    const { left, right } = compareCounts(mulberry32(seed), { max: 10, minDiff: 2 });
    sides.add(left > right ? 'left' : 'right');
  }
  assert.deepEqual([...sides].sort(), ['left', 'right']);
});

test('compareCounts terminates with a constant rng', () => {
  for (const v of [0, 0.05, 0.5, 0.999]) {
    const { left, right } = compareCounts(() => v, { max: 10, minDiff: 2 });
    assert.ok(Math.abs(left - right) >= 2);
  }
});

test('createCompareTask: different objects, matching answer and choices', () => {
  for (let seed = 0; seed < 200; seed++) {
    const t = createCompareTask(mulberry32(seed), { max: 10, minDiff: 1, equal: true }, OBJECTS, 'duck');
    const st = t.stimulus;
    assert.equal(t.exercise, 'quantity');
    assert.ok(st.compare);
    assert.notEqual(st.objectLeft, st.objectRight);
    assert.ok([st.objectLeft, st.objectRight].includes('duck'));
    assert.equal(st.positionsLeft.length, st.left);
    assert.equal(st.positionsRight.length, st.right);
    assert.equal(t.answer, st.left === st.right ? 'equal' : st.left > st.right ? 'left' : 'right');
    assert.deepEqual(t.choices, ['left', 'equal', 'right']);
    assert.equal(t.durationFactor, COMPARE_DURATION_FACTOR);
  }
  const plain = createCompareTask(mulberry32(1), { max: 6, minDiff: 3 }, OBJECTS, 'duck');
  assert.deepEqual(plain.choices, ['left', 'right']);
  assert.notEqual(plain.answer, 'equal');
});

test('createCompareTask without area keeps scale 1', () => {
  for (let seed = 0; seed < 50; seed++) {
    const st = createCompareTask(mulberry32(seed), { max: 10, minDiff: 1 }, OBJECTS, 'duck').stimulus;
    assert.equal(st.scaleLeft, 1);
    assert.equal(st.scaleRight, 1);
  }
});

test('area enlarges the smaller group (up to 6) and spaces it out', () => {
  let enlarged = 0;
  for (let seed = 0; seed < 300; seed++) {
    const st = createCompareTask(mulberry32(seed), { max: 10, minDiff: 1, equal: true, area: true }, OBJECTS, 'duck').stimulus;
    const small = Math.min(st.left, st.right);
    const scaled = [st.scaleLeft, st.scaleRight].filter((s) => s === AREA_SCALE).length;
    if (small > AREA_MAX_COUNT) { assert.equal(scaled, 0); continue; }
    assert.equal(scaled, 1);
    enlarged++;
    if (st.left !== st.right) assert.equal(st.left < st.right ? st.scaleLeft : st.scaleRight, AREA_SCALE);
    const pts = st.scaleLeft === AREA_SCALE ? st.positionsLeft : st.positionsRight;
    assert.ok(minDistance(pts) >= MIN_DIST * AREA_SCALE - 1e-9);
  }
  assert.ok(enlarged > 50);
});
