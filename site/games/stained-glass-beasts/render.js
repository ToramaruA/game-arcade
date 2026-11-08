// Canvas2D 描画。判定には一切関わらない（絵の呼吸・破片は見た目だけ）。
import { W, H, LAUNCH, R, FLOOR_Y, WALL_L, WALL_R, WALL_T } from './logic.js';
import { TONE, BEASTS } from './levels.js';

const LEAD = '#2B2435';
const BG = '#131126';
const SILVER = '#F6F2E7';

function path(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}
function centroid(pts) {
  let x = 0; let y = 0;
  for (const p of pts) { x += p[0]; y += p[1]; }
  return [x / pts.length, y / pts.length];
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function mix(hex, k) { // k>0 で白へ
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v + (255 - v) * k);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// 色ガラスの面：中心から頂点へ三角に割って明暗2〜3層
function facet(ctx, pts, tone, alpha = 1, glow = 0) {
  const base = TONE[tone] || tone;
  const [cx, cy] = centroid(pts);
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]; const b = pts[(i + 1) % pts.length];
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.closePath();
    const k = [0.62, 0.9, 1.15, 0.78][i % 4];
    ctx.fillStyle = k > 1 ? mix(base, (k - 1) * 0.9) : shade(base, k);
    ctx.fill();
  }
  ctx.restore();
  if (glow) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = glow;
    path(ctx, pts); ctx.fillStyle = base; ctx.fill();
    ctx.restore();
  }
  ctx.lineJoin = 'round';
  ctx.strokeStyle = LEAD; ctx.lineWidth = 5; path(ctx, pts); ctx.stroke();
}

// ───── 獣の絵（当たり判定なし）─────
function beastShapes(key) {
  const sh = [];
  const poly = (pts, tone, a = 0.55) => sh.push({ pts, tone, a });
  const ell = (cx, cy, rx, ry, n = 14, rot = 0) => Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2 + rot;
    return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry];
  });
  const rect = (cx, cy, w, h, d = 0) => {
    const c = Math.cos((d * Math.PI) / 180); const s = Math.sin((d * Math.PI) / 180);
    return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
  };
  if (key === 'deer') {
    for (const x of [212, 262, 378, 428]) poly([[x - 9, 360], [x + 9, 360], [x + 6, 505], [x - 6, 505]], 'ruby', 0.5);
    for (const x of [212, 428]) poly([[x - 12, 500], [x + 12, 500], [x + 8, 512], [x - 8, 512]], 'gold', 0.5);
    poly(ell(320, 318, 150, 78, 12), 'ruby', 0.58);
    poly(ell(320, 318, 96, 48, 8, 0.4), 'ruby', 0.7);
    poly(ell(320, 330, 55, 28, 6), 'gold', 0.3);
    poly([[286, 262], [354, 262], [364, 190], [276, 190]], 'ruby', 0.55);
    poly([[276, 190], [364, 190], [348, 118], [292, 118]], 'ruby', 0.7);
    poly([[292, 118], [348, 118], [320, 88]], 'gold', 0.6);
    poly([[276, 160], [222, 138], [266, 186]], 'ruby', 0.55); poly([[364, 160], [418, 138], [374, 186]], 'ruby', 0.55);
    for (const sgn of [-1, 1]) {
      const x0 = 320 + sgn * 28;
      poly([[x0, 120], [x0 + sgn * 36, 96], [x0 + sgn * 110, 86], [x0 + sgn * 170, 110], [x0 + sgn * 110, 100], [x0 + sgn * 40, 116]], 'peacock', 0.85);
      poly([[x0 + sgn * 100, 92], [x0 + sgn * 120, 74], [x0 + sgn * 130, 96]], 'peacock', 0.85);
      poly([[x0 + sgn * 68, 94], [x0 + sgn * 74, 70], [x0 + sgn * 86, 94]], 'peacock', 0.85);
      poly([[x0 + sgn * 150, 106], [x0 + sgn * 176, 150], [x0 + sgn * 160, 150]], 'peacock', 0.75);
    }
  } else if (key === 'snake') {
    const pts = [[120, 150], [300, 130], [470, 190], [520, 300], [420, 360], [200, 350], [110, 430], [200, 520], [400, 520]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i]; const [x1, y1] = pts[i + 1];
      const ang = Math.atan2(y1 - y0, x1 - x0); const w = 30 - i * 1.5;
      const nx = -Math.sin(ang) * w; const ny = Math.cos(ang) * w;
      poly([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], i % 2 ? 'peacock' : 'jade', 0.5);
      poly([[x0, y0], [x1, y1], [x0 + nx * 0.5, y0 + ny * 0.5]], 'gold', 0.22);
    }
    poly(ell(120, 140, 44, 30, 10, 0.4), 'peacock', 0.62); // 頭A
    poly(ell(404, 524, 40, 28, 10, 0.2), 'peacock', 0.62); // 頭B（二つの蛇頭）
    poly([[420, 520], [460, 510], [440, 530]], 'ruby', 0.7);
    poly([[102, 135], [92, 120], [112, 124]], 'gold', 0.8);
  } else {
    poly(ell(320, 300, 70, 150, 12), 'purple', 0.5); // 胴
    poly(ell(320, 130, 70, 62, 12), 'purple', 0.6); // 顔
    poly(ell(320, 330, 40, 90, 10), 'gold', 0.2);
    poly([[300, 118], [340, 118], [320, 150]], 'gold', 0.7);
    poly(ell(290, 122, 14, 14, 6), 'gold', 0.6); poly(ell(350, 122, 14, 14, 6), 'gold', 0.6);
    poly([[270, 72], [300, 92], [280, 100]], 'purple', 0.7); poly([[370, 72], [340, 92], [360, 100]], 'purple', 0.7);
    for (const sgn of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const y0 = 190 + i * 36; const xo = 70 + i * 6;
        poly([[320 + sgn * xo, y0], [320 + sgn * (xo + 210 - i * 22), y0 - 30 + i * 28], [320 + sgn * (xo + 190 - i * 22), y0 + 12 + i * 28], [320 + sgn * xo, y0 + 40]], i % 2 ? 'peacock' : 'purple', 0.5);
      }
    }
  }
  return sh;
}
const decorCache = {};
function decorOf(key) { return decorCache[key] || (decorCache[key] = beastShapes(key)); }

export function drawDecor(ctx, beastIdx, time, dim = 1) {
  const key = BEASTS[beastIdx].key;
  const breathe = 0.85 + Math.sin(time * 1.1) * 0.15;
  for (const s of decorOf(key)) facet(ctx, s.pts, s.tone, s.a * breathe * dim);
}

// ───── 背景（聖堂）─────
export function drawBackground(ctx, time, motes) {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(320, 260, 40, 320, 300, 520);
  g.addColorStop(0, 'rgba(128,103,202,0.30)'); g.addColorStop(0.6, 'rgba(54,183,200,0.07)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 奥の細い窓
  for (const x of [120, 220, 320, 420, 520]) {
    const h = x === 320 ? 190 : 150;
    ctx.beginPath(); ctx.moveTo(x - 22, 330); ctx.lineTo(x - 22, 330 - h * 0.62); ctx.quadraticCurveTo(x, 330 - h * 1.05, x + 22, 330 - h * 0.62); ctx.lineTo(x + 22, 330); ctx.closePath();
    ctx.fillStyle = 'rgba(54,183,200,0.07)'; ctx.fill(); ctx.strokeStyle = '#2B2435'; ctx.lineWidth = 3; ctx.stroke();
  }
  // 柱と尖頭アーチ
  for (const sgn of [-1, 1]) {
    const x = sgn < 0 ? 0 : W;
    ctx.fillStyle = '#1b1730'; ctx.fillRect(x - 24 + (sgn < 0 ? 0 : 0), 0, 24, H);
    ctx.fillStyle = '#1b1730'; ctx.fillRect(sgn < 0 ? 0 : W - 24, 0, 24, H);
    ctx.strokeStyle = LEAD; ctx.lineWidth = 3;
    for (let y = 100; y < 700; y += 120) { ctx.beginPath(); ctx.moveTo(sgn < 0 ? 0 : W, y); ctx.lineTo(sgn < 0 ? 24 : W - 24, y + 10); ctx.stroke(); }
  }
  ctx.fillStyle = '#17132b'; ctx.fillRect(0, 0, W, WALL_T);
  ctx.strokeStyle = LEAD; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(24, WALL_T); ctx.lineTo(W - 24, WALL_T); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(24, WALL_T); ctx.quadraticCurveTo(320, -50, W - 24, WALL_T); ctx.stroke();
  // 床の遠近線
  const fl = ctx.createLinearGradient(0, 560, 0, H); fl.addColorStop(0, 'rgba(43,36,53,0)'); fl.addColorStop(1, 'rgba(43,36,53,0.9)');
  ctx.fillStyle = fl; ctx.fillRect(24, 560, W - 48, H - 560);
  ctx.strokeStyle = 'rgba(80,66,100,0.5)'; ctx.lineWidth = 1.5;
  for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(320 + i * 24, 575); ctx.lineTo(320 + i * 90, H); ctx.stroke(); }
  for (let k = 0; k < 6; k++) { const y = 575 + (k * k) * 7 + k * 12; ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(W - 24, y); ctx.stroke(); }
  // 光の粒
  for (const m of motes) {
    const y = ((m.y - time * m.v) % 720 + 720) % 720 + 60;
    ctx.fillStyle = `rgba(246,242,231,${m.a * (0.6 + 0.4 * Math.sin(time * 2 + m.x))})`;
    ctx.beginPath(); ctx.arc(m.x, y, m.r, 0, 7); ctx.fill();
  }
}

export function makeMotes() {
  return Array.from({ length: 36 }, (_, i) => ({ x: 40 + ((i * 97) % 560), y: (i * 61) % 720, v: 6 + (i % 5) * 3, r: 1 + (i % 3) * 0.6, a: 0.12 + (i % 4) * 0.05 }));
}

// ───── 部位 ─────
function rivets(ctx, pts) {
  ctx.fillStyle = 'rgba(246,242,231,0.55)';
  for (const p of pts) { ctx.beginPath(); ctx.arc(p[0], p[1], 2.2, 0, 7); ctx.fill(); }
}
function mark(ctx, p, color = TONE.gold) {
  if (!p.mark) return;
  const [cx, cy] = centroid(p.pts);
  ctx.save(); ctx.font = 'bold 15px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 3; ctx.strokeStyle = LEAD; ctx.strokeText(p.mark, cx, cy + 1);
  ctx.fillStyle = color; ctx.fillText(p.mark, cx, cy + 1); ctx.restore();
}
const ARMOR_TINT = { chest: '#D94469', antler: '#36B7C8', lid: '#5b5470', plate: '#4a4260', pillar: '#4a4260', scale: '#2f8f9d', wing: '#6a58a8', mask: '#5a5470' };

export function drawPiece(ctx, p, state, time) {
  const { gone, open, hp, pulse } = state;
  if (gone[p.id]) return;
  if (p.kind === 'armor') {
    if (open[p.id]) {
      ctx.save(); ctx.globalAlpha = 0.5; ctx.setLineDash([6, 5]);
      ctx.strokeStyle = TONE.gold; ctx.lineWidth = 2.5; path(ctx, p.pts); ctx.stroke(); ctx.restore();
      mark(ctx, p, 'rgba(245,199,106,0.7)');
      return;
    }
    const tint = ARMOR_TINT[p.look] || '#4a4260';
    const [cx, cy] = centroid(p.pts);
    path(ctx, p.pts);
    const g = ctx.createLinearGradient(p.pts[0][0], p.pts[0][1], cx + 30, cy + 30);
    g.addColorStop(0, mix(tint, 0.25)); g.addColorStop(0.5, tint); g.addColorStop(1, shade(tint, 0.55));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = LEAD; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.strokeStyle = 'rgba(246,242,231,0.28)'; ctx.lineWidth = 1.5; path(ctx, p.pts); ctx.stroke();
    rivets(ctx, p.pts);
    mark(ctx, p);
  } else if (p.kind === 'glass') {
    facet(ctx, p.pts, p.tone, 0.82, 0.12 + Math.sin(time * 1.5 + p.pts[0][0]) * 0.05);
    ctx.strokeStyle = 'rgba(246,242,231,0.35)'; ctx.lineWidth = 1.5;
    const [cx, cy] = centroid(p.pts); ctx.beginPath(); ctx.moveTo(p.pts[0][0], p.pts[0][1]); ctx.lineTo(cx, cy); ctx.stroke();
  } else if (p.kind === 'mirror') {
    facet(ctx, p.pts, '#e9d6a0', 0.9, 0.1);
    ctx.strokeStyle = TONE.gold; ctx.lineWidth = 2.5; path(ctx, p.pts); ctx.stroke();
    const [cx, cy] = centroid(p.pts); // ひび記号
    ctx.strokeStyle = 'rgba(43,36,53,0.85)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(cx - 7, cy - 4); ctx.lineTo(cx - 1, cy + 1); ctx.lineTo(cx + 2, cy - 4); ctx.lineTo(cx + 8, cy + 3); ctx.stroke();
  } else if (p.kind === 'heart') {
    const full = (hp[p.id] ?? 2) >= 2;
    const [cx, cy] = centroid(p.pts);
    const k = 1 + Math.sin(time * 3) * 0.03;
    for (let i = 0; i < 3; i++) {
      const sc = (1 - i * 0.28) * k;
      const pts = p.pts.map(([x, y]) => [cx + (x - cx) * sc, cy + (y - cy) * sc]);
      path(ctx, pts);
      ctx.fillStyle = [shade(TONE.gold, 0.7), TONE.gold, '#fff3c4'][i]; ctx.fill();
      ctx.strokeStyle = LEAD; ctx.lineWidth = i === 0 ? 5 : 2.5; ctx.stroke();
    }
    if (!full) { // ひび
      ctx.strokeStyle = LEAD; ctx.lineWidth = 2.5; ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 22); ctx.lineTo(cx + 3, cy - 6); ctx.lineTo(cx - 5, cy + 6); ctx.lineTo(cx + 5, cy + 22); ctx.stroke();
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createRadialGradient(cx, cy, 6, cx, cy, 52); gl.addColorStop(0, 'rgba(245,199,106,0.45)'); gl.addColorStop(1, 'rgba(245,199,106,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, 52, 0, 7); ctx.fill(); ctx.restore();
    if (pulse?.heart) { // 呼び戻しで貫ける心臓の輪郭を光らせる
      ctx.save(); ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 3.5; ctx.shadowColor = TONE.gold; ctx.shadowBlur = 14;
      path(ctx, p.pts.map(([x, y]) => [cx + (x - cx) * 1.25, cy + (y - cy) * 1.25])); ctx.stroke(); ctx.restore();
    }
  } else if (p.kind === 'bell') {
    const [cx, cy] = centroid(p.pts);
    ctx.save();
    ctx.fillStyle = TONE.gold; ctx.strokeStyle = LEAD; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy - 18, 5, 0, 7); ctx.stroke(); // 吊り輪
    path(ctx, p.pts); ctx.fillStyle = '#e0a93f'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 10, cy + 6); ctx.quadraticCurveTo(cx, cy - 16, cx + 10, cy + 6); ctx.closePath();
    ctx.fillStyle = '#fff3c4'; ctx.fill(); ctx.restore();
    mark(ctx, { ...p, pts: [[cx, cy + 22], [cx, cy + 22]] }, TONE.gold);
  }
}

// 床に落ちる色光と、割れた場所から差す光
function drawLightPools(ctx, level, state, time) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of level.pieces) {
    if (!['glass', 'mirror', 'heart'].includes(p.kind)) continue;
    const [cx, cy] = centroid(p.pts);
    const tone = TONE[p.tone] || TONE.gold;
    const gone = state.gone[p.id];
    const fy = 610 + (cy - 100) * 0.22;
    ctx.globalAlpha = gone ? 0.34 : 0.13;
    const g = ctx.createRadialGradient(cx, fy, 4, cx, fy, 60); g.addColorStop(0, tone); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, fy, 60, 18, 0, 0, 7); ctx.fill();
    if (gone) { // 抜ける光の筋
      ctx.globalAlpha = 0.16 + Math.sin(time * 2 + cx) * 0.03;
      const b = ctx.createLinearGradient(cx, cy, cx, fy); b.addColorStop(0, tone); b.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(cx - 14, cy); ctx.lineTo(cx + 14, cy); ctx.lineTo(cx + 46, fy); ctx.lineTo(cx - 46, fy); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

// ───── 発射台・球・線 ─────
function drawLauncher(ctx, time, armed) {
  const { x, y } = LAUNCH;
  ctx.save();
  ctx.fillStyle = '#1f1a33'; ctx.strokeStyle = LEAD; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x - 46, y + 34); ctx.lineTo(x - 30, y + 8); ctx.lineTo(x + 30, y + 8); ctx.lineTo(x + 46, y + 34); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = TONE.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 36, y + 26); ctx.lineTo(x + 36, y + 26); ctx.stroke();
  if (armed) {
    const k = 1 + Math.sin(time * 5) * 0.12;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 2, x, y, 26 * k); g.addColorStop(0, 'rgba(246,242,231,0.7)'); g.addColorStop(1, 'rgba(246,242,231,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 26 * k, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawBall(ctx, s, warn, time) {
  const back = s.mode === 'back';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, 20); g.addColorStop(0, back ? 'rgba(255,225,150,0.8)' : 'rgba(200,225,255,0.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, 20, 0, 7); ctx.fill();
  ctx.restore();
  ctx.fillStyle = SILVER; ctx.strokeStyle = back ? TONE.gold : '#9fb8c8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(s.x, s.y, R + 0.5, 0, 7); ctx.fill(); ctx.stroke();
  if (warn) { // 終了1秒前の外周リング
    const k = ((s.t - 7) % 1);
    ctx.strokeStyle = `rgba(217,68,105,${0.9 - k * 0.5})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.x, s.y, 13 + k * 6, 0, 7); ctx.stroke();
  }
}

function polyline(ctx, pts, color, width, dash, alpha = 1) {
  if (pts.length < 2) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); ctx.restore();
}

function cross(ctx, x, y, size = 9) {
  ctx.save(); ctx.strokeStyle = '#ff6b8a'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size); ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size); ctx.stroke(); ctx.restore();
}

// 失われた鏡の跡（薄線）
function drawGhosts(ctx, level, state) {
  for (const p of level.pieces) {
    if (p.kind === 'mirror' && state.gone[p.id]) {
      ctx.save(); ctx.globalAlpha = 0.35; ctx.setLineDash([3, 5]); ctx.strokeStyle = TONE.gold; ctx.lineWidth = 1.5; path(ctx, p.pts); ctx.stroke(); ctx.restore();
    }
  }
}

// ───── 画面全体 ─────
// view: { battle, time, motes, aim:{angle,pts}|null, retPrev, parts, sample, hidePreview }
export function drawBattle(ctx, view) {
  const { battle: b, time } = view;
  const level = b.level;
  drawBackground(ctx, time, view.motes);
  drawLightPools(ctx, level, b, time);
  drawDecor(ctx, level.beast, time);
  drawGhosts(ctx, level, b);
  const pulse = { heart: !!(view.retPrev && view.retPrev.valid && view.retPrev.hearts.some((id) => !b.gone[id])) };
  for (const p of level.pieces) if (p.kind === 'armor' || p.kind === 'bell') drawPiece(ctx, p, { ...b, pulse }, time);
  for (const p of level.pieces) if (p.kind !== 'armor' && p.kind !== 'bell') drawPiece(ctx, p, { ...b, pulse }, time);
  // 本日の軌跡
  polyline(ctx, b.lastOut, 'rgba(160,210,255,0.8)', 2.5, null, 0.75);
  polyline(ctx, b.lastBack, TONE.gold, 3, null, 0.95);
  // 帰路の細線（常時）と停止点の×
  const rp = view.retPrev;
  if (rp) {
    polyline(ctx, rp.pts, rp.valid ? 'rgba(245,199,106,0.85)' : 'rgba(245,199,106,0.35)', rp.valid ? 2 : 1.5, [2, 5]);
    if (rp.stop) cross(ctx, rp.stop.x, rp.stop.y);
  }
  if (view.aim) {
    polyline(ctx, view.aim.pts, 'rgba(246,242,231,0.9)', 2.5, [8, 7]);
    for (const p of view.aim.pts.slice(1)) { ctx.fillStyle = 'rgba(246,242,231,0.9)'; ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, 7); ctx.fill(); }
  }
  if (view.sample) polyline(ctx, view.sample, 'rgba(245,199,106,0.55)', 3, [3, 8]);
  if (b.shot && !b.shot.ended && b.status === 'fly') {
    drawBall(ctx, b.shot, b.shot.mode === 'out' && b.shot.t >= 7, time);
  } else if (b.status === 'aim') {
    drawLauncher(ctx, time, true);
    ctx.fillStyle = SILVER; ctx.strokeStyle = '#9fb8c8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(LAUNCH.x, LAUNCH.y, R + 1 + Math.sin(time * 5) * 0.8, 0, 7); ctx.fill(); ctx.stroke();
  }
  if (b.status !== 'fly') drawLauncher(ctx, time, false);
  if (b.shot && b.shot.stop && b.status !== 'fly') cross(ctx, b.shot.stop.x, b.shot.stop.y, 11);
  drawParticles(ctx, view.parts);
  // 暗い縁取り
  const v = ctx.createRadialGradient(320, 400, 280, 320, 400, 560); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(8,6,18,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ───── 破片と光（見た目だけ）─────
export function spawnBreak(parts, piece, reduced) {
  const [cx, cy] = centroid(piece.pts);
  const tone = TONE[piece.tone] || TONE.gold;
  const n = reduced ? 2 : 2 + (Math.floor(cx) % 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283 + cx;
    parts.push({ x: cx, y: cy, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 30, life: 0.8, max: 0.8, kind: 'shard', c: tone, s: 6 + (i % 3) * 3, rot: a });
  }
  parts.push({ x: cx, y: cy, vx: 0, vy: 0, life: 0.7, max: 0.7, kind: 'ring', c: tone, s: 14 });
}
export function spawnSpark(parts, x, y, c) { parts.push({ x, y, vx: 0, vy: 0, life: 0.25, max: 0.25, kind: 'ring', c, s: 6 }); }
export function stepParticles(parts, dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; p.rot = (p.rot || 0) + dt * 3;
  }
}
function drawParticles(ctx, parts) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of parts) {
    const k = p.life / p.max;
    ctx.globalAlpha = Math.max(0, k);
    if (p.kind === 'ring') { ctx.strokeStyle = p.c; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, p.s + (1 - k) * 34, 0, 7); ctx.stroke(); }
    else { ctx.fillStyle = p.c; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath(); ctx.moveTo(0, -p.s); ctx.lineTo(p.s * 0.7, p.s * 0.6); ctx.lineTo(-p.s * 0.7, p.s * 0.4); ctx.closePath(); ctx.fill(); ctx.restore(); }
  }
  ctx.restore();
}

// ───── 記念窓 ─────
export function drawMemorial(ctx, level, mem, w = W, h = H) {
  ctx.save();
  ctx.scale(w / W, h / H);
  const gone = {};
  for (const id of mem.broken) gone[id] = true;
  ctx.fillStyle = '#0d0a1c'; ctx.fillRect(0, 0, W, H);
  // 窓枠（尖頭アーチ）
  ctx.save();
  ctx.beginPath(); ctx.moveTo(40, 760); ctx.lineTo(40, 250); ctx.quadraticCurveTo(40, 50, 320, 20); ctx.quadraticCurveTo(600, 50, 600, 250); ctx.lineTo(600, 760); ctx.closePath();
  ctx.clip();
  const bg = ctx.createRadialGradient(320, 300, 30, 320, 330, 420); bg.addColorStop(0, '#2a2150'); bg.addColorStop(1, '#0f0c20');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // 獣の姿は暗い鉛線で
  for (const s of decorOf(BEASTS[level.beast].key)) {
    path(ctx, s.pts); ctx.fillStyle = 'rgba(43,36,53,0.35)'; ctx.fill(); ctx.strokeStyle = 'rgba(90,76,120,0.7)'; ctx.lineWidth = 2.5; ctx.stroke();
  }
  // 部位：割った所は明るい色で復元、未破壊は鉛線のみ
  const centers = {};
  for (const p of level.pieces) {
    centers[p.id] = centroid(p.pts);
    if (p.kind === 'bell') continue;
    if (gone[p.id]) {
      const tone = p.kind === 'heart' ? 'gold' : p.tone;
      facet(ctx, p.pts, tone, 0.95, 0.35);
    } else {
      path(ctx, p.pts); ctx.strokeStyle = 'rgba(70,58,92,0.95)'; ctx.lineWidth = 3.5; ctx.stroke();
      if (p.kind === 'heart') { ctx.fillStyle = 'rgba(245,199,106,0.1)'; ctx.fill(); }
    }
  }
  // 破壊順：細い金の継ぎ目と番号
  const seq = mem.order;
  ctx.strokeStyle = 'rgba(245,199,106,0.8)'; ctx.lineWidth = 1.6; ctx.beginPath();
  seq.forEach((e, i) => { const c = centers[e.id]; if (!c) return; if (i === 0) ctx.moveTo(c[0], c[1]); else ctx.lineTo(c[0], c[1]); });
  ctx.stroke();
  seq.forEach((e, i) => {
    const c = centers[e.id]; if (!c) return;
    ctx.fillStyle = '#131126'; ctx.beginPath(); ctx.arc(c[0], c[1], 10, 0, 7); ctx.fill();
    ctx.strokeStyle = e.phase === 'back' ? TONE.gold : '#a0d2ff'; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), c[0], c[1] + 0.5);
  });
  polyline(ctx, mem.lastOut, 'rgba(160,210,255,0.85)', 3, null);
  polyline(ctx, mem.lastBack, TONE.gold, 3.5, null);
  ctx.restore();
  ctx.strokeStyle = LEAD; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(40, 760); ctx.lineTo(40, 250); ctx.quadraticCurveTo(40, 50, 320, 20); ctx.quadraticCurveTo(600, 50, 600, 250); ctx.lineTo(600, 760); ctx.closePath(); ctx.stroke();
  ctx.strokeStyle = TONE.gold; ctx.lineWidth = 2; ctx.stroke();
  // 銘板
  ctx.fillStyle = '#17132b'; ctx.fillRect(60, 690, 520, 90);
  ctx.strokeStyle = TONE.gold; ctx.lineWidth = 2; ctx.strokeRect(60, 690, 520, 90);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#F6F2E7'; ctx.font = 'bold 26px serif'; ctx.fillText(level.name, 320, 724);
  const g = mem.goals;
  ctx.font = '19px sans-serif';
  const head = mem.result === 'won' ? `${mem.shots}球で撃破` : `未撃破（${mem.shots}球）`;
  ctx.fillStyle = mem.result === 'won' ? TONE.gold : '#ff9bb0';
  ctx.fillText(`${head}　${g.clear ? '◆撃破' : '◇撃破'}　${g.par ? '◆少球' : '◇少球'}　${g.perfect ? '◆全破壊' : '◇全破壊'}`, 320, 758);
  ctx.restore();
}

export function drawBeastThumb(ctx, beastIdx, w, h, time = 0) {
  ctx.save();
  ctx.fillStyle = '#17132b'; ctx.fillRect(0, 0, w, h);
  const s = Math.min(w / 640, h / 560);
  ctx.translate((w - 640 * s) / 2, 6); ctx.scale(s, s);
  drawDecor(ctx, beastIdx, time, 1.3);
  ctx.restore();
}
