import { EXERCISES } from './exercises/index.js';

// school grades; each exercise brings a ladder of LEVEL_COUNT levels for every grade (later 'g2' … 'g4')
export const GRADES = ['pre', 'g1'];
export const GRADE_LABELS = { pre: 'Vorschule', g1: 'Klasse 1' };
export const GRADE_TIMING = {
  pre: { startMs: 2000, minMs: 400, maxMs: 3500 },
  g1: { startMs: 1500, minMs: 300, maxMs: 3000 },
};
export const LEVEL_COUNT = 4;

export const ladderOf = (exerciseId, settings) => EXERCISES[exerciseId].LADDERS[settings.grade] ?? EXERCISES[exerciseId].LADDERS[GRADES[0]];

export function levelAvailable(exerciseId, settings, level) {
  const ex = EXERCISES[exerciseId];
  const def = ladderOf(exerciseId, settings)[level];
  return Boolean(def) && (ex.levelAvailable ? ex.levelAvailable(def, settings) : true);
}

// the level a round really plays: the chosen one, else the highest playable below it, else the lowest playable
export function playableLevel(exerciseId, settings, level) {
  for (let l = level; l >= 0; l--) if (levelAvailable(exerciseId, settings, l)) return l;
  for (let l = level + 1; l < LEVEL_COUNT; l++) if (levelAvailable(exerciseId, settings, l)) return l;
  return level;
}

export const stepsOf = (exerciseId, settings, level) => ladderOf(exerciseId, settings)[level].steps;
