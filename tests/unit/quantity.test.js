import test from 'node:test';
import assert from 'node:assert/strict';
import * as quantity from '../../js/exercises/quantity.js';
import { layoutPositions, MIN_DIST } from '../../js/exercises/quantity-layout.js';
import { mulberry32 } from '../../js/rng.js';

const S = (max = 10, layout = 'mixed') => ({ quantity: { max, layout } });
const minDistance = (pts) => {
  let m = Infinity;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.min(m, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
  return m;
};

test('mixed stages go structured then mixed for each max', () => {
  assert.deepEqual(quantity.stages(S(5, 'mixed')), [
    { max: 3, layout: 'structured' }, { max: 3, layout: 'mixed' },
    { max: 4, layout: 'structured' }, { max: 4, layout: 'mixed' },
    { max: 5, layout: 'structured' }, { max: 5, layout: 'mixed' },
  ]);
});

test('structured and random settings use a single layout', () => {
  assert.ok(quantity.stages(S(10, 'structured')).every((s) => s.layout === 'structured'));
  assert.ok(quantity.stages(S(10, 'random')).every((s) => s.layout === 'random'));
  assert.equal(quantity.stages(S(10, 'random')).length, 6);
});

test('start complexity is the first stage with max 5', () => {
  assert.equal(quantity.startComplexity(S(10, 'mixed')), 4);
  assert.equal(quantity.startComplexity(S(10, 'random')), 2);
  assert.equal(quantity.startComplexity(S(3, 'mixed')), 1);
});

test('count is within 1..max and choices are 1..max', () => {
  const s = S(10, 'mixed');
  for (let c = 0; c <= quantity.maxComplexity(s); c++) {
    const { max } = quantity.stages(s)[c];
    for (let seed = 0; seed < 100; seed++) {
      const t = quantity.createTask({ complexity: c }, s, mulberry32(seed), { object: 'apple' });
      assert.ok(t.answer >= 1 && t.answer <= max);
      assert.equal(t.stimulus.count, t.answer);
      assert.equal(t.stimulus.positions.length, t.answer);
      assert.deepEqual(t.choices, Array.from({ length: max }, (_, i) => i + 1));
      assert.equal(t.stimulus.object, 'apple');
    }
  }
});

test('structured layouts have the right count and do not overlap', () => {
  for (let n = 1; n <= 10; n++) {
    const pts = layoutPositions(n, 'structured', mulberry32(n));
    assert.equal(pts.length, n);
    if (n > 1) assert.ok(minDistance(pts) >= MIN_DIST - 1e-9, `n=${n}`);
  }
});

test('random layouts keep minimum distance and stay inside the field', () => {
  for (let seed = 0; seed < 300; seed++) {
    const pts = layoutPositions(10, 'random', mulberry32(seed));
    assert.equal(pts.length, 10);
    assert.ok(minDistance(pts) >= MIN_DIST - 1e-9);
    assert.ok(pts.every((p) => p.x >= 0.05 && p.x <= 0.95 && p.y >= 0.05 && p.y <= 0.95));
  }
});

test('prepareRound picks one of the objects', () => {
  assert.ok(quantity.OBJECTS.includes(quantity.prepareRound(mulberry32(1)).object));
});

test('texts', () => {
  assert.equal(quantity.speakPrompt(), 'Wie viele waren es?');
  assert.equal(quantity.speakSolution({ answer: 1 })[0], 'Es war einer.');
  assert.equal(quantity.speakSolution({ answer: 6 })[0], 'Es waren 6.');
  for (const v of quantity.speakSolution({ answer: 6 })) assert.ok(v.includes('6'));
});
