// 一枚絵（ルウの記憶）とタイトルの背景。Canvas だけで描く。外部素材なし。
const h = (a, b, s = 0) => { let x = (a * 374761393 + b * 668265263 + s * 1274126177) | 0; x = (x ^ (x >>> 13)) * 1274126177; return ((x ^ (x >>> 16)) >>> 0) / 4294967295; };

function sky(c, w, ht, top, bot, t, n = 70) {
  const g = c.createLinearGradient(0, 0, 0, ht); g.addColorStop(0, top); g.addColorStop(1, bot); c.fillStyle = g; c.fillRect(0, 0, w, ht);
  for (let i = 0; i < n; i++) { const a = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.5 + i)); c.fillStyle = `rgba(255,248,225,${a * h(i, 4)})`; c.fillRect(h(i, 1) * w, h(i, 2) * ht * 0.7, 1.5, 1.5); }
}
function moon(c, x, y, r, cut = 0.45, glow = 0.45) {
  const g = c.createRadialGradient(x, y, r * 0.3, x, y, r * 4); g.addColorStop(0, `rgba(255,246,215,${glow})`); g.addColorStop(1, 'rgba(255,246,215,0)'); c.fillStyle = g; c.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
  c.save(); c.beginPath(); c.rect(x - r * 2, y - r * 2, r * 4, r * 4); if (cut) c.arc(x + r * cut, y - r * 0.15, r * 0.92, 0, 7); c.clip('evenodd');
  c.fillStyle = '#fbf3da'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.restore();
}
function town(c, w, ht, base, col, lit = 0.5, seed = 1) {
  c.fillStyle = col;
  for (let i = 0; i < 14; i++) {
    const bw = w / 12, bx = i * bw - bw * 0.3, bh = ht * (0.12 + h(i, seed) * 0.16);
    c.fillRect(bx, base - bh, bw * 0.92, bh + ht);
    if (h(i, seed + 1) > 0.5) { c.beginPath(); c.moveTo(bx, base - bh); c.lineTo(bx + bw * 0.46, base - bh - bw * 0.4); c.lineTo(bx + bw * 0.92, base - bh); c.fill(); }
    for (let k = 0; k < 4; k++) if (h(i, k + 9 + seed) < lit) { c.fillStyle = 'rgba(255,200,110,0.85)'; c.fillRect(bx + bw * (0.18 + (k % 2) * 0.4), base - bh + bh * (0.25 + Math.floor(k / 2) * 0.3), bw * 0.16, bw * 0.16); c.fillStyle = col; }
  }
}
function person(c, x, y, s, col, opts = {}) {
  c.fillStyle = col;
  c.beginPath(); c.arc(x, y - s * 0.82, s * 0.16, 0, 7); c.fill();
  c.beginPath(); c.moveTo(x - s * 0.08, y - s * 0.66); c.quadraticCurveTo(x - s * (opts.dress ? 0.34 : 0.2), y - s * 0.2, x - s * (opts.dress ? 0.3 : 0.16), y);
  c.lineTo(x + s * (opts.dress ? 0.3 : 0.16), y); c.quadraticCurveTo(x + s * (opts.dress ? 0.34 : 0.2), y - s * 0.2, x + s * 0.08, y - s * 0.66); c.fill();
  if (opts.hair) { c.beginPath(); c.ellipse(x + s * 0.06, y - s * 0.7, s * 0.12, s * 0.24, 0.3, 0, 7); c.fill(); }
  if (opts.scarf) { c.fillStyle = '#e0364a'; c.fillRect(x - s * 0.13, y - s * 0.68, s * 0.26, s * 0.06); c.beginPath(); c.moveTo(x - s * 0.1, y - s * 0.65); c.lineTo(x - s * 0.36, y - s * 0.55); c.lineTo(x - s * 0.08, y - s * 0.6); c.fill(); }
}
function glowDot(c, x, y, r, col) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
function vignette(c, w, ht, col = 'rgba(20,10,0,0.55)') { const g = c.createRadialGradient(w / 2, ht / 2, Math.min(w, ht) * 0.3, w / 2, ht / 2, Math.max(w, ht) * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, col); c.fillStyle = g; c.fillRect(0, 0, w, ht); }

const SCENES = [
  // 1 知らない歌：手のひらのかけらと、立ちのぼる音
  (c, w, ht, t) => {
    sky(c, w, ht, '#1a1440', '#3a2a50', t, 40);
    const x = w * 0.5, y = ht * 0.62;
    glowDot(c, x, y, ht * 0.5, 'rgba(255,230,170,0.45)');
    c.fillStyle = '#2a1a30'; c.beginPath(); c.ellipse(x - w * 0.08, y + ht * 0.12, w * 0.16, ht * 0.08, -0.3, 0, 7); c.ellipse(x + w * 0.08, y + ht * 0.12, w * 0.16, ht * 0.08, 0.3, 0, 7); c.fill();
    moon(c, x, y, ht * 0.07, 0.4, 0.8);
    c.strokeStyle = 'rgba(255,235,190,0.8)'; c.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) { const yy = y - ht * (0.15 + k * 0.1) - (t * 12 % 20); c.beginPath(); for (let i = 0; i <= 30; i++) { const xx = x - w * 0.3 + i * w * 0.02; const v = yy + Math.sin(i * 0.5 + t * 2 + k) * 5; i ? c.lineTo(xx, v) : c.moveTo(xx, v); } c.stroke(); }
    c.fillStyle = 'rgba(255,240,200,0.9)'; c.font = `${Math.round(ht * 0.08)}px serif`;
    ['♪', '♫', '♪'].forEach((n, i) => c.fillText(n, x - w * 0.22 + i * w * 0.2, y - ht * (0.3 + 0.08 * Math.sin(t + i))));
  },
  // 2 窓辺の灯り：夜の窓と、呼ぶ人影
  (c, w, ht, t) => {
    sky(c, w, ht, '#0e1236', '#2a2048', t);
    moon(c, w * 0.18, ht * 0.2, ht * 0.07, 0.4);
    c.fillStyle = '#1a1028'; c.fillRect(w * 0.3, ht * 0.18, w * 0.5, ht * 0.82);
    c.beginPath(); c.moveTo(w * 0.26, ht * 0.2); c.lineTo(w * 0.55, ht * 0.02); c.lineTo(w * 0.84, ht * 0.2); c.fill();
    const wx = w * 0.43, wy = ht * 0.36, ww = w * 0.24, wh = ht * 0.34;
    glowDot(c, wx + ww / 2, wy + wh / 2, ht * 0.45, 'rgba(255,190,100,0.5)');
    c.fillStyle = '#ffcf7a'; c.fillRect(wx, wy, ww, wh);
    person(c, wx + ww * 0.55, wy + wh, wh * 0.85, '#5a3418', { dress: true, hair: true });
    c.fillStyle = '#1a1028'; c.fillRect(wx + ww / 2 - 2, wy, 4, wh); c.fillRect(wx, wy + wh / 2 - 2, ww, 4);
    c.strokeStyle = '#3a2410'; c.lineWidth = 3; c.strokeRect(wx, wy, ww, wh);
    c.fillStyle = 'rgba(255,220,160,0.9)'; c.font = `italic ${Math.round(ht * 0.07)}px serif`; c.textAlign = 'center';
    c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2); c.fillText('「ルウ」', wx - w * 0.12, wy + wh * 0.3); c.globalAlpha = 1; c.textAlign = 'start';
  },
  // 3 月時計の下で：大きな月時計を見上げる、手をつないだ二人
  (c, w, ht, t) => {
    sky(c, w, ht, '#101848', '#2a3060', t);
    const cx = w * 0.5, cy = ht * 0.38, r = ht * 0.3;
    glowDot(c, cx, cy, r * 2, 'rgba(220,220,255,0.3)');
    c.fillStyle = '#e8e4d0'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
    c.strokeStyle = '#c9a24a'; c.lineWidth = 4; c.stroke();
    c.fillStyle = '#3a3a60'; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; c.beginPath(); c.arc(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82, r * 0.04, 0, 7); c.fill(); }
    c.strokeStyle = '#2a2a50'; c.lineWidth = 3; const a = t * 0.3; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * r * 0.65, cy + Math.sin(a) * r * 0.65); c.stroke();
    c.fillStyle = '#1a1838'; c.fillRect(0, ht * 0.8, w, ht * 0.2);
    person(c, w * 0.47, ht * 0.86, ht * 0.32, '#0e0c22', { dress: true, hair: true });
    person(c, w * 0.56, ht * 0.86, ht * 0.18, '#0e0c22', { scarf: true });
    c.strokeStyle = '#0e0c22'; c.lineWidth = 3; c.beginPath(); c.moveTo(w * 0.495, ht * 0.72); c.lineTo(w * 0.535, ht * 0.76); c.stroke();
  },
  // 4 明かりの消えた夜：火の色の空、消えていく窓、館へ歩く母
  (c, w, ht, t) => {
    sky(c, w, ht, '#1a0a14', '#5a2010', t, 20);
    glowDot(c, w * 0.2, ht * 0.75, ht * 0.7, 'rgba(255,110,40,0.45)');
    town(c, w, ht, ht * 0.8, '#120810', 0.15 + 0.1 * Math.sin(t), 3);
    c.fillStyle = '#e8e0f8'; c.beginPath(); c.moveTo(w * 0.72, ht * 0.8); c.lineTo(w * 0.72, ht * 0.42); c.quadraticCurveTo(w * 0.82, ht * 0.28, w * 0.92, ht * 0.42); c.lineTo(w * 0.92, ht * 0.8); c.fill();
    glowDot(c, w * 0.82, ht * 0.5, ht * 0.35, 'rgba(200,210,255,0.4)');
    c.fillStyle = '#0a0408'; c.fillRect(0, ht * 0.8, w, ht);
    person(c, w * 0.6, ht * 0.92, ht * 0.26, '#000', { dress: true, hair: true });
    for (let i = 0; i < 6; i++) glowDot(c, w * (0.62 + i * 0.03), ht * (0.68 - i * 0.03) - (t * 10 % 12), 6, 'rgba(255,240,200,0.8)');
  },
  // 5 十二人目のとなり：仮面の十二人と、ひとり残された子
  (c, w, ht, t) => {
    sky(c, w, ht, '#0a0820', '#22183a', t, 30);
    moon(c, w * 0.5, ht * 0.22, ht * 0.11, 0, 0.5);
    c.fillStyle = '#100c20'; c.fillRect(0, ht * 0.78, w, ht);
    for (let i = 0; i < 12; i++) {
      const x = w * (0.08 + i * 0.075), s = ht * 0.3, mom = i === 8;
      person(c, x, ht * 0.8, s, mom ? '#3a2a40' : '#16122a', { dress: mom, hair: mom });
      c.fillStyle = mom ? '#ffe2b0' : '#cfc8e8'; c.beginPath(); c.ellipse(x, ht * 0.8 - s * 0.82, s * 0.09, s * 0.11, 0, 0, 7); c.fill();
      if (mom) glowDot(c, x, ht * 0.8 - s * 0.5, s * 0.6, 'rgba(255,200,140,0.35)');
    }
    person(c, w * 0.88, ht * 0.97, ht * 0.16, '#0a0816', { scarf: true });
    c.fillStyle = 'rgba(10,6,20,0.9)'; c.beginPath(); c.moveTo(w * 0.7, ht * 0.0); c.quadraticCurveTo(w * 0.95, ht * 0.1 + Math.sin(t) * 6, w * 1.05, ht * 0.35); c.lineTo(w * 1.05, 0); c.fill();
  },
  // 6 頭領の狙い：月と街をおおう巨大な鴉の影、向き合うルウ
  (c, w, ht, t) => {
    sky(c, w, ht, '#14081a', '#3a1420', t, 30);
    moon(c, w * 0.5, ht * 0.32, ht * 0.18, 0, 0.6);
    c.fillStyle = 'rgba(8,2,10,0.92)'; const fl = Math.sin(t * 1.4) * ht * 0.03;
    c.beginPath(); c.moveTo(w * 0.5, ht * 0.38);
    c.quadraticCurveTo(w * 0.25, ht * 0.05 + fl, w * -0.05, ht * 0.25 - fl); c.quadraticCurveTo(w * 0.2, ht * 0.32, w * 0.42, ht * 0.5);
    c.lineTo(w * 0.58, ht * 0.5); c.quadraticCurveTo(w * 0.8, ht * 0.32, w * 1.05, ht * 0.25 - fl); c.quadraticCurveTo(w * 0.75, ht * 0.05 + fl, w * 0.5, ht * 0.38); c.fill();
    c.fillStyle = '#ff3a50'; c.beginPath(); c.arc(w * 0.47, ht * 0.4, ht * 0.012, 0, 7); c.arc(w * 0.53, ht * 0.4, ht * 0.012, 0, 7); c.fill();
    town(c, w, ht, ht * 0.86, '#0a0408', 0.25, 5);
    person(c, w * 0.5, ht * 0.98, ht * 0.2, '#000', { scarf: true });
    glowDot(c, w * 0.5, ht * 0.86, ht * 0.15, 'rgba(255,240,200,0.5)');
  },
];

export function drawMemory(c, i, w, ht, t) {
  c.save(); SCENES[i](c, w, ht, t); vignette(c, w, ht); c.restore();
  // セピアの紙の縁
  c.strokeStyle = 'rgba(232,196,138,0.8)'; c.lineWidth = 2; c.strokeRect(6, 6, w - 12, ht - 12);
}

// タイトルの背景：雲に浮かぶ月の館と、屋根の上のルウ
export function drawTitleArt(c, w, ht, t, motes = true) {
  sky(c, w, ht, '#0a0828', '#2a1e58', t, 120);
  const mr = Math.min(w, ht) * 0.17, mx = w * 0.5, my = ht * 0.3;
  moon(c, mx, my, mr, 0, 0.55);
  // 月の模様
  c.fillStyle = 'rgba(200,190,170,0.25)'; [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.22], [-0.05, 0.35, 0.12]].forEach(([dx, dy, r]) => { c.beginPath(); c.arc(mx + dx * mr, my + dy * mr, r * mr, 0, 7); c.fill(); });
  // 雲
  const cloud = (y, a, sp, col) => { c.fillStyle = col; for (let i = 0; i < 9; i++) { const x = ((i * 0.16 + t * sp) % 1.4 - 0.2) * w; c.beginPath(); c.ellipse(x, y + Math.sin(i) * 8, w * 0.16, ht * 0.04, 0, 0, 7); c.fill(); } void a; };
  cloud(ht * 0.4, 1, 0.004, 'rgba(120,100,200,0.25)');
  // 館（浮かぶ島）
  const bx = w * 0.5, by = ht * 0.47, s = Math.min(w * 0.55, ht * 0.32);
  c.fillStyle = '#120c2a';
  c.beginPath(); c.moveTo(bx - s * 0.7, by); c.quadraticCurveTo(bx, by + s * 0.5, bx + s * 0.7, by); c.fill();
  c.fillRect(bx - s * 0.5, by - s * 0.35, s, s * 0.36);
  c.beginPath(); c.moveTo(bx - s * 0.56, by - s * 0.35); c.lineTo(bx, by - s * 0.55); c.lineTo(bx + s * 0.56, by - s * 0.35); c.fill();
  c.beginPath(); c.arc(bx, by - s * 0.55, s * 0.14, Math.PI, 0); c.fill(); c.fillRect(bx - 2, by - s * 0.85, 4, s * 0.2);
  for (let i = 0; i < 6; i++) c.fillRect(bx - s * 0.45 + i * s * 0.18, by - s * 0.33, s * 0.06, s * 0.33);
  for (let i = 0; i < 5; i++) { const wx = bx - s * 0.36 + i * s * 0.18; c.fillStyle = `rgba(190,200,255,${0.5 + 0.3 * Math.sin(t * 2 + i)})`; c.fillRect(wx, by - s * 0.26, s * 0.08, s * 0.14); c.fillStyle = '#120c2a'; }
  glowDot(c, bx, by - s * 0.2, s * 0.9, 'rgba(160,150,255,0.18)');
  // 屋根の上のルウ
  person(c, bx + s * 0.02, by - s * 0.69, s * 0.12, '#05030f', { scarf: true });
  cloud(ht * 0.52, 1, 0.007, 'rgba(90,70,170,0.35)');
  // 光の粒
  if (motes) for (let i = 0; i < 50; i++) { const x = h(i, 11) * w + Math.sin(t * 0.5 + i) * 10, y = ((h(i, 12) * ht - t * (8 + h(i, 13) * 18)) % ht + ht) % ht; glowDot(c, x, y, 4 + h(i, 14) * 6, `rgba(255,236,190,${0.25 + 0.3 * h(i, 15)})`); }
}
