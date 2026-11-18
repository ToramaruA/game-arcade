// Web Audio だけで作る、丸い効果音とのんびりした曲（外部素材なし）。
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const PENTA = [0, 2, 4, 7, 9];

export function createAudio(store) {
  let ctx = null; let master = null; let bgm = null; let step = 0;
  const st = { vol: 0.6, muted: false, music: true };
  try { Object.assign(st, JSON.parse(store.get('audio') || '{}')); } catch { /* 初期値で動く */ }
  const save = () => store.set('audio', JSON.stringify(st));
  const apply = () => { if (master) master.gain.value = st.muted ? 0 : st.vol * 0.55; };
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { ctx = new AC(); } catch { return false; }
      master = ctx.createGain(); master.connect(ctx.destination); apply();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  function tone(f, { t = 0, dur = 0.25, type = 'sine', gain = 0.25, slide = 0, attack = 0.01 } = {}) {
    if (!ensure() || st.muted) return;
    const o = ctx.createOscillator(); const g = ctx.createGain(); const t0 = ctx.currentTime + t;
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, { gain = 0.15, f0 = 300, f1 = 900, t = 0 } = {}) {
    if (!ensure() || st.muted) return;
    const len = Math.floor(ctx.sampleRate * dur); const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(); s.buffer = buf; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
    const t0 = ctx.currentTime + t;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(master); s.start(t0);
  }
  const note = (i, base = 67) => midi(base + PENTA[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5));
  let foot = 0;
  const sfx = {
    step(load = 0) { foot ^= 1; tone(foot ? 220 - load * 22 : 196 - load * 20, { dur: 0.09, type: 'triangle', gain: 0.12 }); },
    board(w) { tone(note(2), { dur: 0.12, gain: 0.18 }); tone(note(4), { t: 0.07, dur: 0.16, gain: 0.18 }); tone(140 - w * 15, { t: 0.1, dur: 0.18, type: 'triangle', gain: 0.18, slide: 0.7 }); },
    drop() { tone(note(4), { dur: 0.12, gain: 0.16 }); tone(note(1), { t: 0.08, dur: 0.18, gain: 0.16 }); },
    deliver() { [0, 2, 4, 5, 7].forEach((k, i) => tone(note(k, 72), { t: i * 0.07, dur: 0.35, gain: 0.16, type: 'sine' })); tone(midi(55), { dur: 0.6, type: 'triangle', gain: 0.12 }); },
    unlock() { tone(note(7, 72), { dur: 0.4, gain: 0.12 }); tone(note(9, 72), { t: 0.1, dur: 0.5, gain: 0.12 }); },
    leaf(heavy) { tone(heavy ? 160 : 260, { dur: 0.35, type: 'sine', gain: 0.22, slide: heavy ? 0.8 : 2.4 }); },
    bridge(heavy) { noise(0.22, { gain: 0.12, f0: 500, f1: 200 }); tone(heavy ? 110 : 180, { t: 0.05, dur: 0.3, type: 'triangle', gain: 0.15, slide: heavy ? 0.7 : 1.3 }); },
    wheel() { noise(0.9, { gain: 0.1, f0: 600, f1: 1400 }); [0, 1, 2, 3].forEach((k) => tone(note(k + 3, 70), { t: 0.15 + k * 0.1, dur: 0.3, gain: 0.12 })); },
    push() { tone(90, { dur: 0.18, type: 'square', gain: 0.07, slide: 0.8 }); noise(0.12, { gain: 0.1, f0: 200, f1: 120 }); },
    seed() { tone(note(7, 79), { dur: 0.18, gain: 0.12 }); tone(note(9, 79), { t: 0.06, dur: 0.22, gain: 0.12 }); },
    bump() { tone(130, { dur: 0.12, type: 'triangle', gain: 0.12, slide: 0.8 }); },
    undo() { tone(note(3), { dur: 0.08, gain: 0.1, slide: 0.8 }); },
    clear() { [0, 2, 4, 7, 9, 12].forEach((k, i) => tone(midi(67 + k), { t: i * 0.09, dur: 0.5, gain: 0.15 })); tone(midi(48), { dur: 1.2, type: 'triangle', gain: 0.12 }); },
    sneeze() { noise(0.35, { gain: 0.2, f0: 1500, f1: 300 }); tone(200, { dur: 0.3, type: 'triangle', gain: 0.1, slide: 0.5 }); },
    rumble() { tone(55, { dur: 1.2, type: 'triangle', gain: 0.2 }); noise(1.0, { gain: 0.06, f0: 120, f1: 80 }); },
  };
  function startMusic() {
    if (bgm || !st.music || !ensure()) return;
    const prog = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [4, 7, 12]];
    bgm = setInterval(() => {
      if (st.muted || !st.music || document.hidden) return;
      const ch = prog[Math.floor(step / 8) % 4];
      if (step % 8 === 0) for (const n of ch) tone(midi(48 + n), { dur: 2.2, gain: 0.035, type: 'sine', attack: 0.3 });
      if (step % 2 === 0 && Math.random() < 0.7) tone(midi(72 + ch[(step / 2) % 3] + (Math.random() < 0.3 ? 2 : 0)), { dur: 0.5, gain: 0.04, type: 'triangle' });
      step++;
    }, 300);
  }
  function stopMusic() { clearInterval(bgm); bgm = null; }
  return {
    sfx, ensure, startMusic, stopMusic,
    get vol() { return st.vol; }, set vol(v) { st.vol = v; apply(); save(); },
    get muted() { return st.muted; }, set muted(v) { st.muted = v; apply(); save(); },
    get music() { return st.music; }, set music(v) { st.music = v; save(); if (v) startMusic(); else stopMusic(); },
  };
}
