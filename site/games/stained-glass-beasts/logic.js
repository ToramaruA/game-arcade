// 画面に依存しない物理・進行・記録。DOM を触らない。
export const W = 640;
export const H = 800;
export const LAUNCH = { x: 320, y: 740 };
export const R = 6;
export const SPEED = 380;
export const FIXED_DT = 1 / 240;
export const WALL_L = 24;
export const WALL_R = 616;
export const WALL_T = 64;
export const FLOOR_Y = 780;
export const MAX_ANGLE = 75;
export const OUT_LIMIT = 8;
export const OUT_WARN = 7;
export const RECALL_MIN_T = 0.35;
export const RECALL_MIN_DIST = 120;
export const EPS_T = 1e-6;
export const MAX_CONTACTS = 8;

const WALLS = [
  { a: [WALL_L, WALL_T], b: [WALL_L, 900] },
  { a: [WALL_R, WALL_T], b: [WALL_R, 900] },
  { a: [WALL_L, WALL_T], b: [WALL_R, WALL_T] },
];

// ---- 幾何 ----
// 円（半径 r）が (px,py) から (dx,dy) だけ動くとき、線分 ab に最初に触れる s∈[0,1] と法線
export function sweepCircleSegment(px, py, dx, dy, r, ax, ay, bx, by) {
  const ex = bx - ax; const ey = by - ay;
  const len = Math.hypot(ex, ey);
  if (len === 0) return null;
  const ux = ex / len; const uy = ey / len;
  let nx = -uy; let ny = ux;
  let d0 = (px - ax) * nx + (py - ay) * ny;
  if (d0 < 0) { nx = -nx; ny = -ny; d0 = -d0; }
  let best = null;
  const toward = dx * nx + dy * ny;
  if (toward < 0) {
    const s = d0 >= r ? (r - d0) / toward : 0;
    if (s >= 0 && s <= 1) {
      const cx = px + dx * s; const cy = py + dy * s;
      const t = (cx - ax) * ux + (cy - ay) * uy;
      if (t >= 0 && t <= len) best = { s, nx, ny };
    }
  }
  for (const [qx, qy] of [[ax, ay], [bx, by]]) {
    const fx = px - qx; const fy = py - qy;
    const A = dx * dx + dy * dy;
    if (A === 0) continue;
    const B = 2 * (fx * dx + fy * dy);
    const C = fx * fx + fy * fy - r * r;
    let s = null;
    if (C <= 0) {
      if (B < 0) s = 0;
    } else {
      const disc = B * B - 4 * A * C;
      if (disc >= 0) {
        const s1 = (-B - Math.sqrt(disc)) / (2 * A);
        if (s1 >= 0 && s1 <= 1) s = s1;
      }
    }
    if (s !== null && (!best || s < best.s)) {
      const cx = px + dx * s - qx; const cy = py + dy * s - qy;
      const l = Math.hypot(cx, cy) || 1;
      best = { s, nx: cx / l, ny: cy / l };
    }
  }
  return best;
}

export function polyEdges(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]; const b = pts[(i + 1) % pts.length];
    out.push([a[0], a[1], b[0], b[1]]);
  }
  return out;
}

// ---- 面データの準備 ----
export function prepareLevel(level) {
  if (level._ready) return level;
  for (const p of level.pieces) {
    p.edges = polyEdges(p.pts);
    const xs = p.pts.map((q) => q[0]); const ys = p.pts.map((q) => q[1]);
    p.bbox = [Math.min(...xs) - R - 1, Math.min(...ys) - R - 1, Math.max(...xs) + R + 1, Math.max(...ys) + R + 1];
    if (p.kind === 'heart') p.hp = 2;
    else if (p.kind === 'glass' || p.kind === 'mirror') p.hp = 1;
  }
  level._ready = true;
  return level;
}

// ---- 戦いの状態 ----
export function createBattle(level) {
  prepareLevel(level);
  const hp = {};
  for (const p of level.pieces) if (p.hp) hp[p.id] = p.hp;
  return {
    level, hp, gone: {}, open: {},
    ammo: level.ammo, shots: 0, status: 'aim', // aim | fly | won | lost
    shot: null, log: [], lastOut: [], lastBack: [], chain: 0, maxChain: 0, ended: false, events: [],
  };
}

export function cloneBattle(b) {
  return {
    ...b, hp: { ...b.hp }, gone: { ...b.gone }, open: { ...b.open },
    shot: b.shot && { ...b.shot, hitOut: { ...b.shot.hitOut }, hitBack: { ...b.shot.hitBack }, bellDone: { ...b.shot.bellDone } },
    log: b.log.slice(), lastOut: [], lastBack: [], events: null,
  };
}

export function clampAngle(a) { return Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, a)); }

export function fire(b, angleDeg) {
  if (b.status !== 'aim' || b.ammo <= 0) return false;
  const a = (clampAngle(angleDeg) * Math.PI) / 180;
  b.open = {}; // 開いた装甲は次射開始時に閉じる
  b.ammo -= 1; b.shots += 1; b.status = 'fly';
  b.chain = 0;
  b.shot = {
    mode: 'out', t: 0, x: LAUNCH.x, y: LAUNCH.y,
    vx: Math.sin(a) * SPEED, vy: -Math.cos(a) * SPEED,
    hitOut: {}, hitBack: {}, bellDone: {}, recallT: null, index: b.shots,
    reflections: 0, stop: null, ended: false,
  };
  b.lastOut = [[LAUNCH.x, LAUNCH.y]]; b.lastBack = [];
  return true;
}

export function canRecall(b) {
  const s = b.shot;
  if (b.status !== 'fly' || !s || s.mode !== 'out') return false;
  if (s.t < RECALL_MIN_T) return false;
  return Math.hypot(s.x - LAUNCH.x, s.y - LAUNCH.y) >= RECALL_MIN_DIST;
}

export function recall(b) {
  if (!canRecall(b)) return false;
  const s = b.shot;
  const dx = LAUNCH.x - s.x; const dy = LAUNCH.y - s.y;
  const l = Math.hypot(dx, dy);
  s.mode = 'back'; s.vx = (dx / l) * SPEED; s.vy = (dy / l) * SPEED; s.recallT = s.t;
  b.chain = 0;
  b.lastBack = [[s.x, s.y]];
  return true;
}

function activeContacts(b, s, dx, dy) {
  const out = [];
  const back = s.mode === 'back';
  const x0 = Math.min(s.x, s.x + dx); const x1 = Math.max(s.x, s.x + dx);
  const y0 = Math.min(s.y, s.y + dy); const y1 = Math.max(s.y, s.y + dy);
  for (const p of b.level.pieces) {
    if (b.gone[p.id]) continue;
    if (x1 < p.bbox[0] || x0 > p.bbox[2] || y1 < p.bbox[1] || y0 > p.bbox[3]) continue;
    if (p.kind === 'armor' && b.open[p.id]) continue;
    if (back) {
      if (p.kind === 'bell') continue;
      if (s.hitBack[p.id]) continue;
    }
    for (const e of p.edges) {
      const c = sweepCircleSegment(s.x, s.y, dx, dy, R, e[0], e[1], e[2], e[3]);
      if (c) out.push({ ...c, piece: p });
    }
  }
  if (!back) {
    for (const w of WALLS) {
      const c = sweepCircleSegment(s.x, s.y, dx, dy, R, w.a[0], w.a[1], w.b[0], w.b[1]);
      if (c) out.push({ ...c, piece: null });
    }
  }
  return out;
}

function allHeartsDown(b) {
  for (const p of b.level.pieces) if (p.kind === 'heart' && !b.gone[p.id]) return false;
  return true;
}

function endShot(b) {
  const s = b.shot;
  s.ended = true;
  b.status = 'aim';
  if (allHeartsDown(b)) b.status = 'won';
  else if (b.ammo <= 0) b.status = 'lost';
  b.ended = b.status !== 'aim';
}

function damage(b, p, phase) {
  const s = b.shot;
  const set = phase === 'back' ? s.hitBack : s.hitOut;
  if (set[p.id]) return false;
  set[p.id] = true;
  b.hp[p.id] -= 1;
  return b.hp[p.id] <= 0;
}

// 1 固定ステップ進める（FPS に依存しない）
export function step(b, dt = FIXED_DT) {
  if (b.status !== 'fly') return;
  const s = b.shot;
  s.t += dt;
  let remain = SPEED * dt;
  const trail = s.mode === 'back' ? b.lastBack : b.lastOut;
  for (let n = 0; n <= MAX_CONTACTS && remain > 1e-9; n++) {
    const sp = Math.hypot(s.vx, s.vy);
    const dx = (s.vx / sp) * remain; const dy = (s.vy / sp) * remain;
    const cs = n < MAX_CONTACTS ? activeContacts(b, s, dx, dy) : [];
    if (!cs.length) { s.x += dx; s.y += dy; remain = 0; break; }
    let smin = Infinity;
    for (const c of cs) if (c.s < smin) smin = c.s;
    const tol = (EPS_T * SPEED) / Math.hypot(dx, dy);
    const group = cs.filter((c) => c.s <= smin + tol);
    group.sort((a, c) => (a.piece ? a.piece.id : '~').localeCompare(c.piece ? c.piece.id : '~'));
    s.x += dx * smin; s.y += dy * smin;
    trail.push([s.x, s.y]);
    const phase = s.mode;
    const seen = new Set();
    const broken = [];
    let stop = false;
    let reflect = false;
    for (const c of group) {
      const p = c.piece;
      if (!p) { reflect = true; continue; }
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      if (phase === 'back') {
        if (p.kind === 'armor') { stop = true; continue; }
        if (damage(b, p, 'back')) broken.push(p);
      } else if (p.kind === 'armor') {
        reflect = true;
      } else if (p.kind === 'bell') {
        reflect = true;
        if (!s.bellDone[p.id]) { s.bellDone[p.id] = true; if (p.link) b.open[p.link] = true; }
      } else {
        reflect = true;
        if (damage(b, p, 'out')) broken.push(p);
      }
    }
    if (b.events) {
      for (const c of group) {
        const p = c.piece;
        b.events.push({ type: p ? p.kind : 'wall', id: p ? p.id : null, x: s.x, y: s.y, phase, broken: !!p && broken.includes(p), nx: c.nx, ny: c.ny, chain: b.chain + broken.length });
      }
    }
    for (const p of broken) {
      b.gone[p.id] = true;
      b.log.push({ id: p.id, phase, shot: s.index });
      b.chain += 1;
      if (b.chain > b.maxChain) b.maxChain = b.chain;
    }
    if (stop) { s.stop = { x: s.x, y: s.y }; trail.push([s.x, s.y]); endShot(b); return; }
    if (allHeartsDown(b)) { endShot(b); return; }
    if (reflect && phase === 'out') {
      const first = group[0];
      const dot = s.vx * first.nx + s.vy * first.ny;
      if (dot < 0) { s.vx -= 2 * dot * first.nx; s.vy -= 2 * dot * first.ny; }
      s.x += first.nx * 1e-3; s.y += first.ny * 1e-3;
      s.reflections += 1;
    }
    remain *= 1 - smin;
    if (remain < 1e-6) remain = 0;
  }
  if (s.mode === 'out') {
    if (s.y >= FLOOR_Y || s.t >= OUT_LIMIT) { trail.push([s.x, s.y]); endShot(b); return; }
  } else if (Math.hypot(s.x - LAUNCH.x, s.y - LAUNCH.y) <= 8 || (s.y >= LAUNCH.y && s.vy > 0)) {
    trail.push([s.x, s.y]);
    endShot(b);
  }
}

export function advance(b, seconds) {
  const n = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < n && b.status === 'fly'; i++) step(b);
}

// 外周リングで知らせる（終了1秒前から）
export function outWarning(b) {
  const s = b.shot;
  return !!(b.status === 'fly' && s && s.mode === 'out' && s.t >= OUT_WARN);
}

// ---- 予測（本物と同じ関数を複製に対して走らせる）----
export function previewAim(b, angleDeg, reflections = 2) {
  const c = cloneBattle(b);
  if (!fire(c, angleDeg)) return [];
  const pts = [[LAUNCH.x, LAUNCH.y]];
  let last = 0;
  for (let i = 0; i < 2400 && c.status === 'fly'; i++) {
    step(c);
    if (c.shot.reflections !== last) {
      last = c.shot.reflections;
      pts.push([c.shot.x, c.shot.y]);
      if (last >= reflections) return pts;
    }
  }
  pts.push([c.shot.x, c.shot.y]);
  return pts;
}

// 今すぐ呼び戻したときの帰路。{ pts, stop, hearts, hits }
export function previewReturn(b) {
  const s = b.shot;
  if (b.status !== 'fly' || !s || s.mode !== 'out') return null;
  const c = cloneBattle(b);
  const cs = c.shot;
  const dx = LAUNCH.x - cs.x; const dy = LAUNCH.y - cs.y;
  const l = Math.hypot(dx, dy) || 1;
  cs.mode = 'back'; cs.vx = (dx / l) * SPEED; cs.vy = (dy / l) * SPEED;
  c.lastBack = [[cs.x, cs.y]];
  const hitsBefore = new Set(Object.keys(c.gone));
  let guard = 0;
  while (c.status === 'fly' && guard++ < 4000) step(c);
  const hits = [];
  for (const p of c.level.pieces) {
    if (cs.hitBack[p.id]) hits.push(p.id);
  }
  const hearts = hits.filter((id) => c.level.pieces.find((p) => p.id === id).kind === 'heart');
  return { pts: c.lastBack, stop: cs.stop, hits, hearts, valid: canRecall(b), wouldWin: c.status === 'won', hitsBefore: hitsBefore.size };
}

// ---- 達成目標 ----
export function breakableIds(level) {
  return level.pieces.filter((p) => p.kind === 'glass' || p.kind === 'mirror').map((p) => p.id);
}

export function evaluateWin(b) {
  if (b.status !== 'won') return null;
  const need = breakableIds(b.level);
  const perfect = need.every((id) => b.gone[id]);
  return { clear: true, par: b.shots <= b.level.par, perfect, shots: b.shots };
}

// ---- リプレイ（角度と呼び戻し時刻）----
// replay: [{ angle, recall: 秒 | null }, ...]  speedScale は論理経路に影響しない
export function runReplay(level, replay, onShot) {
  const b = createBattle(level);
  for (const sh of replay) {
    if (b.status !== 'aim') break;
    fire(b, sh.angle);
    let recalled = false;
    let guard = 0;
    while (b.status === 'fly' && guard++ < 100000) {
      if (!recalled && sh.recall != null && b.shot.t + 1e-9 >= sh.recall) { recall(b); recalled = true; }
      step(b);
    }
    if (onShot) onShot(b, sh);
  }
  return b;
}

// ---- 進行・保存 ----
export const SAVE_KEY = 'stained-glass-beasts:v1';

export function emptyProgress() {
  return { levels: {}, practice: {}, pins: [], memorials: {}, volume: 0.6, muted: false, seenIntro: false };
}

export function normalizeProgress(raw) {
  const p = emptyProgress();
  if (!raw || typeof raw !== 'object') return p;
  if (raw.levels && typeof raw.levels === 'object') p.levels = raw.levels;
  if (raw.practice && typeof raw.practice === 'object') p.practice = raw.practice;
  if (Array.isArray(raw.pins)) p.pins = raw.pins.filter((x) => typeof x === 'string').slice(0, 3);
  if (raw.memorials && typeof raw.memorials === 'object') p.memorials = raw.memorials;
  if (typeof raw.volume === 'number') p.volume = Math.max(0, Math.min(1, raw.volume));
  if (typeof raw.muted === 'boolean') p.muted = raw.muted;
  if (typeof raw.seenIntro === 'boolean') p.seenIntro = raw.seenIntro;
  return p;
}

export function isCleared(progress, levelId) { return !!progress.levels[levelId]?.clear; }

export function isUnlocked(progress, levels, index) {
  if (index <= 0) return true;
  return isCleared(progress, levels[index - 1].id);
}

export function lockReason(levels, index) {
  const prev = levels[index - 1];
  return prev ? `「${prev.name}」を撃破すると解放` : '';
}

// 通常速度の結果だけを記録に積む。練習速度は別に保存する
export function recordResult(progress, levelId, result, practice) {
  const store = practice ? progress.practice : progress.levels;
  const cur = store[levelId] || { clear: false, par: false, perfect: false, best: null };
  const next = {
    clear: cur.clear || result.clear,
    par: cur.par || result.par,
    perfect: cur.perfect || result.perfect,
    best: cur.best == null ? result.shots : Math.min(cur.best, result.shots),
  };
  store[levelId] = next;
  return next;
}

export function totalStars(progress, levels) {
  let n = 0;
  for (const l of levels) {
    const r = progress.levels[l.id];
    if (r) n += (r.clear ? 1 : 0) + (r.par ? 1 : 0) + (r.perfect ? 1 : 0);
  }
  return n;
}

export function pinMemorial(progress, id, replaceId) {
  const pins = progress.pins.filter((x) => x !== id);
  if (replaceId && pins.includes(replaceId)) pins.splice(pins.indexOf(replaceId), 1, id);
  else if (pins.length < 3) pins.push(id);
  else return false;
  progress.pins = pins;
  return true;
}

export function unpinMemorial(progress, id) {
  progress.pins = progress.pins.filter((x) => x !== id);
}

// ---- 記念窓 ----
export function buildMemorial(b, win) {
  const level = b.level;
  const order = b.log.map((e) => ({ id: e.id, phase: e.phase, shot: e.shot }));
  return {
    levelId: level.id,
    result: b.status === 'won' ? 'won' : 'lost',
    shots: b.shots,
    goals: win ? { clear: true, par: win.par, perfect: win.perfect } : { clear: false, par: false, perfect: false },
    order,
    broken: Object.keys(b.gone),
    lastOut: b.lastOut.map(roundPt),
    lastBack: b.lastBack.map(roundPt),
    maxChain: b.maxChain,
    backBreaks: b.log.filter((e) => e.phase === 'back').length,
    at: Date.now(),
  };
}

function roundPt(p) { return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]; }

export function shareText(mem, level) {
  const total = level.pieces.filter((p) => p.kind === 'glass' || p.kind === 'mirror' || p.kind === 'heart').length;
  if (mem.result !== 'won') {
    return `硝子の${level.beastName}に挑戦中（${level.name}）。${mem.shots}球で未撃破、破壊${mem.broken.length}/${total}枚。砕け、ステンドグラスの獣`;
  }
  const bits = [`硝子の${level.beastName}を${mem.shots}球で撃破（${level.name}）。`];
  if (mem.maxChain >= 2 && mem.backBreaks >= 2) bits.push(`帰り道で${mem.maxChain}枚を連続破壊。`);
  else if (mem.backBreaks >= 1) bits.push('帰り道の一撃で仕留めた。');
  if (mem.goals.perfect) bits.push('全破壊達成。');
  bits.push('砕け、ステンドグラスの獣');
  return bits.join('');
}
