const HARDER = 0.85;
const EASIER = 1.2;
const STEP = 50;
const floorStep = (ms) => Math.floor(ms / STEP) * STEP;
const ceilStep = (ms) => Math.ceil(ms / STEP) * STEP;
const roundStep = (ms) => Math.round(ms / STEP) * STEP;

// state per exercise: level (0-based, chosen by parents or reached), step inside the level, display duration
export function initialLevel(timing, level = 0) {
  return { level, step: 0, durationMs: timing.startMs, streak: 0, recent: [], mastered: false };
}

export function clampLevel(state, timing, maxStep) {
  return {
    ...state,
    durationMs: Math.min(timing.maxMs, Math.max(timing.minMs, state.durationMs)),
    step: Math.min(maxStep, Math.max(0, state.step)),
  };
}

// fixed display duration: no automation, the round uses the last step of the level
export function effectiveLevel(state, timing, maxStep) {
  if (!timing.adaptive) return { durationMs: timing.startMs, step: maxStep };
  const c = clampLevel(state, timing, maxStep);
  return { durationMs: c.durationMs, step: c.step };
}

function harder(l, t, maxStep) {
  if (l.durationMs > t.minMs) return { ...l, durationMs: Math.max(t.minMs, floorStep(l.durationMs * HARDER)) };
  if (l.step < maxStep) return { ...l, step: l.step + 1, durationMs: Math.min(t.maxMs, t.minMs * 2) };
  return { ...l, mastered: true };
}

// never below step 1 of the current level: going down a level is up to the parents
function easier(l, t) {
  if (l.durationMs < t.maxMs) return { ...l, durationMs: Math.min(t.maxMs, ceilStep(l.durationMs * EASIER)) };
  if (l.step > 0) return { ...l, step: l.step - 1, durationMs: Math.max(t.minMs, roundStep(t.maxMs / 2)) };
  return l;
}

export function recordResult(state, correct, timing, maxStep) {
  const recent = [...state.recent, correct].slice(-3);
  const streak = correct ? state.streak + 1 : 0;
  const base = { ...clampLevel(state, timing, maxStep), recent, streak };
  if (!timing.adaptive) return base;
  if (streak >= 3) return { ...harder(base, timing, maxStep), streak: 0, recent: [] };
  if (recent.filter((r) => !r).length >= 2) return { ...easier(base, timing), streak: 0, recent: [] };
  return base;
}

// applied at the end of a round when the level was mastered
export function advanceLevel(state, timing) {
  return { ...initialLevel(timing, state.level + 1) };
}
