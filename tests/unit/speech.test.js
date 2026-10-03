import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeech } from '../../js/speech.js';

class FakeUtterance { constructor(text) { this.text = text; } }
function fakeSynth(voices = [{ lang: 'de-DE', name: 'Anna' }]) {
  const calls = [];
  return { calls, getVoices: () => voices, cancel: () => calls.push('cancel'), speak: (u) => calls.push(['speak', u.text, u.lang]), addEventListener() {} };
}

test('speak cancels the previous utterance and speaks German', () => {
  const synth = fakeSynth();
  const s = createSpeech({ synth, Utterance: FakeUtterance });
  s.speak('Hallo');
  assert.deepEqual(synth.calls, ['cancel', ['speak', 'Hallo', 'de-DE']]);
});

test('disabled speech stays silent', () => {
  const synth = fakeSynth();
  const s = createSpeech({ synth, Utterance: FakeUtterance });
  s.setEnabled(false);
  synth.calls.length = 0;
  s.speak('Hallo');
  assert.deepEqual(synth.calls, []);
});

test('without a German voice it stays silent and reports it', () => {
  const synth = fakeSynth([{ lang: 'en-US', name: 'Sam' }]);
  const s = createSpeech({ synth, Utterance: FakeUtterance });
  s.speak('Hallo');
  assert.deepEqual(synth.calls, []);
  assert.equal(s.hasGermanVoice(), false);
});

test('without speech synthesis nothing throws', () => {
  const s = createSpeech({ synth: undefined, Utterance: undefined });
  s.speak('Hallo');
  s.cancel();
  assert.equal(s.hasGermanVoice(), false);
});
