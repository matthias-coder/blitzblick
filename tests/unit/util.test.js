import test from 'node:test';
import assert from 'node:assert/strict';
import { localDate, formatSeconds } from '../../js/util.js';

test('localDate formats the local calendar date', () => {
  assert.equal(localDate(new Date(2026, 0, 5, 12, 0)), '2026-01-05');
});

test('localDate uses the local date late in the evening (not UTC)', () => {
  assert.equal(localDate(new Date(2026, 9, 3, 23, 59)), '2026-10-03');
  assert.equal(localDate(new Date(2026, 9, 4, 0, 1)), '2026-10-04');
});

test('formatSeconds shows seconds with a German decimal comma', () => {
  assert.equal(formatSeconds(450), '0,45 s');
  assert.equal(formatSeconds(100), '0,1 s');
  assert.equal(formatSeconds(1000), '1 s');
  assert.equal(formatSeconds(1500), '1,5 s');
  assert.equal(formatSeconds(2875), '2,88 s');
});
