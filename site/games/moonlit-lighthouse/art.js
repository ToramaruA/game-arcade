// 灯影芝居（厚紙の切り絵）風の絵を Canvas に描く。外部素材なし。
export const COLORS = {
  red: '#ff5a4e', blue: '#4fb6ff', yellow: '#ffd23f', white: '#f4f1ff',
  gold: '#ffcf5a', navy: '#0d1b3d', ink: '#0a0c22', paper: '#efe3c8', paperDark: '#b9a888', orange: '#f2a541',
};
export const LIGHT = { red: '255,90,78', blue: '79,182,255', yellow: '255,210,63', white: '235,232,255' };

// 厚紙の影つきで塗る：fn(ctx) でパスを作る
export function paper(ctx, fn, fill, { shadow = 'rgba(0,0,0,.35)', off = 3, stroke = null, lw = 1 } = {}) {
  ctx.save();
  ctx.translate(0, off);
  ctx.beginPath(); fn(ctx); ctx.fillStyle = shadow; ctx.fill();
  ctx.restore();
  ctx.beginPath(); fn(ctx); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

export function starPath(ctx, x, y, r1, r2, n = 5, rot = -Math.PI / 2) {
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1; const a = rot + (i * Math.PI) / n;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

export function shapePath(ctx, shape, x, y, r) {
  if (shape === 'tri') { ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.95, y + r * 0.7); ctx.lineTo(x - r * 0.95, y + r * 0.7); ctx.closePath(); }
  else if (shape === 'circle') ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
  else if (shape === 'diamond') { ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.8, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.8, y); ctx.closePath(); }
  else starPath(ctx, x, y, r, r * 0.45);
}

// ───────── 背景：夜の海 ─────────
const STARS = Array.from({ length: 90 }, (_, i) => ({ x: (Math.sin(i * 91.7) * 0.5 + 0.5), y: (Math.sin(i * 37.3 + 1) * 0.5 + 0.5), r: 0.5 + ((i * 13) % 7) / 6, p: i * 0.7 }));

export function drawSky(ctx, w, h, t, sea = ['#0d1b3d', '#16306a']) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#070a1f'); g.addColorStop(0.45, sea[0]); g.addColorStop(1, sea[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (const s of STARS) {
    const a = 0.35 + 0.35 * Math.sin(t * 1.3 + s.p);
    ctx.fillStyle = `rgba(255,244,220,${a})`;
    ctx.beginPath(); ctx.arc(s.x * w, s.y * h * 0.6, s.r, 0, Math.PI * 2); ctx.fill();
  }
}

export function drawMoon(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 3.2);
  g.addColorStop(0, 'rgba(255,240,200,.35)'); g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, Math.PI * 2); ctx.fill();
  paper(ctx, (c) => c.arc(x, y, r, 0, Math.PI * 2), '#fff3d6', { off: 3, shadow: 'rgba(0,0,0,.25)' });
  ctx.fillStyle = 'rgba(210,190,150,.35)';
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.18, 0, Math.PI * 2); ctx.arc(x + r * 0.25, y + r * 0.3, r * 0.12, 0, Math.PI * 2); ctx.fill();
}

// 重ねた紙の波
export function drawWaves(ctx, x0, y0, w, h, t, layers = 4, base = [22, 48, 106]) {
  for (let i = 0; i < layers; i++) {
    const yy = y0 + (h * i) / layers;
    const k = i / layers;
    const col = `rgb(${base[0] + k * 10},${base[1] + k * 22},${base[2] + k * 30})`;
    const amp = 5 + i * 2; const len = 70 + i * 22; const sp = 0.6 + i * 0.25;
    const fn = (c) => {
      c.moveTo(x0, y0 + h + 10);
      for (let x = x0; x <= x0 + w + len; x += 12) c.lineTo(x, yy + Math.sin((x / len) * Math.PI * 2 + t * sp + i) * amp);
      c.lineTo(x0 + w, y0 + h + 10); c.closePath();
    };
    paper(ctx, fn, col, { off: -3, shadow: 'rgba(255,255,255,.08)' });
  }
}

// 小舟（窓の灯の数 lit）
export function drawBoat(ctx, x, y, s, t, lit = 0, windows = 3) {
  const bob = Math.sin(t * 1.6 + x * 0.01) * s * 0.05;
  ctx.save(); ctx.translate(x, y + bob); ctx.rotate(Math.sin(t * 1.2 + x) * 0.04);
  paper(ctx, (c) => { c.moveTo(-s, -s * 0.1); c.lineTo(s, -s * 0.1); c.lineTo(s * 0.72, s * 0.32); c.lineTo(-s * 0.75, s * 0.32); c.closePath(); }, '#3a2a4a', { off: 2 });
  paper(ctx, (c) => c.rect(-s * 0.5, -s * 0.5, s * 0.95, s * 0.42), '#efe3c8', { off: 2 });
  paper(ctx, (c) => { c.moveTo(-s * 0.05, -s * 0.5); c.lineTo(-s * 0.05, -s * 1.25); c.lineTo(s * 0.55, -s * 0.6); c.closePath(); }, '#dcd0b6', { off: 2 });
  for (let i = 0; i < windows; i++) {
    const on = i < lit;
    ctx.fillStyle = on ? '#ffc65a' : '#4b4560';
    if (on) { ctx.shadowColor = '#ffb347'; ctx.shadowBlur = s * 0.4; }
    ctx.fillRect(-s * 0.42 + i * s * 0.3, -s * 0.4, s * 0.16, s * 0.2);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

// 灯台（x, y は足元、h は高さ）
export function drawLighthouse(ctx, x, y, h, t, { beam = true, flash = 0, beamLen = 6 } = {}) {
  const w = h * 0.34;
  if (beam) {
    const a = t * 0.6;
    ctx.save(); ctx.translate(x, y - h * 0.86);
    for (const dir of [0, Math.PI]) {
      const ang = a + dir;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, h * beamLen);
      g.addColorStop(0, 'rgba(255,214,120,.42)'); g.addColorStop(1, 'rgba(255,214,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.arc(0, 0, h * beamLen, ang - 0.13, ang + 0.13); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  const glow = ctx.createRadialGradient(x, y - h * 0.86, 0, x, y - h * 0.86, h * 0.9);
  glow.addColorStop(0, `rgba(255,${200 - flash * 120},${110 - flash * 80},.75)`); glow.addColorStop(1, 'rgba(255,200,110,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y - h * 0.86, h * 0.9, 0, Math.PI * 2); ctx.fill();
  // 岩
  paper(ctx, (c) => { c.ellipse(x, y, w * 1.25, w * 0.42, 0, 0, Math.PI * 2); }, '#2d3557', { off: 3 });
  // 塔
  paper(ctx, (c) => { c.moveTo(x - w * 0.5, y); c.lineTo(x - w * 0.32, y - h * 0.75); c.lineTo(x + w * 0.32, y - h * 0.75); c.lineTo(x + w * 0.5, y); c.closePath(); }, '#f6f0e2', { off: 3 });
  ctx.save(); ctx.beginPath(); ctx.moveTo(x - w * 0.5, y); ctx.lineTo(x - w * 0.32, y - h * 0.75); ctx.lineTo(x + w * 0.32, y - h * 0.75); ctx.lineTo(x + w * 0.5, y); ctx.closePath(); ctx.clip();
  ctx.fillStyle = '#e8734a';
  for (let i = 0; i < 2; i++) ctx.fillRect(x - w, y - h * (0.18 + i * 0.27), w * 2, h * 0.1);
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x, y - h, w, h);
  ctx.restore();
  // 灯室
  paper(ctx, (c) => c.rect(x - w * 0.4, y - h * 0.82, w * 0.8, h * 0.08), '#2b2f4f', { off: 2 });
  ctx.fillStyle = flash > 0 ? '#ff8a6a' : '#ffd77a';
  ctx.shadowColor = '#ffc65a'; ctx.shadowBlur = h * 0.25;
  ctx.fillRect(x - w * 0.26, y - h * 0.93, w * 0.52, h * 0.11);
  ctx.shadowBlur = 0;
  paper(ctx, (c) => { c.moveTo(x - w * 0.4, y - h * 0.93); c.lineTo(x, y - h * 1.04); c.lineTo(x + w * 0.4, y - h * 0.93); c.closePath(); }, '#2b2f4f', { off: 2 });
}

// ───────── 影（敵）─────────
// ローカル座標：u = マスの大きさ、右向き。
function ratPath(c, u) {
  c.ellipse(0, 0, u * 0.26, u * 0.16, 0, 0, Math.PI * 2);
  c.moveTo(u * 0.3, -u * 0.02); c.arc(u * 0.24, -u * 0.04, u * 0.1, 0, Math.PI * 2);
  c.moveTo(u * 0.2, -u * 0.12); c.arc(u * 0.2, -u * 0.15, u * 0.06, 0, Math.PI * 2);
  c.moveTo(-u * 0.24, 0); c.quadraticCurveTo(-u * 0.45, -u * 0.05, -u * 0.48, -u * 0.2); c.lineTo(-u * 0.44, -u * 0.2); c.quadraticCurveTo(-u * 0.4, -u * 0.03, -u * 0.22, u * 0.04);
}
function rabbitPath(c, u) {
  c.ellipse(-u * 0.04, u * 0.02, u * 0.22, u * 0.15, 0, 0, Math.PI * 2);
  c.moveTo(u * 0.26, -u * 0.06); c.arc(u * 0.17, -u * 0.08, u * 0.1, 0, Math.PI * 2);
  c.moveTo(u * 0.15, -u * 0.14); c.ellipse(u * 0.08, -u * 0.32, u * 0.05, u * 0.18, -0.35, 0, Math.PI * 2);
  c.moveTo(u * 0.22, -u * 0.14); c.ellipse(u * 0.17, -u * 0.34, u * 0.05, u * 0.18, 0.1, 0, Math.PI * 2);
  c.moveTo(-u * 0.24, 0); c.arc(-u * 0.27, -u * 0.02, u * 0.06, 0, Math.PI * 2);
}
function turtlePath(c, u) {
  c.moveTo(-u * 0.36, u * 0.12); c.quadraticCurveTo(-u * 0.32, -u * 0.34, 0, -u * 0.34); c.quadraticCurveTo(u * 0.32, -u * 0.34, u * 0.36, u * 0.12); c.closePath();
  c.moveTo(u * 0.5, -u * 0.02); c.arc(u * 0.42, -u * 0.02, u * 0.09, 0, Math.PI * 2);
  c.rect(-u * 0.3, u * 0.1, u * 0.1, u * 0.1); c.rect(u * 0.18, u * 0.1, u * 0.1, u * 0.1);
}
function deerPath(c, u) {
  c.ellipse(-u * 0.02, 0, u * 0.3, u * 0.15, 0, 0, Math.PI * 2);
  c.rect(-u * 0.25, u * 0.08, u * 0.06, u * 0.28); c.rect(-u * 0.12, u * 0.08, u * 0.06, u * 0.28); c.rect(u * 0.12, u * 0.08, u * 0.06, u * 0.28); c.rect(u * 0.2, u * 0.08, u * 0.06, u * 0.28);
  c.moveTo(u * 0.22, -u * 0.08); c.lineTo(u * 0.36, -u * 0.34); c.lineTo(u * 0.48, -u * 0.3); c.lineTo(u * 0.34, -u * 0.02); c.closePath();
  c.moveTo(u * 0.54, -u * 0.3); c.ellipse(u * 0.46, -u * 0.3, u * 0.1, u * 0.06, 0.2, 0, Math.PI * 2);
  // 角
  const antler = (sx) => {
    c.moveTo(u * 0.4, -u * 0.36); c.lineTo(u * (0.36 + sx), -u * 0.62); c.lineTo(u * (0.3 + sx), -u * 0.66); c.lineTo(u * (0.36 + sx * 0.5), -u * 0.48);
    c.lineTo(u * (0.2 + sx), -u * 0.56); c.lineTo(u * (0.18 + sx), -u * 0.5); c.lineTo(u * 0.36, -u * 0.38); c.closePath();
  };
  antler(0); antler(0.14);
}
function mothPath(c, u, t) {
  const f = 0.75 + Math.sin(t * 14) * 0.25;
  c.ellipse(0, 0, u * 0.08, u * 0.18, Math.PI / 2, 0, Math.PI * 2);
  c.moveTo(0, 0); c.quadraticCurveTo(-u * 0.12, -u * 0.5 * f, -u * 0.32, -u * 0.38 * f); c.quadraticCurveTo(-u * 0.2, -u * 0.05, 0, 0);
  c.moveTo(0, 0); c.quadraticCurveTo(u * 0.12, -u * 0.5 * f, u * 0.3, -u * 0.36 * f); c.quadraticCurveTo(u * 0.2, -u * 0.05, 0, 0);
  c.moveTo(0, 0); c.quadraticCurveTo(-u * 0.1, u * 0.3 * f, -u * 0.22, u * 0.26 * f); c.quadraticCurveTo(-u * 0.14, u * 0.05, 0, 0);
  c.moveTo(0, 0); c.quadraticCurveTo(u * 0.1, u * 0.3 * f, u * 0.22, u * 0.26 * f); c.quadraticCurveTo(u * 0.14, u * 0.05, 0, 0);
}
function twinPath(c, u) {
  c.arc(-u * 0.12, 0, u * 0.18, 0, Math.PI * 2); c.moveTo(u * 0.32, -u * 0.02); c.arc(u * 0.14, -u * 0.02, u * 0.18, 0, Math.PI * 2);
  c.moveTo(-u * 0.2, -u * 0.14); c.lineTo(-u * 0.14, -u * 0.32); c.lineTo(-u * 0.06, -u * 0.16);
  c.moveTo(u * 0.08, -u * 0.16); c.lineTo(u * 0.14, -u * 0.34); c.lineTo(u * 0.22, -u * 0.18);
}
function fishPath(c, u) {
  c.moveTo(u * 0.34, 0); c.quadraticCurveTo(u * 0.1, -u * 0.24, -u * 0.18, -u * 0.04); c.lineTo(-u * 0.36, -u * 0.18); c.lineTo(-u * 0.32, 0); c.lineTo(-u * 0.36, u * 0.18); c.lineTo(-u * 0.18, u * 0.04); c.quadraticCurveTo(u * 0.1, u * 0.24, u * 0.34, 0);
  c.moveTo(u * 0.16, -u * 0.14); c.quadraticCurveTo(u * 0.3, -u * 0.42, u * 0.44, -u * 0.3); c.lineTo(u * 0.42, -u * 0.27); c.quadraticCurveTo(u * 0.3, -u * 0.36, u * 0.2, -u * 0.12);
}
function owlPath(c, u) {
  c.ellipse(0, 0, u * 0.2, u * 0.26, 0, 0, Math.PI * 2);
  c.moveTo(-u * 0.16, -u * 0.16); c.lineTo(-u * 0.2, -u * 0.38); c.lineTo(-u * 0.04, -u * 0.22); c.closePath();
  c.moveTo(u * 0.16, -u * 0.16); c.lineTo(u * 0.2, -u * 0.38); c.lineTo(u * 0.04, -u * 0.22); c.closePath();
  c.moveTo(-u * 0.2, 0); c.quadraticCurveTo(-u * 0.42, u * 0.06, -u * 0.3, u * 0.24); c.lineTo(-u * 0.12, u * 0.12);
  c.moveTo(u * 0.2, 0); c.quadraticCurveTo(u * 0.42, u * 0.06, u * 0.3, u * 0.24); c.lineTo(u * 0.12, u * 0.12);
}
function kingTurtlePath(c, u) {
  c.moveTo(-u * 0.8, u * 0.2); c.quadraticCurveTo(-u * 0.75, -u * 0.75, 0, -u * 0.72); c.quadraticCurveTo(u * 0.75, -u * 0.75, u * 0.8, u * 0.2); c.closePath();
  for (let i = -2; i <= 2; i++) { c.moveTo(i * u * 0.25 - u * 0.08, -u * 0.6 + Math.abs(i) * u * 0.08); c.lineTo(i * u * 0.25, -u * 0.85 + Math.abs(i) * u * 0.1); c.lineTo(i * u * 0.25 + u * 0.08, -u * 0.6 + Math.abs(i) * u * 0.08); }
  c.moveTo(u * 1.05, -u * 0.05); c.ellipse(u * 0.92, -u * 0.05, u * 0.18, u * 0.14, 0, 0, Math.PI * 2);
  c.rect(-u * 0.62, u * 0.16, u * 0.2, u * 0.18); c.rect(u * 0.4, u * 0.16, u * 0.2, u * 0.18);
}
function lordPath(c, u, t) {
  const f = Math.sin(t * 2) * u * 0.05;
  c.moveTo(0, -u * 1.1); c.quadraticCurveTo(u * 0.5, -u * 1.0, u * 0.55, -u * 0.4);
  c.quadraticCurveTo(u * 0.9 + f, u * 0.1, u * 0.85, u * 0.45);
  for (let i = 0; i < 7; i++) { const x = u * 0.85 - (i + 1) * u * 0.243; c.lineTo(x + u * 0.12, u * (0.3 + (i % 2) * 0.12)); c.lineTo(x, u * 0.45); }
  c.quadraticCurveTo(-u * 0.9 - f, u * 0.1, -u * 0.55, -u * 0.4); c.quadraticCurveTo(-u * 0.5, -u * 1.0, 0, -u * 1.1);
  c.moveTo(-u * 0.3, -u * 1.05); c.lineTo(-u * 0.55, -u * 1.45); c.lineTo(-u * 0.15, -u * 1.12);
  c.moveTo(u * 0.3, -u * 1.05); c.lineTo(u * 0.55, -u * 1.45); c.lineTo(u * 0.15, -u * 1.12);
}

const SHAPES = {
  rat: { fn: ratPath, k: 1 }, mini: { fn: ratPath, k: 0.7 }, rabbit: { fn: rabbitPath, k: 1 }, turtle: { fn: turtlePath, k: 1.05 },
  deer: { fn: deerPath, k: 1.1 }, moth: { fn: mothPath, k: 1, fly: true }, twin: { fn: twinPath, k: 1 }, fish: { fn: fishPath, k: 1, fly: true },
  owl: { fn: owlPath, k: 1, fly: true }, kingdeer: { fn: deerPath, k: 2.2 }, kingturtle: { fn: kingTurtlePath, k: 1.15 }, lord: { fn: lordPath, k: 1.25 },
};

// 影を描く。hpFrac で輪郭が欠ける。
export function drawShadowBeast(ctx, type, x, y, u, { t = 0, face = 1, hpFrac = 1, flash = 0, stun = 0, armorOff = false, shell = false, phase = 1, alpha = 1 } = {}) {
  const sh = SHAPES[type] || SHAPES.rat;
  const s = u * sh.k;
  const hop = type === 'rabbit' || type === 'mini' ? Math.abs(Math.sin(t * 9 + x)) * u * 0.08 : sh.fly ? Math.sin(t * 4 + x) * u * 0.05 : 0;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y - hop - (sh.fly ? u * 0.08 : 0));
  if (face < 0) ctx.scale(-1, 1);
  // 地面の影
  ctx.fillStyle = 'rgba(0,0,10,.35)';
  ctx.beginPath(); ctx.ellipse(0, s * 0.34 + hop, s * 0.32, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
  if (type === 'lord' && phase === 2) {
    // 剥がれた影の下に先代灯台の輪郭
    ctx.strokeStyle = 'rgba(255,230,170,.75)'; ctx.lineWidth = Math.max(1.5, u * 0.05);
    ctx.beginPath(); ctx.moveTo(-s * 0.2, s * 0.4); ctx.lineTo(-s * 0.12, -s * 0.9); ctx.lineTo(s * 0.12, -s * 0.9); ctx.lineTo(s * 0.2, s * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.rect(-s * 0.14, -s * 1.08, s * 0.28, s * 0.16); ctx.stroke();
  }
  const fill = type === 'lord' ? (phase === 2 ? 'rgba(14,16,44,.78)' : '#0b0d26') : '#10132e';
  ctx.beginPath(); sh.fn(ctx, s, t);
  ctx.fillStyle = fill; ctx.fill();
  // 縁の光：欠け具合で輪郭が途切れる
  const rim = flash > 0 ? 'rgba(255,255,255,.95)' : armorOff ? 'rgba(255,220,90,.9)' : 'rgba(255,190,120,.6)';
  ctx.strokeStyle = rim; ctx.lineWidth = Math.max(1, u * 0.035);
  const seg = Math.max(2, u * 0.25);
  if (hpFrac < 0.999) ctx.setLineDash([seg * Math.max(0.15, hpFrac), seg * (1 - Math.max(0.15, hpFrac)) + 1]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (shell) { ctx.strokeStyle = 'rgba(160,200,255,.9)'; ctx.lineWidth = Math.max(2, u * 0.07); ctx.stroke(); }
  // 目の代わりの小さな光点（顔は描かない）
  if (type === 'fish') { ctx.fillStyle = '#9ff7ff'; ctx.shadowColor = '#9ff7ff'; ctx.shadowBlur = 6; ctx.beginPath(); ctx.arc(s * 0.44, -s * 0.3, s * 0.06, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }
  if (type === 'owl') { ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.arc(0, s * 0.3, s * 0.07, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  if (stun > 0) {
    ctx.save(); ctx.translate(x, y - s * 0.55);
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i * Math.PI * 2) / 3;
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); starPath(ctx, Math.cos(a) * s * 0.25, Math.sin(a) * s * 0.08, s * 0.07, s * 0.03); ctx.fill();
    }
    ctx.restore();
  }
}

// 図鑑・予告用の小さなアイコン
export function drawEnemyIcon(ctx, type, x, y, size, t = 0, seen = true) {
  const k = { kingdeer: 0.45, kingturtle: 0.5, lord: 0.45 }[type] || 1;
  if (!seen) {
    ctx.save(); ctx.globalAlpha = 0.5;
    drawShadowBeast(ctx, type, x, y + size * 0.1, size * k, { t: 0 });
    ctx.restore();
    return;
  }
  drawShadowBeast(ctx, type, x, y + size * 0.1, size * k, { t });
}

// ───────── 灯守 ─────────
export function drawKeeper(ctx, x, y, u, color, t, { moving = false, ready = true } = {}) {
  const bob = moving ? Math.abs(Math.sin(t * 12)) * u * 0.06 : Math.sin(t * 2) * u * 0.02;
  ctx.save(); ctx.translate(x, y - bob);
  ctx.fillStyle = 'rgba(0,0,10,.35)'; ctx.beginPath(); ctx.ellipse(0, u * 0.3 + bob, u * 0.2, u * 0.06, 0, 0, Math.PI * 2); ctx.fill();
  // ランタンの光
  const g = ctx.createRadialGradient(u * 0.2, -u * 0.05, 0, u * 0.2, -u * 0.05, u * (ready ? 0.7 : 0.4));
  g.addColorStop(0, 'rgba(255,214,120,.65)'); g.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(u * 0.2, -u * 0.05, u * 0.7, 0, Math.PI * 2); ctx.fill();
  // 外套
  paper(ctx, (c) => { c.moveTo(0, -u * 0.34); c.quadraticCurveTo(u * 0.2, -u * 0.1, u * 0.18, u * 0.3); c.lineTo(-u * 0.18, u * 0.3); c.quadraticCurveTo(-u * 0.2, -u * 0.1, 0, -u * 0.34); }, color, { off: 2 });
  // 頭巾
  paper(ctx, (c) => c.arc(0, -u * 0.32, u * 0.11, 0, Math.PI * 2), '#f3e6c8', { off: 1 });
  paper(ctx, (c) => { c.arc(0, -u * 0.34, u * 0.13, Math.PI, 0); c.lineTo(u * 0.06, -u * 0.5); c.closePath(); }, color, { off: 1 });
  // ランタン
  ctx.strokeStyle = '#3b2b1a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(u * 0.12, -u * 0.08); ctx.lineTo(u * 0.22, -u * 0.12); ctx.stroke();
  ctx.fillStyle = ready ? '#ffd77a' : '#a08a5a'; ctx.shadowColor = '#ffc65a'; ctx.shadowBlur = ready ? 10 : 0;
  ctx.fillRect(u * 0.16, -u * 0.1, u * 0.1, u * 0.12); ctx.shadowBlur = 0;
  ctx.restore();
}

// 鹿の影（タイトル用、大きく）
export function drawBigDeer(ctx, x, y, u, t) {
  drawShadowBeast(ctx, 'kingdeer', x, y, u, { t, face: -1 });
}

// 金の網目パターン
export function meshPattern(ctx, size) {
  const c = document.createElement('canvas');
  const n = Math.max(6, Math.round(size));
  c.width = n; c.height = n;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,214,90,.85)'; g.lineWidth = Math.max(1, n / 9);
  g.beginPath(); g.moveTo(0, 0); g.lineTo(n, n); g.moveTo(n, 0); g.lineTo(0, n); g.stroke();
  return ctx.createPattern(c, 'repeat');
}
