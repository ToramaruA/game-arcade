// WebAudio のガラス音と、柔らかな短い BGM。外部ファイルなし。
let ctx = null; let master = null; let bgmTimer = null; let muted = false;

function ensure() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  } catch { ctx = null; }
  return ctx;
}

function tone(freq, t0, dur, { type = 'sine', vol = 0.15, attack = 0.005 } = {}) {
  if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

// ガラスの響き（基音＋高い倍音）
function glass(freq, t0, vol = 0.12) {
  tone(freq, t0, 1.2, { vol });
  tone(freq * 2.76, t0, 0.6, { vol: vol * 0.45 });
  tone(freq * 5.4, t0, 0.25, { vol: vol * 0.2 });
}

export const sfx = {
  unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); },
  tap() { if (!ensure() || muted) return; tone(880, ctx.currentTime, 0.08, { vol: 0.05, type: 'triangle' }); },
  pick() { if (!ensure() || muted) return; const t = ctx.currentTime; glass(1046, t); glass(1568, t + 0.09, 0.08); },
  connect() { if (!ensure() || muted) return; const t = ctx.currentTime; [784, 988, 1175, 1568].forEach((fq, i) => glass(fq, t + i * 0.09, 0.1)); },
  miss() { if (!ensure() || muted) return; const t = ctx.currentTime; tone(392, t, 0.25, { vol: 0.08, type: 'triangle' }); tone(370, t + 0.12, 0.3, { vol: 0.07, type: 'triangle' }); },
  flag() { if (!ensure() || muted) return; const t = ctx.currentTime; [523, 659, 784].forEach((fq, i) => tone(fq, t + i * 0.08, 0.4, { vol: 0.08, type: 'triangle' })); },
  key() { if (!ensure() || muted) return; const t = ctx.currentTime; glass(1318, t, 0.1); glass(1760, t + 0.15, 0.08); },
  stamp() { if (!ensure() || muted) return; tone(196, ctx.currentTime, 0.18, { vol: 0.14, type: 'square' }); },
  crack() { if (!ensure() || muted) return; const t = ctx.currentTime; tone(2600, t, 0.06, { vol: 0.08, type: 'square' }); tone(90, t + 0.03, 0.9, { vol: 0.14, type: 'sawtooth' }); [1568, 2093, 1319, 2637, 1760, 2349].forEach((fq, i) => glass(fq, t + 0.25 + i * 0.13, 0.06)); },
  snap() { if (!ensure() || muted) return; const t = ctx.currentTime; tone(2200, t, 0.05, { vol: 0.06, type: 'square' }); tone(140, t + 0.02, 0.4, { vol: 0.1, type: 'sawtooth' }); },
};

// ゆっくりした朝の和音（8秒ごと）
const CHORDS = [[523, 659, 784], [440, 554, 659], [587, 740, 880], [494, 587, 740]];
export function startBgm() {
  if (bgmTimer || !ensure()) return;
  let i = 0;
  const play = () => {
    if (muted || !ctx) return;
    const t = ctx.currentTime;
    CHORDS[i % CHORDS.length].forEach((fq, k) => tone(fq / 2, t + k * 0.6, 3.5, { vol: 0.025, attack: 0.8 }));
    glass(CHORDS[i % CHORDS.length][2] * 2, t + 2.2, 0.025);
    i += 1;
  };
  play();
  bgmTimer = setInterval(play, 4800);
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}
