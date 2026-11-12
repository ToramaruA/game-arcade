// 切り絵と手描き線の絵（すべて Canvas のパス）。外部画像なし。
import * as S from './sprites.js';
import { TS, ROWS, serpentSpan, serpentY, serpentHead, clockOpen, exitLocked, THREAD_COLORS } from './logic.js';

export const PAL = [
  { // 第一章：鯨の草原
    sky: ['#1c0d3d', '#4b2477', '#8d4f9e', '#e7a3c4'], star: '#fff6d8',
    far: '#6a4a9a', mid: '#9a78c4', near: '#c9b3e6',
    ground: '#efe8f3', groundDark: '#c7b6dc', groundEdge: '#8d73b4', top: '#8fd17e', topDark: '#4f9a69', ink: '#3a2356',
    plank: '#fff4e3', mist: '#f6efff',
  },
  { // 第二章：眠る森
    sky: ['#070b22', '#142451', '#25407a', '#4f7fae'], star: '#dff3ff',
    far: '#1d2c5a', mid: '#151d40', near: '#0f132d',
    ground: '#2d2142', groundDark: '#1c142c', groundEdge: '#0e0918', top: '#3f9d86', topDark: '#245f58', ink: '#0b0716',
    plank: '#6b4f3a', mist: '#a9d8ff',
  },
  { // 第三章：鯨の夢の底
    sky: ['#04020f', '#170b3a', '#2d1458', '#5a1f5e'], star: '#ffe9b8',
    far: '#2a1650', mid: '#1c0f3a', near: '#120a28',
    ground: '#272052', groundDark: '#191338', groundEdge: '#0a0720', top: '#d6b45a', topDark: '#8a6a2a', ink: '#08051a',
    plank: '#3d2f6e', mist: '#ffb0a0',
  },
];

const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const wob = (x) => Math.sin(x * 0.071) * 2.2 + Math.sin(x * 0.193 + 1.3) * 1.4;

export function threadColor(idx, t = 0) {
  const c = THREAD_COLORS[idx] || THREAD_COLORS[0];
  if (c.c === 'rainbow') return `hsl(${(t * 120) % 360} 90% 72%)`;
  return c.c;
}

// ───────────────────────── 背景 ─────────────────────────
export function drawBackground(ctx, ch, camX, camY, vw, vh, t, opts = {}) {
  const P = PAL[ch];
  const g = ctx.createLinearGradient(0, 0, 0, vh);
  g.addColorStop(0, P.sky[0]); g.addColorStop(0.45, P.sky[1]); g.addColorStop(0.78, P.sky[2]); g.addColorStop(1, P.sky[3]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
  // 星
  ctx.fillStyle = P.star;
  for (let i = 0; i < 70; i++) {
    const x = ((hash(i) * 2400 - camX * 0.03) % (vw + 40) + vw + 40) % (vw + 40) - 20;
    const y = hash(i + 50) * vh * 0.6;
    const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
    ctx.globalAlpha = 0.35 + tw * 0.55;
    const s = hash(i + 9) < 0.15 ? 2.2 : 1.1;
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
  const horizon = vh * 0.62 - (camY - (ROWS * TS - vh)) * 0.15;
  if (ch === 0) bgMeadow(ctx, P, camX, vw, vh, horizon, t, opts);
  else if (ch === 1) bgForest(ctx, P, camX, vw, vh, horizon, t, opts);
  else bgDream(ctx, P, camX, vw, vh, horizon, t, opts);
}

function cloudBand(ctx, color, camX, par, y, vw, scale, seed, alpha = 1) {
  ctx.fillStyle = color; ctx.globalAlpha = alpha;
  const span = 260 * scale;
  const off = ((camX * par) % span + span) % span;
  ctx.beginPath();
  ctx.moveTo(-span, y + 200);
  for (let x = -span - off; x < vw + span; x += span / 4) {
    const k = Math.floor((x + camX * par) / (span / 4));
    const h = 18 + hash(k + seed) * 34;
    ctx.quadraticCurveTo(x + span / 8, y - h * scale, x + span / 4, y);
  }
  ctx.lineTo(vw + span, y + 400); ctx.lineTo(-span, y + 400); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawWhale(ctx, x, y, s, t, opts = {}) {
  // 大きな霧鯨（右上から斜めに泳ぐ）
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(opts.rot ?? -0.12);
  const body = opts.color || '#f4eef6';
  const shade = opts.shade || '#cbbfe0';
  const flap = Math.sin(t * 1.3) * 0.12;
  // 尾びれ
  ctx.fillStyle = shade;
  ctx.save(); ctx.translate(250, -6); ctx.rotate(flap);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(50, -18, 92, -64); ctx.quadraticCurveTo(70, -10, 98, 30); ctx.quadraticCurveTo(50, 12, 0, 18); ctx.closePath(); ctx.fill();
  ctx.restore();
  // 胴
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-260, 10);
  ctx.bezierCurveTo(-250, -90, -60, -120, 120, -70);
  ctx.bezierCurveTo(200, -48, 250, -20, 262, 2);
  ctx.bezierCurveTo(240, 30, 160, 60, 40, 70);
  ctx.bezierCurveTo(-120, 84, -250, 70, -260, 10);
  ctx.fill();
  // 腹の影と縞
  ctx.fillStyle = shade;
  ctx.beginPath(); ctx.moveTo(-250, 30); ctx.bezierCurveTo(-180, 76, 40, 82, 200, 34); ctx.bezierCurveTo(120, 64, -120, 90, -250, 30); ctx.fill();
  ctx.strokeStyle = shade; ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-200 + i * 26, 46 + i * 2); ctx.quadraticCurveTo(-150 + i * 30, 66, -90 + i * 34, 58); ctx.stroke(); }
  // 胸びれ
  ctx.fillStyle = shade;
  ctx.save(); ctx.translate(-120, 50); ctx.rotate(0.5 + flap * 1.5);
  ctx.beginPath(); ctx.ellipse(30, 10, 46, 14, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  // 目
  if (opts.eye !== false) {
    ctx.fillStyle = '#2a1a48'; ctx.beginPath(); ctx.ellipse(-190, 6, 9, opts.eyeOpen ?? 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a1a48'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-190, 2, 14, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  }
  // 背中の草と小さな灯台
  if (opts.grass !== false) {
    ctx.fillStyle = '#8fd17e';
    ctx.beginPath(); ctx.moveTo(-200, -72); ctx.bezierCurveTo(-120, -112, 20, -112, 120, -72); ctx.bezierCurveTo(20, -96, -110, -96, -200, -72); ctx.fill();
    // 背中の小さな灯台
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-14, -100); ctx.lineTo(-10, -136); ctx.lineTo(0, -136); ctx.lineTo(4, -100); ctx.fill();
    ctx.fillStyle = '#e0584a'; ctx.fillRect(-12, -122, 14, 6); ctx.beginPath(); ctx.moveTo(-13, -136); ctx.lineTo(-5, -146); ctx.lineTo(3, -136); ctx.fill();
    const lg = ctx.createRadialGradient(-5, -138, 1, -5, -138, 26); lg.addColorStop(0, 'rgba(255,230,140,.9)'); lg.addColorStop(1, 'rgba(255,230,140,0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(-5, -138, 26, 0, Math.PI * 2); ctx.fill();
  }
  // 霧の尾
  ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff';
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(300 + i * 40, 30 + Math.sin(t + i) * 8, 40 - i * 5, 12, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function bgMeadow(ctx, P, camX, vw, vh, horizon, t, opts) {
  // 月
  ctx.fillStyle = '#fff3d6'; ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.arc(vw * 0.82, vh * 0.16, Math.min(vw, vh) * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(vw * 0.82, vh * 0.16, Math.min(vw, vh) * 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // 遠くを泳ぐ霧鯨
  const s = Math.max(0.35, Math.min(vw, vh * 1.6) / 1100);
  const wx = vw * 0.68 - ((camX * 0.06) % (vw * 2));
  if (!opts.noWhale) { ctx.save(); if (opts.whaleDim) ctx.globalAlpha = 0.45; drawWhale(ctx, wx, horizon - vh * 0.36, s * (opts.whaleDim ? 0.8 : 1), t, { color: opts.whaleDim ? '#b9a6d6' : '#e9dff4', shade: '#8f78b8', grass: false, eye: true }); ctx.restore(); }
  cloudBand(ctx, P.far, camX, 0.12, horizon - 30, vw, 1.2, 3, 0.9);
  cloudBand(ctx, P.mid, camX, 0.25, horizon + 10, vw, 1, 11);
  cloudBand(ctx, P.near, camX, 0.42, horizon + 60, vw, 0.8, 23);
  // 漂う光
  for (let i = 0; i < 16; i++) {
    const x = ((hash(i + 300) * vw * 3 - camX * 0.5 + Math.sin(t * 0.5 + i) * 20) % (vw + 20) + vw + 20) % (vw + 20);
    const y = horizon - 120 + hash(i + 400) * 200 + Math.sin(t + i) * 10;
    ctx.fillStyle = 'rgba(255,230,160,.55)'; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
  }
}

function tree(ctx, x, base, h, w, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x - w * 0.08, base); ctx.lineTo(x - w * 0.05, base - h * 0.4); ctx.lineTo(x + w * 0.05, base - h * 0.4); ctx.lineTo(x + w * 0.08, base); ctx.fill();
  for (let i = 0; i < 4; i++) {
    const y = base - h * 0.3 - i * h * 0.18; const ww = w * (1 - i * 0.2);
    ctx.beginPath(); ctx.moveTo(x - ww / 2, y); ctx.quadraticCurveTo(x, y - h * 0.08, x + ww / 2, y); ctx.lineTo(x, y - h * 0.3); ctx.closePath(); ctx.fill();
  }
}

function bgForest(ctx, P, camX, vw, vh, horizon, t) {
  // 青い月と霧
  ctx.fillStyle = '#cfe8ff'; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(vw * 0.22, vh * 0.18, Math.min(vw, vh) * 0.05, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  const layers = [[P.far, 0.1, 1.4, 0], [P.mid, 0.25, 1.1, 40], [P.near, 0.45, 0.85, 90]];
  layers.forEach(([color, par, sc, dy], li) => {
    const span = 90 * sc;
    const off = ((camX * par) % span + span) % span;
    for (let x = -span - off; x < vw + span; x += span) {
      const k = Math.floor((x + camX * par) / span) + li * 100;
      tree(ctx, x + hash(k) * span * 0.4, horizon + dy + 60, (150 + hash(k + 7) * 120) * sc, (70 + hash(k + 3) * 40) * sc, color);
    }
    ctx.fillStyle = color; ctx.fillRect(0, horizon + dy + 58, vw, vh);
    // 霧の帯
    ctx.fillStyle = 'rgba(150,200,255,.12)'; ctx.fillRect(0, horizon + dy + 20 + Math.sin(t * 0.4 + li) * 6, vw, 40);
  });
  // 蛍
  for (let i = 0; i < 22; i++) {
    const x = ((hash(i + 700) * vw * 3 - camX * 0.6 + Math.sin(t * 0.7 + i) * 30) % (vw + 20) + vw + 20) % (vw + 20);
    const y = horizon - 60 + hash(i + 800) * 200 + Math.cos(t * 0.9 + i) * 14;
    const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i));
    ctx.fillStyle = `rgba(160,255,220,${a})`; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
  }
}

function bgDream(ctx, P, camX, vw, vh, horizon, t, opts) {
  // 星座の線
  ctx.strokeStyle = 'rgba(255,220,150,.25)'; ctx.lineWidth = 1;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const x = ((hash(k * 10 + i) * vw * 1.5 - camX * 0.04) % (vw + 100) + vw + 100) % (vw + 100) - 50;
      const y = hash(k * 10 + i + 5) * vh * 0.4 + 20;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // 巨大な霧鯨の目
  const eyeA = opts.eye ?? 0.5;
  if (eyeA > 0) {
    const ex = vw * 0.6 - (camX * 0.03) % 200; const ey = vh * 0.26; const R = Math.min(vw, vh) * 0.32;
    ctx.save(); ctx.globalAlpha = eyeA;
    ctx.fillStyle = '#e8dff6';
    ctx.beginPath(); ctx.moveTo(ex - R * 1.4, ey); ctx.quadraticCurveTo(ex, ey - R * 0.95, ex + R * 1.4, ey); ctx.quadraticCurveTo(ex, ey + R * 0.95, ex - R * 1.4, ey); ctx.fill();
    const look = Math.sin(t * 0.3) * R * 0.15;
    const ig = ctx.createRadialGradient(ex + look, ey, 2, ex + look, ey, R * 0.42);
    ig.addColorStop(0, '#fff6c8'); ig.addColorStop(0.35, '#e6b247'); ig.addColorStop(1, '#6a3f12');
    ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(ex + look, ey, R * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a0e2a'; ctx.beginPath(); ctx.ellipse(ex + look, ey, R * 0.1, R * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + look - R * 0.12, ey - R * 0.14, R * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9a86c4'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(ex - R * 1.4, ey); ctx.quadraticCurveTo(ex, ey - R * 0.95, ex + R * 1.4, ey); ctx.stroke();
    ctx.restore();
  }
  // 赤いひび
  const cracks = opts.cracks ?? 0.4;
  if (cracks > 0) {
    ctx.strokeStyle = `rgba(255,70,70,${0.5 * cracks})`; ctx.lineWidth = 2.5;
    for (let k = 0; k < 5; k++) {
      let x = ((hash(k + 90) * vw * 2 - camX * 0.08) % (vw + 200) + vw + 200) % (vw + 200) - 100; let y = 0;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let i = 0; i < 7; i++) { x += (hash(k * 7 + i) - 0.5) * 60; y += vh * 0.08; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }
  // 金の霧（鐘を鳴らすほど増える）
  const gold = opts.gold ?? 0;
  cloudBand(ctx, P.far, camX, 0.12, horizon + 10, vw, 1.2, 41, 0.95);
  if (gold > 0) cloudBand(ctx, '#e8c56a', camX, 0.12, horizon + 14, vw, 1.2, 41, gold * 0.5);
  cloudBand(ctx, P.mid, camX, 0.25, horizon + 50, vw, 1, 53);
  cloudBand(ctx, P.near, camX, 0.42, horizon + 100, vw, 0.8, 67);
  // 漂う紙片
  for (let i = 0; i < 14; i++) {
    const x = ((hash(i + 900) * vw * 3 - camX * 0.4 + t * 12) % (vw + 20) + vw + 20) % (vw + 20);
    const y = (hash(i + 950) * vh + t * 14 * (0.5 + hash(i))) % vh;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t + i);
    ctx.fillStyle = gold > 0.3 ? 'rgba(255,215,120,.6)' : 'rgba(255,120,120,.45)'; ctx.fillRect(-3, -2, 6, 4); ctx.restore();
  }
}

// ───────────────────────── 地形 ─────────────────────────
export function drawTiles(ctx, st, ch, c0, c1, r0, r1, t) {
  const P = PAL[ch];
  const solidLike = (c, r) => { const x = st.tiles[r]?.[c]; return x === '#'; };
  for (let r = Math.max(0, r0); r <= Math.min(ROWS - 1, r1); r++) {
    for (let c = Math.max(0, c0); c <= Math.min(st.w - 1, c1); c++) {
      const chx = st.tiles[r][c];
      const x = c * TS; const y = r * TS;
      switch (chx) {
        case '#': {
          const topOpen = !solidLike(c, r - 1) && r > 0;
          ctx.fillStyle = r > 0 && !topOpen ? P.groundDark : P.ground;
          ctx.fillRect(x - 0.5, y - 0.5, TS + 1, TS + 1);
          if (!topOpen) {
            // 切り絵の地層：波打つ紙の重なり
            ctx.strokeStyle = P.groundEdge; ctx.globalAlpha = 0.28; ctx.lineWidth = 2;
            const yy = y + 14 + Math.sin(c * 0.7 + r) * 4;
            ctx.beginPath(); ctx.moveTo(x - 0.5, yy + wob(x * 2)); ctx.lineTo(x + TS + 0.5, yy + wob(x * 2 + TS * 2)); ctx.stroke();
            if (hash(c * 31 + r * 7) < 0.3) { ctx.fillStyle = ch === 2 ? '#ffd76a' : P.groundEdge; ctx.globalAlpha = ch === 2 ? 0.35 : 0.22; ctx.beginPath(); ctx.ellipse(x + 20, y + 28, 10, 4, hash(c + r), 0, Math.PI * 2); ctx.fill(); }
            ctx.globalAlpha = 1;
          }
          if (topOpen) drawGroundTop(ctx, P, x, y, ch, c, t);
          if (!solidLike(c - 1, r) && c > 0) edge(ctx, P, x, y, -1);
          if (!solidLike(c + 1, r) && c < st.w - 1) edge(ctx, P, x + TS, y, 1);
          break;
        }
        case '=': drawPlank(ctx, P, x, y, st.tiles[r][c - 1] !== '=', st.tiles[r][c + 1] !== '=', ch); break;
        case '^': drawThorns(ctx, ch, x, y, t); break;
        case '~': drawMist(ctx, P, x, y, t, st.tiles[r - 1]?.[c] !== '~'); break;
        case 'X': drawLeaf(ctx, st, c, r, x, y, t); break;
        case 'W': drawWind(ctx, x, y, t, c, r, st.tiles[r - 1]?.[c] !== 'W'); break;
        case 'B': case 'b': drawBridge(ctx, P, x, y, st.groups[chx === 'B' ? 0 : 1], t); break;
        case 'D': case 'd': drawDoor(ctx, P, x, y, !st.groups[chx === 'D' ? 0 : 1], st.tiles[r - 1]?.[c] !== chx); break;
        case 'T': drawClockGate(ctx, x, y, !clockOpen(st), st.t); break;
        case 't': drawClockBridge(ctx, x, y, clockOpen(st), st.t); break;
        default: break;
      }
    }
  }
}

function drawGroundTop(ctx, P, x, y, ch, c, t) {
  // 紙の影
  ctx.fillStyle = P.groundEdge; ctx.globalAlpha = 0.5;
  ctx.fillRect(x - 0.5, y + 8, TS + 1, 6);
  ctx.globalAlpha = 1;
  ctx.fillStyle = P.top;
  ctx.beginPath(); ctx.moveTo(x - 0.5, y + 10);
  for (let i = 0; i <= 8; i++) { const xx = x + (i / 8) * TS; ctx.lineTo(xx, y - 2 + wob(xx)); }
  ctx.lineTo(x + TS + 0.5, y + 10); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.6;
  ctx.beginPath(); for (let i = 0; i <= 8; i++) { const xx = x + (i / 8) * TS; const yy = y - 2 + wob(xx); if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); } ctx.stroke();
  ctx.globalAlpha = 1;
  // 草・苔・金糸
  if (ch === 0) {
    ctx.strokeStyle = P.topDark; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const bx = x + 6 + i * 13 + hash(c * 3 + i) * 5; const sway = Math.sin(t * 2 + bx * 0.05) * 2;
      ctx.beginPath(); ctx.moveTo(bx, y + 2); ctx.quadraticCurveTo(bx + sway, y - 6, bx + sway * 2 + 2, y - 10 - hash(c + i) * 4); ctx.stroke();
    }
    if (hash(c * 13) < 0.18) { ctx.fillStyle = '#ffd6f0'; ctx.beginPath(); ctx.arc(x + 20, y - 6, 3, 0, Math.PI * 2); ctx.fill(); }
  } else if (ch === 1) {
    if (hash(c * 17) < 0.3) {
      const mx = x + 10 + hash(c) * 20;
      ctx.fillStyle = '#7ff0e0'; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 2 + c);
      ctx.beginPath(); ctx.arc(mx, y - 4, 5, Math.PI, 0); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#d8fff8'; ctx.fillRect(mx - 1, y - 4, 2, 5);
    }
  } else {
    ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x, y + 5 + wob(x) * 0.3); ctx.lineTo(x + TS, y + 5 + wob(x + TS) * 0.3); ctx.stroke(); ctx.setLineDash([]);
  }
}

function edge(ctx, P, x, y, dir) {
  ctx.strokeStyle = P.groundEdge; ctx.lineWidth = 3; ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.moveTo(x - dir * 1.5, y + 2); ctx.lineTo(x - dir * 1.5 + Math.sin(y) * 1.2, y + TS); ctx.stroke(); ctx.globalAlpha = 1;
}

function drawPlank(ctx, P, x, y, leftEnd, rightEnd, ch) {
  const ch_ = ch;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x, y + 10, TS, 6);
  ctx.fillStyle = P.plank;
  ctx.beginPath();
  ctx.moveTo(x + (leftEnd ? 4 : 0), y + 2);
  ctx.lineTo(x + TS - (rightEnd ? 4 : 0), y + 2);
  ctx.quadraticCurveTo(x + TS, y + 7, x + TS - (rightEnd ? 4 : 0), y + 12);
  ctx.lineTo(x + (leftEnd ? 4 : 0), y + 12);
  ctx.quadraticCurveTo(x, y + 7, x + (leftEnd ? 4 : 0), y + 2);
  ctx.fill();
  ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.2; ctx.stroke(); ctx.globalAlpha = 1;
  void ch_;
}

function drawThorns(ctx, ch, x, y, t) {
  ctx.fillStyle = ch === 0 ? '#4a2a6a' : ch === 1 ? '#1a0f2a' : '#3a0a2a';
  ctx.beginPath(); ctx.moveTo(x, y + TS);
  for (let i = 0; i < 4; i++) { const bx = x + i * 10; ctx.lineTo(bx + 5, y + 12 + Math.sin(t * 3 + bx) * 1.5 + (i % 2) * 6); ctx.lineTo(bx + 10, y + TS - 8); }
  ctx.lineTo(x + TS, y + TS); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = ch === 2 ? '#ff5a6a' : '#b06ad6'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1;
}

function drawMist(ctx, P, x, y, t, top) {
  ctx.fillStyle = P.mist; ctx.globalAlpha = 0.55;
  ctx.fillRect(x - 0.5, y + (top ? 12 : -0.5), TS + 1, top ? TS - 12 : TS + 1);
  if (top) {
    ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(x, y + 16);
    for (let i = 0; i <= 4; i++) { const xx = x + i * 10; ctx.lineTo(xx, y + 10 + Math.sin(t * 2 + xx * 0.1) * 4); }
    ctx.lineTo(x + TS, y + 24); ctx.lineTo(x, y + 24); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawLeaf(ctx, st, c, r, x, y, t) {
  const cr = st.crumbles[`${c},${r}`];
  if (cr && cr.broken > 0) {
    ctx.strokeStyle = 'rgba(255,200,120,.35)'; ctx.setLineDash([3, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x + 20, y + 6, 20, 6, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    return;
  }
  const shake = cr && cr.t > 0 ? Math.sin(t * 60) * 2 : 0;
  ctx.save(); ctx.translate(x + 20 + shake, y + 6);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(0, 6, 21, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = cr ? '#e0743a' : '#f0a845';
  ctx.beginPath(); ctx.moveTo(-22, 0); ctx.quadraticCurveTo(0, -10, 22, 0); ctx.quadraticCurveTo(0, 10, -22, 0); ctx.fill();
  ctx.strokeStyle = '#8a3f12'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.stroke();
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 7, 0); ctx.lineTo(i * 7 + 4, -4); ctx.moveTo(i * 7, 0); ctx.lineTo(i * 7 + 4, 4); ctx.stroke(); }
  ctx.restore();
}

function drawWind(ctx, x, y, t, c, r, top) {
  ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(x + 2, y, TS - 4, TS);
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    const yy = y + ((-t * 140 + i * 20 + hash(c * 5 + r) * 40) % TS + TS) % TS;
    const xx = x + 8 + hash(c + i * 3) * 24;
    ctx.beginPath(); ctx.moveTo(xx, yy + 10); ctx.quadraticCurveTo(xx + 4, yy + 4, xx, yy); ctx.stroke();
  }
  if (top) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(x + 20, y, 22, 6, 0, 0, Math.PI * 2); ctx.fill(); }
}

function drawBridge(ctx, P, x, y, on, t) {
  if (!on) {
    ctx.strokeStyle = 'rgba(255,215,106,.45)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, TS - 4, 10); ctx.setLineDash([]);
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x, y + 12, TS, 6);
  ctx.fillStyle = '#e8c06a'; ctx.fillRect(x, y, TS, 13);
  ctx.fillStyle = '#b8862e'; ctx.fillRect(x + 19, y, 2, 13);
  ctx.strokeStyle = '#ffeeb0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + TS, y + 2); ctx.stroke();
  ctx.strokeStyle = '#ffd76a'; ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 3 + x); ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.quadraticCurveTo(x + 20, y - 4, x + TS, y - 14); ctx.stroke(); ctx.globalAlpha = 1;
}

function drawDoor(ctx, P, x, y, closed, top) {
  if (!closed) { ctx.strokeStyle = 'rgba(255,215,106,.3)'; ctx.setLineDash([3, 5]); ctx.strokeRect(x + 8, y, TS - 16, TS); ctx.setLineDash([]); return; }
  ctx.fillStyle = '#5a3a6e'; ctx.fillRect(x + 4, y, TS - 8, TS);
  ctx.fillStyle = '#7a5a92'; ctx.fillRect(x + 8, y, 6, TS); ctx.fillRect(x + 26, y, 6, TS);
  ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 2; ctx.strokeRect(x + 4, y, TS - 8, TS);
  if (top) { ctx.fillStyle = '#ffd76a'; ctx.beginPath(); ctx.arc(x + 20, y + 14, 6, Math.PI, 0); ctx.lineTo(x + 27, y + 18); ctx.lineTo(x + 13, y + 18); ctx.fill(); }
}

function drawClockGate(ctx, x, y, closed, t) {
  const k = closed ? 1 : 0.25;
  ctx.globalAlpha = k;
  ctx.fillStyle = '#3a2a6a'; ctx.fillRect(x + 6, y, TS - 12, TS);
  ctx.strokeStyle = '#c8b0ff'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + 10 + i * 10, y); ctx.lineTo(x + 10 + i * 10, y + TS); ctx.stroke(); }
  ctx.globalAlpha = 1;
  if (!closed) { ctx.strokeStyle = 'rgba(200,176,255,.5)'; ctx.setLineDash([3, 4]); ctx.strokeRect(x + 6, y, TS - 12, TS); ctx.setLineDash([]); }
  void t;
}

function drawClockBridge(ctx, x, y, on, t) {
  if (!on) { ctx.strokeStyle = 'rgba(200,176,255,.5)'; ctx.setLineDash([3, 4]); ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, TS - 4, 10); ctx.setLineDash([]); return; }
  ctx.fillStyle = '#9a7ae0'; ctx.fillRect(x, y, TS, 12);
  ctx.fillStyle = '#e6dbff'; ctx.fillRect(x, y, TS, 3);
  ctx.fillStyle = '#ffd76a'; ctx.beginPath(); ctx.arc(x + 20, y + 7, 3, 0, Math.PI * 2); ctx.fill();
  void t;
}

// ───────────────────────── もの ─────────────────────────
export function drawObjects(ctx, st, ch, t, preview) {
  for (const s of st.ships) drawShip(ctx, s, t);
  for (const c of st.checkpoints) drawCheckpoint(ctx, c, t);
  if (st.exit) drawLighthouse(ctx, st.exit.x, st.exit.y, !exitLocked(st), t, 1);
  for (const sw of st.switches) drawSwitch(ctx, sw, t);
  for (const l of st.levers) drawLever(ctx, l, t);
  for (const b of st.bells) drawBigBell(ctx, b, t, st);
  for (const h of st.hooks) drawHook(ctx, h, t, preview && preview.ref === h);
  for (const s of st.seeds) drawSeed(ctx, s, t);
  for (const s of st.stars) if (!s.got) S.drawStarBell(ctx, s.x, s.y + Math.sin(t * 2.4 + s.id) * 3, 1, t);
  void ch;
}

export { drawStarBell } from './sprites.js';

function star(ctx, x, y, R, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r : R; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}

export function drawHook(ctx, h, t, targeted) {
  if (h.gone) return;
  S.drawStarHook(ctx, h, t);
  if (targeted) targetRing(ctx, h.x, h.y, t);
}

export function targetRing(ctx, x, y, t, color = '#ffd76a') {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.9;
  const r = 20 + Math.sin(t * 8) * 2;
  ctx.setLineDash([6, 4]); ctx.lineDashOffset = -t * 30;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}

function drawLever(ctx, l, t) { S.drawBellLever(ctx, l, t); }

function drawSwitch(ctx, sw, t) { S.drawSwitchBell(ctx, sw, t); }

function drawBigBell(ctx, b, t, st) { S.drawGreatBell(ctx, b, t, st); }

function drawCheckpoint(ctx, c, t) {
  const x = c.x; const y = c.y + 40;
  ctx.strokeStyle = '#4a3a5a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 44); ctx.lineTo(x + 10, y - 44); ctx.stroke();
  ctx.fillStyle = c.on ? '#ffcf6a' : '#6a5a7a';
  ctx.beginPath(); ctx.ellipse(x + 10, y - 34, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
  if (c.on) {
    const g = ctx.createRadialGradient(x + 10, y - 34, 2, x + 10, y - 34, 30);
    g.addColorStop(0, `rgba(255,210,120,${0.6 + 0.2 * Math.sin(t * 5)})`); g.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + 10, y - 34, 30, 0, Math.PI * 2); ctx.fill();
  }
}

export function drawLighthouse(ctx, x, footY, open, t, s = 1) {
  ctx.save(); ctx.translate(x, footY); ctx.scale(s, s);
  if (open) {
    ctx.save(); ctx.rotate(Math.sin(t * 0.8) * 0.5);
    const g = ctx.createLinearGradient(0, -110, 160, -110);
    g.addColorStop(0, 'rgba(255,230,140,.6)'); g.addColorStop(1, 'rgba(255,230,140,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -110); ctx.lineTo(170, -150); ctx.lineTo(170, -70); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f6f0ff'; ctx.strokeStyle = '#3a2356'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-11, -96); ctx.lineTo(11, -96); ctx.lineTo(18, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e0584a'; ctx.beginPath(); ctx.moveTo(-16, -30); ctx.lineTo(-14, -48); ctx.lineTo(14, -48); ctx.lineTo(16, -30); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-13, -66); ctx.lineTo(-12, -80); ctx.lineTo(12, -80); ctx.lineTo(13, -66); ctx.fill();
  ctx.fillStyle = '#3a2356'; ctx.fillRect(-15, -100, 30, 5);
  ctx.fillStyle = open ? '#ffe680' : '#5a4a6a'; ctx.fillRect(-9, -116, 18, 16);
  ctx.strokeRect(-9, -116, 18, 16);
  ctx.fillStyle = '#e0584a'; ctx.beginPath(); ctx.moveTo(-13, -116); ctx.lineTo(0, -130); ctx.lineTo(13, -116); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5a3a6e'; ctx.beginPath(); ctx.arc(0, 0, 7, Math.PI, 0); ctx.fill();
  if (!open) {
    ctx.strokeStyle = '#c8b0ff'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(0, -108, 14, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawSeed(ctx, s, t) {
  const x = s.x + s.w / 2; const y = s.y + s.h / 2;
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(s.x * 0.05) * 0.2);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 18, 18, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a0683a'; ctx.strokeStyle = '#3a1f0a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 2, 18, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#d8a06a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-4, 2, 10, -1.2, 1.2); ctx.stroke();
  ctx.fillStyle = '#6fd18a'; ctx.beginPath(); ctx.moveTo(0, -13); ctx.quadraticCurveTo(10 + Math.sin(t * 2) * 2, -26, 16, -18); ctx.quadraticCurveTo(8, -14, 0, -13); ctx.fill();
  ctx.restore();
}

function drawShip(ctx, s, t) {
  const x = s.x; const y = s.y + Math.sin(t * 2 + s.id) * 1.5;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(x + s.w / 2, y + 22, s.w * 0.6, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#8a7ab0'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + s.w + 6, y);
  for (let i = 4; i >= 0; i--) ctx.arc(x + (i + 0.5) * (s.w / 5), y + 10, s.w / 10, 0, Math.PI, false);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 帆
  ctx.strokeStyle = '#6a5a8a'; ctx.beginPath(); ctx.moveTo(x + s.w / 2, y); ctx.lineTo(x + s.w / 2, y - 56); ctx.stroke();
  ctx.fillStyle = '#fff6e0'; ctx.beginPath(); ctx.moveTo(x + s.w / 2 + 2, y - 54); ctx.quadraticCurveTo(x + s.w / 2 + 34 + Math.sin(t * 2) * 3, y - 34, x + s.w / 2 + 2, y - 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd76a'; star(ctx, x + s.w / 2 + 12, y - 32, 6, 2.5);
  ctx.restore();
}

// ───────────────────────── 主人公ミオ ─────────────────────────
export { drawMio } from './sprites.js';

export function drawEnemy(ctx, e, t, st) {
  if (e.dead) return;
  ctx.save();
  if (e.bound > 0 || e.drag) ctx.globalAlpha = 1;
  switch (e.kind) {
    case 'moth': drawMoth(ctx, e, t); break;
    case 'bee': drawBee(ctx, e, t); break;
    case 'lamp': drawLamp(ctx, e, t, st); break;
    case 'serpent': drawSerpent(ctx, e, t); break;
    case 'eater': drawEater(ctx, e, t); break;
    default: break;
  }
  ctx.restore();
  if (e.bound > 0 && e.kind !== 'serpent') boundWrap(ctx, e.x, e.y, e.r + 6, t);
  if ((e.state === 'warn' && e.kind !== 'eater') || (e.kind === 'eater' && e.alert)) warnMark(ctx, e.x, e.y - e.r - 22, t);
  if (e.stun > 0 && !e.drag) dizzy(ctx, e.x, e.y - e.r - 8, t);
}

export function warnMark(ctx, x, y, t) {
  ctx.save(); ctx.translate(x, y); const s = 1 + Math.sin(t * 20) * 0.08; ctx.scale(s, s);
  ctx.fillStyle = '#ff4a3a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(11, 8); ctx.lineTo(-11, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillRect(-1.5, -5, 3, 7); ctx.fillRect(-1.5, 4, 3, 2.5);
  ctx.restore();
}
function dizzy(ctx, x, y, t) {
  ctx.fillStyle = '#ffd76a';
  for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; star(ctx, x + Math.cos(a) * 12, y + Math.sin(a) * 4, 4, 1.6); }
}
function boundWrap(ctx, x, y, r, t) {
  ctx.save(); ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 4; ctx.globalAlpha = 0.9;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x, y + (i - 1) * 7, r, r * 0.35, Math.sin(t * 2 + i) * 0.2, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}

function drawMoth(ctx, e, t) {
  const flap = e.bound > 0 ? 0.2 : Math.sin(t * (e.state === 'dive' ? 30 : 14) + e.id) * 0.5 + 0.5;
  const warn = e.state === 'warn';
  ctx.translate(e.x, e.y); ctx.scale(e.face, 1);
  if (e.state === 'dive') ctx.rotate(Math.atan2(e.vy, Math.abs(e.vx)) * 0.5);
  // 翅（朱色、目玉模様）
  for (const side of [-1, 1]) {
    ctx.save(); ctx.scale(1, side); ctx.rotate(-0.25 - flap * 0.6);
    ctx.fillStyle = warn ? '#ff8a3a' : '#e8503a'; ctx.strokeStyle = '#3a0a10'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-6, -30, -34, -34, -30, -10); ctx.bezierCurveTo(-28, -2, -12, 2, 0, 0); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.arc(-18, -16, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a0a1a'; ctx.beginPath(); ctx.arc(-18, -16, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd36a'; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(-26, -6, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // 体
  ctx.fillStyle = '#2a1430'; ctx.beginPath(); ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4a2a50'; for (let i = 0; i < 3; i++) { ctx.fillRect(-10 + i * 5, -6, 2, 12); }
  ctx.fillStyle = '#2a1430'; ctx.beginPath(); ctx.arc(12, -2, 6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2a1430'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(14, -6); ctx.quadraticCurveTo(20, -18, 26, -16); ctx.moveTo(15, -5); ctx.quadraticCurveTo(24, -12, 28, -8); ctx.stroke();
  ctx.fillStyle = warn ? '#ff3a2a' : '#ffe680'; ctx.beginPath(); ctx.arc(14, -3, 2, 0, Math.PI * 2); ctx.fill();
}

function drawBee(ctx, e, t) {
  ctx.translate(e.x, e.y); ctx.scale(e.face, 1);
  const warn = e.state === 'warn';
  if (warn) ctx.translate(Math.sin(t * 60) * 1.5, 3);
  if (e.state === 'charge') {
    ctx.strokeStyle = 'rgba(255,230,160,.7)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-26 - i * 6, -8 + i * 8); ctx.lineTo(-50 - i * 10, -8 + i * 8); ctx.stroke(); }
  }
  // 翅
  ctx.fillStyle = 'rgba(220,240,255,.7)';
  const fl = Math.sin(t * 50) * 0.3;
  ctx.save(); ctx.rotate(-0.5 + fl); ctx.beginPath(); ctx.ellipse(-4, -20, 8, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  // 鎧の胴
  ctx.fillStyle = '#c9963a'; ctx.strokeStyle = '#3a2408'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(-6, 0, 17, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a2408'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-14 + i * 8, 0, 2.5, 11, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.ellipse(-8, -7, 8, 3, -0.2, 0, Math.PI * 2); ctx.fill();
  // 針
  ctx.fillStyle = '#6a4a20'; ctx.beginPath(); ctx.moveTo(-22, 2); ctx.lineTo(-32, 6); ctx.lineTo(-21, 7); ctx.fill();
  // 兜の頭
  ctx.fillStyle = '#8a6020'; ctx.beginPath(); ctx.arc(12, -3, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8c06a'; ctx.beginPath(); ctx.moveTo(10, -12); ctx.lineTo(24, -22); ctx.lineTo(16, -9); ctx.fill();
  ctx.fillStyle = warn || e.state === 'charge' ? '#ff3a2a' : '#1a0a00'; ctx.beginPath(); ctx.ellipse(16, -3, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
  // 脚
  ctx.strokeStyle = '#3a2408'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-8 + i * 7, 11); ctx.lineTo(-10 + i * 7 + Math.sin(t * 12 + i) * 2, 18); ctx.stroke(); }
}

function drawLamp(ctx, e, t, st) {
  // 予告の点線と光線
  if (e.beam && e.state === 'warn') {
    ctx.save(); ctx.strokeStyle = 'rgba(255,80,60,.8)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 60;
    ctx.beginPath(); ctx.moveTo(e.beam.x0, e.beam.y); ctx.lineTo(e.beam.x1, e.beam.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,80,60,.12)'; ctx.fillRect(e.beam.x0, e.beam.y - 10, e.beam.x1 - e.beam.x0, 20);
    ctx.restore();
  }
  if (e.beam && e.state === 'fire') {
    ctx.save();
    const g = ctx.createLinearGradient(0, e.beam.y - 12, 0, e.beam.y + 12);
    g.addColorStop(0, 'rgba(255,90,60,0)'); g.addColorStop(0.5, 'rgba(255,240,200,1)'); g.addColorStop(1, 'rgba(255,90,60,0)');
    ctx.fillStyle = g; ctx.fillRect(e.beam.x0, e.beam.y - 12, e.beam.x1 - e.beam.x0, 24);
    ctx.fillStyle = '#ff5a3a'; ctx.globalAlpha = 0.5; ctx.fillRect(e.beam.x0, e.beam.y - 3, e.beam.x1 - e.beam.x0, 6);
    ctx.restore();
  }
  ctx.translate(e.x, e.y); ctx.scale(e.face, 1);
  const hot = e.state === 'warn' || e.state === 'fire';
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 40);
  g.addColorStop(0, hot ? 'rgba(255,90,60,.7)' : 'rgba(120,200,255,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill();
  // 吊り
  ctx.strokeStyle = '#2a1a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, -40); ctx.stroke();
  // 提灯
  ctx.fillStyle = hot ? '#ffb08a' : '#bfe4ff'; ctx.strokeStyle = '#2a1a3a';
  ctx.beginPath(); ctx.ellipse(0, 0, 16, 19, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(42,26,58,.5)'; ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(i) * 10 + 4, 19, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke(); }
  ctx.fillStyle = '#2a1a3a'; ctx.fillRect(-10, -22, 20, 5); ctx.fillRect(-10, 17, 20, 4);
  // 牙
  ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-9 + i * 6, 21); ctx.lineTo(-6 + i * 6, 29); ctx.lineTo(-3 + i * 6, 21); ctx.fill(); }
  // 目
  ctx.fillStyle = hot ? '#ff2a1a' : '#2a6ab0'; ctx.beginPath(); ctx.ellipse(6, -2, 5, hot ? 6 : 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(8, -4, 1.5, 0, Math.PI * 2); ctx.fill();
  void st;
}

function drawSerpent(ctx, e, t) {
  if (e.state === 'warn' || e.state === 'wait') {
    // 波紋（予告）
    const cx = (e.x0 + e.x1) / 2; const k = e.state === 'warn' ? 1 : 0.25;
    ctx.strokeStyle = `rgba(200,240,255,${0.7 * k})`; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const r = Math.abs((t * 40 + i * 14) % 42); ctx.beginPath(); ctx.ellipse(e.x0 + 14, e.surf + 8, r, r * 0.25, 0, 0, Math.PI * 2); ctx.stroke(); }
    if (e.state === 'warn') warnMark(ctx, e.x0 + 14, e.surf - 26, t);
    void cx;
    return;
  }
  const [u0, u1] = serpentSpan(e);
  if (u1 <= u0) return;
  const pts = [];
  for (let u = u0; u <= u1 + 1e-6; u += 0.025) pts.push([e.x0 + u * (e.x1 - e.x0), serpentY(e, u)]);
  // 体
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1a3a5a'; ctx.lineWidth = 26; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  ctx.strokeStyle = e.bound > 0 ? '#bfe8ff' : '#7fc8e8'; ctx.lineWidth = 21; ctx.stroke();
  ctx.strokeStyle = '#e6f8ff'; ctx.lineWidth = 6; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y - 5) : ctx.moveTo(x, y - 5))); ctx.stroke();
  // 鱗と鰭
  ctx.fillStyle = '#3a7aa8';
  for (let i = 2; i < pts.length - 2; i += 3) { const [x, y] = pts[i]; ctx.beginPath(); ctx.arc(x, y + 3, 3, 0, Math.PI); ctx.fill(); }
  ctx.fillStyle = 'rgba(160,220,255,.8)';
  for (let i = 4; i < pts.length - 3; i += 7) { const [x, y] = pts[i]; ctx.beginPath(); ctx.moveTo(x - 6, y - 10); ctx.lineTo(x, y - 22); ctx.lineTo(x + 6, y - 10); ctx.fill(); }
  if (e.bound > 0) {
    ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 3;
    for (let i = 3; i < pts.length; i += 6) { const [x, y] = pts[i]; ctx.beginPath(); ctx.ellipse(x, y, 6, 14, 0.3, 0, Math.PI * 2); ctx.stroke(); }
  }
  // 頭
  if (e.s < 1) {
    const hd = serpentHead(e); const u = Math.min(1, e.s);
    const ang = Math.atan2(serpentY(e, u + 0.01) - serpentY(e, u), (e.x1 - e.x0) * 0.01);
    ctx.save(); ctx.translate(hd.x, hd.y); ctx.rotate(ang);
    ctx.fillStyle = '#7fc8e8'; ctx.strokeStyle = '#1a3a5a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(6, 0, 18, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(12, -5, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a2a4a'; ctx.beginPath(); ctx.arc(13, -5, 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e6f8ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(20, 4); ctx.quadraticCurveTo(32, 10, 36, 4 + Math.sin(t * 6) * 4); ctx.stroke();
    ctx.restore();
  }
  // 水しぶき
  ctx.fillStyle = 'rgba(230,248,255,.7)';
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(e.x0 + 10 + i * 6, e.surf - 4 - Math.abs(Math.sin(t * 8 + i)) * 8, 3, 0, Math.PI * 2); ctx.fill(); }
}

function drawEater(ctx, e, t) {
  ctx.translate(e.x, e.y);
  const open = e.alert ? 0.6 + Math.sin(t * 10) * 0.25 : e.state === 'chew' ? Math.abs(Math.sin(t * 20)) : 0.15;
  // 毛
  ctx.fillStyle = '#2a1440';
  ctx.beginPath();
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; const r = 20 + (i % 2 ? 4 : -1) + Math.sin(t * 5 + i) * 1.5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#a06ad6'; ctx.lineWidth = 1.5; ctx.stroke();
  // 口
  ctx.fillStyle = '#ff5a8a';
  ctx.beginPath(); ctx.ellipse(e.face * 4, 5, 12, 2 + open * 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 4; i++) { const x = e.face * 4 - 9 + i * 6; ctx.beginPath(); ctx.moveTo(x, 5 - open * 8); ctx.lineTo(x + 3, 5 - open * 8 + 5); ctx.lineTo(x + 6, 5 - open * 8); ctx.fill(); ctx.beginPath(); ctx.moveTo(x, 5 + open * 8); ctx.lineTo(x + 3, 5 + open * 8 - 5); ctx.lineTo(x + 6, 5 + open * 8); ctx.fill(); }
  // 目
  ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(-6 + e.face * 4, -9, 4, 0, Math.PI * 2); ctx.arc(6 + e.face * 4, -9, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a0a20'; ctx.beginPath(); ctx.arc(-6 + e.face * 5, -9, 2, 0, Math.PI * 2); ctx.arc(6 + e.face * 5, -9, 2, 0, Math.PI * 2); ctx.fill();
  // ちぎった糸くず
  ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 1; ctx.globalAlpha = 0.7;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-14 + i * 10, 18); ctx.quadraticCurveTo(-12 + i * 10, 26, -16 + i * 10 + Math.sin(t * 3 + i) * 3, 30); ctx.stroke(); }
}

export function drawFray(ctx, f, top, bottom, t) {
  const x = f.x;
  ctx.save();
  if (f.dying > 0) ctx.globalAlpha = Math.max(0, f.dying / 2.5);
  const g = ctx.createLinearGradient(x - 260, 0, x, 0);
  g.addColorStop(0, 'rgba(60,0,20,.95)'); g.addColorStop(0.7, 'rgba(150,10,40,.9)'); g.addColorStop(1, 'rgba(255,60,70,.95)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x - 2000, top);
  for (let y = top; y <= bottom; y += 18) ctx.lineTo(x + Math.sin(y * 0.09 + t * 7) * 10 + (hash(Math.floor(y / 18)) - 0.5) * 16, y);
  ctx.lineTo(x - 2000, bottom); ctx.closePath(); ctx.fill();
  // ほつれた赤い糸
  ctx.strokeStyle = '#ff5a6a'; ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const y = top + ((i * 97 + t * 30) % (bottom - top));
    ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 20, y - 10, x + 30 + Math.sin(t * 4 + i) * 10, y + 14, x + 46 + Math.sin(t * 3 + i) * 12, y + 4); ctx.stroke();
  }
  // 目
  for (let i = 0; i < 3; i++) {
    const y = top + (bottom - top) * (0.25 + i * 0.25) + Math.sin(t * 2 + i) * 10;
    ctx.fillStyle = '#ffe0a0'; ctx.beginPath(); ctx.ellipse(x - 40, y, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a0008'; ctx.beginPath(); ctx.arc(x - 36, y, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// 糸
export function drawThread(ctx, from, to, color, phase, prog, t) {
  ctx.save();
  const x1 = from.x + (to.x - from.x) * prog; const y1 = from.y + (to.y - from.y) * prog;
  ctx.strokeStyle = color; ctx.lineWidth = phase === 'hold' ? 3.5 : 2.5; ctx.lineCap = 'round';
  ctx.shadowColor = color; ctx.shadowBlur = 10;
  const sag = phase === 'hold' ? 0 : Math.sin(t * 40) * 3;
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.quadraticCurveTo((from.x + x1) / 2, (from.y + y1) / 2 + sag, x1, y1); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x1, y1, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
