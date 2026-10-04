import test from 'node:test';
import assert from 'node:assert/strict';
import { bands, SCHOOL_METRICS } from '../../js/ui/lineatur.js';

test('the middle band is the x-height, upper and lower bands follow ascender and descender', () => {
  const b = bands({ x: 0.5, asc: 0.75, desc: 0.25 }, 100);
  assert.deepEqual(b, { upper: 50, mid: 100, lower: 50, fontSize: 200 });
});

test('the Grundschrift gives roughly equal bands, as Lineatur 1 expects', () => {
  const b = bands(SCHOOL_METRICS);
  assert.ok(b.upper / b.mid > 0.7 && b.upper / b.mid < 1);
  assert.ok(b.lower / b.mid > 0.7 && b.lower / b.mid < 1);
  // a capital letter reaches exactly from the baseline to the top line
  assert.ok(Math.abs(b.fontSize * SCHOOL_METRICS.asc - (b.upper + b.mid)) < 1e-9);
});
