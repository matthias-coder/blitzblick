import { EXERCISES } from './exercises/index.js';
import { initialLevel, clampLevel } from './adaptive.js';

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
  speech: true,
  sounds: true,
};

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

export function normalizeProfile(raw) {
  const settings = normalizeSettings(mergeDeep(DEFAULT_SETTINGS, raw.settings));
  return {
    ...raw,
    avatar: AVATARS.includes(raw.avatar) ? raw.avatar : AVATARS[0],
    settings,
    levels: buildLevels(raw.levels ?? {}, settings),
    rewards: { stars: 0, stickers: [], unlockedPages: 1, ...raw.rewards },
    history: Array.isArray(raw.history) ? raw.history : [],
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
  const settings = normalizeSettings(mergeDeep(profile.settings, patch));
  return { ...profile, settings, levels: buildLevels(profile.levels, settings) };
}

export function resetLevels(profile) {
  return { ...profile, levels: buildLevels(null, profile.settings) };
}
