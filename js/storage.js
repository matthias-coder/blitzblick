import { normalizeProfile } from './profiles.js';
import { localDate } from './util.js';

export const STORAGE_KEY = 'blitzblick.v1';
export const SCHEMA_VERSION = 1;
export const HISTORY_DAYS = 90;
const PRE_IMPORT_KEY = 'blitzblick.pre-import';

export class ImportError extends Error {}

export function emptyState() {
  return { schemaVersion: SCHEMA_VERSION, activeProfileId: null, profiles: [] };
}

function validProfile(p) {
  return p && typeof p.id === 'string' && typeof p.name === 'string'
    && p.settings && typeof p.settings === 'object'
    && p.levels && typeof p.levels === 'object'
    && p.rewards && typeof p.rewards === 'object'
    && Array.isArray(p.history);
}

export function migrate(data) {
  if (!data || typeof data !== 'object' || typeof data.schemaVersion !== 'number' || !Array.isArray(data.profiles)) {
    throw new ImportError('Die Datei ist keine Blitzblick-Sicherung.');
  }
  if (data.schemaVersion > SCHEMA_VERSION) {
    throw new ImportError('Die Sicherung stammt aus einer neueren Version der App. Bitte zuerst die App aktualisieren.');
  }
  if (!data.profiles.every(validProfile)) {
    throw new ImportError('Die Sicherung ist unvollständig oder beschädigt.');
  }
  // Future schema upgrades go here: if (data.schemaVersion === 1) data = upgradeV1toV2(data);
  const profiles = structuredClone(data.profiles).map(normalizeProfile);
  const activeProfileId = profiles.some((p) => p.id === data.activeProfileId) ? data.activeProfileId : (profiles[0]?.id ?? null);
  return { schemaVersion: SCHEMA_VERSION, activeProfileId, profiles };
}

export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError('Die Datei ist keine gültige Sicherungsdatei.');
  }
  return migrate(data);
}

export function serializeExport(state) {
  return JSON.stringify(state, null, 2);
}

export function exportFilename(d = new Date()) {
  return `blitzblick-backup-${localDate(d)}.json`;
}

export function pruneHistory(state, today = new Date()) {
  const cutoff = localDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - HISTORY_DAYS));
  return { ...state, profiles: state.profiles.map((p) => ({ ...p, history: p.history.filter((h) => h.date >= cutoff) })) };
}

export function memoryBackend() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    keys: () => [...m.keys()],
  };
}

function probe(backend) {
  try {
    backend.setItem('blitzblick.probe', '1');
    backend.removeItem('blitzblick.probe');
    return true;
  } catch {
    return false;
  }
}

export function createStore(backend) {
  if (backend === undefined) {
    try { backend = globalThis.localStorage ?? null; } catch { backend = null; }
  }
  const available = !!backend && probe(backend);
  const store = available ? backend : memoryBackend();
  const warnings = new Set(available ? [] : ['unavailable']);

  return {
    get available() { return available; },
    get warnings() { return [...warnings]; },
    load() {
      const raw = store.getItem(STORAGE_KEY);
      if (raw == null) return emptyState();
      try {
        return migrate(JSON.parse(raw));
      } catch {
        try { store.setItem(`blitzblick.corrupt-${Date.now()}`, raw); } catch { /* ignore */ }
        warnings.add('corrupt');
        return emptyState();
      }
    },
    save(state, today = new Date()) {
      try {
        store.setItem(STORAGE_KEY, JSON.stringify(pruneHistory(state, today)));
      } catch {
        warnings.add('unavailable');
      }
    },
    importText(text) {
      const state = parseImport(text);
      const current = store.getItem(STORAGE_KEY);
      if (current != null) store.setItem(PRE_IMPORT_KEY, current);
      store.setItem(STORAGE_KEY, JSON.stringify(state));
      return state;
    },
  };
}
