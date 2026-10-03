import test from 'node:test';
import assert from 'node:assert/strict';
import { lastDays, summarize } from '../../js/stats.js';

const today = new Date(2026, 9, 3, 12);
const entry = (date, exercise, correct, confusions = {}) => ({ date, exercise, correct, total: 10, confusions });

test('lastDays lists seven local dates ending today', () => {
  assert.deepEqual(lastDays(today, 7), ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03']);
});

test('no history gives null accuracy and zero rounds', () => {
  const s = summarize([], 'digits', today);
  assert.equal(s.accuracy7, null);
  assert.equal(s.rounds7, 0);
  assert.equal(s.roundsByDay.length, 7);
  assert.deepEqual(s.topConfusions, []);
});

test('accuracy and rounds cover only the last 7 days and the given exercise', () => {
  const h = [
    entry('2026-09-20', 'digits', 0),
    entry('2026-10-01', 'digits', 8),
    entry('2026-10-03', 'digits', 6),
    entry('2026-10-03', 'letters', 0),
  ];
  const s = summarize(h, 'digits', today);
  assert.equal(s.accuracy7, 70);
  assert.equal(s.rounds7, 2);
  assert.equal(s.roundsByDay.find((d) => d.date === '2026-10-03').count, 1);
});

test('top confusions are summed and sorted', () => {
  const h = [
    entry('2026-10-01', 'letters', 5, { 'b>d': 2, 'M>N': 1 }),
    entry('2026-10-02', 'letters', 5, { 'b>d': 1, 'E>F': 2 }),
  ];
  assert.deepEqual(summarize(h, 'letters', today).topConfusions, [['b>d', 3], ['E>F', 2], ['M>N', 1]]);
});
