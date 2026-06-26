// Synth fx via WebAudio so there are zero binary assets to host. Replace with real
// samples later by swapping play() to <audio> elements.
let ctx: AudioContext | null = null;
function beep(freq: number, ms: number, type: OscillatorType = "sine", gain = 0.08) {
  ctx ??= new AudioContext();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq; g.gain.value = gain;
  o.connect(g); g.connect(ctx.destination); o.start();
  o.stop(ctx.currentTime + ms / 1000);
}
import { useSettings } from "./settingsStore";
const on = () => useSettings.getState().sound;
export const sfx = {
  tick: () => on() && beep(880, 60, "square", 0.05),
  correct: () => on() && (beep(660, 120), setTimeout(() => beep(990, 160), 120)),
  wrong: () => on() && beep(180, 260, "sawtooth", 0.07),
  victory: () => on() && [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 220), i * 160)),
  applause: () => on() && beep(300, 400, "triangle", 0.04),
};
