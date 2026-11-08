// 控えめな持続和音と硝子音（Web Audio）。初回操作後だけ開始する。
let ctx = null; let master = null; let drone = null;
let volume = 0.6; let muted = false;

export function setVolume(v, m) {
  volume = v; muted = m;
  if (master) master.gain.value = muted ? 0 : volume * 0.5;
}

export function start() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : volume * 0.5; master.connect(ctx.destination);
    drone = ctx.createGain(); drone.gain.value = 0.05; drone.connect(master);
    for (const f of [110, 164.8, 220, 277.2]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const l = ctx.createOscillator(); l.frequency.value = 0.07 + f / 4000;
      const lg = ctx.createGain(); lg.gain.value = 0.35; l.connect(lg); const g = ctx.createGain(); g.gain.value = 0.5; lg.connect(g.gain);
      o.connect(g); g.connect(drone); o.start(); l.start();
    }
  } catch { ctx = null; }
}

function tone(freq, dur, type = 'sine', gain = 0.2, when = 0, slide = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, gain = 0.15, hp = 3000) {
  if (!ctx || muted) return;
  const n = Math.floor(ctx.sampleRate * dur); const buf = ctx.createBuffer(1, n, ctx.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(); s.buffer = buf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = ctx.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(master); s.start();
}

export const sfx = {
  launch: () => { tone(880, 0.09, 'triangle', 0.12, 0, -300); },
  armor: () => { tone(110, 0.14, 'sine', 0.25, 0, -40); tone(1400, 0.04, 'square', 0.04); },
  glassHit: () => { tone(1500, 0.1, 'triangle', 0.1); },
  glass: (chain = 1) => { noise(0.22, 0.14); const base = 880 * 2 ** (Math.min(chain, 8) / 12 * 2); tone(base, 0.35, 'sine', 0.14); tone(base * 1.5, 0.3, 'sine', 0.08, 0.04); },
  heart: () => { tone(330, 0.3, 'sine', 0.2); tone(495, 0.3, 'sine', 0.1, 0.03); },
  bell: () => { tone(1046, 0.7, 'sine', 0.16); tone(1568, 0.6, 'sine', 0.07, 0.01); tone(2093, 0.4, 'sine', 0.04, 0.02); },
  recall: () => { tone(500, 0.18, 'triangle', 0.1, 0, 500); },
  fail: () => { tone(140, 0.4, 'sawtooth', 0.12, 0, -50); },
  win: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 1.2, 'sine', 0.1, i * 0.12)); },
  lose: () => { tone(196, 0.8, 'sine', 0.12); tone(147, 1, 'sine', 0.1, 0.2); },
  click: () => { tone(660, 0.05, 'triangle', 0.06); },
};
