import { buildPool } from './exercises/words.js';

// schema 1 (up to 1.6.x) → 2 (1.7.0): the old settings-driven stage lists are rebuilt here so every
// child keeps roughly the difficulty it had; the result is normalized by normalizeProfile afterwards
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const sub = (o, k) => (isObj(o?.[k]) ? o[k] : {});
const OLD_MAXES = [3, 4, 5, 6, 8, 10];
const OLD_DIGITS = [5, 9, 10, 20];

function oldQuantityStages(q) {
  const max = OLD_MAXES.includes(q.max) ? q.max : 10;
  const layout = ['structured', 'random', 'mixed'].includes(q.layout) ? q.layout : 'mixed';
  const maxes = OLD_MAXES.filter((m) => m <= max);
  const regular = layout === 'mixed'
    ? maxes.flatMap((m) => [{ max: m, layout: 'structured' }, { max: m, layout: 'mixed' }])
    : maxes.map((m) => ({ max: m, layout }));
  const add = q.addition === false ? [] : [5, 10].filter((sum) => sum <= max).map((sum) => ({ add: true, sum }));
  return { regular, all: [...regular, ...add], start: Math.max(0, regular.findIndex((st) => st.max === 5)) };
}

function oldDigitStages(d) {
  const range = [9, 10, 20].includes(d.range) ? d.range : 9;
  const regular = OLD_DIGITS.filter((r) => r <= range).map((r) => ({ range: r }));
  const add = d.addition === false ? [] : [5, 10].map((sum) => ({ add: true, sum }));
  return { regular, all: [...regular, ...add], start: 0 };
}

function oldLetterStages(l) {
  const c = { upper: ['upper'], lower: ['lower'], both: ['upper', 'lower', 'mixed'] }[l.case] ?? ['upper'];
  return { regular: c, all: c, start: 0 };
}

function oldSyllableStages(s) {
  const known = Array.isArray(s.letters?.known) ? s.letters.known : ['A', 'M', 'O'];
  const pool = buildPool({ letters: { known }, syllables: { custom: [] } });
  const top = Math.max(0, ...pool.map((e) => e.level));
  const all = [0, 1, 2].slice(0, top + 1);
  return { regular: all, all, start: 0 };
}

// the stage a v1 round would have used
function oldStage(stages, rawLevel, adaptive) {
  if (!adaptive) return stages.regular.at(-1) ?? stages.all.at(-1);
  const c = Number.isFinite(rawLevel?.complexity) ? rawLevel.complexity : stages.start;
  return stages.all[Math.min(stages.all.length - 1, Math.max(0, c))];
}

const isGrade1 = (st) => st.quantity.add || st.digits.add || st.digits.range === 20
  || st.letters !== 'upper' || st.syllables >= 1;

function mapPre(ex, st) {
  if (ex === 'quantity') {
    if (st.add || st.max >= 8) return { level: 3, step: st.max === 10 || st.add ? 1 : 0 };
    if (st.max <= 3) return { level: 0, step: 0 };
    if (st.max === 4) return { level: 1, step: 0 };
    if (st.max === 5) return st.layout === 'structured' ? { level: 1, step: 1 } : { level: 2, step: 0 };
    return { level: 2, step: st.layout === 'structured' ? 1 : 2 };
  }
  if (ex === 'digits') return { level: { 5: 1, 9: 2, 10: 3 }[st.range] ?? 3, step: 0 };
  return { level: 1, step: 0 }; // letters: upper with 4 answers; syllables: syllables with 4 answers
}

function mapG1(ex, st) {
  if (ex === 'quantity') {
    if (st.add) return { level: 2, step: st.sum === 10 ? 1 : 0 };
    if (st.layout === 'structured') return { level: 0, step: st.max >= 10 ? 2 : st.max >= 8 ? 1 : 0 };
    return { level: 1, step: st.max < 10 ? 0 : st.layout === 'random' ? 2 : 1 };
  }
  if (ex === 'digits') {
    if (st.add) return { level: 2, step: st.sum === 10 ? 1 : 0 };
    return { level: st.range === 20 ? 1 : 0, step: 0 };
  }
  if (ex === 'letters') return { level: { upper: 0, lower: 1, mixed: 2 }[st], step: 0 };
  return { level: st, step: 0 };
}

export function upgradeProfileV1(raw) {
  const s = isObj(raw.settings) ? raw.settings : {};
  const lv = isObj(raw.levels) ? raw.levels : {};
  const adaptive = sub(s, 'timing').adaptive !== false;
  const stages = {
    quantity: oldStage(oldQuantityStages(sub(s, 'quantity')), lv.quantity, adaptive),
    digits: oldStage(oldDigitStages(sub(s, 'digits')), lv.digits, adaptive),
    letters: oldStage(oldLetterStages(sub(s, 'letters')), lv.letters, adaptive),
    syllables: oldStage(oldSyllableStages(s), lv.syllables, adaptive),
  };
  const grade = isGrade1(stages) ? 'g1' : 'pre';
  const map = grade === 'g1' ? mapG1 : mapPre;
  const startMs = Number.isFinite(sub(s, 'timing').startMs) ? s.timing.startMs : 1500;
  const levels = {};
  const reached = {};
  for (const [ex, st] of Object.entries(stages)) {
    const { level, step } = map(ex, st);
    levels[ex] = { level, step, durationMs: Number.isFinite(lv[ex]?.durationMs) ? lv[ex].durationMs : startMs, streak: 0, recent: [], mastered: false };
    reached[ex] = level;
  }
  return {
    ...raw,
    settings: { ...s, grade },
    levels,
    rewards: { ...(isObj(raw.rewards) ? raw.rewards : {}), reached },
  };
}

export function upgradeV1toV2(data) {
  return { ...data, schemaVersion: 2, profiles: data.profiles.map(upgradeProfileV1) };
}
