// Web Audio だけで作る効果音とBGM（外部素材なし）。
const PENTA = [0, 2, 4, 7, 9]; // ドレミソラ
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

export function createAudio(storage) {
  let ctx = null; let master = null; let bgmTimer = null; let level = 0; let beat = 0;
  const st = { muted: false, vol: 0.6 };
  try { Object.assign(st, JSON.parse(storage.getItem('wind-garden:audio') || '{}')); } catch { /* 保存なしでも動く */ }
  const save = () => { try { storage.setItem('wind-garden:audio', JSON.stringify(st)); } catch { /* 保存できなくてもよい */ } };
  const apply = () => { if (master) master.gain.value = st.muted ? 0 : st.vol * 0.5; };
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination); apply();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  function tone(freq, { t = 0, dur = 0.4, type = 'sine', gain = 0.3, slide = 0 } = {}) {
    if (!ensure() || st.muted) return;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    const t0 = ctx.currentTime + t;
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, { gain = 0.2, f0 = 400, f1 = 1800 } = {}) {
    if (!ensure() || st.muted) return;
    const len = Math.floor(ctx.sampleRate * dur); const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, ctx.currentTime); f.frequency.exponentialRampToValueAtTime(f1, ctx.currentTime + dur);
    const g = ctx.createGain(); g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(master); s.start();
  }
  const note = (i) => 60 + PENTA[i % 5] + 12 * Math.floor(i / 5);
  return {
    state: st,
    unlock() { ensure(); this.startBgm(); },
    step() { tone(midi(72 + (Math.random() * 3 | 0) * 2), { dur: 0.08, gain: 0.05, type: 'triangle' }); },
    bump() { tone(midi(64), { dur: 0.18, gain: 0.12, type: 'triangle', slide: 0.8 }); tone(midi(59), { t: 0.07, dur: 0.18, gain: 0.1, type: 'triangle', slide: 0.8 }); },
    whoosh() { noise(0.9, { gain: 0.25, f0: 300, f1: 1600 }); tone(midi(55), { dur: 0.6, gain: 0.06, slide: 1.5 }); },
    bell() { tone(midi(88), { dur: 1.2, gain: 0.1 }); tone(midi(95), { t: 0.05, dur: 1, gain: 0.05 }); },
    bloom() { [0, 2, 4, 5].forEach((i, k) => tone(midi(note(i + 5)), { t: k * 0.09, dur: 0.6, gain: 0.12 })); },
    found() { tone(midi(84), { dur: 0.5, gain: 0.08 }); tone(midi(91), { t: 0.12, dur: 0.6, gain: 0.07 }); },
    collect(n) { const b = (n * 2) % 10; [0, 1, 2, 3].forEach((k) => tone(midi(note(b + k * 2 + 3)), { t: k * 0.08, dur: 0.5, gain: 0.14 })); },
    gate() { [0, 2, 4, 7].forEach((i, k) => tone(midi(55 + PENTA[i % 5] + 12 * (i > 4 ? 1 : 0)), { t: k * 0.12, dur: 0.9, gain: 0.1 })); },
    finale() { for (let i = 0; i < 15; i++) tone(midi(note(i + 2)), { t: i * 0.16, dur: 1.4, gain: 0.1 }); },
    setLevel(n) { level = n; },
    startBgm() {
      if (bgmTimer || !ensure()) return;
      bgmTimer = setInterval(() => {
        if (st.muted || document.hidden) return;
        beat++;
        // やさしい伴奏：4拍ごとに和音、集めた雲の数だけ旋律の声が増える
        if (beat % 4 === 1) [0, 2, 4].forEach((i) => tone(midi(48 + PENTA[(i + (beat >> 2)) % 5]), { dur: 2.4, gain: 0.05, type: 'sine' }));
        const voices = 1 + Math.floor(level / 3);
        for (let v = 0; v < voices; v++) {
          if (Math.random() < 0.55) tone(midi(note(3 + ((beat * 3 + v * 4 + (Math.random() * 3 | 0)) % 10))), { t: v * 0.05, dur: 0.9, gain: 0.05, type: v % 2 ? 'triangle' : 'sine' });
        }
      }, 650);
    },
    setMuted(m) { st.muted = m; apply(); save(); if (!m) this.unlock(); },
    setVol(v) { st.vol = v; apply(); save(); },
  };
}
