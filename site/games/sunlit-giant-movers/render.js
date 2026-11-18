// 描画（Canvas 2D）。真昼の粘土模型の箱庭を、等角投影で描く。外部素材なし。
import { KINDS, CAPACITY, isOpen, padTarget, delivered, hasSeed, allDelivered, loadOf, isHeavy } from './logic.js';

export const TW = 64; export const TH = 32; export const HZ = 20; const BASE = 0.7;

// 動物の見た目（丸い部品の組み合わせ）
export const LOOKS = {
  bird: { body: '#ffd34d', belly: '#fff2b0', ear: 'none', tail: 'feather', nose: '#ff9a3c', roof: '#ff9a3c', beak: true },
  hedgehog: { body: '#b8875a', belly: '#f6dfc0', ear: 'small', tail: 'none', nose: '#4a3428', roof: '#c8a070', spikes: true },
  mole: { body: '#7c6a68', belly: '#a8918c', ear: 'none', tail: 'stub', nose: '#ff9db0', roof: '#9b8a88' },
  squirrel: { body: '#ee8c3e', belly: '#ffe0bd', ear: 'point', tail: 'bushy', nose: '#5a3020', roof: '#ee8c3e' },
  rabbit: { body: '#fbf4ec', belly: '#ffffff', ear: 'long', tail: 'puff', nose: '#ff9db0', roof: '#ff9db0' },
  capybara: { body: '#b27c50', belly: '#c99a6c', ear: 'small', tail: 'none', nose: '#5a3a26', roof: '#b27c50', boxy: true },
  raccoon: { body: '#9c9ca8', belly: '#e6e6ec', ear: 'point', tail: 'ring', nose: '#333', roof: '#6f7cff', mask: true },
  koala: { body: '#a9adb9', belly: '#eef0f4', ear: 'fluff', tail: 'none', nose: '#3c3c46', roof: '#7fc2a2' },
  piglet: { body: '#ffb3c1', belly: '#ffd0da', ear: 'flop', tail: 'curl', nose: '#ff8aa2', roof: '#ff7a9a', snout: true },
  tapir: { body: '#3f3f4c', belly: '#f2f2f2', ear: 'small', tail: 'stub', nose: '#3f3f4c', roof: '#5bc0be', band: true, trunk: true },
  wombat: { body: '#8d6c4b', belly: '#a98a68', ear: 'small', tail: 'none', nose: '#3d2a1e', roof: '#c58b3d', boxy: true },
  hippo: { body: '#a99bc0', belly: '#d7cbe6', ear: 'small', tail: 'stub', nose: '#7d6d98', roof: '#b58cff', snout: true, boxy: true },
};
const SIZE = { 1: 0.62, 2: 0.8, 3: 0.98 };

export const THEMES = [
  { // 草原の亀
    skyTop: '#7ccaf5', skyBot: '#e4f6ff', hill1: '#a8dc7c', hill2: '#8ccc62', far: '#cfeab4',
    top: '#9ddb6c', topHi: '#c3ef94', side: '#d9925f', sideDark: '#b8744a', tuft: '#6fbb48', beast: 'turtle',
  },
  { // 砂丘のトカゲ
    skyTop: '#86c9f2', skyBot: '#fff1d8', hill1: '#f3d39a', hill2: '#e9bd78', far: '#f8e3bd',
    top: '#f3d59b', topHi: '#fbe9c2', side: '#e58a62', sideDark: '#c26a46', tuft: '#a7c96a', beast: 'lizard',
  },
  { // 花畑の象
    skyTop: '#8fd0f7', skyBot: '#fff0f2', hill1: '#b5e08a', hill2: '#f2a9b8', far: '#e5f3c9',
    top: '#a6df78', topHi: '#cdf2a2', side: '#ef8c76', sideDark: '#c96a58', tuft: '#ff8fb1', beast: 'elephant',
  },
];

export const iso = (x, y, h) => ({ x: (x - y) * TW / 2, y: (x + y) * TH / 2 - h * HZ });
const rnd = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function ell(ctx, x, y, rx, ry, fill, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16; let g = (n >> 8) & 255; let b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// ---------- 背景 ----------
export function drawSky(ctx, w, h, theme, t, reduce) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, theme.skyTop); g.addColorStop(0.75, theme.skyBot); g.addColorStop(1, theme.skyBot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // 太陽のにじみ
  const sx = w * 0.82; const sy = h * 0.08;
  const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, Math.max(w, h) * 0.45);
  sg.addColorStop(0, 'rgba(255,250,215,.95)'); sg.addColorStop(0.15, 'rgba(255,246,200,.55)'); sg.addColorStop(1, 'rgba(255,246,200,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
  // 雲（白いもこもこ）
  const drift = reduce ? 0 : t * 6;
  for (let i = 0; i < 6; i++) {
    const cx = ((rnd(i) * w * 1.4 + drift * (0.4 + rnd(i + 9))) % (w + 240)) - 120;
    const cy = h * (0.06 + rnd(i + 3) * 0.32);
    const s = 0.6 + rnd(i + 5) * 0.9;
    cloud(ctx, cx, cy, s);
  }
  // 遠くの丘
  hills(ctx, w, h, h * 0.62, theme.far, 0.9, 1);
  hills(ctx, w, h, h * 0.72, theme.hill1, 1.3, 2);
  hills(ctx, w, h, h * 0.84, theme.hill2, 1.7, 3);
}
function cloud(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(160,190,220,.25)';
  for (const [dx, dy, r] of [[-38, 10, 22], [-8, 4, 30], [26, 10, 24], [52, 14, 16]]) { ctx.beginPath(); ctx.arc(dx, dy + 6, r, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#ffffff';
  for (const [dx, dy, r] of [[-38, 10, 22], [-8, 0, 30], [26, 8, 24], [52, 14, 16], [8, 16, 22]]) { ctx.beginPath(); ctx.arc(dx, dy, r, 0, 7); ctx.fill(); }
  ctx.restore();
}
function hills(ctx, w, h, base, color, amp, seed) {
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w + 20; x += 20) {
    const y = base - (Math.sin(x / (90 * amp) + seed) * 18 + Math.sin(x / 37 + seed * 3) * 6) * amp;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  // 草のぽつぽつ
  ctx.fillStyle = shade(color, -0.12);
  for (let i = 0; i < 26; i++) {
    const x = rnd(i * 7 + seed) * w; const y = base + 8 + rnd(i * 3 + seed) * (h - base);
    ell(ctx, x, y, 6 * amp, 3 * amp, shade(color, -0.1));
  }
}

// ---------- 巨獣（盤面の下） ----------
// b: 盤面の画面上の外接矩形（ワールド座標）
export function drawBeast(ctx, kind, b, t, reduce, opts = {}) {
  const cx = (b.x0 + b.x1) / 2; const cy = (b.y0 + b.y1) / 2 + 46;
  const rx = (b.x1 - b.x0) / 2 + 84; const ry = Math.min((b.y1 - b.y0) / 2 + 26, rx * 0.62);
  const breathe = reduce ? 0 : Math.sin(t * 1.3) * 2;
  const sneeze = opts.sneeze || 0;
  ctx.save();
  // 地面の影
  ell(ctx, cx, cy + ry * 0.95, rx * 1.05, ry * 0.32, 'rgba(70,90,40,.18)');
  if (kind === 'turtle') {
    // 尾
    ell(ctx, cx + rx * 0.96, cy + ry * 0.42, 26, 14, '#c4bb84', -0.4);
    // 脚（太い粘土の柱）
    for (const [dx, dy, back] of [[-0.62, 0.62, 1], [0.66, 0.6, 1], [-0.36, 0.86, 0], [0.4, 0.86, 0]]) {
      const lx = cx + rx * dx; const ly = cy + ry * dy;
      roundRect(ctx, lx - 30, ly - 10, 60, 56, 24); ctx.fillStyle = back ? '#b5ab76' : '#c9c08a'; ctx.fill();
      ell(ctx, lx, ly + 44, 32, 11, back ? '#a39a66' : '#b3aa74');
      for (let k = -1; k <= 1; k++) ell(ctx, lx + k * 14, ly + 50, 7, 5, '#f2ead0');
    }
    // 頭（左手前・昼寝中）
    const hx = cx - rx * 1.0; const hy = cy + ry * 0.42 + breathe - sneeze * 8;
    ell(ctx, hx + 46, hy - 4, 44, 32, '#c4bb84');
    ell(ctx, hx, hy, 56, 42, '#cfc690'); ell(ctx, hx - 12, hy - 14, 24, 13, '#e1dbac');
    ell(ctx, hx - 30, hy + 12, 10, 6, 'rgba(255,140,140,.35)');
    ctx.strokeStyle = '#6b6440'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(hx - 20, hy - 6, 9, 0.25, Math.PI - 0.25); ctx.stroke(); // 閉じた目
    ctx.beginPath(); ctx.moveTo(hx - 52, hy + 10); ctx.quadraticCurveTo(hx - 42, hy + 18, hx - 30, hy + 16); ctx.stroke();
    if (sneeze > 0) { ctx.fillStyle = `rgba(255,255,255,${sneeze})`; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(hx - 70 - i * 16 * sneeze, hy + 6 - i * 5, 8 + i * 3, 0, 7); ctx.fill(); } }
    else if (!reduce) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = 'bold 22px sans-serif'; const zt = (t * 0.5) % 1; ctx.globalAlpha = 1 - zt; ctx.fillText('z', hx - 40 - zt * 10, hy - 50 - zt * 30); ctx.globalAlpha = 1; }
    // 甲羅（ドーム）
    ell(ctx, cx, cy + 26, rx * 1.02, ry * 1.02, '#4f8a3a');
    const g = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.5, 10, cx, cy, rx * 1.05);
    g.addColorStop(0, '#c4ea98'); g.addColorStop(0.6, '#8cc664'); g.addColorStop(1, '#5f9a44');
    ell(ctx, cx, cy, rx, ry, g);
    // 甲板（六角）
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.clip();
    ctx.strokeStyle = 'rgba(70,120,50,.5)'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    const hs = Math.max(40, rx * 0.2);
    for (let row = -4; row <= 4; row++) for (let col = -5; col <= 5; col++) {
      const px = cx + col * hs * 1.5; const py = cy + row * hs * 0.9 + (col % 2 ? hs * 0.45 : 0);
      ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; ctx.lineTo(px + Math.cos(a) * hs * 0.82, py + Math.sin(a) * hs * 0.5); } ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
    // ふち（甲羅のすそ）
    ctx.fillStyle = '#e9d58a';
    for (let k = 0; k < 18; k++) {
      const a = 0.12 + (k / 17) * (Math.PI - 0.24);
      ell(ctx, cx + Math.cos(a) * rx * 0.99, cy + Math.sin(a) * ry * 0.99 + 6, 20, 12, k % 2 ? '#e9d58a' : '#dcc677', a - Math.PI / 2);
    }
  } else if (kind === 'lizard') {
    // 尾（右奥へ長く）
    ctx.strokeStyle = '#d98c4f'; ctx.lineWidth = 46; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + rx * 0.6, cy + ry * 0.2);
    ctx.quadraticCurveTo(cx + rx * 1.35, cy + ry * 0.1 + breathe * 3, cx + rx * 1.25, cy - ry * 0.7); ctx.stroke();
    ctx.strokeStyle = '#e8a466'; ctx.lineWidth = 30; ctx.stroke();
    for (const [dx, dy] of [[-0.75, 0.55], [0.7, 0.6], [-0.5, 0.85], [0.42, 0.85]]) {
      ell(ctx, cx + rx * dx, cy + ry * dy + 14, rx * 0.12, ry * 0.16, '#c97c45');
      for (let k = -1; k <= 1; k++) ell(ctx, cx + rx * dx + k * 9, cy + ry * dy + 30, 6, 4, '#b86c38');
    }
    const hx = cx - rx * 1.0; const hy = cy + ry * 0.2 + breathe - sneeze * 6;
    ell(ctx, hx + 22, hy, 36, 26, '#e19a5c'); ell(ctx, hx - 12, hy + 4, 46, 24, '#eaa96c');
    ctx.fillStyle = '#3b2a1e'; ctx.beginPath(); ctx.arc(hx - 4, hy - 8, 4, 0, 7); ctx.fill();
    ctx.strokeStyle = '#b8683a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx - 50, hy + 10); ctx.lineTo(hx - 20, hy + 12); ctx.stroke();
    const g = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
    g.addColorStop(0, '#f6c27f'); g.addColorStop(1, '#d98a4e');
    ell(ctx, cx, cy + 18, rx, ry, '#c2733f'); ell(ctx, cx, cy, rx, ry, g);
    // 背びれ
    ctx.fillStyle = '#ff8a6b';
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + 0.25 + (i / 8) * (Math.PI - 0.5);
      const px = cx + Math.cos(a) * rx * 0.98; const py = cy + Math.sin(a) * ry * 0.98;
      ctx.beginPath(); ctx.moveTo(px - 14, py + 6); ctx.lineTo(px, py - 26); ctx.lineTo(px + 14, py + 6); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,240,200,.35)';
    for (let i = 0; i < 18; i++) ell(ctx, cx + (rnd(i) - 0.5) * rx * 1.6, cy + (rnd(i + 4) - 0.5) * ry * 1.4, 9, 6, 'rgba(255,236,190,.35)');
  } else {
    // 象：大きな耳に花畑、鼻
    for (const [dx, dy] of [[-0.6, 0.62], [0.6, 0.62], [-0.3, 0.86], [0.3, 0.86]]) {
      roundRect(ctx, cx + rx * dx - rx * 0.1, cy + ry * dy - 10, rx * 0.2, ry * 0.42, 18); ctx.fillStyle = '#a796ac'; ctx.fill();
      ell(ctx, cx + rx * dx, cy + ry * dy + ry * 0.4, rx * 0.1, 7, '#f4e6ea');
    }
    const g = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, 10, cx, cy, rx * 1.1);
    g.addColorStop(0, '#d9cbd8'); g.addColorStop(1, '#a796ac');
    // 耳（左右に広がる花畑）
    for (const s of [-1, 1]) {
      const ex = cx + s * rx * 0.95; const ey = cy - ry * 0.2 + breathe * s;
      ell(ctx, ex, ey + 10, rx * 0.42, ry * 0.75, '#9a88a0', s * 0.2);
      ell(ctx, ex, ey, rx * 0.42, ry * 0.75, '#c7b4c6', s * 0.2);
      ell(ctx, ex, ey, rx * 0.34, ry * 0.62, '#b4e08a', s * 0.2);
      for (let i = 0; i < 26; i++) {
        const a = rnd(i + (s > 0 ? 50 : 0)) * Math.PI * 2; const r = Math.sqrt(rnd(i + 20)) * 0.9;
        const fx = ex + Math.cos(a) * rx * 0.3 * r; const fy = ey + Math.sin(a) * ry * 0.55 * r;
        flower(ctx, fx, fy, 4 + rnd(i + 7) * 3, ['#ff7a9a', '#ffd34d', '#ffffff', '#ff9a6b'][i % 4]);
      }
    }
    ell(ctx, cx, cy + 18, rx, ry, '#8f7d96'); ell(ctx, cx, cy, rx, ry, g);
    // 頭と鼻（手前下）
    const hx = cx - rx * 0.05; const hy = cy + ry * 0.95 + breathe - sneeze * 4;
    ell(ctx, hx, hy, rx * 0.32, ry * 0.32, '#b6a5ba');
    ctx.strokeStyle = '#b6a5ba'; ctx.lineWidth = 26; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy + 10); ctx.quadraticCurveTo(hx + 10, hy + 70, hx - 40 - (reduce ? 0 : Math.sin(t) * 6), hy + 80); ctx.stroke();
    ctx.fillStyle = '#3a2f40'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + s * rx * 0.13, hy - 10, 4, 0, 7); ctx.fill(); }
  }
  ctx.restore();
}
export function flower(ctx, x, y, r, c) {
  ctx.fillStyle = c;
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.5, r * 0.55, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#ffcf3a'; ctx.beginPath(); ctx.arc(x, y, r * 0.38, 0, 7); ctx.fill();
}

// ---------- 盤面 ----------
export function boardBounds(level) {
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (const c of level.cells) {
    if (c.t === 'void') continue;
    const p = iso(c.x, c.y, c.h);
    x0 = Math.min(x0, p.x - TW / 2); x1 = Math.max(x1, p.x + TW / 2);
    y0 = Math.min(y0, p.y - 70); y1 = Math.max(y1, p.y + TH + (c.h + BASE) * HZ + 10);
  }
  return { x0, x1, y0, y1 };
}

function topFace(ctx, x, y, h) {
  const p = iso(x, y, h);
  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + TW / 2, p.y + TH / 2); ctx.lineTo(p.x, p.y + TH); ctx.lineTo(p.x - TW / 2, p.y + TH / 2); ctx.closePath();
  return p;
}
function block(ctx, c, theme, top) {
  const p = iso(c.x, c.y, c.h);
  const depth = (c.h + BASE) * HZ;
  // 左の側面
  ctx.beginPath(); ctx.moveTo(p.x - TW / 2, p.y + TH / 2); ctx.lineTo(p.x, p.y + TH); ctx.lineTo(p.x, p.y + TH + depth); ctx.lineTo(p.x - TW / 2, p.y + TH / 2 + depth); ctx.closePath();
  ctx.fillStyle = theme.side; ctx.fill();
  // 右の側面
  ctx.beginPath(); ctx.moveTo(p.x + TW / 2, p.y + TH / 2); ctx.lineTo(p.x, p.y + TH); ctx.lineTo(p.x, p.y + TH + depth); ctx.lineTo(p.x + TW / 2, p.y + TH / 2 + depth); ctx.closePath();
  ctx.fillStyle = theme.sideDark; ctx.fill();
  // 粘土の段（高さの目盛り）
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2;
  for (let k = 1; k <= c.h; k++) {
    const yy = p.y + TH + k * HZ - 2;
    ctx.beginPath(); ctx.moveTo(p.x - TW / 2 + 2, yy - TH / 2 + 1); ctx.lineTo(p.x, yy); ctx.lineTo(p.x + TW / 2 - 2, yy - TH / 2 + 1); ctx.stroke();
  }
  // 上面
  topFace(ctx, c.x, c.y, c.h);
  const g = ctx.createLinearGradient(p.x - TW / 2, p.y, p.x + TW / 2, p.y + TH);
  g.addColorStop(0, top || theme.topHi); g.addColorStop(1, top ? shade(top, -0.08) : theme.top);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(p.x - TW / 2 + 3, p.y + TH / 2); ctx.lineTo(p.x, p.y + 2); ctx.lineTo(p.x + TW / 2 - 3, p.y + TH / 2); ctx.stroke();
  return p;
}
function tufts(ctx, c, theme, p) {
  for (let k = 0; k < 3; k++) {
    const r1 = rnd(c.i * 3 + k); const r2 = rnd(c.i * 5 + k + 1);
    if (r1 < 0.45) continue;
    const x = p.x + (r1 - 0.5) * TW * 0.6; const y = p.y + TH / 2 + (r2 - 0.5) * TH * 0.5;
    if (theme.beast === 'elephant' && r2 > 0.5) flower(ctx, x, y, 3.2, r1 > 0.75 ? '#ff7a9a' : '#ffffff');
    else {
      ctx.strokeStyle = theme.tuft; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x - 4, y - 5); ctx.moveTo(x, y); ctx.lineTo(x, y - 7); ctx.moveTo(x + 3, y); ctx.lineTo(x + 4, y - 5); ctx.stroke();
    }
  }
}

// 階段がのぼる向き（高い隣のマス）
function stairDir(level, c) {
  const D = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (let d = 0; d < 4; d++) {
    const x = c.x + D[d][0]; const y = c.y + D[d][1];
    if (x < 0 || y < 0 || x >= level.w || y >= level.h) continue;
    const n = level.cells[y * level.w + x];
    if (n.t !== 'void' && n.h === c.h + 1 && !['station', 'home', 'pad'].includes(n.t)) return d;
  }
  return 0;
}

export function drawCell(ctx, level, s, c, theme, t, opt) {
  const open = c.lock === undefined || isOpen(s, c.lock);
  let topColor = null;
  if (c.t === 'wheel') topColor = '#d8c7a2';
  if (c.t === 'exit') topColor = allDelivered(level, s) ? '#fff0a8' : '#e6d6b8';
  if (c.t === 'station') topColor = '#f2d7a8';
  if (c.t === 'home') topColor = '#eedcc0';
  const p = block(ctx, c, theme, topColor);
  const cx = p.x; const cy = p.y + TH / 2;
  if (c.t === 'floor') tufts(ctx, c, theme, p);
  if (c.t === 'stair') drawStair(ctx, level, c, p, open, t);
  if (c.t === 'gate') drawGate(ctx, p, open, t);
  if (c.t === 'wheel') drawWheel(ctx, p, isOpen(s, c.opens), t, opt.reduce, loadOf(level, s) === CAPACITY);
  if (c.t === 'exit') drawExit(ctx, p, allDelivered(level, s), t, opt.reduce);
  if (c.t === 'station') {
    ell(ctx, cx, cy + 2, TW * 0.3, TH * 0.32, 'rgba(90,60,30,.18)');
    roundRect(ctx, cx - 20, cy - 10, 40, 12, 6); ctx.fillStyle = '#c98a55'; ctx.fill();
    ell(ctx, cx, cy - 10, 20, 8, '#ff9f86'); ell(ctx, cx - 4, cy - 12, 10, 3, 'rgba(255,255,255,.45)');
  }
  if (level.seeds.includes(c.i) && !hasSeed(level, s, c.i) && (c.t === 'floor' || c.t === 'stair' || c.t === 'wheel' || c.t === 'gate')) {
    const bob = opt.reduce ? 0 : Math.sin(t * 3 + c.i) * 3;
    ell(ctx, cx, cy + 2, 7, 3, 'rgba(0,0,0,.15)');
    const gl = ctx.createRadialGradient(cx, cy - 12 + bob, 1, cx, cy - 12 + bob, 16);
    gl.addColorStop(0, 'rgba(255,255,200,.9)'); gl.addColorStop(1, 'rgba(255,255,200,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy - 12 + bob, 16, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(cx, cy - 12 + bob); ctx.rotate(-0.3);
    ell(ctx, 0, 0, 5, 8, '#6b4a2a'); ell(ctx, -1, -2, 2.4, 5, '#f4e2b0'); ctx.restore();
  }
  return p;
}
function drawStair(ctx, level, c, p, open, t) {
  const d = stairDir(level, c);
  const D = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const isRope = c.style === 'rope';
  const fx = c.x + 0.5; const fy = c.y + 0.5;
  if (!isRope) {
    // 段々：低い方から高い方へ3段
    for (let k = 0; k < 3; k++) {
      const off = (k - 1) * 0.28;
      const bx = fx + D[d][0] * off; const by = fy + D[d][1] * off;
      const q = iso(bx, by, c.h + (k + 1) / 3.2);
      const w = 0.42;
      ctx.beginPath();
      const a = iso(bx - w * 0.5 * (D[d][1] ? 1 : 0.3), by - w * 0.5 * (D[d][0] ? 1 : 0.3), c.h + (k + 1) / 3.2);
      void a;
      ctx.moveTo(q.x - TW * 0.22, q.y); ctx.lineTo(q.x, q.y - TH * 0.22); ctx.lineTo(q.x + TW * 0.22, q.y); ctx.lineTo(q.x, q.y + TH * 0.22); ctx.closePath();
      ctx.fillStyle = open ? (k % 2 ? '#ffcf7a' : '#ffb35c') : '#cdbfae'; ctx.fill();
      ctx.fillStyle = open ? '#d9874a' : '#a99a88'; ctx.fillRect(q.x - TW * 0.22, q.y, TW * 0.44, 5);
    }
    if (!open) lockBadge(ctx, p.x, p.y - 4);
  } else {
    const n = { x: c.x + D[d][0], y: c.y + D[d][1] };
    const top = iso(n.x + 0.5 - D[d][0] * 0.45, n.y + 0.5 - D[d][1] * 0.45, c.h + 1);
    const bot = iso(fx + D[d][0] * 0.1, fy + D[d][1] * 0.1, c.h);
    if (open) {
      ctx.strokeStyle = '#a0682f'; ctx.lineWidth = 3;
      for (const s of [-7, 7]) { ctx.beginPath(); ctx.moveTo(top.x + s, top.y); ctx.lineTo(bot.x + s, bot.y); ctx.stroke(); }
      ctx.strokeStyle = '#d9a35a'; ctx.lineWidth = 3;
      for (let k = 1; k < 5; k++) { const yy = top.y + (bot.y - top.y) * k / 5; const xx = top.x + (bot.x - top.x) * k / 5; ctx.beginPath(); ctx.moveTo(xx - 7, yy); ctx.lineTo(xx + 7, yy); ctx.stroke(); }
    } else {
      // 巻いたままのロープ
      for (let k = 0; k < 3; k++) { ctx.strokeStyle = '#b07a3e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(top.x, top.y - 4 - k * 3, 10 - k * 2, 4, 0, 0, 7); ctx.stroke(); }
      lockBadge(ctx, bot.x, bot.y - 6);
    }
  }
}
function lockBadge(ctx, x, y) {
  ell(ctx, x, y, 11, 11, 'rgba(255,255,255,.92)');
  ctx.strokeStyle = '#c9785a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 3, 4, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = '#e8866a'; ctx.fillRect(x - 6, y - 2, 12, 8);
}
function drawGate(ctx, p, open, t) {
  const cx = p.x; const cy = p.y + TH / 2;
  if (!open) {
    for (let k = 0; k < 5; k++) ell(ctx, cx - 18 + k * 9, cy - 10 - (k % 2) * 6, 11, 12, k % 2 ? '#5fae4a' : '#6fc057');
    for (let k = 0; k < 6; k++) flower(ctx, cx - 18 + k * 7.5, cy - 16 - (k % 3) * 5, 3.5, k % 2 ? '#ff7a9a' : '#ffffff');
    lockBadge(ctx, cx, cy - 30);
  } else {
    ctx.strokeStyle = '#6fc057'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy - 6, 22, Math.PI, 0); ctx.stroke();
    for (let k = 0; k < 7; k++) { const a = Math.PI + (k / 6) * Math.PI; flower(ctx, cx + Math.cos(a) * 22, cy - 6 + Math.sin(a) * 22, 4, ['#ff7a9a', '#ffd34d', '#fff'][k % 3]); }
  }
}
function drawWheel(ctx, p, on, t, reduce, ready) {
  const cx = p.x; const cy = p.y + TH / 2;
  // 踏板
  ctx.beginPath(); ctx.moveTo(cx - 18, cy); ctx.lineTo(cx, cy - 9); ctx.lineTo(cx + 18, cy); ctx.lineTo(cx, cy + 9); ctx.closePath();
  ctx.fillStyle = on ? '#9fd8ff' : (ready ? '#ffe27a' : '#c9a774'); ctx.fill();
  ctx.fillStyle = '#5a3a1a'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('3', cx, cy + 4);
  // 水車（奥に立つ）
  const wx = cx + 20; const wy = cy - 28; const a = on && !reduce ? t * 2 : 0.3;
  ell(ctx, wx + 6, wy + 22, 16, 5, 'rgba(80,140,200,.35)');
  ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(wx, wy, 15, 0, 7); ctx.stroke();
  for (let k = 0; k < 8; k++) {
    const b = a + (k / 8) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(b) * 17, wy + Math.sin(b) * 17); ctx.stroke();
    ctx.fillStyle = '#c98a55'; ctx.fillRect(wx + Math.cos(b) * 17 - 3, wy + Math.sin(b) * 17 - 3, 6, 6);
  }
  if (on) { ctx.fillStyle = 'rgba(140,210,255,.7)'; for (let k = 0; k < 3; k++) ell(ctx, wx + 10 + k * 4, wy + 14 + ((t * 30 + k * 7) % 12), 2, 3, 'rgba(140,210,255,.8)'); }
}
function drawExit(ctx, p, open, t, reduce) {
  const cx = p.x; const cy = p.y + TH / 2;
  ctx.strokeStyle = open ? '#ff8a6b' : '#c9b49a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 20, cy); ctx.lineTo(cx - 20, cy - 34); ctx.quadraticCurveTo(cx, cy - 58, cx + 20, cy - 34); ctx.lineTo(cx + 20, cy); ctx.stroke();
  for (let k = 0; k < 7; k++) {
    const u = k / 6; const x = cx - 20 + 40 * u; const y = cy - 34 - Math.sin(u * Math.PI) * 18;
    flower(ctx, x, y, open ? 5 : 3.5, open ? ['#ffd34d', '#fff', '#ff7a9a'][k % 3] : '#e4dacb');
  }
  if (open) {
    const g = ctx.createRadialGradient(cx, cy - 22, 2, cx, cy - 22, 34);
    g.addColorStop(0, 'rgba(255,250,200,.9)'); g.addColorStop(1, 'rgba(255,250,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy - 22, 34, 0, 7); ctx.fill();
    if (!reduce) for (let k = 0; k < 4; k++) { const a = t * 2 + k * 1.6; ell(ctx, cx + Math.cos(a) * 16, cy - 26 + Math.sin(a) * 10, 2, 2, '#fff'); }
  }
}

// 新居（小さな家）
export function drawHouse(ctx, x, y, kind, done, t, scale = 1) {
  const L = LOOKS[kind];
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ell(ctx, 0, 4, 26, 10, 'rgba(80,50,30,.2)');
  // 壁（等角の箱）
  const w = 20; const hgt = 24;
  ctx.beginPath(); ctx.moveTo(-w, -4); ctx.lineTo(0, 6); ctx.lineTo(0, 6 - hgt); ctx.lineTo(-w, -4 - hgt); ctx.closePath(); ctx.fillStyle = '#fff4e2'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(w, -4); ctx.lineTo(0, 6); ctx.lineTo(0, 6 - hgt); ctx.lineTo(w, -4 - hgt); ctx.closePath(); ctx.fillStyle = '#f2dcc0'; ctx.fill();
  // 屋根
  ctx.beginPath(); ctx.moveTo(-w - 4, -4 - hgt); ctx.lineTo(0, 8 - hgt); ctx.lineTo(0, -24 - hgt); ctx.closePath(); ctx.fillStyle = L.roof; ctx.fill();
  ctx.beginPath(); ctx.moveTo(w + 4, -4 - hgt); ctx.lineTo(0, 8 - hgt); ctx.lineTo(0, -24 - hgt); ctx.closePath(); ctx.fillStyle = shade(L.roof, -0.18); ctx.fill();
  // 戸口と窓
  roundRect(ctx, -13, -14, 8, 14, 3); ctx.fillStyle = '#b97a4c'; ctx.fill();
  roundRect(ctx, 5, -22, 10, 9, 3); ctx.fillStyle = done ? '#fff3a6' : '#8fb7d6'; ctx.fill();
  if (done) {
    // 住人が窓から顔を出し、花飾り
    ctx.save(); ctx.beginPath(); roundRect(ctx, 5, -22, 10, 9, 3); ctx.clip();
    ell(ctx, 10, -15, 6, 6, L.body); ctx.restore();
    for (let k = 0; k < 5; k++) flower(ctx, -18 + k * 9, -2 - hgt - (k % 2) * 3, 3.6, ['#ff7a9a', '#ffd34d', '#fff', '#ff9a6b', '#b58cff'][k]);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ell(ctx, 10, -48 - ((t * 8) % 10), 4, 3, 'rgba(255,255,255,.7)');
  } else {
    // 看板：住む動物と重さ
    ctx.fillStyle = '#fffaf0'; roundRect(ctx, -26, -54, 30, 22, 8); ctx.fill();
    ctx.strokeStyle = shade(L.roof, -0.2); ctx.lineWidth = 2; ctx.stroke();
    drawAnimal(ctx, kind, -17, -37, 0.42, { sit: true });
    ctx.fillStyle = '#5a3a1a'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(KINDS[kind].weight), -3, -38);
  }
  ctx.restore();
}

// 動物（丸い部品）。x,y は足元。s は大きさ。
export function drawAnimal(ctx, kind, x, y, s = 1, o = {}) {
  const L = LOOKS[kind]; const wt = KINDS[kind].weight; const z = SIZE[wt] * s;
  ctx.save(); ctx.translate(x, y); ctx.scale(z * (o.flip ? -1 : 1), z);
  if (o.silhouette) { ctx.globalAlpha = 0.9; }
  const col = (c) => (o.silhouette ? '#6d7891' : c);
  if (!o.sit && !o.noShadow) ell(ctx, 0, 0, 20, 6, 'rgba(0,0,0,.16)');
  const bob = o.bob || 0;
  // しっぽ
  if (L.tail === 'bushy') { ell(ctx, 16, -26 + bob, 11, 18, col(L.body), 0.4); ell(ctx, 18, -30 + bob, 6, 10, col(L.belly), 0.4); }
  if (L.tail === 'ring') { for (let k = 0; k < 3; k++) ell(ctx, 18 + k * 3, -10 - k * 6 + bob, 6, 4, col(k % 2 ? '#3d3d48' : L.body)); }
  if (L.tail === 'puff') ell(ctx, 17, -12 + bob, 6, 6, col('#fff'));
  if (L.tail === 'curl') { ctx.strokeStyle = col(L.body); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(19, -14 + bob, 4, 0, 5); ctx.stroke(); }
  if (L.tail === 'feather') { ell(ctx, 17, -12 + bob, 9, 4, col(shade(L.body, -0.15)), -0.4); }
  if (L.tail === 'stub') ell(ctx, 17, -9 + bob, 4, 3, col(L.body));
  // 胴
  const bw = L.boxy ? 21 : 17; const bh = L.boxy ? 15 : 16;
  ell(ctx, 0, -14 + bob, bw, bh, col(L.body));
  if (L.band) ell(ctx, 4, -14 + bob, 10, 14, col(L.belly));
  ell(ctx, -6, -11 + bob, bw * 0.45, bh * 0.55, col(L.belly));
  if (L.spikes) { ctx.fillStyle = col('#7a5534'); for (let k = 0; k < 7; k++) { const a = -Math.PI * 0.95 + k * 0.42; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 14, -16 + Math.sin(a) * 14 + bob); ctx.lineTo(Math.cos(a) * 24, -16 + Math.sin(a) * 22 + bob); ctx.lineTo(Math.cos(a + 0.2) * 14, -16 + Math.sin(a + 0.2) * 14 + bob); ctx.fill(); } }
  // 頭
  const hx = -13; const hy = -27 + bob; const hr = L.boxy ? 12 : 11;
  // 耳
  if (L.ear === 'long') { ell(ctx, hx - 4, hy - 18, 4, 12, col(L.body), -0.15); ell(ctx, hx + 5, hy - 18, 4, 12, col(L.body), 0.15); ell(ctx, hx + 5, hy - 18, 2, 8, col('#ffc0cc'), 0.15); }
  if (L.ear === 'point') { ctx.fillStyle = col(L.body); for (const d of [-6, 5]) { ctx.beginPath(); ctx.moveTo(hx + d - 5, hy - 6); ctx.lineTo(hx + d, hy - 18); ctx.lineTo(hx + d + 5, hy - 6); ctx.fill(); } }
  if (L.ear === 'small') { ell(ctx, hx - 7, hy - 9, 4, 4, col(shade(L.body, -0.1))); ell(ctx, hx + 6, hy - 9, 4, 4, col(shade(L.body, -0.1))); }
  if (L.ear === 'fluff') { ell(ctx, hx - 11, hy - 6, 8, 8, col(L.body)); ell(ctx, hx + 10, hy - 6, 8, 8, col(L.body)); ell(ctx, hx - 11, hy - 6, 5, 5, col('#fff')); ell(ctx, hx + 10, hy - 6, 5, 5, col('#fff')); }
  if (L.ear === 'flop') { ell(ctx, hx - 8, hy - 7, 5, 6, col(shade(L.body, -0.1)), 0.6); ell(ctx, hx + 7, hy - 7, 5, 6, col(shade(L.body, -0.1)), -0.6); }
  ell(ctx, hx, hy, hr, hr * 0.92, col(L.body));
  if (L.mask) ell(ctx, hx - 2, hy - 1, 9, 4, col('#3d3d48'));
  if (!o.silhouette) {
    ctx.fillStyle = '#2a2230'; ctx.beginPath(); ctx.arc(hx - 5, hy - 2, 1.8, 0, 7); ctx.arc(hx + 3, hy - 2, 1.8, 0, 7); ctx.fill();
    ell(ctx, hx - 8, hy + 3, 2.5, 1.6, 'rgba(255,120,140,.35)');
  }
  if (L.beak) { ctx.fillStyle = col(L.nose); ctx.beginPath(); ctx.moveTo(hx - 10, hy + 1); ctx.lineTo(hx - 17, hy + 3); ctx.lineTo(hx - 10, hy + 5); ctx.fill(); }
  else if (L.snout) { ell(ctx, hx - 9, hy + 3, 6, 5, col(L.nose)); if (!o.silhouette) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(hx - 11, hy + 3, 1, 0, 7); ctx.arc(hx - 7, hy + 3, 1, 0, 7); ctx.fill(); } }
  else if (L.trunk) { ctx.strokeStyle = col(L.body); ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hx - 8, hy + 2); ctx.quadraticCurveTo(hx - 16, hy + 4, hx - 15, hy + 10); ctx.stroke(); }
  else ell(ctx, hx - 10, hy + 2, 2.6, 2.2, col(L.nose));
  // 足
  if (!o.sit) for (const fx of [-10, 8]) ell(ctx, fx, -1, 4, 3, col(shade(L.body, -0.2)));
  ctx.restore();
}

// 甲羅模様の色
export const PATTERN_LOOKS = [
  ['#ff8a6b', '#ffd0b8'], ['#ff8a6b', '#fff3c0'], ['#6fc1ff', '#ffffff'], ['#b58cff', '#f3e8ff'],
  ['#ffcf3a', '#7a5a1a'], ['#7cc451', '#e9ffd8'], ['#3f6fd8', '#ffe27a'], ['#40b8c8', '#dff8ff'],
  ['#ff7a9a', '#ffe3ea'], ['#5aa86a', '#c6f0b0'], ['#ff8a6b', '#6fc1ff'], ['#ffd34d', '#ff7a9a'],
];
function shellPattern(ctx, idx, r) {
  const [a, b] = PATTERN_LOOKS[idx] || PATTERN_LOOKS[0];
  ctx.fillStyle = b;
  switch (idx) {
    case 1: for (let k = -2; k <= 2; k++) { ctx.fillRect(-r, k * 7 - 2, r * 2, 3); } break;
    case 2: for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(Math.cos(k) * r * 0.5, Math.sin(k * 1.7) * r * 0.45, 3, 0, 7); ctx.fill(); } break;
    case 3: ctx.strokeStyle = b; ctx.lineWidth = 2.5; ctx.beginPath(); for (let k = 0; k < 40; k++) { const q = k / 6; ctx.lineTo(Math.cos(q) * k * 0.45, Math.sin(q) * k * 0.4); } ctx.stroke(); break;
    case 4: flower(ctx, 0, 0, r * 0.6, b); break;
    case 5: for (let k = -2; k <= 2; k++) { ctx.fillRect(k * 7 - 1, -r, 2, r * 2); ctx.fillRect(-r, k * 7 - 1, r * 2, 2); } break;
    case 6: for (let k = 0; k < 5; k++) star(ctx, Math.cos(k * 2) * r * 0.5, Math.sin(k * 2.3) * r * 0.4, 3.5); break;
    case 7: ctx.strokeStyle = b; ctx.lineWidth = 2.5; for (let k = -1; k <= 1; k++) { ctx.beginPath(); for (let x = -r; x <= r; x += 3) ctx.lineTo(x, k * 8 + Math.sin(x / 3) * 2.5); ctx.stroke(); } break;
    case 8: heart(ctx, 0, 0, 8); break;
    case 9: for (let k = 0; k < 4; k++) ell(ctx, Math.cos(k * 1.6) * 8, Math.sin(k * 1.6) * 6, 6, 3, b, k); break;
    case 10: for (let k = 0; k < 5; k++) { ctx.strokeStyle = ['#ff7a9a', '#ffd34d', '#7cc451', '#6fc1ff', '#b58cff'][k]; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 8, 6 + k * 3, Math.PI, 0); ctx.stroke(); } break;
    case 11: for (let k = 0; k < 6; k++) flower(ctx, Math.cos(k) * 9, Math.sin(k) * 6, 3.5, ['#fff', '#ff7a9a', '#ffd34d'][k % 3]); break;
    default: ctx.strokeStyle = b; ctx.lineWidth = 3; ctx.beginPath(); for (let k = 0; k < 30; k++) { const q = k / 5; ctx.lineTo(Math.cos(q) * k * 0.5, Math.sin(q) * k * 0.45); } ctx.stroke();
  }
  void a;
}
function star(ctx, x, y, r) { ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5; const q = k % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } ctx.fill(); }
function heart(ctx, x, y, r) { ctx.beginPath(); ctx.moveTo(x, y + r * 0.6); ctx.bezierCurveTo(x - r * 1.2, y - r * 0.3, x - r * 0.4, y - r, x, y - r * 0.35); ctx.bezierCurveTo(x + r * 0.4, y - r, x + r * 1.2, y - r * 0.3, x, y + r * 0.6); ctx.fill(); }

// コロ（家を背負ったヤドカリ）。riders は動物の種類の配列（下から順に）。
export function drawKoro(ctx, x, y, o = {}) {
  const load = o.load || 0; const t = o.t || 0; const face = o.face ?? 2;
  const flip = face === 0 || face === 1 ? -1 : 1;
  const sink = load * 2.6; const s = o.scale || 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.save(); ctx.scale(flip, 1);
  ell(ctx, 0, 0, 26 + load * 2, 8, 'rgba(0,0,0,.2)');
  // 脚（荷重で曲がる）
  ctx.strokeStyle = '#ff6f5a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  const step = o.walk ? Math.sin(o.walk * Math.PI * 2) * 3 : 0;
  for (let k = 0; k < 3; k++) {
    const lx = -14 + k * 7; ctx.beginPath(); ctx.moveTo(lx, -10); ctx.lineTo(lx - 6, -4 + sink * 0.3); ctx.lineTo(lx - 8 + (k % 2 ? step : -step), 0); ctx.stroke();
  }
  // はさみと顔
  const by = -12 + sink * 0.5;
  ell(ctx, -18, by, 9, 8, '#ff7a62'); ell(ctx, -26, by - 6, 6, 5, '#ff8f78');
  ctx.strokeStyle = '#ff6f5a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-19, by - 7); ctx.lineTo(-21, by - 16); ctx.moveTo(-14, by - 7); ctx.lineTo(-13, by - 17); ctx.stroke();
  ell(ctx, -21, by - 17, 3, 3, '#fff'); ell(ctx, -13, by - 18, 3, 3, '#fff');
  ctx.fillStyle = '#2a2230'; ctx.beginPath(); ctx.arc(-21.5, by - 17, 1.5, 0, 7); ctx.arc(-13.5, by - 18, 1.5, 0, 7); ctx.fill();
  // 背負った巻貝の家
  const sy = -22 + sink;
  const [pa] = PATTERN_LOOKS[o.pattern || 0] || PATTERN_LOOKS[0];
  ell(ctx, 4, sy + 4, 24, 20, shade(pa, -0.2));
  ell(ctx, 4, sy, 24, 20, pa);
  ctx.save(); ctx.translate(4, sy); ctx.beginPath(); ctx.ellipse(0, 0, 22, 18, 0, 0, 7); ctx.clip(); shellPattern(ctx, o.pattern || 0, 22); ctx.restore();
  ell(ctx, -4, sy - 8, 8, 4, 'rgba(255,255,255,.45)');
  ctx.restore();
  // 屋上デッキと乗客（重さぶん席を使う）
  const deck = sy - 18; const dx = 4 * flip;
  roundRect(ctx, dx - 20, deck - 4, 40, 8, 4); ctx.fillStyle = '#c98a55'; ctx.fill();
  ctx.fillStyle = '#e2a96a'; roundRect(ctx, dx - 20, deck - 4, 40, 4, 2); ctx.fill();
  const riders = o.riders || [];
  const total = riders.reduce((n, k) => n + KINDS[k].weight, 0);
  let off = -total * 6.5;
  for (let k = 0; k < riders.length; k++) {
    const kind = riders[k]; const w = KINDS[kind].weight;
    const px = dx + off + w * 6.5;
    drawAnimal(ctx, kind, px, deck - 1, 0.62, { sit: true, flip: flip < 0, bob: o.bounce ? Math.sin(t * 8 + k) * 1.2 : 0 });
    off += w * 13;
  }
  ctx.restore();
}

// 予告の弧（葉・橋の飛び先）
export function drawPadPreview(ctx, level, s, c, t, reduce, focus, koro = null) {
  const load = loadOf(level, s);
  const heavy = isHeavy(load);
  const from = iso(c.x + 0.5, c.y + 0.5, c.h);
  for (const which of ['light', 'heavy']) {
    const tgt = level.cells[c[which]];
    const active = (which === 'heavy') === heavy;
    const to = iso(tgt.x + 0.5, tgt.y + 0.5, tgt.h);
    const lift = which === 'light' ? 60 : 18;
    const mx = (from.x + to.x) / 2; const my = Math.min(from.y, to.y) - lift;
    ctx.save();
    ctx.globalAlpha = active ? (focus ? 1 : 0.85) : 0.28;
    if (c.style === 'bridge' && active) {
      // 板の橋（沈む/持ち上がる）
      const sag = which === 'heavy' ? 14 : -8;
      ctx.strokeStyle = '#a0682f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(from.x, from.y - 4); ctx.quadraticCurveTo(mx, (from.y + to.y) / 2 + sag, to.x, to.y - 4); ctx.stroke();
      for (let k = 1; k < 9; k++) {
        const u = k / 9; const bx = (1 - u) * (1 - u) * from.x + 2 * u * (1 - u) * mx + u * u * to.x;
        const byy = (1 - u) * (1 - u) * from.y + 2 * u * (1 - u) * ((from.y + to.y) / 2 + sag) + u * u * to.y;
        ctx.fillStyle = k % 2 ? '#e0a865' : '#d29453'; roundRect(ctx, bx - 9, byy - 6, 18, 6, 2); ctx.fill();
      }
    } else {
      ctx.setLineDash(active ? [6, 6] : [3, 7]); ctx.lineDashOffset = reduce ? 0 : -t * 20;
      ctx.strokeStyle = active ? '#ff6f5a' : '#ffffff'; ctx.lineWidth = active ? 3.5 : 2.5;
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.quadraticCurveTo(mx, my, to.x, to.y); ctx.stroke(); ctx.setLineDash([]);
    }
    if (!active) {
      const lbl = `${which === 'heavy' ? '重いとき' : '軽いとき'}→${tgt.h > c.h ? '高い所' : tgt.h < c.h ? '低い所' : 'ここ'}`;
      const near = koro && Math.hypot(koro.x - to.x, koro.y - to.y) < 40;
      ctx.globalAlpha = near ? 0.3 : 0.8; ctx.fillStyle = 'rgba(255,255,255,.9)'; roundRect(ctx, to.x - 34, to.y - 26, 68, 16, 8); ctx.fill();
      ctx.fillStyle = '#8a7a6a'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(lbl, to.x, to.y - 14);
    }
    // 着地点の足あと
    if (active) {
      const blocked = s.rocks.includes(tgt.i);
      ctx.fillStyle = blocked ? '#d04040' : '#ff6f5a';
      for (let k = 0; k < 2; k++) ell(ctx, to.x - 6 + k * 12, to.y + TH / 2 - 2 + (k ? -3 : 3), 4, 2.6, blocked ? '#d04040' : 'rgba(255,111,90,.85)');
      const lbl = `いま${heavy ? '重い' : '軽い'}→${tgt.h > c.h ? '高い所' : tgt.h < c.h ? '低い所' : 'ここ'}`;
      const near = koro && Math.hypot(koro.x - to.x, koro.y - to.y) < 40;
      if (near) ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#fff'; roundRect(ctx, to.x - 44, to.y - 30, 88, 20, 10); ctx.fill();
      ctx.strokeStyle = '#ff6f5a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#c0442e'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(blocked ? '×' : lbl, to.x, to.y - 15);
    }
    ctx.restore();
  }
}
export function drawPad(ctx, level, s, c, theme, t, reduce) {
  const p = block(ctx, c, theme, c.style === 'leaf' ? null : '#e8cfa0');
  const cx = p.x; const cy = p.y + TH / 2;
  const load = loadOf(level, s);
  if (c.style === 'leaf') {
    const sway = reduce ? 0 : Math.sin(t * 2 + c.i) * 0.06;
    ctx.save(); ctx.translate(cx, cy - 4); ctx.rotate(-0.5 + sway);
    ell(ctx, 0, 2, 26, 12, 'rgba(0,0,0,.14)');
    ell(ctx, 0, 0, 26, 12, '#58b84a'); ell(ctx, -3, -2, 20, 8, '#7fd166');
    ctx.strokeStyle = '#3f8f36'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(24, 0); ctx.stroke();
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 8, 0); ctx.lineTo(k * 8 + 6, -7); ctx.moveTo(k * 8, 0); ctx.lineTo(k * 8 + 6, 7); ctx.stroke(); }
    ctx.restore();
  } else {
    // 橋のたもと：踏み板が荷重で沈む
    const sink = isHeavy(load) ? 4 : 0;
    roundRect(ctx, cx - 18, cy - 8 + sink, 36, 12, 4); ctx.fillStyle = c.look === 'trunk' ? '#b6a5ba' : '#c98a55'; ctx.fill();
    ctx.fillStyle = c.look === 'trunk' ? '#d6c6d8' : '#e2a96a'; roundRect(ctx, cx - 18, cy - 10 + sink, 36, 6, 3); ctx.fill();
    ctx.fillStyle = '#7a4a24'; ctx.fillRect(cx - 20, cy - 22, 3, 18); ctx.fillRect(cx + 17, cy - 22, 3, 18);
    if (c.look === 'trunk') { for (let k = 0; k < 4; k++) { ctx.strokeStyle = '#9a879e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - 14 + k * 9, cy - 8 + sink); ctx.lineTo(cx - 14 + k * 9, cy - 2 + sink); ctx.stroke(); } }
  }
  return p;
}

export function drawRock(ctx, x, y) {
  ell(ctx, x, y + 2, 20, 7, 'rgba(0,0,0,.2)');
  ell(ctx, x, y - 10, 19, 15, '#9a958e'); ell(ctx, x - 3, y - 13, 15, 11, '#b9b3aa'); ell(ctx, x - 7, y - 18, 6, 3.5, 'rgba(255,255,255,.55)');
  ctx.strokeStyle = 'rgba(80,70,60,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 4, y - 18); ctx.lineTo(x + 8, y - 10); ctx.stroke();
}
