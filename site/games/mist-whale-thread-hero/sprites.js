// 主人公と鐘の絵（切り絵の重なり＋手描きの線）。すべて Canvas のパス。
const INK = '#26173f';

// 切り絵の1枚：影（ずらした暗い紙）→ 紙の色 → 手描きの線
function paper(ctx, build, fill, { shadow = 'rgba(16,6,36,.38)', off = 1.6, line = 1.3, ink = INK, noLine = false } = {}) {
  if (shadow) { ctx.save(); ctx.translate(off, off); ctx.beginPath(); build(); ctx.fillStyle = shadow; ctx.fill(); ctx.restore(); }
  ctx.beginPath(); build(); ctx.fillStyle = fill; ctx.fill();
  if (!noLine) { ctx.lineWidth = line; ctx.strokeStyle = ink; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
}
function starPath(ctx, x, y, R, r, rot = 0) {
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + rot + i * Math.PI / 5; const rr = i % 2 ? r : R; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath();
}
function sparkle(ctx, x, y, s, a = 1) {
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = '#fffbe6';
  ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill();
  ctx.restore();
}

// ───────────────────────── 鐘の形 ─────────────────────────
// 中心 (0,0)、高さ h。上に吊り輪、下に広がった口と舌。
function bellBody(ctx, w, h) {
  const top = -h * 0.5; const lip = h * 0.38;
  ctx.moveTo(-w * 0.2, top + h * 0.06);
  ctx.bezierCurveTo(-w * 0.24, top - h * 0.02, w * 0.24, top - h * 0.02, w * 0.2, top + h * 0.06);
  ctx.bezierCurveTo(w * 0.34, top + h * 0.14, w * 0.3, lip - h * 0.34, w * 0.36, lip - h * 0.08);
  ctx.quadraticCurveTo(w * 0.42, lip + h * 0.02, w * 0.52, lip + h * 0.04);
  ctx.quadraticCurveTo(0, lip + h * 0.16, -w * 0.52, lip + h * 0.04);
  ctx.quadraticCurveTo(-w * 0.42, lip + h * 0.02, -w * 0.36, lip - h * 0.08);
  ctx.bezierCurveTo(-w * 0.3, lip - h * 0.34, -w * 0.34, top + h * 0.14, -w * 0.2, top + h * 0.06);
  ctx.closePath();
}

export function drawBell(ctx, x, y, size, t, o = {}) {
  // o: lit, swing, color('gold'|'clock'|'pale'), cord(true), dim
  const w = size; const h = size * 1.05;
  const lit = !!o.lit;
  ctx.save(); ctx.translate(x, y);
  // 後光
  const glowR = size * (lit ? 1.5 : 1.0);
  const gl = ctx.createRadialGradient(0, 0, size * 0.1, 0, 0, glowR);
  gl.addColorStop(0, lit ? 'rgba(255,236,160,.75)' : 'rgba(255,215,120,.32)'); gl.addColorStop(1, 'rgba(255,215,120,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, glowR, 0, Math.PI * 2); ctx.fill();
  if (lit) {
    ctx.save(); ctx.rotate(t * 0.4); ctx.fillStyle = 'rgba(255,240,180,.22)';
    for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(-size * 0.06, 0); ctx.lineTo(0, -size * 1.45); ctx.lineTo(size * 0.06, 0); ctx.fill(); }
    ctx.restore();
  }
  ctx.rotate(o.swing ? Math.sin(t * 9) * 0.32 * o.swing : Math.sin(t * 1.6 + x * 0.01) * 0.04);
  // 吊り紐（赤い組紐）
  if (o.cord !== false) {
    ctx.strokeStyle = '#7a1424'; ctx.lineWidth = size * 0.07; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -h * 0.62); ctx.lineTo(0, -h * 1.0); ctx.stroke();
    ctx.strokeStyle = '#d8344a'; ctx.lineWidth = size * 0.045; ctx.stroke();
  }
  // 吊り輪
  ctx.strokeStyle = INK; ctx.lineWidth = size * 0.1;
  ctx.beginPath(); ctx.arc(0, -h * 0.56, size * 0.1, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = o.color === 'clock' ? '#d9c8ff' : '#e9b949'; ctx.lineWidth = size * 0.06; ctx.stroke();
  // 舌（中の玉）
  paper(ctx, () => ctx.arc(size * 0.02, h * 0.5, size * 0.1, 0, Math.PI * 2), '#8a5a18', { off: 1, line: 1 });
  // 胴：金属の陰影
  const g = ctx.createLinearGradient(-w * 0.5, 0, w * 0.5, 0);
  if (o.color === 'clock') { g.addColorStop(0, '#f4ecff'); g.addColorStop(0.35, '#c9b2ff'); g.addColorStop(0.8, '#8a6ad6'); g.addColorStop(1, '#5a3fa8'); }
  else if (lit) { g.addColorStop(0, '#fffbe0'); g.addColorStop(0.3, '#ffe68a'); g.addColorStop(0.75, '#f2b63c'); g.addColorStop(1, '#b77a16'); }
  else { g.addColorStop(0, '#ffeeb0'); g.addColorStop(0.3, '#f2c552'); g.addColorStop(0.75, '#c98a22'); g.addColorStop(1, '#7e5210'); }
  paper(ctx, () => bellBody(ctx, w, h), g, { off: size * 0.06, line: Math.max(1.2, size * 0.045) });
  // 口の内側
  ctx.fillStyle = o.color === 'clock' ? '#3a2a6a' : '#5a3608';
  ctx.beginPath(); ctx.ellipse(0, h * 0.42, w * 0.44, h * 0.06, 0, 0, Math.PI); ctx.fill();
  // 飾り帯と刻まれた星
  ctx.strokeStyle = o.color === 'clock' ? 'rgba(60,30,120,.6)' : 'rgba(110,64,10,.65)'; ctx.lineWidth = Math.max(1, size * 0.035);
  ctx.beginPath(); ctx.moveTo(-w * 0.35, h * 0.24); ctx.quadraticCurveTo(0, h * 0.31, w * 0.35, h * 0.24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-w * 0.3, h * 0.31); ctx.quadraticCurveTo(0, h * 0.38, w * 0.3, h * 0.31); ctx.stroke();
  // ハイライト
  ctx.strokeStyle = 'rgba(255,255,240,.85)'; ctx.lineWidth = Math.max(1.2, size * 0.06);
  ctx.beginPath(); ctx.moveTo(-w * 0.17, -h * 0.36); ctx.bezierCurveTo(-w * 0.27, -h * 0.2, -w * 0.25, h * 0.0, -w * 0.29, h * 0.17); ctx.stroke();
  if (o.color === 'clock') {
    paper(ctx, () => ctx.arc(0, -h * 0.06, size * 0.2, 0, Math.PI * 2), '#fffaf0', { off: 1, line: 1.2 });
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; const a = t * 2;
    ctx.beginPath(); ctx.moveTo(0, -h * 0.06); ctx.lineTo(0, -h * 0.06 - size * 0.14); ctx.moveTo(0, -h * 0.06); ctx.lineTo(Math.cos(a) * size * 0.12, -h * 0.06 + Math.sin(a) * size * 0.12); ctx.stroke();
    for (let i = 0; i < 4; i++) { const b = i * Math.PI / 2; ctx.fillStyle = INK; ctx.fillRect(Math.cos(b) * size * 0.16 - 0.8, -h * 0.06 + Math.sin(b) * size * 0.16 - 0.8, 1.6, 1.6); }
  } else {
    ctx.fillStyle = lit ? '#fffdf0' : 'rgba(255,248,214,.95)';
    ctx.beginPath(); starPath(ctx, 0, -h * 0.06, size * 0.17, size * 0.075); ctx.fill();
    ctx.strokeStyle = 'rgba(110,64,10,.6)'; ctx.lineWidth = 1; ctx.stroke();
  }
  // 房（タッセル）
  if (o.tassel) {
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(s * w * 0.54, h * 0.42); ctx.rotate(Math.sin(t * 2 + s) * 0.15);
      ctx.strokeStyle = '#d8344a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, size * 0.25); ctx.stroke();
      paper(ctx, () => { ctx.moveTo(-size * 0.07, size * 0.25); ctx.lineTo(size * 0.07, size * 0.25); ctx.lineTo(size * 0.1, size * 0.5); ctx.lineTo(-size * 0.1, size * 0.5); ctx.closePath(); }, '#e2404f', { off: 1, line: 1 });
      ctx.fillStyle = '#f2c552'; ctx.fillRect(-size * 0.08, size * 0.25, size * 0.16, size * 0.05);
      ctx.restore();
    }
  }
  ctx.restore();
  if (lit) { sparkle(ctx, x + size * 0.6, y - size * 0.55, size * 0.16, 0.5 + 0.5 * Math.sin(t * 5)); sparkle(ctx, x - size * 0.62, y + size * 0.1, size * 0.11, 0.5 + 0.5 * Math.cos(t * 4)); }
}

// 拾う星鈴：小さな鈴に星の芯、回る光の粒
export function drawStarBell(ctx, x, y, s, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  for (let i = 0; i < 3; i++) {
    const a = t * 2 + i * 2.1; sparkle(ctx, Math.cos(a) * 17, Math.sin(a) * 9 - 2, 3.2, 0.55 + 0.45 * Math.sin(t * 6 + i));
  }
  ctx.rotate(Math.sin(t * 3) * 0.14);
  drawBell(ctx, 0, 0, 22, t, { lit: true, cord: false });
  ctx.restore();
}

// 大鐘：三日月の吊り具から下がる
export function drawGreatBell(ctx, b, t, st) {
  const clock = b.clock; const lit = clock ? b.ring > 0 : b.rung;
  ctx.save(); ctx.translate(b.x, b.y);
  // 三日月の吊り具
  ctx.save(); ctx.translate(0, -44);
  paper(ctx, () => { ctx.arc(0, 0, 22, Math.PI * 0.15, Math.PI * 0.85); ctx.arc(0, -7, 19, Math.PI * 0.8, Math.PI * 0.2, true); ctx.closePath(); }, clock ? '#d9c8ff' : '#f7e6b0', { off: 1.5, line: 1.4 });
  ctx.fillStyle = '#ffd76a'; ctx.beginPath(); starPath(ctx, 0, 12, 4, 1.8); ctx.fill();
  ctx.restore();
  // 吊り紐（左右に流れる組紐）
  ctx.strokeStyle = '#c8304a'; ctx.lineWidth = 2;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 18, -36); ctx.quadraticCurveTo(s * 40, -24 + Math.sin(t * 1.5 + s) * 4, s * 44, -2 + Math.sin(t * 1.5 + s) * 5); ctx.stroke(); }
  ctx.restore();
  drawBell(ctx, b.x, b.y, 40, t, { lit, swing: b.swing || 0, color: clock ? 'clock' : 'gold', tassel: true });
  if (clock && b.ring > 0) {
    ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(b.x, b.y - 2, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (b.ring / 6)); ctx.stroke();
  }
  void st;
}

// レバー：柄の先に小さな鈴
export function drawBellLever(ctx, l, t) {
  ctx.save(); ctx.translate(l.x, l.y);
  if (!l.on) { const g = ctx.createRadialGradient(0, -10, 2, 0, -10, 24); g.addColorStop(0, `rgba(255,215,106,${0.45 + 0.2 * Math.sin(t * 4)})`); g.addColorStop(1, 'rgba(255,215,106,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -10, 24, 0, Math.PI * 2); ctx.fill(); }
  // 台座
  paper(ctx, () => { ctx.moveTo(-11, 20); ctx.quadraticCurveTo(-10, 10, 0, 9); ctx.quadraticCurveTo(10, 10, 11, 20); ctx.closePath(); }, '#6a4a7a', { off: 1.2 });
  ctx.save(); ctx.translate(0, 12); ctx.rotate(l.on ? 0.95 : -0.55);
  paper(ctx, () => { ctx.rect(-2, -24, 4, 24); }, '#b98a3a', { off: 1, line: 1.1 });
  ctx.restore();
  const a = l.on ? 0.95 : -0.55;
  drawBell(ctx, Math.sin(a) * 24, 12 - Math.cos(a) * 24 - 4, 15, t, { lit: l.on, cord: false, swing: l.on ? 0.4 : 0 });
  ctx.restore();
}

// 鈴スイッチ：3マスの鳥居型の枠に吊った鈴
export function drawSwitchBell(ctx, sw, t) {
  const x = sw.x; const base = sw.y;
  ctx.save();
  ctx.globalAlpha = sw.on ? 1 : 0.9;
  // 柱と笠木
  for (const s of [-1, 1]) paper(ctx, () => ctx.rect(x + s * 17 - 2.5, base - 108, 5, 108), sw.on ? '#e8b440' : '#7a5aa0', { off: 1.2, line: 1.1 });
  paper(ctx, () => { ctx.moveTo(x - 26, base - 112); ctx.quadraticCurveTo(x, base - 104, x + 26, base - 112); ctx.lineTo(x + 24, base - 104); ctx.quadraticCurveTo(x, base - 98, x - 24, base - 104); ctx.closePath(); }, sw.on ? '#ffd76a' : '#9a7ac8', { off: 1.2, line: 1.1 });
  // 通り道の目印（点線）
  if (!sw.on) { ctx.strokeStyle = 'rgba(255,215,106,.55)'; ctx.setLineDash([3, 5]); ctx.lineWidth = 1.5; ctx.strokeRect(x - 13, base - 96, 26, 92); ctx.setLineDash([]); }
  ctx.restore();
  drawBell(ctx, x, base - 70, 22, t, { lit: sw.on, swing: sw.on ? 1 : 0.15 });
}

// 金のフック：星形の吊り金具と輪
export function drawStarHook(ctx, h, t) {
  const pale = h.fading;
  ctx.save(); ctx.translate(h.x, h.y);
  const a = h.fading && h.fade > 0 ? Math.max(0.2, h.fade / 2.2) : 1;
  ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
  g.addColorStop(0, pale ? 'rgba(190,225,255,.75)' : 'rgba(255,220,120,.75)'); g.addColorStop(1, 'rgba(255,215,106,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(Math.sin(t * 1.5 + h.x) * 0.12);
  const sg = ctx.createLinearGradient(-12, -12, 12, 12);
  if (pale) { sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, '#8cb8ec'); } else { sg.addColorStop(0, '#fff2b0'); sg.addColorStop(0.5, '#f2c552'); sg.addColorStop(1, '#b07a16'); }
  paper(ctx, () => starPath(ctx, 0, -2, 13, 5.5), sg, { off: 1.5, line: 1.3 });
  // 輪
  ctx.strokeStyle = INK; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.arc(0, 12, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = pale ? '#dff0ff' : '#ffe08a'; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.restore();
  sparkle(ctx, h.x + 11, h.y - 13, 3, (0.5 + 0.5 * Math.sin(t * 4 + h.x)) * a);
}

// ───────────────────────── ミオ ─────────────────────────
const C = {
  hair: '#2b2150', hairHi: '#4f3f8a', skin: '#ffe7d4', skinSh: '#f2c3a8', coat: '#fbf5ea', coatSh: '#ddd0e8', trim: '#e8b440',
  scarf: '#e0313f', scarfSh: '#9c1828', tights: '#2c2a5a', boot: '#7a3f2a', bootHi: '#a35a3a',
};

function scarfTail(ctx, t, wind, up) {
  const len = 30 + wind * 18;
  const pts = []; const pts2 = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    const wave = Math.sin(t * 9 - u * 5.5) * (2 + u * 6 * wind);
    const y = -45 + wave + u * (up ? 9 : 3);
    pts.push([-5 - u * len, y - 3.6 + u * 0.8]); pts2.push([-5 - u * len, y + 3.6 + u * 1.2]);
  }
  return { pts, pts2, len };
}

export function drawMio(ctx, p, t, opts = {}) {
  const x = p.x + p.w / 2; const foot = p.y + p.h;
  const s = opts.scale || 1;
  const face = p.face || 1;
  const run = Math.abs(p.vx) > 20 && p.onGround;
  const air = !p.onGround;
  const ph = p.anim * 0.055;
  const rising = air && p.vy < 0;
  ctx.save(); ctx.translate(x, foot); ctx.scale(face * s, s);
  if (p.invuln > 0 && !opts.og && Math.floor(t * 16) % 2) ctx.globalAlpha = 0.5;
  const sq = p.landed > 0 ? 1 - p.landed * 0.9 : 1;
  ctx.scale(sq < 1 ? 1 + (1 - sq) * 0.6 : 1, sq);
  const bob = run ? -Math.abs(Math.sin(ph)) * 2.2 : air ? 0 : Math.sin(t * 2.2) * 0.6;
  const lean = run ? 0.1 : air ? 0.05 : 0;
  // 影
  if (p.onGround) { ctx.fillStyle = 'rgba(10,4,26,.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 15, 3.5, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.translate(0, bob); ctx.rotate(lean);
  const wind = air ? 1.4 : run ? 1 : 0.35;

  // マフラーのしっぽ（後ろ）
  const { pts, pts2, len } = scarfTail(ctx, t, wind, rising);
  paper(ctx, () => { ctx.moveTo(-2, -48); pts.forEach(([a, b]) => ctx.lineTo(a, b)); for (let i = pts2.length - 1; i >= 0; i--) ctx.lineTo(pts2[i][0], pts2[i][1]); ctx.lineTo(-2, -40); ctx.closePath(); }, C.scarf, { line: 1.3 });
  // 金の刺繍
  ctx.strokeStyle = 'rgba(255,215,106,.9)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
  ctx.beginPath(); pts.forEach(([a, b], i) => { const y = (b + pts2[i][1]) / 2; if (i === 0) ctx.moveTo(a, y); else ctx.lineTo(a, y); }); ctx.stroke(); ctx.setLineDash([]);
  // 房
  const [ex, ey] = pts[pts.length - 1]; const ey2 = pts2[pts2.length - 1][1];
  ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) { const yy = ey + (ey2 - ey) * (i / 3); ctx.beginPath(); ctx.moveTo(ex, yy); ctx.lineTo(ex - 5 - Math.sin(t * 10 + i) * 1.5, yy + 1 + i * 0.4); ctx.stroke(); }
  void len;

  // 脚
  const l1 = air ? (rising ? -0.75 : -0.35) : run ? Math.sin(ph) * 0.85 : 0.1;
  const l2 = air ? (rising ? 0.5 : 0.25) : run ? -Math.sin(ph) * 0.85 : -0.12;
  const leg = (a, back) => {
    const kx = Math.sin(a) * 8; const ky = -17 + Math.cos(a) * 8;
    const bend = air ? 0.9 : run ? Math.max(0, -Math.cos(ph + (back ? Math.PI : 0))) * 0.9 : 0.05;
    const fx = kx + Math.sin(a - bend) * 9; const fy = ky + Math.cos(a - bend) * 9;
    ctx.strokeStyle = INK; ctx.lineWidth = 6.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.strokeStyle = back ? '#1d1b40' : C.tights; ctx.lineWidth = 4.2; ctx.stroke();
    // ブーツ
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(a * 0.4);
    paper(ctx, () => { ctx.moveTo(-3.5, -5); ctx.lineTo(3, -5); ctx.quadraticCurveTo(8.5, -1, 8, 2); ctx.lineTo(-4, 2); ctx.closePath(); }, back ? '#5a2c1e' : C.boot, { off: 1, line: 1.1 });
    ctx.fillStyle = C.bootHi; ctx.fillRect(-3.5, -5, 6.5, 1.6);
    ctx.restore();
  };
  leg(l2, true);

  // 奥の腕
  const swing = run ? Math.sin(ph) * 0.9 : air ? -0.6 : 0.15;
  const arm = (a, back, reach) => {
    const sx = back ? -3 : 3; const sy = -38;
    let hx; let hy;
    if (reach) { hx = 17; hy = -52; } else { hx = sx + Math.sin(a) * 11; hy = sy + Math.cos(a) * 11; }
    ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = back ? C.coatSh : C.coat; ctx.lineWidth = 3.8; ctx.stroke();
    ctx.fillStyle = C.trim; ctx.beginPath(); ctx.arc(sx + (hx - sx) * 0.82, sy + (hy - sy) * 0.82, 2.2, 0, Math.PI * 2); ctx.fill();
    paper(ctx, () => ctx.arc(hx, hy, 2.6, 0, Math.PI * 2), C.skin, { off: 0.8, line: 1 });
    return [hx, hy];
  };
  arm(-swing, true, false);

  // コート（裾が広がる切り絵）
  const flare = air ? 2.5 : run ? 1.2 : 0;
  paper(ctx, () => {
    ctx.moveTo(-8, -43); ctx.quadraticCurveTo(0, -46, 8, -43);
    ctx.quadraticCurveTo(11, -32, 13 + flare * 0.5, -17);
    // 波形の裾
    for (let i = 0; i <= 4; i++) { const xx = 13 + flare * 0.5 - i * (26 + flare) / 4; ctx.quadraticCurveTo(xx + 3, -13.5, xx - (26 + flare) / 8, -16 + (i % 2) * 1.2); }
    ctx.lineTo(-13 - flare * 0.5, -17); ctx.quadraticCurveTo(-11, -32, -8, -43); ctx.closePath();
  }, C.coat, { line: 1.4 });
  // 背中側の陰
  ctx.fillStyle = C.coatSh;
  ctx.beginPath(); ctx.moveTo(-8, -42); ctx.quadraticCurveTo(-11, -31, -12.5 - flare * 0.5, -17); ctx.lineTo(-5, -17); ctx.quadraticCurveTo(-5, -30, -4, -42); ctx.closePath(); ctx.fill();
  // 金の縁取りと前合わせ
  ctx.strokeStyle = C.trim; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-12.5 - flare * 0.5, -18.5); ctx.lineTo(12.5 + flare * 0.5, -18.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, -41); ctx.quadraticCurveTo(6, -30, 5, -19); ctx.stroke();
  ctx.fillStyle = C.trim; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(5.6, -36 + i * 6, 1.1, 0, Math.PI * 2); ctx.fill(); }
  // 帯と糸巻き
  paper(ctx, () => ctx.rect(-11, -27.5, 22, 3.6), '#4a2f6e', { off: 0.8, line: 1 });
  ctx.save(); ctx.translate(-9, -22);
  paper(ctx, () => ctx.rect(-3.6, -3.5, 7.2, 7), '#b98a3a', { off: 0.8, line: 1 });
  ctx.fillStyle = opts.color || '#ffd76a'; ctx.fillRect(-2.6, -2, 5.2, 4);
  ctx.strokeStyle = 'rgba(80,40,0,.5)'; ctx.lineWidth = 0.6; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-2.6, i * 1.2); ctx.lineTo(2.6, i * 1.2 + 0.4); ctx.stroke(); }
  ctx.restore();

  leg(l1, false);

  // マフラー（首まわり）
  paper(ctx, () => { ctx.moveTo(-10, -45); ctx.quadraticCurveTo(-11, -51, -2, -51.5); ctx.quadraticCurveTo(9, -51.5, 10.5, -46); ctx.quadraticCurveTo(10, -41.5, 0, -41); ctx.quadraticCurveTo(-9, -41, -10, -45); ctx.closePath(); }, C.scarf, { line: 1.4 });
  ctx.strokeStyle = C.scarfSh; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(-7, -44); ctx.quadraticCurveTo(0, -42.5, 8, -44.5); ctx.stroke();
  // 前に垂れる端
  paper(ctx, () => { ctx.moveTo(4, -44); ctx.quadraticCurveTo(8 + Math.sin(t * 5) * 1, -37, 6.5, -31); ctx.lineTo(2, -32); ctx.quadraticCurveTo(3.5, -38, 1, -43); ctx.closePath(); }, C.scarf, { off: 1, line: 1.1 });
  ctx.fillStyle = '#ffd76a'; ctx.beginPath(); starPath(ctx, 4.4, -34.5, 2.2, 1); ctx.fill();

  // 頭
  ctx.save(); ctx.translate(1.5, -59);
  const tilt = run ? Math.sin(ph * 2) * 0.03 : air ? (rising ? -0.08 : 0.06) : 0;
  ctx.rotate(tilt);
  // 後ろ髪
  paper(ctx, () => { ctx.moveTo(-12.5, -3); ctx.bezierCurveTo(-15, -14, -6, -19, 2, -18.5); ctx.bezierCurveTo(11, -18, 15, -11, 14, -3); ctx.quadraticCurveTo(13, 6, 9, 9); ctx.lineTo(-6, 10); ctx.quadraticCurveTo(-11 - wind * 2, 10 + Math.sin(t * 7) * 1, -14 - wind * 3, 8 + Math.sin(t * 7)); ctx.quadraticCurveTo(-12, 3, -12.5, -3); ctx.closePath(); }, C.hair, { line: 1.4 });
  // 顔
  paper(ctx, () => { ctx.moveTo(-3, -10); ctx.bezierCurveTo(7, -13, 13, -7, 12.5, 0); ctx.bezierCurveTo(12, 6, 8, 9.5, 3, 9.5); ctx.bezierCurveTo(-2, 9.5, -4, 6, -4, 1); ctx.closePath(); }, C.skin, { off: 1, line: 1.3 });
  // 耳
  paper(ctx, () => ctx.ellipse(-2.5, 1.5, 2.4, 3.2, 0, 0, Math.PI * 2), C.skin, { off: 0.6, line: 1 });
  // 前髪（三つの房）
  paper(ctx, () => {
    ctx.moveTo(-5, -9); ctx.bezierCurveTo(0, -17, 10, -17, 13.5, -6);
    ctx.quadraticCurveTo(12, -4.5, 11, -1); ctx.quadraticCurveTo(9.5, -5, 7.5, -6);
    ctx.quadraticCurveTo(6.5, -2.5, 4.5, -1.5); ctx.quadraticCurveTo(4, -5, 2, -6.5);
    ctx.quadraticCurveTo(0, -3, -2.5, -2); ctx.quadraticCurveTo(-3, -6, -5, -9); ctx.closePath();
  }, C.hair, { off: 0.8, line: 1.2 });
  // 横の一房
  paper(ctx, () => { ctx.moveTo(-1, -5); ctx.quadraticCurveTo(-0.5, 4, 1.5 + Math.sin(t * 4) * 0.6, 11); ctx.quadraticCurveTo(-3, 6, -4, -3); ctx.closePath(); }, C.hair, { off: 0.6, line: 1 });
  // 髪のつや
  ctx.strokeStyle = C.hairHi; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8, -12); ctx.quadraticCurveTo(-3, -16, 3, -15.5); ctx.stroke();
  // 目
  const blink = (Math.floor(t * 10) % 37 === 0) || opts.hurt;
  if (blink) { ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(5.5, 1.2); ctx.quadraticCurveTo(7.5, 2.5, 9.5, 1.2); ctx.stroke(); }
  else {
    paper(ctx, () => ctx.ellipse(7.6, 0.6, 2.3, 3.4, 0, 0, Math.PI * 2), '#2a1d4a', { shadow: null, line: 0.8 });
    ctx.fillStyle = '#6a5ab8'; ctx.beginPath(); ctx.ellipse(7.8, 2, 1.6, 1.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(8.4, -0.8, 1.05, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(5, -2.6); ctx.quadraticCurveTo(7.6, -4.2, 10.4, -2.4); ctx.stroke();
  }
  // 眉
  ctx.strokeStyle = C.hair; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(5.6, -5.4); ctx.quadraticCurveTo(7.8, -6.3, 10, -5.2); ctx.stroke();
  // 頬と口
  ctx.fillStyle = 'rgba(255,120,130,.45)'; ctx.beginPath(); ctx.ellipse(8, 5, 2.6, 1.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a3a3a'; ctx.lineWidth = 1;
  ctx.beginPath(); if (opts.throwing || air) { ctx.ellipse(11, 6.5, 0.9, 1.2, 0, 0, Math.PI * 2); } else { ctx.moveTo(10, 6.4); ctx.quadraticCurveTo(11, 7.2, 11.8, 6.2); } ctx.stroke();
  // 髪飾り：星と小さな鈴
  ctx.save(); ctx.translate(-6.5, -15.5); ctx.rotate(Math.sin(t * 3) * 0.15);
  const sg = ctx.createLinearGradient(-5, -5, 5, 5); sg.addColorStop(0, '#fff3b0'); sg.addColorStop(1, '#e0a020');
  paper(ctx, () => starPath(ctx, 0, 0, 5.2, 2.3), sg, { off: 0.8, line: 1 });
  ctx.strokeStyle = '#d8344a'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-1, 3); ctx.quadraticCurveTo(-3, 6, -2.5, 8); ctx.stroke();
  paper(ctx, () => ctx.arc(-2.5, 9.3, 1.7, 0, Math.PI * 2), '#f2c552', { off: 0.5, line: 0.8 });
  ctx.restore();
  ctx.restore();

  // 手前の腕（糸を投げる）
  const [hx, hy] = arm(swing, false, !!opts.throwing);
  if (opts.throwing) { sparkle(ctx, hx + 3, hy - 2, 4, 0.9); }
  ctx.restore();
}
