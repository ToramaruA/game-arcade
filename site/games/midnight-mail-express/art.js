// Canvas 切り絵描画。外部画像なし。座標は 960x540 の論理サイズ。
import { STATIONS } from './data.js';

export const W = 960, H = 540, RAIL_Y = 468, TRAIN_X = 18;
export const COL = { navy: '#101632', purple: '#563A76', indigo: '#233C65', warm: '#F7C96C', red: '#EA6D75', paper: '#F4E8CC' };
const TAU = Math.PI * 2;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function glow(ctx, x, y, r, color, a = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
function star(ctx, x, y, r, rot = 0, pts = 5) {
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) { const a = rot - Math.PI / 2 + (i * Math.PI) / pts; const rad = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
  ctx.closePath();
}
const rnd = (() => { let a = 12345; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
const STARS = Array.from({ length: 90 }, () => ({ x: rnd() * W, y: rnd() * 300, r: 0.6 + rnd() * 1.6, p: rnd() * 6 }));
const CLOUDS = Array.from({ length: 9 }, (_, i) => ({ x: rnd() * 1400, y: 40 + rnd() * 180, s: 0.6 + rnd() * 0.9, layer: i % 3 }));
const HILLS = Array.from({ length: 12 }, (_, i) => ({ x: i * 170, h: 60 + rnd() * 70 }));

const SKY = [
  ['#101632', '#2d2a5e', '#5a3d78'],
  ['#0b1730', '#1d3359', '#2f4c78'],
  ['#080d28', '#201a55', '#3b2a7a'],
];

export function drawBackground(ctx, t, scroll, line = 0, reduce = false) {
  const sk = SKY[line] || SKY[0];
  const g = ctx.createLinearGradient(0, 0, 0, RAIL_Y);
  g.addColorStop(0, sk[0]); g.addColorStop(0.6, sk[1]); g.addColorStop(1, sk[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 星
  for (const s of STARS) {
    const tw = reduce ? 0.8 : 0.55 + 0.45 * Math.sin(t * 1.6 + s.p);
    ctx.globalAlpha = tw * (line === 2 ? 1 : 0.8);
    ctx.fillStyle = '#fff6d8';
    const x = (((s.x - scroll * 0.03) % W) + W) % W;
    ctx.beginPath(); ctx.arc(x, s.y, s.r * (line === 2 ? 1.25 : 1), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (line === 2) { // 流れ星の帯
    ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#9ad7ff';
    ctx.beginPath(); ctx.moveTo(0, 150); ctx.bezierCurveTo(300, 60, 600, 200, 960, 90); ctx.lineTo(960, 150); ctx.bezierCurveTo(600, 260, 300, 120, 0, 210); ctx.fill(); ctx.restore();
  }
  // 三日月
  glow(ctx, 130, 92, 150, COL.warm, 0.22);
  ctx.save(); ctx.beginPath(); ctx.arc(130, 92, 54, 0, TAU); ctx.clip();
  ctx.fillStyle = COL.warm; ctx.fillRect(60, 30, 140, 140);
  ctx.beginPath(); ctx.rect(60, 30, 140, 140); ctx.arc(154, 80, 46, 0, TAU, true);
  ctx.fillStyle = sk[1]; ctx.globalAlpha = 1; ctx.fill('evenodd'); ctx.restore();
  // 遠景の丘（紫）
  ctx.fillStyle = 'rgba(86,58,118,.55)';
  ctx.beginPath(); ctx.moveTo(0, RAIL_Y);
  for (let i = -1; i < 8; i++) {
    const base = i * 170 - ((scroll * 0.1) % 170);
    const h = HILLS[((i % 12) + 12) % 12].h;
    ctx.quadraticCurveTo(base + 85, RAIL_Y - 60 - h * 1.7, base + 170, RAIL_Y);
  }
  ctx.lineTo(0, RAIL_Y); ctx.fill();
  // 雲（切り紙の重なり）
  for (const c of CLOUDS) {
    const sp = [0.08, 0.18, 0.3][c.layer];
    const x = (((c.x - scroll * sp) % 1300) + 1300) % 1300 - 160;
    ctx.fillStyle = ['rgba(244,232,204,.10)', 'rgba(244,232,204,.16)', 'rgba(244,232,204,.24)'][c.layer];
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + k * 34 * c.s, c.y + (k % 2) * -10 * c.s, (26 + (k % 3) * 8) * c.s, 0, TAU); ctx.fill(); }
    ctx.fillRect(x - 10 * c.s, c.y + 4 * c.s, 120 * c.s, 14 * c.s);
  }
  // 高架橋（アーチ）
  ctx.fillStyle = '#171d46';
  ctx.fillRect(0, RAIL_Y - 6, W, 110);
  const aw = 120, off = (scroll * 0.5) % aw;
  ctx.fillStyle = '#0d1230';
  for (let x = -aw - off; x < W + aw; x += aw) {
    ctx.beginPath(); ctx.moveTo(x + 18, RAIL_Y + 110); ctx.lineTo(x + 18, RAIL_Y + 50); ctx.arc(x + aw / 2, RAIL_Y + 50, aw / 2 - 18, Math.PI, 0); ctx.lineTo(x + aw - 18, RAIL_Y + 110); ctx.fill();
  }
  // 遠くの灯り
  for (let i = 0; i < 14; i++) {
    const x = (((i * 83 - scroll * 0.22) % 1160) + 1160) % 1160 - 100;
    ctx.fillStyle = i % 3 ? 'rgba(247,201,108,.7)' : 'rgba(234,109,117,.8)';
    ctx.fillRect(x, RAIL_Y - 24 - (i % 4) * 6, 4, 4);
  }
  if (line === 1 && !reduce) { // 雨
    ctx.strokeStyle = 'rgba(180,210,255,.35)'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i < 60; i++) {
      const x = (i * 97 + t * 220) % (W + 100) - 50, y = (i * 53 + t * 520) % RAIL_Y;
      ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 18);
    }
    ctx.stroke();
  }
}

export function drawRails(ctx, scroll, side, locked, progress, hasFork) {
  // 手前の地面と枕木
  ctx.fillStyle = '#0a0e26'; ctx.fillRect(0, RAIL_Y + 6, W, H - RAIL_Y);
  ctx.fillStyle = '#2a2554';
  const sp = 46, off = scroll % sp;
  for (let x = -sp - off; x < W + sp; x += sp) ctx.fillRect(x, RAIL_Y + 8, 24, 8);
  ctx.fillStyle = '#7d7aa8'; ctx.fillRect(0, RAIL_Y, W, 5);
  ctx.fillStyle = '#3d3a6e'; ctx.fillRect(0, RAIL_Y + 5, W, 3);
  if (hasFork) {
    // 二股：左(上)と右(下)
    const x0 = 640, x1 = 940;
    for (let b = 0; b < 2; b++) {
      const yEnd = b === 0 ? RAIL_Y - 78 : RAIL_Y - 4;
      const on = b === side;
      ctx.lineWidth = on ? 6 : 4;
      ctx.strokeStyle = on ? COL.warm : 'rgba(150,150,200,.55)';
      ctx.shadowColor = on ? COL.warm : 'transparent'; ctx.shadowBlur = on ? 14 : 0;
      ctx.beginPath(); ctx.moveTo(x0, RAIL_Y + 2); ctx.bezierCurveTo(x0 + 110, RAIL_Y + 2, x1 - 120, yEnd, x1, yEnd); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // 分岐器の根元の表示
    ctx.fillStyle = locked ? COL.red : COL.warm; ctx.beginPath(); ctx.arc(x0, RAIL_Y + 2, 7, 0, TAU); ctx.fill();
  }
}

// ---- 乗客 ----
const STYLE = [
  { body: '#6f5ba8', head: '#f1d4b6' }, { body: '#3e5a8a', head: '#e8cfb2' }, { body: '#8a6a45', head: '#ecd2b0' },
  { body: '#a7b0d8', head: '#e9eef8', ghost: true }, { body: '#4f7a5e', head: '#efd3b2' }, { body: '#e9ddb8', head: '#f4e8cc', paper: true },
  { body: '#8c3a6a', head: '#e6c8c0' }, { body: '#4a4668', head: '#e7d6c3' }, { body: '#f3f6fb', head: '#f7fbff' },
  { body: '#d8dce6', head: '#2b3a67' }, { body: '#a35a3a', head: '#e3c4a0' }, { body: '#262c58', head: '#12162f' },
];
export function drawPassenger(ctx, k, x, y, s = 1, t = 0, o = {}) {
  const st = STYLE[k], bob = Math.sin(t * 2.6 + k) * 1.8 * s, sway = Math.sin(t * 1.7 + k * 2) * 2 * s;
  ctx.save(); ctx.translate(x + sway * 0.4, y); ctx.scale(s, s); ctx.globalAlpha = o.alpha ?? 1;
  const dim = o.dim ? 0.55 : 1; if (dim < 1) ctx.globalAlpha *= dim;
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(244,232,204,.55)';
  const body = (w, h) => {
    ctx.fillStyle = st.body; ctx.beginPath();
    ctx.moveTo(-w, 0); ctx.quadraticCurveTo(-w - 2, -h, 0, -h - 4); ctx.quadraticCurveTo(w + 2, -h, w, 0);
    if (st.ghost) { for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(w - (i * w) / 2 - w / 4, 10 + Math.sin(t * 3 + i) * 3, w - ((i + 1) * w) / 2, 0); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  };
  const head = (r, hy = -56) => {
    ctx.fillStyle = st.head; ctx.beginPath(); ctx.arc(0, hy + bob, r, 0, TAU); ctx.fill(); ctx.stroke();
  };
  const eyes = (hy = -56, col = '#1a1a33') => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(-5, hy + bob, 1.7, 0, TAU); ctx.arc(5, hy + bob, 1.7, 0, TAU); ctx.fill();
  };
  switch (k) {
    case 0: { // 星を拾う少女
      body(18, 40); head(13); ctx.fillStyle = '#1b2350'; ctx.beginPath(); ctx.arc(0, -60 + bob, 14, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(-15, -52 + bob, 5, 0, TAU); ctx.arc(15, -52 + bob, 5, 0, TAU); ctx.fill(); eyes();
      const up = Math.sin(t * 3) * 4; glow(ctx, 24, -62 + up, 26, COL.warm, 0.7);
      ctx.fillStyle = COL.warm; star(ctx, 24, -62 + up, 9, t); ctx.fill(); break; }
    case 1: { // 透明な傘の紳士
      body(17, 42); head(12); eyes();
      ctx.fillStyle = '#1b1f3f'; ctx.fillRect(-14, -76 + bob, 28, 5); ctx.fillRect(-9, -92 + bob, 18, 17);
      ctx.strokeStyle = 'rgba(190,225,255,.9)'; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(0, -86, 34, Math.PI, 0); ctx.moveTo(0, -86); ctx.lineTo(0, -4); ctx.stroke(); ctx.setLineDash([]); break; }
    case 2: { // 時計のない時計職人
      body(18, 40); head(13); eyes();
      ctx.strokeStyle = '#d6b36a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(7, -57 + bob, 6, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -26, 8, 0, TAU); ctx.stroke(); ctx.fillStyle = '#d6b36a'; ctx.fillRect(-1, -26, 2, 2); break; }
    case 3: { // 猫を抱いた幽霊
      ctx.globalAlpha *= 0.85; body(18, 40); head(13); eyes(-56, '#2a2f6c');
      ctx.globalAlpha = o.alpha ?? 1; ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(10, -22, 12, 9, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(2, -29); ctx.lineTo(4, -38); ctx.lineTo(9, -30); ctx.moveTo(12, -30); ctx.lineTo(17, -38); ctx.lineTo(19, -28); ctx.fill();
      ctx.fillStyle = COL.warm; ctx.fillRect(7, -24, 2, 2); ctx.fillRect(13, -24, 2, 2); break; }
    case 4: { // 手紙だらけの郵便屋
      body(19, 40); head(13); eyes(); ctx.fillStyle = '#2f5b46'; ctx.fillRect(-14, -72 + bob, 28, 6); ctx.fillRect(-9, -78 + bob, 18, 8);
      for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(14 + (i % 2) * 6, -30 - i * 7); ctx.rotate(-0.2 + i * 0.15); ctx.fillStyle = COL.paper; ctx.fillRect(-9, -5, 18, 11); ctx.fillStyle = COL.red; ctx.fillRect(-1, -2, 3, 3); ctx.restore(); }
      break; }
    case 5: { // 紙でできた王様
      ctx.fillStyle = st.body; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-14, -42); ctx.lineTo(0, -34); ctx.lineTo(14, -42); ctx.lineTo(18, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(150,120,70,.5)'; ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(0, 0); ctx.stroke();
      head(13); eyes(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-9, -50 + bob); for (let i = 0; i < 5; i++) ctx.lineTo(-9 + i * 4.5, -42 + (i % 2) * 5 + bob); ctx.lineTo(9, -50 + bob); ctx.fill();
      ctx.fillStyle = COL.warm; ctx.beginPath(); ctx.moveTo(-12, -66 + bob); ctx.lineTo(-12, -82 + bob); ctx.lineTo(-6, -74 + bob); ctx.lineTo(0, -86 + bob); ctx.lineTo(6, -74 + bob); ctx.lineTo(12, -82 + bob); ctx.lineTo(12, -66 + bob); ctx.fill(); break; }
    case 6: { // 鏡に映らない歌手
      ctx.setLineDash([3, 3]); body(17, 42); head(12); ctx.setLineDash([]); eyes();
      ctx.fillStyle = '#2a1233'; ctx.beginPath(); ctx.arc(0, -58 + bob, 14, Math.PI * 0.95, Math.PI * 2.05); ctx.fill(); ctx.fillRect(-15, -58 + bob, 5, 36); ctx.fillRect(10, -58 + bob, 5, 36);
      ctx.fillStyle = '#ddd'; ctx.fillRect(14, -52, 3, 14); ctx.fillStyle = COL.red; ctx.beginPath(); ctx.arc(15.5, -54, 4, 0, TAU); ctx.fill(); break; }
    case 7: { // 小さな月を抱く老人
      body(18, 38); head(13); eyes(); ctx.fillStyle = '#f2f2f2'; ctx.beginPath(); ctx.moveTo(-10, -50 + bob); ctx.quadraticCurveTo(0, -20, 10, -50 + bob); ctx.fill();
      ctx.fillStyle = '#6a6a90'; ctx.beginPath(); ctx.arc(0, -66 + bob, 14, Math.PI, 0); ctx.fill();
      glow(ctx, 0, -22, 26, COL.warm, 0.6); ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(0, -22, 9, 0, TAU); ctx.fill(); break; }
    case 8: { // 雪だるまの郵便配達員
      ctx.fillStyle = st.body; ctx.beginPath(); ctx.arc(0, -17, 19, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -46 + bob * 0.5, 14, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1a1a33'; ctx.beginPath(); ctx.arc(-5, -49 + bob, 1.7, 0, TAU); ctx.arc(5, -49 + bob, 1.7, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f08a2f'; ctx.beginPath(); ctx.moveTo(0, -46 + bob); ctx.lineTo(13, -44 + bob); ctx.lineTo(0, -42 + bob); ctx.fill();
      ctx.fillStyle = '#2c4a8a'; ctx.fillRect(-12, -66 + bob, 24, 7); ctx.fillRect(-8, -72 + bob, 16, 7);
      ctx.fillStyle = COL.red; ctx.fillRect(-14, -35, 28, 5); ctx.fillStyle = COL.paper; ctx.fillRect(10, -14, 14, 9); break; }
    case 9: { // 金魚鉢の宇宙飛行士
      body(18, 38); ctx.fillStyle = 'rgba(160,210,255,.28)'; ctx.beginPath(); ctx.arc(0, -56 + bob, 18, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#d8dce6'; ctx.lineWidth = 3; ctx.stroke(); ctx.lineWidth = 1.5;
      ctx.fillStyle = '#0c1440'; ctx.beginPath(); ctx.arc(0, -56 + bob, 15, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; for (let i = 0; i < 6; i++) ctx.fillRect(-10 + ((i * 7) % 20), -64 + bob + ((i * 5) % 16), 1.5, 1.5);
      const fx = Math.sin(t * 2) * 6; ctx.fillStyle = '#ff8a3c'; ctx.beginPath(); ctx.ellipse(fx, -56 + bob, 6, 3.5, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(fx - 5, -56 + bob); ctx.lineTo(fx - 10, -60 + bob); ctx.lineTo(fx - 10, -52 + bob); ctx.fill(); break; }
    case 10: { // 車輪をなくした機関士
      body(19, 40); head(13); eyes(); ctx.fillStyle = '#2c2f58'; ctx.fillRect(-15, -72 + bob, 30, 8); ctx.beginPath(); ctx.arc(0, -64 + bob, 15, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#9fd0e8'; ctx.beginPath(); ctx.arc(-6, -62 + bob, 4.5, 0, TAU); ctx.arc(6, -62 + bob, 4.5, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(15, -22); ctx.rotate(t * 0.8); ctx.fillStyle = '#c9b27a'; for (let i = 0; i < 8; i++) { ctx.rotate(TAU / 8); ctx.fillRect(-2, -12, 4, 5); } ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); ctx.restore(); break; }
    case 11: { // 切符を持たない車掌
      glow(ctx, 0, -40, 60, COL.warm, 0.35); body(18, 42); head(13); ctx.fillStyle = '#05060f'; ctx.beginPath(); ctx.ellipse(0, -55 + bob, 8, 9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = COL.warm; ctx.beginPath(); ctx.arc(-3, -57 + bob, 1.4, 0, TAU); ctx.arc(3, -57 + bob, 1.4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1b2350'; ctx.fillRect(-15, -72 + bob, 30, 7); ctx.beginPath(); ctx.arc(0, -66 + bob, 15, Math.PI, 0); ctx.fill();
      ctx.fillStyle = COL.warm; ctx.fillRect(-4, -78 + bob, 8, 4); break; }
    default: body(18, 40); head(13); eyes();
  }
  ctx.restore();
}

// ---- 列車 ----
export function trainCar(i) { return { x: TRAIN_X + i * 150, w: 146 }; } // 0..2 客車
export function windowCenter(slot) { const c = trainCar(slot); return { x: c.x + c.w / 2, y: RAIL_Y - 52 }; }
export function drawTrain(ctx, t, scroll, passengers, o = {}) {
  const bounce = o.reduce ? 0 : Math.sin(t * 9) * 0.8 * (o.speed || 0);
  ctx.save(); ctx.translate(0, bounce);
  // 連結器
  ctx.fillStyle = '#05081c'; ctx.fillRect(TRAIN_X + 140, RAIL_Y - 30, 20, 6); ctx.fillRect(TRAIN_X + 290, RAIL_Y - 30, 20, 6); ctx.fillRect(TRAIN_X + 440, RAIL_Y - 30, 20, 6);
  ctx.shadowColor = 'rgba(247,201,108,.55)'; ctx.shadowBlur = 16;
  for (let i = 0; i < 3; i++) {
    const c = trainCar(i);
    ctx.fillStyle = '#1c2250'; rr(ctx, c.x, RAIL_Y - 118, c.w, 98, 12); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = COL.paper; ctx.lineWidth = 2; ctx.globalAlpha = 0.5; rr(ctx, c.x + 2, RAIL_Y - 116, c.w - 4, 94, 11); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#10153a'; rr(ctx, c.x - 2, RAIL_Y - 126, c.w + 4, 14, 6); ctx.fill();
    ctx.fillStyle = COL.red; ctx.fillRect(c.x + 8, RAIL_Y - 32, c.w - 16, 5);
    // 窓
    ctx.save(); rr(ctx, c.x + 16, RAIL_Y - 104, c.w - 32, 66, 10); ctx.clip();
    const g = ctx.createLinearGradient(0, RAIL_Y - 104, 0, RAIL_Y - 38); g.addColorStop(0, '#ffe29a'); g.addColorStop(1, '#f2a85c'); ctx.fillStyle = g; ctx.fillRect(c.x, RAIL_Y - 110, c.w, 80);
    ctx.fillStyle = 'rgba(80,40,90,.25)'; ctx.fillRect(c.x + 16, RAIL_Y - 104, c.w - 32, 8);
    const p = passengers.find((q) => q.slot === i && q.status === 'aboard');
    const vis = o.hideSlot === i ? null : p;
    if (vis) drawPassenger(ctx, vis.kind, c.x + c.w / 2, RAIL_Y - 40, 0.74, t, { alpha: o.slotAlpha?.[i] ?? 1 });
    else { ctx.fillStyle = 'rgba(90,50,110,.35)'; ctx.fillRect(c.x + c.w / 2 - 20, RAIL_Y - 52, 40, 14); }
    ctx.restore();
    ctx.strokeStyle = '#10153a'; ctx.lineWidth = 3; rr(ctx, c.x + 16, RAIL_Y - 104, c.w - 32, 66, 10); ctx.stroke();
    // 選択中の窓の輪
    if (o.selSlot === i) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.shadowColor = COL.warm; ctx.shadowBlur = 14; rr(ctx, c.x + 12, RAIL_Y - 108, c.w - 24, 74, 12); ctx.stroke(); ctx.shadowBlur = 0; }
    ctx.shadowColor = 'rgba(247,201,108,.55)'; ctx.shadowBlur = 16;
  }
  // 機関車
  const lx = TRAIN_X + 462;
  ctx.fillStyle = '#12163a'; rr(ctx, lx, RAIL_Y - 96, 150, 76, 14); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = '#1f2658'; rr(ctx, lx + 64, RAIL_Y - 104, 84, 62, 22); ctx.fill();
  ctx.fillStyle = '#10153a'; ctx.fillRect(lx + 98, RAIL_Y - 142, 26, 42); ctx.fillRect(lx + 92, RAIL_Y - 150, 38, 10);
  ctx.fillStyle = '#251a4d'; rr(ctx, lx - 4, RAIL_Y - 128, 70, 108, 10); ctx.fill();
  ctx.fillStyle = COL.warm; ctx.fillRect(lx + 12, RAIL_Y - 108, 38, 30);
  glow(ctx, lx + 31, RAIL_Y - 93, 40, COL.warm, 0.5);
  ctx.strokeStyle = COL.paper; ctx.globalAlpha = 0.45; ctx.lineWidth = 2; rr(ctx, lx, RAIL_Y - 96, 150, 76, 14); ctx.stroke(); ctx.globalAlpha = 1;
  // ヘッドライト
  glow(ctx, lx + 156, RAIL_Y - 60, 70, COL.warm, 0.9); ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(lx + 150, RAIL_Y - 60, 7, 0, TAU); ctx.fill();
  ctx.fillStyle = COL.red; ctx.beginPath(); ctx.arc(lx + 132, RAIL_Y - 150, 5, 0, TAU); ctx.fill();
  // 歯車の車輪
  const rot = o.reduce ? 0 : scroll * 0.04;
  const wheels = [[TRAIN_X + 40, 20], [TRAIN_X + 110, 20], [TRAIN_X + 190, 20], [TRAIN_X + 260, 20], [TRAIN_X + 340, 20], [TRAIN_X + 410, 20], [lx + 30, 24], [lx + 96, 28], [lx + 132, 18]];
  for (const [wx, r] of wheels) {
    ctx.save(); ctx.translate(wx, RAIL_Y - r + 2); ctx.rotate(rot * (20 / r));
    ctx.fillStyle = '#c9b27a'; for (let i = 0; i < 10; i++) { ctx.rotate(TAU / 10); ctx.fillRect(-2.5, -r - 3, 5, 6); }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.fillStyle = '#10153a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c9b27a'; ctx.fillRect(-r * 0.62, -2, r * 1.24, 4); ctx.fillRect(-2, -r * 0.62, 4, r * 1.24); ctx.restore();
  }
  ctx.restore();
}
export function drawSmoke(ctx, t, speed, reduce) {
  const cx = TRAIN_X + 462 + 111, cy = RAIL_Y - 154;
  for (let i = 0; i < 7; i++) {
    const age = reduce ? i / 7 : (((t * 0.35 + i / 7) % 1) + 1) % 1;
    const x = cx - age * (60 + speed * 140) + Math.sin(i * 3) * 6, y = cy - age * 110, r = 10 + age * 30;
    ctx.fillStyle = `rgba(244,232,204,${0.55 * (1 - age)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(150,130,190,${0.4 * (1 - age)})`; ctx.beginPath(); ctx.arc(x + 6, y + 4, r * 0.8, 0, TAU); ctx.fill();
  }
}

// ---- 駅 ----
function platform(ctx) {
  ctx.fillStyle = '#2a2f5c'; ctx.fillRect(-250, 0, 500, 16);
  ctx.fillStyle = COL.warm; ctx.fillRect(-250, 0, 500, 3);
  ctx.fillStyle = '#12173d'; for (let x = -240; x < 250; x += 50) ctx.fillRect(x, 16, 34, 6);
}
const STATION_ART = [
  (ctx, t) => { // 星屑停留所
    ctx.fillStyle = '#3a3e72'; ctx.fillRect(-64, -150, 8, 150); glow(ctx, -60, -170, 80, COL.warm, 0.7);
    ctx.fillStyle = COL.warm; star(ctx, -60, -172, 28, Math.sin(t) * 0.2); ctx.fill();
    for (let i = 0; i < 3; i++) { const p = ((t * 0.5 + i / 3) % 1); ctx.strokeStyle = `rgba(255,236,170,${1 - p})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(60 + i * 40 - p * 70, -190 + p * 150); ctx.lineTo(60 + i * 40 - p * 70 + 36, -190 + p * 150 - 24); ctx.stroke(); }
    ctx.fillStyle = COL.warm; for (let i = 0; i < 6; i++) ctx.fillRect(-110 + i * 38, -4 - (i % 2) * 3, 4, 4); },
  (ctx, t) => { // 雨音駅
    ctx.fillStyle = '#3a3e72'; ctx.fillRect(-44, -140, 8, 140);
    ctx.fillStyle = 'rgba(120,170,230,.3)'; ctx.strokeStyle = '#9cc4f0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-40, -140, 76, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    glow(ctx, -40, -110, 70, COL.warm, 0.5);
    ctx.strokeStyle = 'rgba(180,215,255,.7)'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i < 18; i++) { const x = -190 + i * 22, y = ((t * 160 + i * 31) % 190) - 190; if (x > -125 && x < 45) continue; ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 12); }
    ctx.stroke(); },
  (ctx, t) => { // 逆時計駅
    ctx.fillStyle = '#4b3a7a'; ctx.fillRect(-36, -190, 72, 190); ctx.beginPath(); ctx.moveTo(-46, -190); ctx.lineTo(0, -236); ctx.lineTo(46, -190); ctx.fill();
    ctx.fillStyle = COL.paper; ctx.beginPath(); ctx.arc(0, -150, 28, 0, TAU); ctx.fill(); ctx.strokeStyle = '#1b1f3f'; ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) { const a = (i * TAU) / 12; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 23, -150 + Math.sin(a) * 23); ctx.lineTo(Math.cos(a) * 26, -150 + Math.sin(a) * 26); ctx.stroke(); }
    const a = -t * 0.9, b = -t * 0.075; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -150); ctx.lineTo(Math.sin(a) * 22, -150 - Math.cos(a) * 22); ctx.moveTo(0, -150); ctx.lineTo(Math.sin(b) * 14, -150 - Math.cos(b) * 14); ctx.stroke();
    ctx.fillStyle = 'rgba(247,201,108,.9)'; ctx.fillRect(-12, -100, 24, 36); },
  (ctx, t) => { // 猫灯駅
    ctx.fillStyle = '#3a3e72'; ctx.fillRect(-4, -190, 8, 30); glow(ctx, 0, -110, 120, COL.red, 0.55);
    ctx.fillStyle = '#e8575f'; ctx.beginPath(); ctx.ellipse(0, -110, 64, 50, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-58, -135); ctx.lineTo(-52, -190); ctx.lineTo(-18, -152); ctx.moveTo(58, -135); ctx.lineTo(52, -190); ctx.lineTo(18, -152); ctx.fill();
    ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.ellipse(-24, -112, 9, 13, 0, 0, TAU); ctx.ellipse(24, -112, 9, 13, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1b1f3f'; ctx.fillRect(-26, -120, 4, 18); ctx.fillRect(22, -120, 4, 18);
    ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, -90); ctx.lineTo(0, -84); ctx.lineTo(14, -90); ctx.stroke(); },
  (ctx, t) => { // 未配達駅
    for (let i = 0; i < 14; i++) { ctx.save(); ctx.translate(-90 + (i % 7) * 26 + (i > 6 ? 13 : 0), -8 - Math.floor(i / 7) * 22 - ((i * 7) % 5)); ctx.rotate(Math.sin(i * 5) * 0.4); ctx.fillStyle = i % 3 ? COL.paper : '#e6d19a'; ctx.fillRect(-14, -9, 28, 18); ctx.strokeStyle = '#a08a5a'; ctx.beginPath(); ctx.moveTo(-14, -9); ctx.lineTo(0, 2); ctx.lineTo(14, -9); ctx.stroke(); ctx.restore(); }
    for (let i = 0; i < 3; i++) { const p = (t * 0.3 + i / 3) % 1, x = 10 + p * 90 + i * 14, y = -70 - p * 90 - i * 10, f = Math.sin(t * 12 + i) * 8; ctx.fillStyle = COL.paper; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 16, y - 8 - f); ctx.lineTo(x - 6, y + 2); ctx.lineTo(x + 16, y - 8 + f); ctx.closePath(); ctx.fill(); ctx.fillStyle = COL.red; ctx.fillRect(x - 2, y - 2, 4, 4); } },
  (ctx, t) => { // 王冠市場
    ctx.fillStyle = '#4a2f58'; ctx.fillRect(-90, -50, 180, 50);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? COL.paper : '#d9535c'; ctx.beginPath(); ctx.moveTo(-96 + i * 32, -112); ctx.lineTo(-64 + i * 32, -112); ctx.lineTo(-64 + i * 32, -78); ctx.quadraticCurveTo(-80 + i * 32, -70, -96 + i * 32, -78); ctx.fill(); }
    ctx.fillStyle = '#3a3e72'; ctx.fillRect(-92, -112, 4, 112); ctx.fillRect(88, -112, 4, 112);
    glow(ctx, 0, -158, 70, COL.warm, 0.6); ctx.fillStyle = COL.warm; ctx.beginPath(); ctx.moveTo(-34, -128); ctx.lineTo(-40, -176); ctx.lineTo(-18, -152); ctx.lineTo(0, -188); ctx.lineTo(18, -152); ctx.lineTo(40, -176); ctx.lineTo(34, -128); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d9535c'; ctx.beginPath(); ctx.arc(0, -140, 6, 0, TAU); ctx.fill(); },
  (ctx, t) => { // 無人劇場
    ctx.fillStyle = '#3a1f44'; ctx.fillRect(-100, -150, 200, 150); ctx.fillStyle = '#1a0e24'; ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(-60, -90); ctx.arc(0, -90, 60, Math.PI, 0); ctx.lineTo(60, 0); ctx.fill();
    ctx.fillStyle = '#c0464f'; ctx.beginPath(); ctx.moveTo(-100, -150); ctx.lineTo(-56, -150); ctx.quadraticCurveTo(-50, -80, -62, 0); ctx.lineTo(-100, 0); ctx.fill(); ctx.beginPath(); ctx.moveTo(100, -150); ctx.lineTo(56, -150); ctx.quadraticCurveTo(50, -80, 62, 0); ctx.lineTo(100, 0); ctx.fill();
    for (let i = 0; i < 9; i++) { const on = Math.sin(t * 3 + i) > -0.3; ctx.fillStyle = on ? COL.warm : '#5a4a3a'; ctx.beginPath(); ctx.arc(-88 + i * 22, -162, 4.5, 0, TAU); ctx.fill(); }
    glow(ctx, 0, -40, 70, COL.warm, 0.45); ctx.fillStyle = '#2a1233'; for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-30 + i * 20, -16 - r * 16, 7, Math.PI, 0); ctx.fill(); } },
  (ctx, t) => { // 永夜岬
    ctx.fillStyle = '#1a1f48'; ctx.beginPath(); ctx.moveTo(-250, 0); ctx.lineTo(-200, -60); ctx.lineTo(-120, -110); ctx.lineTo(-30, -130); ctx.lineTo(10, -90); ctx.lineTo(0, 0); ctx.fill();
    ctx.fillStyle = '#2a3070'; ctx.fillRect(-82, -190, 14, 62); ctx.fillStyle = COL.warm; ctx.fillRect(-86, -200, 22, 12);
    glow(ctx, 70, -150 - Math.sin(t) * 3, 120, '#a9b4ff', 0.45); ctx.fillStyle = '#d9defa'; ctx.beginPath(); ctx.arc(70, -150 - Math.sin(t) * 3, 42, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(122,134,214,.5)'; ctx.beginPath(); ctx.arc(58, -158, 9, 0, TAU); ctx.arc(84, -138, 6, 0, TAU); ctx.fill(); },
  (ctx, t) => { // 冬庭駅
    ctx.fillStyle = '#e9f3fb'; ctx.beginPath(); ctx.ellipse(-60, 0, 120, 28, 0, Math.PI, 0); ctx.ellipse(80, 0, 90, 20, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#6a5a7a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, -110); ctx.moveTo(0, -70); ctx.lineTo(-34, -110); ctx.moveTo(0, -84); ctx.lineTo(36, -122); ctx.stroke();
    for (const [x, y] of [[0, -112], [-36, -112], [38, -124], [-14, -90], [18, -96]]) { ctx.fillStyle = '#ff9fb8'; for (let k = 0; k < 5; k++) { const a = (k * TAU) / 5 + t * 0.2; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 4, 0, TAU); ctx.fill(); } ctx.fillStyle = COL.warm; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#fff'; for (let i = 0; i < 22; i++) { ctx.beginPath(); ctx.arc(-200 + ((i * 53) % 400) + Math.sin(t + i) * 6, ((t * 30 + i * 41) % 200) - 200, 2.2, 0, TAU); ctx.fill(); } },
  (ctx, t) => { // 深海改札
    ctx.fillStyle = 'rgba(30,120,150,.55)'; ctx.fillRect(-100, -170, 200, 150); ctx.strokeStyle = '#7fd6d2'; ctx.lineWidth = 5; ctx.strokeRect(-100, -170, 200, 150);
    for (let i = 0; i < 5; i++) { const x = ((t * 22 * (1 + i * 0.2) + i * 60) % 200) - 100, y = -140 + i * 20 + Math.sin(t + i) * 5; ctx.fillStyle = ['#ff8a3c', '#ffd35c', '#9fe8ff', '#ff6f91', '#c8ff9a'][i]; ctx.beginPath(); ctx.ellipse(x, y, 12, 6, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x - 20, y - 6); ctx.lineTo(x - 20, y + 6); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const y = -30 - ((t * 24 + i * 25) % 130); ctx.beginPath(); ctx.arc(-70 + i * 26, y, 3 + (i % 3), 0, TAU); ctx.stroke(); }
    ctx.strokeStyle = '#c9b27a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-40, -40); ctx.moveTo(40, 0); ctx.lineTo(40, -40); ctx.moveTo(-40, -30); ctx.lineTo(40, -30); ctx.stroke(); },
  (ctx, t) => { // 終端駅
    ctx.strokeStyle = '#8fb0e0'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-60, 0); ctx.bezierCurveTo(-20, -60, 20, -120, 20, -230); ctx.moveTo(-10, 0); ctx.bezierCurveTo(26, -60, 56, -120, 46, -230); ctx.stroke();
    for (let i = 0; i < 8; i++) { const p = i / 8; const x = -35 + p * 60, y = -p * 190; ctx.fillStyle = '#6a7ab0'; ctx.fillRect(x - 24 * (1 - p * 0.6), y - 2, 48 * (1 - p * 0.6), 4); }
    glow(ctx, 34, -236, 50, '#cfffc0', 0.8); ctx.fillStyle = '#e4ffd6'; star(ctx, 34, -238, 16, t * 0.3); ctx.fill();
    ctx.fillStyle = '#d9535c'; ctx.fillRect(-120, -40, 10, 40); ctx.fillRect(-140, -50, 50, 10); },
  (ctx, t) => { // どこでもない駅
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 6; ctx.strokeRect(-46, -170, 92, 170); glow(ctx, 0, -90, 120, '#ffffff', 0.35);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(-46, -170, 92, 170);
    ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 14; i++) ctx.fillRect(-120 + ((i * 37) % 240), -200 + ((i * 59 + t * 8) % 200), 3, 3); },
];
export function drawStation(ctx, id, x, gy, scale, t, o = {}) {
  ctx.save(); ctx.translate(x, gy); ctx.scale(scale, scale); ctx.globalAlpha = o.alpha ?? 1;
  platform(ctx);
  STATION_ART[id](ctx, t);
  // 駅名板
  const name = STATIONS[id].name;
  ctx.font = 'bold 20px system-ui, "Hiragino Sans", sans-serif'; const w = ctx.measureText(name).width + 28;
  ctx.fillStyle = '#10153a'; rr(ctx, 120 - w / 2, -56, w, 32, 8); ctx.fill(); ctx.strokeStyle = STATIONS[id].hue; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = COL.paper; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(name, 120, -40);
  ctx.fillStyle = '#3a3e72'; ctx.fillRect(112, -24, 4, 24); ctx.fillRect(124, -24, 4, 24);
  if (o.badge) { ctx.fillStyle = o.badgeColor || COL.warm; ctx.beginPath(); ctx.arc(120, -92, 24, 0, TAU); ctx.fill(); ctx.fillStyle = '#10153a'; ctx.font = 'bold 26px system-ui, sans-serif'; ctx.fillText(o.badge, 120, -91); }
  ctx.restore();
}

// ---- 降車後の別れの絵（p: 0→1） ----
export function drawFarewell(ctx, k, x, y, p, t) {
  ctx.save(); ctx.translate(x, y);
  const a = p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2;
  ctx.globalAlpha = a;
  const gr = Math.min(1, p * 2.2);
  switch (k) {
    case 0: for (let i = 0; i < 8; i++) { const an = (i * TAU) / 8; ctx.fillStyle = COL.warm; star(ctx, Math.cos(an) * 40 * gr, -50 + Math.sin(an) * 40 * gr, 6, an); ctx.fill(); } break;
    case 1: case 8: { ctx.strokeStyle = '#5a9a5a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -50 * gr); ctx.stroke(); for (let i = 0; i < 6; i++) { const an = (i * TAU) / 6; ctx.fillStyle = k === 1 ? '#8fc0ff' : '#ff9fb8'; ctx.beginPath(); ctx.arc(Math.cos(an) * 13 * gr, -50 * gr + Math.sin(an) * 13 * gr, 8 * gr, 0, TAU); ctx.fill(); } break; }
    case 2: ctx.strokeStyle = COL.paper; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -50, 28, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -50); ctx.lineTo(Math.sin(p * 12) * 20, -50 - Math.cos(p * 12) * 20); ctx.stroke(); break;
    case 3: ctx.fillStyle = '#05060f'; ctx.beginPath(); ctx.ellipse(-p * 80, -12, 18, 11, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-p * 80 - 10, -20); ctx.lineTo(-p * 80 - 8, -32); ctx.lineTo(-p * 80, -22); ctx.fill(); break;
    case 4: ctx.fillStyle = COL.paper; for (let i = 0; i < 4; i++) { const px = (i - 1.5) * 24 + p * 30, py = -40 - p * 90 - i * 8, f = Math.sin(t * 14 + i) * 7; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 14, py - 6 - f); ctx.lineTo(px - 4, py + 3); ctx.lineTo(px + 14, py - 6 + f); ctx.closePath(); ctx.fill(); } break;
    case 5: ctx.save(); ctx.translate(p * 140, -40 - p * 90); ctx.rotate(-0.5); ctx.fillStyle = COL.paper; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-30, -6); ctx.lineTo(-12, 4); ctx.lineTo(8, 14); ctx.closePath(); ctx.fill(); ctx.restore(); break;
    case 6: for (let i = 0; i < 3; i++) { glow(ctx, (i - 1) * 48, -20, 50, i % 2 ? COL.red : COL.warm, 0.6 * gr); } break;
    case 7: glow(ctx, 0, -50 - p * 120, 60, '#ffe9a8', 0.6); ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(0, -50 - p * 120, 12 + p * 8, 0, TAU); ctx.fill(); break;
    case 9: { ctx.strokeStyle = 'rgba(160,220,255,.8)'; ctx.lineWidth = 1.5; const pts = [[-40, -40], [-10, -70], [20, -50], [46, -84], [60, -40]]; ctx.beginPath(); pts.forEach(([px, py], i) => { if (i < Math.ceil(gr * pts.length)) ctx[i ? 'lineTo' : 'moveTo'](px, py - p * 30); }); ctx.stroke(); ctx.fillStyle = COL.warm; pts.forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px, py - p * 30, 3.5, 0, TAU); ctx.fill(); }); break; }
    case 10: ctx.strokeStyle = '#8fb0e0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.quadraticCurveTo(10, -60 * gr, 20, -150 * gr); ctx.moveTo(10, 0); ctx.quadraticCurveTo(40, -60 * gr, 40, -150 * gr); ctx.stroke(); break;
    default: glow(ctx, 0, -50, 90, COL.warm, 0.8 * gr); ctx.fillStyle = COL.warm; star(ctx, 0, -60, 16 * gr, t); ctx.fill();
  }
  ctx.restore();
}
export function drawBubble(ctx, x, y, text, color = COL.paper) {
  ctx.save(); ctx.font = 'bold 18px system-ui, "Hiragino Sans", sans-serif'; const w = ctx.measureText(text).width + 24;
  ctx.fillStyle = color; rr(ctx, x - w / 2, y - 30, w, 30, 12); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x, y + 9); ctx.lineTo(x + 6, y); ctx.fill();
  ctx.fillStyle = '#10153a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y - 14); ctx.restore();
}
export function drawStarFly(ctx, x, y, color = COL.warm) { glow(ctx, x, y, 22, color, 0.8); ctx.fillStyle = color; star(ctx, x, y, 10); ctx.fill(); }
export { star, glow, rr };
