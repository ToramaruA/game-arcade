// 絵本風の疑似3D（Canvas 2D・等角投影）。外部素材なし。ルールは logic.js。
import { GARDENS, SIZE, DIRS, cellAt, isGround, bridgeActive, gardenInfo } from './logic.js';

export const TW = 64; export const TH = 32; export const DEP = 16;
export const THEMES = {
  dawn: { skyT: '#a9dcff', skyB: '#fff1e2', top1: '#b4e07c', top2: '#a6d96c', side: '#c49563', side2: '#a47a4d', leaf: '#ffd3e3', sea: '#ffffff', flower: ['#ff8fb0', '#ffd24a', '#ffffff'] },
  cream: { skyT: '#c4e0f6', skyB: '#fff0d2', top1: '#f6e9cc', top2: '#eedfba', side: '#d3bd92', side2: '#b7a07a', leaf: '#ffffff', sea: '#ffffff', flower: ['#e8b24a', '#ffffff', '#f4a6a0'] },
  aqua: { skyT: '#8fdde8', skyB: '#e4fbff', top1: '#dcf1e8', top2: '#cbe7dc', side: '#86b9b4', side2: '#6ba19d', leaf: '#ffffff', sea: '#f4ffff', flower: ['#ffffff', '#ffb6d6', '#bdf2ff'] },
  sunset: { skyT: '#ff9a78', skyB: '#ffe0a6', top1: '#f3c960', top2: '#e8b84c', side: '#bf7a44', side2: '#9e6034', leaf: '#ffe6a8', sea: '#fff3e0', flower: ['#ff7a45', '#ffe27a', '#ffffff'] },
  forest: { skyT: '#9fd8c0', skyB: '#f4f8d8', top1: '#7fc56a', top2: '#72b95e', side: '#8a6a44', side2: '#6e5232', leaf: '#ffe9a0', sea: '#f6fff0', flower: ['#ffe27a', '#ffffff', '#ff9a7a'] },
  snow: { skyT: '#a8c8f0', skyB: '#f4f8ff', top1: '#f6faff', top2: '#e8f0fa', side: '#9fb4cc', side2: '#8299b4', leaf: '#ffffff', sea: '#ffffff', flower: ['#ffffff', '#cfe6ff', '#ffd6e6'] },
  sakura: { skyT: '#ffc6dc', skyB: '#fff3e8', top1: '#c8e89a', top2: '#bce08a', side: '#c49563', side2: '#a47a4d', leaf: '#ffc0d8', sea: '#fff6fa', flower: ['#ffb0cc', '#ffffff', '#ffd0e0'] },
  falls: { skyT: '#7ad0f0', skyB: '#e8fbff', top1: '#a8e0b4', top2: '#98d6a6', side: '#7aa8a0', side2: '#5f8f88', leaf: '#ffffff', sea: '#f0ffff', flower: ['#ffffff', '#ffe27a', '#b0e0ff'] },
  candy: { skyT: '#ffb8e8', skyB: '#fff0f8', top1: '#fde0ef', top2: '#f8d2e6', side: '#e7a6c8', side2: '#d68cb4', leaf: '#ffffff', sea: '#ffffff', flower: ['#ff8fc8', '#a0e8ff', '#fff07a'] },
  night: { skyT: '#0a0f3d', skyB: '#4a3a8c', top1: '#5361c0', top2: '#4857b4', side: '#2d3478', side2: '#222862', leaf: '#fff3a8', sea: '#7f78c8', flower: ['#fff3a0', '#9ff0ff', '#ffb0f0'] },
};
export const pondOf = (gi) => GARDENS[gi].pond || null;

export const proj = (x, y, z = 0) => [(x - y) * TW / 2, (x + y) * TH / 2 - z];
const hash = (a, b, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; };

export function viewBox(gi) {
  let x0 = 99; let y0 = 99; let x1 = -1; let y1 = -1;
  const g = GARDENS[gi];
  const mark = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (isGround(gi, x, y)) mark(x, y);
  g.bridges.forEach((b) => mark(b.x, b.y));
  let minX = 1e9; let maxX = -1e9; let minY = 1e9; let maxY = -1e9;
  [[x0, y0], [x1 + 1, y0], [x0, y1 + 1], [x1 + 1, y1 + 1]].forEach(([x, y]) => {
    const [sx, sy] = proj(x, y); minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
  });
  return { minX: minX - 14, maxX: maxX + 14, minY: minY - 78, maxY: maxY + DEP + 56 };
}

const path = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
const diamond = (x, y, z = 0, s = 1, ox = 0, oy = 0) => {
  const c = proj(x + 0.5, y + 0.5, z); const hw = TW / 2 * s; const hh = TH / 2 * s;
  return [[c[0] + ox, c[1] - hh + oy], [c[0] + hw + ox, c[1] + oy], [c[0] + ox, c[1] + hh + oy], [c[0] - hw + ox, c[1] + oy]];
};
const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16); const r = Math.min(255, Math.max(0, ((n >> 16) & 255) * f)); const g = Math.min(255, Math.max(0, ((n >> 8) & 255) * f)); const b = Math.min(255, Math.max(0, (n & 255) * f));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
};

export function drawBackground(ctx, w, h, theme, t, reduce) {
  const T = THEMES[theme];
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, T.skyT); g.addColorStop(1, T.skyB);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  if (theme === 'night') {
    for (let i = 0; i < 70; i++) {
      const x = hash(i, 1) * w; const y = hash(i, 2) * h * 0.8; const tw = reduce ? 1 : 0.6 + 0.4 * Math.sin(t * 1.2 + i);
      ctx.fillStyle = `rgba(255,255,230,${0.35 + 0.5 * hash(i, 3) * tw})`; ctx.beginPath(); ctx.arc(x, y, 0.8 + hash(i, 4) * 1.4, 0, 7); ctx.fill();
    }
    // 天の川
    ctx.save(); ctx.translate(w * 0.5, h * 0.35); ctx.rotate(-0.5);
    const mg = ctx.createLinearGradient(0, -h * 0.12, 0, h * 0.12); mg.addColorStop(0, 'rgba(255,255,255,0)'); mg.addColorStop(0.5, 'rgba(190,200,255,.22)'); mg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = mg; ctx.fillRect(-w, -h * 0.12, w * 2, h * 0.24); ctx.restore();
    ctx.fillStyle = '#fff8d6'; ctx.beginPath(); ctx.arc(w * 0.16, h * 0.14, 20, 0, 7); ctx.fill();
    ctx.fillStyle = T.skyT; ctx.beginPath(); ctx.arc(w * 0.16 + 9, h * 0.14 - 5, 18, 0, 7); ctx.fill();
  } else {
    // 太陽（夕方は低く大きく）・虹
    const sx = theme === 'sunset' ? w * 0.78 : w * 0.82; const sy = theme === 'sunset' ? h * 0.42 : h * 0.16;
    const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, theme === 'sunset' ? 90 : 60);
    sg.addColorStop(0, theme === 'sunset' ? 'rgba(255,240,170,1)' : 'rgba(255,250,220,1)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, theme === 'sunset' ? 90 : 60, 0, 7); ctx.fill();
    if (theme === 'dawn') {
      ['#ff9aa8', '#ffd08a', '#fff2a0', '#a8e6a0', '#9ad4ff'].forEach((c, i) => {
        ctx.strokeStyle = c; ctx.globalAlpha = 0.45; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(w * 0.22, h * 0.62, h * 0.34 - i * 7, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      }); ctx.globalAlpha = 1;
    }
  }
  if (theme === 'falls') { // 遠くの滝
    for (let k = 0; k < 3; k++) {
      const x = w * (0.12 + k * 0.36); const fw = 18 + k * 6; const g2 = ctx.createLinearGradient(0, h * 0.1, 0, h * 0.9);
      g2.addColorStop(0, 'rgba(255,255,255,.0)'); g2.addColorStop(0.2, 'rgba(255,255,255,.55)'); g2.addColorStop(1, 'rgba(255,255,255,.15)');
      ctx.fillStyle = g2; ctx.fillRect(x, h * 0.1, fw, h * 0.8);
      ctx.strokeStyle = 'rgba(200,240,255,.6)'; ctx.lineWidth = 1; for (let j = 0; j < 4; j++) { const yy = ((t * 60 + j * 40 + k * 17) % (h * 0.8)) + h * 0.1; ctx.beginPath(); ctx.moveTo(x + 3, yy); ctx.lineTo(x + 3, yy + 12); ctx.stroke(); }
    }
    ['#ff9aa8', '#ffd08a', '#fff2a0', '#a8e6a0', '#9ad4ff', '#c8a8ff'].forEach((c, i) => { ctx.strokeStyle = c; ctx.globalAlpha = 0.4; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.75, h * 0.45 - i * 6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); });
    ctx.globalAlpha = 1;
  }
  if (theme === 'forest' || theme === 'snow' || theme === 'sakura') { // 下の方の木立
    const col = { forest: ['rgba(70,140,90,.55)', 'rgba(50,110,70,.7)'], snow: ['rgba(150,175,210,.55)', 'rgba(120,150,190,.7)'], sakura: ['rgba(255,170,200,.45)', 'rgba(230,140,175,.55)'] }[theme];
    [0.72, 0.8].forEach((yy, row) => { ctx.fillStyle = col[row]; for (let i = -1; i < w / 26 + 1; i++) { const x = i * 26 + row * 13; const hh = 26 + hash(i, row, 7) * 22; ctx.beginPath(); if (theme === 'sakura') ctx.arc(x, h * yy, hh * 0.55, 0, 7); else { ctx.moveTo(x - 13, h * yy + 10); ctx.lineTo(x, h * yy - hh); ctx.lineTo(x + 13, h * yy + 10); } ctx.fill(); } ctx.fillRect(0, h * yy + 8, w, h * 0.3); });
  }
  if (theme === 'snow') { // 遠くの雪山
    ctx.fillStyle = 'rgba(200,215,240,.8)'; ctx.beginPath(); ctx.moveTo(0, h * 0.62); ctx.lineTo(w * 0.22, h * 0.3); ctx.lineTo(w * 0.42, h * 0.58); ctx.lineTo(w * 0.62, h * 0.24); ctx.lineTo(w * 0.86, h * 0.56); ctx.lineTo(w, h * 0.4); ctx.lineTo(w, h * 0.7); ctx.lineTo(0, h * 0.7); ctx.fill();
    ctx.fillStyle = '#ffffff'; [[0.22, 0.3], [0.62, 0.24]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(w * a, h * b); ctx.lineTo(w * a - 22, h * b + 22); ctx.lineTo(w * a + 22, h * b + 22); ctx.fill(); });
  }
  // 遠くの浮島と大きな雲（ゆっくり流れる）
  const drift = reduce ? 0 : t;
  for (let i = 0; i < 4; i++) {
    const x = ((hash(i, 9) * w * 1.4 + drift * (4 + i * 2)) % (w * 1.4)) - w * 0.2; const y = h * (0.18 + hash(i, 10) * 0.35);
    ctx.fillStyle = theme === 'night' ? 'rgba(80,90,180,.55)' : 'rgba(160,200,170,.55)';
    ctx.beginPath(); ctx.ellipse(x, y, 34 + i * 6, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = theme === 'night' ? 'rgba(50,60,130,.6)' : 'rgba(190,160,130,.5)';
    ctx.beginPath(); ctx.moveTo(x - 30, y + 2); ctx.lineTo(x + 30, y + 2); ctx.lineTo(x, y + 22 + i * 3); ctx.closePath(); ctx.fill();
  }
  for (let i = 0; i < 6; i++) {
    const cx = ((hash(i, 20) * w * 1.5 + drift * (6 + i * 3)) % (w * 1.5)) - w * 0.25; const cy = h * (0.08 + hash(i, 21) * 0.5);
    puff(ctx, cx, cy, 26 + hash(i, 22) * 26, theme === 'night' ? 'rgba(150,150,230,.35)' : 'rgba(255,255,255,.75)');
  }
}
function puff(ctx, x, y, r, fill) {
  ctx.fillStyle = fill; ctx.beginPath();
  [[-0.9, 0.15, 0.6], [-0.35, -0.2, 0.75], [0.3, -0.1, 0.7], [0.9, 0.15, 0.55], [0, 0.25, 0.8]].forEach(([dx, dy, k]) => { ctx.moveTo(x + dx * r + r * k, y + dy * r); ctx.arc(x + dx * r, y + dy * r, r * k, 0, 7); });
  ctx.fill();
}
export function drawSea(ctx, w, h, theme, t, reduce) {
  const T = THEMES[theme];
  for (let row = 0; row < 3; row++) {
    const y = h - 10 - row * 20; const sh = reduce ? 0 : Math.sin(t * 0.3 + row) * 8;
    for (let i = -1; i < w / 46 + 2; i++) puff(ctx, i * 46 + sh + row * 17, y + hash(i, row) * 6, 24 + hash(i, row + 5) * 10, row === 0 ? T.sea : `${T.sea}cc`);
  }
}

function leafAt(ctx, T, gi, x, y, sway) {
  // 草の房と小さな花
  const n = 2 + ((hash(x, y, gi) * 3) | 0);
  for (let k = 0; k < n; k++) {
    const r1 = hash(x, y, gi * 7 + k); const r2 = hash(y, x, gi * 11 + k);
    const [cx, cy] = proj(x + 0.2 + r1 * 0.6, y + 0.2 + r2 * 0.6);
    const th = GARDENS[gi].theme;
    if (th === 'aqua' || th === 'cream' || th === 'snow' || th === 'candy') { ctx.fillStyle = th === 'candy' ? 'rgba(255,255,255,.45)' : th === 'snow' ? 'rgba(150,180,220,.25)' : 'rgba(120,140,140,.18)'; ctx.fillRect(cx - 4, cy, 8, 1.2); if (th === 'candy' && r1 > 0.6) { ctx.fillStyle = T.flower[(r2 * 3) | 0]; ctx.fillRect(cx - 1, cy - 2, 3, 1.5); } continue; }
    ctx.strokeStyle = th === 'night' ? '#7fe0c8' : th === 'sakura' ? '#7fb85a' : '#6fb04a'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + sway * 2 - 1, cy - 5); ctx.moveTo(cx + 2, cy); ctx.lineTo(cx + 3 + sway * 2, cy - 4); ctx.stroke();
    if (r1 > 0.55) { ctx.fillStyle = T.flower[(r2 * 3) | 0]; ctx.beginPath(); ctx.arc(cx + sway * 2 - 1, cy - 6, 2.4, 0, 7); ctx.fill(); }
  }
}

export function drawTile(ctx, gi, x, y, T, t, reduce) {
  const top = (x + y) % 2 ? T.top2 : T.top1;
  const below = isGround(gi, x, y + 1); const right = isGround(gi, x + 1, y);
  const [pt, pr, pb, pl] = diamond(x, y);
  const cliffL = below ? 0 : 26 + hash(x, y, 3) * 18; const cliffR = right ? 0 : 26 + hash(y, x, 4) * 18;
  // 左の側面
  ctx.fillStyle = T.side; path(ctx, [pl, pb, [pb[0], pb[1] + DEP + cliffL], [pl[0], pl[1] + DEP + (below ? 0 : cliffL * 0.6)]]); ctx.fill();
  ctx.fillStyle = T.side2; path(ctx, [pb, pr, [pr[0], pr[1] + DEP + (right ? 0 : cliffR * 0.6)], [pb[0], pb[1] + DEP + cliffR]]); ctx.fill();
  if (!below) { ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl[0] + 10, pl[1] + DEP + 3); ctx.lineTo(pl[0] + 14, pl[1] + DEP + cliffL * 0.5); ctx.stroke(); }
  // 天面（草・石畳）
  ctx.fillStyle = top; path(ctx, [pt, pr, pb, pl]); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1; path(ctx, [pt, pr, pb, pl]); ctx.stroke();
  // 縁の草（草の庭）／根のたれ
  const edge = { dawn: '#8fcf5a', sunset: '#e0a838', forest: '#5fae4a', snow: '#ffffff', sakura: '#a8d878', candy: '#ffffff' }[GARDENS[gi].theme];
  if (!below && edge) { ctx.fillStyle = edge; path(ctx, [pl, pb, [pb[0], pb[1] + 6], [pl[0], pl[1] + 6]]); ctx.fill(); }
  if (!below && hash(x, y, 8) > 0.45) { ctx.strokeStyle = 'rgba(90,60,30,.5)'; ctx.lineWidth = 1.5; const rx = pl[0] + 8 + hash(x, y, 9) * 20; const ry = pl[1] + DEP + 4; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.quadraticCurveTo(rx - 3, ry + 14, rx + 2, ry + 22 + cliffL * 0.4); ctx.stroke(); }
  leafAt(ctx, T, gi, x, y, reduce ? 0 : Math.sin(t * 2 + x + y) * 0.6);
  // 庭ごとの足元
  if (GARDENS[gi].theme === 'night' && hash(x, y, 5) > 0.55) { ctx.fillStyle = 'rgba(255,255,200,.7)'; const [cx, cy] = proj(x + 0.5, y + 0.5); ctx.beginPath(); ctx.arc(cx + 6, cy - 2, 1.6, 0, 7); ctx.fill(); }
}

export function drawWaterCell(ctx, x, y, t, reduce) {
  const [pt, pr, pb, pl] = diamond(x, y, -DEP + 2);
  ctx.fillStyle = 'rgba(120,205,225,.85)'; path(ctx, [pt, pr, pb, pl]); ctx.fill();
  const c = proj(x + 0.5, y + 0.5, -DEP + 2); const k = reduce ? 0 : (t * 0.6 + hash(x, y)) % 1;
  ctx.strokeStyle = `rgba(255,255,255,${0.5 - k * 0.45})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(c[0], c[1], 6 + k * 14, 3 + k * 7, 0, 0, 7); ctx.stroke();
}

export function drawCloudTile(ctx, x, y, v, T, t, reduce) {
  if (v < 0.02) return;
  const lift = (1 - v) * 14; const s = 0.55 + 0.45 * v; const bob = reduce ? 0 : Math.sin(t * 2 + x * 2) * 1.2;
  const c = proj(x + 0.5, y + 0.5, 2 + bob - lift);
  ctx.globalAlpha = Math.min(1, v * 1.2);
  ctx.fillStyle = 'rgba(120,150,190,.28)'; path(ctx, diamond(x, y, -lift * 0.4, 0.8 * s, 0, 8)); ctx.fill();
  puff(ctx, c[0], c[1] + 2, 15 * s + 10 * v, '#ffffff');
  puff(ctx, c[0] - 9 * s, c[1] - 3, 9 * s, '#f4faff'); puff(ctx, c[0] + 10 * s, c[1] - 1, 8 * s, '#f4faff');
  ctx.globalAlpha = 1;
}

export function drawDashed(ctx, x, y, color, t) {
  const pts = diamond(x, y, 3, 0.95); ctx.save(); ctx.setLineDash([5, 4]); ctx.lineDashOffset = -t * 12; ctx.lineWidth = 2.5; ctx.strokeStyle = color; path(ctx, pts); ctx.stroke();
  ctx.fillStyle = color.replace('1)', '.18)'); ctx.fill(); ctx.restore();
}
export function drawRing(ctx, x, y, t, color = 'rgba(255,210,74,1)') {
  const pts = diamond(x, y, 1, 1 + Math.sin(t * 4) * 0.04); ctx.strokeStyle = color; ctx.lineWidth = 3; path(ctx, pts); ctx.stroke();
}

const shadow = (ctx, cx, cy, r) => { ctx.fillStyle = 'rgba(40,50,80,.22)'; ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.45, 0, 0, 7); ctx.fill(); };

export function drawObstacle(ctx, gi, x, y, t, reduce) {
  const g = GARDENS[gi]; const [cx, cy] = proj(x + 0.5, y + 0.5);
  const sw = reduce ? 0 : Math.sin(t * 1.6 + x) * 1.4;
  if (g.theme === 'sunset') { // 風車
    shadow(ctx, cx, cy + 2, 26);
    ctx.fillStyle = '#f4e7d0'; path(ctx, [[cx - 14, cy + 4], [cx + 14, cy + 4], [cx + 8, cy - 46], [cx - 8, cy - 46]]); ctx.fill();
    ctx.fillStyle = '#e2d0b0'; path(ctx, [[cx + 4, cy + 4], [cx + 14, cy + 4], [cx + 8, cy - 46], [cx + 4, cy - 46]]); ctx.fill();
    ctx.fillStyle = '#e0584a'; path(ctx, [[cx - 12, cy - 44], [cx + 12, cy - 44], [cx, cy - 62]]); ctx.fill();
    ctx.fillStyle = '#7a4a2a'; ctx.fillRect(cx - 4, cy - 12, 8, 16);
    const a = reduce ? 0.4 : t * 1.1;
    ctx.save(); ctx.translate(cx, cy - 40); ctx.rotate(a);
    for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.fillStyle = '#fff6e6'; ctx.fillRect(3, -3, 40, 6); ctx.fillStyle = '#e0584a'; ctx.fillRect(10, -9, 26, 7); }
    ctx.fillStyle = '#7a4a2a'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill(); ctx.restore();
    return;
  }
  if (g.theme === 'sakura') { // 桜の木
    shadow(ctx, cx, cy + 4, 24);
    ctx.fillStyle = '#7a4a34'; ctx.fillRect(cx - 3, cy - 22, 6, 24);
    [['#ffb6cf', -10, -26, 14], ['#ffc8da', 9, -28, 14], ['#ffd6e4', 0, -38, 15], ['#ffb0c8', 0, -22, 13]].forEach(([c, dx, dy, r]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx + dx + sw * 0.5, cy + dy, r, 0, 7); ctx.fill(); });
    return;
  }
  if (g.theme === 'forest') { // もみの木
    shadow(ctx, cx, cy + 4, 20);
    ctx.fillStyle = '#7a4a34'; ctx.fillRect(cx - 3, cy - 10, 6, 12);
    [[0, '#3f8f4a'], [10, '#4fa058'], [20, '#5fb066']].forEach(([o, c]) => { ctx.fillStyle = c; path(ctx, [[cx - 18 + o * 0.4 + sw * 0.3, cy - 8 - o], [cx + 18 - o * 0.4 + sw * 0.3, cy - 8 - o], [cx + sw * 0.5, cy - 30 - o]]); ctx.fill(); });
    return;
  }
  if (g.obstacle === 'bush') {
    shadow(ctx, cx, cy + 4, 24);
    [['#6bbf4a', -9, -8, 14], ['#7ccf55', 8, -10, 14], ['#8bd962', 0, -18, 15], ['#6bbf4a', 0, -4, 16]].forEach(([c, dx, dy, r]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx + dx + sw * 0.5, cy + dy, r, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#ffb5cf'; [[-6, -20], [7, -14], [-12, -6]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 2.6, 0, 7); ctx.fill(); });
    return;
  }
  // 岩・石柱
  shadow(ctx, cx, cy + 4, 22);
  const th = g.theme;
  const col = { night: ['#6f78d0', '#8a93e8'], aqua: ['#9ab8bc', '#bfdadc'], falls: ['#8ab0a8', '#b0d4cc'], snow: ['#b8c8dc', '#ffffff'], candy: ['#f2a0c8', '#ffd0e8'] }[th] || ['#b8aa92', '#d8ccb4'];
  ctx.fillStyle = col[0]; path(ctx, [[cx - 16, cy + 4], [cx - 12, cy - 22], [cx + 2, cy - 30], [cx + 15, cy - 18], [cx + 17, cy + 4]]); ctx.fill();
  ctx.fillStyle = col[1]; path(ctx, [[cx - 12, cy - 22], [cx + 2, cy - 30], [cx + 15, cy - 18], [cx + 2, cy - 14]]); ctx.fill();
  if (th === 'night') { ctx.fillStyle = 'rgba(255,250,170,.9)'; ctx.beginPath(); ctx.arc(cx + 2, cy - 16, 3, 0, 7); ctx.fill(); }
  if (th === 'candy') { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(cx - 12 + k * 8, cy); ctx.lineTo(cx - 6 + k * 8, cy - 24); ctx.stroke(); } }
}

export function drawVane(ctx, x, y, windVec, t, active, reduce) {
  const [cx, cy] = proj(x + 0.5, y + 0.5);
  shadow(ctx, cx, cy + 2, 14);
  ctx.fillStyle = '#7a5a3a'; ctx.fillRect(cx - 2.5, cy - 44, 5, 46);
  ctx.fillStyle = '#e8c15a'; ctx.beginPath(); ctx.ellipse(cx, cy + 1, 11, 5, 0, 0, 7); ctx.fill();
  // N E S W の小さな札
  ctx.fillStyle = '#fff'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
  ['N', 'E', 'S', 'W'].forEach((l, i) => { const [vx, vy] = [(DIRS[i][0] - DIRS[i][1]) * 10, (DIRS[i][0] + DIRS[i][1]) * 5]; ctx.fillStyle = 'rgba(90,60,30,.7)'; ctx.fillText(l, cx + vx, cy + vy + 3); });
  const wob = reduce ? 0 : Math.sin(t * 3) * 0.12;
  const len = 17; const vx = windVec[0] + wob; const vy = windVec[1];
  const m = Math.hypot(vx, vy) || 1; const ux = vx / m; const uy = vy / m; const ay = cy - 48;
  ctx.strokeStyle = '#d99a1c'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - ux * len, ay - uy * len * 0.5); ctx.lineTo(cx + ux * len, ay + uy * len * 0.5); ctx.stroke();
  ctx.fillStyle = '#ffcf40'; path(ctx, [[cx + ux * (len + 8), ay + uy * (len + 8) * 0.5], [cx + ux * (len - 3) - uy * 6, ay + (uy * (len - 3)) * 0.5 + ux * 3], [cx + ux * (len - 3) + uy * 6, ay + (uy * (len - 3)) * 0.5 - ux * 3]]); ctx.fill();
  // 風見鶏のとさか
  ctx.fillStyle = '#ff6a50'; ctx.beginPath(); ctx.arc(cx - ux * len, ay - uy * len * 0.5 - 4, 4, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffcf40'; ctx.beginPath(); ctx.arc(cx, cy - 46, 3.5, 0, 7); ctx.fill();
  if (active) { ctx.strokeStyle = 'rgba(255,230,120,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy - 22, 20 + Math.sin(t * 5) * 2, 30, 0, 0, 7); ctx.stroke(); }
}

export function drawBed(ctx, gi, x, y, bloomed, t, reduce) {
  const [cx, cy] = proj(x + 0.5, y + 0.5);
  const k = reduce ? 0 : Math.sin(t * 2.2 + x) * 0.8;
  const bedKind = GARDENS[gi].bed;
  if (bedKind === 'bell') { // 鈴の台座
    shadow(ctx, cx, cy + 2, 16); ctx.fillStyle = '#d9cdb4'; path(ctx, [[cx - 13, cy + 2], [cx + 13, cy + 2], [cx + 9, cy - 10], [cx - 9, cy - 10]]); ctx.fill();
    ctx.fillStyle = '#efe6d2'; ctx.beginPath(); ctx.ellipse(cx, cy - 10, 9, 4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = bloomed ? '#ffd24a' : '#cfc3a6'; ctx.beginPath(); ctx.moveTo(cx - 8, cy - 11); ctx.quadraticCurveTo(cx - 8, cy - 26, cx, cy - 26); ctx.quadraticCurveTo(cx + 8, cy - 26, cx + 8, cy - 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7a5a3a'; ctx.beginPath(); ctx.arc(cx, cy - 10, 2, 0, 7); ctx.fill();
    return;
  }
  if (bedKind === 'lotus') { // 蓮
    ctx.fillStyle = '#6cc7a0'; ctx.beginPath(); ctx.ellipse(cx, cy, 20, 9, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#58b58e'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 18, cy - 4); ctx.lineTo(cx + 18, cy + 4); ctx.fill();
    drawFlower(ctx, cx, cy - 2, bloomed ? 1 : 0.35, '#ffb6d6', '#fff6c0', k);
    return;
  }
  ctx.fillStyle = '#8a5a34'; path(ctx, diamond(x, y, 1, 0.78)); ctx.fill();
  ctx.fillStyle = '#6e4626'; path(ctx, diamond(x, y, 1, 0.55)); ctx.fill();
  drawFlower(ctx, cx, cy - 4, bloomed ? 1 : 0.35, '#ff8fb0', '#ffe27a', k);
}
export function drawFlower(ctx, cx, cy, s, petal, core, sway = 0) {
  ctx.strokeStyle = '#4f9a3c'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, cy + 4); ctx.lineTo(cx + sway, cy - 14 * s); ctx.stroke();
  const fx = cx + sway; const fy = cy - 14 * s;
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.fillStyle = petal; ctx.beginPath(); ctx.ellipse(fx + Math.cos(a) * 7 * s, fy + Math.sin(a) * 5 * s, 6 * s, 4 * s, a, 0, 7); ctx.fill(); }
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(fx, fy, 4 * s, 0, 7); ctx.fill();
}

export function drawBell(ctx, x, y, t, ring, reduce) {
  const [cx, cy] = proj(x + 0.5, y + 0.5);
  ctx.fillStyle = '#c9b48a'; ctx.fillRect(cx - 14, cy - 46, 3, 48); ctx.fillRect(cx + 11, cy - 46, 3, 48); ctx.fillRect(cx - 14, cy - 48, 28, 4);
  const sw = reduce ? 0 : Math.sin(t * (ring ? 9 : 1.6)) * (ring ? 0.35 : 0.1);
  ctx.save(); ctx.translate(cx, cy - 44); ctx.rotate(sw);
  ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(-8, 16); ctx.quadraticCurveTo(-9, 0, 0, 0); ctx.quadraticCurveTo(9, 0, 8, 16); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b8801a'; ctx.beginPath(); ctx.arc(0, 17, 2.4, 0, 7); ctx.fill(); ctx.restore();
  if (ring) { ctx.strokeStyle = 'rgba(255,220,100,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy - 28, 14 + (t * 20 % 10), -0.6, 0.6); ctx.stroke(); }
}

export function drawPedestal(ctx, x, y, hist, t, want = [0, 1, 2]) {
  const [cx, cy] = proj(x + 0.5, y + 0.5);
  shadow(ctx, cx, cy + 2, 18);
  ctx.fillStyle = '#d9c9a4'; path(ctx, [[cx - 16, cy + 2], [cx + 16, cy + 2], [cx + 12, cy - 14], [cx - 12, cy - 14]]); ctx.fill();
  ctx.fillStyle = '#efe2c0'; ctx.beginPath(); ctx.ellipse(cx, cy - 14, 12, 5, 0, 0, 7); ctx.fill();
  const cols = ['#4aa3ff', '#ff9a3c', '#ff5a7a'];
  const ok = want.map((w, i) => hist.length >= 3 - i && hist[hist.length - (3 - i)] === w);
  const prefix = [ok[0], ok[0] && ok[1], ok[0] && ok[1] && ok[2]];
  want.forEach((w, i) => {
    const px = cx + (i - 1) * 9; const py = cy - 13 + (i === 1 ? 1 : 0);
    ctx.fillStyle = prefix[i] ? '#fff' : cols[i]; ctx.globalAlpha = prefix[i] ? 1 : 0.95;
    const [vx, vy] = [(DIRS[w][0] - DIRS[w][1]), (DIRS[w][0] + DIRS[w][1]) * 0.5]; const m = Math.hypot(vx, vy);
    const ux = vx / m * 4; const uy = vy / m * 4;
    ctx.beginPath(); ctx.moveTo(px + ux * 1.2, py + uy * 1.2); ctx.lineTo(px - uy - ux * 0.6, py + ux - uy * 0.6); ctx.lineTo(px + uy - ux * 0.6, py - ux - uy * 0.6); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  });
  if (prefix[2]) { ctx.strokeStyle = `rgba(255,255,255,${0.5 + Math.sin(t * 6) * 0.3})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy - 16, 17, 0, 7); ctx.stroke(); }
}

export function drawGate(ctx, x, y, open, t) {
  const [cx, cy] = proj(x + 0.5, y + 0.5);
  shadow(ctx, cx, cy + 2, 20);
  ctx.strokeStyle = open ? '#ffd24a' : '#a9b3c4'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 14, cy + 2); ctx.lineTo(cx - 14, cy - 26); ctx.arc(cx, cy - 26, 14, Math.PI, 0); ctx.lineTo(cx + 14, cy + 2); ctx.stroke();
  const g = ctx.createRadialGradient(cx, cy - 18, 2, cx, cy - 18, 20);
  g.addColorStop(0, open ? 'rgba(255,250,200,.95)' : 'rgba(210,220,235,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.globalAlpha = open ? 0.75 + Math.sin(t * 3) * 0.2 : 0.7; ctx.beginPath(); ctx.ellipse(cx, cy - 16, 13, 22, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = open ? '#fff' : '#8a96ab'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(open ? '⛵' : '🔒', cx, cy - 14);
}

export function drawFluff(ctx, cx, cy, t, reduce) {
  const bob = reduce ? 0 : Math.sin(t * 3 + cx) * 2.5;
  shadow(ctx, cx, cy + 4, 7);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(cx, cy - 12 + bob); ctx.lineTo(cx + Math.cos(a) * 9, cy - 12 + bob + Math.sin(a) * 9); ctx.stroke(); }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy - 12 + bob, 5, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(190,210,240,.9)'; ctx.beginPath(); ctx.arc(cx, cy - 12 + bob, 2, 0, 7); ctx.fill();
}

export function cloudColor(hue) { return { fill: `hsl(${hue},85%,94%)`, line: `hsl(${hue},65%,70%)`, cheek: `hsl(${(hue + 340) % 360},85%,80%)` }; }
export function drawCloudBody(ctx, cx, cy, r, hue, face = true, blink = 0) {
  const C = cloudColor(hue);
  ctx.fillStyle = C.fill; ctx.strokeStyle = C.line; ctx.lineWidth = Math.max(1.5, r * 0.1);
  const circles = [[-0.65, 0.15, 0.5], [-0.25, -0.3, 0.6], [0.25, -0.25, 0.58], [0.68, 0.15, 0.48], [0, 0.2, 0.62]];
  circles.forEach(([dx, dy, k]) => { ctx.beginPath(); ctx.arc(cx + dx * r, cy + dy * r, r * k, 0, 7); ctx.stroke(); });
  circles.forEach(([dx, dy, k]) => { ctx.beginPath(); ctx.arc(cx + dx * r, cy + dy * r, r * k - 0.5, 0, 7); ctx.fill(); });
  if (face) {
    ctx.fillStyle = '#3b4a63';
    const eh = blink > 0.94 ? 0.5 : 2.2 * r / 12;
    ctx.beginPath(); ctx.ellipse(cx - r * 0.25, cy + r * 0.05, r * 0.07, eh, 0, 0, 7); ctx.ellipse(cx + r * 0.25, cy + r * 0.05, r * 0.07, eh, 0, 0, 7); ctx.fill();
    ctx.fillStyle = C.cheek; ctx.beginPath(); ctx.ellipse(cx - r * 0.42, cy + r * 0.22, r * 0.12, r * 0.07, 0, 0, 7); ctx.ellipse(cx + r * 0.42, cy + r * 0.22, r * 0.12, r * 0.07, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#3b4a63'; ctx.lineWidth = Math.max(1, r * 0.06); ctx.beginPath(); ctx.arc(cx, cy + r * 0.18, r * 0.12, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }
}
export function drawCloudMob(ctx, cx, cy, hue, t, reduce, seed = 0) {
  const bob = reduce ? 0 : Math.sin(t * 2.4 + seed) * 3;
  shadow(ctx, cx, cy + 4, 13);
  const glow = ctx.createRadialGradient(cx, cy - 16 + bob, 2, cx, cy - 16 + bob, 26); glow.addColorStop(0, `hsla(${hue},100%,85%,.55)`); glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy - 16 + bob, 26, 0, 7); ctx.fill();
  drawCloudBody(ctx, cx, cy - 16 + bob, 13, hue, true, reduce ? 0 : (Math.sin(t * 0.9 + seed * 3) > 0.985 ? 1 : 0));
}

export function drawPlayer(ctx, cx, cy, t, moving, facing, reduce, outfit = null) {
  const coat = outfit ? outfit.coat : { main: '#ffd21f', shade: '#f2b800', btn: '#b87f00' };
  const hat = outfit ? outfit.hat.id : 'none';
  const bob = moving && !reduce ? Math.abs(Math.sin(t * 16)) * 3 : 0;
  const sw = moving && !reduce ? Math.sin(t * 16) * 2 : 0;
  shadow(ctx, cx, cy + 3, 11);
  // 長靴
  ctx.fillStyle = '#35507a'; ctx.beginPath(); ctx.ellipse(cx - 4 + sw, cy + 1, 3.6, 2.4, 0, 0, 7); ctx.ellipse(cx + 4 - sw, cy + 1, 3.6, 2.4, 0, 0, 7); ctx.fill();
  const y = cy - bob;
  let main = coat.main;
  if (main === 'rainbow') { const g = ctx.createLinearGradient(cx - 12, y - 40, cx + 12, y); ['#ff8fa8', '#ffd27a', '#fff59a', '#9fe6a0', '#8fd0ff', '#c8a8ff'].forEach((c, i) => g.addColorStop(i / 5, c)); main = g; }
  // 合羽
  ctx.fillStyle = main; ctx.beginPath(); ctx.moveTo(cx - 10, y - 1); ctx.quadraticCurveTo(cx - 12, y - 16, cx, y - 20); ctx.quadraticCurveTo(cx + 12, y - 16, cx + 10, y - 1); ctx.quadraticCurveTo(cx, y + 3, cx - 10, y - 1); ctx.fill();
  ctx.fillStyle = coat.shade; ctx.globalAlpha = coat.main === 'rainbow' ? 0.35 : 1; ctx.beginPath(); ctx.moveTo(cx + 3, y - 18); ctx.quadraticCurveTo(cx + 12, y - 14, cx + 10, y - 1); ctx.quadraticCurveTo(cx + 4, y + 1, cx + 3, y - 3); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = coat.btn; ctx.fillRect(cx - 1, y - 14, 2, 3); ctx.fillRect(cx - 1, y - 8, 2, 3);
  // 頭とフード
  const hy = y - 25;
  ctx.fillStyle = main; ctx.beginPath(); ctx.arc(cx, hy, 12.5, Math.PI * 0.95, Math.PI * 2.05); ctx.lineTo(cx + 12, hy + 6); ctx.lineTo(cx - 12, hy + 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffe2c4'; ctx.beginPath(); ctx.ellipse(cx, hy + 2, 9.5, 8.8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = main; ctx.beginPath(); ctx.ellipse(cx, hy - 5.5, 11.5, 5, 0, Math.PI, 0); ctx.fill();
  const ex = facing[0] * 1.5;
  ctx.fillStyle = '#3b3b4f'; ctx.beginPath(); ctx.arc(cx - 3.6 + ex, hy + 2, 1.5, 0, 7); ctx.arc(cx + 3.6 + ex, hy + 2, 1.5, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,140,140,.55)'; ctx.beginPath(); ctx.arc(cx - 6.4 + ex, hy + 5, 1.8, 0, 7); ctx.arc(cx + 6.4 + ex, hy + 5, 1.8, 0, 7); ctx.fill();
  ctx.strokeStyle = '#a05a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx + ex, hy + 5, 1.8, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  drawHat(ctx, cx, hy - 9, hat, t, reduce);
}
export function drawHat(ctx, cx, top, id, t = 0, reduce = true) {
  const sw = reduce ? 0 : Math.sin(t * 3) * 0.08;
  if (id === 'flower') { ['#ff8fb0', '#ffd24a', '#ffffff', '#9ad4ff', '#ff8fb0'].forEach((c, i) => { const a = Math.PI * (1.05 + i * 0.22); const x = cx + Math.cos(a) * 11; const y = top + 6 + Math.sin(a) * 5; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(x, y, 1.1, 0, 7); ctx.fill(); }); }
  if (id === 'straw') { ctx.fillStyle = '#f2d27a'; ctx.beginPath(); ctx.ellipse(cx, top + 4, 17, 5, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#ebc35a'; ctx.beginPath(); ctx.ellipse(cx, top, 9, 6, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#e0584a'; ctx.fillRect(cx - 9, top, 18, 2.5); }
  if (id === 'cat') { [[-1, 0], [1, 0]].forEach(([d]) => { ctx.fillStyle = '#4a4a5a'; ctx.beginPath(); ctx.moveTo(cx + d * 4, top + 4); ctx.lineTo(cx + d * 11, top - 6); ctx.lineTo(cx + d * 12, top + 6); ctx.fill(); ctx.fillStyle = '#ffb3c8'; ctx.beginPath(); ctx.moveTo(cx + d * 6, top + 4); ctx.lineTo(cx + d * 10.5, top - 2); ctx.lineTo(cx + d * 11, top + 5); ctx.fill(); }); }
  if (id === 'leaf') { ctx.save(); ctx.translate(cx, top + 2); ctx.rotate(-0.4 + sw); ctx.fillStyle = '#6fbf4a'; ctx.beginPath(); ctx.ellipse(6, -6, 9, 4, -0.6, 0, 7); ctx.fill(); ctx.strokeStyle = '#3f8a2a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, -11); ctx.stroke(); ctx.restore(); }
  if (id === 'cloud') { drawCloudBody(ctx, cx, top - 2, 9, 210, true); }
  if (id === 'crown') { ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(cx - 9, top + 4); ctx.lineTo(cx - 9, top - 5); ctx.lineTo(cx - 4.5, top); ctx.lineTo(cx, top - 8); ctx.lineTo(cx + 4.5, top); ctx.lineTo(cx + 9, top - 5); ctx.lineTo(cx + 9, top + 4); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ff5a7a'; ctx.beginPath(); ctx.arc(cx, top, 1.8, 0, 7); ctx.fill(); ctx.fillStyle = '#5ab0ff'; ctx.beginPath(); ctx.arc(cx - 5, top + 1, 1.3, 0, 7); ctx.arc(cx + 5, top + 1, 1.3, 0, 7); ctx.fill(); }
  if (id === 'star') { const k = reduce ? 0 : t * 2; ctx.strokeStyle = 'rgba(255,240,160,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + 2, top - 4); ctx.quadraticCurveTo(cx - 10, top - 10, cx - 18, top - 6); ctx.stroke(); ctx.save(); ctx.translate(cx + 4, top - 6); ctx.rotate(k * 0.3); ctx.fillStyle = '#fff07a'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 3 : 7; const a = i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.restore(); }
}

export function drawCenterFlower(ctx, x, y, state, t, reduce) {
  const [cx, cy] = proj(x + 0.5, y + 0.5);
  const s = state === 2 ? 1.5 : state === 1 ? 1.25 : 0.7;
  if (state) { const g = ctx.createRadialGradient(cx, cy - 14, 2, cx, cy - 14, 44); g.addColorStop(0, 'rgba(255,240,170,.8)'); g.addColorStop(1, 'rgba(255,240,170,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy - 14, 44, 0, 7); ctx.fill(); }
  drawFlower(ctx, cx, cy + 1, s, state ? '#fff0a0' : '#8a93e8', state ? '#ffb0e8' : '#c0c8ff', reduce ? 0 : Math.sin(t * 2) * 1.2);
}

export function windVector(w) { const [dx, dy] = DIRS[w]; return [(dx - dy), (dx + dy) * 0.5]; }
export { cellAt, bridgeActive, gardenInfo };
