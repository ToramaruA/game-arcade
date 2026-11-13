// Canvas の図形だけで描く絵（外部素材なし）。金属細工と浮世絵風の雲がテーマ。
// 座標はゲームの論理座標（960×540）。敵は左向き、自機は右向き。
import { W, H } from './data.js';
const FW = W; const FH = H;

const TAU = Math.PI * 2;
export const C = {
  gold: '#f0c25a', goldD: '#a8701f', goldL: '#fff0b8', ink: '#1a0e06', copper: '#c8693a', copperD: '#6e3216',
  bronze: '#9a6a34', cyan: '#5ff4ff', cyanD: '#0aa6c8', red: '#ff4b2b', redD: '#7a0d06', washi: '#efe1c2', green: '#7dffb0',
};

function metal(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}
function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); }
function rivets(ctx, pts, r = 1.6, col = C.goldL) { ctx.fillStyle = col; for (let i = 0; i < pts.length; i += 2) { ctx.beginPath(); ctx.arc(pts[i], pts[i + 1], r, 0, TAU); ctx.fill(); } }
function glow(ctx, x, y, r, col, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
}
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

// ---------- 背景：和紙の質感 ----------
let washi = null;
function washiTexture() {
  if (washi) return washi;
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  for (let i = 0; i < 900; i++) {
    const x = hash(i) * 512; const y = hash(i + 999) * 512; const l = 6 + hash(i + 77) * 26; const a = hash(i + 5) * TAU;
    g.strokeStyle = `rgba(255,240,210,${0.03 + hash(i + 3) * 0.06})`; g.lineWidth = 0.6 + hash(i + 8);
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(255,235,200,${hash(i + 4000) * 0.05})`; g.fillRect(hash(i + 2000) * 512, hash(i + 3000) * 512, 1.4, 1.4); }
  washi = c; return c;
}

// 浮世絵風の雲：丸の重なり＋明るい縁取り＋下に筋雲
export function cloud(ctx, x, y, s, fill, line, a = 1) {
  ctx.globalAlpha = a;
  const bumps = [[-1.1, 0.15, 0.55], [-0.55, -0.2, 0.7], [0.15, -0.35, 0.85], [0.85, -0.1, 0.65], [1.35, 0.18, 0.45]];
  ctx.fillStyle = fill; ctx.strokeStyle = line; ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [bx, by, br] of bumps) { ctx.moveTo(x + bx * s + br * s, y + by * s); ctx.arc(x + bx * s, y + by * s, br * s, 0, TAU); }
  ctx.fill();
  ctx.beginPath();
  for (const [bx, by, br] of bumps) ctx.arc(x + bx * s, y + by * s, br * s, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.fillStyle = fill; ctx.fillRect(x - 1.6 * s, y + 0.1 * s, 3.2 * s, 0.45 * s);
  ctx.beginPath(); ctx.moveTo(x - 1.9 * s, y + 0.55 * s); ctx.lineTo(x + 1.9 * s, y + 0.55 * s); ctx.stroke();
  ctx.globalAlpha = 1;
}
export function swirlAt(ctx, x, y, r, t, col, a) { swirl(ctx, x, y, r, t, col, a); }
function swirl(ctx, x, y, r, t, col, a) { // 渦雲
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.05); ctx.globalAlpha = a; ctx.strokeStyle = col;
  for (let k = 0; k < 3; k++) {
    ctx.lineWidth = 10 - k * 2.5; ctx.beginPath();
    for (let i = 0; i < 120; i++) { const q = i / 120; const ang = q * TAU * 2.2 + k * 2.1; const rr = r * (0.15 + q * 0.85); const px = Math.cos(ang) * rr; const py = Math.sin(ang) * rr * 0.62; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.stroke();
  }
  ctx.restore(); ctx.globalAlpha = 1;
}

// 海域ごとの背景。scroll は左へ流れる距離
export function drawSky(ctx, sea, t, opts = {}) {
  const pal = opts.sky || SKY[sea] || SKY[0];
  const W = opts.w || FW; const H = opts.h || FH; const ky = H / FH;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, pal[0]); g.addColorStop(0.6, pal[1]); g.addColorStop(1, pal[2]);
  ctx.fillStyle = g; ctx.fillRect(-40, -40, W + 80, H + 80);
  // 遠景の星・粒
  for (let i = 0; i < 60; i++) {
    const x = (hash(i) * W * 1.2 - t * 6 * (0.3 + hash(i + 9) * 0.5)) % (W * 1.2); const xx = x < 0 ? x + W * 1.2 : x;
    ctx.fillStyle = `rgba(255,240,200,${0.15 + 0.35 * hash(i + 3) * (0.6 + 0.4 * Math.sin(t * 2 + i))})`;
    ctx.fillRect(xx - 20, hash(i + 5) * H * 0.55, 1.6, 1.6);
  }
  // 遠い稲光
  const fl = Math.max(0, Math.sin(t * 0.9 + sea) * 12 - 11);
  if (fl > 0 && !opts.calm) {
    ctx.globalAlpha = fl * 0.35; ctx.strokeStyle = '#dff6ff'; ctx.lineWidth = 2;
    const bx = 300 + (Math.floor(t * 0.9 / TAU) * 397) % 500; ctx.beginPath(); ctx.moveTo(bx, 0);
    for (let i = 1; i < 7; i++) ctx.lineTo(bx + (hash(i + Math.floor(t)) - 0.5) * 60, i * 40);
    ctx.stroke(); ctx.globalAlpha = fl * 0.12; ctx.fillStyle = '#cfe8ff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }
  if (!opts.noSwirl) swirl(ctx, W * 0.79, 150, 260, t, pal[3] || 'rgba(120,140,220,0.5)', 0.16);
  // 海域ごとの遠景シルエット
  ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = pal[4] || 'rgba(0,0,0,.35)';
  const off = -(t * 14) % 480;
  ctx.translate(0, (ky - 1) * 400 * 0.9);
  for (let k = -1; k < W / 480 + 1; k++) farShape(ctx, sea, off + k * 480, t);
  ctx.restore();
  // 雲の層（3段のパララックス）
  const layers = [[0.25, 380, 0.75, 'rgba(255,255,255,.06)'], [0.55, 440, 1.1, 'rgba(255,255,255,.10)'], [1, 505, 1.5, 'rgba(255,255,255,.16)']];
  layers.forEach(([sp, y, sc, line], li) => {
    const fill = pal[5 + li] || ['rgba(40,50,90,.55)', 'rgba(60,70,120,.6)', 'rgba(90,96,150,.75)'][li];
    const span = 340 * sc; const o = -(t * 40 * sp) % span;
    for (let i = -1; i < W / span + 2; i++) cloud(ctx, o + i * span + (li % 2) * span * 0.5, H - (540 - y) + Math.sin(i * 1.7 + li) * 12, 34 * sc, fill, line);
  });
  // 和紙の繊維を重ねる
  ctx.globalAlpha = 0.9; const tw = washiTexture(); for (let y = 0; y < H; y += W) ctx.drawImage(tw, 0, y, W, W); ctx.globalAlpha = 1;
}
const SKY = [
  ['#0a1230', '#1b2a58', '#38406e', 'rgba(140,160,255,.5)', 'rgba(5,8,25,.7)', 'rgba(32,44,92,.6)', 'rgba(52,64,120,.65)', 'rgba(86,92,150,.8)'],
  ['#120804', '#2e160a', '#4c2611', 'rgba(255,160,90,.35)', 'rgba(20,6,2,.7)', 'rgba(60,28,12,.6)', 'rgba(84,40,18,.65)', 'rgba(112,60,30,.75)'],
  ['#100c20', '#2a2346', '#4b4066', 'rgba(220,200,255,.4)', 'rgba(10,6,22,.7)', 'rgba(50,40,80,.6)', 'rgba(72,60,104,.65)', 'rgba(104,92,138,.8)'],
  ['#04121c', '#0c2e3c', '#1a4a58', 'rgba(170,240,255,.4)', 'rgba(2,14,22,.7)', 'rgba(20,56,70,.55)', 'rgba(36,80,96,.6)', 'rgba(70,118,134,.7)'],
  ['#0e0309', '#260712', '#3e0d18', 'rgba(255,120,110,.35)', 'rgba(12,0,4,.75)', 'rgba(52,12,22,.6)', 'rgba(72,20,30,.65)', 'rgba(98,34,42,.75)'],
  ['#05030c', '#1a1430', '#3a2c1a', 'rgba(255,210,130,.4)', 'rgba(4,2,10,.75)', 'rgba(40,30,60,.6)', 'rgba(70,52,52,.65)', 'rgba(120,96,70,.8)'],
];
export const CLEAR_SKY = ['#5aa9e6', '#a6d8f0', '#f4e6c6', 'rgba(255,255,255,.5)', 'rgba(40,80,120,.25)', 'rgba(255,255,255,.55)', 'rgba(255,255,255,.7)', 'rgba(255,255,255,.9)'];

function farShape(ctx, sea, x, t) {
  const b = 400;
  switch (sea) {
    case 0: // 港のクレーンと灯台
      ctx.fillRect(x + 40, b - 120, 10, 160); poly(ctx, [x + 45, b - 120, x + 160, b - 104, x + 160, b - 98, x + 45, b - 108]); ctx.fill();
      ctx.fillRect(x + 260, b - 90, 26, 130); poly(ctx, [x + 252, b - 90, x + 294, b - 90, x + 273, b - 120]); ctx.fill();
      glow(ctx, x + 273, b - 96, 26, 'rgba(255,220,140,.7)', 0.6 + 0.3 * Math.sin(t * 3));
      ctx.fillStyle = 'rgba(5,8,25,.7)'; break;
    case 1: // 工場船の煙突
      for (let i = 0; i < 4; i++) { ctx.fillRect(x + 60 + i * 70, b - 80 - i * 18, 18, 140); glow(ctx, x + 69 + i * 70, b - 90 - i * 18, 30, 'rgba(255,120,40,.5)', 0.5); ctx.fillStyle = 'rgba(30,10,4,.7)'; }
      break;
    case 2: // 鐘楼
      for (let i = 0; i < 2; i++) { const xx = x + 80 + i * 220; ctx.fillRect(xx, b - 150, 40, 200); poly(ctx, [xx - 8, b - 150, xx + 48, b - 150, xx + 20, b - 200]); ctx.fill(); ctx.beginPath(); ctx.arc(xx + 20, b - 120, 10, Math.PI, 0); ctx.fill(); }
      break;
    case 3: // 氷の結晶塔
      for (let i = 0; i < 5; i++) { const xx = x + 40 + i * 90; const hh = 90 + hash(i + 3) * 120; poly(ctx, [xx, b + 40, xx + 18, b - hh, xx + 36, b + 40]); ctx.fill(); }
      break;
    case 4: // 赤い雲の柱
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x + 100 + i * 140, b - 60, 50, 140, 0, 0, TAU); ctx.fill(); }
      break;
    default: // 主機の歯車
      ctx.save(); ctx.translate(x + 240, b - 60); ctx.rotate(t * 0.1);
      for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.fillRect(-10, -120, 20, 30); }
      ctx.beginPath(); ctx.arc(0, 0, 100, 0, TAU); ctx.fill(); ctx.restore();
  }
}

// ---------- 自機：金銅の機械雷鳥 ----------
// wing: 1=開いた翼, 0=閉じた翼（吸収中）。lights: 0〜5（翼先の充電灯）
export function drawBird(ctx, x, y, o = {}) {
  const { wing = 1, lights = 0, t = 0, scale = 1, blink = false, absorbing = false } = o;
  if (blink && Math.floor(t * 18) % 2 === 0) ctx.globalAlpha = 0.35;
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  const flap = Math.sin(t * 9) * 0.08 * wing;
  // 推進の光
  glow(ctx, -34, 2, 22, absorbing ? 'rgba(95,244,255,.7)' : 'rgba(255,190,90,.8)', 0.9);
  // 尾羽
  for (let i = -1; i <= 1; i++) {
    ctx.save(); ctx.rotate(Math.PI + i * 0.32);
    ctx.fillStyle = metal(ctx, 0, -5, 0, 5, [C.goldL, C.gold, C.goldD]);
    poly(ctx, [10, -5, 40, -7, 46, 0, 40, 7, 10, 5]); ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.restore();
  }
  // 翼（上下に2枚、3枚の羽板で関節を作る）
  const wingFn = (sgn) => {
    const open = 0.36 + 0.64 * wing;
    ctx.save(); ctx.scale(1, sgn);
    ctx.translate(2, -4);
    ctx.rotate(-(Math.PI / 2 + 0.28) - (1 - wing) * 1.05 + flap);
    for (let k = 0; k < 3; k++) {
      const len = (50 - k * 9) * open; const w0 = 13 - k * 2;
      ctx.save(); ctx.rotate(-k * 0.3 * open);
      ctx.fillStyle = metal(ctx, 0, -w0, len, w0, k === 0 ? [C.goldL, C.gold, C.goldD] : k === 1 ? ['#ffe39a', '#d79b37', '#80501a'] : ['#e6b45e', '#a8701f', '#5a3510']);
      poly(ctx, [-4, -w0 * 0.6, len * 0.6, -w0, len + 8, -2, len * 0.65, w0 * 0.7, -4, w0 * 0.5]);
      ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,245,210,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(4, -w0 * 0.3); ctx.lineTo(len * 0.8, -3); ctx.stroke();
      rivets(ctx, [6, 0, len * 0.4, -w0 * 0.25], 1.4);
      ctx.restore();
    }
    // 翼先の充電灯
    const n = sgn < 0 ? [0, 1, 2] : [3, 4];
    n.forEach((li, j) => {
      const px = (38 - j * 12) * open; const py = 4 + j * 4;
      const on = li < lights;
      if (on) glow(ctx, px, py, 9, 'rgba(95,244,255,.9)', 0.9);
      ctx.fillStyle = on ? '#e9ffff' : '#3b2a14'; ctx.beginPath(); ctx.arc(px, py, 2.6, 0, TAU); ctx.fill();
    });
    ctx.restore();
  };
  wingFn(-1);
  // 胴体
  ctx.fillStyle = metal(ctx, 0, -12, 0, 14, [C.goldL, C.gold, C.bronze, '#4a2a0c']);
  ctx.beginPath(); ctx.moveTo(32, 0); ctx.bezierCurveTo(24, -14, -10, -14, -30, -4); ctx.lineTo(-30, 5); ctx.bezierCurveTo(-10, 15, 24, 13, 32, 0); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();
  // 胸の装甲板の線
  ctx.strokeStyle = 'rgba(60,30,6,.7)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-4 - i * 9, 0, 11, -1.1, 1.1); ctx.stroke(); }
  rivets(ctx, [-18, -7, -18, 7, 2, -9, 2, 9], 1.3);
  // 頭・くちばし・とさか
  ctx.fillStyle = metal(ctx, 18, -10, 18, 10, [C.goldL, C.gold, C.goldD]);
  ctx.beginPath(); ctx.ellipse(26, -2, 12, 9, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff1c4'; poly(ctx, [35, -5, 54, 0, 35, 4]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.red; poly(ctx, [20, -10, 14, -22, 26, -12, 24, -24, 31, -11]); ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.4; ctx.stroke();
  glow(ctx, 29, -4, 8, 'rgba(95,244,255,.9)'); ctx.fillStyle = '#eaffff'; ctx.beginPath(); ctx.arc(29, -4, 2.4, 0, TAU); ctx.fill();
  wingFn(1);
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---------- 敵8種 ----------
export function drawEnemy(ctx, e, t) {
  ctx.save(); ctx.translate(e.x, e.y);
  const fl = e.flash > 0;
  switch (e.type) {
    case 'scout': smallBird(ctx, t + e.id, 1, ['#d58a52', '#8a4720', '#3c1a08'], '#5ff4ff'); break;
    case 'sparrow': smallBird(ctx, t * 1.4 + e.id, 0.92, ['#e7764e', '#a2301b', '#3d0c04'], '#ffd04a', true); break;
    case 'gunship': gunship(ctx, t, e); break;
    case 'cruiser': cruiser(ctx, t, e); break;
    case 'drone': drone(ctx, t, e); break;
    case 'mirror': mirrorBird(ctx, t, e); break;
    case 'missile': missileBoat(ctx, t, e); break;
    case 'weaver': weaver(ctx, t, e); break;
    default: break;
  }
  if (fl) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, e.r * 1.3, 'rgba(255,255,255,.8)', 0.8); ctx.globalCompositeOperation = 'source-over'; }
  ctx.restore();
  // 体力の目盛り（2以上の敵）
  if (e.maxHp >= 2 && e.hp < e.maxHp) {
    const w = e.r * 1.6; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w, 4);
    ctx.fillStyle = '#ffd45a'; ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w * Math.max(0, e.hp) / e.maxHp, 4);
  }
}
function smallBird(ctx, t, s, pal, eye, round) {
  ctx.scale(s, s);
  const f = Math.sin(t * 12) * 0.5;
  ctx.fillStyle = metal(ctx, 0, -10, 0, 10, pal); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6;
  for (const sg of [-1, 1]) { ctx.save(); ctx.scale(1, sg); ctx.rotate(-0.5 - f * sg * 0.6); poly(ctx, [0, 0, 8, -22, 18, -18, 10, -2]); ctx.fill(); ctx.stroke(); ctx.restore(); }
  ctx.beginPath(); if (round) ctx.ellipse(0, 0, 14, 11, 0, 0, TAU); else ctx.ellipse(0, 0, 17, 8, 0, 0, TAU); ctx.fill(); ctx.stroke();
  poly(ctx, [-14, -3, -24, 0, -14, 3]); ctx.fillStyle = '#ffe2a0'; ctx.fill(); ctx.stroke();
  poly(ctx, [14, -2, 24, -8, 24, 8, 14, 2]); ctx.fillStyle = pal[1]; ctx.fill(); ctx.stroke();
  glow(ctx, -8, -3, 7, eye); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-8, -3, 1.8, 0, TAU); ctx.fill();
}
function hull(ctx, len, h, pal) {
  ctx.fillStyle = metal(ctx, 0, -h, 0, h, pal); ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-len, 0); ctx.quadraticCurveTo(-len * 0.7, -h, 0, -h); ctx.lineTo(len * 0.8, -h * 0.9); ctx.quadraticCurveTo(len, -h * 0.4, len, 0);
  ctx.quadraticCurveTo(len, h * 0.6, len * 0.7, h); ctx.lineTo(-len * 0.5, h); ctx.quadraticCurveTo(-len * 0.9, h * 0.6, -len, 0); ctx.fill(); ctx.stroke();
}
function prop(ctx, x, y, r, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(0.35, 1); ctx.rotate(t * 20);
  ctx.fillStyle = 'rgba(240,220,170,.55)'; for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.ellipse(0, -r / 2, 3, r / 2, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function gunship(ctx, t, e) {
  // 気球＋小さなゴンドラ＋砲
  ctx.fillStyle = metal(ctx, 0, -22, 0, 4, ['#e6a06a', '#b4582a', '#5a220c']); ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(4, -8, 28, 15, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(40,14,4,.6)'; ctx.lineWidth = 1; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(4, -8, 28, 15 * Math.abs(i) / 3, 0, 0, TAU); ctx.stroke(); }
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  hull(ctx, 18, 7, [C.gold, C.bronze, '#3a2008']); ctx.translate(0, 14); ctx.translate(0, -14);
  ctx.fillStyle = '#2b1a0c'; ctx.fillRect(-34, 6, 20, 6);
  glow(ctx, -34, 9, 8 + (e.fireT < 0.4 ? 8 : 0), e.fire && e.fire.colors && e.fire.colors.includes('r') ? 'rgba(255,90,60,.8)' : 'rgba(95,244,255,.8)');
  prop(ctx, 30, 6, 16, t);
  if (e.armor) { ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-4, 0, 30, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke(); ctx.fillStyle = C.goldL; ctx.font = 'bold 11px sans-serif'; ctx.fillText('装甲', -16, -28); }
}
function cruiser(ctx, t, e) {
  // 装甲巡洋艦：重い船体・帆柱・砲2門・煙
  for (let i = 0; i < 3; i++) { const q = (t * 0.6 + i / 3) % 1; ctx.fillStyle = `rgba(60,50,46,${0.45 * (1 - q)})`; ctx.beginPath(); ctx.arc(14 + q * 30, -34 - q * 40, 6 + q * 12, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#3a2412'; ctx.fillRect(8, -38, 8, 20); ctx.fillRect(-14, -50, 4, 36);
  ctx.fillStyle = 'rgba(239,225,194,.92)'; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-12, -48); ctx.quadraticCurveTo(-30, -32, -12, -18); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(-17, -33, 4, 0, TAU); ctx.fill();
  hull(ctx, 40, 18, ['#d8925a', C.copper, C.copperD, '#2a1206']);
  ctx.strokeStyle = C.gold; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-38, -2); ctx.lineTo(36, -2); ctx.stroke();
  ctx.strokeStyle = 'rgba(30,10,2,.6)'; ctx.lineWidth = 1; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 10, -16); ctx.lineTo(i * 10 + 3, 16); ctx.stroke(); }
  rivets(ctx, [-30, 8, -18, 10, -6, 11, 6, 11, 18, 10, 30, 8], 1.6);
  ctx.fillStyle = '#20140a'; for (const oy of [-15, 15]) { ctx.fillRect(-52, oy - 4, 18, 8); glow(ctx, -52, oy, 8, 'rgba(95,244,255,.8)', 0.6 + 0.4 * Math.sin(t * 6)); }
  prop(ctx, 42, 0, 26, t);
}
function drone(ctx, t, e) {
  prop(ctx, 0, -16, 24, t * 1.3); ctx.save(); ctx.rotate(Math.PI / 2); prop(ctx, -16, 0, 0, 0); ctx.restore();
  ctx.fillStyle = '#2a1a0c'; ctx.fillRect(-1.5, -16, 3, 8);
  ctx.fillStyle = metal(ctx, 0, -12, 0, 12, ['#d6e6c0', '#7e9a6a', '#2e3a22']); ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.stroke();
  ctx.fillStyle = C.green; ctx.fillRect(-1.5, -5, 3, 10); ctx.fillRect(-5, -1.5, 10, 3);
  glow(ctx, 0, 0, 18 + Math.sin(t * 5) * 3, 'rgba(125,255,176,.5)');
}
function mirrorBird(ctx, t, e) {
  const open = !e.closed;
  ctx.strokeStyle = '#e8fdff'; ctx.lineWidth = 1.6;
  const wsp = open ? 1 : 0.5;
  for (const sg of [-1, 1]) {
    ctx.fillStyle = 'rgba(170,235,255,.55)';
    poly(ctx, [0, 0, 10 * wsp, -30 * wsp * sg, 24, -22 * wsp * sg, 14, -2 * sg]); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = metal(ctx, -16, -10, 16, 10, ['#ffffff', '#9fe6ff', '#2c8aa6']);
  poly(ctx, [-18, 0, -4, -10, 16, -4, 20, 0, 16, 4, -4, 10]); ctx.fill(); ctx.stroke();
  if (!open) {
    // 閉じた鏡（前面の六角の盾）
    ctx.save(); ctx.translate(-24, 0);
    const sh = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.fillStyle = `rgba(220,250,255,${0.55 + 0.25 * sh})`; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    poly(ctx, [0, -22, 8, -11, 8, 11, 0, 22, -6, 11, -6, -11]); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,90,60,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-3, -8); ctx.lineTo(4, 6); ctx.stroke();
    ctx.restore();
  } else {
    glow(ctx, 0, 0, 16, 'rgba(255,240,180,.9)'); ctx.fillStyle = '#fff7d0'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
  }
}
function missileBoat(ctx, t, e) {
  hull(ctx, 28, 11, ['#b2463a', '#6a1a14', '#2a0604']);
  ctx.fillStyle = '#2a0e08'; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
  for (const oy of [-16, 16]) { ctx.fillRect(-20, oy - 4, 26, 8); ctx.strokeRect(-20, oy - 4, 26, 8); ctx.fillStyle = C.red; poly(ctx, [-26, oy, -20, oy - 4, -20, oy + 4]); ctx.fill(); ctx.fillStyle = '#2a0e08'; }
  ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(24, 0); ctx.stroke();
  glow(ctx, -26, 0, 10, 'rgba(255,90,60,.8)', 0.5 + 0.5 * Math.sin(t * 8)); prop(ctx, 30, 0, 22, t);
}
function weaver(ctx, t, e) {
  // 糸車の機械：回る紡錘と脚
  ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) { const a = -0.8 + i * 0.55; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a + Math.PI / 2) * 26 + 10, Math.sin(a + Math.PI / 2) * 22); ctx.stroke(); }
  ctx.save(); ctx.rotate(t * 3);
  ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 17, 0, TAU); ctx.stroke();
  for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(17, 0); ctx.lineWidth = 1.6; ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = metal(ctx, 0, -8, 0, 8, ['#f6d79a', '#a06a2a', '#3a2008']); ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(95,244,255,.8)'; ctx.lineWidth = 1.2; ctx.beginPath();
  for (let i = 0; i < 20; i++) { const x = -i * 3; const y = Math.sin(t * 6 + i * 0.6) * 4; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.stroke();
}

// ---------- ボス6体 ----------
export function drawBoss(ctx, b, t, warnMuzzles = []) {
  const d = b.def;
  ctx.save(); ctx.translate(b.x, b.y);
  if (b.hp <= 0) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
  switch (d.id) {
    case 'anchor': bossAnchor(ctx, t, b); break;
    case 'windmill': bossWindmill(ctx, t, b); break;
    case 'twin': bossTwin(ctx, t, b); break;
    case 'eagle': bossEagle(ctx, t, b); break;
    case 'carrier': bossCarrier(ctx, t, b); break;
    default: bossEngine(ctx, t, b);
  }
  // 装甲／弱点
  if (b.armored && b.ph !== 'enter') {
    ctx.strokeStyle = `rgba(255,214,120,${0.35 + 0.2 * Math.sin(t * 3)})`; ctx.lineWidth = 3;
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + Math.PI / 6; const r = d.r * 0.55; ctx.lineTo(-d.r * 0.25 + Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.stroke();
  } else if (b.ph !== 'enter') {
    glow(ctx, -d.r * 0.25, 0, d.r * 0.6, 'rgba(255,250,210,.9)', 0.6 + 0.3 * Math.sin(t * 12));
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-d.r * 0.25, 0, 9, 0, TAU); ctx.fill();
  }
  if (b.flash > 0) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, d.r * 1.3, 'rgba(255,255,255,.9)', b.flash * 3); ctx.globalCompositeOperation = 'source-over'; }
  ctx.restore();
  // 砲口の予告光
  for (const m of warnMuzzles) {
    const k = 0.5 + 0.5 * Math.sin(t * 30);
    glow(ctx, m.x, m.y, 26 + k * 10, m.red ? 'rgba(255,80,50,.95)' : 'rgba(95,244,255,.95)');
    ctx.strokeStyle = m.red ? 'rgba(255,120,90,.8)' : 'rgba(150,250,255,.8)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + Math.cos(m.ang) * 120, m.y + Math.sin(m.ang) * 120); ctx.stroke(); ctx.setLineDash([]);
  }
}
function bossAnchor(ctx, t, b) {
  // 巨大な銅の帆船
  galleon(ctx, t, 1.25);
  // 錨
  ctx.save(); ctx.translate(10, 70 + Math.sin(t * 2) * 4);
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(0, 0); ctx.stroke();
  ctx.strokeStyle = C.gold; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 28); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 14, 18, 0.2, Math.PI - 0.2); ctx.stroke(); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
  ctx.restore();
}
export function galleon(ctx, t, s = 1, smoke = true) {
  ctx.save(); ctx.scale(s, s);
  // 煙突の煙
  if (smoke) for (let i = 0; i < 6; i++) { const q = (t * 0.35 + i / 6) % 1; ctx.fillStyle = `rgba(70,60,58,${0.5 * (1 - q)})`; ctx.beginPath(); ctx.arc(30 + q * 70, -78 - q * 70, 8 + q * 22, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(-8 + q * 60, -64 - q * 60, 6 + q * 18, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#3a2412'; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  ctx.fillRect(24, -78, 12, 40); ctx.fillRect(-14, -64, 10, 30);
  ctx.fillStyle = C.gold; ctx.fillRect(22, -80, 16, 4); ctx.fillRect(-16, -66, 14, 4);
  // 帆柱と帆（和紙色、赤い日輪）
  ctx.fillStyle = '#2a1a0c'; ctx.fillRect(-44, -110, 5, 80); ctx.fillRect(60, -92, 4, 60);
  for (const [mx, top, wdt] of [[-42, -108, 46], [62, -90, 30]]) {
    ctx.fillStyle = 'rgba(239,225,194,.95)';
    ctx.beginPath(); ctx.moveTo(mx, top); ctx.quadraticCurveTo(mx - wdt, top + 30, mx - 2, top + 62); ctx.lineTo(mx, top + 62); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(mx - wdt * 0.32, top + 32, wdt * 0.18, 0, TAU); ctx.fill();
  }
  // 船体
  ctx.fillStyle = metal(ctx, 0, -40, 0, 50, ['#f0a868', C.copper, C.copperD, '#1e0c04']); ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-110, -30); ctx.lineTo(-80, -40); ctx.lineTo(100, -40); ctx.quadraticCurveTo(122, -20, 112, 10); ctx.quadraticCurveTo(90, 50, 20, 52); ctx.lineTo(-60, 50); ctx.quadraticCurveTo(-100, 30, -110, -30); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-104, -20); ctx.lineTo(108, -20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-96, 20); ctx.quadraticCurveTo(0, 30, 100, 16); ctx.stroke();
  // 砲門
  ctx.fillStyle = '#130804';
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-74 + i * 30, 0, 6, 0, TAU); ctx.fill(); }
  rivets(ctx, [-80, -30, -40, -30, 0, -30, 40, -30, 80, -30, -60, 36, -20, 40, 20, 40, 60, 34], 2);
  // 船首の金の雷鳥飾り
  ctx.fillStyle = C.gold; poly(ctx, [-110, -30, -134, -44, -122, -24, -138, -16, -112, -14]); ctx.fill(); ctx.stroke();
  // プロペラ
  prop(ctx, 116, 0, 50, t);
  ctx.restore();
}
function bossWindmill(ctx, t, b) {
  glow(ctx, 0, 0, 120, 'rgba(255,120,40,.35)');
  ctx.fillStyle = metal(ctx, -30, 0, 30, 0, ['#5a2a10', '#c8693a', '#5a2a10']); ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
  poly(ctx, [-28, 90, -16, -10, 16, -10, 28, 90]); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.rotate(t * (b.ph === 'fire' ? 2.1 : 0.6));
  for (let i = 0; i < 4; i++) {
    ctx.rotate(TAU / 4);
    ctx.fillStyle = metal(ctx, 0, 0, 0, -90, ['#ffcf6a', '#ff7a2a', '#a21e08']);
    poly(ctx, [-6, -10, -18, -92, 14, -96, 8, -10]); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,180,.7)'; ctx.lineWidth = 1; for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(-6 - k * 2.5, -10 - k * 17); ctx.lineTo(10 + k * 0.5, -10 - k * 17); ctx.stroke(); }
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
    glow(ctx, 0, -100, 18, 'rgba(255,140,40,.8)', 0.6 + 0.4 * Math.sin(t * 9 + i));
  }
  ctx.restore();
  ctx.fillStyle = metal(ctx, 0, -20, 0, 20, [C.goldL, C.gold, C.goldD]); ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff5a2a'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
}
function bell(ctx, t, y, ring) {
  ctx.save(); ctx.translate(-10, y);
  ctx.fillStyle = '#3a2614'; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  ctx.fillRect(-26, -34, 52, 56); ctx.strokeRect(-26, -34, 52, 56);
  poly(ctx, [-32, -34, 32, -34, 0, -60]); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(0, -18); ctx.rotate(Math.sin(t * (ring ? 10 : 2)) * (ring ? 0.4 : 0.1));
  ctx.fillStyle = metal(ctx, -14, 0, 14, 0, [C.goldD, C.goldL, C.goldD]); ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-14, 10, -18, 30); ctx.lineTo(18, 30); ctx.quadraticCurveTo(14, 10, 6, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore(); ctx.restore();
}
function bossTwin(ctx, t, b) {
  const a = b.def.attacks[b.ai];
  ctx.strokeStyle = '#2a1a0c'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-10, -80); ctx.lineTo(-10, 80); ctx.stroke();
  hull(ctx, 70, 28, ['#8e7aa8', '#4d3a66', '#1c1028']);
  ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-66, 0); ctx.lineTo(66, 0); ctx.stroke();
  rivets(ctx, [-50, -14, -25, -18, 0, -20, 25, -18, 50, -14], 2);
  bell(ctx, t, -100, b.ph === 'fire' && a.muzzle[0] === 0);
  ctx.save(); ctx.scale(1, -1); bell(ctx, t, -100, b.ph === 'fire' && a.muzzle[0] === 1); ctx.restore();
  ctx.fillStyle = '#130804'; ctx.beginPath(); ctx.arc(-74, 0, 10, 0, TAU); ctx.fill();
}
function bossEagle(ctx, t, b) {
  const f = Math.sin(t * 2.2) * 0.12;
  ctx.strokeStyle = '#f2feff'; ctx.lineWidth = 2;
  for (const sg of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = `rgba(${150 + k * 20},${225 + k * 6},255,${0.45 - k * 0.06})`;
      const a = (-0.9 - k * 0.22 + f * sg) * sg;
      ctx.save(); ctx.rotate(a); poly(ctx, [0, 0, 20 + k * 6, -sg * 10, 120 - k * 14, -sg * 4, 100 - k * 10, sg * 14]); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }
  ctx.fillStyle = metal(ctx, -60, -20, 60, 20, ['#ffffff', '#a8eaff', '#2a7a96']);
  poly(ctx, [-70, 0, -40, -22, 30, -26, 70, 0, 30, 26, -40, 22]); ctx.fill(); ctx.stroke();
  poly(ctx, [-70, 0, -96, -6, -100, 4, -74, 10]); ctx.fillStyle = '#eaffff'; ctx.fill(); ctx.stroke();
  glow(ctx, -56, -6, 14, 'rgba(255,80,60,.9)'); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-56, -6, 3, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-30 + i * 18, -22); ctx.lineTo(-20 + i * 18, 22); ctx.stroke(); }
}
function bossCarrier(ctx, t, b) {
  // 雷雲母艦：黒い雲の塊と、下の金属船体、雷コイル
  for (let i = 0; i < 7; i++) cloud(ctx, -60 + (i % 4) * 40, -40 + Math.floor(i / 4) * 30 + Math.sin(t + i) * 3, 28, 'rgba(30,14,22,.95)', 'rgba(255,140,140,.35)');
  ctx.fillStyle = metal(ctx, 0, 0, 0, 60, ['#6a5a5a', '#3a2a2e', '#140a0c']); ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-110, 10); ctx.lineTo(100, 10); ctx.quadraticCurveTo(110, 50, 60, 64); ctx.lineTo(-70, 64); ctx.quadraticCurveTo(-110, 50, -110, 10); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = C.gold; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-104, 26); ctx.lineTo(100, 26); ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const x = -60 + i * 50; ctx.fillStyle = '#2a1a12'; ctx.fillRect(x - 6, -10, 12, 24);
    ctx.strokeStyle = C.gold; ctx.lineWidth = 2; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(x, -6 + k * 5, 9, 2.5, 0, 0, TAU); ctx.stroke(); }
    if (Math.sin(t * 7 + i * 2) > 0.6) { ctx.strokeStyle = '#ffe6ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, -12); for (let k = 1; k < 5; k++) ctx.lineTo(x + (hash(k + i + Math.floor(t * 10)) - 0.5) * 30, -12 - k * 14); ctx.stroke(); }
  }
  glow(ctx, -80, 0, 30, 'rgba(255,120,160,.6)');
}
function bossEngine(ctx, t, b) {
  // 天の主機：金銅の巨大な球体。翼が開閉し、3つの砲口を持つ
  const wg = b.wing ?? 0.5;
  for (const sg of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      ctx.save(); ctx.rotate(sg * (0.55 + k * 0.28 + wg * 0.45));
      ctx.fillStyle = metal(ctx, 0, 0, 160, 0, [C.goldD, C.gold, '#5a3a12']); ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
      poly(ctx, [60, -10, 150 - k * 10, -18, 168 - k * 10, 0, 150 - k * 10, 18, 60, 10]); ctx.fill(); ctx.stroke();
      rivets(ctx, [80, 0, 110, 0, 140 - k * 10, 0], 2);
      ctx.restore();
    }
  }
  glow(ctx, 0, 0, 160, 'rgba(255,200,110,.35)');
  ctx.fillStyle = metal(ctx, -90, -90, 90, 90, ['#fff2c0', '#e0a64a', '#8a5a1c', '#2e1a06']); ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 92, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.rotate(t * 0.3); ctx.strokeStyle = 'rgba(60,30,6,.6)'; ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(0, 0, 92, 92 * Math.abs(Math.cos(i * 0.8 + t * 0.4)), 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = C.goldL; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 70, 0, TAU); ctx.stroke();
  for (const [mx, my] of b.def.muzzles) { ctx.fillStyle = '#160a02'; ctx.beginPath(); ctx.arc(mx * 0.85, my * 0.85, 13, 0, TAU); ctx.fill(); ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.stroke(); }
  ctx.fillStyle = '#1a0a02'; ctx.beginPath(); ctx.ellipse(-24, 0, 26, 18, 0, 0, TAU); ctx.fill();
  glow(ctx, -24, 0, 26, 'rgba(255,90,40,.95)'); ctx.fillStyle = '#ffe8c0'; ctx.beginPath(); ctx.arc(-24, 0, 6, 0, TAU); ctx.fill();
}

// ---------- 弾・雷槍・予告線 ----------
export function drawBullet(ctx, b, t) {
  if (b.c === 'b') {
    ctx.strokeStyle = 'rgba(95,244,255,.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 3 + ((t * 8 + b.x * 0.05) % 4), 0, TAU); ctx.stroke();
    ctx.fillStyle = '#0fd6f0'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#eaffff'; ctx.beginPath(); ctx.arc(b.x - 1, b.y - 1, b.r * 0.45, 0, TAU); ctx.fill();
  } else if (b.kind === 'missile') {
    const a = Math.atan2(b.vy, b.vx);
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
    glow(ctx, -12, 0, 10, 'rgba(255,160,60,.8)');
    ctx.fillStyle = '#ff5030'; ctx.strokeStyle = '#2a0402'; ctx.lineWidth = 2;
    poly(ctx, [12, 0, 2, -6, -10, -6, -14, -9, -12, 0, -14, 9, -10, 6, 2, 6]); ctx.fill(); ctx.stroke();
    ctx.restore();
  } else {
    const a = Math.atan2(b.vy, b.vx);
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
    ctx.fillStyle = '#ff4b2b'; ctx.strokeStyle = '#ffe2c8'; ctx.lineWidth = 1.6;
    poly(ctx, [b.r + 4, 0, -b.r, -b.r, -b.r, b.r]); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#3a0400'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
}
export function drawLance(ctx, l) {
  const k = 1 - l.t / 0.45; const half = l.half * (0.6 + 0.4 * k);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, l.y - half * 2, 0, l.y + half * 2);
  g.addColorStop(0, 'rgba(95,244,255,0)'); g.addColorStop(0.5, `rgba(180,250,255,${0.8 * k})`); g.addColorStop(1, 'rgba(95,244,255,0)');
  ctx.fillStyle = g; ctx.fillRect(l.x, l.y - half * 2, W - l.x + 40, half * 4);
  ctx.fillStyle = `rgba(255,255,255,${k})`; ctx.fillRect(l.x, l.y - half * 0.35, W - l.x + 40, half * 0.7);
  ctx.strokeStyle = `rgba(230,255,255,${k})`; ctx.lineWidth = 2;
  for (let j = 0; j < 2; j++) {
    ctx.beginPath(); ctx.moveTo(l.x, l.y);
    for (let x = l.x; x < W + 40; x += 28) ctx.lineTo(x, l.y + (hash(x * 0.1 + j * 7 + Math.floor(l.t * 30)) - 0.5) * half * 2.4);
    ctx.stroke();
  }
  ctx.restore();
}
export function drawHazard(ctx, h, t) {
  ctx.save(); ctx.translate(h.x0, h.y0); ctx.rotate(h.ang);
  if (h.t < h.warn) {
    const k = h.t / h.warn;
    ctx.fillStyle = `rgba(255,60,40,${0.08 + 0.14 * k})`; ctx.fillRect(0, -h.w / 2, h.len, h.w);
    ctx.strokeStyle = `rgba(255,90,60,${0.5 + 0.5 * Math.sin(t * 30)})`; ctx.lineWidth = 2; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 80;
    ctx.beginPath(); ctx.moveTo(0, -h.w / 2); ctx.lineTo(h.len, -h.w / 2); ctx.moveTo(0, h.w / 2); ctx.lineTo(h.len, h.w / 2); ctx.stroke(); ctx.setLineDash([]);
    if (h.kind === 'lane') { ctx.fillStyle = 'rgba(255,200,180,.85)'; ctx.font = 'bold 18px serif'; for (let x = 60; x < h.len; x += 220) ctx.fillText('雷', x, 6); }
  } else {
    const k = 1 - (h.t - h.warn) / h.live;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,${h.kind === 'lane' ? 220 : 120},${h.kind === 'lane' ? 255 : 90},${0.35 * k})`; ctx.fillRect(0, -h.w / 2, h.len, h.w);
    ctx.strokeStyle = `rgba(255,255,255,${k})`; ctx.lineWidth = 3;
    for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.moveTo(0, 0); for (let x = 0; x < h.len; x += 24) ctx.lineTo(x, (hash(x + j * 13 + Math.floor(t * 40)) - 0.5) * h.w * 0.9); ctx.stroke(); }
  }
  ctx.restore();
}
export function drawAbsorb(ctx, x, y, r, t) {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r);
  g.addColorStop(0, 'rgba(95,244,255,0)'); g.addColorStop(0.85, 'rgba(95,244,255,.12)'); g.addColorStop(1, 'rgba(95,244,255,.32)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(160,250,255,.75)'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x, y, r, t * 3 + i * TAU / 3, t * 3 + i * TAU / 3 + 0.8); ctx.stroke(); }
  ctx.restore();
}
