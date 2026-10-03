export function createSpeech({ synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance } = {}) {
  let enabled = true;
  let voice = null;
  const findVoice = () => {
    if (!synth) return null;
    voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith('de')) ?? null;
    return voice;
  };
  if (synth) {
    findVoice();
    synth.addEventListener?.('voiceschanged', findVoice);
  }
  return {
    setEnabled(v) {
      enabled = v;
      if (!v) synth?.cancel();
    },
    hasGermanVoice: () => !!(voice ?? findVoice()),
    speak(text) {
      if (!enabled || !synth || !Utterance || !(voice ?? findVoice())) return;
      synth.cancel();
      const u = new Utterance(text);
      u.voice = voice;
      u.lang = 'de-DE';
      u.rate = 0.9;
      synth.speak(u);
    },
    cancel() { synth?.cancel(); },
  };
}
