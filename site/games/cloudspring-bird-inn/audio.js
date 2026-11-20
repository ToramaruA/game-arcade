// 小さな効果音（WebAudio で合成。外部ファイルなし）
let ac = null;
let muted = false;
export function setMuted(v) { muted = v; }
export function unlock() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; }
}
function tone(freq, dur, type = 'sine', vol = 0.08, slide = 0, delay = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(); const g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.05);
}
export const sfx = {
  valve: (up) => tone(up ? 420 : 300, 0.12, 'sine', 0.07, up ? 220 : -120),
  plop: () => { tone(620, 0.08, 'sine', 0.06, -300); tone(300, 0.15, 'sine', 0.04, -100, 0.05); },
  chirp: () => { tone(1800, 0.06, 'triangle', 0.04, 600); tone(2100, 0.06, 'triangle', 0.035, 500, 0.08); },
  happy: () => { tone(660, 0.12, 'triangle', 0.06); tone(880, 0.12, 'triangle', 0.06, 0, 0.1); tone(1320, 0.2, 'triangle', 0.05, 0, 0.2); },
  sad: () => tone(330, 0.3, 'sine', 0.05, -120),
  paper: () => tone(200, 0.08, 'square', 0.025, -60),
  wind: () => tone(180, 0.8, 'sawtooth', 0.015, -80),
  error: () => tone(160, 0.18, 'square', 0.03),
};
