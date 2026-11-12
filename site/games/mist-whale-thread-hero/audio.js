// Web Audio だけで作るBGMと効果音（外部素材なし）。
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
// 章ごとの和声（ルート, 和音の構成音）
const PROG = [
  [[50, [0, 4, 7, 11]], [55, [0, 4, 7, 9]], [47, [0, 3, 7, 10]], [52, [0, 5, 7, 10]]],
  [[45, [0, 3, 7, 10]], [41, [0, 4, 7, 11]], [43, [0, 4, 7, 9]], [40, [0, 3, 7, 10]]],
  [[46, [0, 3, 7, 10]], [42, [0, 4, 7, 11]], [44, [0, 3, 6, 10]], [41, [0, 4, 7, 10]]],
];
const SCALE = [[0, 2, 4, 7, 9, 11], [0, 2, 3, 7, 8, 10], [0, 1, 3, 7, 8, 10]];

export function createAudio(storage, key) {
  let ctx = null; let master = null; let bgmTimer = null; let beat = 0; let chapter = 0; let tension = 0; let dread = 0;
  const st = { muted: false, vol: 0.7 };
  try { Object.assign(st, JSON.parse(storage.getItem(key) || '{}')); } catch { /* 保存なしでも動く */ }
  const save = () => { try { storage.setItem(key, JSON.stringify(st)); } catch { /* 保存できなくてもよい */ } };
  const apply = () => { if (master) master.gain.value = st.muted ? 0 : st.vol * 1.6; };
  let tag = null;
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { ctx = new AC(); } catch { return false; }
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4;
      master = ctx.createGain(); master.connect(comp); comp.connect(ctx.destination); apply();
    }
    // iPhone のマナーモードでも鳴るように：再生用の音声セッションにし、無音の音声要素を一度鳴らす
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* 古いブラウザ */ }
    if (!tag) {
      try {
        tag = new Audio('data:audio/wav;base64,UklGRsEIAABXQVZFZm10IBAAAAABAAEAIlYAACJWAAABAAgAZGF0YZ0IAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIA=');
        tag.loop = true; tag.setAttribute('playsinline', ''); const pr = tag.play(); if (pr && pr.catch) pr.catch(() => { tag = null; });
      } catch { tag = null; }
    }
    if (ctx.state !== 'running') { const pr = ctx.resume(); if (pr && pr.catch) pr.catch(() => {}); }
    // 最初の操作のときに短い無音を流して、確実に音の出口を開ける
    if (!ctx.__primed) { ctx.__primed = true; const b = ctx.createBuffer(1, 1, 22050); const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); }
    return true;
  }
  function tone(freq, { t = 0, dur = 0.4, type = 'sine', gain = 0.3, slide = 0, attack = 0.01 } = {}) {
    if (!ctx || st.muted) return;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    const t0 = ctx.currentTime + t;
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, { gain = 0.2, f0 = 400, f1 = 1800, q = 1.2, t = 0 } = {}) {
    if (!ctx || st.muted) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur)); const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    const t0 = ctx.currentTime + t;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain(); g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(master); s.start(t0);
  }
  const bellTone = (n, t = 0, g = 0.12, dur = 1.4) => { tone(midi(n), { t, dur, gain: g }); tone(midi(n + 12) * 1.003, { t, dur: dur * 0.7, gain: g * 0.4 }); tone(midi(n + 19), { t, dur: dur * 0.4, gain: g * 0.15 }); };
  const sfx = {
    jump() { tone(midi(74), { dur: 0.12, gain: 0.06, type: 'triangle', slide: 1.5 }); },
    land() { noise(0.08, { gain: 0.08, f0: 300, f1: 150 }); },
    throw() { noise(0.12, { gain: 0.1, f0: 2000, f1: 5000, q: 3 }); },
    whiff() { noise(0.15, { gain: 0.06, f0: 3000, f1: 1200, q: 2 }); },
    hit() { bellTone(91, 0, 0.08, 0.6); },
    bind() { tone(midi(79), { dur: 0.25, gain: 0.1, type: 'triangle' }); tone(midi(86), { t: 0.06, dur: 0.3, gain: 0.08, type: 'triangle' }); },
    yank() { noise(0.2, { gain: 0.15, f0: 600, f1: 2400, q: 2 }); tone(midi(67), { dur: 0.2, gain: 0.08, type: 'sawtooth', slide: 2 }); },
    fling() { noise(0.25, { gain: 0.08, f0: 800, f1: 3000 }); },
    lever() { tone(midi(60), { dur: 0.1, gain: 0.12, type: 'square', slide: 0.8 }); bellTone(84, 0.08, 0.1, 0.9); },
    bridge() { [72, 76, 79, 84].forEach((n, i) => bellTone(n, i * 0.07, 0.07, 0.8)); },
    bell() { bellTone(62, 0, 0.18, 2.6); bellTone(69, 0.02, 0.1, 2.2); bellTone(74, 0.04, 0.07, 1.8); },
    star(n) { [0, 4, 7, 12].forEach((k, i) => bellTone(84 + k + (n || 0), i * 0.06, 0.07, 0.7)); },
    hurt() { tone(midi(52), { dur: 0.3, gain: 0.18, type: 'sawtooth', slide: 0.5 }); noise(0.2, { gain: 0.12, f0: 500, f1: 200 }); },
    fall() { tone(midi(64), { dur: 0.6, gain: 0.12, type: 'triangle', slide: 0.3 }); },
    checkpoint() { [67, 71, 74].forEach((n, i) => bellTone(n, i * 0.08, 0.08, 1)); },
    defeat() { noise(0.35, { gain: 0.14, f0: 1200, f1: 300 }); bellTone(79, 0.05, 0.06, 0.5); },
    eaten() { [0, 0.06, 0.12].forEach((t) => noise(0.05, { t, gain: 0.18, f0: 3000, f1: 2000, q: 4 })); tone(midi(48), { dur: 0.3, gain: 0.1, type: 'square', slide: 0.6 }); },
    nothread() { tone(midi(45), { dur: 0.08, gain: 0.06, type: 'square' }); },
    lampwarn() { tone(midi(81), { dur: 0.6, gain: 0.03, type: 'sawtooth', slide: 1.3 }); },
    laser() { noise(0.5, { gain: 0.1, f0: 4000, f1: 1500, q: 0.7 }); tone(midi(57), { dur: 0.5, gain: 0.05, type: 'sawtooth' }); },
    charge() { noise(0.4, { gain: 0.08, f0: 200, f1: 600, q: 3 }); },
    dive() { tone(midi(88), { dur: 0.25, gain: 0.03, type: 'sawtooth', slide: 0.6 }); },
    ripple() { noise(0.5, { gain: 0.06, f0: 300, f1: 900 }); },
    splash() { noise(0.4, { gain: 0.12, f0: 900, f1: 300 }); },
    crumble() { noise(0.25, { gain: 0.1, f0: 1500, f1: 400, q: 0.8 }); },
    clock(open) { tone(midi(open ? 84 : 72), { dur: 0.1, gain: 0.05, type: 'square' }); },
    push() { /* 鳴らしすぎない */ },
    dread() { tone(midi(30), { dur: 0.6, gain: 0.12, type: 'sawtooth', slide: 0.8 }); noise(0.3, { gain: 0.1, f0: 150, f1: 90, q: 3 }); },
    wake() { [76, 72, 76, 72].forEach((n, i) => tone(midi(n), { t: i * 0.12, dur: 0.1, gain: 0.08, type: 'square' })); tone(midi(40), { t: 0.6, dur: 2.5, gain: 0.05, type: 'triangle', attack: 0.6 }); },
    peek() { tone(midi(38), { dur: 1.2, gain: 0.08, type: 'sawtooth', slide: 1.06, attack: 0.4 }); noise(0.9, { gain: 0.05, f0: 200, f1: 380, q: 6 }); },
    grab() { noise(0.25, { gain: 0.14, f0: 900, f1: 200, q: 1.5 }); tone(midi(50), { dur: 0.25, gain: 0.08, type: 'square', slide: 0.6 }); },
    flinch() { tone(midi(86), { dur: 0.3, gain: 0.07, type: 'sawtooth', slide: 0.4 }); },
    dish() { // 皿の割れる音：鋭い破裂と、散らばる破片
      noise(0.18, { gain: 0.3, f0: 5000, f1: 2500, q: 0.8 }); noise(0.35, { gain: 0.16, f0: 1800, f1: 600, q: 1 });
      for (let i = 0; i < 9; i++) { const t = 0.05 + i * 0.045 + Math.random() * 0.06; tone(2600 + Math.random() * 2600, { t, dur: 0.18, gain: 0.05, type: 'triangle' }); noise(0.04, { t, gain: 0.08, f0: 6000, f1: 4000, q: 4 }); }
      [0.5, 0.68, 0.8].forEach((t, i) => { tone(3200 - i * 300, { t, dur: 0.12, gain: 0.03, type: 'triangle' }); noise(0.03, { t, gain: 0.05, f0: 5000, f1: 4500, q: 5 }); });
    },
    door() { // 遠くでドアが閉まる：低い衝撃と掛け金
      tone(62, { dur: 0.5, gain: 0.3, type: 'sine', slide: 0.6 }); noise(0.3, { gain: 0.22, f0: 260, f1: 90, q: 1 });
      noise(0.05, { t: 0.09, gain: 0.08, f0: 2500, f1: 2000, q: 6 }); tone(midi(33), { t: 0.05, dur: 1.4, gain: 0.04, type: 'sawtooth', attack: 0.3 });
    },
    dock() { tone(midi(67), { dur: 0.3, gain: 0.05 }); },
    sew() { for (let i = 0; i < 12; i++) bellTone(72 + SCALE[0][i % 6] + 12 * Math.floor(i / 6), i * 0.12, 0.07, 1.6); },
    clear() { [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => bellTone(n, i * 0.09, 0.09, 1.4)); },
    down() { [67, 63, 60].forEach((n, i) => tone(midi(n), { t: i * 0.15, dur: 0.4, gain: 0.1, type: 'triangle' })); },
    ui() { tone(midi(79), { dur: 0.08, gain: 0.05, type: 'triangle' }); },
  };
  function tick() {
    if (st.muted || document.hidden || !ctx) return;
    beat++;
    const prog = PROG[chapter]; const bar = Math.floor(beat / 8) % prog.length; const [root, chord] = prog[bar];
    const b8 = beat % 8;
    if (b8 === 0) chord.forEach((k, i) => tone(midi(root + k), { t: i * 0.02, dur: 3.2, gain: 0.035, attack: 0.3 }));
    if (b8 === 0 || b8 === 4) tone(midi(root - 12), { dur: 1.6, gain: 0.05, type: 'triangle' });
    // ハープのような分散和音
    if (b8 % 2 === 1 || tension > 0.5) {
      const k = chord[(beat * 3) % chord.length];
      tone(midi(root + 12 + k), { dur: 0.9, gain: 0.025, type: 'triangle' });
    }
    // 旋律
    if (Math.random() < 0.35 + tension * 0.3) {
      const sc = SCALE[chapter]; const n = root + 24 + sc[(beat * 5 + (Math.random() * 3 | 0)) % sc.length];
      tone(midi(n), { dur: 1.1, gain: 0.03 });
    }
    if (tension > 0.5 && b8 % 2 === 0) noise(0.05, { gain: 0.04, f0: 2000, f1: 1500 });
    // 後半ほど、低い不協和音が混じる
    if (dread > 0.3 && Math.random() < dread * 0.18) { tone(midi(root - 18 + 1), { dur: 2.4, gain: 0.03 * dread, type: 'sawtooth', attack: 0.8 }); tone(midi(root - 18 + 7), { t: 0.05, dur: 2.2, gain: 0.02 * dread, type: 'sawtooth', attack: 0.8 }); }
  }
  return {
    state: st,
    get running() { return !!ctx && ctx.state === 'running'; },
    unlock() { if (ensure()) this.startBgm(); },
    play(name, arg) { if (!ctx) return; const f = sfx[name]; if (f) f(arg); },
    setChapter(c) { chapter = Math.max(0, Math.min(2, c)); },
    setTension(v) { tension = v; },
    setDread(v) { dread = v; },
    startBgm() { if (bgmTimer || !ctx) return; bgmTimer = setInterval(tick, 300); },
    setMuted(m) { st.muted = m; apply(); save(); if (!m) this.unlock(); },
  };
}
