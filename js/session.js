import { EXERCISES } from './exercises/index.js';
import { recordResult, effectiveLevel, advanceLevel } from './adaptive.js';
import { applyRoundRewards, PACK_PRICE } from './rewards.js';
import { playableLevel, levelAvailable, ladderOf, LEVEL_COUNT } from './levels.js';
import { localDate } from './util.js';

export const ROUND_LENGTH = 5;

export function createRound(profile, exerciseId, rng) {
  const ex = EXERCISES[exerciseId];
  const level = profile.levels[exerciseId];
  const played = playableLevel(exerciseId, profile.settings, level.level);
  return {
    exerciseId,
    level,
    played,
    ctx: ex.prepareRound ? ex.prepareRound(rng, ladderOf(exerciseId, profile.settings)[played]) : {},
    results: [],
    task: null,
    durationMs: null,
    awaiting: false,
  };
}

// what a round on this level would actually use right now
function effectiveFor(profile, exerciseId, state, played) {
  const steps = ladderOf(exerciseId, profile.settings)[played].steps;
  const eff = effectiveLevel(state, profile.settings.timing, steps.length - 1);
  return { ...eff, steps, stepDef: steps[eff.step] };
}

// for the parent area: the level being played, its step and the display duration
export function currentLevel(profile, exerciseId) {
  const state = profile.levels[exerciseId];
  const played = playableLevel(exerciseId, profile.settings, state.level);
  const eff = effectiveFor(profile, exerciseId, state, played);
  return {
    level: state.level, played, step: eff.step, steps: eff.steps.length, durationMs: eff.durationMs,
    label: ladderOf(exerciseId, profile.settings)[played].label, mastered: state.mastered,
  };
}

export function nextTask(round, profile, rng) {
  const ex = EXERCISES[round.exerciseId];
  const eff = effectiveFor(profile, round.exerciseId, round.level, round.played);
  const task = ex.createTask(eff.stepDef, profile.settings, rng, round.ctx);
  return { ...round, task, durationMs: Math.round(eff.durationMs * (task.durationFactor ?? 1)), awaiting: true };
}

export function answerTask(round, profile, picked) {
  if (!round.awaiting) return { round, ignored: true };
  const correct = picked === round.task.answer;
  const steps = ladderOf(round.exerciseId, profile.settings)[round.played].steps;
  const level = recordResult(round.level, correct, profile.settings.timing, steps.length - 1);
  const st = round.task.stimulus;
  const results = [...round.results, { answer: round.task.answer, picked, correct, noConfusion: Boolean(st?.add || st?.compare) }];
  return { round: { ...round, level, results, awaiting: false }, correct, finished: results.length >= ROUND_LENGTH };
}

// a mastered level moves up at the end of the round, unless the parents hold it
function levelUp(profile, round) {
  const s = profile.settings;
  const l = round.level;
  const next = l.level + 1;
  if (!l.mastered || s.hold[round.exerciseId] || round.played !== l.level) return null;
  if (next >= LEVEL_COUNT || !levelAvailable(round.exerciseId, s, next)) return null;
  return { from: l.level, to: next };
}

export function finishRound(profile, round, rng, now = new Date()) {
  const correct = round.results.filter((r) => r.correct).length;
  const confusions = {};
  for (const r of round.results) {
    if (r.correct || r.noConfusion) continue; // arithmetic and compare mistakes are not letter/digit confusions
    const key = `${r.answer}>${r.picked}`;
    confusions[key] = (confusions[key] ?? 0) + 1;
  }
  const up = levelUp(profile, round);
  const level = up ? advanceLevel(round.level, profile.settings.timing) : round.level;
  const id = round.exerciseId;
  const reached = { ...profile.rewards.reached, [id]: Math.max(profile.rewards.reached[id] ?? 0, level.level) };
  // level gift: the first time an exercise reaches a level in a round, one pack of that level's page is free
  const gift = up && up.to > (profile.rewards.reached[id] ?? 0) ? PACK_PRICE[up.to] : 0;
  const reward = applyRoundRewards(profile.rewards, correct, rng, { reached, today: localDate(now) });
  const rewards = gift ? { ...reward.rewards, stars: reward.rewards.stars + gift } : reward.rewards;
  return {
    profile: {
      ...profile,
      levels: { ...profile.levels, [id]: level },
      rewards,
      history: [...profile.history, { date: localDate(now), exercise: id, correct, total: round.results.length, confusions }],
    },
    reward: { ...reward, rewards, levelUp: up, gift },
  };
}

export function abortRound(profile, round) {
  return { ...profile, levels: { ...profile.levels, [round.exerciseId]: round.level } };
}
