import { EXERCISES } from './exercises/index.js';
import { initialLevel, clampLevel } from './adaptive.js';
import { LETTERS } from './exercises/letters.js';
import { GRADES, GRADE_TIMING, LEVEL_COUNT, ladderOf } from './levels.js';
import { sanitizeCustom } from './exercises/words.js';
import { SPEECH_MODES } from './speech.js';

export const AVATARS = ['astronaut', 'monster', 'superhero', 'knight', 'dino', 'dragon', 'pony', 'taco', 'singer', 'cat', 'fairy', 'chef'];
export const AVATAR_LABELS = {
  astronaut: 'Astronaut', monster: 'Monster', superhero: 'Superheld', knight: 'Ritter', dino: 'Dino', dragon: 'Drache',
  pony: 'Pony', taco: 'Taco', singer: 'Sängerin', cat: 'Katze', fairy: 'Fee', chef: 'Koch',
};

export const DEFAULT_SETTINGS = {
  grade: 'pre',
  exercises: { quantity: true, digits: true, letters: true, syllables: true },
  hold: { quantity: false, digits: false, letters: false, syllables: false },
  timing: { ...GRADE_TIMING.pre, adaptive: true },
  letters: { known: ['A', 'M', 'O'], speak: 'sound', lineature: true },
  syllables: { colors: true, custom: [] },
  speech: 'little',
  sounds: true,
};

export const MIN_LETTERS = 2;

// at least one exercise must be enabled and playable, otherwise the menu is empty
const hasPlayable = (s) => Object.entries(EXERCISES).some(([k, ex]) => s.exercises[k] && ex.isAvailable(s));

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function mergeDeep(base, patch) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch ?? {})) {
    out[k] = isObj(v) && isObj(base?.[k]) ? mergeDeep(base[k], v) : structuredClone(v);
  }
  return out;
}

function normalizeTiming(t) {
  const minMs = Math.min(t.minMs, t.maxMs);
  const maxMs = Math.max(t.minMs, t.maxMs);
  return { ...t, minMs, maxMs, startMs: Math.min(maxMs, Math.max(minMs, t.startMs)) };
}

function normalizeSettings(settings) {
  return { ...settings, timing: normalizeTiming(settings.timing) };
}

function clampState(state, settings, key) {
  const level = Math.min(LEVEL_COUNT - 1, Math.max(0, Math.round(state.level)));
  return clampLevel({ ...state, level }, settings.timing, ladderOf(key, settings)[level].steps.length - 1);
}

function buildLevels(levels, settings) {
  return Object.fromEntries(Object.keys(EXERCISES).map((key) => [
    key,
    levels?.[key] ? clampState(levels[key], settings, key) : initialLevel(settings.timing, 0),
  ]));
}

const noneReached = () => Object.fromEntries(Object.keys(EXERCISES).map((k) => [k, 0]));

let counter = 0;
export function newId() {
  counter += 1;
  return `p_${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function createProfile({ name, avatar }, { now = new Date(), id = newId() } = {}) {
  const settings = structuredClone(DEFAULT_SETTINGS);
  return {
    id,
    name: String(name).trim(),
    avatar: AVATARS.includes(avatar) ? avatar : AVATARS[0],
    createdAt: now.toISOString(),
    settings,
    levels: buildLevels(null, settings),
    rewards: { stars: 0, stickers: [], reached: noneReached() },
    history: [],
  };
}

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const oneOf = (v, allowed, d) => (allowed.includes(v) ? v : d);

function sanitizeSettings(raw) {
  const s = sanitizeFields(raw);
  return hasPlayable(s) ? s : { ...s, exercises: { ...DEFAULT_SETTINGS.exercises } };
}

function sanitizeFields(raw) {
  const r = isObj(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  const sub = (k) => (isObj(r[k]) ? r[k] : {});
  const known = Array.isArray(sub('letters').known)
    ? [...new Set(sub('letters').known.filter((l) => LETTERS.includes(l)))] : null;
  const exercises = Object.fromEntries(Object.keys(d.exercises).map((k) => [k, bool(sub('exercises')[k], d.exercises[k])]));
  if (!Object.values(exercises).some(Boolean)) Object.assign(exercises, d.exercises);
  return {
    grade: oneOf(r.grade, GRADES, d.grade),
    exercises,
    hold: Object.fromEntries(Object.keys(d.hold).map((k) => [k, bool(sub('hold')[k], false)])),
    timing: {
      startMs: num(sub('timing').startMs, d.timing.startMs),
      minMs: num(sub('timing').minMs, d.timing.minMs),
      maxMs: num(sub('timing').maxMs, d.timing.maxMs),
      adaptive: bool(sub('timing').adaptive, d.timing.adaptive),
    },
    letters: {
      known: known ?? [...d.letters.known],
      speak: oneOf(sub('letters').speak, ['sound', 'name'], d.letters.speak),
      lineature: bool(sub('letters').lineature, d.letters.lineature),
    },
    syllables: {
      colors: bool(sub('syllables').colors, d.syllables.colors),
      custom: sanitizeCustom(sub('syllables').custom),
    },
    speech: r.speech === true ? 'little' : r.speech === false ? 'off' : oneOf(r.speech, SPEECH_MODES, d.speech),
    sounds: bool(r.sounds, d.sounds),
  };
}

function sanitizeLevel(l) {
  return {
    level: num(l.level, 0),
    step: num(l.step, 0),
    durationMs: num(l.durationMs, DEFAULT_SETTINGS.timing.startMs),
    streak: num(l.streak, 0),
    recent: Array.isArray(l.recent) ? l.recent.filter((x) => typeof x === 'boolean') : [],
    mastered: bool(l.mastered, false),
  };
}

// highest level number ever reached per exercise; never below the current level
function sanitizeReached(raw, levels) {
  const r = isObj(raw) ? raw : {};
  return Object.fromEntries(Object.keys(EXERCISES).map((k) => [
    k, Math.min(LEVEL_COUNT - 1, Math.max(levels[k].level, Math.round(num(r[k], 0)))),
  ]));
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.filter((e) => isObj(e) && typeof e.date === 'string' && Object.hasOwn(EXERCISES, e.exercise)
    && Number.isFinite(e.correct) && Number.isFinite(e.total) && typeof e.correct === 'number' && typeof e.total === 'number');
}

export function normalizeProfile(raw) {
  const settings = normalizeSettings(sanitizeSettings(raw.settings));
  const rw = isObj(raw.rewards) ? raw.rewards : {};
  const lv = isObj(raw.levels) ? raw.levels : {};
  const levels = buildLevels(Object.fromEntries(Object.keys(EXERCISES).filter((k) => isObj(lv[k])).map((k) => [k, sanitizeLevel(lv[k])])), settings);
  const { unlockedPages, secretDay, ...rest } = rw; // unlockedPages: pre-1.7, pages now open by level
  return {
    ...raw,
    avatar: AVATARS.includes(raw.avatar) ? raw.avatar : AVATARS[0],
    settings,
    levels,
    rewards: {
      ...rest,
      stars: num(rw.stars, 0),
      stickers: Array.isArray(rw.stickers) ? rw.stickers.filter((x) => typeof x === 'string') : [],
      reached: sanitizeReached(rw.reached, levels),
      ...(typeof secretDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(secretDay) ? { secretDay } : {}),
    },
    history: sanitizeHistory(raw.history),
  };
}

export function getActive(state) {
  return state.profiles.find((p) => p.id === state.activeProfileId) ?? null;
}

export function addProfile(state, profile) {
  return { ...state, profiles: [...state.profiles, profile], activeProfileId: state.activeProfileId ?? profile.id };
}

export function setActive(state, id) {
  return { ...state, activeProfileId: id };
}

export function updateProfile(state, id, fn) {
  return { ...state, profiles: state.profiles.map((p) => (p.id === id ? fn(p) : p)) };
}

export function removeProfile(state, id) {
  const profiles = state.profiles.filter((p) => p.id !== id);
  const activeProfileId = state.activeProfileId === id ? (profiles[0]?.id ?? null) : state.activeProfileId;
  return { ...state, profiles, activeProfileId };
}

export function updateSettings(profile, patch) {
  const merged = mergeDeep(profile.settings, patch);
  const known = merged.letters.known.length;
  if (known < MIN_LETTERS && known < profile.settings.letters.known.length) return profile;
  if (!hasPlayable(merged)) return profile;
  const settings = normalizeSettings(merged);
  return { ...profile, settings, levels: buildLevels(profile.levels, settings) };
}

export function resetLevels(profile) {
  return { ...profile, levels: buildLevels(null, profile.settings) };
}

// a new grade starts every exercise at level 1 with that grade's display durations; album and letters stay
export function setGrade(profile, grade) {
  if (!GRADES.includes(grade) || grade === profile.settings.grade) return profile;
  const settings = { ...profile.settings, grade, timing: { ...GRADE_TIMING[grade], adaptive: profile.settings.timing.adaptive } };
  return { ...profile, settings, levels: buildLevels(null, settings) };
}

export function setLevel(profile, exerciseId, level) {
  if (!Number.isInteger(level) || level < 0 || level >= LEVEL_COUNT) return profile;
  const reached = { ...profile.rewards.reached, [exerciseId]: Math.max(profile.rewards.reached[exerciseId] ?? 0, level) };
  return {
    ...profile,
    levels: { ...profile.levels, [exerciseId]: initialLevel(profile.settings.timing, level) },
    rewards: { ...profile.rewards, reached },
  };
}
