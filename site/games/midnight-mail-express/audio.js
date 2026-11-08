// Web Audio の短い効果音と簡易BGM。最初のユーザー操作の後にだけ鳴る。外部ファイルなし。
export function createSound() {
  let ac = null, muted = false, bgm = null, step = 0;
  function ensure() {
    if (muted) return null;
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }
  function tone(f, d, type = 'sine', v = 0.1, delay = 0, to = null) {
    const c = ensure(); if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.05);
  }
  const NOTES = [220, 261.6, 329.6, 392, 329.6, 261.6, 196, 246.9, 293.7, 392, 293.7, 246.9];
  return {
    lever() { tone(180, 0.08, 'square', 0.07); tone(90, 0.12, 'triangle', 0.1, 0.03); },
    paper() { tone(900, 0.05, 'triangle', 0.04, 0, 400); },
    lock() { tone(140, 0.12, 'square', 0.06); },
    arrive() { tone(523, 0.14, 'sine', 0.08); tone(392, 0.2, 'sine', 0.08, 0.12); },
    good() { tone(660, 0.12, 'triangle', 0.1); tone(880, 0.12, 'triangle', 0.1, 0.09); tone(1175, 0.22, 'triangle', 0.1, 0.18); },
    ok() { tone(587, 0.12, 'triangle', 0.1); tone(740, 0.2, 'triangle', 0.1, 0.1); },
    bad() { tone(160, 0.3, 'sawtooth', 0.08, 0, 90); },
    board() { tone(330, 0.08, 'sine', 0.05); },
    click() { tone(500, 0.05, 'triangle', 0.05); },
    setMuted(m) { muted = m; if (m) this.stopBgm(); },
    isMuted() { return muted; },
    startBgm() {
      if (bgm || muted) return;
      bgm = setInterval(() => { const f = NOTES[step++ % NOTES.length]; tone(f, 0.5, 'sine', 0.035); if (step % 4 === 1) tone(f / 2, 1.2, 'triangle', 0.03); }, 480);
    },
    stopBgm() { if (bgm) { clearInterval(bgm); bgm = null; } },
  };
}
