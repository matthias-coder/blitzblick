import test from 'node:test';
import assert from 'node:assert/strict';
import { handSvgMarkup } from '../../js/ui/hands.js';
import { fingerHands } from '../../js/exercises/quantity-layout.js';

const count = (s, re) => (s.match(re) ?? []).length;

test('handSvgMarkup raises exactly n of five fingers', () => {
  for (let n = 0; n <= 5; n++) {
    const svg = handSvgMarkup(n);
    assert.ok(svg.startsWith('<svg'));
    assert.equal(count(svg, /class="finger up"/g), n);
    assert.equal(count(svg, /class="finger (up|down)"/g), 5);
  }
});

test('fingerHands: one hand up to 5, a full first hand above', () => {
  assert.deepEqual(fingerHands(3), [3]);
  assert.deepEqual(fingerHands(5), [5]);
  assert.deepEqual(fingerHands(6), [5, 1]);
  assert.deepEqual(fingerHands(10), [5, 5]);
});
