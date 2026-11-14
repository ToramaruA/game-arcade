// 木版画と影絵の絵（Canvas のみ。外部素材なし）。
// 色は墨・朱・金・群青・生成り紙の5色を基本にする。
export const C = {
  ink: '#15100c', ink2: '#2a211a', paper: '#efe2c4', paperD: '#d8c49c', red: '#d8432b', redD: '#8e2414',
  gold: '#e4a93a', goldL: '#ffd77a', indigo: '#1d3566', indigoD: '#0d1a36', purple: '#5a3b8c', purpleL: '#8a67c4', moon: '#f6ecd0',
};
const TAU = Math.PI * 2;

// 紙のざらつきと版木のかすれ（一度だけ作って使い回す）
let grain = null;
function grainPattern(ctx) {
  if (grain) return grain;
  const g = document.createElement('canvas'); g.width = g.height = 160;
  const x = g.getContext('2d');
  for (let i = 0; i < 2600; i++) {
    const a = Math.random();
    x.fillStyle = a < 0.5 ? `rgba(255,240,210,${Math.random() * 0.07})` : `rgba(0,0,0,${Math.random() * 0.1})`;
    x.fillRect(Math.random() * 160, Math.random() * 160, 1 + Math.random() * 2, 1);
  }
  x.strokeStyle = 'rgba(0,0,0,.06)';
  for (let i = 0; i < 40; i++) { x.beginPath(); const y = Math.random() * 160; x.moveTo(0, y); x.bezierCurveTo(50, y + 4, 110, y - 4, 160, y + 2); x.stroke(); }
  grain = ctx.createPattern(g, 'repeat');
  return grain;
}
export function texture(ctx, w, h, a = 1) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = grainPattern(ctx); ctx.fillRect(0, 0, w, h); ctx.restore(); }

function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); }
// 版木らしい、少し揺れた輪郭
function rough(ctx, pts, seed = 1) {
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) {
    const mx = (pts[i - 2] + pts[i]) / 2 + Math.sin(seed * 7 + i) * 1.5; const my = (pts[i - 1] + pts[i + 1]) / 2 + Math.cos(seed * 5 + i) * 1.5;
    ctx.quadraticCurveTo(mx, my, pts[i], pts[i + 1]);
  }
  ctx.closePath();
}
function glow(ctx, x, y, r, col, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
}

// ---------- 背景（章ごと） ----------
export function drawBackdrop(ctx, w, h, ch, t, dawn = 0) {
  // 空：墨→群青。夜明けが進むと下から朱→金
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  const tops = ['#0e1320', '#0b1630', '#120a1c'];
  sky.addColorStop(0, tops[ch] || tops[0]);
  sky.addColorStop(0.7, ch === 1 ? '#1c3058' : ch === 2 ? '#2a1636' : '#1b2a2a');
  sky.addColorStop(1, ch === 2 ? '#3a1a22' : '#2a2a22');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  if (dawn > 0) {
    const g = ctx.createLinearGradient(0, h, 0, h * (1 - dawn));
    g.addColorStop(0, 'rgba(255,200,90,.95)'); g.addColorStop(0.4, 'rgba(216,67,43,.8)'); g.addColorStop(1, 'rgba(216,67,43,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  // 鎖につながれた太陽（右上）
  const sx = w * 0.78; const sy = h * 0.22; const sr = Math.min(w, h) * 0.11;
  glow(ctx, sx, sy, sr * 2.4, 'rgba(216,67,43,.35)');
  ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,215,122,.5)'; ctx.beginPath(); ctx.arc(sx - sr * 0.25, sy - sr * 0.25, sr * 0.55, 0, TAU); ctx.fill();
  if (dawn < 1) chain(ctx, sx, sy + sr * 0.6, sx - w * 0.12, h * 0.95, 12, C.ink, t);
  // 版画の雲
  ctx.strokeStyle = 'rgba(246,236,208,.18)'; ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 0.27 + t * 0.004) % 1.2 - 0.1) * w; const cy = h * (0.12 + i * 0.07);
    ctx.beginPath(); for (let k = 0; k < 4; k++) ctx.arc(cx + k * 16, cy, 12, Math.PI, 0); ctx.stroke();
  }
  if (ch === 0) forest(ctx, w, h, t);
  else if (ch === 1) bellTown(ctx, w, h, t);
  else castle(ctx, w, h, t);
  texture(ctx, w, h, 0.9);
}

function chain(ctx, x0, y0, x1, y1, n, col, t) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 3;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n; const x = x0 + (x1 - x0) * u; const y = y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * 18 + Math.sin(t * 1.5 + i) * 0.8;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(y1 - y0, x1 - x0) + (i % 2 ? Math.PI / 2 : 0));
    ctx.beginPath(); ctx.ellipse(0, 0, 7, i % 2 ? 2.5 : 4, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}

function forest(ctx, w, h) {
  // 奥の山並み（群青）と、墨の木立
  ctx.fillStyle = '#1a2846'; rough(ctx, [0, h * 0.62, w * 0.2, h * 0.5, w * 0.42, h * 0.6, w * 0.65, h * 0.48, w, h * 0.6, w, h, 0, h], 2); ctx.fill();
  for (let i = 0; i < 9; i++) {
    const x = (i / 8) * w + (i % 2 ? 14 : -10); const th = h * (0.45 + (i % 3) * 0.12);
    ctx.fillStyle = i % 2 ? C.ink : '#1e1914';
    ctx.beginPath(); ctx.moveTo(x - 8, h); ctx.lineTo(x - 3, h - th); ctx.lineTo(x + 3, h - th); ctx.lineTo(x + 8, h); ctx.fill();
    for (let k = 0; k < 4; k++) { const by = h - th + k * th * 0.18; ctx.beginPath(); ctx.moveTo(x, by + 10); ctx.lineTo(x + (k % 2 ? 34 : -34), by - 6); ctx.lineTo(x, by + 16); ctx.fill(); }
  }
  ground(ctx, w, h, '#120d0a');
}
function bellTown(ctx, w, h) {
  ctx.fillStyle = '#132648'; ctx.fillRect(0, h * 0.62, w, h);
  // 沈んだ家並みと傾いた鐘楼
  for (let i = 0; i < 7; i++) {
    const x = i * w / 6 - 20; const bh = h * (0.18 + (i % 3) * 0.08);
    ctx.fillStyle = i % 2 ? '#0d1830' : '#101d38';
    poly(ctx, [x, h * 0.72, x, h * 0.72 - bh, x + 30, h * 0.72 - bh - 22, x + 60, h * 0.72 - bh, x + 60, h * 0.72]); ctx.fill();
    ctx.fillStyle = 'rgba(228,169,58,.6)'; ctx.fillRect(x + 22, h * 0.72 - bh + 10, 8, 10);
  }
  ctx.save(); ctx.translate(w * 0.5, h * 0.7); ctx.rotate(-0.12);
  ctx.fillStyle = C.ink; ctx.fillRect(-16, -h * 0.5, 32, h * 0.5); poly(ctx, [-24, -h * 0.5, 0, -h * 0.62, 24, -h * 0.5]); ctx.fill();
  ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(-10, -h * 0.42); ctx.quadraticCurveTo(0, -h * 0.5, 10, -h * 0.42); ctx.lineTo(12, -h * 0.36); ctx.lineTo(-12, -h * 0.36); ctx.fill();
  ctx.restore();
  // 水面の線
  ctx.strokeStyle = 'rgba(246,236,208,.2)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, h * (0.76 + i * 0.04)); for (let x = 0; x <= w; x += 20) ctx.lineTo(x, h * (0.76 + i * 0.04) + Math.sin(x * 0.05 + i) * 2); ctx.stroke(); }
  ground(ctx, w, h, '#0a1224');
}
function castle(ctx, w, h) {
  ctx.fillStyle = '#1a0e22';
  const base = h * 0.7;
  poly(ctx, [w * 0.3, base, w * 0.3, h * 0.36, w * 0.36, h * 0.3, w * 0.42, h * 0.36, w * 0.42, h * 0.26, w * 0.5, h * 0.12, w * 0.58, h * 0.26, w * 0.58, h * 0.36, w * 0.64, h * 0.3, w * 0.7, h * 0.36, w * 0.7, base]); ctx.fill();
  ctx.fillStyle = 'rgba(228,169,58,.55)';
  for (const [x, y] of [[0.36, 0.42], [0.5, 0.3], [0.64, 0.42], [0.5, 0.48]]) ctx.fillRect(w * x - 4, h * y, 8, 14);
  ground(ctx, w, h, '#100812');
}
function ground(ctx, w, h, col) {
  ctx.fillStyle = col; rough(ctx, [0, h * 0.84, w * 0.3, h * 0.82, w * 0.6, h * 0.85, w, h * 0.83, w, h, 0, h], 4); ctx.fill();
  ctx.strokeStyle = 'rgba(246,236,208,.12)'; ctx.lineWidth = 1;
  for (let i = 0; i < 18; i++) { const x = (i * 97) % w; ctx.beginPath(); ctx.moveTo(x, h * 0.88 + (i % 3) * 8); ctx.lineTo(x + 26, h * 0.88 + (i % 3) * 8); ctx.stroke(); }
}

// ---------- 魔女イリス（影絵。紫の帽子、尖った鼻、風になびく髪、肩に金の蛾） ----------
export function drawWitch(ctx, x, y, s, t, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const sway = Math.sin(t * 2) * 2;
  if (o.seed !== false) glow(ctx, 30, -70, 34, 'rgba(216,67,43,.55)');
  // 外套（後ろへたなびく）
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.moveTo(-6, -92); ctx.bezierCurveTo(-30, -60, -54 + sway, -20, -70 + sway * 2, 0); ctx.lineTo(24, 0); ctx.bezierCurveTo(20, -40, 14, -70, 10, -92); ctx.fill();
  // 髪
  ctx.beginPath(); ctx.moveTo(-2, -104); ctx.bezierCurveTo(-26, -100, -46 + sway, -86, -64 + sway * 1.5, -72); ctx.bezierCurveTo(-40, -80, -20, -84, -4, -90); ctx.fill();
  // 顔の横顔（尖った鼻）
  ctx.beginPath(); ctx.moveTo(-2, -112); ctx.lineTo(10, -110); ctx.lineTo(13, -104); ctx.lineTo(22, -100); ctx.lineTo(13, -97); ctx.lineTo(12, -91); ctx.lineTo(-2, -88); ctx.fill();
  // 帽子（紫）
  ctx.fillStyle = C.purple;
  ctx.beginPath(); ctx.ellipse(4, -112, 26, 6, -0.1, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-14, -114); ctx.quadraticCurveTo(-4, -150, -30 + sway, -168); ctx.quadraticCurveTo(4, -148, 18, -114); ctx.fill();
  ctx.fillStyle = C.purpleL; ctx.fillRect(-12, -118, 30, 3);
  // 朝の種（朱）を抱く腕
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(8, -84); ctx.quadraticCurveTo(30, -76, 30, -64); ctx.lineTo(22, -62); ctx.quadraticCurveTo(20, -72, 6, -76); ctx.fill();
  if (o.seed !== false) { ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(30, -70, 7, 0, TAU); ctx.fill(); ctx.fillStyle = C.goldL; ctx.beginPath(); ctx.arc(28, -72, 2.5, 0, TAU); ctx.fill(); }
  // 杖
  ctx.strokeStyle = C.ink2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, -96); ctx.lineTo(-26, 0); ctx.stroke();
  // 金の蛾
  const fl = Math.sin(t * 12) * 0.5 + 0.5;
  ctx.fillStyle = C.gold; ctx.save(); ctx.translate(-16, -84 + Math.sin(t * 3) * 2);
  ctx.beginPath(); ctx.ellipse(-5, -3, 6, 3 + fl * 2, -0.6, 0, TAU); ctx.ellipse(5, -3, 6, 3 + fl * 2, 0.6, 0, TAU); ctx.fill(); ctx.restore();
  ctx.restore();
}

// ---------- 仲間（焚火に座る小さな影） ----------
export function drawAlly(ctx, id, x, y, s, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = C.ink;
  if (id === 'rine') { // 風読み：長い襟巻きと風見の羽根
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-8, -26); ctx.arc(0, -32, 8, Math.PI, 0); ctx.lineTo(10, 0); ctx.fill();
    ctx.strokeStyle = C.indigo; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-4, -24); ctx.quadraticCurveTo(-20, -24 + Math.sin(t * 3) * 3, -32, -18); ctx.stroke();
    ctx.fillStyle = C.paper; ctx.beginPath(); ctx.moveTo(6, -40); ctx.lineTo(16, -54); ctx.lineTo(10, -38); ctx.fill();
  } else if (id === 'toma') { // 鐘守：大柄、背に小さな鐘
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-12, -28); ctx.arc(0, -34, 9, Math.PI, 0); ctx.lineTo(14, 0); ctx.fill();
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(-18, -26); ctx.quadraticCurveTo(-12, -40, -6, -26); ctx.lineTo(-4, -20); ctx.lineTo(-20, -20); ctx.fill();
  } else { // 灯し子：小さな体と手提げ灯
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-6, -18); ctx.arc(0, -23, 6, Math.PI, 0); ctx.lineTo(7, 0); ctx.fill();
    glow(ctx, 14, -12, 12, 'rgba(255,215,122,.8)'); ctx.fillStyle = C.goldL; ctx.fillRect(11, -16, 6, 7);
  }
  ctx.restore();
}
export function drawCampfire(ctx, x, y, s, t) {
  glow(ctx, x, y - 6 * s, 40 * s, 'rgba(216,67,43,.45)');
  ctx.fillStyle = C.ink2; ctx.fillRect(x - 12 * s, y - 3 * s, 24 * s, 4 * s);
  for (let i = 0; i < 3; i++) {
    const fh = (14 + Math.sin(t * 9 + i * 2) * 4) * s;
    ctx.fillStyle = i === 1 ? C.goldL : C.red;
    ctx.beginPath(); ctx.moveTo(x + (i - 1) * 6 * s - 5 * s, y - 2 * s); ctx.quadraticCurveTo(x + (i - 1) * 6 * s, y - fh * 1.4, x + (i - 1) * 6 * s + 5 * s, y - 2 * s); ctx.fill();
  }
}

// ---------- 檻と鎖 ----------
export function drawCage(ctx, x, y, s, chains, t, ally, state) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (state === 'freed') { ctx.globalAlpha = 0.35; }
  ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.fillStyle = 'rgba(21,16,12,.4)';
  ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-26, -54); ctx.quadraticCurveTo(0, -78, 26, -54); ctx.lineTo(26, 0); ctx.closePath(); ctx.fill();
  if (ally && state !== 'freed') { glow(ctx, 0, -26, 34, 'rgba(246,236,208,.55)'); drawAlly(ctx, ally, 0, -2, 1.1, t); }
  ctx.strokeStyle = C.paperD; ctx.lineWidth = 3;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 11, 0); ctx.lineTo(i * 11, -60 + Math.abs(i) * 4); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(28, 0); ctx.stroke();
  ctx.restore();
  // 鎖2本（白黒の太線）。切れた鎖は垂れ下がる
  for (let k = 0; k < 2; k++) {
    const cut = k >= chains;
    const x0 = x + (k ? 22 : -22) * s; const y0 = y - 40 * s;
    const x1 = x + (k ? 60 : -60) * s; const y1 = y - (cut ? 10 : 110) * s;
    ctx.save(); ctx.globalAlpha = cut ? 0.35 : 1;
    for (let i = 0; i < 6; i++) {
      const u = (i + 0.5) / 6; const cx = x0 + (x1 - x0) * u; const cy = y0 + (y1 - y0) * u;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.atan2(y1 - y0, x1 - x0) + (i % 2 ? Math.PI / 2 : 0));
      ctx.lineWidth = 5 * s; ctx.strokeStyle = C.ink; ctx.beginPath(); ctx.ellipse(0, 0, 8 * s, (i % 2 ? 3 : 5) * s, 0, 0, TAU); ctx.stroke();
      ctx.lineWidth = 2 * s; ctx.strokeStyle = C.moon; ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }
}

// ---------- 敵（影絵＋差し色） ----------
// 足元を原点に描く。高さ約 120 を基準
export function drawFoe(ctx, id, x, y, s, t, o = {}) {
  if (id === 'pup') id = 'wolf';
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (o.hit) ctx.translate(Math.sin(t * 80) * 4, 0);
  const breath = Math.sin(t * 2 + (o.k || 0)) * 2;
  ctx.fillStyle = C.ink;
  const eye = (ex, ey, r = 3, col = C.red) => { glow(ctx, ex, ey, r * 4, col === C.red ? 'rgba(216,67,43,.6)' : 'rgba(228,169,58,.6)'); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ex, ey, r, 0, TAU); ctx.fill(); ctx.fillStyle = C.ink; };
  switch (id) {
    case 'wolf': {
      // 枝でできた狼
      rough(ctx, [60, -10, 40, -40, -10, -46, -40, -60 + breath, -54, -78 + breath, -66, -58, -60, -40, -48, 0, -38, 0, -36, -26, 20, -26, 30, 0, 40, 0, 46, -20], 1); ctx.fill();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-10 + i * 10, -44); ctx.lineTo(-16 + i * 12, -62 - (i % 2) * 8); ctx.stroke(); }
      eye(-52, -64);
      break;
    }
    case 'cagekeeper': {
      rough(ctx, [-22, 0, -26, -80, -14, -108, 0, -116, 14, -108, 26, -80, 22, 0], 2); ctx.fill();
      ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(18, -50, 8, 0, TAU); ctx.stroke();
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(18, -42); ctx.lineTo(16 + i * 4, -26); ctx.stroke(); }
      eye(-4, -100, 2.5, C.gold); eye(6, -100, 2.5, C.gold);
      break;
    }
    case 'moth': {
      const f = Math.sin(t * 6 + (o.k || 0)) * 6;
      ctx.beginPath(); ctx.ellipse(-26, -70, 30, 22 + f, -0.4, 0, TAU); ctx.ellipse(26, -70, 30, 22 + f, 0.4, 0, TAU); ctx.fill();
      ctx.fillStyle = C.indigo; ctx.beginPath(); ctx.arc(-28, -72, 9, 0, TAU); ctx.arc(28, -72, 9, 0, TAU); ctx.fill();
      ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-28, -72, 13, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(28, -72, 13, 0, TAU); ctx.stroke();
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(0, -66, 7, 24, 0, 0, TAU); ctx.fill();
      eye(-3, -86, 2); eye(3, -86, 2);
      break;
    }
    case 'crow': {
      rough(ctx, [-34, -40, -10, -70 + breath, 18, -76 + breath, 34, -70, 50, -74, 34, -60, 26, -40, 0, -30, -20, -10, -24, 0, -14, -26], 3); ctx.fill();
      ctx.strokeStyle = C.paperD; ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-20 + i * 8, -50); ctx.lineTo(-36 + i * 8, -66); ctx.stroke(); }
      eye(24, -68, 2.5);
      break;
    }
    case 'wax': {
      ctx.fillStyle = '#d9cfb5'; ctx.fillRect(-16, -100, 32, 60);
      ctx.fillStyle = C.ink; ctx.fillRect(-22, -42, 44, 42); poly(ctx, [-30, -44, 30, -44, 22, -54, -22, -54]); ctx.fill();
      glow(ctx, 0, -108, 18, 'rgba(255,215,122,.8)'); ctx.fillStyle = C.goldL; ctx.beginPath(); ctx.ellipse(0, -110, 4, 8 + Math.sin(t * 10) * 2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d9cfb5'; ctx.beginPath(); ctx.ellipse(-12, -96, 4, 8, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(26, -60); ctx.lineTo(26, 0); ctx.stroke();
      break;
    }
    case 'bear': {
      rough(ctx, [-60, 0, -66, -60, -50, -100 + breath, -20, -118 + breath, 10, -112, 40, -96, 58, -60, 64, 0, 36, 0, 30, -30, -26, -30, -34, 0], 5); ctx.fill();
      ctx.beginPath(); ctx.arc(-34, -112 + breath, 9, 0, TAU); ctx.arc(-6, -118 + breath, 9, 0, TAU); ctx.fill();
      eye(-28, -96 + breath, 3.5); eye(-12, -98 + breath, 3.5);
      ctx.strokeStyle = C.paperD; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-30, -82); ctx.lineTo(-10, -84); ctx.stroke();
      break;
    }
    case 'bat': {
      const f = Math.sin(t * 8 + (o.k || 0)) * 10;
      ctx.beginPath(); ctx.moveTo(0, -70); ctx.lineTo(-60, -90 - f); ctx.lineTo(-48, -66); ctx.lineTo(-30, -74); ctx.lineTo(-14, -56); ctx.lineTo(0, -60);
      ctx.lineTo(14, -56); ctx.lineTo(30, -74); ctx.lineTo(48, -66); ctx.lineTo(60, -90 - f); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(-12, -60); ctx.quadraticCurveTo(0, -86, 12, -60); ctx.lineTo(16, -48); ctx.lineTo(-16, -48); ctx.fill();
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(0, -46, 3, 0, TAU); ctx.fill();
      eye(-4, -70, 2); eye(4, -70, 2);
      break;
    }
    case 'spider': {
      ctx.strokeStyle = C.ink; ctx.lineWidth = 4;
      for (let i = 0; i < 4; i++) for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, -40); ctx.quadraticCurveTo(sg * (30 + i * 8), -70 + i * 10, sg * (44 + i * 6), 0); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(0, -46, 24, 18, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = C.paperD; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-12 + i * 8, -46, 4, 2.5, 0, 0, TAU); ctx.stroke(); }
      eye(-6, -52, 2.5); eye(6, -52, 2.5);
      break;
    }
    case 'owl': {
      rough(ctx, [-30, 0, -36, -60, -26, -96, -34, -112, -12, -100, 12, -100, 34, -112, 26, -96, 36, -60, 30, 0], 6); ctx.fill();
      ctx.fillStyle = '#c9d6e6'; ctx.beginPath(); ctx.arc(0, -78, 20, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(-6, -84, 6, 10, -0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = C.ink; eye(-8, -80, 3, C.gold); eye(8, -80, 3, C.gold);
      break;
    }
    case 'stag': {
      ctx.strokeStyle = C.ink; ctx.lineWidth = 5;
      const ant = (sg) => { ctx.beginPath(); ctx.moveTo(sg * 8, -120); ctx.lineTo(sg * 30, -160); ctx.lineTo(sg * 60, -170); ctx.moveTo(sg * 22, -146); ctx.lineTo(sg * 46, -140); ctx.moveTo(sg * 36, -164); ctx.lineTo(sg * 40, -188); ctx.stroke(); };
      ant(-1); ant(1);
      rough(ctx, [-40, 0, -46, -70, -30, -100, -16, -126, 16, -126, 30, -100, 46, -70, 40, 0, 20, 0, 18, -40, -18, -40, -20, 0], 7); ctx.fill();
      ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.strokeRect(-14, -96, 28, 40); ctx.beginPath(); ctx.moveTo(0, -96); ctx.lineTo(0, -56); ctx.stroke();
      eye(-8, -114, 3.5); eye(8, -114, 3.5);
      break;
    }
    case 'belleater': {
      rough(ctx, [-70, 0, -60, -40, -64, -80 + breath, -40, -118, 0, -130, 40, -118, 64, -80 + breath, 60, -40, 70, 0], 8); ctx.fill();
      ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(-26, -70); ctx.quadraticCurveTo(0, -122, 26, -70); ctx.lineTo(32, -52); ctx.lineTo(-32, -52); ctx.fill();
      ctx.fillStyle = C.redD; ctx.beginPath(); ctx.ellipse(0, -52, 30, 10, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = C.paper; for (let i = -3; i <= 3; i++) poly(ctx, [i * 8 - 3, -52, i * 8 + 3, -52, i * 8, -44]), ctx.fill();
      ctx.fillStyle = C.ink; eye(-30, -100, 4); eye(30, -100, 4); eye(0, -112, 3);
      break;
    }
    case 'king': {
      // 大きな黒い王冠と、金の空洞の胸
      rough(ctx, [-80, 0, -70, -80, -56, -140, -30, -160, 30, -160, 56, -140, 70, -80, 80, 0], 9); ctx.fill();
      ctx.fillStyle = C.ink; poly(ctx, [-44, -160, -50, -206, -30, -182, -16, -214, 0, -186, 16, -214, 30, -182, 50, -206, 44, -160]); ctx.fill();
      ctx.fillStyle = C.gold; for (const gx of [-50, -16, 16, 50]) { ctx.beginPath(); ctx.arc(gx, -208, 4, 0, TAU); ctx.fill(); }
      glow(ctx, 0, -96, 50, 'rgba(228,169,58,.55)');
      ctx.strokeStyle = C.gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, -96, 26, 36, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#0a0606'; ctx.beginPath(); ctx.ellipse(0, -96, 20, 30, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = C.ink; eye(-16, -142, 4, C.gold); eye(16, -142, 4, C.gold);
      break;
    }
    default: break;
  }
  ctx.restore();
}
export const FOE_HEIGHT = { pup: 90, wolf: 90, cagekeeper: 120, moth: 100, crow: 85, wax: 120, bear: 125, bat: 100, spider: 70, owl: 115, stag: 190, belleater: 135, king: 215 };

// ---------- カードの絵（版画の図案） ----------
export function drawCardArt(ctx, id, w, h, t = 0) {
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  const kind = { spark: 'r', lance: 'r', rain: 'r', ember: 'r', twin: 'r', chase: 'r', armorfire: 'r', sunshard: 'r', torch: 'r', littledawn: 'r' }[id] || ({ ward: 'g', ashshield: 'g', mist: 'g', keeper: 'g', sweep: 'g', ring: 'g', bellguard: 'g' }[id] || 'b');
  bg.addColorStop(0, kind === 'r' ? '#3a1410' : kind === 'g' ? '#2e2410' : '#101a34'); bg.addColorStop(1, C.ink);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.translate(w / 2, h / 2); const k = Math.min(w, h) / 64; ctx.scale(k, k);
  const flame = (x, y, s2, col = C.red) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - 6 * s2, y + 8 * s2); ctx.quadraticCurveTo(x - 8 * s2, y - 4 * s2, x, y - 14 * s2); ctx.quadraticCurveTo(x + 8 * s2, y - 4 * s2, x + 6 * s2, y + 8 * s2); ctx.closePath(); ctx.fill(); ctx.fillStyle = C.goldL; ctx.beginPath(); ctx.ellipse(x, y + 3 * s2, 2.5 * s2, 4 * s2, 0, 0, TAU); ctx.fill(); };
  const shield = (s2, col = C.gold) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -20 * s2); ctx.lineTo(16 * s2, -12 * s2); ctx.quadraticCurveTo(14 * s2, 12 * s2, 0, 20 * s2); ctx.quadraticCurveTo(-14 * s2, 12 * s2, -16 * s2, -12 * s2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke(); };
  const card = (x, y) => { ctx.fillStyle = C.paper; ctx.fillRect(x - 6, y - 9, 12, 18); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.strokeRect(x - 6, y - 9, 12, 18); };
  switch (id) {
    case 'spark': flame(0, 4, 1.4); for (let i = 0; i < 5; i++) { ctx.fillStyle = C.goldL; ctx.fillRect(Math.cos(i * 1.3) * 18, Math.sin(i * 1.3) * 14 - 4, 2, 2); } break;
    case 'ward': shield(1); break;
    case 'kindle': ctx.strokeStyle = C.paperD; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-14 + i * 10, 14); ctx.lineTo(-6 + i * 6, -6); ctx.stroke(); } flame(4, -8, 0.8); break;
    case 'lance': ctx.strokeStyle = C.red; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-24, 16); ctx.lineTo(18, -14); ctx.stroke(); flame(20, -14, 1, C.goldL); break;
    case 'rain': for (let i = 0; i < 6; i++) flame(-20 + i * 8, -10 + (i % 2) * 12, 0.6); break;
    case 'ember': ctx.fillStyle = C.redD; ctx.beginPath(); ctx.arc(-6, 6, 10, 0, TAU); ctx.fill(); flame(-6, 0, 0.7, C.goldL); card(16, 0); break;
    case 'twin': flame(-9, 4, 1); flame(9, 4, 1); break;
    case 'chase': flame(6, 2, 1.2); ctx.strokeStyle = C.red; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-26, -8 + i * 8); ctx.lineTo(-8, -8 + i * 8); ctx.stroke(); } break;
    case 'armorfire': shield(0.8, C.paperD); flame(0, 4, 0.9); break;
    case 'ashshield': shield(1.2, '#9a8f84'); break;
    case 'mist': ctx.strokeStyle = C.paperD; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-10 + i * 10, -4 + i * 6, 10, Math.PI, 0); ctx.stroke(); } break;
    case 'sleep': for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? C.purpleL : C.paperD; ctx.beginPath(); ctx.arc(Math.cos(i) * 18, Math.sin(i * 1.7) * 14, 2, 0, TAU); ctx.fill(); } ctx.fillStyle = C.moon; ctx.beginPath(); ctx.arc(0, 0, 8, 0.6, 5.6); ctx.fill(); break;
    case 'keeper': ctx.fillStyle = C.indigo; ctx.fillRect(-12, -6, 24, 24); ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.strokeRect(-12, -6, 24, 24); flame(0, -8, 0.9, C.goldL); card(20, 8); break; // 火守り：灯籠と1枚の札
    case 'sweep': ctx.strokeStyle = C.paperD; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-18, 16); ctx.lineTo(10, -14); ctx.stroke(); for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-18, 16); ctx.lineTo(-26 + i * 4, 24); ctx.stroke(); } break;
    case 'afterglow': ctx.fillStyle = C.redD; ctx.beginPath(); ctx.ellipse(0, 10, 22, 6, 0, 0, TAU); ctx.fill(); flame(0, 2, 0.8); ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 18, -2.6, -0.5); ctx.stroke(); break;
    case 'nightwalk': ctx.fillStyle = C.moon; ctx.beginPath(); ctx.arc(10, -10, 8, 0, TAU); ctx.fill(); card(-8, 6); card(4, 10); break;
    case 'dew': ctx.fillStyle = '#9fd8e8'; ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(14, 4, 0, 14); ctx.quadraticCurveTo(-14, 4, 0, -16); ctx.fill(); break;
    case 'sunshard': ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill(); ctx.strokeStyle = C.goldL; ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(Math.cos(i * 0.785) * 17, Math.sin(i * 0.785) * 17); ctx.lineTo(Math.cos(i * 0.785) * 24, Math.sin(i * 0.785) * 24); ctx.stroke(); } break;
    case 'torch': ctx.fillStyle = C.ink2; ctx.fillRect(-3, -2, 6, 22); flame(0, -8, 1.6); break;
    case 'ring': ctx.strokeStyle = C.gold; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.stroke(); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.stroke(); break;
    case 'seedlight': glow(ctx, 0, 0, 24, 'rgba(255,215,122,.7)'); ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill(); break;
    case 'tailwind': ctx.strokeStyle = C.paper; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-24, -10 + i * 10); ctx.quadraticCurveTo(0, -18 + i * 10, 22, -8 + i * 10); ctx.stroke(); } break;
    case 'bellguard': ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(-14, 10); ctx.quadraticCurveTo(-12, -18, 0, -18); ctx.quadraticCurveTo(12, -18, 14, 10); ctx.closePath(); ctx.fill(); ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(0, 12, 3, 0, TAU); ctx.fill(); break;
    case 'littledawn': glow(ctx, 0, 6, 26, 'rgba(216,67,43,.7)'); ctx.fillStyle = C.goldL; ctx.beginPath(); ctx.arc(0, 10, 12, Math.PI, 0); ctx.fill(); break;
    default: break;
  }
  ctx.restore();
  texture(ctx, w, h, 0.8);
}

// 序幕用：光る朝の種
export function drawGlowSeed(ctx, x, y, r) {
  glow(ctx, x, y, r * 3, 'rgba(255,170,80,.55)');
  ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, TAU); ctx.fill();
  ctx.fillStyle = C.goldL; ctx.beginPath(); ctx.arc(x - r * 0.12, y - r * 0.12, r * 0.16, 0, TAU); ctx.fill();
}
