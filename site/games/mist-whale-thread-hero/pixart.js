// 霧鯨と糸の勇者 — ドット絵（1マス=16ドット）。すべてコードで描く。
import { TS, serpentSpan, serpentY, serpentHead, clockOpen, exitLocked, THREAD_COLORS } from './logic.js';
import { makeSprite, pxRect, pxEllipse, pxDome, pxLine, pxDither } from './pixel.js';
import { drawRoom as roomDraw, drawMonster, monsterWindow, drawRoomScreen, drawFloorScreen } from './room.js';
import { windowHand } from './logic.js';

export const K = 16 / TS; // 世界の1単位 → ドット
const X = (v) => Math.round(v * K);
const OUT = '#120c1c';
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function threadColor(idx, t = 0) {
  const c = THREAD_COLORS[idx] || THREAD_COLORS[0];
  if (c.c === 'rainbow') return ['#ff6b6b', '#ffe27a', '#4fb08a', '#5fb0b0', '#a06ad6'][Math.floor(t * 8) % 5];
  return c.c;
}

function blit(ctx, img, x, y, flip = false) {
  x = Math.round(x); y = Math.round(y);
  if (!flip) { ctx.drawImage(img, x, y); return; }
  ctx.save(); ctx.translate(x + img.width, y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore();
}

// ───────────────────────── 主人公：迷いこんだ少女ミオ（小さく、か弱い） ─────────────────────────
// 飾りは何もない。白いワンピース、やわらかい金髪のボブ、裸足。弱さは姿勢と動きで見せる。
const HC = {
  out: '#120c1c', skin: '#ffd2b0', skinD: '#e09a7a', hair: '#ffd890', hairD: '#c9963a', dress: '#f4f1e8', dressD: '#c8c0b0',
  eye: '#120c1c', white: '#ffffff', cheek: '#ff6b6b', tear: '#7fc8e8', glow: '#ffe27a',
};
const HW = 30; const HH = 36; const HCX = 14; // 足元は y=35
function heroDraw(g, f) {
  const b = f.bob || 0; const sc = f.expr === 'scared';
  const O = HC.out;
  const limb = (x0, y0, x1, y1, col, w = 2) => { g.fillStyle = O; pxLine(g, x0, y0, x1, y1, w + 2); g.fillStyle = col; pxLine(g, x0, y0, x1, y1, w); };
  // 脚（細い・裸足）
  const legTop = sc ? 30 : 28;
  const leg = (x, a, back) => { const fx = x + a * 3; const fy = sc ? 33 : 33 - (a > 0.4 ? 1 : 0); limb(x, legTop + b * 0.5, fx, fy, back ? HC.skinD : HC.skin, 1); };
  leg(12, -(f.legA || 0), true);
  // 奥の腕
  const a = f.armA || 0;
  if (f.pose === 'up') limb(10, 21 + b, 5, 17 + b, HC.skinD);
  else if (f.pose === 'run') limb(12, 21 + b, 8 - a * 2, 25 + b, HC.skinD);
  // ワンピース
  const fl = f.flare || 0;
  g.fillStyle = O; g.beginPath(); g.moveTo(10, 19 + b); g.lineTo(18, 19 + b); g.lineTo(21 + fl, 30 + b * 0.5 - (sc ? -1 : 0)); g.lineTo(7 - fl, 30 + b * 0.5 - (sc ? -1 : 0)); g.closePath(); g.lineWidth = 2; g.lineJoin = 'round'; g.strokeStyle = O; g.stroke(); g.fill();
  g.fillStyle = HC.dress; g.beginPath(); g.moveTo(10.5, 19.5 + b); g.lineTo(17.5, 19.5 + b); g.lineTo(20.5 + fl, 29.5 + b * 0.5 + (sc ? 1 : 0)); g.lineTo(7.5 - fl, 29.5 + b * 0.5 + (sc ? 1 : 0)); g.closePath(); g.fill();
  g.fillStyle = HC.dressD; g.beginPath(); g.moveTo(10.5, 19.5 + b); g.lineTo(12, 19.5 + b); g.lineTo(10, 29.5 + b * 0.5 + (sc ? 1 : 0)); g.lineTo(7.5 - fl, 29.5 + b * 0.5 + (sc ? 1 : 0)); g.closePath(); g.fill();
  leg(16, f.legA || 0, false);
  // 頭：やわらかいボブの髪
  const hy = 12 + b + (sc ? 2 : 0);
  g.fillStyle = O; g.beginPath(); g.ellipse(14.5, hy, 9.4, 8.8, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(5, hy, 4, 8); g.fillRect(20, hy, 4, 8);
  g.fillStyle = HC.hair; g.beginPath(); g.ellipse(14.5, hy, 8.6, 8, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(6, hy, 3, 7 + (f.hairBounce || 0)); g.fillRect(20, hy, 3, 7 + (f.hairBounce || 0));
  g.fillStyle = HC.hairD; g.fillRect(6, hy + 4, 2, 3); 
  // 顔
  g.fillStyle = HC.skin; g.beginPath(); g.ellipse(16, hy + 2.5, 6.2, 5.6, 0, 0, Math.PI * 2); g.fill();
  // 前髪
  g.fillStyle = HC.hair; g.beginPath(); g.moveTo(8, hy - 1); g.quadraticCurveTo(15, hy - 7, 23, hy - 1); g.lineTo(23, hy + 1); g.lineTo(21, hy); g.lineTo(19.5, hy + 1.5); g.lineTo(17.5, hy - 0.5); g.lineTo(15.5, hy + 1.5); g.lineTo(13.5, hy); g.lineTo(11, hy + 2); g.lineTo(9, hy + 1); g.closePath(); g.fill();
  // 手前の腕
  let hand;
  if (f.pose === 'throw') { hand = [26, 18 + b]; limb(18, 21 + b, hand[0], hand[1], HC.skin); }
  else if (f.pose === 'up') { hand = [24, 17 + b]; limb(18, 21 + b, hand[0], hand[1], HC.skin); }
  else if (f.pose === 'run') { hand = [20 + a * 2, 25 + b]; limb(18, 21 + b, hand[0], hand[1], HC.skin); }
  else if (sc) { hand = [20, hy - 3]; limb(17, 22 + b, 21, hy - 2, HC.skin); limb(11, 22 + b, 9, hy - 3, HC.skinD); }
  else { hand = [19, 26 + b]; limb(18, 21 + b, 19, 26 + b, HC.skin); }
  f._hand = hand;
}
function heroInner(f) {
  return (g) => {
    const b = f.bob || 0; const e = f.expr || 'normal';
    const y = 13 + b + (e === 'scared' ? 2 : 0);
    if (e === 'blink') { g.fillStyle = HC.eye; g.fillRect(14, y + 2, 2, 1); g.fillRect(18, y + 2, 2, 1); }
    else if (e === 'hurt' || e === 'scared') {
      g.fillStyle = HC.eye; g.fillRect(14, y + 1, 1, 1); g.fillRect(15, y + 2, 1, 1); g.fillRect(19, y + 1, 1, 1); g.fillRect(18, y + 2, 1, 1);
      g.fillStyle = HC.tear; g.fillRect(14, y + 3, 1, 2); g.fillRect(19, y + 3, 1, 2);
      g.fillStyle = HC.eye; g.fillRect(16, y + 5, 2, 1);
    } else if (e === 'nervous') {
      // こわごわ：目を見開いて、汗
      g.fillStyle = HC.white; g.fillRect(14, y - 1, 2, 3); g.fillRect(18, y - 1, 2, 3);
      g.fillStyle = HC.eye; g.fillRect(15, y, 1, 2); g.fillRect(19, y, 1, 2);
      g.fillStyle = HC.eye; g.fillRect(16, y + 5, 1, 1); g.fillRect(17, y + 4, 1, 1); g.fillRect(18, y + 5, 1, 1);
      g.fillStyle = HC.tear; g.fillRect(23, y - 3, 1, 2); g.fillRect(22, y - 2, 1, 1);
    } else {
      g.fillStyle = HC.eye; g.fillRect(14, y, 2, 3); g.fillRect(18, y, 2, 3);
      g.fillStyle = HC.white; g.fillRect(14, y, 1, 1); g.fillRect(18, y, 1, 1);
      g.fillStyle = HC.skinD; g.fillRect(17, y + 5, 1, 1);
    }
    g.fillStyle = HC.cheek; g.fillRect(13, y + 3, 1, 1); g.fillRect(20, y + 3, 1, 1);
    if (f.pose === 'throw') { g.fillStyle = HC.glow; g.fillRect(27, 16 + b, 2, 2); g.fillRect(29, 15 + b, 1, 1); g.fillRect(28, 19 + b, 1, 1); }
  };
}
const heroCache = new Map();
function heroFrame(f) {
  const key = JSON.stringify(f);
  if (heroCache.has(key)) return heroCache.get(key);
  const fr = { ...f };
  const img = makeSprite(HW, HH, (g) => { g.save(); g.translate(0, 1); heroDraw(g, fr); g.restore(); }, { pal: [HC.out, HC.skin, HC.skinD, HC.hair, HC.hairD, HC.dress, HC.dressD], inner: (g) => { g.save(); g.translate(0, 1); heroInner(fr)(g); g.restore(); } });
  const v = { img, hand: [fr._hand[0], fr._hand[1] + 1] };
  heroCache.set(key, v);
  return v;
}
export function heroPose(p, t, opts = {}) {
  const run = Math.abs(p.vx) > 20 && p.onGround;
  const air = !p.onGround;
  const f = { bob: 0, legA: 0, armA: 0, pose: 'idle', expr: 'normal', flare: 0, hairBounce: 0 };
  if (run) { const ph = Math.floor(p.anim * 0.07) % 4; f.pose = 'run'; f.legA = [0.9, 0, -0.9, 0][ph]; f.bob = ph % 2 ? -1 : 0; f.armA = [-0.8, 0, 0.8, 0][ph]; f.hairBounce = ph % 2; f.flare = 1; }
  else if (air) { f.legA = p.vy < 0 ? 0.6 : -0.4; f.pose = 'up'; f.bob = p.vy < 0 ? -1 : 0; f.flare = 2; f.hairBounce = p.vy < 0 ? 0 : 1; }
  else {
    if (p.landed > 0) f.bob = 1;
    if (Math.floor(t * 10) % 37 === 0) f.expr = 'blink';
  }
  if (opts.scared && !opts.hurt && !air && !opts.throwing) { f.expr = 'scared'; f.pose = 'idle'; f.bob = 0; f.legA = 0; }
  if (opts.nervous && f.expr === 'normal') f.expr = 'nervous';
  if (opts.throwing) f.pose = 'throw';
  if (opts.hurt) f.expr = 'hurt';
  return heroFrame(f);
}

export function drawHero(ctx, p, t, opts = {}) {
  const pose = heroPose(p, t, opts);
  const face = p.face || 1;
  const cx = X(p.x + p.w / 2); const foot = X(p.y + p.h);
  const shiver = (opts.scared || opts.nervous) && p.onGround && Math.floor(t * 30) % (opts.scared ? 3 : 7) === 0 ? (Math.floor(t * 60) % 2 ? 1 : -1) : 0;
  const sx = (face > 0 ? cx - HCX : cx - (HW - HCX)) + shiver;
  const sy = foot - HH + 1 + (p.landed > 0 ? 1 : 0);
  if (p.invuln > 0 && !opts.og && Math.floor(t * 16) % 2) return pose;
  if (p.onGround) { ctx.fillStyle = 'rgba(18,12,28,.35)'; ctx.fillRect(cx - 6, foot, 13, 1); }
  blit(ctx, pose.img, sx, sy, face < 0);
  pose.handPx = [face > 0 ? sx + pose.hand[0] : sx + HW - pose.hand[0], sy + pose.hand[1]];
  return pose;
}
// 大きく描く（タイトル）
export function drawHeroBig(ctx, x, y, scale, t, opts = {}) {
  const p = { x: 0, y: 0, w: 0, h: 0, vx: opts.vx ?? 0, vy: opts.vy ?? 0, face: 1, onGround: opts.onGround ?? true, anim: t * 220, landed: 0, invuln: 0 };
  const pose = heroPose(p, t, opts);
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(scale, scale);
  ctx.drawImage(pose.img, 0, 0);
  ctx.restore();
  return [x + pose.hand[0] * scale, y + pose.hand[1] * scale];
}

// ───────────────────────── 鐘・フックなど ─────────────────────────
const S = {};
function bellShape(g, cx, top, w, h, body, dark, light) {
  g.fillStyle = dark; g.beginPath(); g.ellipse(cx, top + 1, 1.6, 1.6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(cx - w * 0.22, top + 2.5);
  g.quadraticCurveTo(cx, top + 0.5, cx + w * 0.22, top + 2.5);
  g.quadraticCurveTo(cx + w * 0.36, top + h * 0.6, cx + w * 0.5, top + h - 1.5);
  g.lineTo(cx - w * 0.5, top + h - 1.5);
  g.quadraticCurveTo(cx - w * 0.36, top + h * 0.6, cx - w * 0.22, top + 2.5);
  g.fill();
  g.fillStyle = dark; g.fillRect(Math.round(cx - w * 0.5), Math.round(top + h - 2.5), Math.round(w), 1);
  g.fillStyle = dark; g.beginPath(); g.ellipse(cx, top + h, 1.3, 1.3, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = light; g.fillRect(Math.round(cx - w * 0.22), Math.round(top + 3), 1, Math.round(h * 0.45));
}
function buildObjects() {
  if (S.ready) return;
  S.ready = true;
  S.starBell = makeSprite(13, 14, (g) => bellShape(g, 6.5, 1, 10, 11, '#f0b030', '#a8641c', '#ffe27a'), { inner: (g) => { g.fillStyle = '#fff'; g.fillRect(6, 6, 1, 1); g.fillRect(5, 7, 3, 1); g.fillRect(6, 8, 1, 1); } });
  const big = (body, dark, light, lit) => makeSprite(26, 28, (g) => {
    bellShape(g, 13, 4, 20, 20, body, dark, light);
    g.fillStyle = '#d8283c'; g.fillRect(12, 0, 2, 4);
    g.fillStyle = '#d8283c'; g.fillRect(1, 19, 2, 6); g.fillRect(23, 19, 2, 6);
  }, { inner: (g) => {
    g.fillStyle = lit ? '#fff' : light; g.fillRect(12, 11, 2, 2); g.fillRect(10, 12, 6, 1); g.fillRect(11, 14, 1, 1); g.fillRect(14, 14, 1, 1);
    g.fillStyle = dark; g.fillRect(6, 19, 14, 1);
  } });
  S.bigBell = big('#c9963a', '#a8641c', '#f0b030', false);
  S.bigBellLit = big('#ffe27a', '#f0b030', '#ffffff', true);
  S.clockBell = makeSprite(26, 28, (g) => {
    bellShape(g, 13, 4, 20, 20, '#a06ad6', '#2a1440', '#bfe4ff');
    g.fillStyle = '#d8283c'; g.fillRect(12, 0, 2, 4);
    g.fillStyle = '#f4f1e8'; g.beginPath(); g.ellipse(13, 13, 4.5, 4.5, 0, 0, Math.PI * 2); g.fill();
  }, { inner: (g) => { g.fillStyle = OUT; g.fillRect(13, 10, 1, 4); g.fillRect(13, 13, 3, 1); } });
  S.crescent = makeSprite(26, 10, (g) => { g.fillStyle = '#f4f1e8'; g.beginPath(); g.ellipse(13, 2, 12, 7, 0, 0, Math.PI); g.fill(); g.fillStyle = 'rgba(0,0,0,0)'; g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.ellipse(13, 0, 10, 5, 0, 0, Math.PI); g.fill(); });
  S.hook = makeSprite(13, 15, (g) => {
    g.fillStyle = '#f0b030'; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? 2.6 : 6; g.lineTo(6.5 + Math.cos(a) * r, 6 + Math.sin(a) * r); }
    g.fill();
    g.strokeStyle = '#ffe27a'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(6.5, 11.5, 2.4, 2.4, 0, 0, Math.PI * 2); g.stroke();
  }, { inner: (g) => { g.fillStyle = '#fff'; g.fillRect(6, 4, 1, 2); } });
  S.hookPale = makeSprite(13, 15, (g) => {
    g.fillStyle = '#bfe4ff'; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? 2.6 : 6; g.lineTo(6.5 + Math.cos(a) * r, 6 + Math.sin(a) * r); }
    g.fill();
    g.strokeStyle = '#f4f1e8'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(6.5, 11.5, 2.4, 2.4, 0, 0, Math.PI * 2); g.stroke();
  });
  const lever = (on) => makeSprite(16, 20, (g) => {
    g.fillStyle = '#4a4060'; g.beginPath(); g.ellipse(8, 18, 6, 3.5, 0, Math.PI, 0); g.fill();
    g.save(); g.translate(8, 17); g.rotate(on ? 0.9 : -0.6); g.fillStyle = '#c9963a'; g.fillRect(-1, -11, 2, 11); g.restore();
    const a = on ? 0.9 : -0.6; const bx = 8 + Math.sin(a) * 11; const by = 17 - Math.cos(a) * 11;
    bellShape(g, bx, by - 6, 7, 7, on ? '#ffe27a' : '#f0b030', '#a8641c', '#fff');
  });
  S.leverOff = lever(false); S.leverOn = lever(true);
  const lh = (open) => makeSprite(20, 46, (g) => {
    g.fillStyle = '#f4f1e8'; g.beginPath(); g.moveTo(3, 45); g.lineTo(6, 12); g.lineTo(14, 12); g.lineTo(17, 45); g.fill();
    g.fillStyle = '#d8283c'; g.fillRect(4, 33, 12, 4); g.fillRect(5, 21, 10, 4);
    g.fillStyle = '#2a2238'; g.fillRect(3, 9, 14, 3);
    g.fillStyle = open ? '#ffe27a' : '#4a4060'; g.fillRect(6, 3, 8, 6);
    g.fillStyle = '#d8283c'; g.beginPath(); g.moveTo(4, 3); g.lineTo(10, -1); g.lineTo(16, 3); g.fill();
    g.fillStyle = '#4a4060'; g.beginPath(); g.ellipse(10, 45, 3, 4, 0, Math.PI, 0); g.fill();
  }, { inner: (g) => { if (open) { g.fillStyle = '#fff'; g.fillRect(8, 4, 2, 2); } } });
  S.lighthouseOpen = lh(true); S.lighthouseShut = lh(false);
  const cp = (on) => makeSprite(10, 20, (g) => {
    g.fillStyle = '#4a4060'; g.fillRect(2, 2, 2, 18); g.fillRect(2, 2, 6, 2);
    g.fillStyle = on ? '#ffd36a' : '#4a4060'; g.beginPath(); g.ellipse(7, 7, 2.5, 3.2, 0, 0, Math.PI * 2); g.fill();
  }, { inner: (g) => { if (on) { g.fillStyle = '#fff'; g.fillRect(7, 6, 1, 2); } } });
  S.cpOn = cp(true); S.cpOff = cp(false);
  S.seed = makeSprite(18, 18, (g) => {
    g.fillStyle = '#6a4630'; g.beginPath(); g.ellipse(9, 10, 7.5, 6.8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c9963a'; g.beginPath(); g.ellipse(7, 9, 3, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4fb08a'; g.beginPath(); g.moveTo(9, 4); g.quadraticCurveTo(13, -1, 16, 2); g.quadraticCurveTo(12, 4, 9, 4); g.fill();
  });
  S.ship = makeSprite(52, 30, (g) => {
    g.fillStyle = '#f4f1e8'; g.beginPath(); g.moveTo(1, 18); g.lineTo(51, 18); g.lineTo(44, 27); g.lineTo(8, 27); g.fill();
    for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(8 + i * 9, 26, 5, 3, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#7896b4'; g.fillRect(4, 20, 44, 1);
    g.fillStyle = '#4a4060'; g.fillRect(25, 1, 2, 17);
    g.fillStyle = '#f0c8a0'; g.beginPath(); g.moveTo(27, 2); g.quadraticCurveTo(40, 9, 27, 16); g.fill();
  }, { inner: (g) => { g.fillStyle = '#d8283c'; g.fillRect(30, 8, 3, 2); } });
  // 敵（悪夢の住人たち）
  const eye = (g, x, y, r, pupil = OUT) => { g.fillStyle = '#e8dcc8'; g.beginPath(); g.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = pupil; g.beginPath(); g.ellipse(x, y, r * 0.42, r * 0.5, 0, 0, Math.PI * 2); g.fill(); };
  // 影蛾：翅に人の目の模様
  S.moth = [0, 1].map((fr) => makeSprite(28, 22, (g) => {
    const f = fr ? 0.55 : 1;
    for (const sx of [-1, 1]) {
      g.fillStyle = '#6a1424'; g.beginPath(); g.ellipse(14 + sx * 7, 8, 7.5, 6 * f, sx * 0.35, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e8503a'; g.beginPath(); g.ellipse(14 + sx * 6.5, 8, 5.5, 4.3 * f, sx * 0.35, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3a0a18'; g.beginPath(); g.ellipse(14 + sx * 5, 15, 4.5, 3.6 * f, -sx * 0.4, 0, Math.PI * 2); g.fill();
      if (!fr) eye(g, 14 + sx * 7, 8, 2.6);
    }
    g.fillStyle = '#120c1c'; g.beginPath(); g.ellipse(14, 11, 2.2, 7, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(11, 1, 1, 4); g.fillRect(16, 1, 1, 4); g.fillRect(10, 1, 1, 1); g.fillRect(17, 1, 1, 1);
  }, { inner: (g) => { g.fillStyle = '#ff4a5a'; if (fr === 0) { g.fillRect(6, 7, 1, 1); g.fillRect(21, 7, 1, 1); } g.fillStyle = '#e8dcc8'; g.fillRect(13, 6, 1, 1); g.fillRect(15, 6, 1, 1); } }));
  S.mothHot = makeSprite(28, 22, (g) => g.drawImage(S.moth[0], 0, 0), { outline: null, inner: (g) => { g.fillStyle = '#ff2a1a'; g.fillRect(13, 6, 1, 1); g.fillRect(15, 6, 1, 1); g.fillRect(6, 7, 3, 2); g.fillRect(20, 7, 3, 2); } });
  // 仮面蜂：鎧の胴に陶器の仮面
  S.bee = [0, 1].map((fr) => makeSprite(28, 20, (g) => {
    g.fillStyle = '#c8c0b0'; g.beginPath(); g.ellipse(10, fr ? 3 : 4, 5, fr ? 1.8 : 4, -0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a2a2a'; g.beginPath(); g.ellipse(9, 11, 8.5, 6.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#a8641c'; g.fillRect(4, 6, 2, 11); g.fillRect(9, 5, 2, 12); g.fillRect(14, 6, 2, 10);
    g.fillStyle = '#6a4630'; g.beginPath(); g.moveTo(1, 11); g.lineTo(-2, 14); g.lineTo(2, 13); g.fill();
    g.fillStyle = '#e8dcc8'; g.beginPath(); g.ellipse(21, 10, 6, 7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a2a2a'; for (let k = 0; k < 4; k++) g.fillRect(5 + k * 4, 16, 1, 4);
  }, { inner: (g) => {
    g.fillStyle = OUT; g.fillRect(19, 7, 2, 3); g.fillRect(23, 7, 2, 3);
    g.fillStyle = '#8a8070'; g.fillRect(19, 13, 6, 1); g.fillRect(25, 12, 1, 1); g.fillRect(18, 12, 1, 1);
    g.fillStyle = '#8a8070'; g.fillRect(22, 4, 1, 2); g.fillRect(23, 6, 1, 1);
  } }));
  // 牙灯：血走った一つ目と縫われた口
  S.lamp = [false, true].map((hot) => makeSprite(22, 30, (g) => {
    g.fillStyle = '#2a2238'; g.fillRect(10, 0, 2, 5); g.fillRect(5, 4, 12, 3);
    g.fillStyle = hot ? '#ffd0c0' : '#c8c0b0'; g.beginPath(); g.ellipse(11, 14, 9, 9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a2238'; g.fillRect(5, 22, 12, 3);
    g.fillStyle = '#f4f1e8'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(6 + i * 3, 25); g.lineTo(7.5 + i * 3, 29); g.lineTo(9 + i * 3, 25); g.fill(); }
    eye(g, 11, 12, 5.5, hot ? '#ff2a1a' : '#120c1c');
  }, { inner: (g) => {
    g.fillStyle = '#ff4a5a'; g.fillRect(6, 11, 2, 1); g.fillRect(15, 13, 2, 1); g.fillRect(9, 8, 1, 1);
    g.fillStyle = OUT; g.fillRect(7, 19, 9, 1); for (let x = 7; x <= 15; x += 2) g.fillRect(x, 18, 1, 3);
    if (hot) { g.fillStyle = '#fff'; g.fillRect(11, 11, 1, 1); }
  } }));
  // 糸喰い：歯だらけの毛玉と細い指
  S.eater = [0, 1].map((fr) => makeSprite(26, 26, (g) => {
    g.fillStyle = '#120c1c';
    for (let k = 0; k < 4; k++) { const a = -0.6 + k * 0.4; g.fillRect(Math.round(13 + Math.cos(a) * 11), Math.round(15 + Math.sin(a) * 11), 2, 4 + fr); }
    g.fillStyle = '#2a1440'; g.beginPath();
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; const r = 8.5 + (i % 2 ? 2.8 : 0); g.lineTo(13 + Math.cos(a) * r, 12 + Math.sin(a) * r); }
    g.fill();
    g.fillStyle = '#6a1424'; g.beginPath(); g.ellipse(13, 14, 7, fr ? 5 : 2.2, 0, 0, Math.PI * 2); g.fill();
  }, { inner: (g) => {
    g.fillStyle = '#e8dcc8'; for (let i = 0; i < 6; i++) { g.fillRect(8 + i * 2, fr ? 10 : 12, 1, 2); g.fillRect(8 + i * 2, fr ? 17 : 15, 1, 1); }
    g.fillStyle = '#ffe27a'; g.fillRect(9, 6, 1, 1); g.fillRect(17, 5, 1, 1); g.fillRect(13, 4, 1, 1);
  } }));
  // 海蛇：白い鱗にところどころ目
  S.serpHead = makeSprite(20, 16, (g) => {
    g.fillStyle = '#c8c0b0'; g.beginPath(); g.ellipse(9, 8, 9, 6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8a8070'; g.beginPath(); g.moveTo(3, 4); g.lineTo(5, -1); g.lineTo(8, 3); g.lineTo(10, -1); g.lineTo(12, 3); g.fill();
    g.fillStyle = '#6a1424'; g.fillRect(9, 10, 10, 3);
  }, { inner: (g) => { g.fillStyle = '#e8dcc8'; g.fillRect(11, 5, 3, 3); g.fillStyle = '#ff2a1a'; g.fillRect(12, 6, 1, 1); g.fillStyle = '#e8dcc8'; for (let x = 10; x < 18; x += 2) g.fillRect(x, 10, 1, 1); } });
  S.serpSeg = makeSprite(12, 12, (g) => { g.fillStyle = '#c8c0b0'; g.beginPath(); g.ellipse(6, 6, 5, 5, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#8a8070'; g.fillRect(3, 7, 6, 2); }, { inner: (g) => { g.fillStyle = '#e8dcc8'; g.fillRect(4, 3, 2, 1); } });
  S.serpSegEye = makeSprite(12, 12, (g) => { g.fillStyle = '#c8c0b0'; g.beginPath(); g.ellipse(6, 6, 5, 5, 0, 0, Math.PI * 2); g.fill(); eye(g, 6, 5, 2.6); });
  S.serpSegBound = makeSprite(12, 12, (g) => { g.fillStyle = '#e8dcc8'; g.beginPath(); g.ellipse(6, 6, 5, 5, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#f0b030'; g.fillRect(5, 1, 2, 10); });
}

function glow(ctx, x, y, r, color) {
  // ドットの光輪（点の輪を2重に）
  ctx.fillStyle = color;
  for (const [rr, a, step] of [[r, 0.55, 3], [r * 0.62, 0.35, 2]]) {
    ctx.globalAlpha = a; const n = Math.max(8, Math.round(rr * 6.28 / step));
    for (let i = 0; i < n; i++) { const q = i / n * Math.PI * 2; ctx.fillRect(Math.round(x + Math.cos(q) * rr), Math.round(y + Math.sin(q) * rr), 1, 1); }
  }
  ctx.globalAlpha = 1;
}
function sparkle(ctx, x, y, s, color = '#fff') {
  ctx.fillStyle = color; ctx.fillRect(x, y - s, 1, s * 2 + 1); ctx.fillRect(x - s, y, s * 2 + 1, 1);
}

export function drawStarBell(ctx, x, y, t, s = 1) {
  buildObjects();
  const px = Math.round(x); const py = Math.round(y);
  glow(ctx, px, py, 9 * s, '#ffe27a');
  if (s === 1) blit(ctx, S.starBell, px - 6, py - 7);
  else { ctx.save(); ctx.translate(px - 6.5 * s, py - 7 * s); ctx.scale(s, s); ctx.drawImage(S.starBell, 0, 0); ctx.restore(); }
  const a = t * 3; if (Math.floor(t * 4) % 2) sparkle(ctx, px + Math.round(Math.cos(a) * 8 * s), py + Math.round(Math.sin(a) * 5 * s), 1, '#fff');
}

export function targetRing(ctx, x, y, t, dim) {
  const px = X(x); const py = X(y); const r = 8 + (Math.floor(t * 6) % 2);
  ctx.fillStyle = dim ? 'rgba(255,226,122,.45)' : '#ffe27a';
  for (let i = 0; i < 16; i++) {
    if ((i + Math.floor(t * 8)) % 4 === 0) continue;
    const a = i / 16 * Math.PI * 2; ctx.fillRect(px + Math.round(Math.cos(a) * r), py + Math.round(Math.sin(a) * r), 2, 2);
  }
}

// ───────────────────────── 章ごとのタイル ─────────────────────────
export const CH = [
  { // 夜明けの雲海・鯨の背
    skin: '#3a4c5c', skinD: '#26323e', skinL: '#56708e', deep: '#0a0e16', top: '#6a4630', topD: '#3a2418', topL: '#8a5a3a', barn: '#c8c0b0', barnD: '#8a8070', plank: '#5a3a28', plankD: '#3a2418',
    thorn: '#16303a', thornTip: '#a8b090', mist: '#a8b090', mistD: '#3a5a50',
  },
  { // 光る森
    skin: '#103026', skinD: '#0a1f18', skinL: '#184a38', deep: '#06120e', top: '#5a3a28', topD: '#3a2418', topL: '#6a4630', barn: '#5ff0d0', barnD: '#3fd8d0', plank: '#6a4630', plankD: '#3a2a2a',
    thorn: '#0c2a20', thornTip: '#c8ff9a', mist: '#5ff0d0', mistD: '#3fd8d0',
  },
  { // 夢の底
    skin: '#e8dcc8', skinD: '#b8a890', skinL: '#ffffff', deep: '#7a6a5a', top: '#a82038', topD: '#6a1424', topL: '#ff4a5a', barn: '#f0b030', barnD: '#a8641c', plank: '#3a0a18', plankD: '#1e0610',
    thorn: '#3a0a18', thornTip: '#ff4a5a', mist: '#ff4a5a', mistD: '#a82038',
  },
];
const tileCache = new Map();
function tile(ch, kind, v = 0) {
  const key = `${ch}:${kind}:${v}`;
  if (tileCache.has(key)) return tileCache.get(key);
  const P = CH[ch];
  const c = document.createElement('canvas'); c.width = 16; c.height = 16;
  const g = c.getContext('2d');
  const r = (n) => hash(v * 31 + n);
  switch (kind) {
    case 'fill': case 'top': {
      g.fillStyle = P.skin; g.fillRect(0, 0, 16, 16);
      // 斑点・鱗・縫い目
      g.fillStyle = P.skinD;
      if (ch === 0) { for (let i = 0; i < 3; i++) { const x = Math.floor(r(i) * 13); const y = Math.floor(r(i + 5) * 13) + 2; g.fillRect(x, y, 3, 1); g.fillRect(x + 1, y + 1, 1, 1); } if (r(9) < 0.4) { g.fillStyle = P.barn; g.fillRect(5, 8, 4, 3); g.fillStyle = P.barnD; g.fillRect(6, 9, 2, 2); } }
      else if (ch === 1) { for (let i = 0; i < 4; i++) { g.fillRect(Math.floor(r(i) * 15), Math.floor(r(i + 3) * 15), 2, 1); } if (r(8) < 0.35) { g.fillStyle = P.barn; g.fillRect(Math.floor(r(7) * 12) + 2, 10, 1, 4); g.fillRect(Math.floor(r(7) * 12) + 1, 13, 3, 1); } }
      else { g.fillRect(0, 7, 16, 1); g.fillRect(Math.floor(r(1) * 14), 0, 1, 7); g.fillRect(Math.floor(r(2) * 14), 8, 1, 8); g.fillStyle = P.skinL; g.fillRect(1, 1, 2, 1); if (r(4) < 0.4) { g.fillStyle = P.barn; g.fillRect(5, 3, 1, 1); g.fillRect(7, 3, 1, 1); g.fillRect(6, 4, 1, 1); } }
      if (kind === 'top') {
        // 家の床：板張り（森は苔むし、奥の部屋は赤い絨毯）
        g.fillStyle = OUT; g.fillRect(0, 5, 16, 1);
        g.fillStyle = P.top; g.fillRect(0, 0, 16, 5);
        g.fillStyle = P.topL; g.fillRect(0, 0, 16, 1);
        g.fillStyle = P.topD; g.fillRect(0, 4, 16, 1);
        if (ch < 2) { g.fillRect([3, 11, 7, 14][v], 1, 1, 3); g.fillStyle = P.skinD; g.fillRect(0, 6, 16, 1); }
        else { g.fillStyle = '#f0b030'; for (let x = (v % 2) * 2; x < 16; x += 4) g.fillRect(x, 2, 1, 1); }
        if (ch === 1 && r(12) < 0.6) { g.fillStyle = '#2fa06a'; const x = Math.floor(r(13) * 12) + 1; g.fillRect(x, 0, 3, 1); g.fillRect(x + 1, -1, 1, 1); g.fillStyle = '#c8ff9a'; g.fillRect(x + 1, 0, 1, 1); }
      }
      break;
    }
    case 'plank': {
      g.fillStyle = OUT; g.fillRect(0, 0, 16, 6);
      g.fillStyle = P.plank; g.fillRect(0, 1, 16, 4);
      g.fillStyle = P.plankD; g.fillRect(0, 4, 16, 1); g.fillRect(v ? 7 : 11, 1, 1, 3);
      break;
    }
    case 'thorn': {
      g.fillStyle = P.thorn;
      for (let i = 0; i < 4; i++) { const h = 7 + (i % 2) * 4; for (let y = 0; y < h; y++) { const w = Math.max(1, Math.round((y / h) * 3)); g.fillRect(i * 4 + 2 - Math.floor(w / 2), 16 - h + y, w, 1); } }
      g.fillStyle = P.thornTip; for (let i = 0; i < 4; i++) g.fillRect(i * 4 + 2, 16 - (7 + (i % 2) * 4), 1, 1);
      break;
    }
    case 'bridge': {
      g.fillStyle = OUT; g.fillRect(0, 0, 16, 7);
      g.fillStyle = '#f0b030'; g.fillRect(0, 1, 16, 5); g.fillStyle = '#a8641c'; g.fillRect(7, 1, 1, 5); g.fillRect(0, 5, 16, 1); g.fillStyle = '#ffe27a'; g.fillRect(0, 1, 16, 1);
      break;
    }
    case 'door': {
      g.fillStyle = '#2a2238'; g.fillRect(2, 0, 12, 16); g.fillStyle = '#4a4060'; g.fillRect(3, 0, 3, 16); g.fillRect(10, 0, 3, 16);
      g.fillStyle = '#f0b030'; g.fillRect(2, 0, 1, 16); g.fillRect(13, 0, 1, 16); if (v) { g.fillRect(6, 4, 4, 4); g.fillStyle = OUT; g.fillRect(7, 6, 2, 1); }
      break;
    }
    case 'gate': {
      g.fillStyle = '#2a1440'; g.fillRect(3, 0, 10, 16); g.fillStyle = '#a06ad6'; for (let i = 0; i < 3; i++) g.fillRect(4 + i * 3, 0, 1, 16);
      break;
    }
    case 'cbridge': {
      g.fillStyle = OUT; g.fillRect(0, 0, 16, 6); g.fillStyle = '#a06ad6'; g.fillRect(0, 1, 16, 4); g.fillStyle = '#bfe4ff'; g.fillRect(0, 1, 16, 1); g.fillStyle = '#ffe27a'; g.fillRect(7, 2, 2, 2);
      break;
    }
    case 'leaf': {
      g.fillStyle = OUT; g.fillRect(0, 0, 16, 6); g.fillStyle = v ? '#e8503a' : '#ff8a3a'; g.fillRect(0, 1, 16, 4); g.fillStyle = '#a8641c'; g.fillRect(0, 3, 16, 1); for (let x = 1; x < 16; x += 4) g.fillRect(x, 2, 1, 1);
      break;
    }
    default: break;
  }
  tileCache.set(key, c);
  return c;
}

export function drawTiles(ctx, st, ch, c0, c1, r0, r1, t) {
  const P = CH[ch];
  const T = (c, r) => st.tiles[r]?.[c];
  for (let r = Math.max(0, r0); r <= Math.min(st.h - 1, r1); r++) {
    for (let c = Math.max(0, c0); c <= Math.min(st.w - 1, c1); c++) {
      const k = T(c, r); const x = c * 16; const y = r * 16;
      switch (k) {
        case '#': {
          const top = r > 0 && T(c, r - 1) !== '#';
          const v = Math.floor(hash(c * 7 + r * 13) * 4);
          ctx.drawImage(tile(ch, top ? 'top' : 'fill', v), x, y);
          if (c > 0 && T(c - 1, r) !== '#') { ctx.fillStyle = OUT; ctx.fillRect(x, y, 1, 16); ctx.fillStyle = P.skinL; ctx.fillRect(x + 1, y, 1, 16); }
          if (c < st.w - 1 && T(c + 1, r) !== '#') { ctx.fillStyle = OUT; ctx.fillRect(x + 15, y, 1, 16); ctx.fillStyle = P.skinD; ctx.fillRect(x + 14, y, 1, 16); }
          if (!top && r > 0 && T(c, r - 1) === '#' && r - 1 >= 0 && T(c, r - 2) !== '#') { ctx.fillStyle = P.skinD; ctx.fillRect(x, y, 16, 2); }
          if (!top && hash(c * 19 + r * 3) < 0.05 + (st.dread || 0) * 0.12) {
            // 壁の割れ目から覗く目（ときどきまばたき）
            ctx.fillStyle = P.skinD; ctx.fillRect(x + 3, y + 6, 1, 4); ctx.fillRect(x + 4, y + 9, 3, 1); ctx.fillRect(x + 12, y + 3, 1, 3);
            ctx.fillStyle = '#0a0408'; ctx.fillRect(x + 5, y + 6, 7, 3);
            if ((Math.floor(t * 0.9 + c * 0.37 + r) % 6) !== 0) { ctx.fillStyle = ch === 0 ? '#d8e0b0' : ch === 1 ? '#c8ff9a' : '#ff4a5a'; ctx.fillRect(x + 6, y + 7, 1, 1); ctx.fillRect(x + 10, y + 7, 1, 1); }
          } else if (!top && hash(c * 23 + r * 5) < 0.18) { ctx.fillStyle = P.skinD; ctx.fillRect(x + 2 + (c % 5), y + 4, 1, 5); ctx.fillRect(x + 3 + (c % 5), y + 8, 4, 1); }
          if (r >= 12) { ctx.fillStyle = P.deep; ctx.globalAlpha = (r - 11) * 0.25; ctx.fillRect(x, y, 16, 16); ctx.globalAlpha = 1; }
          break;
        }
        case '=': ctx.drawImage(tile(ch, 'plank', c % 2), x, y); break;
        case '^': ctx.drawImage(tile(ch, 'thorn'), x, y); break;
        case '~': {
          const top = T(c, r - 1) !== '~';
          ctx.fillStyle = P.mistD; ctx.globalAlpha = 0.6; ctx.fillRect(x, y + (top ? 5 : 0), 16, top ? 11 : 16);
          ctx.fillStyle = P.mist; ctx.globalAlpha = 0.85;
          if (top) for (let i = 0; i < 16; i++) { const h = 2 + Math.round(Math.sin(t * 3 + (x + i) * 0.4) * 1.5); ctx.fillRect(x + i, y + 5 - h, 1, h + 1); }
          ctx.globalAlpha = 1; break;
        }
        case 'X': {
          const cr = st.crumbles[`${c},${r}`];
          if (cr && cr.broken > 0) { ctx.fillStyle = 'rgba(255,138,58,.5)'; for (let i = 0; i < 16; i += 3) ctx.fillRect(x + i, y + 2, 1, 1); break; }
          const sh = cr && cr.t > 0 ? (Math.floor(t * 30) % 2 ? 1 : -1) : 0;
          ctx.drawImage(tile(ch, 'leaf', cr ? 1 : 0), x + sh, y);
          break;
        }
        case 'W': {
          ctx.fillStyle = 'rgba(244,241,232,.12)'; ctx.fillRect(x + 1, y, 14, 16);
          ctx.fillStyle = 'rgba(244,241,232,.75)';
          for (let i = 0; i < 2; i++) { const yy = Math.floor(((-t * 50 + i * 8 + hash(c * 5 + r) * 16) % 16 + 16) % 16); const xx = 3 + Math.floor(hash(c + i * 3) * 10); ctx.fillRect(x + xx, y + yy, 1, 3); }
          break;
        }
        case 'B': case 'b': {
          const on = st.groups[k === 'B' ? 0 : 1];
          if (on) ctx.drawImage(tile(ch, 'bridge'), x, y);
          else { ctx.fillStyle = 'rgba(255,226,122,.55)'; for (let i = 0; i < 16; i += 4) ctx.fillRect(x + i, y + 2, 2, 1); }
          break;
        }
        case 'D': case 'd': {
          const closed = !st.groups[k === 'D' ? 0 : 1];
          if (closed) ctx.drawImage(tile(ch, 'door', T(c, r - 1) !== k ? 1 : 0), x, y);
          else { ctx.fillStyle = 'rgba(255,226,122,.35)'; for (let i = 0; i < 16; i += 4) ctx.fillRect(x + 7, y + i, 2, 2); }
          break;
        }
        case 'T': {
          if (!clockOpen(st)) ctx.drawImage(tile(ch, 'gate'), x, y);
          else { ctx.fillStyle = 'rgba(160,106,214,.5)'; for (let i = 0; i < 16; i += 4) ctx.fillRect(x + 7, y + i, 2, 2); }
          break;
        }
        case 't': {
          if (clockOpen(st)) ctx.drawImage(tile(ch, 'cbridge'), x, y);
          else { ctx.fillStyle = 'rgba(160,106,214,.6)'; for (let i = 0; i < 16; i += 4) ctx.fillRect(x + i, y + 2, 2, 1); }
          break;
        }
        default: break;
      }
    }
  }
}

// ───────────────────────── もの ─────────────────────────
export function drawObjects(ctx, st, t, preview) {
  buildObjects();
  for (const sh of st.ships) blit(ctx, S.ship, X(sh.x) - 2, X(sh.y) - 18 + (Math.floor(t * 2) % 2));
  for (const c of st.checkpoints) {
    const x = X(c.x); const y = X(c.y + 40);
    blit(ctx, c.on ? S.cpOn : S.cpOff, x - 3, y - 20);
    if (c.on) glow(ctx, x + 4, y - 13, 8, '#ffd36a');
  }
  if (st.exit) {
    const open = !exitLocked(st); const x = X(st.exit.x); const y = X(st.exit.y);
    if (open) {
      ctx.fillStyle = 'rgba(255,226,122,.25)'; const sw = Math.floor(Math.sin(t * 0.8) * 6);
      for (let i = 0; i < 40; i++) ctx.fillRect(x + 6 + i, y - 44 + Math.round(i * sw / 40) - Math.floor(i / 6), 1, 3 + Math.floor(i / 3));
      glow(ctx, x, y - 42, 12, '#ffe27a');
    }
    blit(ctx, open ? S.lighthouseOpen : S.lighthouseShut, x - 10, y - 46);
    if (!open) { ctx.fillStyle = '#a06ad6'; ctx.fillRect(x - 1, y - 50, 3, 3); }
  }
  for (const sw of st.switches) {
    const x = X(sw.x); const base = X(sw.y);
    ctx.fillStyle = OUT; ctx.fillRect(x - 9, base - 46, 3, 46); ctx.fillRect(x + 6, base - 46, 3, 46); ctx.fillRect(x - 12, base - 49, 24, 4);
    ctx.fillStyle = sw.on ? '#f0b030' : '#4a4060'; ctx.fillRect(x - 8, base - 45, 1, 45); ctx.fillRect(x + 7, base - 45, 1, 45); ctx.fillRect(x - 11, base - 48, 22, 2);
    if (!sw.on) { ctx.fillStyle = 'rgba(255,226,122,.45)'; for (let yy = base - 40; yy < base; yy += 4) { ctx.fillRect(x - 5, yy, 1, 2); ctx.fillRect(x + 4, yy, 1, 2); } }
    const swing = sw.on ? Math.round(Math.sin(t * 8) * 2) : 0;
    ctx.fillStyle = '#d8283c'; ctx.fillRect(x, base - 45, 1, 8);
    blit(ctx, S.starBell, x - 6 + swing, base - 38);
    if (sw.on) glow(ctx, x, base - 30, 10, '#ffe27a');
  }
  for (const l of st.levers) {
    const x = X(l.x); const y = X(l.y);
    if (!l.on && Math.floor(t * 3) % 2) glow(ctx, x, y - 4, 9, '#ffe27a');
    blit(ctx, l.on ? S.leverOn : S.leverOff, x - 8, y - 10);
  }
  for (const b of st.bells) {
    const x = X(b.x); const y = X(b.y);
    const lit = b.clock ? b.ring > 0 : b.rung;
    if (lit) {
      ctx.fillStyle = 'rgba(255,226,122,.35)';
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + t * 0.6; for (let r = 16; r < 30; r += 2) ctx.fillRect(x + Math.round(Math.cos(a) * r), y + Math.round(Math.sin(a) * r), 1, 1); }
    }
    glow(ctx, x, y, lit ? 18 : 12, b.clock ? '#a06ad6' : '#ffe27a');
    blit(ctx, S.crescent, x - 13, y - 24);
    ctx.fillStyle = '#d8283c'; ctx.fillRect(x, y - 18, 1, 4);
    const swing = b.swing > 0 ? Math.round(Math.sin(t * 9) * 3 * b.swing) : 0;
    blit(ctx, b.clock ? S.clockBell : lit ? S.bigBellLit : S.bigBell, x - 13 + swing, y - 15);
    if (b.clock && b.ring > 0) { ctx.fillStyle = '#ffe27a'; const n = Math.round(16 * b.ring / 6); for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i / 16 * Math.PI * 2; ctx.fillRect(x + Math.round(Math.cos(a) * 17), y + Math.round(Math.sin(a) * 17), 2, 2); } }
  }
  for (const h of st.hooks) {
    if (h.gone) continue;
    const x = X(h.x); const y = X(h.y);
    if (h.fading && h.fade > 0 && Math.floor(t * 12) % 2) continue;
    glow(ctx, x, y, 9, h.fading ? '#bfe4ff' : '#ffe27a');
    blit(ctx, h.fading ? S.hookPale : S.hook, x - 6, y - 7 + (Math.floor(t * 2 + h.id) % 2));
    if (preview && preview.ref === h) targetRing(ctx, h.x, h.y, t);
  }
  for (const s of st.seeds) blit(ctx, S.seed, X(s.x) - 1, X(s.y) - 3);
  for (const s of st.stars) if (!s.got) drawStarBell(ctx, X(s.x), X(s.y) + (Math.floor(t * 3 + s.id) % 2), t);
}

// 夢の家の部屋（壁・窓・額縁）。タイルより先に描く
export function drawRoom(ctx, st, ch, c0, c1, yTop, yBot, t) { roomDraw(ctx, st, ch, c0, c1, yTop, yBot, t); }

// ───────────────────────── 敵 ─────────────────────────
export function warnMark(ctx, x, y, t) {
  if (Math.floor(t * 10) % 2) return;
  ctx.fillStyle = OUT; ctx.fillRect(x - 3, y - 7, 7, 10);
  ctx.fillStyle = '#ff2a1a'; ctx.fillRect(x - 2, y - 6, 5, 8);
  ctx.fillStyle = '#fff'; ctx.fillRect(x, y - 5, 1, 4); ctx.fillRect(x, y, 1, 1);
}
function bindMark(ctx, x, y, w, t) {
  ctx.fillStyle = '#ffe27a';
  for (let i = -1; i <= 1; i++) { const yy = y + i * 4; for (let xx = -w; xx <= w; xx += 2) if ((xx + Math.floor(t * 10)) % 6 !== 0) ctx.fillRect(x + xx, yy + Math.round(Math.sin(xx * 0.4 + i) * 1), 1, 1); }
}
function dizzy(ctx, x, y, t) {
  ctx.fillStyle = '#ffe27a';
  for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; ctx.fillRect(x + Math.round(Math.cos(a) * 6), y + Math.round(Math.sin(a) * 2), 2, 2); }
}

export function drawEnemy(ctx, e, t) {
  buildObjects();
  if (e.dead) return;
  const x = X(e.x); const y = X(e.y); const flip = e.face < 0;
  switch (e.kind) {
    case 'moth': {
      const img = e.state === 'warn' ? S.mothHot : S.moth[e.bound > 0 ? 0 : Math.floor(t * (e.state === 'dive' ? 20 : 8)) % 2];
      blit(ctx, img, x - 14, y - 11, flip);
      break;
    }
    case 'bee': {
      const dx = e.state === 'warn' ? (Math.floor(t * 30) % 2 ? 1 : -1) : 0;
      if (e.state === 'charge') { ctx.fillStyle = 'rgba(255,226,122,.7)'; for (let i = 0; i < 3; i++) ctx.fillRect(x - e.face * (14 + i * 4) - 4, y - 4 + i * 4, 6, 1); }
      blit(ctx, S.bee[Math.floor(t * 20) % 2], x - 14 + dx, y - 10 + (e.state === 'warn' ? 1 : 0), flip);
      break;
    }
    case 'lamp': {
      const hot = e.state === 'warn' || e.state === 'fire';
      if (e.beam && e.state === 'warn' && Math.floor(t * 12) % 2) { ctx.fillStyle = '#ffe27a'; const by = X(e.beam.y); for (let xx = X(e.beam.x0); xx < X(e.beam.x1); xx += 4) if ((xx + Math.floor(t * 20)) % 8 < 4) ctx.fillRect(xx, by, 2, 1); }
      if (e.beam && e.state === 'fire') { const by = X(e.beam.y); const x0 = X(e.beam.x0); const w = X(e.beam.x1) - x0; ctx.fillStyle = '#ff2a1a'; ctx.fillRect(x0, by - 3, w, 7); ctx.fillStyle = '#ffd0c0'; ctx.fillRect(x0, by - 2, w, 5); ctx.fillStyle = '#fff'; ctx.fillRect(x0, by - 1, w, 2); }
      glow(ctx, x, y, 14, hot ? '#ff2a1a' : '#7fc8e8');
      blit(ctx, S.lamp[hot ? 1 : 0], x - 11, y - 15, flip);
      break;
    }
    case 'serpent': {
      if (e.state === 'warn' || e.state === 'wait') {
        const k = e.state === 'warn';
        ctx.fillStyle = k ? '#f4f1e8' : 'rgba(244,241,232,.4)';
        const cx = X(e.x0) + 6; const sy = X(e.surf) + 3;
        for (let i = 0; i < 3; i++) { const r = Math.floor((t * 16 + i * 5) % 15); ctx.fillRect(cx - r, sy, 2, 1); ctx.fillRect(cx + r, sy, 2, 1); }
        if (k) warnMark(ctx, cx, sy - 12, t);
        return;
      }
      const [u0, u1] = serpentSpan(e);
      if (u1 <= u0) return;
      const seg = e.bound > 0 ? S.serpSegBound : S.serpSeg;
      let n = 0;
      for (let u = u0; u <= u1; u += 0.045) { const sx = X(e.x0 + u * (e.x1 - e.x0)); const sy = X(serpentY(e, u)); ctx.drawImage(e.bound > 0 ? seg : (n++ % 4 === 2 && Math.floor(t * 3 + n) % 5 ? S.serpSegEye : seg), sx - 6, sy - 6); }
      if (e.s < 1) { const hd = serpentHead(e); blit(ctx, S.serpHead, X(hd.x) - 10, X(hd.y) - 8); }
      return;
    }
    case 'eater': {
      blit(ctx, S.eater[e.alert || e.state === 'chew' ? Math.floor(t * 8) % 2 : 0], x - 13, y - 12, flip);
      break;
    }
    case 'window': {
      // 窓の外から巨大な顔がぬっと上がり、両手で窓台をつかみ、腕を部屋に伸ばす
      const g = monsterWindow(e); const hd = windowHand(e);
      drawMonster(ctx, g, { out: e.out, arm: e.arm, state: e.state, hx: X(hd.x), hy: X(hd.y), look: Math.sign(e.tx - e.x), id: e.id }, t, e.ch || 0);
      if (e.state === 'peek' && e.out > 0.3) warnMark(ctx, x, g.y0 - 12, t);
      return;
    }
    default: break;
  }
  if (e.bound > 0) bindMark(ctx, x, y, 12, t);
  if ((e.state === 'warn' && e.kind !== 'eater') || (e.kind === 'eater' && e.alert)) warnMark(ctx, x, y - 16, t);
  if (e.stun > 0 && !e.drag) dizzy(ctx, x, y - 12, t);
}

export function drawFray(ctx, f, top, bottom, t) {
  const x = X(f.x);
  ctx.save();
  if (f.dying > 0) ctx.globalAlpha = Math.max(0, f.dying / 2.5);
  for (let y = top; y < bottom; y += 2) {
    const j = Math.round(Math.sin(y * 0.2 + t * 6) * 3 + (hash(Math.floor(y / 4)) - 0.5) * 6);
    ctx.fillStyle = '#1e0610'; ctx.fillRect(x - 400, y, 400 + j - 8, 2);
    ctx.fillStyle = '#6a1424'; ctx.fillRect(x + j - 8, y, 6, 2);
    ctx.fillStyle = '#a82038'; ctx.fillRect(x + j - 2, y, 2, 2);
  }
  // 伸びてくる白い手
  for (let i = 0; i < 6; i++) {
    const y = Math.round(top + ((i * 53 + 20) % Math.max(1, bottom - top)));
    const reach = 6 + Math.round((Math.sin(t * 3 + i * 1.7) * 0.5 + 0.5) * 14);
    ctx.fillStyle = OUT; ctx.fillRect(x - 4, y - 2, reach + 4, 5);
    ctx.fillStyle = '#c8c0b0'; ctx.fillRect(x - 4, y - 1, reach + 3, 3);
    for (let k = -1; k <= 1; k++) { ctx.fillStyle = OUT; ctx.fillRect(x + reach - 1, y + k * 3 - 1, 6, 3); ctx.fillStyle = '#e8dcc8'; ctx.fillRect(x + reach, y + k * 3, 5, 1); }
  }
  // 目
  for (let i = 0; i < 5; i++) {
    const y = Math.round(top + (bottom - top) * (0.12 + i * 0.2) + Math.sin(t * 2 + i) * 4);
    const ex = x - 22 - (i % 2) * 14; const open = Math.floor(t * 2 + i * 1.3) % 6 ? 3 : 1;
    ctx.fillStyle = '#e8dcc8'; pxEllipse(ctx, ex, y, 7, open); ctx.fillStyle = OUT; ctx.fillRect(ex - 1, y - open + 1, 3, open * 2 - 1);
    ctx.fillStyle = '#ff2a1a'; ctx.fillRect(ex, y, 1, 1);
  }
  ctx.restore();
}

export function drawThread(ctx, from, to, color, phase, prog) {
  const x1 = from.x + (to.x - from.x) * prog; const y1 = from.y + (to.y - from.y) * prog;
  ctx.fillStyle = OUT; pxLine(ctx, from.x, from.y + 1, x1, y1 + 1, 1);
  ctx.fillStyle = color; pxLine(ctx, from.x, from.y, x1, y1, phase === 'hold' ? 2 : 1);
  ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(x1) - 1, Math.round(y1) - 1, 2, 2);
}

// ───────────────────────── 背景 ─────────────────────────
const SKY = [
  ['#0a0e16', '#0e1a24', '#16303a', '#24484a', '#3a5a50', '#6a7a5a'],
  ['#06120e', '#0a1f18', '#0e1c2a', '#103026', '#184a38', '#103026'],
  ['#0a0408', '#1e0610', '#3a0a18', '#6a1424', '#3a0a18', '#1e0610'],
];
function skyBands(ctx, ch, w, h, off) {
  const cols = SKY[ch]; const n = cols.length; const bh = Math.ceil(h / n);
  for (let i = 0; i < n; i++) {
    const y = i * bh + off;
    ctx.fillStyle = cols[i]; ctx.fillRect(0, y, w, bh + 2);
    if (i + 1 < n) pxDither(ctx, 0, y + bh - 3, w, 3, cols[i + 1], 0);
  }
  ctx.fillStyle = cols[0]; ctx.fillRect(0, 0, w, Math.max(0, off));
}
function stars(ctx, w, h, camX, t, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < 50; i++) {
    const x = Math.floor(((hash(i) * 2000 - camX * 0.03) % (w + 10) + w + 10) % (w + 10));
    const y = Math.floor(hash(i + 50) * h * 0.55);
    if ((Math.floor(t * 2 + i) % 7) === 0) continue;
    ctx.fillRect(x, y, 1, 1);
    if (hash(i + 9) < 0.12) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
  }
}
const layerCache = new Map();
function layer(ch, idx, h) {
  const key = `${ch}:${idx}:${h}`;
  if (layerCache.has(key)) return layerCache.get(key);
  const W = 320; const c = document.createElement('canvas'); c.width = W; c.height = h;
  const g = c.getContext('2d');
  const R = (n) => hash(ch * 1000 + idx * 100 + n);
  if (ch === 0) {
    if (idx === 0) { // 遠くを泳ぐ空鯨たち（背に町の影）
      g.save(); g.imageSmoothingEnabled = false; g.scale(0.5, 0.5); g.drawImage(whaleSprite('#16303a'), 60, 30); g.drawImage(whaleSprite('#16303a'), 400, 90); g.restore();
      g.fillStyle = '#16303a'; for (let k = 0; k < 5; k++) { g.fillRect(52 + k * 7, 20 - (k % 2) * 3, 5, 6 + (k % 2) * 3); g.fillRect(222 + k * 6, 50 - (k % 3), 4, 5 + (k % 2) * 2); }
      g.fillStyle = '#d8e0b0'; for (let k = 0; k < 5; k++) if (k % 2 === 0) g.fillRect(54 + k * 7, 23 - (k % 2) * 3, 1, 1);
      g.fillStyle = '#24484a'; for (let x = 0; x < W; x += 1) { const hh = 10 + Math.round(Math.sin(x * 0.05) * 4 + Math.sin(x * 0.13) * 2); g.fillRect(x, h - hh - 30, 1, hh + 30); }
    } else if (idx === 1) { // 鯨の背の眠る町：傾いた家々と灯る窓
      g.fillStyle = '#16303a'; g.fillRect(0, h - 26, W, 26);
      for (let i = 0; i < 10; i++) {
        const x = Math.floor(i * 32 + R(i) * 10); const hh = 22 + Math.floor(R(i + 9) * 30); const ww = 14 + Math.floor(R(i + 3) * 10);
        const lean = Math.round((R(i + 5) - 0.5) * 4);
        g.fillStyle = '#0e1a24';
        for (let y = 0; y < hh; y++) g.fillRect(x + Math.round(lean * y / hh), h - 26 - y, ww, 1);
        for (let y = 0; y < 8; y++) g.fillRect(x + lean - 2 + y, h - 26 - hh - y, Math.max(1, ww + 4 - y * 2), 1);
        g.fillRect(x + lean + ww - 5, h - 26 - hh - 12, 3, 6);
        for (let k = 0; k < 4; k++) {
          const wx = x + 3 + (k % 2) * (ww - 9); const wy = h - 30 - 6 - Math.floor(k / 2) * 12;
          if (wy < h - 26 - hh + 4) continue;
          const lit = R(i * 4 + k) < 0.55;
          g.fillStyle = lit ? '#d8e0b0' : '#0a0408'; g.fillRect(wx, wy, 4, 5);
          if (!lit && R(i * 4 + k + 40) < 0.5) { g.fillStyle = '#ffe27a'; g.fillRect(wx, wy + 2, 1, 1); g.fillRect(wx + 3, wy + 2, 1, 1); }
          if (lit) { g.fillStyle = '#6a7a5a'; g.fillRect(wx + 1, wy, 1, 5); g.fillRect(wx, wy + 2, 4, 1); }
        }
      }
    } else { // 手前のくすんだ雲
      for (let i = 0; i < 7; i++) { g.fillStyle = '#3a5a50'; pxDome(g, i * 52 + R(i) * 24, h, 30 + R(i + 4) * 14, 16 + R(i + 7) * 10); }
      for (let i = 0; i < 7; i++) { g.fillStyle = '#6a7a5a'; pxDome(g, i * 52 + R(i) * 24 - 6, h - 6, 16 + R(i + 4) * 8, 8 + R(i + 7) * 5); }
    }
  } else if (ch === 1) {
    if (idx === 0) { // 鯨の腹（天井）と垂れる光の蔓
      g.fillStyle = '#0e1c2a'; for (let x = 0; x < W; x++) { const hh = 26 + Math.round(Math.sin(x * 0.04) * 6); g.fillRect(x, 0, 1, hh); }
      g.fillStyle = '#1a3a5a'; for (let x = 0; x < W; x += 24) g.fillRect(x, 0, 2, 22);
      g.fillStyle = '#5ff0d0'; for (let i = 0; i < 14; i++) { const x = Math.floor(R(i) * W); const len = 10 + Math.floor(R(i + 30) * 40); for (let y = 24; y < 24 + len; y += 2) g.fillRect(x + Math.round(Math.sin(y * 0.2) * 1), y, 1, 1); g.fillRect(x - 1, 24 + len, 3, 2); }
      g.fillStyle = '#103026'; for (let i = 0; i < 12; i++) { const x = i * 28 + R(i) * 10; g.fillRect(x, h - 120, 6, 120); pxDome(g, x + 3, h - 118, 14, 20); }
      for (let i = 0; i < 12; i++) { if (R(i + 60) < 0.45) { const x = Math.floor(i * 28 + R(i) * 10); const y = h - 70 - Math.floor(R(i + 61) * 30); g.fillStyle = '#06120e'; g.fillRect(x, y - 2, 6, 6); g.fillStyle = '#c8ff9a'; g.fillRect(x + 1, y, 1, 1); g.fillRect(x + 4, y, 1, 1); } }
      g.fillStyle = '#184a38'; for (let i = 0; i < 6; i++) { const x = Math.floor(R(i + 80) * W); const y = 30 + Math.floor(R(i + 81) * 30); g.fillRect(x, 24, 1, y - 24); pxEllipse(g, x, y + 4, 3, 5); }
    } else if (idx === 1) { // 巨大な光るきのこ
      for (let i = 0; i < 4; i++) {
        const x = 40 + i * 80 + R(i) * 20; const hh = 40 + R(i + 5) * 40;
        g.fillStyle = '#184a38'; g.fillRect(x - 3, h - hh, 6, hh);
        g.fillStyle = '#3fd8d0'; pxDome(g, x, h - hh, 18 + R(i) * 8, 10 + R(i + 2) * 4);
        g.fillStyle = '#5ff0d0'; pxDome(g, x - 3, h - hh - 2, 10, 5);
        g.fillStyle = '#c8ff9a'; g.fillRect(x - 8, h - hh - 5, 2, 2); g.fillRect(x + 6, h - hh - 3, 2, 2);
      }
      g.fillStyle = '#0c2a20'; for (let x = 0; x < W; x++) { const hh = 14 + Math.round(Math.sin(x * 0.08) * 4); g.fillRect(x, h - hh, 1, hh); }
    } else {
      g.fillStyle = '#06120e'; for (let i = 0; i < 6; i++) { const x = i * 60 + R(i) * 30; g.fillRect(x, 0, 10, h); pxDome(g, x + 5, h, 18, 10); }
      g.fillStyle = '#2fa06a'; for (let i = 0; i < 20; i++) g.fillRect(Math.floor(R(i + 50) * W), h - 2 - Math.floor(R(i + 70) * 6), 1, 3);
    }
  } else {
    if (idx === 0) { // 浮かぶ骨の島と歯車
      for (let i = 0; i < 3; i++) {
        const x = 50 + i * 110; const y = 112 + R(i) * 16;
        g.fillStyle = '#3a0a18'; pxEllipse(g, x, y, 22, 5); for (let k = 0; k < 6; k++) g.fillRect(x - 14 + k * 5, y, 3, 6 + Math.floor(R(i * 7 + k) * 8));
        g.fillStyle = '#6a1424'; g.fillRect(x - 18, y - 4, 36, 2);
      }
      const gx = 260; const gy = 30; g.fillStyle = '#3a0a18'; pxEllipse(g, gx, gy, 14, 14); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.fillRect(gx + Math.round(Math.cos(a) * 15) - 2, gy + Math.round(Math.sin(a) * 15) - 2, 4, 4); }
      g.fillStyle = '#1e0610'; pxEllipse(g, gx, gy, 6, 6);
    } else if (idx === 1) {
      // 果てしなく続く窓の壁
      g.fillStyle = '#3a0a18'; g.fillRect(0, h - 64, W, 64);
      g.fillStyle = '#1e0610'; g.fillRect(0, h - 66, W, 3);
      for (let i = 0; i < 16; i++) {
        const x = i * 20 + 4; const y = h - 56 + (i % 2) * 6;
        g.fillStyle = '#6a1424'; g.fillRect(x - 1, y - 1, 12, 18);
        g.fillStyle = '#0a0408'; g.fillRect(x, y, 10, 16);
        g.fillStyle = '#6a1424'; g.fillRect(x + 4, y, 2, 16);
        if (R(i + 20) < 0.35) { g.fillStyle = '#c8c0b0'; pxEllipse(g, x + 5, y + 9, 3, 5); g.fillStyle = '#0a0408'; g.fillRect(x + 3, y + 7, 1, 2); g.fillRect(x + 6, y + 7, 1, 2); g.fillRect(x + 4, y + 11, 2, 1); }
        else if (R(i + 40) < 0.4) { g.fillStyle = '#ff4a5a'; g.fillRect(x + 2, y + 6, 1, 1); g.fillRect(x + 7, y + 6, 1, 1); }
      }
      g.fillStyle = '#f0b030'; for (let x = 0; x < W; x += 6) g.fillRect(x, h - 66, 3, 1);
    } else {
      g.fillStyle = '#1e0610'; for (let i = 0; i < 6; i++) { const x = i * 60 + R(i) * 30; pxDome(g, x, h, 26, 18 + R(i + 1) * 12); }
    }
  }
  layerCache.set(key, c);
  return c;
}
function drawLayer(ctx, img, camX, par, y, w) {
  const off = Math.floor(((camX * par) % img.width + img.width) % img.width);
  for (let x = -off; x < w; x += img.width) ctx.drawImage(img, x, Math.round(y));
}

function bigEye(ctx, cx, cy, r, t, a) {
  ctx.globalAlpha = a;
  ctx.fillStyle = '#e8dcc8';
  for (let y = -Math.round(r * 0.6); y <= Math.round(r * 0.6); y++) { const hw = Math.round(r * 1.5 * (1 - (y / (r * 0.62)) ** 2)); if (hw > 0) ctx.fillRect(cx - hw, cy + y, hw * 2, 1); }
  const look = Math.round(Math.sin(t * 0.3) * r * 0.15);
  ctx.fillStyle = '#a8641c'; pxEllipse(ctx, cx + look, cy, r * 0.5, r * 0.5);
  ctx.fillStyle = '#f0b030'; pxEllipse(ctx, cx + look, cy, r * 0.4, r * 0.4);
  ctx.fillStyle = '#ffe27a'; pxEllipse(ctx, cx + look - 2, cy - 2, r * 0.2, r * 0.2);
  ctx.fillStyle = OUT; ctx.fillRect(cx + look - 2, cy - Math.round(r * 0.36), 5, Math.round(r * 0.72));
  ctx.fillStyle = '#fff'; ctx.fillRect(cx + look - Math.round(r * 0.2), cy - Math.round(r * 0.2), 3, 3);
  ctx.fillStyle = '#7a6a5a';
  for (let x = -Math.round(r * 1.5); x <= Math.round(r * 1.5); x++) { const y = Math.round(-r * 0.6 * (1 - (x / (r * 1.5)) ** 2)); ctx.fillRect(cx + x, cy + y - 1, 1, 2); }
  ctx.globalAlpha = 1;
}
function cracks(ctx, w, h, camX, k) {
  for (let i = 0; i < 4; i++) {
    let x = Math.floor(((hash(i + 90) * w * 2 - camX * 0.08) % (w + 80) + w + 80) % (w + 80)) - 40; let y = 0;
    for (let s = 0; s < 8; s++) {
      const nx = x + Math.round((hash(i * 7 + s) - 0.5) * 24); const ny = y + Math.round(h * 0.07);
      ctx.fillStyle = '#ff4a5a'; ctx.globalAlpha = k; pxLine(ctx, x, y, nx, ny, 1);
      ctx.fillStyle = '#f0b030'; ctx.fillRect(Math.round((x + nx) / 2) - 2, Math.round((y + ny) / 2), 5, 1);
      x = nx; y = ny;
    }
  }
  ctx.globalAlpha = 1;
}

export function drawBackground(ctx, ch, camX, camY, w, h, t, opts = {}) {
  const horizon = Math.round(h * 0.62 - (camY + h - 224) * 0.12);
  skyBands(ctx, ch, w, Math.max(h, 220), Math.min(0, horizon - Math.round(h * 0.62)));
  stars(ctx, w, h, camX, t, ch === 0 ? '#d8e0b0' : ch === 1 ? '#c8ff9a' : '#ffd0c0');
  if (ch === 0) {
    // 眠る目のある青白い月
    const sx = Math.round(w * 0.78); const sy = horizon - 64;
    ctx.fillStyle = '#3a5a50'; pxEllipse(ctx, sx, sy, 24, 24);
    ctx.fillStyle = '#d8e0b0'; pxEllipse(ctx, sx, sy, 20, 20);
    ctx.fillStyle = '#a8b090'; pxEllipse(ctx, sx - 7, sy - 8, 4, 3); pxEllipse(ctx, sx + 9, sy + 7, 3, 2); pxEllipse(ctx, sx - 10, sy + 9, 2, 2);
    const open = Math.floor(t * 0.5) % 7 === 0 ? Math.min(3, Math.floor((t * 0.5 % 1) * 12)) : 0;
    ctx.fillStyle = '#120c1c'; ctx.fillRect(sx - 8, sy + 1, 17, 1);
    for (let k = -3; k <= 3; k++) ctx.fillRect(sx + k * 2 + 1, sy + 2, 1, 1 + (k % 2 ? 0 : 1));
    if (open) { ctx.fillStyle = '#e8dcc8'; pxEllipse(ctx, sx, sy + 1, 7, open); ctx.fillStyle = '#ff2a1a'; ctx.fillRect(sx - 1, sy, 3, Math.max(1, open)); }
  }
  if (ch === 2 && (opts.eye ?? 0) > 0) bigEye(ctx, Math.round(w * 0.6 - (camX * 0.03) % 60), Math.round(h * 0.26), Math.round(Math.min(w, h) * 0.18), t, opts.eye);
  if (ch === 2 && (opts.cracks ?? 0) > 0) cracks(ctx, w, h, camX, opts.cracks);
  drawLayer(ctx, layer(ch, 0, 160), camX, 0.12, horizon - 130, w);
  if (ch === 2 && (opts.gold ?? 0) > 0) { ctx.globalAlpha = opts.gold * 0.6; pxDither(ctx, 0, horizon - 10, w, 30, '#f0b030', 0); ctx.globalAlpha = 1; }
  drawLayer(ctx, layer(ch, 1, 120), camX, 0.3, horizon - 70, w);
  drawLayer(ctx, layer(ch, 2, 60), camX, 0.55, horizon + 16, w);
  const under = horizon + 76;
  if (under < h) { ctx.fillStyle = ch === 0 ? '#3a5a50' : ch === 1 ? '#06120e' : '#1e0610'; ctx.fillRect(0, under, w, h - under); }
  // 漂う光
  ctx.fillStyle = ch === 0 ? '#d8e0b0' : ch === 1 ? '#c8ff9a' : '#f0b030';
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(((hash(i + 300) * w * 3 - camX * 0.5 + Math.sin(t * 0.5 + i) * 10) % (w + 10) + w + 10) % (w + 10));
    const y = Math.floor(horizon - 70 + hash(i + 400) * 110 + Math.sin(t + i) * 4);
    if ((Math.floor(t * 3 + i) % 4) !== 0) ctx.fillRect(x, y, 1, 1);
  }
}

// ───────────────────────── 霧鯨（ドット絵の鯨） ─────────────────────────
const whaleCache = new Map();
function whaleSprite(kind) {
  if (whaleCache.has(kind)) return whaleCache.get(kind);
  const sil = kind !== 'main';
  const col = kind === 'main' ? null : kind;
  const img = makeSprite(200, 84, (g) => {
    const body = col || '#9fc0d4'; const belly = col || '#d6e8f0'; const dark = col || '#7896b4';
    // 尾びれ（右上へ反る）
    g.fillStyle = dark;
    g.beginPath(); g.moveTo(160, 30); g.quadraticCurveTo(178, 22, 196, 4); g.quadraticCurveTo(186, 22, 199, 34); g.quadraticCurveTo(180, 32, 164, 40); g.closePath(); g.fill();
    // 胴：大きな頭から尾へ細くなり、上へ反る
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(8, 50);
    g.bezierCurveTo(4, 22, 40, 14, 80, 20);
    g.bezierCurveTo(120, 24, 145, 26, 166, 32);
    g.bezierCurveTo(168, 36, 166, 40, 160, 42);
    g.bezierCurveTo(130, 54, 100, 70, 60, 72);
    g.bezierCurveTo(30, 74, 10, 66, 8, 50);
    g.fill();
    if (!sil) {
      // 白い腹と畝（うね）
      g.fillStyle = belly;
      g.beginPath(); g.moveTo(12, 56); g.bezierCurveTo(30, 70, 80, 72, 130, 52); g.bezierCurveTo(100, 66, 50, 76, 12, 60); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(10, 50); g.bezierCurveTo(30, 64, 90, 64, 140, 46); g.lineTo(130, 52); g.bezierCurveTo(80, 70, 30, 70, 12, 58); g.closePath(); g.fill();
      g.fillStyle = dark; for (let i = 0; i < 9; i++) g.fillRect(18 + i * 11, 58 + Math.round(Math.sin(i * 0.5) * 2), 7, 1);
      // 胸びれ
      g.fillStyle = dark; g.beginPath(); g.moveTo(46, 62); g.quadraticCurveTo(60, 80, 78, 82); g.quadraticCurveTo(66, 70, 62, 60); g.closePath(); g.fill();
      // 背の草原
      g.fillStyle = '#4fb08a'; g.beginPath(); g.moveTo(30, 20); g.bezierCurveTo(60, 12, 110, 18, 140, 26); g.lineTo(138, 29); g.bezierCurveTo(110, 22, 60, 17, 30, 23); g.closePath(); g.fill();
      // フジツボ
      g.fillStyle = '#e8e0cc'; for (const [x, y] of [[40, 30], [52, 27], [96, 30], [120, 36], [70, 26]]) { g.beginPath(); g.ellipse(x, y, 3, 2, 0, 0, Math.PI * 2); g.fill(); }
    }
  }, { outline: sil ? null : '#120c1c', inner: sil ? null : (g) => {
    g.fillStyle = '#120c1c'; g.fillRect(24, 44, 4, 3); g.fillStyle = '#ffe27a'; g.fillRect(25, 44, 1, 1);
    g.fillStyle = '#7896b4'; g.fillRect(12, 53, 14, 1);
    g.fillStyle = '#b0a890'; for (const [x, y] of [[40, 30], [52, 27], [96, 30], [120, 36], [70, 26]]) g.fillRect(x, y, 1, 1);
    g.fillStyle = '#d6e8f0'; g.fillRect(40, 21, 30, 1);
  } });
  whaleCache.set(kind, img);
  return img;
}
export function drawWhaleSprite(ctx, x, y, kind = 'main', scale = 1, t = 0) {
  const img = whaleSprite(kind);
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), Math.round(y + Math.sin(t * 0.8) * 2 * scale)); if (scale !== 1) ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0); ctx.restore();
}

// ───────────────────────── タイトルの大鯨 ─────────────────────────
export function drawTitleWhale(ctx, cx, cy, s, t) {
  const sc = s >= 1.6 ? 2 : 1;
  const x = cx - 100 * sc; const y = cy - 42 * sc;
  drawWhaleSprite(ctx, x, y, 'main', sc, t);
  // 背中の小さな灯台と旗
  const lx = Math.round(x + 92 * sc); const ly = Math.round(y + 20 * sc + Math.sin(t * 0.8) * 2 * sc);
  ctx.fillStyle = OUT; ctx.fillRect(lx - 1, ly - 15, 7, 16); ctx.fillStyle = '#f4f1e8'; ctx.fillRect(lx, ly - 14, 5, 14); ctx.fillStyle = '#d8283c'; ctx.fillRect(lx, ly - 9, 5, 2);
  glow(ctx, lx + 2, ly - 17, 9, '#ffe27a'); ctx.fillStyle = '#ffe27a'; ctx.fillRect(lx + 1, ly - 18, 3, 3);
  ctx.fillStyle = OUT; ctx.fillRect(lx + 10, ly - 13, 1, 13); ctx.fillStyle = '#d8283c'; ctx.fillRect(lx + 11, ly - 13 + (Math.floor(t * 4) % 2), 6, 3);
}

// 星座ノートの敵の絵（60×46ドット）
export function drawFoeIcon(g, kind, t) {
  buildObjects();
  g.fillStyle = '#1e0610'; g.fillRect(0, 0, 60, 46);
  g.fillStyle = '#2a2238'; for (let x = 0; x < 60; x += 2) g.fillRect(x, 40 + (x % 4 ? 0 : 1), 2, 6);
  if (kind === 'fray') { drawFray(g, { x: 44 / K, dying: 0 }, 0, 46, t); return; }
  if (kind === 'serpent') {
    for (let i = 0; i < 7; i++) g.drawImage(S.serpSeg, 6 + i * 5, 30 - Math.round(Math.sin(i / 6 * Math.PI) * 16));
    blit(g, S.serpHead, 40, 20); return;
  }
  if (kind === 'window') {
    const win = { x0: 13, x1: 47, y0: 6, y1: 40 };
    drawRoomScreen(g, 60, 46, 0, win, 42, t);
    drawMonster(g, win, { out: 1, arm: 0, state: 'peek', hx: 0, hy: 0, look: -1, id: 1 }, 0.3, 0);
    return;
  }
  const e = { kind, x: 30 / K, y: 24 / K, r: 16, face: 1, state: kind === 'lamp' ? 'idle' : 'hover', bound: 0, stun: 0, alert: kind === 'eater', beam: null };
  drawEnemy(g, e, t);
}

// タイトル：子ども部屋の大きな窓。外には鯨、ときどき巨大な顔がぬっと覗く
export function drawTitleRoom(ctx, w, h, win, floorY, out, arm, hand, t) {
  drawRoomScreen(ctx, w, h, 0, win, floorY, t);
  drawMonster(ctx, win, { out, arm, state: 'peek', hx: hand[0], hy: hand[1], look: -1, id: 1 }, t, 0);
  drawFloorScreen(ctx, w, floorY, h, 0);
}
export { drawMonster, monsterWindow };

// 霧をかぶせる（ディザ）
export function fog(ctx, x, y, w, h, color, phase = 0) { pxDither(ctx, x, y, w, h, color, phase); }

// ───────────────────────── 目覚め：現実の部屋（結末） ─────────────────────────
export function drawBedroom(g, kind, t) {
  const W = 160; const H = 96;
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#0a0408'; g.fillRect(0, 0, W, H);
  // 壁と床
  g.fillStyle = '#16101f'; g.fillRect(0, 0, W, 66);
  g.fillStyle = '#1e1628'; for (let x = 0; x < W; x += 12) g.fillRect(x, 0, 1, 66);
  g.fillStyle = '#120c1c'; g.fillRect(0, 66, W, 30);
  g.fillStyle = '#1a1220'; for (let y = 70; y < H; y += 6) g.fillRect(0, y, W, 1);
  // 窓（外は夜。鯨はいない）
  g.fillStyle = '#2a2238'; g.fillRect(14, 12, 30, 24); g.fillStyle = '#0e1a24'; g.fillRect(16, 14, 26, 20);
  g.fillStyle = '#2a2238'; g.fillRect(28, 14, 2, 20); g.fillRect(16, 23, 26, 2);
  g.fillStyle = '#d8e0b0'; g.fillRect(20, 17, 3, 3);
  // ベッドと毛布
  g.fillStyle = '#3a2418'; g.fillRect(8, 52, 54, 16); g.fillRect(8, 44, 4, 24);
  g.fillStyle = '#c8c0b0'; g.fillRect(12, 48, 50, 8);
  g.fillStyle = '#6a7a5a'; g.fillRect(24, 50, 38, 10);
  // ミオ（毛布から顔だけ）
  g.fillStyle = '#ffd890'; g.fillRect(14, 45, 9, 6); g.fillStyle = '#ffd2b0'; g.fillRect(16, 47, 6, 4);
  g.fillStyle = '#120c1c'; g.fillRect(19, 48, 1, 1); g.fillRect(21, 48, 1, 1);
  if (kind === 'sew') { g.fillStyle = '#f0b030'; g.fillRect(24, 52, 3, 3); if (Math.floor(t * 2) % 2) { g.fillStyle = '#ffe27a'; g.fillRect(25, 51, 1, 1); } }
  // 床の絵本
  if (kind === 'return') { g.fillStyle = '#c8c0b0'; for (const [x, y] of [[70, 80], [78, 84], [64, 86], [86, 78], [92, 86]]) g.fillRect(x, y, 5, 3); g.fillStyle = '#5a7488'; g.fillRect(72, 81, 2, 1); }
  else { g.fillStyle = '#5a7488'; g.fillRect(72, 80, 12, 7); g.fillStyle = '#c8c0b0'; g.fillRect(74, 82, 6, 1); }
  // ドア：下の隙間から光、足の影
  g.fillStyle = '#3a2418'; g.fillRect(112, 18, 30, 50); g.fillStyle = '#2a1a14'; g.fillRect(114, 20, 26, 46);
  g.fillStyle = '#c9963a'; g.fillRect(134, 44, 2, 2);
  const lightA = 0.6 + 0.2 * Math.sin(t * 3);
  g.globalAlpha = lightA; g.fillStyle = '#ffd890'; g.fillRect(112, 67, 30, 2); g.fillRect(104, 69, 46, 1); g.globalAlpha = 1;
  // 足の影（ふたつ）。ときどき、ずれる
  const sh = Math.floor(t * 0.7) % 4 === 0 ? 1 : 0;
  g.fillStyle = '#0a0408'; g.fillRect(118 + sh, 67, 6, 2); g.fillRect(129 + sh, 67, 6, 2);
  if (kind === 'return') { g.fillStyle = '#c9963a'; g.fillRect(133, 43 + (Math.floor(t * 2) % 2), 4, 2); }
}

// 遅い面で一瞬だけ見える大人の影
export function drawShadowFigure(g, x, y, h) {
  g.fillStyle = '#0a0408';
  const s = h / 60;
  g.fillRect(x - 4 * s, y - h, 8 * s, 8 * s);
  g.fillRect(x - 9 * s, y - h + 9 * s, 18 * s, h - 9 * s);
  g.fillRect(x - 12 * s, y - h + 12 * s, 3 * s, 26 * s); g.fillRect(x + 9 * s, y - h + 12 * s, 3 * s, 26 * s);
  g.fillStyle = '#ff2a1a'; g.fillRect(x - 2 * s, y - h + 3 * s, s, s); g.fillRect(x + 1 * s, y - h + 3 * s, s, s);
}
