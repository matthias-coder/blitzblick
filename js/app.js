import { createStore } from './storage.js';
import { createSpeech } from './speech.js';
import { createSounds } from './sounds.js';
import { getActive } from './profiles.js';
import * as profiles from './ui/profiles.js';
import * as menu from './ui/menu.js';
import * as round from './ui/round.js';
import * as album from './ui/album.js';
import * as parents from './ui/parents.js';

const SCREENS = { profiles, menu, round, album, parents };
const root = document.getElementById('app');
const store = createStore();
const speech = createSpeech();
const sounds = createSounds();
let state = store.load();
let cleanup = null;

function applyProfilePrefs() {
  const p = getActive(state);
  speech.setEnabled(p?.settings.speech ?? true);
  sounds.setEnabled(p?.settings.sounds ?? true);
}

const ctx = {
  store,
  speech,
  sounds,
  get state() { return state; },
  get profile() { return getActive(state); },
  setState(next) {
    state = next;
    store.save(state);
    applyProfilePrefs();
  },
  go(name, params = {}) {
    if (typeof cleanup === 'function') cleanup();
    cleanup = null;
    speech.cancel();
    root.replaceChildren();
    const target = (name === 'menu' || name === 'round' || name === 'album') && !getActive(state) ? 'profiles' : name;
    root.dataset.screen = target;
    cleanup = SCREENS[target].render(root, ctx, params) ?? null;
  },
};

applyProfilePrefs();
ctx.go(getActive(state) && state.profiles.length === 1 ? 'menu' : 'profiles');

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
