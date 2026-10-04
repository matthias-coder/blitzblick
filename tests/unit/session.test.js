import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUND_LENGTH, createRound, nextTask, answerTask, finishRound, abortRound } from '../../js/session.js';
import { createProfile, updateSettings } from '../../js/profiles.js';
import { mulberry32 } from '../../js/rng.js';

const profile = () => createProfile({ name: 'Mia', avatar: 'astronaut' }, { id: 'p1', now: new Date(2026, 9, 3) });

function playAll(p, exerciseId, rng, answerFn = (t) => t.answer) {
  let r = createRound(p, exerciseId, rng);
  for (let i = 0; i < ROUND_LENGTH; i++) {
    r = nextTask(r, p, rng);
    r = answerTask(r, p, answerFn(r.task, i)).round;
  }
  return r;
}

test('a round has 10 tasks and finishes on the 10th answer', () => {
  const rng = mulberry32(3);
  const p = profile();
  let r = createRound(p, 'digits', rng);
  for (let i = 0; i < 10; i++) {
    r = nextTask(r, p, rng);
    const res = answerTask(r, p, r.task.answer);
    assert.equal(res.correct, true);
    assert.equal(res.finished, i === 9);
    r = res.round;
  }
});

test('double tap: a second answer to the same task is ignored', () => {
  const rng = mulberry32(4);
  const p = profile();
  let r = nextTask(createRound(p, 'digits', rng), p, rng);
  r = answerTask(r, p, r.task.answer).round;
  const again = answerTask(r, p, r.task.answer);
  assert.equal(again.ignored, true);
  assert.equal(again.round.results.length, 1);
});

test('nextTask uses the effective duration', () => {
  const rng = mulberry32(5);
  let p = profile();
  assert.equal(nextTask(createRound(p, 'digits', rng), p, rng).durationMs, 1500);
  p = updateSettings(p, { timing: { adaptive: false, startMs: 800 } });
  assert.equal(nextTask(createRound(p, 'digits', rng), p, rng).durationMs, 800);
});

test('three correct answers make the next task faster', () => {
  const rng = mulberry32(6);
  const p = profile();
  let r = createRound(p, 'digits', rng);
  for (let i = 0; i < 3; i++) {
    r = nextTask(r, p, rng);
    r = answerTask(r, p, r.task.answer).round;
  }
  assert.equal(nextTask(r, p, rng).durationMs, 1250);
});

test('finishRound stores level, rewards and a history entry with local date and confusions', () => {
  const rng = mulberry32(7);
  const p = profile();
  const r = playAll(p, 'digits', rng, (t, i) => (i < 2 ? (t.choices.find((c) => c !== t.answer)) : t.answer));
  const { profile: next, reward } = finishRound(p, r, rng, new Date(2026, 9, 3, 23, 50));
  assert.equal(next.rewards.stars, 8);
  assert.equal(next.rewards.stickers.length, 1);
  assert.ok(reward.sticker);
  assert.deepEqual(next.levels.digits, r.level);
  const h = next.history.at(-1);
  assert.equal(h.date, '2026-10-03');
  assert.equal(h.exercise, 'digits');
  assert.equal(h.correct, 8);
  assert.equal(h.total, 10);
  assert.equal(Object.values(h.confusions).reduce((a, b) => a + b, 0), 2);
  assert.ok(Object.keys(h.confusions).every((k) => /^\d+>\d+$/.test(k)));
});

test('abortRound keeps level changes but awards nothing', () => {
  const rng = mulberry32(8);
  const p = profile();
  let r = createRound(p, 'digits', rng);
  for (let i = 0; i < 3; i++) {
    r = nextTask(r, p, rng);
    r = answerTask(r, p, r.task.answer).round;
  }
  const next = abortRound(p, r);
  assert.equal(next.levels.digits.durationMs, 1250);
  assert.equal(next.rewards.stars, 0);
  assert.equal(next.history.length, 0);
});

test('quantity rounds keep one object for the whole round', () => {
  const rng = mulberry32(9);
  const p = profile();
  let r = createRound(p, 'quantity', rng);
  const objects = new Set();
  for (let i = 0; i < 10; i++) {
    r = nextTask(r, p, rng);
    objects.add(r.task.stimulus.object);
    r = answerTask(r, p, r.task.answer).round;
  }
  assert.equal(objects.size, 1);
});

test('nextTask scales the flash duration by the task duration factor', () => {
  const p = profile();
  const top = { ...p, levels: { ...p.levels, digits: { ...p.levels.digits, complexity: 99, durationMs: 600 } } };
  const r = nextTask(createRound(top, 'digits', mulberry32(2)), top, mulberry32(2));
  assert.equal(r.task.durationFactor, 2.5);
  assert.equal(r.durationMs, 1500);
});

test('nextTask keeps the base duration for regular tasks', () => {
  const p = profile();
  const low = { ...p, levels: { ...p.levels, digits: { ...p.levels.digits, complexity: 0, durationMs: 600 } } };
  const r = nextTask(createRound(low, 'digits', mulberry32(2)), low, mulberry32(2));
  assert.equal(r.durationMs, 600);
});

test('with adaptive timing off a round stays on the top regular stage', () => {
  const p = updateSettings(profile(), { timing: { adaptive: false } });
  const rng = mulberry32(4);
  let r = createRound(p, 'digits', rng);
  for (let i = 0; i < 20; i++) { r = nextTask(r, p, rng); assert.ok(!r.task.stimulus.add); r = answerTask(r, p, r.task.answer).round; }
});

test('currentComplexity follows fixed timing like the session does', async () => {
  const { currentComplexity } = await import('../../js/session.js');
  const { EXERCISES } = await import('../../js/exercises/index.js');
  const p = updateSettings(profile(), { timing: { adaptive: false } });
  const fixed = EXERCISES.digits.fixedComplexity(p.settings);
  assert.equal(p.levels.digits.complexity < fixed, true);
  assert.equal(currentComplexity(p, 'digits'), fixed);
  const a = profile();
  assert.equal(currentComplexity(a, 'digits'), Math.min(a.levels.digits.complexity, EXERCISES.digits.maxComplexity(a.settings)));
});

test('addition mistakes are not counted as confusions', () => {
  const p = profile();
  const r = {
    exerciseId: 'digits', level: p.levels.digits,
    results: [
      { answer: '3', picked: '5', correct: false, add: true },
      { answer: '3', picked: '5', correct: false, add: false },
      { answer: '4', picked: '4', correct: true, add: false },
    ],
  };
  assert.deepEqual(finishRound(p, r, mulberry32(1)).profile.history.at(-1).confusions, { '3>5': 1 });
});

test('answerTask flags addition results', () => {
  const p = profile();
  const rng = mulberry32(2);
  const r = nextTask(createRound(p, 'digits', rng), p, rng);
  const withAdd = { ...r, task: { ...r.task, stimulus: { add: true } } };
  assert.equal(answerTask(withAdd, p, 'zzz').round.results[0].add, true);
  const plain = { ...r, task: { ...r.task, stimulus: { text: '3' } } };
  assert.equal(answerTask(plain, p, 'zzz').round.results[0].add, false);
});
