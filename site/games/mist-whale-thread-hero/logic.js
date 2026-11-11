// 霧鯨と糸の勇者 — ルール（物理・糸・敵・進行・保存）。DOM を触らない。
import { LEVELS, CHAPTERS, ROWS } from './levels.js';

export { LEVELS, CHAPTERS, ROWS };
export const TS = 40;
export const STAGE_COUNT = LEVELS.length;
export const STAR_TOTAL = STAGE_COUNT * 3;

export const PHYS = {
  grav: 1500, maxFall: 760, run: 215, accelG: 2400, accelA: 1500, fric: 2800,
  jump: 560, jumpCut: 200, coyote: 0.1, buffer: 0.14, updraft: 340,
};
export const THREAD = {
  range: 4.6 * TS, cooldown: 0.6, fly: 0.12, bind: 1.0, serpentBind: 2.6,
  zipSpeed: 760, yankSpeed: 560, tangle: 1.8, eatRadius: 26,
};
export const PLAYER_W = 24;
export const PLAYER_H = 40;
const SOLID_ALWAYS = '#';
const TERRAIN = new Set(['#', '=', '^', '~', 'X', 'W', 'B', 'D', 'b', 'd', 'T', 't']);
export const CLOCK_PERIOD = 4;
export const CLOCK_HOLD = 6;
export const CRUMBLE_DELAY = 0.45;
export const CRUMBLE_BACK = 3;

// ───────────────────────── 糸の色（12種） ─────────────────────────
export const THREAD_COLORS = [
  { name: '金糸', need: 0, c: '#ffd76a' },
  { name: '朱', need: 3, c: '#ff6a4a' },
  { name: '若草', need: 6, c: '#9fe07a' },
  { name: '空色', need: 9, c: '#7fd4ff' },
  { name: '藤', need: 12, c: '#c49cff' },
  { name: '桜', need: 15, c: '#ffb3cf' },
  { name: '月白', need: 20, c: '#eef4ff' },
  { name: '琥珀', need: 25, c: '#ffae3a' },
  { name: '翡翠', need: 30, c: '#4fe0b0' },
  { name: '群青', need: 35, c: '#5a7bff' },
  { name: '紅梅', need: 40, c: '#ff5f8f' },
  { name: '虹', need: 45, c: 'rainbow' },
];

// ───────────────────────── レベルの読み込み ─────────────────────────
export function parseLevel(index) {
  const def = LEVELS[index];
  const w = Math.max(...def.rows.map((r) => r.length));
  const rows = def.rows.map((r) => r.padEnd(w, '.'));
  const tiles = rows.map((r) => [...r].map((ch) => (TERRAIN.has(ch) ? ch : '.')).join(''));
  const objs = [];
  rows.forEach((row, r) => [...row].forEach((ch, c) => { if (!TERRAIN.has(ch) && ch !== '.') objs.push({ ch, c, r }); }));
  return { index, def, w, h: ROWS, tiles, objs };
}

export function tileAt(st, c, r) {
  if (c < 0 || c >= st.w) return '#';
  if (r < 0 || r >= ROWS) return '.';
  return st.tiles[r][c];
}

export function clockOpen(st) {
  return st.clockHold > 0 || (st.t % CLOCK_PERIOD) < CLOCK_PERIOD / 2;
}

export function isSolidTile(st, c, r, ignoreT = false) {
  const ch = tileAt(st, c, r);
  switch (ch) {
    case SOLID_ALWAYS: return true;
    case 'B': return st.groups[0];
    case 'D': return !st.groups[0];
    case 'b': return st.groups[1];
    case 'd': return !st.groups[1];
    case 'T': return !ignoreT && !clockOpen(st);
    case 't': return clockOpen(st);
    case 'X': return !st.crumbles[`${c},${r}`] || st.crumbles[`${c},${r}`].broken <= 0;
    default: return false;
  }
}
const isOneWay = (st, c, r) => tileAt(st, c, r) === '=';

// ───────────────────────── 状態を作る ─────────────────────────
function makeEnemy(o, variant, i, st) {
  const x = o.c * TS + TS / 2;
  const y = o.r * TS + TS / 2;
  const phase = ((variant * 0.37 + i * 0.21) % 1);
  const base = { id: i, x, y, hx: x, hy: y, vx: 0, vy: 0, state: 'idle', timer: 0, bound: 0, drag: null, stun: 0, dead: false, phase, cool: phase * 1.2, face: -1 };
  switch (o.ch) {
    case 'm': return { ...base, kind: 'moth', r: 16, home: phase * Math.PI * 2 };
    case 'a': {
      const chase = !!st.def.chase;
      return { ...base, kind: 'bee', r: 17, y: o.r * TS + TS - 20, hy: o.r * TS + TS - 20, chase, minX: x - 3 * TS, maxX: x + 3 * TS, dir: -1 };
    }
    case 'f': case 'F': return { ...base, kind: 'lamp', r: 16, face: o.ch === 'F' ? 1 : -1, timer: phase * 1.4, beam: null };
    case 'n': {
      let c1 = o.c;
      while (c1 + 1 < st.w && tileAt(st, c1 + 1, o.r) === '~') c1++;
      return { ...base, kind: 'serpent', r: 18, x0: o.c * TS, x1: (c1 + 1) * TS, surf: o.r * TS, s: 0, state: 'wait', timer: 0.8 + phase * 1.2 };
    }
    case 'e': return { ...base, kind: 'eater', r: 18 };
    default: return null;
  }
}

export function createLevelState(index, { variant = 0 } = {}) {
  const lv = parseLevel(index);
  const st = {
    index, def: lv.def, w: lv.w, h: ROWS, tiles: lv.tiles.map((r) => r), t: 0, time: 0, variant,
    groups: [false, false], clockHold: 0, crumbles: {},
    player: null, thread: null, cooldown: 0,
    hooks: [], levers: [], switches: [], bells: [], stars: [], checkpoints: [], seeds: [], ships: [], enemies: [],
    exit: null, fray: null, start: null, checkpoint: null,
    hits: 0, falls: 0, gameOvers: 0, cleared: false, events: [], sewn: 0, starsGot: new Set(),
  };
  let ei = 0;
  for (const o of lv.objs) {
    const cx = o.c * TS + TS / 2;
    const cy = o.r * TS + TS / 2;
    switch (o.ch) {
      case 'P': st.start = { x: cx, y: o.r * TS + TS - PLAYER_H }; break;
      case 'E': st.exit = { x: cx, y: o.r * TS + TS, c: o.c, r: o.r }; break;
      case '*': st.stars.push({ id: st.stars.length, x: cx, y: cy, got: false }); break;
      case 'C': st.checkpoints.push({ x: cx, y: o.r * TS + TS - PLAYER_H, on: false }); break;
      case 'H': case 'h': st.hooks.push({ id: st.hooks.length, x: cx, y: cy, fading: o.ch === 'h', fade: 0, gone: false }); break;
      case 'L': case 'l': st.levers.push({ id: st.levers.length, x: cx, y: cy, group: o.ch === 'L' ? 0 : 1, on: false }); break;
      case 'G': case 'g': st.switches.push({ id: st.switches.length, x: cx, y: o.r * TS + TS, group: o.ch === 'G' ? 0 : 1, on: false, c: o.c, r: o.r }); break;
      case 'K': case 'Q': st.bells.push({ id: st.bells.length, x: cx, y: cy, clock: o.ch === 'Q', rung: false, ring: 0 }); break;
      case 'S': st.seeds.push({ id: st.seeds.length, x: o.c * TS + 2, y: o.r * TS + 4, w: 36, h: 36, vx: 0, vy: 0, ox: o.c * TS + 2, oy: o.r * TS + 4, pull: 0, onSwitch: false }); break;
      case 'M': {
        let c0 = o.c; let c1 = o.c;
        while (c0 - 1 >= 0 && tileAt(st, c0 - 1, o.r + 1) === '~') c0--;
        while (c1 + 1 < st.w && tileAt(st, c1 + 1, o.r + 1) === '~') c1++;
        const w = 3 * TS;
        st.ships.push({ id: st.ships.length, x: Math.min(o.c * TS, (c1 + 1) * TS - w), y: o.r * TS + 4, w, xmin: c0 * TS, xmax: (c1 + 1) * TS - w, target: null, vx: 0 });
        break;
      }
      case 'R': st.fray = { x: -4 * TS, startX: -4 * TS, speed: 0, delay: 1.6, dying: 0 }; break;
      default: {
        const e = makeEnemy(o, variant, ei, st);
        if (e) { st.enemies.push(e); ei++; }
      }
    }
  }
  st.enemies.forEach((e) => { e.spawn = { x: e.x, y: e.y, state: e.state, timer: e.timer, face: e.face }; });
  st.checkpoint = { ...st.start };
  st.player = newPlayer(st.start);
  return st;
}

function newPlayer(at) {
  return { x: at.x - PLAYER_W / 2, y: at.y, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0, face: 1, onGround: true, coyote: 0, jumpBuf: 0, jumpHeld: false, hearts: 3, invuln: 1, zip: null, ride: null, tangled: 0, dying: 0, anim: 0, landed: 0 };
}

export const exitLocked = (st) => st.bells.some((b) => !b.clock && !b.rung);
const emit = (st, type, data = {}) => { st.events.push({ type, ...data }); };
const pcx = (p) => p.x + p.w / 2;
const pcy = (p) => p.y + p.h / 2;

// ───────────────────────── 衝突 ─────────────────────────
function boxHitsSolid(st, x, y, w, h, ignoreT) {
  const c0 = Math.floor(x / TS); const c1 = Math.floor((x + w - 0.01) / TS);
  const r0 = Math.floor(y / TS); const r1 = Math.floor((y + h - 0.01) / TS);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (isSolidTile(st, c, r, ignoreT)) return true;
  return false;
}

function seedHit(st, x, y, w, h, except) {
  for (const s of st.seeds) {
    if (s === except) continue;
    if (x < s.x + s.w && x + w > s.x && y < s.y + s.h && y + h > s.y) return s;
  }
  return null;
}

// 動く床（雲の舟・縛った海蛇）の表面
export function surfaces(st) {
  const out = [];
  for (const sh of st.ships) out.push({ kind: 'ship', ref: sh, x0: sh.x, x1: sh.x + sh.w, yAt: () => sh.y });
  for (const e of st.enemies) {
    if (e.kind !== 'serpent' || e.dead || e.bound <= 0) continue;
    const [u0, u1] = serpentSpan(e);
    if (u1 <= u0) continue;
    const xa = e.x0 + u0 * (e.x1 - e.x0); const xb = e.x0 + u1 * (e.x1 - e.x0);
    out.push({ kind: 'serpent', ref: e, x0: xa, x1: xb, yAt: (x) => serpentY(e, (x - e.x0) / (e.x1 - e.x0)) - 12 });
  }
  return out;
}

export const SERPENT_H = 2.6 * TS;
export function serpentY(e, u) { return e.surf - Math.sin(Math.max(0, Math.min(1, u)) * Math.PI) * SERPENT_H; }
export function serpentSpan(e) { return [Math.max(0, e.s - 0.85), Math.min(1, e.s)]; }
export function serpentHead(e) {
  const u = Math.min(1, e.s);
  return { x: e.x0 + u * (e.x1 - e.x0), y: serpentY(e, u) };
}

function moveBodyX(st, b, dx, opts = {}) {
  if (!dx) return false;
  const step = Math.sign(dx) * Math.min(Math.abs(dx), 8);
  let left = dx; let blocked = false;
  while (Math.abs(left) > 0.0001) {
    const d = Math.abs(left) < Math.abs(step) ? left : step;
    const nx = b.x + d;
    if (boxHitsSolid(st, nx, b.y, b.w, b.h, opts.ignoreT)) { blocked = true; snapX(b, d); break; }
    if (opts.seeds) {
      const s = seedHit(st, nx, b.y, b.w, b.h, opts.self);
      if (s) {
        if (opts.push && b.onGround && Math.abs(s.y + s.h - (b.y + b.h)) < 14) {
          const before = s.x; moveBodyX(st, s, d, { seeds: true, self: s });
          if (s.x !== before) { b.x = d > 0 ? s.x - b.w : s.x + s.w; s.vx = d * 60; emit(st, 'push'); left -= d; continue; }
        }
        b.x = d > 0 ? s.x - b.w : s.x + s.w; blocked = true; break;
      }
    }
    b.x = nx; left -= d;
  }
  return blocked;
}
function snapX(b, d) { if (d > 0) b.x = Math.floor((b.x + b.w + d) / TS) * TS - b.w - 0.001; else b.x = Math.ceil((b.x + d) / TS) * TS + 0.001; }

function moveBodyY(st, b, dy, opts = {}) {
  b.onGround = false; b.ride = null;
  if (!dy) dy = 0.01;
  const step = Math.sign(dy) * Math.min(Math.abs(dy), 8);
  let left = dy;
  while (Math.abs(left) > 0.0001) {
    const d = Math.abs(left) < Math.abs(step) ? left : step;
    const ny = b.y + d;
    if (boxHitsSolid(st, b.x, ny, b.w, b.h, opts.ignoreT)) {
      if (d > 0) { b.y = Math.floor((ny + b.h) / TS) * TS - b.h; b.onGround = true; } else b.y = Math.ceil(ny / TS) * TS + 0.001;
      b.vy = 0; return;
    }
    if (d > 0) {
      // すり抜け足場：上から落ちたときだけ乗る
      const foot = b.y + b.h; const nfoot = ny + b.h;
      const rr = Math.floor((nfoot - 0.01) / TS);
      if (Math.floor((foot - 0.01) / TS) < rr || foot <= rr * TS) {
        const c0 = Math.floor(b.x / TS); const c1 = Math.floor((b.x + b.w - 0.01) / TS);
        for (let c = c0; c <= c1; c++) {
          if (isOneWay(st, c, rr) && foot <= rr * TS + 0.5 && nfoot >= rr * TS) { b.y = rr * TS - b.h; b.vy = 0; b.onGround = true; return; }
        }
      }
      if (opts.surfaces) {
        for (const s of surfaces(st)) {
          if (s.ref === opts.self) continue;
          const cx = b.x + b.w / 2;
          if (cx < s.x0 - 4 || cx > s.x1 + 4) continue;
          const sy = s.yAt(Math.max(s.x0, Math.min(s.x1, cx)));
          if (foot <= sy + 6 && nfoot >= sy) { b.y = sy - b.h; b.vy = 0; b.onGround = true; b.ride = { kind: s.kind, ref: s.ref }; return; }
        }
      }
    }
    if (opts.seeds) {
      const s = seedHit(st, b.x, ny, b.w, b.h, opts.self);
      if (s) {
        if (d > 0) { b.y = s.y - b.h; b.onGround = true; b.ride = { kind: 'seed', ref: s }; } else b.y = s.y + s.h + 0.001;
        b.vy = 0; return;
      }
    }
    b.y = ny; left -= d;
  }
}

// ───────────────────────── 糸の標的 ─────────────────────────
export function lineOfSight(st, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0); const n = Math.max(1, Math.ceil(d / 8));
  for (let i = 1; i < n; i++) {
    const x = x0 + (x1 - x0) * (i / n); const y = y0 + (y1 - y0) * (i / n);
    if (isSolidTile(st, Math.floor(x / TS), Math.floor(y / TS))) return false;
  }
  return true;
}

export function threadCandidates(st) {
  const p = st.player; const out = [];
  for (const h of st.hooks) if (!h.gone) out.push({ kind: 'hook', ref: h, x: h.x, y: h.y });
  for (const l of st.levers) if (!l.on) out.push({ kind: 'lever', ref: l, x: l.x, y: l.y });
  for (const b of st.bells) if (b.clock ? b.ring <= 0 : !b.rung) out.push({ kind: 'bell', ref: b, x: b.x, y: b.y });
  for (const s of st.seeds) out.push({ kind: 'seed', ref: s, x: s.x + s.w / 2, y: s.y + s.h / 2 });
  for (const sh of st.ships) if (p.ride?.ref !== sh) out.push({ kind: 'ship', ref: sh, x: sh.x + sh.w / 2, y: sh.y - 6 });
  for (const e of st.enemies) {
    if (e.dead || e.kind === 'eater') continue;
    if (e.kind === 'serpent') {
      if (e.s > 0.12 && e.s < 1 && e.state === 'leap') { const hd = serpentHead(e); out.push({ kind: 'enemy', ref: e, x: hd.x, y: hd.y }); }
      continue;
    }
    out.push({ kind: 'enemy', ref: e, x: e.x, y: e.y });
  }
  return out;
}

export function pickTarget(st, dir) {
  const p = st.player; const px = pcx(p); const py = p.y + 12;
  let best = null; let bestScore = Infinity;
  for (const t of threadCandidates(st)) {
    const dx = t.x - px; const dy = t.y - py;
    if (Math.sign(dx) !== dir && Math.abs(dx) > 14) continue;
    const dist = Math.hypot(dx, dy);
    if (dist > THREAD.range) continue;
    if (!lineOfSight(st, px, py, t.x, t.y)) continue;
    let score = dist;
    if (t.kind === 'enemy') score -= 50;
    if (t.kind === 'bell' || t.kind === 'lever') score -= 20;
    if (t.kind === 'ship' && p.ride) score += 999;
    if (score < bestScore) { bestScore = score; best = t; }
  }
  return best;
}

export function threadAnchor(st) {
  const th = st.thread; if (!th) return null;
  const t = th.target;
  if (!t) return { x: th.tx, y: th.ty };
  if (t.kind === 'enemy' && t.ref.kind === 'serpent') return serpentHead(t.ref);
  if (t.kind === 'enemy') return { x: t.ref.x, y: t.ref.y };
  if (t.kind === 'seed') return { x: t.ref.x + t.ref.w / 2, y: t.ref.y + t.ref.h / 2 };
  if (t.kind === 'ship') return { x: t.ref.x + t.ref.w / 2, y: t.ref.y - 6 };
  return { x: t.ref.x, y: t.ref.y };
}

function fireThread(st, dir) {
  const p = st.player; const th = st.thread;
  if (th) {
    if (th.phase === 'hold' && th.target?.kind === 'enemy') { yank(st, th.target.ref); return; }
    if (th.phase === 'hold' || th.phase === 'fly') { cutThread(st); emit(st, 'cut'); }
    return;
  }
  if (p.tangled > 0 || st.cooldown > 0) { emit(st, 'nothread'); return; }
  const target = pickTarget(st, dir);
  st.cooldown = THREAD.cooldown;
  p.face = dir;
  if (!target) {
    st.thread = { phase: 'miss', t: 0, tx: pcx(p) + dir * THREAD.range * 0.85, ty: p.y + 6, target: null };
    emit(st, 'whiff');
    return;
  }
  st.thread = { phase: 'fly', t: 0, target };
  emit(st, 'throw');
}

function cutThread(st) {
  const th = st.thread; if (!th) return;
  const p = st.player;
  if (p.zip) { p.zip = null; }
  if (th.target?.kind === 'enemy') th.target.ref.bound = Math.min(th.target.ref.bound, 0.0001);
  if (th.target?.kind === 'hook' && th.ship) th.ship.target = null;
  st.thread = null;
}

function attach(st) {
  const th = st.thread; const t = th.target; const p = st.player;
  th.phase = 'hold'; th.t = 0;
  emit(st, 'hit', { kind: t.kind });
  switch (t.kind) {
    case 'hook': {
      const ship = p.ride?.kind === 'ship' ? p.ride.ref : null;
      if (ship) {
        ship.target = Math.max(ship.xmin, Math.min(ship.xmax, t.ref.x - ship.w / 2));
        th.ship = ship;
      } else {
        p.zip = { x: t.ref.x - p.w / 2 + Math.sign(t.ref.x - pcx(p) || p.face) * 8, y: t.ref.y + 8, t: 0 };
        p.face = Math.sign(t.ref.x - pcx(p)) || p.face;
        p.vx = 0; p.vy = 0;
      }
      if (t.ref.fading && t.ref.fade <= 0) t.ref.fade = 2.2;
      break;
    }
    case 'lever':
      t.ref.on = true; st.groups[t.ref.group] = true; th.release = 0.25; emit(st, 'lever'); break;
    case 'bell':
      if (t.ref.clock) { t.ref.ring = CLOCK_HOLD; st.clockHold = CLOCK_HOLD; } else { t.ref.rung = true; st.sewn++; }
      t.ref.swing = 1; th.release = 0.3; emit(st, 'bell', { clock: t.ref.clock, left: st.bells.filter((b) => !b.clock && !b.rung).length });
      if (st.fray && !t.ref.clock) {
        st.fray.x = Math.max(st.fray.x - 3 * TS, st.fray.x - 120);
        if (!exitLocked(st)) { st.fray.dying = 2.5; emit(st, 'sew'); }
      }
      break;
    case 'seed': {
      const s = t.ref; s.pull = 0.38; s.vx = Math.sign(pcx(p) - (s.x + s.w / 2)) * 300; th.release = 0.2; break;
    }
    case 'ship':
      t.ref.target = Math.max(t.ref.xmin, Math.min(t.ref.xmax, pcx(p) - t.ref.w / 2)); th.ship = t.ref; break;
    case 'enemy': {
      const e = t.ref;
      e.bound = e.kind === 'serpent' ? THREAD.serpentBind : THREAD.bind;
      e.drag = null; emit(st, 'bind');
      break;
    }
    default: break;
  }
}

function yank(st, e) {
  const p = st.player;
  const tx = pcx(p); const ty = pcy(p);
  st.thread = null;
  if (e.kind === 'serpent') { e.bound = 0; e.state = 'sink'; e.timer = 0.5; emit(st, 'yank'); return; }
  if (e.kind === 'lamp') { e.bound = 0; e.face *= -1; e.state = 'idle'; e.timer = 0; e.beam = null; emit(st, 'yank'); return; }
  const dx = tx - e.x; const dy = ty - e.y; const d = Math.hypot(dx, dy) || 1;
  e.bound = 0;
  e.drag = { vx: (dx / d) * THREAD.yankSpeed, vy: (dy / d) * THREAD.yankSpeed, left: d + 50 };
  e.state = 'dragged';
  emit(st, 'yank');
}

// ───────────────────────── 1ステップ ─────────────────────────
export function emptyInput() { return { left: false, right: false, jump: false, jumpPressed: false, threadPressed: false }; }

export function step(st, input, dt = 1 / 60) {
  st.events.length = 0;
  if (st.cleared) return st;
  st.t += dt; st.time += dt;
  if (st.clockHold > 0) st.clockHold = Math.max(0, st.clockHold - dt);
  const wasOpen = clockOpen({ ...st, t: st.t - dt, clockHold: st.clockHold + dt });
  if (wasOpen !== clockOpen(st)) emit(st, 'clock', { open: clockOpen(st) });
  st.cooldown = Math.max(0, st.cooldown - dt);
  const p = st.player;
  for (const b of st.bells) { if (b.ring > 0) b.ring = Math.max(0, b.ring - dt); if (b.swing > 0) b.swing = Math.max(0, b.swing - dt * 0.6); }
  updateCrumbles(st, dt);

  if (p.dying > 0) {
    p.dying -= dt;
    if (p.dying <= 0) respawn(st, p.hearts <= 0);
    updateEnemies(st, dt);
    return st;
  }

  // 入力
  const move = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (move) p.face = move;
  if (input.jumpPressed) p.jumpBuf = PHYS.buffer;
  p.jumpHeld = input.jump;
  if (input.threadPressed) fireThread(st, move || p.face);

  p.invuln = Math.max(0, p.invuln - dt);
  p.tangled = Math.max(0, p.tangled - dt);
  p.jumpBuf = Math.max(0, p.jumpBuf - dt);
  p.landed = Math.max(0, p.landed - dt);

  updateThread(st, dt);
  const ignoreT = boxHitsSolid(st, p.x, p.y, p.w, p.h) && !boxHitsSolid(st, p.x, p.y, p.w, p.h, true);

  if (p.zip) {
    const dx = p.zip.x - p.x; const dy = p.zip.y - p.y; const d = Math.hypot(dx, dy);
    p.zip.t += dt;
    const sp = THREAD.zipSpeed * dt;
    if (d <= sp + 2 || p.zip.t > 0.7) {
      p.zip = null; st.thread = null;
      p.vx = p.face * 285; p.vy = -400; p.flung = true;
      emit(st, 'fling');
    } else {
      const ox = p.x; const oy = p.y;
      moveBodyX(st, p, (dx / d) * sp, { seeds: true, ignoreT });
      moveBodyY(st, p, (dy / d) * sp, { ignoreT });
      p.onGround = false;
      if (Math.hypot(p.x - ox, p.y - oy) < sp * 0.2 && p.zip.t > 0.08) { p.zip = null; st.thread = null; p.vy = -200; }
    }
  } else {
    const onG = p.onGround;
    const target = move * PHYS.run;
    const acc = move ? (onG ? PHYS.accelG : PHYS.accelA) : (onG ? PHYS.fric : PHYS.accelA * 0.4);
    if (!onG && p.flung && move && Math.sign(p.vx) === move && Math.abs(p.vx) > PHYS.run) {
      // フックから振り出した勢いは空中で保つ
      p.vx = Math.sign(p.vx) * Math.max(PHYS.run, Math.abs(p.vx) - 120 * dt);
    } else if (p.vx < target) p.vx = Math.min(target, p.vx + acc * dt); else if (p.vx > target) p.vx = Math.max(target, p.vx - acc * dt);
    if (onG) p.flung = false;
    if (onG) p.coyote = PHYS.coyote; else p.coyote = Math.max(0, p.coyote - dt);
    if (p.jumpBuf > 0 && p.coyote > 0) {
      p.vy = -PHYS.jump; p.jumpBuf = 0; p.coyote = 0; p.onGround = false; p.cutDone = false; emit(st, 'jump');
    }
    if (!p.jumpHeld && p.vy < -PHYS.jumpCut && !p.cutDone) { p.vy = -PHYS.jumpCut; p.cutDone = true; }
    const inWind = tileAt(st, Math.floor(pcx(p) / TS), Math.floor(pcy(p) / TS)) === 'W';
    if (inWind) { p.vy = Math.max(-PHYS.updraft, p.vy - 2900 * dt); p.cutDone = true; } else p.vy = Math.min(PHYS.maxFall, p.vy + PHYS.grav * dt);
    // 乗っている床と一緒に動く
    if (p.ride?.kind === 'ship') moveBodyX(st, p, p.ride.ref.vx * dt, { seeds: true, ignoreT });
    const wasAir = !p.onGround;
    moveBodyX(st, p, p.vx * dt, { seeds: true, push: true, ignoreT });
    const vyBefore = p.vy;
    moveBodyY(st, p, p.vy * dt, { seeds: true, surfaces: true, ignoreT });
    if (p.onGround && wasAir && vyBefore > 250) { p.landed = 0.12; emit(st, 'land'); }
    if (p.onGround) touchCrumble(st, p);
  }
  p.anim += Math.abs(p.vx) * dt;

  updateSeeds(st, dt);
  updateShips(st, dt);
  updateEnemies(st, dt);
  updateFray(st, dt);
  for (const h of st.hooks) if (h.fade > 0) { h.fade -= dt; if (h.fade <= 0) { h.gone = true; if (st.thread?.target?.ref === h && !p.zip) cutThread(st); } }

  // 当たり・拾う
  const cx = pcx(p); const cy = pcy(p);
  for (const s of st.stars) {
    if (!s.got && Math.abs(s.x - cx) < 24 && Math.abs(s.y - cy) < 30) { s.got = true; st.starsGot.add(s.id); emit(st, 'star', { n: st.starsGot.size }); }
  }
  for (const c of st.checkpoints) {
    if (!c.on && Math.abs(c.x - cx) < 26 && Math.abs(c.y + PLAYER_H / 2 - cy) < 40) {
      st.checkpoints.forEach((o) => { o.on = false; }); c.on = true; st.checkpoint = { x: c.x, y: c.y }; emit(st, 'checkpoint');
    }
  }
  hazards(st);
  if (st.exit && !exitLocked(st) && Math.abs(st.exit.x - cx) < 30 && cy > st.exit.y - 90 && cy < st.exit.y + 10) {
    st.cleared = true; emit(st, 'clear');
  }
  return st;
}

function updateThread(st, dt) {
  const th = st.thread; if (!th) return;
  th.t += dt;
  if (th.phase === 'miss') { if (th.t > 0.28) st.thread = null; return; }
  if (th.phase === 'fly') {
    // 飛んでいる間に対象が消えたら空振り
    const t = th.target;
    if ((t.kind === 'enemy' && t.ref.dead) || (t.kind === 'hook' && t.ref.gone)) { st.thread = null; return; }
    if (th.t >= THREAD.fly) attach(st);
  } else if (th.phase === 'hold') {
    const t = th.target;
    if (th.release !== undefined) { th.release -= dt; if (th.release <= 0) { st.thread = null; return; } }
    if (t.kind === 'enemy') {
      if (t.ref.dead || t.ref.bound <= 0) { st.thread = null; return; }
      const a = threadAnchor(st); const p = st.player;
      if (Math.hypot(a.x - pcx(p), a.y - pcy(p)) > THREAD.range * 1.6) { cutThread(st); return; }
    }
    if (t.kind === 'ship' && t.ref.target === null) { st.thread = null; return; }
    if (t.kind === 'hook' && th.ship && th.ship.target === null) { st.thread = null; return; }
    if (t.kind === 'hook' && !th.ship && !st.player.zip) { st.thread = null; return; }
  }
  // 糸喰い：糸の近くにいると食いちぎる
  if (st.thread && st.thread.phase !== 'miss') {
    const a = threadAnchor(st); const p = st.player;
    for (const e of st.enemies) {
      if (e.kind !== 'eater' || e.dead || e.stun > 0) continue;
      if (segDist(e.x, e.y, pcx(p), p.y + 12, a.x, a.y) < THREAD.eatRadius) {
        cutThread(st); p.tangled = THREAD.tangle; e.state = 'chew'; e.timer = 0.8; emit(st, 'eaten');
        if (p.vy < 0) p.vy *= 0.4;
        break;
      }
    }
  }
}

export function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax; const dy = by - ay; const l = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function updateCrumbles(st, dt) {
  for (const [k, cr] of Object.entries(st.crumbles)) {
    if (cr.t > 0) { cr.t -= dt; if (cr.t <= 0) { cr.broken = CRUMBLE_BACK; st.events.push({ type: 'crumble', k }); } }
    else if (cr.broken > 0) {
      cr.broken -= dt;
      if (cr.broken <= 0) {
        const [c, r] = k.split(',').map(Number);
        const p = st.player;
        const over = p.x < (c + 1) * TS && p.x + p.w > c * TS && p.y < (r + 1) * TS && p.y + p.h > r * TS;
        if (over) cr.broken = 0.2; else delete st.crumbles[k];
      }
    }
  }
}
function touchCrumble(st, p) {
  const r = Math.floor((p.y + p.h + 1) / TS);
  const c0 = Math.floor(p.x / TS); const c1 = Math.floor((p.x + p.w - 0.01) / TS);
  for (let c = c0; c <= c1; c++) {
    if (tileAt(st, c, r) !== 'X') continue;
    // 同じ葉の並び全体が一緒にくずれる
    let a = c; while (tileAt(st, a - 1, r) === 'X') a--;
    let b = c; while (tileAt(st, b + 1, r) === 'X') b++;
    for (let x = a; x <= b; x++) { const k = `${x},${r}`; if (!st.crumbles[k]) st.crumbles[k] = { t: CRUMBLE_DELAY, broken: 0 }; }
  }
}

function updateSeeds(st, dt) {
  for (const s of st.seeds) {
    if (s.pull > 0) { s.pull -= dt; } else s.vx *= Math.pow(0.0001, dt);
    s.vy = Math.min(PHYS.maxFall, s.vy + PHYS.grav * dt);
    if (Math.abs(s.vx) > 1) { if (moveBodyX(st, s, s.vx * dt, { seeds: true, self: s })) s.vx = 0; }
    // プレイヤーにめり込まない
    moveBodyY(st, s, s.vy * dt, { seeds: true, self: s });
    if (s.y > ROWS * TS + 80) { s.x = s.ox; s.y = s.oy; s.vx = 0; s.vy = 0; emit(st, 'seedback'); }
    checkSwitches(st, s.x, s.y, s.w, s.h);
  }
}

function updateShips(st, dt) {
  for (const sh of st.ships) {
    if (sh.target === null) { sh.vx = 0; continue; }
    const d = sh.target - sh.x;
    if (Math.abs(d) < 2) { sh.x = sh.target; sh.vx = 0; sh.target = null; emit(st, 'dock'); continue; }
    const v = Math.sign(d) * Math.min(160, Math.abs(d) / dt);
    sh.vx = v; sh.x += v * dt;
  }
}

function checkSwitches(st, x, y, w, h) {
  for (const sw of st.switches) {
    if (sw.on) continue;
    const ax = sw.c * TS; const ay = (sw.r - 2) * TS;
    if (x < ax + TS && x + w > ax && y < ay + 3 * TS && y + h > ay) {
      sw.on = true; st.groups[sw.group] = true; emit(st, 'switch');
    }
  }
}

function hurt(st, fromX) {
  const p = st.player;
  if (p.invuln > 0 || p.dying > 0) return false;
  p.hearts -= 1; st.hits += 1; p.invuln = 1.0;
  if (st.thread) cutThread(st);
  p.zip = null;
  const dir = fromX === undefined ? -p.face : Math.sign(pcx(p) - fromX) || -p.face;
  p.vx = dir * 260; p.vy = -380;
  emit(st, 'hurt', { hearts: p.hearts });
  if (p.hearts <= 0) { p.dying = 1.1; st.gameOvers += 1; emit(st, 'down'); }
  return true;
}

function fall(st) {
  const p = st.player;
  if (p.dying > 0) return;
  st.falls += 1; st.hits += 1; p.hearts -= 1;
  emit(st, 'fall', { hearts: p.hearts });
  if (p.hearts <= 0) { st.gameOvers += 1; emit(st, 'down'); }
  p.dying = 0.7; p.vx = 0; p.vy = 0;
  st.thread = null; p.zip = null;
}

function respawn(st, full) {
  const p = st.player; const hearts = full ? 3 : p.hearts;
  const np = newPlayer(st.checkpoint); np.hearts = hearts; np.invuln = 1.2;
  st.player = np; st.thread = null; st.cooldown = 0;
  st.crumbles = {};
  for (const h of st.hooks) { h.gone = false; h.fade = 0; }
  for (const e of st.enemies) {
    if (e.dead && !full) continue;
    Object.assign(e, { x: e.spawn.x, y: e.spawn.y, state: e.spawn.state, timer: e.spawn.timer, face: e.spawn.face, bound: 0, drag: null, stun: 0, cool: 1, vx: 0, vy: 0, dead: false, s: 0, beam: null });
  }
  if (st.fray) { st.fray.x = st.checkpoint.x - 9 * TS; st.fray.delay = 1.2; }
  emit(st, 'respawn', { full });
}

function hazards(st) {
  const p = st.player;
  if (p.dying > 0) return;
  // 落下
  if (p.y > ROWS * TS + 20) { fall(st); return; }
  const c0 = Math.floor((p.x + 4) / TS); const c1 = Math.floor((p.x + p.w - 4) / TS);
  const r0 = Math.floor((p.y + 6) / TS); const r1 = Math.floor((p.y + p.h - 1) / TS);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const ch = tileAt(st, c, r);
      if (ch === '~' && p.y + p.h > r * TS + 12) { fall(st); return; }
      if (ch === '^' && p.y + p.h > r * TS + 14) { if (hurt(st)) { p.vy = -560; } return; }
    }
  }
  for (const e of st.enemies) {
    if (e.dead || e.bound > 0 || e.drag || e.stun > 0) continue;
    if (enemyTouches(st, e, p)) { hurt(st, e.x); return; }
    if (e.kind === 'lamp' && e.beam && e.state === 'fire') {
      const b = e.beam;
      if (p.x < b.x1 && p.x + p.w > b.x0 && p.y < b.y + 8 && p.y + p.h > b.y - 8) { hurt(st, e.x); return; }
    }
  }
  if (st.fray && st.fray.dying <= 0 && p.x < st.fray.x) {
    if (hurt(st, st.fray.x - 100)) { p.x = st.fray.x + 20; p.vx = 300; }
  }
}

export function enemyTouches(st, e, p) {
  const cx = pcx(p); const cy = pcy(p);
  if (e.kind === 'serpent') {
    if (e.state !== 'leap') return false;
    const [u0, u1] = serpentSpan(e);
    for (let u = u0; u <= u1 + 1e-6; u += 0.08) {
      const x = e.x0 + u * (e.x1 - e.x0); const y = serpentY(e, u);
      if (Math.abs(x - cx) < 18 && Math.abs(y - cy) < 26) return true;
    }
    return false;
  }
  if (e.kind === 'lamp') return false;
  return Math.abs(e.x - cx) < e.r + 8 && Math.abs(e.y - cy) < e.r + 16;
}

// ───────────────────────── 敵の動き ─────────────────────────
function killEnemy(st, e) { e.dead = true; e.drag = null; e.bound = 0; emit(st, 'defeat', { x: e.x, y: e.y, kind: e.kind }); }

function updateEnemies(st, dt) {
  const p = st.player; const px = pcx(p); const py = pcy(p);
  for (const e of st.enemies) {
    if (e.dead) continue;
    e.anim = (e.anim || 0) + dt;
    if (e.bound > 0) { e.bound -= dt; if (e.bound <= 0) { e.bound = 0; e.stun = 0.2; } continue; }
    if (e.drag) {
      const sx = e.drag.vx * dt; const sy = e.drag.vy * dt;
      e.x += sx; e.y += sy; e.drag.left -= Math.hypot(sx, sy);
      checkSwitches(st, e.x - 14, e.y - 14, 28, 28);
      const ch = tileAt(st, Math.floor(e.x / TS), Math.floor(e.y / TS));
      if (ch === '^' || ch === '~' || e.y > ROWS * TS) { killEnemy(st, e); continue; }
      if (isSolidTile(st, Math.floor(e.x / TS), Math.floor(e.y / TS))) { e.x -= sx; e.y -= sy; e.drag.left = 0; }
      for (const o of st.enemies) {
        if (o === e || o.dead || o.kind === 'serpent') continue;
        if (Math.hypot(o.x - e.x, o.y - e.y) < e.r + o.r) { killEnemy(st, o); killEnemy(st, e); break; }
      }
      if (e.dead) continue;
      if (e.drag.left <= 0) { e.drag = null; e.stun = 0.8; e.state = 'stun'; if (e.kind === 'bee') { e.hy = e.y; } }
      continue;
    }
    if (e.stun > 0) {
      e.stun -= dt;
      if (e.kind === 'bee' || e.kind === 'eater') { e.vy = 0; }
      if (e.stun <= 0) { e.state = e.kind === 'moth' ? 'return' : 'idle'; e.timer = 0; e.cool = 0.8; }
      if (e.kind !== 'moth' && e.kind !== 'eater') { e.vy = Math.min(PHYS.maxFall, (e.vy || 0) + PHYS.grav * dt); }
      continue;
    }
    switch (e.kind) {
      case 'moth': updateMoth(st, e, dt, px, py); break;
      case 'bee': updateBee(st, e, dt, px, py); break;
      case 'lamp': updateLamp(st, e, dt); break;
      case 'serpent': updateSerpent(st, e, dt); break;
      case 'eater': updateEater(st, e, dt, px, py); break;
      default: break;
    }
    // 光線に入った敵は消える
    for (const l of st.enemies) {
      if (l === e || l.kind !== 'lamp' || l.state !== 'fire' || !l.beam || e.kind === 'serpent') continue;
      const b = l.beam;
      if (e.x > b.x0 && e.x < b.x1 && Math.abs(e.y - b.y) < e.r) killEnemy(st, e);
    }
  }
}

export const MOTH = { sense: 5.2 * TS, warn: 0.55, dive: 300, diveTime: 0.95, back: 130, cool: 1.3 };
function updateMoth(st, e, dt, px, py) {
  e.cool = Math.max(0, e.cool - dt);
  switch (e.state) {
    case 'idle': case 'hover': {
      e.home += dt * 1.6;
      e.x += ((e.hx + Math.cos(e.home) * 34) - e.x) * Math.min(1, dt * 3);
      e.y += ((e.hy + Math.sin(e.home * 2) * 16) - e.y) * Math.min(1, dt * 3);
      e.face = px < e.x ? -1 : 1;
      if (e.cool <= 0 && Math.hypot(px - e.x, py - e.y) < MOTH.sense && st.player.dying <= 0) { e.state = 'warn'; e.timer = MOTH.warn; }
      break;
    }
    case 'warn':
      e.timer -= dt;
      e.tx = px; e.ty = py; e.face = px < e.x ? -1 : 1;
      if (e.timer <= 0) {
        const dx = e.tx - e.x; const dy = e.ty - e.y; const d = Math.hypot(dx, dy) || 1;
        e.vx = dx / d * MOTH.dive; e.vy = dy / d * MOTH.dive; e.state = 'dive'; e.timer = MOTH.diveTime;
        emit(st, 'dive');
      }
      break;
    case 'dive':
      e.timer -= dt; e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.timer <= 0) e.state = 'return';
      break;
    case 'return': case 'stun': {
      const dx = e.hx - e.x; const dy = e.hy - e.y; const d = Math.hypot(dx, dy);
      if (d < 6) { e.state = 'hover'; e.cool = MOTH.cool; break; }
      const s = Math.min(d, MOTH.back * dt); e.x += dx / d * s; e.y += dy / d * s;
      break;
    }
    default: e.state = 'hover';
  }
}

export const BEE = { patrol: 60, chase: 128, sense: 6 * TS, warn: 0.6, charge: 340, chargeTime: 1.0, stun: 0.7 };
function updateBee(st, e, dt, px, py) {
  e.cool = Math.max(0, e.cool - dt);
  const near = Math.abs(px - e.x) < BEE.sense && Math.abs(py - e.y) < 1.6 * TS;
  switch (e.state) {
    case 'idle': case 'patrol': {
      if (e.chase) {
        const d = px - e.x;
        e.face = Math.sign(d) || e.face;
        e.x += Math.sign(d) * Math.min(Math.abs(d), BEE.chase * dt);
        e.y += Math.sign(py - e.y) * Math.min(Math.abs(py - e.y), 90 * dt);
      } else {
        e.face = e.dir;
        const nx = e.x + e.dir * BEE.patrol * dt;
        if (nx < e.minX || nx > e.maxX || beeBlocked(st, nx + e.dir * e.r, e.y)) e.dir *= -1; else e.x = nx;
      }
      if (near && e.cool <= 0 && st.player.dying <= 0) { e.state = 'warn'; e.timer = BEE.warn; e.face = px < e.x ? -1 : 1; e.dir = e.face; }
      break;
    }
    case 'warn':
      e.timer -= dt;
      if (e.timer <= 0) { e.state = 'charge'; e.timer = BEE.chargeTime; emit(st, 'charge'); }
      break;
    case 'charge': {
      e.timer -= dt;
      const nx = e.x + e.face * BEE.charge * dt;
      if (beeBlocked(st, nx + e.face * e.r, e.y)) { e.state = 'stun'; e.stun = BEE.stun; e.cool = 1; break; }
      e.x = nx;
      if (e.timer <= 0) { e.state = 'patrol'; e.cool = 1.4; e.minX = Math.min(e.minX, e.x); e.maxX = Math.max(e.maxX, e.x); }
      break;
    }
    default: e.state = 'patrol';
  }
}
function beeBlocked(st, x, y) {
  if (isSolidTile(st, Math.floor(x / TS), Math.floor(y / TS))) return true;
  return false;
}

export const LAMP = { idle: 1.5, warn: 0.95, fire: 0.6 };
function updateLamp(st, e, dt) {
  if (e.state === 'idle') e.y = e.hy + Math.sin(st.t * 1.1 + e.phase * 6) * 26;
  e.timer += dt;
  if (e.state === 'idle' && e.timer >= LAMP.idle) { e.state = 'warn'; e.timer = 0; e.beam = beamFrom(st, e); emit(st, 'lampwarn'); }
  else if (e.state === 'warn' && e.timer >= LAMP.warn) { e.state = 'fire'; e.timer = 0; e.beam = beamFrom(st, e); emit(st, 'laser'); }
  else if (e.state === 'fire' && e.timer >= LAMP.fire) { e.state = 'idle'; e.timer = 0; e.beam = null; }
  else if (e.state !== 'idle' && e.state !== 'warn' && e.state !== 'fire') { e.state = 'idle'; e.timer = 0; }
}
export function beamFrom(st, e) {
  const r = Math.floor(e.y / TS);
  let c = Math.floor(e.x / TS);
  let n = 0;
  while (n < 40) { c += e.face; n++; if (isSolidTile(st, c, r) || c < 0 || c >= st.w) break; }
  const edge = e.face > 0 ? c * TS : (c + 1) * TS;
  return { x0: Math.min(e.x, edge), x1: Math.max(e.x, edge), y: e.y };
}

export const SERPENT = { wait: 1.5, warn: 0.85, leap: 1.9 };
function updateSerpent(st, e, dt) {
  e.timer -= dt;
  switch (e.state) {
    case 'wait': case 'idle': if (e.timer <= 0) { e.state = 'warn'; e.timer = SERPENT.warn; emit(st, 'ripple'); } break;
    case 'warn': if (e.timer <= 0) { e.state = 'leap'; e.s = 0; emit(st, 'splash'); } break;
    case 'leap':
      e.s += dt * (1.85 / SERPENT.leap);
      if (e.s >= 1.85) { e.state = 'wait'; e.s = 0; e.timer = SERPENT.wait; }
      break;
    case 'sink': e.s = Math.min(1.85, e.s + dt * 2.5); if (e.timer <= 0) { e.state = 'wait'; e.s = 0; e.timer = SERPENT.wait; } break;
    default: e.state = 'wait';
  }
  const hd = serpentHead(e); e.x = hd.x; e.y = hd.y;
}

export const EATER = { drift: 45, hunt: 95, sense: 3.2 * TS };
function updateEater(st, e, dt, px, py) {
  if (e.state === 'chew') { e.timer -= dt; if (e.timer <= 0) e.state = 'idle'; return; }
  const a = threadAnchor(st);
  let tx; let ty; let sp;
  if (st.thread && a) {
    const t = projectOnSeg(e.x, e.y, px, st.player.y + 12, a.x, a.y);
    tx = t.x; ty = t.y; sp = EATER.hunt;
  } else {
    e.home = (e.home || e.phase * 6) + dt * 0.9;
    tx = e.hx + Math.cos(e.home) * 1.6 * TS; ty = e.hy + Math.sin(e.home * 1.3) * 0.8 * TS;
    if (Math.hypot(px - e.x, py - e.y) < 5 * TS) { tx = (tx + px) / 2; ty = (ty + py) / 2; }
    sp = EATER.drift;
  }
  const dx = tx - e.x; const dy = ty - e.y; const d = Math.hypot(dx, dy);
  if (d > 1) { const s = Math.min(d, sp * dt); e.x += dx / d * s; e.y += dy / d * s; }
  e.face = px < e.x ? -1 : 1;
  e.alert = Math.hypot(px - e.x, py - e.y) < EATER.sense;
  e.state = e.alert ? 'warn' : 'idle';
}
function projectOnSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax; const dy = by - ay; const l = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l));
  return { x: ax + t * dx, y: ay + t * dy };
}

export const FRAY = { base: 82, bellBoost: 14, catchUp: 210, lead: 9 * TS };
function updateFray(st, dt) {
  const f = st.fray; if (!f) return;
  if (f.dying > 0) { f.dying -= dt; f.x -= 60 * dt; return; }
  if (exitLocked(st) === false) return;
  if (f.delay > 0) { f.delay -= dt; return; }
  const p = st.player;
  const rung = st.bells.filter((b) => b.rung).length;
  let sp = FRAY.base + rung * FRAY.bellBoost;
  if (p.x - f.x > FRAY.lead) sp = FRAY.catchUp;
  if (p.dying > 0) sp = 0;
  f.speed = sp; f.x += sp * dt;
}

// ───────────────────────── 結果 ─────────────────────────
export function stageResult(st) {
  const stars = st.stars.map((s) => s.got);
  return { index: st.index, stars, got: stars.filter(Boolean).length, hits: st.hits, time: st.time, noDamage: st.hits === 0, fast: st.time <= st.def.par };
}

// ───────────────────────── 保存と進行 ─────────────────────────
export const SAVE_KEY = 'mist-whale-thread-hero:save';
export function newSave() { return { v: 1, stages: {}, color: 0, seen: {}, plays: {} }; }

export function applyClear(save, res) {
  const s = structuredCloneSafe(save);
  const prev = s.stages[res.index] || { stars: [false, false, false], clear: false, best: null, nd: false, fast: false };
  s.stages[res.index] = {
    stars: prev.stars.map((v, i) => v || !!res.stars[i]),
    clear: true,
    best: prev.best === null ? round1(res.time) : Math.min(prev.best, round1(res.time)),
    nd: prev.nd || res.noDamage,
    fast: prev.fast || res.fast,
  };
  return s;
}
const round1 = (x) => Math.round(x * 10) / 10;
function structuredCloneSafe(o) { return JSON.parse(JSON.stringify(o)); }

export function isUnlocked(save, i) { return i === 0 || !!save.stages[i - 1]?.clear; }
export function isChapterUnlocked(save, ch) { return isUnlocked(save, ch * 5); }
export function totalStars(save) { return Object.values(save.stages).reduce((n, s) => n + s.stars.filter(Boolean).length, 0); }
export function chapterStars(save, ch) {
  let n = 0; for (let i = ch * 5; i < ch * 5 + 5; i++) n += (save.stages[i]?.stars || []).filter(Boolean).length; return n;
}
export function clearedCount(save) { return Object.values(save.stages).filter((s) => s.clear).length; }
export function badgeCount(save) { return Object.values(save.stages).reduce((n, s) => n + (s.nd ? 1 : 0) + (s.fast ? 1 : 0), 0); }
export function unlockedColors(save) { const n = totalStars(save); return THREAD_COLORS.map((c) => n >= c.need); }

export function serialize(save) { return JSON.stringify(save); }
export function deserialize(text) {
  const base = newSave();
  if (!text) return base;
  let o; try { o = JSON.parse(text); } catch { return base; }
  if (!o || typeof o !== 'object') return base;
  const stages = {};
  for (const [k, v] of Object.entries(o.stages || {})) {
    const i = Number(k);
    if (!Number.isInteger(i) || i < 0 || i >= STAGE_COUNT || !v) continue;
    stages[i] = {
      stars: [0, 1, 2].map((j) => !!(v.stars && v.stars[j])),
      clear: !!v.clear, best: typeof v.best === 'number' ? v.best : null, nd: !!v.nd, fast: !!v.fast,
    };
  }
  const color = Number.isInteger(o.color) && o.color >= 0 && o.color < THREAD_COLORS.length ? o.color : 0;
  return { v: 1, stages, color, seen: o.seen && typeof o.seen === 'object' ? o.seen : {}, plays: o.plays && typeof o.plays === 'object' ? o.plays : {} };
}

// 初見は固定配置。2回目以降は3つの位相から選ぶ。
export function variantFor(save, i, rnd = Math.random) {
  if (!save.stages[i]?.clear) return 0;
  return Math.floor(rnd() * 3) % 3;
}

// ───────────────────────── 物語 ─────────────────────────
export const STORY = [
  {
    lines: ['霧鯨は、空を泳ぎながら眠っている。', 'その背の草原で、星鈴がひとつ、またひとつ鳴った。', '「この子、夢の帰り道をなくしたんだ」', 'ミオは糸巻きを握りなおし、森へ向かう。'],
    secret: '星鈴15個の回想：鯨の背中の草は、昔ミオが落とした髪紐の色をしていた。',
  },
  {
    lines: ['眠る森は、鯨が見た夢の残りかすでできている。', '牙灯も海蛇も、本当は夢を守る番人だった。', '「だれかが、夢の縫い目をほどいたんだね」', '森の奥で、空がひび割れる音がした。'],
    secret: '星鈴15個の回想：海蛇の鱗には、ミオが小さいころ歌った子守唄が刻まれていた。',
  },
  {
    lines: ['夢の底で、ほつれは鯨の夢そのものを食べていた。', '3つの鐘が鳴り、霧は金色に変わる。', 'ミオは最後の糸を張り、割れた空を縫い止めた。', '霧鯨が、ゆっくりと目を開ける。'],
    secret: '星鈴15個の回想：夢をほどいたのは、ひとりぼっちを怖がった鯨自身だった。',
  },
];

export const ENDINGS = {
  sleep: { title: 'ただ眠る', text: '鯨はまた静かに眠りについた。夢は戻らなかったけれど、背中の草原は今日もあたたかい。星鈴をもっと集めれば、別の結末が見えるかもしれない。' },
  return: { title: '夢を返す', text: '集めた星鈴が鯨の夢に戻り、空に淡い星座が灯った。鯨は低く歌い、ミオを背に乗せたまま朝の方へ泳いでいく。' },
  sew: { title: '空をともに縫う', text: '45の星鈴がすべて鳴り、鯨は夢を取り戻した。鯨とミオは一本の金の糸で結ばれ、夜ごと空のほつれを縫って回る。' },
};

export function endingFor(save) {
  const n = totalStars(save);
  if (n >= STAR_TOTAL) return 'sew';
  if (n >= 25 || badgeCount(save) >= 12) return 'return';
  return 'sleep';
}

// ───────────────────────── 到達経路の検査（テスト用） ─────────────────────────
// 1マス単位の抽象モデル。歩く・跳ぶ（上2マス／横3〜4マス）・フック・上昇風・仕掛け（すべて作動後）を辿る。
export function reachability(index) {
  const st = createLevelState(index);
  st.groups = [true, true]; st.clockHold = 999;
  const W = st.w;
  const solid = (c, r) => isSolidTile(st, c, r);
  const extraFloor = new Set();
  // 種：設計上の置き場所
  for (const [c, r] of st.def.seedTo || []) extraFloor.add(`${c},${r}`);
  const seedSolid = (c, r) => extraFloor.has(`${c},${r}`);
  // 舟：レール上はどこでも立てる。縛った海蛇の背中も足場
  const floatStand = new Set();
  for (const sh of st.ships) for (let x = sh.xmin; x <= sh.xmax + sh.w - 1; x += TS) floatStand.add(`${Math.floor(x / TS)},${Math.floor(sh.y / TS) - 1}`);
  for (const e of st.enemies) {
    if (e.kind !== 'serpent') continue;
    for (let u = 0.05; u <= 0.95; u += 0.05) {
      const x = e.x0 + u * (e.x1 - e.x0); const y = serpentY(e, u) - 12;
      floatStand.add(`${Math.floor(x / TS)},${Math.floor((y - 20) / TS)}`);
    }
  }
  const free = (c, r) => c >= 0 && c < W && r >= 0 && r < ROWS && !solid(c, r) && !seedSolid(c, r) && !['^', '~'].includes(tileAt(st, c, r));
  const stand = (c, r) => free(c, r) && (r + 1 >= ROWS ? false : (solid(c, r + 1) || isOneWay(st, c, r + 1) || seedSolid(c, r + 1) || tileAt(st, c, r + 1) === 'X')) || (free(c, r) && floatStand.has(`${c},${r}`));
  const wind = (c, r) => tileAt(st, c, r) === 'W';
  const colOf = (x) => Math.floor(x / TS); const rowOf = (y) => Math.floor(y / TS);
  const start = [colOf(st.start.x), rowOf(st.start.y + PLAYER_H / 2)];
  const seen = new Set(); const q = [];
  const air = new Set(); // 空中で通過したマス（星鈴の判定用）
  const push = (c, r) => { const k = `${c},${r}`; if (!seen.has(k) && free(c, r)) { seen.add(k); q.push([c, r]); } };
  const clearPath = (c0, r0, c1, r1) => {
    const n = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0)) * 3 || 1;
    for (let i = 0; i <= n; i++) {
      const c = Math.round(c0 + (c1 - c0) * i / n); const r = Math.round(r0 + (r1 - r0) * i / n);
      if (!free(c, r) && !(c === c1 && r === r1)) return false;
      air.add(`${c},${r}`);
    }
    return true;
  };
  // 落ちる：下へ（横に最大 dx だけ流れる）
  const landFrom = (c, r, maxDx) => {
    for (let dx = -maxDx; dx <= maxDx; dx++) {
      for (let rr = r; rr < ROWS; rr++) {
        const cc = c + dx;
        if (!free(cc, rr)) break;
        air.add(`${cc},${rr}`);
        if (stand(cc, rr)) { if (clearPath(c, r, cc, rr) || Math.abs(dx) <= 1) push(cc, rr); break; }
        if (wind(cc, rr)) { push(cc, rr); break; }
      }
    }
  };
  // 放物線で通過するマスを記録（星鈴の判定用）
  const arc = (x, y, vx, vy) => {
    for (let t = 0; t < 1.4; t += 1 / 30) {
      vy = Math.min(PHYS.maxFall, vy + PHYS.grav / 30); x += vx / 30; y += vy / 30;
      const c = colOf(x); const r = rowOf(y);
      if (!free(c, r)) break;
      air.add(`${c},${r}`);
    }
  };
  const hookAt = st.hooks.map((h) => [colOf(h.x), rowOf(h.y)]);
  const hookFrom = (c, r, flying) => {
    for (const [hc, hr] of hookAt) {
      const d = Math.hypot(hc - c, hr - r);
      if (d > (flying ? 4.4 : 4.5)) continue;
      if (!lineOfSight(st, c * TS + 20, r * TS + 12, hc * TS + 20, hr * TS + 20)) continue;
      const k = `h${hc},${hr}`;
      if (seen.has(k)) continue;
      seen.add(k); clearPath(c, r, hc, hr + 1);
      q.push(['hook', hc, hr]);
    }
  };
  push(...start);
  while (q.length) {
    const cur = q.shift();
    if (cur[0] === 'hook') {
      const [, hc, hr] = cur;
      const hang = [hc, hr + 1];
      // フックから振り出す：左右どちらでも、横4マス・上1マスまで
      for (let dr = -1; dr <= 4; dr++) for (let dc = -(4 + Math.max(0, Math.min(1, dr - 1))); dc <= 4 + Math.max(0, Math.min(1, dr - 1)); dc++) {
        const c = hang[0] + dc; const r = hang[1] + dr;
        if (stand(c, r) && clearPath(hang[0], hang[1], c, r)) push(c, r);
      }
      for (const dir of [-1, 1]) arc(hang[0] * TS + 20, hang[1] * TS + 20, dir * 285, -400);
      for (const dir of [-1, 1]) {
        // 空中で次のフックへ（0.6秒後の位置から）
        const ac = hang[0] + dir * 3; const ar = hang[1] + 1;
        if (free(ac, ar)) { clearPath(hang[0], hang[1], ac, ar); hookFrom(ac, ar, true); hookFrom(hang[0] + dir * 2, hang[1], true); }
        landFrom(hang[0] + dir * 3, hang[1] + 1, 2);
      }
      continue;
    }
    const [c, r] = cur;
    if (wind(c, r)) {
      // 上昇風：柱の上まで運ばれ、左右へ流れる
      let top = r; while (top - 1 >= 0 && wind(c, top - 1) && free(c, top - 1)) top--;
      for (let rr = r; rr >= top; rr--) air.add(`${c},${rr}`);
      for (let rr = top; rr <= r; rr++) { push(c, rr); hookFrom(c, rr, true); }
      for (const dir of [-1, 1]) for (let dx = 1; dx <= 4; dx++) landFrom(c + dir * dx, Math.max(0, top - 1), 1);
      continue;
    }
    if (!stand(c, r)) { landFrom(c, r, 1); continue; }
    hookFrom(c, r, false);
    for (const vx of [-215, -110, 0, 110, 215]) arc(c * TS + 20, r * TS + 20, vx, -PHYS.jump);
    // 歩く
    for (const dir of [-1, 1]) {
      const nc = c + dir;
      if (free(nc, r)) { if (stand(nc, r)) push(nc, r); else { push(nc, r); } }
    }
    // 跳ぶ
    for (let dr = -2; dr <= 4; dr++) {
      const maxDx = dr <= -2 ? 2 : dr === -1 ? 3 : 4 + Math.max(0, Math.min(2, dr));
      for (let dc = -maxDx; dc <= maxDx; dc++) {
        const nc = c + dc; const nr = r + dr;
        if (!stand(nc, nr) && !wind(nc, nr)) continue;
        // 頭上と軌道
        const apex = Math.min(r, nr) - (dr <= -2 ? 0 : 1);
        if (!free(c, apex) && apex < r) continue;
        if (clearPath(c, apex, nc, Math.min(nr, apex)) || clearPath(c, r, nc, nr)) {
          // 跳躍中の通過マス（星鈴用）
          for (let a = 1; a <= 2; a++) if (free(c + Math.sign(dc), r - a)) air.add(`${c + Math.sign(dc)},${r - a}`);
          push(nc, nr);
        }
      }
    }
    for (let a = 1; a <= 2; a++) if (free(c, r - a)) air.add(`${c},${r - a}`); else break;
    hookFrom(c, r - 1, true);
  }
  const cellReached = (c, r) => seen.has(`${c},${r}`) || air.has(`${c},${r}`);
  const exit = st.exit ? [st.exit.c, st.exit.r] : null;
  const exitOk = !!exit && cellReached(exit[0], exit[1]);
  const near = (x, y) => { const c = colOf(x); const r = rowOf(y); for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) if (cellReached(c + dc, r + dr)) return true; return false; };
  return {
    exit: exitOk,
    stars: st.stars.map((s) => near(s.x, s.y)),
    levers: st.levers.map((l) => near(l.x, l.y + TS * 2) || [...seen].some((k) => { const [c, r] = k.split(',').map(Number); return !Number.isNaN(r) && Math.hypot(c * TS + 20 - l.x, r * TS + 20 - l.y) <= THREAD.range && lineOfSight(st, c * TS + 20, r * TS + 12, l.x, l.y); })),
    bells: st.bells.map((b) => [...seen].some((k) => { const [c, r] = k.split(',').map(Number); return !Number.isNaN(r) && Math.hypot(c * TS + 20 - b.x, r * TS + 20 - b.y) <= THREAD.range && lineOfSight(st, c * TS + 20, r * TS + 12, b.x, b.y); })),
    reached: seen,
  };
}
