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
