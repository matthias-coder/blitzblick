import test from 'node:test';
import assert from 'node:assert/strict';
import { createSounds, COUNTDOWN_TICK_S } from '../../js/sounds.js';

function fakeAudio() {
  const started = [];
  class Ctx {
    constructor() { this.currentTime = 10; this.state = 'running'; this.destination = {}; }
    createOscillator() {
      const osc = { frequency: {}, connect: (g) => g, start: (t) => started.push([osc.frequency.value, +(t - 10).toFixed(3)]), stop() {} };
      return osc;
    }
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (d) => d };
    }
  }
  return { Ctx, started };
}

test('countdown plays two quiet ticks, the ping is a brighter separate note', () => {
  const { Ctx, started } = fakeAudio();
  const s = createSounds({ AudioCtx: Ctx });
  s.ticks();
  assert.equal(started.length, 2);
  assert.equal(started[0][0], started[1][0]);
  assert.deepEqual(started.map(([, t]) => t), [0, COUNTDOWN_TICK_S]);
  s.ping();
  assert.equal(started.length, 3);
  assert.ok(started[2][0] > started[0][0]);
  assert.equal(started[2][1], 0);
});

test('disabled sounds play nothing and missing audio does not throw', () => {
  const { Ctx, started } = fakeAudio();
  const s = createSounds({ AudioCtx: Ctx });
  s.setEnabled(false);
  s.ticks();
  s.ping();
  assert.equal(started.length, 0);
  const none = createSounds({ AudioCtx: undefined });
  none.ticks();
  none.ping();
});
