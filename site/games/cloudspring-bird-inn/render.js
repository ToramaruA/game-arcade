// 盤面の描画（Canvas2D・等角の紙工作風）。ルールは logic.js、ここは見た目だけ。
import { DIRS, FACILITIES, SPECIES, isBath, metrics, windAt, network, TUNE } from './logic.js';

const C = {
  deck: '#fbf0db', deck2: '#f4e2c2', deckLine: '#e6cfa6', grass: '#c6dc6c', grassD: '#9fbf45',
  rock: '#f2c3c6', rockD: '#dba2a9', rockDD: '#c88a93', pink: '#f4c3c9', pinkD: '#e3a2ad', pinkDD: '#c9808e',
  cream: '#fff7e8', ink: '#5a4146', leaf: '#c3d96a', leafD: '#93b23c',
};

const imgs = {};
export function loadImages(srcs) {
  return Promise.all(Object.entries(srcs).map(([k, src]) => new Promise((res) => {
    const im = new Image(); im.onload = () => { imgs[k] = im; res(); }; im.onerror = () => res(); im.src = src;
  })));
}

// ---- 座標 ----
export function layout(canvas, s) {
  const w = canvas.width; const h = canvas.height;
  const n = s.W + s.H;
  const TW = Math.min((w * 0.98) / (n / 2), (h * 0.8) / (n / 4 + 0.55));
  const TH = TW / 2;
  const boardH = n * TH / 2;
  const ox = w / 2 + (s.H - s.W) * TW / 4;
  const oy = (h - boardH) / 2 + TH * 0.35;
  return { TW, TH, ox, oy, w, h };
}
export const toScreen = (L, x, y) => [L.ox + (x - y) * L.TW / 2, L.oy + (x + y) * L.TH / 2 + L.TH / 2];
export function toCell(L, px, py) {
  const a = (px - L.ox) / (L.TW / 2); const b = (py - L.oy) / (L.TH / 2);
  return [Math.floor((a + b) / 2), Math.floor((b - a) / 2)];
}

function diamond(ctx, cx, cy, hw, hh) {
  ctx.beginPath(); ctx.moveTo(cx, cy - hh); ctx.lineTo(cx + hw, cy); ctx.lineTo(cx, cy + hh); ctx.lineTo(cx - hw, cy); ctx.closePath();
}

// 等角の箱（紙の面）。cx,cy=上面の中心、hw/hh=上面の半分、z=高さ
function box(ctx, cx, cy, hw, hh, z, top, left, right) {
  ctx.fillStyle = left; ctx.beginPath(); ctx.moveTo(cx - hw, cy); ctx.lineTo(cx, cy + hh); ctx.lineTo(cx, cy + hh + z); ctx.lineTo(cx - hw, cy + z); ctx.closePath(); ctx.fill();
  ctx.fillStyle = right; ctx.beginPath(); ctx.moveTo(cx + hw, cy); ctx.lineTo(cx, cy + hh); ctx.lineTo(cx, cy + hh + z); ctx.lineTo(cx + hw, cy + z); ctx.closePath(); ctx.fill();
  ctx.fillStyle = top; diamond(ctx, cx, cy, hw, hh); ctx.fill();
}

export function waterColor(T, on) {
  if (!on) return '#e9dfcf';
  const stops = [[15, [185, 226, 238]], [25, [176, 228, 222]], [32, [205, 236, 200]], [38, [255, 222, 186]], [44, [250, 176, 160]], [52, [236, 130, 128]]];
  let a = stops[0]; let b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) if (T >= stops[i][0] && T <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; }
  if (T < stops[0][0]) b = a; if (T > b[0]) a = b;
  const k = a === b ? 0 : (T - a[0]) / (b[0] - a[0]);
  const c = a[1].map((v, i) => Math.round(v + (b[1][i] - v) * k));
  return `rgb(${c.join(',')})`;
}

// ---- 鳥（紙工作風の小さな姿） ----
const BIRD = {
  swan: { body: '#ffffff', shade: '#e8e4ef', head: '#ffffff', beak: '#f39a3d', neck: 1.2 },
  kingfisher: { body: '#3fa7c4', shade: '#2f87a2', head: '#3fa7c4', belly: '#f6a45b', beak: '#3b3337', neck: 0.2, longBeak: true },
  swallow: { body: '#36507a', shade: '#2a3f60', head: '#36507a', belly: '#fff6ea', face: '#e0574f', beak: '#3b3337', neck: 0.1, fork: true },
  heron: { body: '#dfe5ea', shade: '#bcc6cf', head: '#dfe5ea', beak: '#e2b13d', neck: 1.0 },
  duck: { body: '#fff3c4', shade: '#eed98a', head: '#fff3c4', beak: '#f39a3d', neck: 0.3 },
  parakeet: { body: '#8fd06a', shade: '#69a94a', head: '#f3e15a', beak: '#e2913d', neck: 0.1 },
  owl: { body: '#b98a62', shade: '#946945', head: '#b98a62', belly: '#ecd5b2', beak: '#e2b13d', neck: 0, tufts: true, bigEyes: true },
  crane: { body: '#ffffff', shade: '#e2e2ea', head: '#ffffff', beak: '#6d6a6a', neck: 1.4, crown: '#e2474f', tail: '#3b3337' },
  whiteeye: { body: '#b5cf5a', shade: '#93ad3c', head: '#b5cf5a', beak: '#3b3337', neck: 0.1, ring: true },
  penguin: { body: '#3d4250', shade: '#2b2f3a', head: '#3d4250', belly: '#ffffff', beak: '#f39a3d', neck: 0, upright: true },
  tit: { body: '#c98a54', shade: '#a66d3d', head: '#3b3337', belly: '#f0e1c6', beak: '#3b3337', neck: 0.1 },
  rainbow: { body: '#f6a6c1', shade: '#a6d8f0', head: '#ffd36e', beak: '#f39a3d', neck: 0.6, rainbow: true },
};

// x,y=足元（または水面）の位置、s=大きさ(px)、dir=1右向き/-1左向き、bath=水に浸かっている
export function drawBird(ctx, sp, x, y, s, { dir = 1, bath = false, t = 0, mood = null } = {}) {
  const P = BIRD[sp] || BIRD.swan;
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s / 20, s / 20);
  const bob = Math.sin(t * 3 + x) * (bath ? 0.6 : 0.3);
  ctx.translate(0, bob);
  if (!bath) { // 影と足
    ctx.fillStyle = 'rgba(90,60,60,.18)'; ctx.beginPath(); ctx.ellipse(0, 1, 8, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f08a3c'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(-2, 0); ctx.moveTo(2, -3); ctx.lineTo(2, 0); ctx.stroke();
  }
  const by = P.upright ? -10 : -8;
  // しっぽ
  ctx.fillStyle = P.tail || P.shade;
  ctx.beginPath();
  if (P.fork) { ctx.moveTo(-6, by); ctx.lineTo(-15, by - 2); ctx.lineTo(-10, by + 1); ctx.lineTo(-15, by + 4); ctx.lineTo(-5, by + 3); }
  else { ctx.moveTo(-6, by - 1); ctx.lineTo(-12, by - 4); ctx.lineTo(-9, by + 3); }
  ctx.closePath(); ctx.fill();
  // 胴（多角形で紙の面）
  if (P.upright) {
    ctx.fillStyle = P.body; ctx.beginPath(); ctx.ellipse(0, by, 6.5, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.belly; ctx.beginPath(); ctx.ellipse(2, by + 1, 4, 7, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = P.body;
    ctx.beginPath(); ctx.moveTo(-8, by); ctx.lineTo(-4, by - 6); ctx.lineTo(5, by - 5); ctx.lineTo(8, by); ctx.lineTo(4, by + 5); ctx.lineTo(-5, by + 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.shade; ctx.beginPath(); ctx.moveTo(-8, by); ctx.lineTo(-5, by + 5); ctx.lineTo(4, by + 5); ctx.lineTo(0, by + 1); ctx.closePath(); ctx.fill();
    if (P.belly) { ctx.fillStyle = P.belly; ctx.beginPath(); ctx.moveTo(2, by + 1); ctx.lineTo(8, by); ctx.lineTo(4, by + 5); ctx.closePath(); ctx.fill(); }
    // 羽
    ctx.fillStyle = P.rainbow ? '#b9e39a' : P.shade; ctx.beginPath(); ctx.moveTo(-5, by - 2); ctx.lineTo(2, by - 3); ctx.lineTo(-1, by + 3); ctx.closePath(); ctx.fill();
    if (P.rainbow) { ctx.fillStyle = '#a6d8f0'; ctx.beginPath(); ctx.moveTo(-6, by); ctx.lineTo(-1, by - 1); ctx.lineTo(-3, by + 4); ctx.closePath(); ctx.fill(); }
  }
  // 首と頭
  const nk = P.neck * 7;
  const hx = P.upright ? 1 : 6 + (P.neck > 0.5 ? 1 : 0); const hy = by - 7 - nk;
  if (nk > 2) { ctx.strokeStyle = P.body; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(5, by - 3); ctx.quadraticCurveTo(8, by - 6 - nk / 2, hx, hy + 2); ctx.stroke(); }
  if (P.tufts) { ctx.fillStyle = P.shade; ctx.beginPath(); ctx.moveTo(hx - 4, hy - 2); ctx.lineTo(hx - 5, hy - 8); ctx.lineTo(hx - 1, hy - 4); ctx.moveTo(hx + 4, hy - 2); ctx.lineTo(hx + 5, hy - 8); ctx.lineTo(hx + 1, hy - 4); ctx.fill(); }
  ctx.fillStyle = P.head; ctx.beginPath(); ctx.arc(hx, hy, P.bigEyes ? 5.2 : 4, 0, Math.PI * 2); ctx.fill();
  if (P.face) { ctx.fillStyle = P.face; ctx.beginPath(); ctx.arc(hx + 2, hy + 1.5, 2, 0, Math.PI * 2); ctx.fill(); }
  if (P.crown) { ctx.fillStyle = P.crown; ctx.beginPath(); ctx.arc(hx, hy - 3, 1.8, 0, Math.PI * 2); ctx.fill(); }
  if (P.ring) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(hx + 1.5, hy - 0.5, 1.6, 0, Math.PI * 2); ctx.stroke(); }
  // くちばし
  ctx.fillStyle = P.beak; ctx.beginPath();
  if (P.longBeak) { ctx.moveTo(hx + 3, hy - 1); ctx.lineTo(hx + 11, hy + 0.5); ctx.lineTo(hx + 3, hy + 1.5); }
  else if (P.neck > 0.9) { ctx.moveTo(hx + 3, hy - 1); ctx.lineTo(hx + 8, hy + 0.5); ctx.lineTo(hx + 3, hy + 1.5); }
  else { ctx.moveTo(hx + 3.5, hy - 0.5); ctx.lineTo(hx + 6.5, hy + 1); ctx.lineTo(hx + 3.5, hy + 2); }
  ctx.closePath(); ctx.fill();
  // 目
  ctx.fillStyle = '#2d2226';
  if (P.bigEyes) { ctx.fillStyle = '#fff3c0'; ctx.beginPath(); ctx.arc(hx + 2, hy - 0.5, 2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#2d2226'; ctx.beginPath(); ctx.arc(hx + 2.4, hy - 0.5, 1, 0, Math.PI * 2); ctx.fill(); }
  else if (mood === 'happy') { ctx.strokeStyle = '#2d2226'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(hx + 1.5, hy - 0.2, 1.1, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(hx + 1.6, hy - 0.6, 0.9, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// 吹き出し（困っている鳥だけ）
function bubble(ctx, x, y, text, color = '#fff') {
  ctx.save();
  ctx.font = 'bold 12px system-ui, sans-serif';
  const w = Math.max(22, ctx.measureText(text).width + 10);
  ctx.fillStyle = color; ctx.strokeStyle = 'rgba(90,65,70,.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - 18, w, 17, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 3, y - 2); ctx.lineTo(x, y + 3); ctx.lineTo(x + 3, y - 2); ctx.fill();
  ctx.fillStyle = '#5a4146'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y - 9.5);
  ctx.restore();
}

function tag(ctx, x, y, text, bg, fg = '#fff', size = 12) {
  ctx.save();
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x - w / 2, y - size / 2 - 3, w, size + 6, 7); ctx.fill();
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 0.5);
  ctx.restore();
  return w;
}

// ---- 背景 ----
function drawBackground(ctx, L, time, calm) {
  const { w, h } = L;
  const bg = imgs.bg;
  if (bg) {
    const sc = Math.max(w / bg.width, h / bg.height);
    const dw = bg.width * sc; const dh = bg.height * sc;
    ctx.drawImage(bg, (w - dw) / 2, (h - dh) * 0.35, dw, dh);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#a7dcd8'); g.addColorStop(1, '#fbe9df'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  // 流れる雲
  ctx.save(); ctx.globalAlpha = 0.75;
  for (let i = 0; i < 6; i++) {
    const sp = calm ? 0 : 6 + i * 2;
    const x = ((i * 173 + time * sp) % (w + 200)) - 100; const y = h * (0.12 + (i % 3) * 0.08);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(x, y, 34 + i * 4, 9, 0, 0, Math.PI * 2); ctx.ellipse(x + 18, y - 6, 18, 9, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// 島の土台（紙の岩と草の縁）
function drawIsland(ctx, L, s, season) {
  const [tx, ty] = toScreen(L, 0, 0); const [rx, ry] = toScreen(L, s.W - 1, 0); const [bx, by] = toScreen(L, s.W - 1, s.H - 1); const [lx, ly] = toScreen(L, 0, s.H - 1);
  const hw = L.TW / 2; const hh = L.TH / 2;
  const T = [tx, ty - hh]; const R = [rx + hw, ry]; const B = [bx, by + hh]; const Lf = [lx - hw, ly];
  const depth = L.TH * 1.0;
  // 下の岩
  ctx.fillStyle = C.rockD;
  ctx.beginPath(); ctx.moveTo(...Lf); ctx.lineTo(...B); ctx.lineTo(B[0], B[1] + depth); ctx.lineTo(Lf[0] + hw * 0.6, Lf[1] + depth * 0.6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.rockDD;
  ctx.beginPath(); ctx.moveTo(...R); ctx.lineTo(...B); ctx.lineTo(B[0], B[1] + depth); ctx.lineTo(R[0] - hw * 0.6, R[1] + depth * 0.6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.rock;
  ctx.beginPath(); ctx.moveTo(Lf[0] + hw * 0.6, Lf[1] + depth * 0.6); ctx.lineTo(B[0], B[1] + depth); ctx.lineTo(B[0] - hw * 0.4, B[1] + depth * 2.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.rockD;
  ctx.beginPath(); ctx.moveTo(R[0] - hw * 0.6, R[1] + depth * 0.6); ctx.lineTo(B[0], B[1] + depth); ctx.lineTo(B[0] - hw * 0.4, B[1] + depth * 2.1); ctx.closePath(); ctx.fill();
  // 草の縁
  const g = season === 'winter' ? ['#f4f7fb', '#d8e4ee'] : [C.grass, C.grassD];
  ctx.fillStyle = g[1];
  ctx.beginPath(); ctx.moveTo(...Lf); ctx.lineTo(...B); ctx.lineTo(...R); ctx.lineTo(R[0], R[1] + 8); ctx.lineTo(B[0], B[1] + 8); ctx.lineTo(Lf[0], Lf[1] + 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = g[0];
  ctx.beginPath(); ctx.moveTo(T[0], T[1] - 5); ctx.lineTo(R[0] + 6, R[1]); ctx.lineTo(B[0], B[1] + 5); ctx.lineTo(Lf[0] - 6, Lf[1]); ctx.closePath(); ctx.fill();
  // 小さな花（紙の葉）
  ctx.fillStyle = season === 'winter' ? '#ffffff' : '#f39fb0';
  for (let i = 0; i < 9; i++) {
    const k = (i + 0.5) / 9;
    const px = Lf[0] + (B[0] - Lf[0]) * k; const py = Lf[1] + (B[1] - Lf[1]) * k + 6;
    ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2); ctx.fill();
    const qx = R[0] + (B[0] - R[0]) * k; const qy = R[1] + (B[1] - R[1]) * k + 6;
    ctx.beginPath(); ctx.arc(qx, qy, 2.2, 0, Math.PI * 2); ctx.fill();
  }
}


// 奥の浮島に建つ紙工作の旅館（母屋）と、入口へ渡る橋
function drawInn(ctx, L, s, time, season) {
  const gx = s.W * 0.55; const gy = -1.9;
  const [cx, cy] = toScreen(L, gx, gy);
  const hw = L.TW * 1.25; const hh = L.TH * 1.25;
  // 浮島
  ctx.fillStyle = C.rockD; ctx.beginPath(); ctx.moveTo(cx - hw, cy); ctx.lineTo(cx, cy + hh); ctx.lineTo(cx, cy + hh + L.TH * 1.4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.rockDD; ctx.beginPath(); ctx.moveTo(cx + hw, cy); ctx.lineTo(cx, cy + hh); ctx.lineTo(cx, cy + hh + L.TH * 1.4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = season === 'winter' ? '#f4f7fb' : C.grass; diamond(ctx, cx, cy, hw, hh); ctx.fill();
  // 橋（入口の門の上へ）
  const [ex, ey] = toScreen(L, 0, 0);
  ctx.strokeStyle = '#d9b48a'; ctx.lineWidth = Math.max(4, L.TW * 0.1); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - hw * 0.55, cy + hh * 0.45); ctx.quadraticCurveTo((cx + ex) / 2, Math.max(cy, ey) + L.TH * 0.2, ex + L.TW * 0.15, ey - L.TH * 0.35); ctx.stroke();
  ctx.strokeStyle = '#f4c3c9'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx - hw * 0.55, cy + hh * 0.45 - 6); ctx.quadraticCurveTo((cx + ex) / 2, Math.max(cy, ey) + L.TH * 0.2 - 6, ex + L.TW * 0.15, ey - L.TH * 0.35 - 6); ctx.stroke();
  // 母屋
  const bw = hw * 0.62; const bh = hh * 0.62; const z = L.TH * 1.15; const top = cy - z + hh * 0.1;
  box(ctx, cx, top, bw, bh, z, '#fff7e8', '#f6e6c8', '#ead3ab');
  // 格子窓と のれん
  ctx.strokeStyle = 'rgba(160,120,90,.45)'; ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) { const k = i / 4; ctx.beginPath(); ctx.moveTo(cx - bw + bw * k, top + bh * k + z * 0.3); ctx.lineTo(cx - bw + bw * k, top + bh * k + z * 0.75); ctx.stroke(); }
  ctx.fillStyle = '#f39fb0'; ctx.beginPath(); ctx.moveTo(cx + bw * 0.25, top + bh * 0.75 + z * 0.2); ctx.lineTo(cx + bw * 0.7, top + bh * 0.3 + z * 0.2); ctx.lineTo(cx + bw * 0.7, top + bh * 0.3 + z * 0.55); ctx.lineTo(cx + bw * 0.25, top + bh * 0.75 + z * 0.55); ctx.closePath(); ctx.fill();
  // 屋根（薄桃の紙を折った寄棟）
  const rh = L.TH * 0.9; const rw = bw * 1.28; const rhh = bh * 1.28;
  const ry = top - 2;
  ctx.fillStyle = '#e899a6'; ctx.beginPath(); ctx.moveTo(cx - rw, ry); ctx.lineTo(cx, ry + rhh); ctx.lineTo(cx, ry - rh * 0.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d97b8a'; ctx.beginPath(); ctx.moveTo(cx + rw, ry); ctx.lineTo(cx, ry + rhh); ctx.lineTo(cx, ry - rh * 0.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f4b6c0'; ctx.beginPath(); ctx.moveTo(cx - rw, ry); ctx.lineTo(cx, ry - rh * 0.5); ctx.lineTo(cx, ry - rh); ctx.lineTo(cx - rw * 0.35, ry - rh * 0.75); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#eea3af'; ctx.beginPath(); ctx.moveTo(cx + rw, ry); ctx.lineTo(cx, ry - rh * 0.5); ctx.lineTo(cx, ry - rh); ctx.lineTo(cx + rw * 0.35, ry - rh * 0.75); ctx.closePath(); ctx.fill();
  if (season === 'winter') { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.moveTo(cx - rw * 0.35, ry - rh * 0.75); ctx.lineTo(cx, ry - rh); ctx.lineTo(cx + rw * 0.35, ry - rh * 0.75); ctx.lineTo(cx, ry - rh * 0.6); ctx.closePath(); ctx.fill(); }
  // 煙突の湯けむり
  for (let i = 0; i < 3; i++) { const k = (time * 0.35 + i / 3) % 1; ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - k)})`; ctx.beginPath(); ctx.arc(cx + rw * 0.3 + Math.sin(k * 5) * 5, ry - rh * 0.9 - k * L.TH * 1.5, 4 + k * 8, 0, Math.PI * 2); ctx.fill(); }
  // 提灯
  for (const k of [-0.6, 0.6]) {
    const lx = cx + bw * k; const ly = top + bh * (k < 0 ? 0.4 : 0.4) + 6;
    ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.ellipse(lx, ly, 3.5, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,220,150,.35)'; ctx.beginPath(); ctx.arc(lx, ly, 9 + Math.sin(time * 2 + k) * 1.5, 0, Math.PI * 2); ctx.fill();
  }
}

// 島の縁の桜の木（紙工作）
function drawTree(ctx, x, y, r, season, time) {
  ctx.fillStyle = '#b88a6a'; ctx.fillRect(x - 2, y - r * 1.2, 4, r * 1.2);
  const col = season === 'winter' ? ['#ffffff', '#e6eef5'] : ['#f6b8c4', '#ec9db0'];
  const sw = Math.sin(time * 1.3 + x) * 1.5;
  for (const [ox, oy, rr, c] of [[-0.5, -1.3, 0.7, 1], [0.5, -1.4, 0.7, 1], [0, -1.9, 0.75, 0], [-0.2, -1.4, 0.6, 0]]) {
    ctx.fillStyle = col[c]; ctx.beginPath();
    const cx = x + ox * r + sw; const cy = y + oy * r;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.lineTo(cx + Math.cos(a) * rr * r, cy + Math.sin(a) * rr * r * 0.85); }
    ctx.closePath(); ctx.fill();
  }
}

function drawTile(ctx, L, s, x, y, season, hl) {
  const [cx, cy] = toScreen(L, x, y);
  const hw = L.TW / 2; const hh = L.TH / 2;
  ctx.fillStyle = (x + y) % 2 ? C.deck : C.deck2;
  if (season === 'winter') ctx.fillStyle = (x + y) % 2 ? '#fdf8f0' : '#f1ebe2';
  diamond(ctx, cx, cy, hw - 1, hh - 0.5); ctx.fill();
  // 板の線
  ctx.strokeStyle = 'rgba(190,150,110,.22)'; ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    const k = i / 3;
    ctx.beginPath(); ctx.moveTo(cx - hw + hw * k, cy - hh * k); ctx.lineTo(cx + hw * k, cy + hh - hh * k); ctx.stroke();
  }
  if (hl) { ctx.fillStyle = hl; diamond(ctx, cx, cy, hw - 2, hh - 1); ctx.fill(); }
}

// 床下の管（つながっていれば湯の色で流れる）
function drawPipes(ctx, L, s, net, time) {
  const hw = L.TW / 2; const hh = L.TH / 2;
  for (let y = 0; y < s.H; y++) {
    for (let x = 0; x < s.W; x++) {
      if (!s.pipes[y][x]) continue;
      const [cx, cy] = toScreen(L, x, y);
      const live = net.has(`${x},${y}`);
      ctx.strokeStyle = live ? 'rgba(232,128,110,.85)' : 'rgba(150,130,120,.6)';
      ctx.lineWidth = Math.max(3, L.TW * 0.07); ctx.lineCap = 'round';
      const links = Object.values(DIRS).filter(([dx, dy]) => {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= s.W || ny >= s.H) return false;
        return s.pipes[ny][nx] || s.items.some((it) => it.x === nx && it.y === ny && (it.type === 'source' || isBath(it)));
      });
      ctx.beginPath(); ctx.arc(cx, cy, ctx.lineWidth * 0.6, 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
      for (const [dx, dy] of links) {
        const ex = cx + (dx - dy) * hw / 2; const ey = cy + (dx + dy) * hh / 2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
        if (live) {
          const k = (time * 1.5 + x * 0.3 + y * 0.3) % 1;
          ctx.fillStyle = '#fff4e0'; ctx.beginPath(); ctx.arc(cx + (ex - cx) * k, cy + (ey - cy) * k, 1.6, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }
}

function drawEntrance(ctx, L) {
  const [cx, cy] = toScreen(L, 0, 0);
  const hw = L.TW / 2; const hh = L.TH / 2;
  ctx.fillStyle = 'rgba(243,159,176,.45)'; diamond(ctx, cx, cy, hw - 4, hh - 2); ctx.fill();
  // 紙の門
  const H = L.TH * 1.5;
  ctx.fillStyle = '#e3a2ad';
  ctx.fillRect(cx - hw * 0.62, cy - H, 3, H); ctx.fillRect(cx + hw * 0.62 - 3, cy - H, 3, H);
  ctx.fillStyle = '#f4c3c9'; ctx.beginPath(); ctx.moveTo(cx - hw * 0.8, cy - H); ctx.lineTo(cx, cy - H - 8); ctx.lineTo(cx + hw * 0.8, cy - H); ctx.lineTo(cx + hw * 0.7, cy - H + 5); ctx.lineTo(cx - hw * 0.7, cy - H + 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.leaf; ctx.fillRect(cx - 6, cy - H + 6, 12, 7);
}

function drawSource(ctx, L, it, time, calm) {
  const [cx, cy] = toScreen(L, it.x, it.y);
  const hw = L.TW / 2; const hh = L.TH / 2;
  // 岩の山
  const rocks = [[-0.45, 0.05, 0.36, '#d9d2c8'], [0.42, 0.08, 0.34, '#cfc6bb'], [0, 0.3, 0.4, '#e4ddd2'], [-0.1, -0.25, 0.38, '#c8bfb3']];
  for (const [ox, oy, r, col] of rocks) {
    const x = cx + ox * hw; const y = cy + oy * hh - 4;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - r * hw, y); ctx.lineTo(x - r * hw * 0.4, y - r * hw * 0.8); ctx.lineTo(x + r * hw * 0.5, y - r * hw * 0.7); ctx.lineTo(x + r * hw, y); ctx.lineTo(x, y + r * hh * 0.6); ctx.closePath(); ctx.fill();
  }
  // 湧き口
  ctx.fillStyle = '#f39a7f'; ctx.beginPath(); ctx.ellipse(cx, cy - hh * 0.55, hw * 0.32, hh * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd2b8'; ctx.beginPath(); ctx.ellipse(cx - 2, cy - hh * 0.6, hw * 0.16, hh * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  // 立ちのぼる湯けむりの柱
  for (let i = 0; i < 4; i++) {
    const k = calm ? 0.4 + i * 0.1 : (time * 0.5 + i / 4) % 1;
    ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - k)})`;
    ctx.beginPath(); ctx.arc(cx + Math.sin(k * 6 + i) * 4, cy - hh * 0.7 - k * L.TH * 1.6, 3 + k * 6, 0, Math.PI * 2); ctx.fill();
  }
}

function drawBath(ctx, L, it, m, time, sel) {
  const [cx, cy] = toScreen(L, it.x, it.y);
  const F = FACILITIES[it.type];
  const small = it.type === 'shallow' || it.type === 'view';
  const k = small ? 0.72 : 0.86;
  const hw = L.TW / 2 * k; const hh = L.TH / 2 * k;
  const z = L.TH * (it.type === 'shallow' ? 0.34 : 0.55);
  const top = cy - z + L.TH * 0.1;
  const frame = it.type === 'hot' ? ['#f6d2a8', '#e3b17e', '#cf9a68'] : it.type === 'view' ? ['#f9dfe6', '#ebb9c4', '#d99eab'] : [C.pink, C.pinkD, C.pinkDD];
  box(ctx, cx, top, hw, hh, z, frame[0], frame[1], frame[2]);
  // 側面の紙の葉
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath(); ctx.ellipse(cx - hw / 2, top + hh / 2 + z / 2, 3, 2, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + hw / 2, top + hh / 2 + z / 2, 3, 2, 0.5, 0, Math.PI * 2); ctx.fill();
  // 湯
  ctx.fillStyle = waterColor(m.T, m.on);
  diamond(ctx, cx, top, hw * 0.78, hh * 0.78); ctx.fill();
  if (m.on) {
    ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 1.2;
    const r = (time * 0.6) % 1;
    ctx.beginPath(); ctx.ellipse(cx - hw * 0.15, top, hw * 0.25 * (0.6 + r), hh * 0.25 * (0.6 + r), 0, 0.2, Math.PI * 0.9); ctx.stroke();
  }
  // 種類の飾り
  if (it.type === 'hot') { // 毛糸の保温帯
    ctx.strokeStyle = C.leaf; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - hw, top + z * 0.45); ctx.lineTo(cx, top + hh + z * 0.45); ctx.lineTo(cx + hw, top + z * 0.45); ctx.stroke();
  }
  if (it.type === 'view') { // 手すりと望遠鏡
    ctx.strokeStyle = '#c9808e'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - hw, top - 7); ctx.lineTo(cx, top - hh - 7); ctx.lineTo(cx + hw, top - 7); ctx.stroke();
    for (const [px, py] of [[cx - hw, top], [cx, top - hh], [cx + hw, top]]) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 7); ctx.stroke(); }
    ctx.fillStyle = '#7f6d73'; ctx.save(); ctx.translate(cx + hw * 0.5, top - hh * 0.6 - 9); ctx.rotate(-0.5); ctx.fillRect(-1, -6, 3, 9); ctx.restore();
  }
  if (sel) { ctx.strokeStyle = '#5a4146'; ctx.lineWidth = 3; diamond(ctx, cx, top, hw + 3, hh + 2); ctx.stroke(); }
  return { cx, top, hw, hh };
}

function drawWindbreak(ctx, L, it, sel) {
  const [cx, cy] = toScreen(L, it.x, it.y);
  const [dx, dy] = DIRS[it.dir];
  // 風が来る側（dir）の辺に沿って立つ屏風。保護するのは反対側のマス
  const hw = L.TW / 2; const hh = L.TH / 2;
  const ex = cx + (dx - dy) * hw * 0.35; const ey = cy + (dx + dy) * hh * 0.35;
  const ax = (dy + dx) * hw * 0.42; const ay = (dy - dx) * hh * 0.42 * -1;
  const H = L.TH * 0.85;
  const pts = [-1, -0.33, 0.33, 1].map((k) => [ex + ax * k, ey - ay * k]);
  for (let i = 0; i < 3; i++) {
    const [x1, y1] = pts[i]; const [x2, y2] = pts[i + 1];
    ctx.fillStyle = i % 2 ? '#a9c94a' : '#c8de78';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x2, y2 - H); ctx.lineTo(x1, y1 - H); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = '#7f9a33'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1] - H); for (const p of pts) ctx.lineTo(p[0], p[1] - H); ctx.stroke();
  // 守る向きの小さな矢印
  const px = cx - (dx - dy) * hw * 0.5; const py = cy - (dx + dy) * hh * 0.5;
  ctx.fillStyle = 'rgba(111,168,58,.85)'; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
  if (sel) { ctx.strokeStyle = '#5a4146'; ctx.lineWidth = 3; diamond(ctx, cx, cy, hw - 2, hh - 1); ctx.stroke(); }
}

function drawFence(ctx, L, it, sel) {
  const [cx, cy] = toScreen(L, it.x, it.y);
  const hw = L.TW / 2; const hh = L.TH / 2;
  for (const [ox, oy, r] of [[-0.35, 0, 0.3], [0.35, 0, 0.3], [0, -0.3, 0.32], [0, 0.25, 0.3]]) {
    const x = cx + ox * hw; const y = cy + oy * hh - 6;
    ctx.fillStyle = '#9fbf45'; ctx.beginPath(); ctx.arc(x, y + 2, r * hw, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c6dc6c'; ctx.beginPath(); ctx.arc(x - 1, y, r * hw * 0.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#f39fb0'; ctx.beginPath(); ctx.arc(cx + 4, cy - 12, 2, 0, Math.PI * 2); ctx.arc(cx - 6, cy - 8, 2, 0, Math.PI * 2); ctx.fill();
  if (sel) { ctx.strokeStyle = '#5a4146'; ctx.lineWidth = 3; diamond(ctx, cx, cy, hw - 2, hh - 1); ctx.stroke(); }
}

// 湯気の粒（風下へ流れる）
export function stepSteam(parts, L, s, m, dt, calm) {
  const wind = windAt(s);
  const [wx, wy] = DIRS[wind];
  const vx = -(wx - wy) * L.TW * 0.25; const vy = -(wx + wy) * L.TH * 0.25;
  if (!calm) {
    for (const b of s.items) {
      const mm = m[b.id];
      if (!mm || !mm.on) continue;
      const rate = b.q * 0.9 * dt;
      if (Math.random() < rate) {
        const [cx, cy] = toScreen(L, b.x, b.y);
        parts.push({ x: cx + (Math.random() - 0.5) * L.TW * 0.3, y: cy - L.TH * 0.6, life: 0, max: 1.6 + b.q * 0.35, r: 3 + b.q, vx, vy });
      }
    }
  }
  for (const p of parts) { p.life += dt; p.x += (p.vx * 0.55 + Math.sin(p.life * 3) * 4) * dt; p.y += (p.vy * 0.55 - 12) * dt; p.r += dt * 4; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life > parts[i].max) parts.splice(i, 1);
  if (parts.length > 220) parts.splice(0, parts.length - 220);
}

function drawSteam(ctx, parts) {
  for (const p of parts) {
    const a = Math.max(0, 0.38 * (1 - p.life / p.max));
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
}

// 強風の筋
function drawWind(ctx, L, s, time, calm) {
  if (!s.strong || calm) return;
  const [wx, wy] = DIRS[windAt(s)];
  const vx = -(wx - wy); const vy = -(wx + wy) * 0.5;
  const n = Math.hypot(vx, vy) || 1;
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (let i = 0; i < 10; i++) {
    const k = ((time * 0.45 + i * 0.137) % 1);
    const bx = (i * 97) % L.w; const by = (i * 61) % L.h;
    const x = bx + vx / n * (k - 0.5) * L.w * 0.9; const y = by + vy / n * (k - 0.5) * L.w * 0.9;
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + vx / n * 26, y + vy / n * 26); ctx.stroke();
  }
  ctx.restore();
}

// ---- 全体 ----
// ui: { sel, cursor, mode, ghost, highlights: Map(cellKey->color), positions: Map(guestId->{x,y}), time, parts, calm, moods }
export function draw(ctx, L, s, ui) {
  const m = metrics(s);
  const time = ui.time;
  if (ui.hits) ui.hits.length = 0;
  const season = s.base <= 15 ? 'winter' : 'spring';
  ctx.clearRect(0, 0, L.w, L.h);
  drawBackground(ctx, L, time, ui.calm);
  drawInn(ctx, L, s, time, season);
  drawIsland(ctx, L, s, season);
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) drawTile(ctx, L, s, x, y, season, ui.highlights?.get(`${x},${y}`));
  drawEntrance(ctx, L);
  { const [lx, ly] = toScreen(L, -0.75, s.H - 1); drawTree(ctx, lx, ly, L.TW * 0.32, season, time); const [rx, ry] = toScreen(L, s.W - 0.1, s.H + 0.2); drawTree(ctx, rx, ry, L.TW * 0.28, season, time); }
  drawPipes(ctx, L, s, network(s), time);
  if (ui.cursor) { const [cx, cy] = toScreen(L, ui.cursor[0], ui.cursor[1]); ctx.strokeStyle = '#6fa83a'; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]); diamond(ctx, cx, cy, L.TW / 2 - 3, L.TH / 2 - 2); ctx.stroke(); ctx.setLineDash([]); }

  // 奥から順に：設備と鳥
  const drawables = [];
  for (const it of s.items) drawables.push({ d: it.x + it.y, z: 0, f: () => drawItem(ctx, L, s, it, m, time, ui) });
  if (ui.ghost) drawables.push({ d: ui.ghost.x + ui.ghost.y, z: 0.5, f: () => { ctx.save(); ctx.globalAlpha = 0.55; drawItem(ctx, L, s, ui.ghost, ui.ghostM || m, time, ui); ctx.restore(); } });
  const bathersByBath = {};
  for (const g of s.guests) {
    if (g.st === 'bath') (bathersByBath[g.target] ||= []).push(g);
  }
  const waiting = s.guests.filter((g) => g.st === 'wait');
  for (const g of s.guests) {
    if (g.st === 'pending' || (g.st === 'gone' && !ui.flying?.has(g.id))) continue;
    const pos = ui.positions?.get(g.id);
    if (g.st === 'bath') {
      const b = s.items.find((i) => i.id === g.target);
      if (!b) continue;
      const list = bathersByBath[b.id]; const idx = list.indexOf(g);
      drawables.push({ d: b.x + b.y + 0.2, z: 1, f: () => {
        const [cx, cy] = toScreen(L, b.x, b.y);
        const off = list.length > 1 ? (idx ? 1 : -1) * L.TW * 0.14 : 0;
        const by = cy - L.TH * (b.type === 'shallow' ? 0.14 : 0.36);
        const mood = ui.moods?.get(g.id);
        drawBird(ctx, g.sp, cx + off, by, L.TW * 0.42, { dir: idx ? -1 : 1, bath: true, t: time, mood: mood === 'good' ? 'happy' : null });
        // 水面（下半身を隠す）
        ctx.fillStyle = waterColor(m[b.id].T, m[b.id].on);
        ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(cx + off, by + 1, L.TW * 0.13, L.TH * 0.1, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        if (mood === 'bad') bubble(ctx, cx + off, by - L.TW * 0.32, '💢', '#ffe1dc');
        else if (mood === 'mid') bubble(ctx, cx + off, by - L.TW * 0.32, '…', '#fff6d8');
        if (ui.selGuest === g.id) { ctx.strokeStyle = '#5a4146'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx + off, by - 6, L.TW * 0.18, 0, Math.PI * 2); ctx.stroke(); }
        ui.hits?.push({ g: g.id, x: cx + off, y: by - 6, r: L.TW * 0.2 });
      } });
      continue;
    }
    let px; let py; let fly = 0;
    if (g.st === 'gone') { const fp = ui.flying.get(g.id); px = fp.x; py = fp.y; fly = fp.k; }
    else if (pos) { px = pos.x; py = pos.y; }
    else { [px, py] = [g.x, g.y]; }
    let sx; let sy;
    if (g.st === 'wait' && !fly) {
      const i = waiting.indexOf(g);
      const [ex, ey] = toScreen(L, 0, 0);
      sx = ex + ((i % 3) - 1) * L.TW * 0.2 - L.TW * 0.25 * Math.floor(i / 3); sy = ey + L.TH * 0.15 - L.TH * 0.12 * Math.floor(i / 3) + (i % 3 === 1 ? -3 : 0);
    } else { [sx, sy] = toScreen(L, px, py); sy += L.TH * 0.15; }
    if (fly) { sy -= fly * L.h * 0.6; sx += fly * L.TW; }
    const hop = g.st === 'walk' && !ui.calm ? Math.abs(Math.sin(time * 9 + g.id)) * 3 : 0;
    drawables.push({ d: px + py + 0.4, z: 2, f: () => {
      drawBird(ctx, g.sp, sx, sy - hop, L.TW * 0.44, { dir: fly ? 1 : (g.st === 'walk' ? 1 : -1), t: time });
      if (g.st === 'wait' && g.why && !fly) bubble(ctx, sx, sy - L.TW * 0.5, g.why.includes('熱') ? '熱い…' : g.why.includes('ぬる') ? 'ぬるい…' : g.why.includes('空') ? '満員…' : '？', '#fff6d8');
      if (ui.selGuest === g.id) { ctx.strokeStyle = '#5a4146'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy - 8, L.TW * 0.22, 0, Math.PI * 2); ctx.stroke(); }
      if (!fly) ui.hits?.push({ g: g.id, x: sx, y: sy - 8, r: L.TW * 0.2 });
    } });
  }
  drawables.sort((a, b) => a.d - b.d || a.z - b.z);
  for (const d of drawables) d.f();

  drawSteam(ctx, ui.parts || []);
  // 浴槽の札（温度と、困っていること）
  for (const b of s.items) {
    if (!isBath(b)) continue;
    const mm = m[b.id];
    const [cx, cy] = toScreen(L, b.x, b.y);
    const ty = cy - L.TH * 1.05;
    const label = mm.on ? `${mm.T}°` : '閉';
    const fs = Math.max(10, Math.min(13, L.TW * 0.17));
    tag(ctx, cx, ty, label, mm.on ? (mm.T >= 40 ? '#e07a6b' : mm.T >= 30 ? '#e8a25c' : '#6fb2c4') : '#b9a9a0', '#fff', fs);
    const icons = [];
    if (mm.exposed) icons.push(['風', '#7fb7cf']);
    if (!mm.view) icons.push([mm.steamBy ? '湯気' : '景×', '#b39aa0']);
    let ix = cx - (icons.length - 1) * 13;
    for (const [t, c] of icons) { tag(ctx, ix, ty + fs + 3, t, c, '#fff', Math.max(8, fs - 3)); ix += 26; }
  }
  drawWind(ctx, L, s, time, ui.calm);
  if (ui.point) { // 手引きの矢印
    const [cx, cy] = toScreen(L, ui.point[0], ui.point[1]);
    const yy = cy - L.TH * 1.9 - Math.abs(Math.sin(time * 4)) * 8;
    ctx.fillStyle = '#6fa83a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, yy + 16); ctx.lineTo(cx - 12, yy); ctx.lineTo(cx - 5, yy); ctx.lineTo(cx - 5, yy - 12); ctx.lineTo(cx + 5, yy - 12); ctx.lineTo(cx + 5, yy); ctx.lineTo(cx + 12, yy); ctx.closePath(); ctx.stroke(); ctx.fill();
  }
}

function drawItem(ctx, L, s, it, m, time, ui) {
  const sel = ui.sel === it.id;
  if (it.type === 'source') return drawSource(ctx, L, it, time, ui.calm);
  if (isBath(it)) return drawBath(ctx, L, it, m[it.id] || { T: s.base, on: false }, time, sel);
  if (it.type === 'windbreak') return drawWindbreak(ctx, L, it, sel);
  if (it.type === 'fence') return drawFence(ctx, L, it, sel);
  return null;
}

// 小さな鳥アイコン（HTML の一覧用）
export function birdIcon(sp, size = 30) {
  const c = document.createElement('canvas');
  const r = Math.min(2, window.devicePixelRatio || 1);
  c.width = size * r; c.height = size * r;
  const ctx = c.getContext('2d'); ctx.scale(r, r);
  const longNeck = sp === 'crane' || sp === 'swan' || sp === 'heron';
  drawBird(ctx, sp, size * (longNeck ? 0.36 : 0.42), size * 0.97, size * (longNeck ? 0.62 : 0.78), { dir: 1 });
  return c;
}

export { TUNE };
