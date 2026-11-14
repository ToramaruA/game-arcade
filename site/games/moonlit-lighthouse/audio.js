// Web Audio だけで作る効果音と静かな BGM（外部素材なし）。最初のユーザー操作の後に鳴り始める。
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];

export function createAudio() {
  let ctx = null; let master = null; let music = null; let on = true; let bgmTimer = null; let beat = 0; let lastPop = 0;
  function ensure() {
    if (!ctx) {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = on ? 0.5 : 0; master.connect(ctx.destination);
      music = ctx.createGain(); music.gain.value = 0.18; music.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  function tone(freq, { t = 0, dur = 0.35, type = 'sine', gain = 0.25, slide = 0, dest = null } = {}) {
    if (!on || !ensure()) return;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    const t0 = ctx.currentTime + t;
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function bgmTick() {
    if (!on || !ctx) return;
    const bar = Math.floor(beat / 8) % 4;
    const roots = [57, 53, 55, 52];
    const n = roots[bar] + SCALE[(beat * 3 + bar) % SCALE.length];
    tone(midi(n), { dur: 1.2, type: 'triangle', gain: 0.12, dest: music });
    if (beat % 8 === 0) tone(midi(roots[bar] - 12), { dur: 3.6, type: 'sine', gain: 0.16, dest: music });
    beat += 1;
  }
  return {
    unlock() { if (ensure() && !bgmTimer) bgmTimer = setInterval(bgmTick, 480); },
    setOn(v) { on = v; if (master) master.gain.value = v ? 0.5 : 0; },
    get on() { return on; },
    build() { tone(midi(72), { dur: 0.12, type: 'square', gain: 0.08 }); tone(midi(79), { t: 0.06, dur: 0.18, gain: 0.12 }); },
    upgrade() { [72, 76, 79, 84].forEach((n, i) => tone(midi(n), { t: i * 0.05, dur: 0.2, gain: 0.1 })); },
    move() { tone(midi(67), { dur: 0.25, type: 'triangle', gain: 0.12, slide: 1.5 }); },
    sell() { tone(midi(76), { dur: 0.25, type: 'triangle', gain: 0.12, slide: 0.6 }); },
    signal(n = 0) {
      [60, 64, 67, 71, 76].forEach((m, i) => tone(midi(m + 12), { t: i * 0.03, dur: 0.9, type: 'triangle', gain: 0.13 }));
      tone(midi(48), { dur: 1.2, gain: 0.2 });
      for (let i = 0; i < Math.min(n, 8); i++) tone(midi(84 + SCALE[i % 8]), { t: 0.12 + i * 0.05, dur: 0.25, gain: 0.07 });
    },
    pop() { if (!ctx) return; const now = ctx.currentTime; if (now - lastPop < 0.05) return; lastPop = now; tone(midi(88 + Math.floor(Math.random() * 5)), { dur: 0.12, gain: 0.06, slide: 0.7 }); },
    stop() { tone(midi(81), { dur: 0.15, type: 'square', gain: 0.06 }); tone(midi(74), { t: 0.05, dur: 0.2, gain: 0.08 }); },
    leak() { tone(midi(38), { dur: 1.4, gain: 0.32 }); tone(midi(45), { dur: 1.1, gain: 0.14, type: 'triangle' }); },
    wave() { tone(midi(55), { dur: 0.5, type: 'sawtooth', gain: 0.05 }); tone(midi(62), { t: 0.15, dur: 0.6, type: 'sawtooth', gain: 0.05 }); },
    clear() { [67, 72, 76].forEach((n, i) => tone(midi(n), { t: i * 0.08, dur: 0.4, gain: 0.1 })); },
    win() { [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(midi(n), { t: i * 0.12, dur: 0.9, type: 'triangle', gain: 0.12 })); },
    lose() { [64, 60, 57, 52].forEach((n, i) => tone(midi(n), { t: i * 0.25, dur: 0.9, gain: 0.12 })); },
    bell() { tone(midi(93), { dur: 0.6, gain: 0.05 }); },
    error() { tone(midi(45), { dur: 0.15, type: 'square', gain: 0.06 }); },
    boss() { tone(midi(33), { dur: 2.0, type: 'sawtooth', gain: 0.08 }); tone(midi(40), { t: 0.3, dur: 1.6, type: 'sawtooth', gain: 0.06 }); },
  };
}
