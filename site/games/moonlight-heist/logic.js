// ルール本体。DOM を触らない。警備員AI・視界・音・おとり・保存の形式をここで決める。
import { ROOMS, CHAPTERS, ENDINGS, MEMORIES } from './rooms.js';
export { ROOMS, CHAPTERS, ENDINGS, MEMORIES };

export const CFG = {
  walk: 2.6, sneak: 1.5, dash: 3.8, radius: 0.28,
  guardWalk: 1.7, guardChase: 3.0, guardInvest: 2.2,
  viewDist: 6, viewHalf: Math.PI / 4,
  thrWalk: 2.0, thrSneak: 1.5, decayDelay: 2.0, decayRate: 1 / 1.5,
  noiseWalk: 2, noiseMetal: 4, noiseDash: 5, noiseSneak: 0, noiseDecoy: 6,
  catchDist: 0.55, searchTime: 3, waitAtPoint: 0.8, decoyCount: 2, decoyRange: 3,
  staminaMax: 2.5, lightThr: 1.2, grace: 1.5,
};

const BLOCK_MOVE = new Set('#PCGpM');
const BLOCK_SIGHT = new Set('#PCpM');

export function tileAt(room, x, y) {
  if (y < 0 || y >= room.rows.length || x < 0 || x >= room.rows[0].length) return '#';
  return room.rows[y][x];
}

export function moverCells(room, t) {
  const out = [];
  for (const m of room.movers || []) {
    const idx = Math.floor(t / m.period) % m.positions.length;
    for (const c of m.positions[idx]) out.push(c);
  }
  return out;
}
function moverSet(room, t) { return new Set(moverCells(room, t).map(([x, y]) => `${x},${y}`)); }

export function blockedMove(room, x, y, ms) {
  return BLOCK_MOVE.has(tileAt(room, x, y)) || (ms && ms.has(`${x},${y}`));
}
export function blockedSight(room, x, y, ms) {
  return BLOCK_SIGHT.has(tileAt(room, x, y)) || (ms && ms.has(`${x},${y}`));
}

export function lightPos(l, t) {
  const a = (t / l.period + l.ph / l.period) * Math.PI * 2;
  return { x: l.cx + 0.5 + Math.cos(a) * l.ax, y: l.cy + 0.5 + Math.sin(a) * l.ay };
}

export function lineClear(room, x0, y0, x1, y1, ms) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(d / 0.12));
  for (let i = 1; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
    if (blockedSight(room, Math.floor(x), Math.floor(y), ms)) return false;
  }
  return true;
}

export function guardSees(room, g, px, py, ms) {
  const dx = px - g.x, dy = py - g.y, d = Math.hypot(dx, dy);
  if (d > (room.view || CFG.viewDist)) return false;
  if (d > 0.3) {
    const dot = (dx * g.fx + dy * g.fy) / d;
    if (dot < Math.cos(CFG.viewHalf)) return false;
  }
  return lineClear(room, g.x, g.y, px, py, ms);
}

// ---- 経路探索（グリッドA*）----
export function findPath(room, sx, sy, tx, ty, ms) {
  const W = room.rows[0].length, H = room.rows.length;
  sx = Math.max(0, Math.min(W - 1, sx)); sy = Math.max(0, Math.min(H - 1, sy));
  if (blockedMove(room, tx, ty, ms)) {
    let best = null;
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!blockedMove(room, tx + ax, ty + ay, ms)) best = [tx + ax, ty + ay];
    if (!best) return null;
    [tx, ty] = best;
  }
  const key = (x, y) => y * W + x;
  const open = [[0, sx, sy]];
  const came = new Map([[key(sx, sy), -1]]);
  const cost = new Map([[key(sx, sy), 0]]);
  const h = (x, y) => Math.max(Math.abs(x - tx), Math.abs(y - ty));
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const [, x, y] = open.shift();
    if (x === tx && y === ty) {
      const path = [];
      let k = key(x, y);
      while (k !== -1) { path.push([k % W + 0.5, Math.floor(k / W) + 0.5]); k = came.get(k); }
      return path.reverse().slice(1);
    }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (blockedMove(room, nx, ny, ms)) continue;
      if (dx && dy && (blockedMove(room, x + dx, y, ms) || blockedMove(room, x, y + dy, ms))) continue;
      const c = cost.get(key(x, y)) + (dx && dy ? 1.414 : 1);
      if (!cost.has(key(nx, ny)) || c < cost.get(key(nx, ny))) {
        cost.set(key(nx, ny), c); came.set(key(nx, ny), key(x, y));
        open.push([c + h(nx, ny), nx, ny]);
      }
    }
  }
  return null;
}

// ---- 室の読み込み ----
export function roomInfo(room) {
  if (room._info) return room._info;
  const info = { start: null, exit: null, keys: [], opts: [], fakes: [] };
  room.rows.forEach((r, y) => [...r].forEach((c, x) => {
    if (c === 'S') info.start = [x, y];
    if (c === 'E') info.exit = [x, y];
    if (c === 'K') info.keys.push([x, y]);
    if (c === 'o') info.opts.push([x, y]);
    if (c === 'F') info.fakes.push([x, y]);
  }));
  room._info = info;
  return info;
}

export function keyCells(room, phase) {
  const info = roomInfo(room);
  if (room.pedestals) return [room.pedestals[phase % 2 === 0 ? 0 : 1]];
  return info.keys;
}

export function patrolCycle(g) {
  let len = 0;
  const pts = g.pts, n = pts.length;
  const segs = g.loop ? n : n - 1;
  for (let i = 0; i < segs; i++) { const a = pts[i], b = pts[(i + 1) % n]; len += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const stops = g.loop ? n : n - 1;
  return (len * (g.loop ? 1 : 2)) / CFG.guardWalk + stops * (g.loop ? 1 : 2) * CFG.waitAtPoint;
}

function makeGuard(def) {
  const p0 = def.pts[0], p1 = def.pts[1];
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], d = Math.hypot(dx, dy) || 1;
  return {
    pts: def.pts, loop: !!def.loop, pi: 1, dir: 1, x: p0[0] + 0.5, y: p0[1] + 0.5, fx: dx / d, fy: dy / d,
    mode: 'patrol', wait: 0, path: [], target: null, searchT: 0, invWait: 0, replan: 0, sawT: 99,
  };
}

export function createRun(room, phase = 0, opts = {}) {
  const info = roomInfo(room);
  const keys = keyCells(room, phase);
  const items = [];
  if (!info.start) info.start = [1, 1];
  keys.forEach(([x, y], i) => items.push({ x, y, kind: 'key', idx: i, got: false }));
  info.opts.forEach(([x, y], i) => items.push({ x, y, kind: 'opt', idx: i + 1, got: false }));
  const run = {
    room, phase, t: 0, slow: !!opts.slow, status: 'play', time: 0, alerts: 0, latched: false,
    start: [info.start[0] + 0.5, info.start[1] + 0.5],
    p: { x: info.start[0] + 0.5, y: info.start[1] + 0.5, vx: 0, vy: 0, fx: 0, fy: -1 },
    guards: room.guards.map(makeGuard), items, decoys: CFG.decoyCount, decoyObj: null,
    gauge: 0, unseen: 99, stamina: CFG.staminaMax, dashing: false, sneaking: false,
    noise: [], events: [], exitOpen: false, finalTriggered: false, lightSeen: false, seenBy: 0, caughtT: 0,
    lastSeen: null, lastAction: 'idle',
  };
  // 巡回位相：位相ごとに巡回の進み具合をずらす
  if (phase > 0) {
    const ghost = { ...run, p: { x: -50, y: -50, vx: 0, vy: 0, fx: 0, fy: 0 } };
    ghost.guards = run.guards;
    const off = (phase / 3) * Math.max(...room.guards.map(patrolCycle));
    for (let t = 0; t < off; t += 0.1) stepGuards(ghost, 0.1, true);
    run.guards = ghost.guards;
    run.t = 0;
  }
  return run;
}

function emit(run, ev) { run.events.push(ev); }

function moveToward(run, g, wx, wy, speed, dt) {
  const dx = wx - g.x, dy = wy - g.y, d = Math.hypot(dx, dy);
  if (d < 1e-6) return true;
  const step = Math.min(d, speed * dt);
  const nx = g.x + (dx / d) * step, ny = g.y + (dy / d) * step;
  const ms = run._ms;
  // 動く遮蔽物に塞がれたら待つ（すでに中にいるときは出られる）
  if (blockedMove(run.room, Math.floor(nx), Math.floor(ny), ms) && !blockedMove(run.room, Math.floor(g.x), Math.floor(g.y), ms)) return false;
  g.x = nx; g.y = ny;
  const k = Math.min(1, dt * 8);
  g.fx += (dx / d - g.fx) * k; g.fy += (dy / d - g.fy) * k;
  const fl = Math.hypot(g.fx, g.fy) || 1; g.fx /= fl; g.fy /= fl;
  return d - step < 0.02;
}

function followPath(run, g, speed, dt) {
  while (g.path.length) {
    const [wx, wy] = g.path[0];
    if (moveToward(run, g, wx, wy, speed, dt)) { g.path.shift(); dt *= 0.2; if (dt < 0.001) return false; continue; }
    return false;
  }
  return true;
}

function gotoCell(run, g, x, y) {
  g.path = findPath(run.room, Math.floor(g.x), Math.floor(g.y), Math.floor(x), Math.floor(y), run._ms) || [];
}

function stepGuards(run, dt, patrolOnly) {
  const room = run.room, ms = run._ms = moverSet(room, run.t);
  const sp = (run.slow ? 0.8 : 1) * (run.room.guardSpeed || 1);
  for (const g of run.guards) {
    g.sawT += dt;
    if (g.mode === 'patrol') {
      const tgt = g.pts[g.pi];
      if (g.wait > 0) {
        g.wait -= dt;
        const nx = g.pts[(g.pi + g.dir + g.pts.length) % g.pts.length] || tgt;
        // 次の向きへゆっくり向く
        const dx = nx[0] + 0.5 - g.x, dy = nx[1] + 0.5 - g.y, d = Math.hypot(dx, dy) || 1;
        if (g.wait < CFG.waitAtPoint * 0.6) { g.fx += (dx / d - g.fx) * Math.min(1, dt * 5); g.fy += (dy / d - g.fy) * Math.min(1, dt * 5); }
      } else if (moveToward(run, g, tgt[0] + 0.5, tgt[1] + 0.5, CFG.guardWalk * sp, dt)) {
        g.wait = CFG.waitAtPoint;
        if (g.loop) g.pi = (g.pi + 1) % g.pts.length;
        else { if (g.pi + g.dir >= g.pts.length || g.pi + g.dir < 0) g.dir *= -1; g.pi += g.dir; }
      }
    } else if (g.mode === 'return') {
      if (followPath(run, g, CFG.guardWalk * sp, dt)) {
        g.mode = 'patrol'; g.wait = 0;
      }
    } else if (g.mode === 'investigate') {
      if (g.path.length) followPath(run, g, CFG.guardInvest * sp, dt);
      else { g.invWait -= dt; if (g.invWait <= 0) { g.mode = 'return'; const t = g.pts[g.pi]; gotoCell(run, g, t[0], t[1]); } }
    } else if (g.mode === 'chase') {
      g.replan -= dt;
      if (g.replan <= 0 && run.lastSeen) { g.replan = 0.35; gotoCell(run, g, run.lastSeen.x, run.lastSeen.y); }
      const done = followPath(run, g, CFG.guardChase * sp, dt);
      if (done && g.sawT > 0.3) { g.mode = 'search'; g.searchT = CFG.searchTime; }
    } else if (g.mode === 'search') {
      g.searchT -= dt;
      const a = Math.atan2(g.fy, g.fx) + dt * 2.2;
      g.fx = Math.cos(a); g.fy = Math.sin(a);
      if (g.searchT <= 0) { g.mode = 'return'; const t = g.pts[g.pi]; gotoCell(run, g, t[0], t[1]); }
    }
  }
  if (patrolOnly) { run.t += dt; }
}

function hearNoise(run, x, y, r) {
  for (const g of run.guards) {
    if (g.mode === 'chase') continue;
    if (Math.hypot(g.x - x, g.y - y) <= r) {
      g.mode = 'investigate'; g.invWait = 2; gotoCell(run, g, x, y);
      emit(run, 'heard');
    }
  }
}

function setAlert(run) {
  run.alerts++;
  emit(run, 'alert');
  for (const g of run.guards) {
    if (guardSees(run.room, g, run.p.x, run.p.y, run._ms) || run.lightSeen || Math.hypot(g.x - run.p.x, g.y - run.p.y) < 9) {
      g.mode = 'chase'; g.replan = 0;
    }
  }
}

export function anyChase(run) { return run.guards.some((g) => g.mode === 'chase'); }

function movePlayer(run, input, dt) {
  const p = run.p, room = run.room, ms = run._ms;
  let dx = input.dx || 0, dy = input.dy || 0;
  const l = Math.hypot(dx, dy);
  if (l > 0) { dx /= l; dy /= l; }
  const alert = run.gauge > 0.15 || anyChase(run);
  run.sneaking = !!input.sneak && !(alert && false);
  let speed = CFG.walk;
  run.dashing = false;
  if (input.sneak) speed = CFG.sneak;
  else if (alert && l > 0 && run.stamina > 0) { speed = CFG.dash; run.dashing = true; }
  if (run.dashing) run.stamina = Math.max(0, run.stamina - dt);
  else run.stamina = Math.min(CFG.staminaMax, run.stamina + dt * 0.5);
  const k = Math.min(1, dt * 14);
  p.vx += (dx * speed - p.vx) * k; p.vy += (dy * speed - p.vy) * k;
  if (l > 0) { p.fx = dx; p.fy = dy; }
  const tryMove = (nx, ny) => {
    const r = CFG.radius;
    for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) if (blockedMove(room, Math.floor(nx + ox), Math.floor(ny + oy), ms)) return false;
    return true;
  };
  const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
  if (tryMove(nx, p.y)) p.x = nx; else p.vx = 0;
  if (tryMove(p.x, ny)) p.y = ny; else p.vy = 0;
  // 動く遮蔽物に押し潰された場合は近くの空きへ
  if (!tryMove(p.x, p.y)) {
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (tryMove(p.x + ax * 0.6, p.y + ay * 0.6)) { p.x += ax * 0.6; p.y += ay * 0.6; break; }
    }
  }
  const moving = Math.hypot(p.vx, p.vy) > 0.3;
  run.lastAction = !moving ? 'idle' : run.dashing ? 'dash' : input.sneak ? 'sneak' : 'walk';
  if (moving) {
    const metal = tileAt(room, Math.floor(p.x), Math.floor(p.y)) === 'm';
    const r = run.dashing ? CFG.noiseDash : input.sneak ? CFG.noiseSneak : metal ? CFG.noiseMetal : CFG.noiseWalk;
    run.noiseR = r;
    if (r > 0) {
      run._noiseT = (run._noiseT || 0) - dt;
      if (run._noiseT <= 0) { run._noiseT = 0.35; hearNoise(run, p.x, p.y, r); run.noise.push({ x: p.x, y: p.y, r, t: 0 }); }
    }
  } else run.noiseR = 0;
}

export function throwDecoy(run) {
  if (run.decoys <= 0 || run.status !== 'play') return false;
  const p = run.p, room = run.room, ms = run._ms || moverSet(room, run.t);
  let fx = p.fx, fy = p.fy;
  if (!fx && !fy) fy = -1;
  const l = Math.hypot(fx, fy); fx /= l; fy /= l;
  let x = p.x, y = p.y;
  for (let d = 0.2; d <= CFG.decoyRange + 1e-6; d += 0.2) {
    const nx = p.x + fx * d, ny = p.y + fy * d;
    if (blockedMove(room, Math.floor(nx), Math.floor(ny), ms) && tileAt(room, Math.floor(nx), Math.floor(ny)) !== 'G') break;
    if (tileAt(room, Math.floor(nx), Math.floor(ny)) === 'G') break;
    x = nx; y = ny;
  }
  run.decoys--;
  run.decoyObj = { x, y, t: 0 };
  run.noise.push({ x, y, r: CFG.noiseDecoy, t: 0, decoy: true });
  hearNoise(run, x, y, CFG.noiseDecoy);
  emit(run, 'decoy');
  return true;
}

export function decoyTarget(run) {
  const p = run.p, room = run.room, ms = moverSet(room, run.t);
  let fx = p.fx, fy = p.fy;
  if (!fx && !fy) fy = -1;
  const l = Math.hypot(fx, fy); fx /= l; fy /= l;
  let x = p.x, y = p.y;
  for (let d = 0.2; d <= CFG.decoyRange + 1e-6; d += 0.2) {
    const nx = p.x + fx * d, ny = p.y + fy * d;
    if (blockedMove(room, Math.floor(nx), Math.floor(ny), ms)) break;
    x = nx; y = ny;
  }
  return { x, y };
}

export function step(run, input, dt) {
  if (run.status === 'caught') { run.caughtT += dt; return run; }
  if (run.status !== 'play') return run;
  dt = Math.min(dt, 0.05);
  run.t += dt; run.time += dt;
  run._ms = moverSet(run.room, run.t);
  movePlayer(run, input, dt);
  if (input.decoy) throwDecoy(run);
  stepGuards(run, dt, false);
  for (const n of run.noise) n.t += dt;
  run.noise = run.noise.filter((n) => n.t < 0.8);
  if (run.decoyObj) { run.decoyObj.t += dt; if (run.decoyObj.t > 4) run.decoyObj = null; }

  // 視認と警戒ゲージ
  const p = run.p;
  let seeing = 0;
  for (const g of run.guards) {
    if (guardSees(run.room, g, p.x, p.y, run._ms)) {
      seeing++; g.sawT = 0; run.lastSeen = { x: p.x, y: p.y };
      if (g.mode !== 'chase') { g.mode = g.mode === 'investigate' ? 'investigate' : g.mode; }
    }
  }
  run.seenBy = seeing;
  run.lightSeen = false;
  for (const l of run.room.lights || []) {
    const lp = lightPos(l, run.t);
    if (Math.hypot(lp.x - p.x, lp.y - p.y) < l.r) run.lightSeen = true;
  }
  const thr = input.sneak ? CFG.thrSneak : CFG.thrWalk;
  if (run.time < (run.room.grace || CFG.grace)) { seeing = 0; run.lightSeen = false; }
  if (seeing || run.lightSeen) {
    run.unseen = 0;
    run.gauge = Math.min(1, run.gauge + dt / (run.lightSeen && !seeing ? CFG.lightThr : thr));
    if (run.lightSeen && !seeing) run.lastSeen = { x: p.x, y: p.y };
    // 見られた警備員はそちらを向いて調べに来る
    for (const g of run.guards) {
      if (g.sawT === 0 && (g.mode === 'patrol' || g.mode === 'return') && run.gauge > 0.35) {
        g.mode = 'investigate'; g.invWait = 1.5; gotoCell(run, g, p.x, p.y);
      }
    }
  } else {
    run.unseen += dt;
    if (run.unseen > CFG.decayDelay && !anyChase(run)) run.gauge = Math.max(0, run.gauge - dt * CFG.decayRate);
  }
  if (run.gauge >= 1 && !run.latched) { run.latched = true; setAlert(run); }
  if (run.gauge < 0.2) run.latched = false;
  if (anyChase(run)) {
    run.gauge = Math.max(run.gauge, 0.6);
    if (!seeing && run.unseen > CFG.decayDelay + 1) run.gauge = Math.max(0.6, run.gauge);
  }
  // 追跡中の警備員が見失って捜索に入れば、ゲージは下がり始める
  if (!anyChase(run) && run.gauge >= 1 && run.unseen > 0.5) run.gauge = 0.99;

  // 捕獲
  for (const g of run.guards) {
    if (Math.hypot(g.x - p.x, g.y - p.y) < CFG.catchDist && (g.mode === 'chase' || g.mode === 'investigate' || g.mode === 'search' || run.gauge > 0.5)) {
      run.status = 'caught'; emit(run, 'caught'); return run;
    }
  }

  // 収集と出口
  for (const it of run.items) {
    if (!it.got && Math.hypot(it.x + 0.5 - p.x, it.y + 0.5 - p.y) < 0.65) {
      it.got = true; emit(run, it.kind === 'key' ? 'key' : 'opt'); it._ev = true;
    }
  }
  for (const [fx, fy] of roomInfo(run.room).fakes) {
    if (Math.hypot(fx + 0.5 - p.x, fy + 0.5 - p.y) < 0.65 && !run.fakeTouched) { run.fakeTouched = true; emit(run, 'fake'); }
  }
  const allKeys = run.items.filter((i) => i.kind === 'key').every((i) => i.got);
  if (allKeys && !run.exitOpen) {
    run.exitOpen = true;
    if (run.room.finalAlarm && !run.finalTriggered) {
      run.finalTriggered = true; run.gauge = 1; run.latched = true; run.lastSeen = { x: p.x, y: p.y };
      run.alerts++; emit(run, 'final');
      for (const g of run.guards) { g.mode = 'chase'; g.replan = 0; }
    }
  }
  const ex = roomInfo(run.room).exit;
  if (ex && run.exitOpen && Math.hypot(ex[0] + 0.5 - p.x, ex[1] + 0.5 - p.y) < 0.7) { run.status = 'clear'; emit(run, 'clear'); }
  return run;
}

// ---- 評価・保存 ----
export function rankOf(room, run) {
  const opt = run.items.filter((i) => i.kind === 'opt' && i.got).length;
  let s = 0;
  s += run.alerts === 0 ? 2 : run.alerts <= 2 ? 1 : 0;
  s += run.time <= room.par ? 1 : 0;
  s += opt >= 2 ? 1 : opt === 1 ? 0.5 : 0;
  return s >= 3.5 ? 'S' : s >= 2.5 ? 'A' : s >= 1.5 ? 'B' : 'C';
}
const RANK_V = { S: 4, A: 3, B: 2, C: 1 };

export function emptySave() { return { v: 1, rooms: {}, opts: {}, opt: { volume: 0.6, reduceMotion: false, slow: false, showView: true } }; }

export function recordClear(save, ri, run) {
  const room = ROOMS[ri];
  const prev = save.rooms[ri] || { rank: 'C', time: 9999, alerts: 99, opts: [] };
  const got = run.items.filter((i) => i.kind === 'opt' && i.got).map((i) => i.idx);
  const next = {
    rank: RANK_V[rankOf(room, run)] > RANK_V[prev.rank] ? rankOf(room, run) : prev.rank,
    time: Math.min(prev.time, Math.round(run.time * 10) / 10),
    alerts: Math.min(prev.alerts, run.alerts),
    opts: [...new Set([...(prev.opts || []), ...got])].sort(),
  };
  return { ...save, rooms: { ...save.rooms, [ri]: next } };
}

export function collectedTotal(save) {
  let n = 0;
  for (const k of Object.keys(save.rooms)) n += 1 + (save.rooms[k].opts || []).length;
  return n;
}
export function unlocked(save, ri) { return ri === 0 || !!save.rooms[ri - 1]; }
export function endingFor(save) { const n = collectedTotal(save); return ENDINGS.find((e) => n >= e.min); }

// ---- 検証用：警備員が見ない経路（時間拡張探索） ----
export function patrolTimeline(room, phase, horizon, dt = 0.1) {
  const ghost = createRun(room, phase);
  ghost.p.x = -50; ghost.p.y = -50;
  const out = [];
  const n = Math.ceil(horizon / dt);
  for (let i = 0; i <= n; i++) {
    out.push(ghost.guards.map((g) => ({ x: g.x, y: g.y, fx: g.fx, fy: g.fy })));
    ghost.t = i * dt;
    stepGuards(ghost, dt, true);
  }
  return out;
}

export function safeRouteExists(room, phase, horizon = 150, wantPath = false) {
  const dt = 0.1, MOVE = 4; // 1セル=0.4秒
  const tl = patrolTimeline(room, phase, horizon + 2, dt);
  const info = roomInfo(room);
  const keys = keyCells(room, phase);
  const full = (1 << keys.length) - 1;
  const W = room.rows[0].length, H = room.rows.length;
  const ticks = Math.floor(horizon / dt);
  const msCache = new Map();
  const msAt = (i) => { if (!msCache.has(i)) msCache.set(i, moverSet(room, i * dt)); return msCache.get(i); };
  const safeAt = (i, x, y, moving = false) => {
    const nr = moving ? (tileAt(room, Math.floor(x), Math.floor(y)) === 'm' ? CFG.noiseMetal + 0.3 : CFG.noiseWalk + 0.3) : 1.0;
    const ms = msAt(i);
    if (blockedMove(room, Math.floor(x), Math.floor(y), ms)) return false;
    for (const g of tl[Math.min(i, tl.length - 1)]) {
      if (Math.hypot(g.x - x, g.y - y) < nr) return false;
      if (i * dt >= (room.grace || CFG.grace) && guardSees(room, g, x, y, ms)) return false;
    }
    for (const l of room.lights || []) { const lp = lightPos(l, i * dt); if (Math.hypot(lp.x - x, lp.y - y) < l.r + 0.2) return false; }
    return true;
  };
  const seen = new Set();
  const par = new Map();
  const q = [[info.start[0], info.start[1], 0, 0]];
  const id = (x, y, t, m) => ((m * (ticks + 1) + t) * H + y) * W + x;
  seen.add(id(info.start[0], info.start[1], 0, 0));
  const target = room.finalAlarm ? null : info.exit;
  for (let qi = 0; qi < q.length; qi++) {
    const [x, y, t, m0] = q[qi];
    let m = m0;
    keys.forEach(([kx, ky], i) => { if (kx === x && ky === y) m |= 1 << i; });
    if (m === full && (room.finalAlarm || (x === target[0] && y === target[1]))) {
      if (!wantPath) return true;
      const path = []; let k = id(x, y, t, m0);
      while (k !== undefined) { const st = par.get(k); if (!st) { path.push([info.start[0], info.start[1], 0]); break; } path.push(st.cur); k = st.prev; }
      return path.reverse();
    }
    if (t + 1 > ticks) continue;
    const nexts = [[x, y, t + 1]];
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ax, ny = y + ay;
      if (t + MOVE > ticks) continue;
      let ok = true;
      for (let s = 1; s <= MOVE && ok; s++) {
        const f = s / MOVE;
        ok = safeAt(t + s, x + 0.5 + ax * f, y + 0.5 + ay * f, true);
      }
      if (ok) nexts.push([nx, ny, t + MOVE]);
    }
    for (const [nx, ny, nt] of nexts) {
      if (nx === x && ny === y) { if (!safeAt(nt, x + 0.5, y + 0.5)) continue; }
      const k = id(nx, ny, nt, m);
      if (!seen.has(k)) { seen.add(k); par.set(k, { prev: id(x, y, t, m0), cur: [nx, ny, nt] }); q.push([nx, ny, nt, m]); }
    }
  }
  return false;
}

// 静的な地形だけで、各区間（開始→必須品→出口）に頂点を共有しない2ルートがあるかを調べる（最大流）
export function routeCount(room, phase = 0) {
  const info = roomInfo(room);
  const stops = [info.start, ...keyCells(room, phase), info.exit];
  let best = 9;
  for (let i = 0; i < stops.length - 1; i++) best = Math.min(best, disjointPaths(room, stops[i], stops[i + 1]));
  return best;
}
function disjointPaths(room, a, b) {
  const W = room.rows[0].length, H = room.rows.length, N = W * H;
  const id = (x, y) => y * W + x;
  const cap = new Map();
  const adj = Array.from({ length: N * 2 }, () => []);
  const add = (u, v, c) => { cap.set(u * 100000 + v, (cap.get(u * 100000 + v) || 0) + c); if (!cap.has(v * 100000 + u)) cap.set(v * 100000 + u, 0); adj[u].push(v); adj[v].push(u); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (BLOCK_MOVE.has(tileAt(room, x, y))) continue;
    add(id(x, y) * 2, id(x, y) * 2 + 1, 1);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!BLOCK_MOVE.has(tileAt(room, nx, ny))) add(id(x, y) * 2 + 1, id(nx, ny) * 2, 1);
    }
  }
  const s = id(a[0], a[1]) * 2 + 1, t = id(b[0], b[1]) * 2;
  let flow = 0;
  for (let k = 0; k < 3; k++) {
    const prev = new Map([[s, -1]]);
    const q = [s];
    for (let i = 0; i < q.length && !prev.has(t); i++) {
      for (const v of adj[q[i]]) if (!prev.has(v) && cap.get(q[i] * 100000 + v) > 0) { prev.set(v, q[i]); q.push(v); }
    }
    if (!prev.has(t)) break;
    for (let v = t; prev.get(v) !== -1; v = prev.get(v)) { const u = prev.get(v); cap.set(u * 100000 + v, cap.get(u * 100000 + v) - 1); cap.set(v * 100000 + u, cap.get(v * 100000 + u) + 1); }
    flow++;
  }
  return flow;
}
function bfsPath(room, a, b, blocked) {
  const q = [a], prev = new Map([[`${a[0]},${a[1]}`, null]]);
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    if (x === b[0] && y === b[1]) {
      const out = []; let k = `${x},${y}`;
      while (k) { const [cx, cy] = k.split(',').map(Number); out.push([cx, cy]); k = prev.get(k); }
      return out.reverse();
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (prev.has(k) || BLOCK_MOVE.has(tileAt(room, nx, ny)) || blocked.has(k)) continue;
      prev.set(k, `${x},${y}`); q.push([nx, ny]);
    }
  }
  return null;
}

export function hintTrail(room, phase) {
  const info = roomInfo(room);
  const k = keyCells(room, phase)[0];
  const p = bfsPath(room, info.start, k, new Set());
  return p || [];
}

export function loadSave(storage) {
  try {
    const raw = storage.getItem('moonlight-heist-v1');
    if (!raw) return emptySave();
    const d = JSON.parse(raw);
    return { ...emptySave(), ...d, opt: { ...emptySave().opt, ...(d.opt || {}) }, rooms: d.rooms || {} };
  } catch { return emptySave(); }
}
export function saveSave(storage, s) {
  try { storage.setItem('moonlight-heist-v1', JSON.stringify(s)); } catch { /* 保存できなくても遊べる */ }
}

// ---------- 無線（キツネ） ----------
// 操作の説明を、キーボード／タッチに合わせて言い換える。
export function radioText(text, touch) {
  if (!touch) return text;
  return text.replace(/Shift（忍び足）|Shift ?/g, '「忍び足」ボタン').replace(/Space（おとり）|Space ?/g, '「おとり」ボタン');
}
// 第1室の手引き：プレイの状態を見て、次に言うべきセリフを1つ返す（done は言い終えた id の Set）。
export function tutorialCue(run, done, touch) {
  const say = (id, text) => (done.has(id) ? null : { id, text: radioText(text, touch) });
  const sx = run.start ? run.start[0] : run.p.x, sy = run.start ? run.start[1] : run.p.y;
  const moved = Math.hypot(run.p.x - sx, run.p.y - sy);
  const near = run.guards.some((g) => Math.hypot(g.x - run.p.x, g.y - run.p.y) < 4.5);
  const order = [
    ['move', () => true, touch ? '聞こえるか、ルウ。キツネだ。左下のパッドで動いてみろ。' : '聞こえるか、ルウ。キツネだ。WASDか矢印キーで動いてみろ。'],
    ['trail', () => moved > 1.2 || run.t > 5, '床に光る足跡が見えるか？ たどれば“夜のかけら”に着く。'],
    ['guard', () => near || run.t > 11, '赤い服が警備員だ。ランタンの光の扇に入るな。像やケースの陰なら見えない。'],
    ['decoy', () => run.t > 24 && run.decoys > 0, '近づけないときは Space（おとり）。小石の音で警備員を引きつけられる。'],
  ];
  if (run.gauge > 0.3 && run.t > 4 && done.has('move') && !done.has('gauge')) return say('gauge', '画面上のゲージがたまってる！ 満ちる前に視線の外へ出ろ。');
  for (const [id, cond, text] of order) {
    if (done.has(id)) continue;
    return cond() ? say(id, text) : null;
  }
  return null;
}

// ルウの記憶：クリア済みの室に対応する記憶が戻っている。
export function memoryIndex(ri) { return MEMORIES.findIndex((m) => m.room === ri); }
export function memoriesUnlocked(save) { return MEMORIES.map((m) => !!save.rooms[m.room]); }
