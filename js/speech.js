export const SPEECH_MODES = ['off', 'little', 'lots'];
export const VOICE_KEY = 'blitzblick.voice';

function safeStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// Online voices and Google voices usually sound much more natural than the plain local ones.
const voiceScore = (v) => (v.localService === false ? 2 : 0) + (/google/i.test(v.name) ? 1 : 0);

export function createSpeech({
  synth = globalThis.speechSynthesis,
  Utterance = globalThis.SpeechSynthesisUtterance,
  storage = safeStorage(),
} = {}) {
  let mode = 'little';
  const read = (k) => { try { return storage?.getItem(k) ?? null; } catch { return null; } };
  const germanVoices = () => (synth?.getVoices() ?? [])
    .filter((v) => v.lang?.toLowerCase().startsWith('de'))
    .sort((a, b) => voiceScore(b) - voiceScore(a));
  const findVoice = () => {
    const voices = germanVoices();
    const chosen = read(VOICE_KEY);
    return voices.find((v) => v.name === chosen) ?? voices[0] ?? null;
  };

  return {
    setMode(m) {
      mode = SPEECH_MODES.includes(m) ? m : 'little';
      if (mode === 'off') synth?.cancel();
    },
    hasGermanVoice: () => !!findVoice(),
    germanVoices,
    currentVoiceName: () => findVoice()?.name ?? null,
    // Android loads voices asynchronously; lets a screen re-render once they are there
    onVoicesChanged(cb) { synth?.addEventListener?.('voiceschanged', cb, { once: true }); },
    setVoice(name) {
      try {
        if (name) storage?.setItem(VOICE_KEY, name);
        else storage?.removeItem(VOICE_KEY);
      } catch {
        // storage unavailable: the choice lasts only for this session
      }
    },
    // extra: chatter that is only spoken in mode "lots"
    speak(text, { extra = false, force = false } = {}) {
      if (!force && (mode === 'off' || (extra && mode !== 'lots'))) return;
      const voice = findVoice();
      if (!synth || !Utterance || !voice) return;
      synth.cancel();
      const u = new Utterance(text);
      u.voice = voice;
      u.lang = 'de-DE';
      u.rate = 0.95;
      u.pitch = 1.1;
      synth.speak(u);
    },
    cancel() { synth?.cancel(); },
  };
}
