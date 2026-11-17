// Tiny Web Audio synth — no sound files needed.
const MUTE_KEY = 'muscle-games:muted';
let ctx = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();

export const isMuted = () => muted;
export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, { type = 'sine', dur = 0.12, vol = 0.14, at = 0, slide } = {}) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise({ dur = 0.15, vol = 0.2, at = 0, freq = 1200 } = {}) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + at;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  const gain = c.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t);
}

const SOUNDS = {
  pop: () => {
    noise({ dur: 0.12, vol: 0.3, freq: 1800 });
    tone(900, { dur: 0.08, slide: 300, vol: 0.08 });
  },
  good: () => {
    tone(784, { dur: 0.1 });
    tone(1175, { dur: 0.16, at: 0.08 });
  },
  bad: () => tone(190, { type: 'square', dur: 0.25, vol: 0.06, slide: 110 }),
  combo: (level = 2) =>
    [0, 1, 2].forEach((k) => tone(523 * Math.pow(1.26, k + level), { dur: 0.09, at: k * 0.06, type: 'triangle' })),
  flip: () => tone(1500, { dur: 0.04, vol: 0.05, type: 'triangle' }),
  snap: () => {
    tone(520, { dur: 0.05, type: 'square', vol: 0.05 });
    tone(1040, { dur: 0.09, at: 0.04, vol: 0.08 });
  },
  whoosh: () => noise({ dur: 0.16, vol: 0.12, freq: 700 }),
  freeze: () => [0, 1, 2, 3].forEach((k) => tone(2200 - k * 260, { dur: 0.14, at: k * 0.05, vol: 0.05 })),
  boom: () => {
    noise({ dur: 0.45, vol: 0.45, freq: 220 });
    tone(95, { dur: 0.4, slide: 40, vol: 0.2 });
  },
  power: () => tone(260, { dur: 0.45, slide: 1300, type: 'sawtooth', vol: 0.05 }),
  win: () => [523, 659, 784, 1047].forEach((f, k) => tone(f, { dur: 0.2, at: k * 0.12, type: 'triangle', vol: 0.12 })),
  tick: () => tone(1100, { dur: 0.03, vol: 0.05 }),
};

export function play(name, arg) {
  if (muted) return;
  try {
    SOUNDS[name]?.(arg);
  } catch {
    /* audio unavailable */
  }
}

export function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
