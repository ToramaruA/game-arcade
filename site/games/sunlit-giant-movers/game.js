import {
  LEVELS, REGIONS, KINDS, KIND_IDS, PATTERNS, TOTAL_SEEDS, CAPACITY, SCHEMA,
  createState, cloneState, act, loadOf, isHeavy, deliveredCount, allDelivered, seedCount, delivered,
  emptyProgress, recordClear, totalSeeds, patternsUnlocked, clearedCount, levelUnlocked, shareText, hints, lockLabel,
  validSaved, solve, neighbor, animalAt, isOpen,
} from './logic.js';
import {
  TW, TH, HZ, THEMES, LOOKS, iso, drawSky, drawBeast, boardBounds, drawCell, drawPad, drawPadPreview,
  drawHouse, drawAnimal, drawKoro, drawRock, flower, PATTERN_LOOKS,
} from './render.js';
import { createAudio } from './audio.js';

// ---------- 保存 ----------
const PREFIX = 'sunlit-giant-movers:';
const store = {
  get(k) { try { return localStorage.getItem(PREFIX + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(PREFIX + k, v); } catch { /* 保存できなくても遊べる */ } },
  del(k) { try { localStorage.removeItem(PREFIX + k); } catch { /* なにもしない */ } },
};
const audio = createAudio(store);
let progress = emptyProgress();
try { const p = JSON.parse(store.get('progress') || 'null'); if (p && p.v === SCHEMA) progress = { ...emptyProgress(), ...p }; else if (p && p.levels) progress = { ...emptyProgress(), ...p, v: SCHEMA }; } catch { /* 新規 */ }
const settings = { shake: true, calm: false, pattern: 0 };
try { Object.assign(settings, JSON.parse(store.get('settings') || '{}')); } catch { /* 初期値 */ }
if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && store.get('settings') === null) settings.calm = true;
const saveProgress = () => store.set('progress', JSON.stringify(progress));
const saveSettings = () => store.set('settings', JSON.stringify(settings));

// ---------- 要素 ----------
const $ = (id) => document.getElementById(id);
const cv = $('cv'); const ctx = cv.getContext('2d');
const stage = $('stage');
const params = new URLSearchParams(location.search);
const OG = params.has('og');

// 動物アイコン（DOM 用の画像）
const icons = {};
for (const k of KIND_IDS) {
  const c = document.createElement('canvas'); c.width = 96; c.height = 96; const g = c.getContext('2d');
  drawAnimal(g, k, 52, 84, 2.2 / (KINDS[k].weight === 1 ? 0.62 : KINDS[k].weight === 2 ? 0.8 : 0.98) * 0.62, { noShadow: true, sit: true });
  icons[k] = c.toDataURL();
}

// ---------- 状態 ----------
let li = 0; let level = LEVELS[0]; let state = createState(level); let hist = [];
let anim = null; let pending = null; let walkQueue = []; let busy = false;
let fx = []; let labels = []; let shake = 0; let sneezeT = -9; let liftT = -9; let lastStuck = null;
let userZoom = 1; let pan = { x: 0, y: 0 }; let cam = null;
let titleOn = !OG; let modalOpen = false;
const now = () => performance.now() / 1000;

function saveCurrent() {
  store.set('cur', JSON.stringify({ v: SCHEMA, level: level.id, state, hist: hist.slice(-300) }));
}
function loadLevel(i, { keep = false } = {}) {
  li = i; level = LEVELS[i];
  state = createState(level); hist = [];
  if (keep) {
    try {
      const raw = JSON.parse(store.get('cur') || 'null');
      if (raw && raw.level === level.id && raw.v !== SCHEMA) toast('データの形式が変わったので、この面は最初から始めます');
      const sv = validSaved(level, raw);
      if (sv && !sv.state.cleared) { state = sv.state; hist = Array.isArray(sv.hist) ? sv.hist : []; }
    } catch { /* 最初から */ }
  }
  anim = null; pending = null; walkQueue = []; fx = []; labels = []; busy = false; lastStuck = null;
  userZoom = 1; pan = { x: 0, y: 0 }; cam = null; coachStart = now();
  computeBounds();
  saveCurrent(); updateHud(); hidePick();
}

// ---------- 画面サイズ ----------
let W = 0; let H = 0; let DPR = 1; let bounds = null;
function resize() {
  const r = stage.getBoundingClientRect();
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = Math.max(100, r.width); H = Math.max(100, r.height);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
}
function computeBounds() { bounds = boardBounds(level); }
function camera() {
  const narrow = W < 520; const bw = bounds.x1 - bounds.x0 + (narrow ? 24 : 110); const bh = bounds.y1 - bounds.y0 + (narrow ? 20 : 60);
  const fit = Math.min(W / bw, H / bh);
  const minS = narrow ? 0.72 : 0.6;
  let scale = Math.min(1.7, Math.max(fit, minS)) * userZoom;
  const p = koroWorld();
  let cx = (bounds.x0 + bounds.x1) / 2; let cy = (bounds.y0 + bounds.y1) / 2 + 20;
  if (scale * bw > W + 4 || scale * bh > H + 4) {
    // 盤面が収まらないとき：コロにカメラを寄せる（端は盤面の範囲に留める）
    const hw = W / 2 / scale; const hh = H / 2 / scale;
    cx = clamp(p.x, bounds.x0 - 40 + hw, bounds.x1 + 40 - hw, (bounds.x0 + bounds.x1) / 2);
    cy = clamp(p.y - 20, bounds.y0 - 40 + hh, bounds.y1 + 60 - hh, (bounds.y0 + bounds.y1) / 2);
  }
  cx -= pan.x / scale; cy -= pan.y / scale;
  if (!cam || OG) cam = { x: cx, y: cy, s: scale };
  else { const k = settings.calm ? 1 : 0.18; cam.x += (cx - cam.x) * k; cam.y += (cy - cam.y) * k; cam.s += (scale - cam.s) * 0.25; }
  return cam;
}
function clamp(v, a, b, mid) { return a > b ? mid : Math.max(a, Math.min(b, v)); }
const toScreen = (wx, wy) => ({ x: W / 2 + (wx - cam.x) * cam.s, y: H / 2 + (wy - cam.y) * cam.s });
const toWorld = (sx, sy) => ({ x: (sx - W / 2) / cam.s + cam.x, y: (sy - H / 2) / cam.s + cam.y });

// ---------- コロの見た目の位置 ----------
const cellOf = (i) => level.cells[i];
function koroVisual() {
  const c = cellOf(state.pos);
  let x = c.x + 0.5; let y = c.y + 0.5; let h = c.h + (c.t === 'stair' ? 0.5 : 0); let walk = 0; let depth = c.x + c.y;
  if (anim && (anim.kind === 'move' || anim.kind === 'pad' || anim.kind === 'push')) {
    const u = Math.min(1, (now() - anim.t0) / anim.dur);
    const e = anim.kind === 'pad' ? u : 1 - (1 - u) * (1 - u);
    x = anim.from.x + (anim.to.x - anim.from.x) * e; y = anim.from.y + (anim.to.y - anim.from.y) * e;
    h = anim.from.h + (anim.to.h - anim.from.h) * e;
    if (anim.kind === 'pad') h += Math.sin(u * Math.PI) * (anim.heavy ? 0.9 : 3.4);
    walk = u; depth = Math.max(anim.from.x + anim.from.y, anim.to.x + anim.to.y) - 1;
  } else if (anim && anim.kind === 'bump') {
    const u = Math.min(1, (now() - anim.t0) / anim.dur);
    const k = Math.sin(u * Math.PI) * 0.18;
    const D = [[0, -1], [1, 0], [0, 1], [-1, 0]][anim.dir];
    x += D[0] * k; y += D[1] * k;
  }
  return { x, y, h, walk, depth };
}
function koroWorld() { const v = koroVisual(); return iso(v.x, v.y, v.h); }
function cellWorld(i, lift = 0) { const c = cellOf(i); return iso(c.x + 0.5, c.y + 0.5, c.h + lift); }

// ---------- 描画 ----------
let order = [];
function drawOrder() { order = level.cells.filter((c) => c.t !== 'void').sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.h - b.h || a.x - b.x); }
function frame() {
  const t = now();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const theme = THEMES[level.region];
  drawSky(ctx, W, H, theme, t, settings.calm);
  camera();
  let sx = 0; let sy = 0;
  if (shake > 0 && settings.shake && !settings.calm) { sx = (Math.random() - 0.5) * shake * 8; sy = (Math.random() - 0.5) * shake * 8; shake = Math.max(0, shake - 0.06); }
  const lift = liftAmount(t);
  ctx.setTransform(DPR * cam.s, 0, 0, DPR * cam.s, DPR * (W / 2 - cam.x * cam.s + sx), DPR * (H / 2 - cam.y * cam.s + sy - lift * cam.s));
  const sneeze = Math.max(0, 1 - (t - sneezeT) / 0.9);
  drawBeast(ctx, theme.beast, bounds, t, settings.calm, { sneeze });
  if (!order.length || order[0] && !level.cells.includes(order[0])) drawOrder();
  const kv = koroVisual(); let koroDrawn = false;
  const koroKey = kv.depth + 0.5;
  const targets = interactTargets();
  for (const c of order) {
    if (!koroDrawn && c.x + c.y > koroKey + 0.01) { drawKoroNow(kv, t); koroDrawn = true; }
    if (c.t === 'pad') drawPad(ctx, level, state, c, theme, t, settings.calm);
    else drawCell(ctx, level, state, c, theme, t, { reduce: settings.calm });
    const p = iso(c.x + 0.5, c.y + 0.5, c.h);
    if (targets.has(c.i)) ring(p.x, p.y, t, targets.get(c.i));
    if (c.t === 'station') {
      const k = animalAt(state, c.i);
      if (k >= 0 && !flying(k)) drawAnimal(ctx, level.animals[k].kind, p.x, p.y - 12, 1, { sit: true, bob: settings.calm ? 0 : Math.sin(t * 2 + k) * 0.6, flip: true });
    }
    if (c.t === 'home') {
      const k = c.owner; const done = delivered(level, state, k) && !flying(k);
      drawHouse(ctx, p.x, p.y - 2, level.animals[k].kind, done, t);
    }
    const ri = rockIndexAt(c.i);
    if (ri >= 0) { const rp = rockWorld(ri); drawRock(ctx, rp.x, rp.y); }
  }
  if (!koroDrawn) drawKoroNow(kv, t);
  // 予告（橋・葉の行き先）
  for (const c of level.cells) if (c.t === 'pad') drawPadPreview(ctx, level, state, c, t, settings.calm, nearPad(c));
  drawFx(t);
  if (anim && now() - anim.t0 >= anim.dur) finishAnim();
  requestAnimationFrame(frame);
}
function liftAmount(t) {
  const u = (t - liftT) / 1.6;
  if (u < 0 || u > 1) return 0;
  return Math.sin(u * Math.PI) * 26;
}
function drawKoroNow(kv, t) {
  const p = iso(kv.x, kv.y, kv.h);
  const riders = state.riders.filter((k) => !flying(k)).map((k) => level.animals[k].kind);
  const shownLoad = riders.reduce((n, k) => n + KINDS[k].weight, 0);
  const face = anim?.dir ?? state.face;
  drawKoro(ctx, p.x, p.y, { load: shownLoad, riders, t, face, walk: kv.walk, pattern: settings.pattern, bounce: !settings.calm });
}
function ring(x, y, t, kind) {
  const r = 24 + (settings.calm ? 0 : Math.sin(t * 5) * 3);
  ctx.save(); ctx.strokeStyle = kind === 'deliver' ? '#ff6f5a' : kind === 'board' ? '#ffb43c' : '#6fb7e8'; ctx.lineWidth = 3; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, 7); ctx.stroke(); ctx.restore();
}
function nearPad(c) { for (let d = 0; d < 4; d++) if (neighbor(level, state.pos, d) === c.i) return true; return false; }
// コロのとなりで「できること」がある場所（光る輪）
function interactTargets() {
  const m = new Map();
  if (anim || busy) return m;
  const load = loadOf(level, state);
  for (let d = 0; d < 4; d++) {
    const n = neighbor(level, state.pos, d); if (n < 0) continue;
    const c = cellOf(n);
    if (c.t === 'station') {
      const k = animalAt(state, n);
      if (k >= 0 && load + level.animals[k].weight <= CAPACITY) m.set(n, 'board');
      else if (k < 0 && state.riders.length) m.set(n, 'drop');
    }
    if (c.t === 'home' && state.riders.includes(c.owner)) m.set(n, 'deliver');
  }
  return m;
}
let rockAnim = null;
const rockIndexAt = (cell) => state.rocks.indexOf(cell);
function rockWorld(r) {
  const pos = state.rocks[r];
  if (rockAnim && rockAnim.to === pos) {
    const u = Math.min(1, (now() - rockAnim.t0) / rockAnim.dur);
    const a = cellWorld(rockAnim.from); const b = cellWorld(rockAnim.to);
    if (u >= 1) rockAnim = null;
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
  }
  return cellWorld(pos);
}

// ---------- 演出 ----------
let flyers = [];
const flying = (k) => flyers.some((f) => f.k === k && now() - f.t0 < f.dur);
function burst(x, y, n, colors, kind = 'petal', spread = 1) {
  if (settings.calm) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2; const v = (40 + Math.random() * 90) * spread;
    fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 60 * spread, life: 1 + Math.random() * 0.6, t0: now(), c: colors[i % colors.length], kind, r: 3 + Math.random() * 3 });
  }
}
function floatText(x, y, text, color = '#c4513a') { labels = [{ x, y, text, color, t0: now() }]; }
function drawFx(t) {
  const dt = 1 / 60;
  fx = fx.filter((p) => t - p.t0 < p.life);
  for (const p of fx) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; p.vx *= 0.98;
    const a = 1 - (t - p.t0) / p.life;
    ctx.globalAlpha = Math.max(0, a);
    if (p.kind === 'petal') flower(ctx, p.x, p.y, p.r, p.c);
    else { ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  flyers = flyers.filter((f) => t - f.t0 < f.dur + 0.05);
  for (const f of flyers) {
    const u = Math.min(1, (t - f.t0) / f.dur);
    const x = f.a.x + (f.b.x - f.a.x) * u; const y = f.a.y + (f.b.y - f.a.y) * u - Math.sin(u * Math.PI) * 40;
    drawAnimal(ctx, f.kind, x, y, 1, { sit: true, noShadow: true });
  }
  labels = labels.filter((l) => t - l.t0 < 1.4);
  for (const l of labels) {
    const u = (t - l.t0) / 1.4;
    ctx.globalAlpha = Math.min(1, (1 - u) * 3); ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.lineJoin = 'round'; ctx.strokeText(l.text, l.x, l.y - u * 30);
    ctx.fillStyle = l.color; ctx.fillText(l.text, l.x, l.y - u * 30);
  }
  ctx.globalAlpha = 1;
}

// ---------- 操作 ----------
function doAct(dir, pick, { fromWalk = false } = {}) {
  if (titleOn || modalOpen || state.cleared) return false;
  if (anim) { if (!fromWalk) { pending = { dir, pick }; walkQueue = []; } return false; }
  if (!fromWalk) walkQueue = [];
  hidePick();
  const r = act(level, state, dir, pick);
  if (!r.ok) {
    if (r.need === 'pick') { showPick(r, dir); return false; }
    state = { ...state, face: dir };
    anim = { kind: 'bump', t0: now(), dur: 0.16, dir };
    audio.sfx.bump();
    if (r.why === 'full') pulseLoad();
    toast(r.reason);
    walkQueue = [];
    return false;
  }
  hist.push(state);
  const prev = state; state = r.state;
  startAnim(prev, r.ev);
  saveCurrent(); updateHud();
  return true;
}
function startAnim(prev, ev) {
  const from = cellOf(prev.pos); const t0 = now();
  const P = (c) => ({ x: c.x + 0.5, y: c.y + 0.5, h: c.h + (c.t === 'stair' ? 0.5 : 0) });
  const load = loadOf(level, state);
  switch (ev.type) {
    case 'move': {
      anim = { kind: 'move', from: P(from), to: P(cellOf(ev.to)), t0, dur: 0.13, dir: ev.dir };
      audio.sfx.step(load);
      if (ev.wheel !== undefined) {
        anim.after = () => {
          audio.sfx.wheel(); shake = 0.6;
          const p = cellWorld(ev.to); burst(p.x, p.y - 20, 18, ['#9fd8ff', '#ffffff', '#6fc1ff'], 'dot');
          floatText(p.x, p.y - 50, `水車が回った！${lockLabel(level, ev.wheel)}が開く`, '#2b6a98');
          sparkleLock(ev.wheel);
        };
      } else if (ev.wheelFail && !prevWheelHint) { prevWheelHint = true; toast(`水車の踏板：荷重3ちょうどで回る（いま${load}）`); }
      if (ev.clear) anim.after = () => onClear();
      break;
    }
    case 'pad': {
      const heavy = ev.heavy;
      anim = { kind: 'pad', from: P(from), to: P(cellOf(ev.to)), t0, dur: settings.calm ? 0.3 : 0.5, heavy, dir: ev.dir };
      if (ev.style === 'leaf') audio.sfx.leaf(heavy); else audio.sfx.bridge(heavy);
      holdBlocked = true;
      anim.after = () => {
        const p = cellWorld(ev.to);
        burst(p.x, p.y, 8, ['#ffffff', '#c3ef94'], 'dot', 0.6);
        floatText(p.x, p.y - 40, heavy ? '重い → 低い方へ' : '軽い → 高い方へ', heavy ? '#c4513a' : '#2b6a98');
      };
      break;
    }
    case 'push': {
      anim = { kind: 'push', from: P(from), to: P(cellOf(ev.from)), t0, dur: 0.16, dir: ev.dir };
      rockAnim = { from: ev.from, to: ev.to, t0, dur: 0.16 };
      audio.sfx.push();
      break;
    }
    case 'board': {
      const k = ev.k; const a = level.animals[k];
      flyers.push({ k, kind: a.kind, a: cellWorld(ev.cell, 0.6), b: { x: koroWorld().x, y: koroWorld().y - 40 }, t0, dur: 0.28 });
      anim = { kind: 'bump', t0, dur: 0.28, dir: ev.dir };
      audio.sfx.board(a.weight);
      anim.after = () => { pulseLoad(); const p = koroWorld(); floatText(p.x, p.y - 70, `+${a.weight}`, '#c4513a'); };
      break;
    }
    case 'drop': {
      const k = ev.k; const a = level.animals[k];
      flyers.push({ k, kind: a.kind, a: { x: koroWorld().x, y: koroWorld().y - 40 }, b: cellWorld(ev.cell, 0.6), t0, dur: 0.28 });
      anim = { kind: 'bump', t0, dur: 0.28, dir: ev.dir };
      audio.sfx.drop();
      anim.after = () => { pulseLoad(); const p = koroWorld(); floatText(p.x, p.y - 70, `−${a.weight}`, '#2b6a98'); };
      break;
    }
    case 'deliver': {
      const k = ev.k; const a = level.animals[k];
      flyers.push({ k, kind: a.kind, a: { x: koroWorld().x, y: koroWorld().y - 40 }, b: cellWorld(ev.cell, 1.2), t0, dur: 0.45 });
      anim = { kind: 'bump', t0, dur: 0.5, dir: ev.dir };
      audio.sfx.deliver();
      anim.after = () => {
        const p = cellWorld(ev.cell, 1);
        burst(p.x, p.y - 20, 26, ['#ff7a9a', '#ffd34d', '#ffffff', '#ff9a6b', '#b58cff']);
        sneezeT = now(); shake = 0.8; audio.sfx.sneeze(); pulseLoad();
        floatText(p.x, p.y - 60, `${a.name}の引越し完了！`, '#c4513a');
        for (const l of ev.unlocked) { sparkleLock(l); setTimeout(() => { audio.sfx.unlock(); toast(`${lockLabel(level, l)}が開いた！`, true); }, 450); }
        if (ev.all) setTimeout(() => { toast('全員の引越しが終わった！ 花のアーチ（出口）へ', true); const e = cellWorld(level.exit, 1); burst(e.x, e.y - 30, 30, ['#ffd34d', '#fff', '#ff7a9a']); }, ev.unlocked.length ? 1400 : 500);
      };
      break;
    }
    default: break;
  }
  if (ev.seed) {
    const after = anim?.after;
    const seedCell = ev.type === 'push' ? ev.from : ev.to;
    if (anim) anim.after = () => { after?.(); gotSeed(seedCell); };
    else gotSeed(seedCell);
  }
}
let prevWheelHint = false;
function gotSeed(cell) {
  const p = cellWorld(cell); audio.sfx.seed();
  burst(p.x, p.y - 14, 12, ['#fff6b0', '#ffd34d', '#ffffff'], 'dot', 0.7);
  toast(`種をひろった（${seedCount(state)}/${level.seeds.length}）`);
}
function sparkleLock(l) {
  for (const c of level.cells) if (c.lock === l) { const p = cellWorld(c.i, 0.5); burst(p.x, p.y - 10, 16, ['#ffd34d', '#ffffff', '#ff9a6b'], 'dot'); }
}
function finishAnim() {
  const a = anim; anim = null;
  a.after?.();
  if (state.cleared) return;
  if (pending) { const p = pending; pending = null; doAct(p.dir, p.pick); return; }
  if (walkQueue.length) { const step = walkQueue.shift(); if (typeof step === 'number') doAct(step, undefined, { fromWalk: true }); return; }
  scheduleStuckCheck();
}
let stuckTimer = 0;
function scheduleStuckCheck() {
  clearTimeout(stuckTimer);
  stuckTimer = setTimeout(() => {
    if (state.cleared || anim) return;
    const key = JSON.stringify(state);
    if (lastStuck && lastStuck.key === key) return;
    const r = solve(level, { from: state, limit: 12000 });
    const stuck = !r.path && !r.truncated;
    lastStuck = { key, stuck };
    $('undoBtn').classList.toggle('attn', stuck);
    if (stuck) toast('このままでは全員を運べない…「戻す」で少し前へ');
  }, 250);
}

function undo() {
  if (!hist.length || titleOn || modalOpen) return;
  state = hist.pop(); anim = null; pending = null; walkQueue = []; rockAnim = null; flyers = [];
  audio.sfx.undo(); hidePick(); saveCurrent(); updateHud(); $('undoBtn').classList.remove('attn'); lastStuck = null;
  scheduleStuckCheck();
}
function resetLevel() {
  if (titleOn || modalOpen) return;
  if (!hist.length && state.moves === 0) return;
  hist.push(state); state = createState(level); anim = null; walkQueue = []; flyers = [];
  toast('この面を最初から（「戻す」で元に戻せる）'); saveCurrent(); updateHud(); $('undoBtn').classList.remove('attn');
}

// ---------- タップ ----------
function cellAtScreen(sx, sy) {
  const w = toWorld(sx, sy);
  let best = -1;
  for (const c of order) {
    const p = iso(c.x + 0.5, c.y + 0.5, c.h);
    const dx = Math.abs(w.x - p.x) / (TW / 2); const dy = Math.abs(w.y - (p.y)) / (TH / 2);
    if (dx + dy <= 1.05) best = c.i;
    if ((c.t === 'station' || c.t === 'home') && Math.hypot(w.x - p.x, (w.y - p.y + 22) * 1.2) < 26) best = c.i;
  }
  return best;
}
function onTapCell(i) {
  if (i < 0 || state.cleared) return;
  for (let d = 0; d < 4; d++) if (neighbor(level, state.pos, d) === i) { doAct(d); return; }
  if (i === state.pos) return;
  // 歩いて近づく
  const c = cellOf(i);
  const goals = new Set();
  if (['station', 'home', 'pad'].includes(c.t) || state.rocks.includes(i)) {
    for (let d = 0; d < 4; d++) { const n = neighbor(level, i, d); if (n >= 0) goals.add(n); }
  } else goals.add(i);
  const path = walkPath(goals);
  if (!path) { toast('そこへは歩いて行けない'); return; }
  if (['station', 'home', 'pad'].includes(c.t) || state.rocks.includes(i)) {
    // 最後にその方向へ
    const end = path.end;
    for (let d = 0; d < 4; d++) if (neighbor(level, end, d) === i) path.dirs.push(d);
  }
  if (!path.dirs.length) return;
  const first = path.dirs.shift(); walkQueue = path.dirs;
  doAct(first, undefined, { fromWalk: true });
}
function walkPath(goals) {
  const start = state.pos; const prev = new Map([[start, null]]); let q = [start];
  while (q.length) {
    const nq = [];
    for (const p of q) {
      if (goals.has(p) && p !== start) return build(p);
      if (goals.has(p) && p === start) return { dirs: [], end: p };
      for (let d = 0; d < 4; d++) {
        const r = act(level, { ...state, pos: p, cleared: false }, d);
        if (!r.ok || r.ev.type !== 'move' || r.ev.clear && !goals.has(r.ev.to)) continue;
        const n = r.ev.to; if (prev.has(n)) continue;
        prev.set(n, { p, d }); nq.push(n);
      }
    }
    q = nq;
  }
  return null;
  function build(p) { const dirs = []; let cur = p; while (prev.get(cur)) { const s = prev.get(cur); dirs.unshift(s.d); cur = s.p; } return { dirs, end: p }; }
}

const pointers = new Map(); let pinch = null; let tapStart = null;
cv.addEventListener('pointerdown', (e) => {
  audio.ensure(); cv.setPointerCapture?.(e.pointerId);
  pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: userZoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, px: pan.x, py: pan.y };
    tapStart = null;
  } else tapStart = { x: e.offsetX, y: e.offsetY, t: now() };
});
cv.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    userZoom = Math.max(0.6, Math.min(2.2, pinch.z * d / pinch.d));
    pan.x = pinch.px + ((a.x + b.x) / 2 - pinch.mx); pan.y = pinch.py + ((a.y + b.y) / 2 - pinch.my);
  }
});
const endPtr = (e) => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (tapStart && e.type === 'pointerup' && Math.hypot(e.offsetX - tapStart.x, e.offsetY - tapStart.y) < 14 && now() - tapStart.t < 0.6) onTapCell(cellAtScreen(e.offsetX, e.offsetY));
  tapStart = null;
};
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('wheel', (e) => { e.preventDefault(); userZoom = Math.max(0.6, Math.min(2.2, userZoom * (e.deltaY < 0 ? 1.1 : 0.9))); }, { passive: false });
cv.addEventListener('dblclick', () => { userZoom = 1; pan = { x: 0, y: 0 }; });
$('fitBtn').addEventListener('click', () => { userZoom = 1; pan = { x: 0, y: 0 }; });
setInterval(() => { $('fitBtn').hidden = Math.abs(userZoom - 1) < 0.02 && !pan.x && !pan.y; }, 300);

// 方向パッド（押し続けると0.18秒ごと。橋・葉を越えたら止まる）
let holdTimer = 0; let holdBlocked = false;
function holdStart(dir) {
  holdBlocked = false; clearInterval(holdTimer); doAct(dir);
  holdTimer = setTimeout(function rep() { if (holdBlocked) return; doAct(dir); holdTimer = setTimeout(rep, 180); }, 320);
}
function holdEnd() { clearTimeout(holdTimer); }
for (const b of document.querySelectorAll('#dpad .d')) {
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.ensure(); b.classList.add('on'); holdStart(Number(b.dataset.dir)); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { b.classList.remove('on'); holdEnd(); });
  b.addEventListener('contextmenu', (e) => e.preventDefault());
}
let undoTimer = 0;
$('undoBtn').addEventListener('pointerdown', (e) => {
  e.preventDefault(); undo();
  undoTimer = setTimeout(function rep() { undo(); undoTimer = setTimeout(rep, 110); }, 380);
});
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) $('undoBtn').addEventListener(ev, () => clearTimeout(undoTimer));
$('undoBtn').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); undo(); } });
$('resetBtn').addEventListener('click', resetLevel);
$('hintBtn').addEventListener('click', showHint);
function showHint() {
  const hs = hints(level, state);
  const extra = [];
  const load = loadOf(level, state);
  extra.push(`いまの荷重は${load}（${isHeavy(load) ? '重い：橋は低い岸・葉は手前' : '軽い：橋は高い岸・葉は遠くの高台'}）`);
  toast(hs.length ? `${hs[0]}。${extra[0]}` : (allDelivered(level, state) ? '出口の花のアーチへ！' : extra[0]), false, 4200);
}

const KEYMAP = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
let keyHeld = null; let lastKeyT = 0;
window.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (!$('pick').hidden && /^Digit[1-3]$/.test(e.code)) { const b = $('pickBtns').children[Number(e.code.slice(5)) - 1]; b?.click(); e.preventDefault(); return; }
  if (e.code === 'Escape') { closeModals(); hidePick(); return; }
  if (titleOn) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); $('startBtn').hidden ? $('contBtn').click() : $('startBtn').click(); } return; }
  if (modalOpen) return;
  if (e.code in KEYMAP) {
    e.preventDefault(); audio.ensure();
    const d = KEYMAP[e.code];
    if (e.repeat) { if (holdBlocked || keyHeld !== d || now() - lastKeyT < 0.18) return; } else holdBlocked = false;
    keyHeld = d; lastKeyT = now(); doAct(d);
  } else if (e.code === 'KeyZ' || e.code === 'Backspace') { e.preventDefault(); undo(); }
  else if (e.code === 'KeyR' && !e.repeat) resetLevel();
  else if (e.code === 'KeyH' && !e.repeat) showHint();
});
window.addEventListener('keyup', (e) => { if (e.code in KEYMAP && KEYMAP[e.code] === keyHeld) { keyHeld = null; holdBlocked = false; } });

// 降ろす相手を選ぶ
function showPick(r, dir) {
  const box = $('pickBtns'); box.textContent = '';
  r.choices.forEach((k, idx) => {
    const a = level.animals[k];
    const b = document.createElement('button'); b.type = 'button';
    b.innerHTML = `<img alt="" src="${icons[a.kind]}"><span>${idx + 1}. ${a.name}（${a.weight}）</span>`;
    b.addEventListener('click', () => { hidePick(); doAct(dir, k); });
    box.appendChild(b);
  });
  $('pick').hidden = false;
}
function hidePick() { $('pick').hidden = true; }

// ---------- HUD ----------
function updateHud() {
  $('lvNo').textContent = String(level.id); $('lvName').textContent = level.name;
  $('delv').textContent = `${deliveredCount(level, state)}/${level.animals.length}`;
  $('seedc').textContent = `${seedCount(state)}/${level.seeds.length}`;
  $('movec').textContent = String(state.moves);
  const slots = $('slots').children; let si = 0;
  for (const s of slots) { s.className = ''; s.textContent = ''; s.style.background = ''; }
  for (const k of state.riders) {
    const a = level.animals[k];
    for (let w = 0; w < a.weight && si < 3; w++, si++) {
      const s = slots[si]; s.className = 'on' + (w ? ' cont' : ''); s.style.background = LOOKS[a.kind].body;
      if (!w) { const im = document.createElement('img'); im.src = icons[a.kind]; im.alt = a.name; s.appendChild(im); }
    }
  }
  const load = loadOf(level, state); const st = $('loadState');
  st.textContent = load === CAPACITY ? '満員' : isHeavy(load) ? '重い' : '軽い';
  st.className = 'state' + (load === CAPACITY ? ' full' : isHeavy(load) ? ' heavy' : '');
  $('loadBox').setAttribute('aria-label', `荷重 ${load}/3（${st.textContent}）`);
  updateCoach();
}
function pulseLoad() { const b = $('loadBox'); b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); }
let toastTimer = 0;
function toast(msg, good = false, ms = 2600) {
  const t = $('toast'); t.textContent = msg; t.classList.toggle('good', good); t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

// 手引き：最初の面だけ、その場でやることを短く出す
let coachStart = 0;
function updateCoach() {
  const el = $('coach'); let text = '';
  const s = state; const L = level;
  const name = (k) => L.animals[k].name;
  if (allDelivered(L, s)) text = '全員の引越し完了！ 光る<em>花のアーチ</em>が出口';
  else if (L.id === 1) {
    const capy = 0; const bird = 1;
    if (!delivered(L, s, capy) && !s.riders.includes(capy)) text = s.riders.length ? '' : `${name(capy)}（重さ2）に<em>ぶつかって乗せよう</em>`;
    else if (s.riders.includes(capy) && cellOf(s.pos).h >= 1) text = '重さ2で<em>橋が沈む</em>。橋へ進むと低い岸へ';
    else if (s.riders.includes(capy)) text = '赤い家に<em>ぶつかって届けよう</em>';
    else if (!s.riders.includes(bird)) text = `帰り階段で戻って、${name(bird)}（重さ1）を乗せよう`;
    else text = '軽いと橋は<em>高い岸</em>へ。小鳥の家へ';
  } else if (L.id === 2 && s.moves < 6) text = L.guide;
  else if (L.id === 3 && s.moves < 4) text = L.guide;
  else if (now() - coachStart < 6 && s.moves < 3) text = L.guide;
  el.innerHTML = text;
}
setInterval(() => { if (!titleOn) updateCoach(); }, 1000);

// ---------- クリア ----------
let lastResult = null;
function onClear() {
  const before = totalSeeds(progress); const beforePat = patternsUnlocked(before);
  const wasCleared = !!progress.levels[level.id]?.cleared;
  const dexBefore = Object.keys(progress.dex).length;
  progress = recordClear(progress, level, state); saveProgress();
  const after = totalSeeds(progress); const afterPat = patternsUnlocked(after);
  audio.sfx.clear(); audio.sfx.rumble(); liftT = now(); shake = 1;
  const e = cellWorld(level.exit, 1); burst(e.x, e.y - 30, 40, ['#ffd34d', '#fff', '#ff7a9a', '#9ddb6c']);
  store.del('cur');
  lastResult = { level, state, newPat: afterPat > beforePat ? PATTERNS[afterPat - 1] : null, newDex: Object.keys(progress.dex).length - dexBefore, first: !wasCleared };
  setTimeout(showResult, settings.calm ? 600 : 1500);
}
function showResult() {
  const r = lastResult; const rec = progress.levels[r.level.id];
  $('resTitle').textContent = '引越し完了！';
  const st = $('resStats'); st.textContent = '';
  const items = [`全員配達 ${r.level.animals.length}/${r.level.animals.length}`, `種 ${seedCount(r.state)}/${r.level.seeds.length}`, `${r.state.moves}手`, `最良 ${rec.best}手`];
  for (const s of items) { const li2 = document.createElement('li'); li2.textContent = s; st.appendChild(li2); }
  const msgs = [];
  if (r.newPat) msgs.push(`新しい甲羅模様「${r.newPat.name}」！`);
  if (r.newDex > 0) msgs.push(`図鑑に${r.newDex}種ふえた`);
  if (seedCount(r.state) < r.level.seeds.length) msgs.push('種はまだ残っている。寄り道すると…');
  $('resNew').textContent = msgs.join('　');
  const g = $('resArt').getContext('2d'); g.clearRect(0, 0, 320, 150);
  const grd = g.createLinearGradient(0, 0, 0, 150); grd.addColorStop(0, '#bfe6ff'); grd.addColorStop(1, '#fff3dc'); g.fillStyle = grd; g.fillRect(0, 0, 320, 150);
  const n = r.level.animals.length;
  r.level.animals.forEach((a, i) => drawHouse(g, n === 1 ? 120 : 40 + i * (190 / (n - 1)), 126, a.kind, true, now(), n > 3 ? 1 : 1.2));
  drawKoro(g, 286, 140, { load: 0, riders: [], pattern: settings.pattern, face: 3 });
  $('nextBtn').textContent = r.level.index === LEVELS.length - 1 ? '結末へ' : [5, 11].includes(r.level.index) ? '次の地域へ' : '次の面へ';
  openModal('result');
}
$('nextBtn').addEventListener('click', () => {
  closeModals();
  const i = lastResult.level.index;
  if ([5, 11, 17].includes(i)) playStory(i === 5 ? 0 : i === 11 ? 1 : 2, () => { if (i < 17) loadLevel(i + 1); else openMap(); });
  else loadLevel(Math.min(LEVELS.length - 1, i + 1));
});
$('againBtn').addEventListener('click', () => { closeModals(); loadLevel(lastResult.level.index); });
$('copyBtn').addEventListener('click', async () => {
  const pat = PATTERNS[settings.pattern]?.name || 'さんご';
  const text = shareText(lastResult.level, lastResult.state, pat);
  try { await navigator.clipboard.writeText(text); toast('結果をコピーした'); }
  catch { prompt('この文をコピーしてね', text); }
});

// ---------- 物語の場面（6・12・18面のあと） ----------
const STORIES = [
  ['引越しを終えた巨亀が、ゆっくり立ち上がる。', '背中の家々をゆらしながら、砂丘へ歩きだした。', '砂の上で、巨トカゲが背びれを振って待っていた。'],
  ['背びれの家々に、花飾りがならんだ。', '亀とトカゲは並んで、花の匂いのする方へ。', '大きな耳をぱたぱたさせて、巨象が鼻を上げた。'],
  ['最後の家が建ち、巨象が鼻を高く上げた。', '亀とトカゲと象は、ならんで花の谷へ渡っていく。'],
];
let storyRun = null;
function playStory(n, done) {
  const lines = STORIES[n].slice();
  const all = totalSeeds(progress) >= TOTAL_SEEDS;
  if (n === 2) lines.push(all ? '集めた54個の種がいっせいに咲いて、谷は花吹雪になった。' : '住人たちが窓から、いっせいに手を振った。（種を全部集めると、谷が…？）');
  const box = $('story'); box.hidden = false; modalOpen = true;
  const scv = $('storyCv'); const g = scv.getContext('2d');
  const t0 = now(); const per = settings.calm ? 3.2 : 3.4; const total = per * lines.length + 0.6;
  audio.sfx.rumble();
  const finish = () => { if (!storyRun) return; storyRun = null; box.hidden = true; modalOpen = false; done(); };
  storyRun = { finish };
  $('skipBtn').onclick = finish;
  (function loop() {
    if (!storyRun) return;
    const t = now() - t0; const r = scv.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio || 1);
    scv.width = r.width * dpr; scv.height = r.height * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = r.width; const h = r.height;
    const theme = THEMES[Math.min(2, n + (t > per * 2 ? 1 : 0))];
    drawSky(g, w, h, theme, t, settings.calm);
    const walk = settings.calm ? 0 : t;
    const beasts = n === 0 ? ['turtle', 'lizard'] : n === 1 ? ['turtle', 'lizard', 'elephant'] : ['turtle', 'lizard', 'elephant'];
    const narrow = w < 640;
    const sc = Math.min(w / 520, h / 440) * (narrow ? 0.95 : 0.8);
    const speed = w / 40;
    beasts.forEach((b, i) => {
      const appear = n === 2 ? 0 : (i === beasts.length - 1 ? per * 1.6 : 0);
      if (t < appear) return;
      const last = i === beasts.length - 1 && n !== 2;
      let bx = last ? w * 0.78 - (t - appear) * speed * 0.4 : w * (narrow ? 0.3 + i * 0.12 : 0.18 + i * 0.22) + walk * speed;
      if (n === 2) bx = w * (narrow ? 0.25 + i * 0.25 : 0.2 + i * 0.28) + walk * speed * 0.6;
      const by = h * (narrow ? 0.5 + i * 0.09 : 0.56) + Math.sin(walk * 3 + i) * 4 - (n === 0 && i === 0 ? Math.min(1, t / 1.5) * 18 : 0);
      g.save(); g.translate(bx, by); g.scale(sc * 0.55, sc * 0.55);
      drawBeast(g, b, { x0: -150, x1: 150, y0: -90, y1: 60 }, t, settings.calm, {});
      for (let k = 0; k < 4; k++) drawHouse(g, -90 + k * 60, -30 + (k % 2) * 16, KIND_IDS[(k * 3 + i * 4) % 12], true, t, 1.1);
      g.restore();
    });
    drawKoro(g, w * 0.5, h * 0.84, { pattern: settings.pattern, face: 1, t, walk: (t * 2) % 1 });
    if (n === 2 && all && !settings.calm) {
      for (let k = 0; k < 60; k++) { const x = (k * 97 + t * 60 * (1 + (k % 3))) % w; const y = (k * 53 + t * 80) % h; flower(g, x, y, 4 + (k % 3), ['#ff7a9a', '#ffd34d', '#fff', '#b58cff'][k % 4]); }
    }
    const idx = Math.min(lines.length - 1, Math.floor(t / per));
    $('storyText').textContent = lines[idx];
    if (t > total) { finish(); return; }
    requestAnimationFrame(loop);
  })();
}

// ---------- 地図・図鑑・設定 ----------
function openModal(id) { closeModals(); $(id).hidden = false; modalOpen = true; }
function closeModals() { for (const id of ['mapModal', 'dexModal', 'setModal', 'result']) $(id).hidden = true; modalOpen = !!storyRun; }
for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', closeModals);
for (const id of ['mapModal', 'dexModal', 'setModal']) $(id).addEventListener('click', (e) => { if (e.target.id === id) closeModals(); });
$('mapBtn').addEventListener('click', openMap);
function openMap() {
  const box = $('regions'); box.textContent = '';
  $('mapNote').textContent = `クリア ${clearedCount(progress)}/18 ・ 種 ${totalSeeds(progress)}/${TOTAL_SEEDS}`;
  REGIONS.forEach((r, ri) => {
    const sec = document.createElement('section'); sec.className = `region r${ri}`;
    const seeds = LEVELS.filter((l) => l.region === ri).reduce((n, l) => n + bits(progress.levels[l.id]?.seeds || 0), 0);
    sec.innerHTML = `<h3><span>${r.name}</span><small>種 ${seeds}/18</small></h3>`;
    const grid = document.createElement('div'); grid.className = 'lvgrid';
    LEVELS.filter((l) => l.region === ri).forEach((l) => {
      const rec = progress.levels[l.id]; const ok = levelUnlocked(progress, l.index);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'lvb' + (l.index === li ? ' cur' : ''); b.disabled = !ok;
      const sd = bits(rec?.seeds || 0);
      b.innerHTML = `<b>${l.id}. ${l.name}</b>${ok ? `<span class="seeds">${'●'.repeat(sd)}${'○'.repeat(3 - sd)}</span> ${rec?.cleared ? `✓ ${rec.best}手` : ''}` : '🔒'}`;
      b.addEventListener('click', () => { closeModals(); hideTitle(); loadLevel(l.index, { keep: true }); });
      grid.appendChild(b);
    });
    sec.appendChild(grid); box.appendChild(sec);
  });
  openModal('mapModal');
}
const bits = (v) => { let n = 0; while (v) { n += v & 1; v >>>= 1; } return n; };
$('dexBtn').addEventListener('click', openDex);
function openDex() {
  const grid = $('dexGrid'); grid.textContent = '';
  let found = 0;
  for (const k of KIND_IDS) {
    const d = progress.dex[k]; if (d) found++;
    const el = document.createElement('div'); el.className = 'dex' + (d ? '' : ' unknown');
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
    if (d) { drawHouse(g, 92, 96, k, true, 0, 0.9); drawAnimal(g, k, 48, 112, 1.8, {}); }
    else drawAnimal(g, k, 60, 108, 1.8, { silhouette: true });
    const w = KINDS[k].weight;
    const p = document.createElement('p');
    p.innerHTML = d ? `<b>${KINDS[k].name}</b><br>重さ ${'●'.repeat(w)}${'○'.repeat(3 - w)}（${w}）<br>${d.regions.map((r) => REGIONS[r].name).join('・')}で引越し` : `<b>？？？</b><br>重さ ${'●'.repeat(w)}${'○'.repeat(3 - w)}<br>まだ運んでいない`;
    el.append(c, p); grid.appendChild(el);
  }
  $('dexCount').textContent = `${found}/12`;
  const total = totalSeeds(progress); const n = patternsUnlocked(total);
  $('patCount').textContent = `${n}/12`; $('seedTotal').textContent = `種 ${total}/${TOTAL_SEEDS}`;
  const pg = $('patGrid'); pg.textContent = '';
  PATTERNS.forEach((pt, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pat' + (settings.pattern === i ? ' sel' : '');
    b.disabled = total < pt.at;
    const c = document.createElement('canvas'); c.width = 112; c.height = 96; const g = c.getContext('2d');
    drawKoro(g, 60, 88, { pattern: i, face: 2, scale: 1.4 });
    const s = document.createElement('span'); s.textContent = total >= pt.at ? pt.name : `種${pt.at}個で`;
    b.append(c, s);
    b.addEventListener('click', () => { settings.pattern = i; saveSettings(); openDex(); });
    pg.appendChild(b);
  });
  openModal('dexModal');
}
$('setBtn').addEventListener('click', () => {
  $('vol').value = String(Math.round(audio.vol * 100)); $('muteChk').checked = audio.muted; $('musicChk').checked = audio.music;
  $('shakeChk').checked = settings.shake; $('calmChk').checked = settings.calm;
  openModal('setModal');
});
$('vol').addEventListener('input', (e) => { audio.vol = Number(e.target.value) / 100; });
$('muteChk').addEventListener('change', (e) => { audio.muted = e.target.checked; });
$('musicChk').addEventListener('change', (e) => { audio.music = e.target.checked; });
$('shakeChk').addEventListener('change', (e) => { settings.shake = e.target.checked; saveSettings(); });
$('calmChk').addEventListener('change', (e) => { settings.calm = e.target.checked; saveSettings(); });
$('wipeBtn').addEventListener('click', () => {
  if (!confirm('クリア記録・種・図鑑をすべて消しますか？')) return;
  progress = emptyProgress(); saveProgress(); store.del('cur'); settings.pattern = 0; saveSettings(); closeModals(); loadLevel(0); toast('記録を消した');
});

// ---------- タイトル ----------
function hideTitle() { titleOn = false; $('title').hidden = true; audio.ensure(); audio.startMusic(); coachStart = now(); updateCoach(); }
function setupTitle() {
  let saved = null; try { saved = JSON.parse(store.get('cur') || 'null'); } catch { /* なし */ }
  const has = clearedCount(progress) > 0 || (saved && saved.state && saved.state.moves > 0);
  const idx = saved ? LEVELS.findIndex((l) => l.id === saved.level) : -1;
  const nextIdx = idx >= 0 ? idx : Math.min(17, LEVELS.findIndex((l) => !progress.levels[l.id]?.cleared) >= 0 ? LEVELS.findIndex((l) => !progress.levels[l.id]?.cleared) : 17);
  if (has) {
    $('startBtn').hidden = true; $('contBtn').hidden = false;
    $('contBtn').textContent = `つづきから（第${LEVELS[nextIdx].id}面）`;
    $('contBtn').className = 'big';
  }
  loadLevel(has ? nextIdx : 0, { keep: true });
  $('startBtn').onclick = () => { hideTitle(); loadLevel(0); };
  $('contBtn').onclick = () => { hideTitle(); };
  $('selBtn').onclick = () => { openMap(); };
}

// ---------- 共有画像用（?og=1） ----------
function setupOg() {
  document.body.classList.add('og');
  $('title').hidden = true; titleOn = false;
  loadLevel(0);
  // 『くしゃみ橋』：カピバラと小鳥を背負って満員。橋の行き先が「低」に切り替わった瞬間
  const s = createState(level);
  s.aloc = [-1, -1]; s.riders = [0, 1]; s.face = 1;
  state = s;
  userZoom = 1.05; pan = { x: 230, y: 0 };
  const tag = document.createElement('div'); tag.className = 'og-tag';
  tag.innerHTML = '<p>乗せる重さで、道が変わる。</p><h2>ひなたの巨獣と<br>小さな引越し屋</h2><ul><li>18面</li><li>動物12種</li><li>種54個</li></ul>';
  document.body.appendChild(tag);
}

// ---------- 起動 ----------
window.addEventListener('resize', () => { resize(); cam = null; });
resize();
if (OG) setupOg(); else setupTitle();
drawOrder();
updateHud();
requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveCurrent(); });
// テスト・確認用の小さな窓口
window.__sgm = {
  get state() { return state; }, get level() { return level; }, act: (d, k) => doAct(d, k), load: (i) => { hideTitle(); loadLevel(i); },
  set: (s) => { state = s; updateHud(); },
  cellScreen: (x, y) => { const c = level.cells[y * level.w + x]; const p = iso(c.x + 0.5, c.y + 0.5, c.h); const r = cv.getBoundingClientRect(); const q = toScreen(p.x, p.y); return { x: r.left + q.x, y: r.top + q.y }; }, finish: () => { if (anim) anim.dur = 0; }, progress: () => progress, onClear, isOpen,
};
