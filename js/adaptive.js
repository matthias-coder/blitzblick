const HARDER = 0.85;
const EASIER = 1.2;
const STEP = 50;
const floorStep = (ms) => Math.floor(ms / STEP) * STEP;
const ceilStep = (ms) => Math.ceil(ms / STEP) * STEP;
const roundStep = (ms) => Math.round(ms / STEP) * STEP;

export function initialLevel(timing, complexity) {
  return { durationMs: timing.startMs, complexity, streak: 0, recent: [] };
}

export function clampLevel(level, timing, maxComplexity) {
  return {
    ...level,
    durationMs: Math.min(timing.maxMs, Math.max(timing.minMs, level.durationMs)),
    complexity: Math.min(maxComplexity, Math.max(0, level.complexity)),
  };
}

export function effectiveLevel(level, timing, maxComplexity) {
  if (!timing.adaptive) return { durationMs: timing.startMs, complexity: maxComplexity };
  const c = clampLevel(level, timing, maxComplexity);
  return { durationMs: c.durationMs, complexity: c.complexity };
}

function harder(l, t, maxC) {
  if (l.durationMs > t.minMs) return { ...l, durationMs: Math.max(t.minMs, floorStep(l.durationMs * HARDER)) };
  if (l.complexity < maxC) return { ...l, complexity: l.complexity + 1, durationMs: Math.min(t.maxMs, t.minMs * 2) };
  return l;
}

function easier(l, t) {
  if (l.durationMs < t.maxMs) return { ...l, durationMs: Math.min(t.maxMs, ceilStep(l.durationMs * EASIER)) };
  if (l.complexity > 0) return { ...l, complexity: l.complexity - 1, durationMs: Math.max(t.minMs, roundStep(t.maxMs / 2)) };
  return l;
}

export function recordResult(level, correct, timing, maxComplexity) {
  const recent = [...level.recent, correct].slice(-3);
  const streak = correct ? level.streak + 1 : 0;
  const base = { ...clampLevel(level, timing, maxComplexity), recent, streak };
  if (!timing.adaptive) return base;
  if (streak >= 3) return { ...harder(base, timing, maxComplexity), streak: 0, recent: [] };
  if (recent.filter((r) => !r).length >= 2) return { ...easier(base, timing), streak: 0, recent: [] };
  return base;
}
