export function createSounds() {
  let enabled = true;
  let ac = null;
  function play(notes) {
    if (!enabled) return;
    try {
      ac ??= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume().catch(() => {});
      const t0 = ac.currentTime;
      for (const [freq, start, dur] of notes) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + start);
        gain.gain.exponentialRampToValueAtTime(0.25, t0 + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
        osc.connect(gain).connect(ac.destination);
        osc.start(t0 + start);
        osc.stop(t0 + start + dur + 0.05);
      }
    } catch {
      // no audio available
    }
  }
  return {
    setEnabled(v) { enabled = v; },
    success: () => play([[660, 0, 0.12], [880, 0.1, 0.2]]),
    fanfare: () => play([[523, 0, 0.15], [659, 0.15, 0.15], [784, 0.3, 0.15], [1047, 0.45, 0.45]]),
  };
}
