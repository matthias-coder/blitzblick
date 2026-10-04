import { EXERCISES } from './exercises/index.js';
import { initialLevel, clampLevel } from './adaptive.js';
import { MAXES } from './exercises/quantity.js';
import { LETTERS } from './exercises/letters.js';
import { SPEECH_MODES } from './speech.js';

export const AVATARS = ['astronaut', 'monster', 'superhero', 'knight', 'dino', 'dragon', 'pony', 'taco', 'singer', 'cat', 'fairy', 'chef'];
export const AVATAR_LABELS = {
  astronaut: 'Astronaut', monster: 'Monster', superhero: 'Superheld', knight: 'Ritter', dino: 'Dino', dragon: 'Drache',
  pony: 'Pony', taco: 'Taco', singer: 'Sängerin', cat: 'Katze', fairy: 'Fee', chef: 'Koch',
};

export const DEFAULT_SETTINGS = {
  exercises: { quantity: true, digits: true, letters: true },
  timing: { startMs: 1500, minMs: 300, maxMs: 3000, adaptive: true },
  quantity: { max: 10, layout: 'mixed' },
  digits: { range: 9 },
  letters: { known: ['A', 'M', 'O'], case: 'upper', speak: 'sound' },
  speech: 'little',
  sounds: true,
};

export const MIN_LETTERS = 2;
const DIGIT_RANGES = [9, 10, 20];

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

function buildLevels(levels, settings) {
  return Object.fromEntries(Object.entries(EXERCISES).map(([key, ex]) => [
    key,
    levels?.[key]
      ? clampLevel(levels[key], settings.timing, ex.maxComplexity(settings))
      : initialLevel(settings.timing, ex.startComplexity(settings)),
  ]));
}

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
    rewards: { stars: 0, stickers: [], unlockedPages: 1 },
    history: [],
  };
}

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const oneOf = (v, allowed, d) => (allowed.includes(v) ? v : d);

function sanitizeSettings(raw) {
  const r = isObj(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  const sub = (k) => (isObj(r[k]) ? r[k] : {});
  const known = Array.isArray(sub('letters').known)
    ? [...new Set(sub('letters').known.filter((l) => LETTERS.includes(l)))] : null;
  const exercises = Object.fromEntries(Object.keys(d.exercises).map((k) => [k, bool(sub('exercises')[k], d.exercises[k])]));
  if (!Object.values(exercises).some(Boolean)) Object.assign(exercises, d.exercises);
  return {
    exercises,
    timing: {
      startMs: num(sub('timing').startMs, d.timing.startMs),
      minMs: num(sub('timing').minMs, d.timing.minMs),
      maxMs: num(sub('timing').maxMs, d.timing.maxMs),
      adaptive: bool(sub('timing').adaptive, d.timing.adaptive),
    },
    quantity: {
      max: oneOf(sub('quantity').max, MAXES, d.quantity.max),
      layout: oneOf(sub('quantity').layout, ['structured', 'random', 'mixed'], d.quantity.layout),
    },
    digits: { range: oneOf(sub('digits').range, DIGIT_RANGES, d.digits.range) },
    letters: {
      known: known ?? [...d.letters.known],
      case: oneOf(sub('letters').case, ['upper', 'lower', 'both'], d.letters.case),
      speak: oneOf(sub('letters').speak, ['sound', 'name'], d.letters.speak),
    },
    speech: r.speech === true ? 'little' : r.speech === false ? 'off' : oneOf(r.speech, SPEECH_MODES, d.speech),
    sounds: bool(r.sounds, d.sounds),
  };
}

function sanitizeLevel(l) {
  return {
    ...l,
    durationMs: num(l.durationMs, DEFAULT_SETTINGS.timing.startMs),
    complexity: num(l.complexity, 0),
    streak: num(l.streak, 0),
    recent: Array.isArray(l.recent) ? l.recent.filter((x) => typeof x === 'boolean') : [],
  };
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
  const levels = Object.fromEntries(Object.keys(EXERCISES).filter((k) => isObj(lv[k])).map((k) => [k, sanitizeLevel(lv[k])]));
  return {
    ...raw,
    avatar: AVATARS.includes(raw.avatar) ? raw.avatar : AVATARS[0],
    settings,
    levels: buildLevels(levels, settings),
    rewards: {
      ...rw,
      stars: num(rw.stars, 0),
      stickers: Array.isArray(rw.stickers) ? rw.stickers.filter((x) => typeof x === 'string') : [],
      unlockedPages: Math.max(1, num(rw.unlockedPages, 1)),
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
  if (!Object.values(merged.exercises).some(Boolean)) return profile;
  const settings = normalizeSettings(merged);
  return { ...profile, settings, levels: buildLevels(profile.levels, settings) };
}

export function resetLevels(profile) {
  return { ...profile, levels: buildLevels(null, profile.settings) };
}
