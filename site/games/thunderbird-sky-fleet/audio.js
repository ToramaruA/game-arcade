// Web Audio だけで作る効果音と太鼓のBGM（外部素材なし）。
export function createAudio(settings) {
  let ctx = null; let master = null; let bgmTimer = null; let beat = 0; let sea = 0; let boss = false;
  const st = settings;
  const apply = () => { if (master) master.gain.value = st.sound ? st.vol * 0.9 : 0; };
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { ctx = new AC(); } catch { return false; }
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
      master = ctx.createGain(); master.connect(comp); comp.connect(ctx.destination); apply();
    }
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* 古いブラウザ */ }
    if (ctx.state !== 'running') { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); }
    return true;
  }
  function tone(f, { t = 0, dur = 0.3, type = 'sine', gain = 0.2, slide = 0, attack = 0.005 } = {}) {
    if (!ctx || !st.sound) return;
    const o = ctx.createOscillator(); const g = ctx.createGain(); const t0 = ctx.currentTime + t;
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  let noiseBuf = null;
  function noise(dur, { gain = 0.2, f = 1200, q = 1, t = 0, type = 'bandpass' } = {}) {
    if (!ctx || !st.sound) return;
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); const t0 = ctx.currentTime + t;
    g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur + 0.05);
  }
  let lastShot = 0;
  const sfx = {
    shot() { if (!ctx) return; const n = ctx.currentTime; if (n - lastShot < 0.07) return; lastShot = n; tone(1400, { dur: 0.05, type: 'square', gain: 0.025, slide: 0.6 }); },
    absorb(g) { tone(700 + g * 9, { dur: 0.12, type: 'sine', gain: 0.12, slide: 1.6 }); },
    threshold(level) { tone(level >= 80 ? 1320 : 990, { dur: 0.35, type: 'triangle', gain: 0.16 }); tone(level >= 80 ? 1760 : 1320, { t: 0.07, dur: 0.4, type: 'triangle', gain: 0.12 }); },
    lance(p) { noise(0.5, { gain: 0.5, f: 2400, q: 0.6 }); noise(0.9, { gain: 0.4, f: 180, q: 0.8, type: 'lowpass' }); tone(p >= 4 ? 90 : 140, { dur: 0.6, type: 'sawtooth', gain: 0.2, slide: 0.4 }); },
    fizzle() { tone(300, { dur: 0.12, type: 'square', gain: 0.05, slide: 0.7 }); },
    boom(big) { noise(big ? 1.1 : 0.35, { gain: big ? 0.6 : 0.25, f: big ? 260 : 700, q: 0.7, type: 'lowpass' }); tone(big ? 60 : 110, { dur: big ? 0.8 : 0.25, type: 'triangle', gain: 0.2, slide: 0.5 }); },
    spark() { tone(2200, { dur: 0.03, type: 'square', gain: 0.02 }); },
    clink() { tone(2600, { dur: 0.08, type: 'triangle', gain: 0.06 }); tone(3900, { dur: 0.05, type: 'sine', gain: 0.04 }); },
    hurt() { noise(0.3, { gain: 0.4, f: 500, q: 1 }); tone(220, { dur: 0.35, type: 'sawtooth', gain: 0.18, slide: 0.4 }); },
    warn() { tone(520, { dur: 0.12, type: 'square', gain: 0.06 }); tone(520, { t: 0.16, dur: 0.12, type: 'square', gain: 0.06 }); },
    zap() { noise(0.4, { gain: 0.35, f: 3000, q: 0.5 }); },
    multi(n) { [784, 988, 1175, 1568].slice(0, 2 + Math.min(2, n)).forEach((f, i) => tone(f, { t: i * 0.07, dur: 0.3, type: 'triangle', gain: 0.12 })); },
    heal() { tone(880, { dur: 0.15, type: 'sine', gain: 0.03, slide: 1.3 }); },
    clear() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { t: i * 0.12, dur: 0.6, type: 'triangle', gain: 0.14 })); },
    siren() { for (let i = 0; i < 3; i++) { tone(440, { t: i * 0.7, dur: 0.34, type: 'sawtooth', gain: 0.07, slide: 1.6 }); tone(700, { t: i * 0.7 + 0.35, dur: 0.34, type: 'sawtooth', gain: 0.07, slide: 0.63 }); } },
    rumble() { noise(2.2, { gain: 0.5, f: 90, q: 0.7, type: 'lowpass' }); tone(42, { dur: 2, type: 'sine', gain: 0.25, slide: 0.8, attack: 0.3 }); },
    charge() { tone(180, { dur: 1, type: 'sawtooth', gain: 0.08, slide: 5, attack: 0.05 }); noise(1, { gain: 0.12, f: 2600, q: 2 }); },
    ui() { tone(660, { dur: 0.08, type: 'triangle', gain: 0.08 }); },
  };
  // 太鼓と笛のような BGM（海域ごとに音階を少し変える）
  const SCALES = [[0, 2, 5, 7, 9], [0, 3, 5, 7, 10], [0, 1, 5, 7, 8], [0, 2, 4, 7, 9], [0, 1, 5, 6, 10], [0, 3, 5, 7, 10]];
  function tick() {
    if (!ctx || !st.sound) return;
    const b = beat++; const sc = SCALES[sea % 6]; const root = [57, 55, 53, 60, 52, 50][sea % 6];
    if (b % 4 === 0) tone(70, { dur: 0.25, type: 'sine', gain: 0.22, slide: 0.5 });
    if (b % 8 === 6 || (boss && b % 4 === 2)) tone(90, { dur: 0.18, type: 'sine', gain: 0.14, slide: 0.6 });
    if (b % 2 === 1) noise(0.05, { gain: 0.04, f: 6000, q: 1 });
    if (b % 16 === 0) { const f = 440 * 2 ** ((root - 12 - 69) / 12); tone(f, { dur: 3, type: 'triangle', gain: 0.05 }); tone(f * 1.5, { dur: 3, type: 'sine', gain: 0.03 }); }
    if (b % 2 === 0 && (Math.sin(b * 1.7 + sea) > -0.2)) {
      const n = sc[Math.floor((Math.sin(b * 0.37 + sea * 2) * 0.5 + 0.5) * sc.length) % sc.length] + root + (b % 32 > 16 ? 12 : 0);
      tone(440 * 2 ** ((n - 69) / 12), { dur: 0.32, type: 'triangle', gain: 0.045, attack: 0.02 });
    }
  }
  return {
    ensure, sfx, apply,
    setSea(i, isBoss) { sea = i; boss = isBoss; },
    startBgm() { if (bgmTimer || !ensure()) return; bgmTimer = setInterval(tick, 150); },
    stopBgm() { clearInterval(bgmTimer); bgmTimer = null; },
  };
}
