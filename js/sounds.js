export const COUNTDOWN_TICK_S = 0.45;

export function createSounds({ AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
  let enabled = true;
  let ac = null;
  function play(notes, volume = 0.25) {
    if (!enabled) return;
    try {
      ac ??= new AudioCtx();
      if (ac.state === 'suspended') ac.resume().catch(() => {});
      const t0 = ac.currentTime;
      for (const [freq, start, dur] of notes) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + start);
        gain.gain.exponentialRampToValueAtTime(volume, t0 + start + 0.02);
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
    // countdown before a flash: two quiet ticks during the fixation, the ping when the stimulus appears
    ticks: () => play([[440, 0, 0.08], [440, COUNTDOWN_TICK_S, 0.08]], 0.12),
    ping: () => play([[1175, 0, 0.25]], 0.2),
  };
}
