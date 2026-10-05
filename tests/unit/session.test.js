import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUND_LENGTH, createRound, nextTask, answerTask, finishRound, abortRound, replayTask, demoTask, DEMO_MS } from '../../js/session.js';
import { createProfile, updateSettings, setGrade, setLevel } from '../../js/profiles.js';
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

test('a round has 5 tasks and finishes on the 5th answer', () => {
  assert.equal(ROUND_LENGTH, 5);
  const rng = mulberry32(3);
  const p = profile();
  let r = createRound(p, 'digits', rng);
  for (let i = 0; i < 5; i++) {
    r = nextTask(r, p, rng);
    const res = answerTask(r, p, r.task.answer);
    assert.equal(res.correct, true);
    assert.equal(res.finished, i === 4);
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
  assert.equal(nextTask(createRound(p, 'digits', rng), p, rng).durationMs, 2000);
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
  assert.equal(nextTask(r, p, rng).durationMs, 1700);
});

test('finishRound stores level, rewards and a history entry with local date and confusions', () => {
  const rng = mulberry32(7);
  const p = profile();
  const r = playAll(p, 'digits', rng, (t, i) => (i < 1 ? (t.choices.find((c) => c !== t.answer)) : t.answer));
  const { profile: next, reward } = finishRound(p, r, rng, new Date(2026, 9, 3, 23, 50));
  assert.equal(next.rewards.stars, 4);
  assert.equal(next.rewards.stickers.length, 0); // stickers are traded in the album now
  assert.equal(reward.sticker, null);
  assert.equal(reward.levelUp, null);
  assert.deepEqual(next.levels.digits, r.level);
  const h = next.history.at(-1);
  assert.equal(h.date, '2026-10-03');
  assert.equal(h.exercise, 'digits');
  assert.equal(h.correct, 4);
  assert.equal(h.total, 5);
  assert.equal(Object.values(h.confusions).reduce((a, b) => a + b, 0), 1);
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
  assert.equal(next.levels.digits.durationMs, 1700);
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
  const p = setLevel(setGrade(profile(), 'g1'), 'digits', 2);
  const top = { ...p, levels: { ...p.levels, digits: { ...p.levels.digits, durationMs: 600 } } };
  const r = nextTask(createRound(top, 'digits', mulberry32(2)), top, mulberry32(2));
  assert.equal(r.task.durationFactor, 2.5);
  assert.equal(r.durationMs, 1500);
});

test('nextTask keeps the base duration for regular tasks', () => {
  const p = profile();
  const low = { ...p, levels: { ...p.levels, digits: { ...p.levels.digits, durationMs: 600 } } };
  const r = nextTask(createRound(low, 'digits', mulberry32(2)), low, mulberry32(2));
  assert.equal(r.durationMs, 600);
});

test('with fixed display duration the level set by the parents is played, on its last step', () => {
  const p = updateSettings(setLevel(setGrade(profile(), 'g1'), 'quantity', 0), { timing: { adaptive: false } });
  const rng = mulberry32(4);
  let r = createRound(p, 'quantity', rng);
  const counts = new Set();
  for (let i = 0; i < 40; i++) {
    r = nextTask(r, p, rng);
    if (!r.task.stimulus.compare) {
      assert.ok(!r.task.stimulus.add);
      assert.deepEqual(r.task.choices.length, 10); // last step of "bis 10 mit Muster"
      counts.add(r.task.answer);
    }
    r = answerTask(r, p, r.task.answer).round;
  }
  assert.equal(r.level.level, 0);
  assert.equal(r.level.mastered, false);
});

test('currentLevel reports level, step and label like the session uses them', async () => {
  const { currentLevel } = await import('../../js/session.js');
  const p = setLevel(profile(), 'quantity', 1);
  assert.deepEqual(currentLevel(p, 'quantity'), { level: 1, played: 1, step: 0, steps: 2, durationMs: 2000, label: 'bis 5 mit Muster', mastered: false });
  const fixed = updateSettings(p, { timing: { adaptive: false, startMs: 900 } });
  assert.equal(currentLevel(fixed, 'quantity').step, 1);
  assert.equal(currentLevel(fixed, 'quantity').durationMs, 900);
});

const master = (p, ex) => ({ ...p, levels: { ...p.levels, [ex]: { ...p.levels[ex], durationMs: p.settings.timing.minMs, step: 99 } } });

test('a mastered level moves up at the end of the round, opens the next page and starts fresh', () => {
  const rng = mulberry32(12);
  const p = master(profile(), 'digits');
  const r = playAll(p, 'digits', rng);
  assert.equal(r.level.mastered, true);
  assert.equal(r.level.level, 0); // not during the round
  const { profile: next, reward } = finishRound(p, r, rng);
  assert.deepEqual(reward.levelUp, { from: 0, to: 1 });
  assert.deepEqual(next.levels.digits, { level: 1, step: 0, durationMs: 2000, streak: 0, recent: [], mastered: false });
  assert.equal(next.rewards.reached.digits, 1);
  assert.deepEqual(reward.newlyUnlockedPages, ['vehicles']);
});

test('"Level festhalten" keeps a mastered level', () => {
  const rng = mulberry32(13);
  const p = master(updateSettings(profile(), { hold: { digits: true } }), 'digits');
  const { profile: next, reward } = finishRound(p, playAll(p, 'digits', rng), rng);
  assert.equal(reward.levelUp, null);
  assert.equal(next.levels.digits.level, 0);
});

test('level 4 is the top: no level-up beyond it, no grade change', () => {
  const rng = mulberry32(14);
  const p = master(setLevel(profile(), 'digits', 3), 'digits');
  const { profile: next, reward } = finishRound(p, playAll(p, 'digits', rng), rng);
  assert.equal(reward.levelUp, null);
  assert.equal(next.levels.digits.level, 3);
  assert.equal(next.levels.digits.mastered, true);
  assert.equal(next.settings.grade, 'pre');
});

test('an unplayable level falls back to the highest playable one below and does not climb', () => {
  const rng = mulberry32(15);
  // A, M, O: only two open words, so syllables level 3 (open words) is not playable → level 2 (syllables, 4 answers)
  const p = master(setLevel(profile(), 'syllables', 2), 'syllables');
  const r = playAll(p, 'syllables', rng);
  assert.equal(r.played, 1);
  assert.equal(r.task.kind, 'syllable');
  const { reward } = finishRound(p, r, rng);
  assert.equal(reward.levelUp, null);
});

test('addition mistakes are not counted as confusions', () => {
  const p = profile();
  const r = {
    exerciseId: 'digits', level: p.levels.digits,
    results: [
      { answer: '3', picked: '5', correct: false, noConfusion: true },
      { answer: '3', picked: '5', correct: false, noConfusion: false },
      { answer: '4', picked: '4', correct: true, noConfusion: false },
    ],
  };
  assert.deepEqual(finishRound(p, r, mulberry32(1)).profile.history.at(-1).confusions, { '3>5': 1 });
});

test('answerTask flags addition results', () => {
  const p = profile();
  const rng = mulberry32(2);
  const r = nextTask(createRound(p, 'digits', rng), p, rng);
  const withAdd = { ...r, task: { ...r.task, stimulus: { add: true } } };
  assert.equal(answerTask(withAdd, p, 'zzz').round.results[0].noConfusion, true);
  const plain = { ...r, task: { ...r.task, stimulus: { text: '3' } } };
  assert.equal(answerTask(plain, p, 'zzz').round.results[0].noConfusion, false);
});

test('the first time a level is reached in a round the child gets its pack price as stars', () => {
  const rng = mulberry32(12);
  const p = master(profile(), 'digits');
  const r = playAll(p, 'digits', rng);
  const { profile: after, reward } = finishRound(p, r, rng);
  assert.equal(reward.levelUp.to, 1);
  assert.equal(reward.gift, 15);
  assert.equal(after.rewards.stars, p.rewards.stars + r.results.filter((x) => x.correct).length + 15);
});

test('no gift for an already reached level', () => {
  const rng = mulberry32(12);
  const m = master(profile(), 'digits');
  const p = { ...m, rewards: { ...m.rewards, reached: { ...m.rewards.reached, digits: 1 } } };
  const { reward } = finishRound(p, playAll(p, 'digits', rng), rng);
  assert.equal(reward.levelUp.to, 1);
  assert.equal(reward.gift, 0);
});

test('createRound hands the played level to prepareRound', () => {
  const p = setLevel(setGrade(profile(), 'g1'), 'quantity', 0);
  const r = createRound(p, 'quantity', mulberry32(3));
  assert.deepEqual(r.ctx.compare, { max: 10, minDiff: 2 });
});

test('compare answers are marked noConfusion', () => {
  const p = setLevel(setGrade(profile(), 'g1'), 'quantity', 0);
  const rng = mulberry32(5);
  let r = createRound(p, 'quantity', rng);
  let seen = false;
  for (let i = 0; i < 30 && !seen; i++) {
    r = nextTask(r, p, rng);
    const compare = Boolean(r.task.stimulus.compare);
    r = answerTask(r, p, compare ? 'equal' : r.task.answer).round;
    const last = r.results.at(-1);
    assert.equal(last.noConfusion, compare);
    seen = compare;
  }
  assert.ok(seen);
});

test('a correct answer after a replay earns the star but is neutral for the adaptive engine', () => {
  const rng = mulberry32(5);
  const p = profile();
  let r = nextTask(createRound(p, 'digits', rng), p, rng);
  r = answerTask(r, p, r.task.answer).round; // streak 1
  r = nextTask(r, p, rng);
  assert.equal(r.replayed, false);
  const before = r.level;
  r = replayTask(r);
  assert.equal(r.replayed, true);
  const res = answerTask(r, p, r.task.answer);
  assert.equal(res.correct, true);
  assert.equal(res.round.results.at(-1).correct, true);
  assert.equal(res.round.level.streak, before.streak);
  assert.deepEqual(res.round.level.recent, before.recent);
});

test('a wrong answer after a replay counts as usual', () => {
  const rng = mulberry32(6);
  const p = profile();
  let r = nextTask(createRound(p, 'digits', rng), p, rng);
  const wrong = r.task.choices.find((c) => c !== r.task.answer);
  const plain = answerTask(r, p, wrong).round.level;
  const replayed = answerTask(replayTask(r), p, wrong).round.level;
  assert.deepEqual(replayed, plain);
});

test('replay works once per task and only while an answer is awaited', () => {
  const rng = mulberry32(7);
  const p = profile();
  const fresh = createRound(p, 'digits', rng);
  assert.equal(replayTask(fresh), fresh); // no task yet
  let r = replayTask(nextTask(fresh, p, rng));
  assert.equal(replayTask(r), r); // second replay: unchanged
  r = answerTask(r, p, r.task.answer).round;
  assert.equal(replayTask(r).awaiting, false);
  assert.equal(nextTask(r, p, rng).replayed, false);
});

test('demoTask gives a slow task and leaves the round untouched', () => {
  const rng = mulberry32(8);
  const p = profile();
  const r = createRound(p, 'quantity', rng);
  const snapshot = structuredClone(r);
  const demo = demoTask(r, p, rng);
  assert.equal(DEMO_MS, 3000);
  assert.equal(demo.durationMs, DEMO_MS);
  assert.ok(demo.task.choices.includes(demo.task.answer));
  assert.deepEqual(r, snapshot);
});
