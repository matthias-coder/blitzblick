import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeech, SPEECH_MODES, VOICE_KEY } from '../../js/speech.js';

class FakeUtterance { constructor(text) { this.text = text; } }
function fakeSynth(voices = [{ lang: 'de-DE', name: 'Anna', localService: true }]) {
  const calls = [];
  return { calls, getVoices: () => voices, cancel: () => calls.push('cancel'), speak: (u) => calls.push(['speak', u.text, u.lang, u.voice?.name]), addEventListener() {} };
}
function fakeStorage(init = {}) {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
}
const make = (synth, storage = fakeStorage()) => createSpeech({ synth, Utterance: FakeUtterance, storage });

test('speak cancels the previous utterance and speaks German', () => {
  const synth = fakeSynth();
  const s = make(synth);
  s.speak('Hallo');
  assert.deepEqual(synth.calls, ['cancel', ['speak', 'Hallo', 'de-DE', 'Anna']]);
});

test('three speech modes, default little', () => {
  assert.deepEqual(SPEECH_MODES, ['off', 'little', 'lots']);
  const synth = fakeSynth();
  const s = make(synth);
  s.speak('extra', { extra: true });
  assert.deepEqual(synth.calls, []);
  s.setMode('lots');
  s.speak('extra', { extra: true });
  assert.equal(synth.calls.at(-1)[1], 'extra');
});

test('mode off stays silent and cancels running speech', () => {
  const synth = fakeSynth();
  const s = make(synth);
  s.setMode('off');
  assert.deepEqual(synth.calls, ['cancel']);
  synth.calls.length = 0;
  s.speak('Hallo');
  assert.deepEqual(synth.calls, []);
  s.speak('Probe', { force: true });
  assert.equal(synth.calls.at(-1)[1], 'Probe');
});

test('without a German voice it stays silent and reports it', () => {
  const synth = fakeSynth([{ lang: 'en-US', name: 'Sam' }]);
  const s = make(synth);
  s.speak('Hallo');
  assert.deepEqual(synth.calls, []);
  assert.equal(s.hasGermanVoice(), false);
});

test('without speech synthesis nothing throws', () => {
  const s = createSpeech({ synth: undefined, Utterance: undefined, storage: fakeStorage() });
  s.speak('Hallo');
  s.cancel();
  assert.equal(s.hasGermanVoice(), false);
  assert.deepEqual(s.germanVoices(), []);
});

test('automatic choice prefers online and Google voices over plain local ones', () => {
  const voices = [
    { lang: 'de-DE', name: 'Lokal', localService: true },
    { lang: 'de_DE', name: 'Google Deutsch', localService: true },
    { lang: 'en-US', name: 'Sam', localService: false },
  ];
  const s = make(fakeSynth(voices));
  assert.deepEqual(s.germanVoices().map((v) => v.name), ['Google Deutsch', 'Lokal']);
  assert.equal(s.currentVoiceName(), 'Google Deutsch');
  const online = [{ lang: 'de-DE', name: 'Lokal', localService: true }, { lang: 'de-AT', name: 'Netz', localService: false }];
  assert.equal(make(fakeSynth(online)).currentVoiceName(), 'Netz');
});

test('a chosen voice is used and remembered on the device', () => {
  const voices = [{ lang: 'de-DE', name: 'Google Deutsch', localService: false }, { lang: 'de-DE', name: 'Anna', localService: true }];
  const storage = fakeStorage();
  const synth = fakeSynth(voices);
  const s = make(synth, storage);
  s.setVoice('Anna');
  assert.equal(storage.data[VOICE_KEY], 'Anna');
  s.speak('Hallo');
  assert.equal(synth.calls.at(-1)[3], 'Anna');
  assert.equal(make(fakeSynth(voices), storage).currentVoiceName(), 'Anna');
  s.setVoice(null);
  assert.equal(storage.data[VOICE_KEY], undefined);
  assert.equal(s.currentVoiceName(), 'Google Deutsch');
});

test('a remembered voice that no longer exists falls back to the automatic choice', () => {
  const s = make(fakeSynth(), fakeStorage({ [VOICE_KEY]: 'Weg' }));
  assert.equal(s.currentVoiceName(), 'Anna');
});
