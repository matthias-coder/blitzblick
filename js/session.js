import { EXERCISES } from './exercises/index.js';
import { recordResult, effectiveLevel } from './adaptive.js';
import { applyRoundRewards } from './rewards.js';
import { localDate } from './util.js';

export const ROUND_LENGTH = 10;

export function createRound(profile, exerciseId, rng) {
  const ex = EXERCISES[exerciseId];
  return {
    exerciseId,
    level: profile.levels[exerciseId],
    ctx: ex.prepareRound ? ex.prepareRound(rng) : {},
    results: [],
    task: null,
    durationMs: null,
    awaiting: false,
  };
}

// what a round would actually use right now (fixed timing pins the complexity)
function effectiveFor(profile, exerciseId, level) {
  const ex = EXERCISES[exerciseId];
  const s = profile.settings;
  const maxC = ex.maxComplexity(s);
  return effectiveLevel(level, s.timing, maxC, ex.fixedComplexity ? ex.fixedComplexity(s) : maxC);
}

export const currentComplexity = (profile, exerciseId) => effectiveFor(profile, exerciseId, profile.levels[exerciseId]).complexity;

export function nextTask(round, profile, rng) {
  const ex = EXERCISES[round.exerciseId];
  const s = profile.settings;
  const eff = effectiveFor(profile, round.exerciseId, round.level);
  const task = ex.createTask({ ...round.level, complexity: eff.complexity }, s, rng, round.ctx);
  return { ...round, task, durationMs: Math.round(eff.durationMs * (task.durationFactor ?? 1)), awaiting: true };
}

export function answerTask(round, profile, picked) {
  if (!round.awaiting) return { round, ignored: true };
  const ex = EXERCISES[round.exerciseId];
  const correct = picked === round.task.answer;
  const level = recordResult(round.level, correct, profile.settings.timing, ex.maxComplexity(profile.settings));
  const results = [...round.results, { answer: round.task.answer, picked, correct, add: Boolean(round.task.stimulus?.add) }];
  return { round: { ...round, level, results, awaiting: false }, correct, finished: results.length >= ROUND_LENGTH };
}

export function finishRound(profile, round, rng, now = new Date()) {
  const correct = round.results.filter((r) => r.correct).length;
  const confusions = {};
  for (const r of round.results) {
    if (r.correct || r.add) continue; // addition mistakes are not letter/digit confusions
    const key = `${r.answer}>${r.picked}`;
    confusions[key] = (confusions[key] ?? 0) + 1;
  }
  const reward = applyRoundRewards(profile.rewards, correct, rng);
  return {
    profile: {
      ...profile,
      levels: { ...profile.levels, [round.exerciseId]: round.level },
      rewards: reward.rewards,
      history: [...profile.history, { date: localDate(now), exercise: round.exerciseId, correct, total: round.results.length, confusions }],
    },
    reward,
  };
}

export function abortRound(profile, round) {
  return { ...profile, levels: { ...profile.levels, [round.exerciseId]: round.level } };
}
