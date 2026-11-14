// 月下の灯台と影の大行進：画面に依存しないルール。Node のテストからも import する。
// 固定 dt（1/60秒）で進める。停止中は進行ゼロ。乱数は使わない（同じ入力なら同じ結果）。
import { NIGHTS, KEEPERS, TOWER_FROM, wavesFor } from './levels.js';

export const COLS = 12;
export const ROWS = 8;
export const DT = 1 / 60;
export const HP_MAX = 10;
export const ENERGY_CAP = 240;
export const START_ENERGY = 120;
export const WAVE_BONUS = 25;
export const RELOCATE_COST = 10;
export const RELOCATE_DARK = 2;
export const SELL_RATE = 0.6;
export const SIGNAL_COST = 20;
export const SIGNAL_CD = 12;
export const SIGNAL_DMG = 24;
export const SIGNAL_STUN = 2;
export const KEEPER_REACH = 0.5;
export const KEEPER_STOP = 2;
export const KEEPER_STOP_BOSS = 0.5;
export const KEEPER_CD = 8;
export const ASSIST_ENERGY = 40;
// 調整用の倍率（鎧：黄の光の外で赤・白のダメージに掛かる）
export const RULES = { armor: 0.5, signalDmg: SIGNAL_DMG };

export const TOWERS = {
  red: { name: '赤塔', cost: 40, up: [30, 45], dps: [6, 9, 12], r: [1.8, 1.8, 1.8], shape: 'tri', desc: '集めた光で先頭の影を撃つ（毎秒6→9→12・射程1.8）' },
  blue: { name: '青塔', cost: 30, up: [30, 45], slow: [0.6, 0.5, 0.4], r: [2.2, 2.2, 2.2], shape: 'circle', desc: '光の中の影を遅くする（0.6→0.5→0.4倍）' },
  yellow: { name: '黄塔', cost: 30, up: [30, 45], r: [2.2, 2.6, 3.0], shape: 'diamond', desc: '光の中の鎧を消す（半径2.2→2.6→3）' },
  white: { name: '白塔', cost: 50, up: [30, 45], dps: [3, 4.5, 6], r: [2.2, 2.2, 2.2], shape: 'star', desc: '光の中の全員を削る（毎秒3→4.5→6）' },
};
export const TOWER_TYPES = ['red', 'blue', 'yellow', 'white'];

// 敵の性能（HP・速度[マス/秒]・通過で減る耐久・撃破報酬）
export const ENEMIES = {
  rat: { name: '影鼠', hp: 18, speed: 0.6, leak: 1, reward: 3 },
  rabbit: { name: '影兎', hp: 12, speed: 1.1, leak: 1, reward: 3 },
  turtle: { name: '殻亀', hp: 60, speed: 0.3, leak: 2, reward: 5, armor: true, heavy: true },
  deer: { name: '影鹿', hp: 90, speed: 0.45, leak: 2, reward: 5, armor: true, heavy: true },
  moth: { name: '霧蛾', hp: 24, speed: 0.8, leak: 1, reward: 3, blueImmune: true },
  twin: { name: '双子影', hp: 30, speed: 0.55, leak: 1, reward: 3, split: true },
  mini: { name: '小鼠', hp: 8, speed: 0.8, leak: 1, reward: 0 },
  fish: { name: '吸灯魚', hp: 40, speed: 0.6, leak: 1, reward: 3, drain: true },
  owl: { name: '鐘梟', hp: 45, speed: 0.5, leak: 1, reward: 3, heal: true },
  kingdeer: { name: '影鹿の王', hp: 360, speed: 0.3, leak: 10, reward: 20, armor: true, boss: true },
  kingturtle: { name: '潮の大亀', hp: 420, speed: 0.22, leak: 10, reward: 20, armor: true, boss: true, shell: true },
  lord: { name: '夜の主', hp: 520, speed: 0.25, leak: 10, reward: 20, boss: true, summon: true },
};

export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// ───────── 地形 ─────────
function resolvePath(corners, lh) {
  const pts = corners.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 }));
  const last = corners[corners.length - 1];
  if (last[0] !== lh[0] || last[1] !== lh[1]) pts.push({ x: lh[0] + 0.5, y: lh[1] + 0.5 });
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y));
  return { pts, cum, len: cum[cum.length - 1] };
}

export function pointAt(path, s) {
  const { pts, cum } = path;
  if (s <= 0) return { x: pts[0].x, y: pts[0].y, dx: pts[1].x - pts[0].x, dy: pts[1].y - pts[0].y };
  for (let i = 1; i < pts.length; i++) {
    if (s <= cum[i] || i === pts.length - 1) {
      const seg = cum[i] - cum[i - 1] || 1;
      const k = Math.min(1, (s - cum[i - 1]) / seg);
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k, dx: pts[i].x - pts[i - 1].x, dy: pts[i].y - pts[i - 1].y };
    }
  }
  return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, dx: 1, dy: 0 };
}

// 道が通るマス（"x,y" の集合）
export function pathCells(paths) {
  const set = new Set();
  for (const p of paths) {
    for (let i = 1; i < p.pts.length; i++) {
      const a = p.pts[i - 1]; const b = p.pts[i];
      const steps = Math.ceil(dist(a.x, a.y, b.x, b.y) * 4);
      for (let k = 0; k <= steps; k++) {
        const x = Math.floor(a.x + (b.x - a.x) * (k / steps));
        const y = Math.floor(a.y + (b.y - a.y) * (k / steps));
        if (x >= 0 && x < COLS && y >= 0 && y < ROWS) set.add(`${x},${y}`);
      }
    }
  }
  return set;
}

// 道のそばを最もよく照らせるマスを、間隔をあけて選ぶ（台座の自動配置）
function autoPedestals(paths, lh, count) {
  const cells = pathCells(paths);
  const samples = [];
  for (const p of paths) for (let s = 0; s <= p.len; s += 0.25) {
    const q = pointAt(p, s);
    if (q.x >= 0 && q.x <= COLS && q.y >= 0 && q.y <= ROWS) samples.push(q);
  }
  const cand = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (cells.has(`${x},${y}`) || (x === lh[0] && y === lh[1])) continue;
    let score = 0;
    for (const q of samples) if (dist(q.x, q.y, x + 0.5, y + 0.5) <= 2.2) score += 1;
    score += ((x * 7 + y * 13) % 5) * 0.01; // 同点の並びを固定
    cand.push({ x, y, score });
  }
  cand.sort((a, b) => b.score - a.score);
  const out = [];
  for (const minGap of [2.2, 2, 1.5]) {
    for (const c of cand) {
      if (out.length >= count) break;
      if (out.some((o) => o.x === c.x && o.y === c.y)) continue;
      if (out.every((o) => dist(o.x, o.y, c.x, c.y) >= minGap)) out.push(c);
    }
  }
  return out.map((c) => [c.x, c.y]);
}

function keeperPoints(paths) {
  const pts = [];
  const add = (q, path) => {
    if (q.x < 0 || q.x > COLS || q.y < 0 || q.y > ROWS) return;
    if (pts.some((p) => dist(p.x, p.y, q.x, q.y) < 0.9)) return;
    pts.push({ x: q.x, y: q.y, path });
  };
  paths.forEach((p, pi) => {
    for (let i = 1; i < p.pts.length - 1; i++) add(p.pts[i], pi);
    add(pointAt(p, p.len - 1.5), pi);
  });
  return pts;
}

const mapCache = new Map();
export function buildMap(nightIndex) {
  if (mapCache.has(nightIndex)) return mapCache.get(nightIndex);
  const n = NIGHTS[nightIndex];
  const paths = n.paths.map((c) => resolvePath(c, n.lh));
  const pedCount = n.peds ? n.peds.length : Math.min(12, 8 + Math.floor(nightIndex / 4));
  const peds = (n.peds || autoPedestals(paths, n.lh, pedCount)).map(([x, y]) => ({ x: x + 0.5, y: y + 0.5, cx: x, cy: y }));
  const map = { lh: { x: n.lh[0] + 0.5, y: n.lh[1] + 0.5 }, paths, peds, keeperPts: keeperPoints(paths), cells: pathCells(paths) };
  mapCache.set(nightIndex, map);
  return map;
}

export function towerAvailable(nightIndex, type) {
  return nightIndex >= TOWER_FROM[type];
}

export function keepersAvailable(nightIndex) {
  return Object.keys(KEEPERS).filter((k) => nightIndex >= KEEPERS[k].from);
}

// ───────── 夜の状態 ─────────
export function createNight(nightIndex, opts = {}) {
  const night = NIGHTS[nightIndex];
  const mode = opts.mode || 'normal';
  const map = buildMap(nightIndex);
  const keeperType = opts.keeper && keepersAvailable(nightIndex).includes(opts.keeper) ? opts.keeper : 'mina';
  const exit = map.keeperPts.filter((p) => p.path === 0).pop() || map.keeperPts[0];
  const s = {
    night: nightIndex, mode, map, waves: wavesFor(nightIndex, mode),
    assist: !!opts.assist,
    hp: HP_MAX, energy: Math.min(ENERGY_CAP, (night.energy ?? START_ENERGY) + (opts.assist ? ASSIST_ENERGY : 0)),
    towers: [], nextTowerId: 1,
    enemies: [], nextEnemyId: 1, queue: [],
    waveIdx: 0, inWave: false, waveTime: 0,
    frame: 0, time: 0,
    signalCd: 0,
    keeper: { type: keeperType, x: exit.x, y: exit.y, point: map.keeperPts.indexOf(exit), target: null, cd: 0 },
    paused: false,
    reserved: { signal: null, keeper: null },
    result: null, lastLeak: null,
    fx: [],
    stats: { minHp: HP_MAX, kills: 0, maxBurst: 0, signalBest: 0, signals: 0, leaks: 0, recent: [] },
    seen: new Set(),
  };
  (night.preset || []).forEach((p) => placeTower(s, p.ped, p.type, 1, TOWERS[p.type].cost));
  if (opts.restore) restore(s, opts.restore);
  return s;
}

function placeTower(s, ped, type, level, spent) {
  const t = { id: s.nextTowerId++, ped, type, level, spent, off: 0 };
  s.towers.push(t);
  return t;
}

export function towerAt(s, ped) { return s.towers.find((t) => t.ped === ped) || null; }
export function towerPos(s, t) { const p = s.map.peds[t.ped]; return { x: p.x, y: p.y }; }
export function towerRadius(t) { return TOWERS[t.type].r[t.level - 1]; }
export const isLit = (t) => t.off <= 0;

// その地点を照らしている点灯中の塔の色
export function colorsAt(s, x, y, towers = s.towers) {
  const set = new Set();
  for (const t of towers) {
    if (!isLit(t)) continue;
    const p = s.map.peds[t.ped];
    if (dist(p.x, p.y, x, y) <= towerRadius(t)) set.add(t.type);
  }
  return set;
}
export function isOverlap(s, x, y) { return colorsAt(s, x, y).size >= 2; }
export function signalRadius(s) { return KEEPERS[s.keeper.type].signalR; }

export function canAfford(s, cost) { return s.energy >= cost; }
function gain(s, n) { s.energy = Math.min(ENERGY_CAP, s.energy + n); }

// ───────── 操作 ─────────
// 戻り値 { ok, reason }
export function build(s, ped, type) {
  if (s.result) return { ok: false, reason: 'over' };
  if (!s.map.peds[ped]) return { ok: false, reason: 'ped' };
  if (towerAt(s, ped)) return { ok: false, reason: 'occupied' };
  if (!towerAvailable(s.night, type)) return { ok: false, reason: 'locked' };
  const cost = TOWERS[type].cost;
  if (!canAfford(s, cost)) return { ok: false, reason: 'energy' };
  s.energy -= cost;
  const t = placeTower(s, ped, type, 1, cost);
  s.fx.push({ kind: 'build', x: s.map.peds[ped].x, y: s.map.peds[ped].y, type });
  return { ok: true, tower: t };
}

export function upgradeCost(t) { return t.level >= 3 ? null : TOWERS[t.type].up[t.level - 1]; }
export function upgrade(s, towerId) {
  const t = s.towers.find((q) => q.id === towerId);
  if (!t || s.result) return { ok: false, reason: 'none' };
  const cost = upgradeCost(t);
  if (cost == null) return { ok: false, reason: 'max' };
  if (!canAfford(s, cost)) return { ok: false, reason: 'energy' };
  s.energy -= cost; t.level += 1; t.spent += cost;
  s.fx.push({ kind: 'upgrade', x: s.map.peds[t.ped].x, y: s.map.peds[t.ped].y, type: t.type });
  return { ok: true };
}

export function relocate(s, towerId, ped) {
  const t = s.towers.find((q) => q.id === towerId);
  if (!t || s.result) return { ok: false, reason: 'none' };
  if (!s.map.peds[ped] || towerAt(s, ped)) return { ok: false, reason: 'occupied' };
  if (!canAfford(s, RELOCATE_COST)) return { ok: false, reason: 'energy' };
  s.energy -= RELOCATE_COST;
  const from = s.map.peds[t.ped];
  t.ped = ped; t.off = RELOCATE_DARK;
  s.fx.push({ kind: 'move', x: s.map.peds[ped].x, y: s.map.peds[ped].y, fx0: from.x, fy0: from.y, type: t.type });
  return { ok: true };
}

export function sellValue(t) { return Math.floor(t.spent * SELL_RATE); }
export function sell(s, towerId) {
  const i = s.towers.findIndex((q) => q.id === towerId);
  if (i < 0 || s.result) return { ok: false, reason: 'none' };
  const t = s.towers[i];
  gain(s, sellValue(t));
  s.towers.splice(i, 1);
  s.fx.push({ kind: 'sell', x: s.map.peds[t.ped].x, y: s.map.peds[t.ped].y, type: t.type });
  return { ok: true };
}

export function signalReady(s) { return s.signalCd <= 0 && !s.reserved.signal; }

export function signal(s, x, y) {
  if (s.result) return { ok: false, reason: 'over' };
  if (s.reserved.signal) return { ok: false, reason: 'reserved' };
  if (s.signalCd > 0) return { ok: false, reason: 'cd' };
  if (!isOverlap(s, x, y)) return { ok: false, reason: 'single' };
  if (!canAfford(s, SIGNAL_COST)) return { ok: false, reason: 'energy' };
  s.energy -= SIGNAL_COST;
  if (s.paused) { s.reserved.signal = { x, y }; return { ok: true, reserved: true }; }
  fireSignal(s, x, y);
  return { ok: true };
}

function fireSignal(s, x, y) {
  const r = signalRadius(s);
  s.signalCd = SIGNAL_CD;
  s.stats.signals += 1;
  let hits = 0;
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    const q = enemyPos(s, e);
    if (dist(q.x, q.y, x, y) <= r) {
      e.hp -= RULES.signalDmg * shellMul(e);
      e.stun = Math.max(e.stun, SIGNAL_STUN);
      hits += 1;
    }
  }
  const killed = processDeaths(s);
  s.stats.signalBest = Math.max(s.stats.signalBest, killed);
  s.fx.push({ kind: 'signal', x, y, r, hits, killed });
}

export function cancelReservation(s, kind) {
  if (kind === 'signal' && s.reserved.signal) { s.reserved.signal = null; gain(s, SIGNAL_COST); return true; }
  if (kind === 'keeper' && s.reserved.keeper != null) { s.reserved.keeper = null; return true; }
  return false;
}

export function moveKeeper(s, pointIdx) {
  const p = s.map.keeperPts[pointIdx];
  if (!p || s.result) return { ok: false };
  if (s.paused) { s.reserved.keeper = pointIdx; return { ok: true, reserved: true }; }
  s.keeper.target = pointIdx;
  s.keeper.point = -1;
  return { ok: true };
}

export function setPaused(s, paused) {
  if (s.paused === paused) return;
  s.paused = paused;
  if (!paused) {
    if (s.reserved.keeper != null) { const k = s.reserved.keeper; s.reserved.keeper = null; moveKeeper(s, k); }
    if (s.reserved.signal) {
      const { x, y } = s.reserved.signal; s.reserved.signal = null;
      if (s.signalCd <= 0 && isOverlap(s, x, y) && !s.result) fireSignal(s, x, y);
      else { gain(s, SIGNAL_COST); s.fx.push({ kind: 'refund', x, y }); }
    }
  }
}

export function canStartWave(s) {
  return !s.result && !s.inWave && s.waveIdx < s.waves.length;
}

export function startWave(s) {
  if (!canStartWave(s)) return false;
  const wave = s.waves[s.waveIdx];
  s.queue = [];
  for (const g of wave) {
    const k = g.pack || 1;
    for (let i = 0; i < g.count; i++) s.queue.push({ t: g.delay + Math.floor(i / k) * g.interval + (i % k) * 0.3, type: g.type, path: g.path });
  }
  s.queue.sort((a, b) => a.t - b.t || a.path - b.path);
  s.inWave = true; s.waveTime = 0; s.waveIdx += 1;
  s.signalCd = 0; s.keeper.cd = 0;
  s.fx.push({ kind: 'wave', n: s.waveIdx });
  return true;
}

// 次の波（または今の波）の予告：道ごとの敵種と数
export function wavePreview(s, index = s.waveIdx) {
  const wave = s.waves[index];
  if (!wave) return [];
  const byPath = new Map();
  for (const g of wave) {
    if (!byPath.has(g.path)) byPath.set(g.path, new Map());
    const m = byPath.get(g.path);
    m.set(g.type, (m.get(g.type) || 0) + g.count);
  }
  return [...byPath.entries()].sort((a, b) => a[0] - b[0]).map(([path, m]) => ({ path, groups: [...m.entries()].map(([type, count]) => ({ type, count })) }));
}

// ───────── 敵 ─────────
function spawn(s, type, path, sOffset = 0, flags = {}) {
  const d = ENEMIES[type];
  const e = {
    id: s.nextEnemyId++, type, path, s: sOffset, hp: d.hp, maxHp: d.hp, stun: 0,
    timer: 0, shellT: 0, summons: 0, phase: 1, noReward: !!flags.noReward, lane: ((s.nextEnemyId * 37) % 7 - 3) / 3,
  };
  s.enemies.push(e);
  s.seen.add(type);
  return e;
}

export function enemyPos(s, e) {
  const p = pointAt(s.map.paths[e.path], e.s);
  return p;
}
export function remaining(s, e) { return s.map.paths[e.path].len - e.s; }
export function shellClosed(e) { return ENEMIES[e.type].shell && e.shellT % 10 >= 6; }
function shellMul(e) { return shellClosed(e) ? 0.5 : 1; }

function processDeaths(s) {
  let killed = 0;
  const born = [];
  s.enemies = s.enemies.filter((e) => {
    if (e.hp > 0) return true;
    const d = ENEMIES[e.type];
    killed += 1;
    s.stats.kills += 1;
    if (!e.noReward) gain(s, d.reward);
    const q = enemyPos(s, e);
    s.fx.push({ kind: 'kill', x: q.x, y: q.y, type: e.type, boss: !!d.boss });
    if (d.split) born.push({ path: e.path, s: e.s });
    return false;
  });
  for (const b of born) {
    spawn(s, 'mini', b.path, b.s, { noReward: true });
    spawn(s, 'mini', b.path, Math.max(0, b.s - 0.3), { noReward: true });
  }
  if (killed) {
    const now = s.time;
    for (let i = 0; i < killed; i++) s.stats.recent.push(now);
    s.stats.recent = s.stats.recent.filter((t) => now - t <= 0.5);
    s.stats.maxBurst = Math.max(s.stats.maxBurst, s.stats.recent.length);
  }
  return killed;
}

// 1フレーム進める
export function step(s) {
  if (s.result || s.paused) return;
  const dt = DT;
  s.frame += 1;
  s.time += dt;
  for (const t of s.towers) if (t.off > 0) t.off = Math.max(0, t.off - dt);
  if (s.signalCd > 0) s.signalCd = Math.max(0, s.signalCd - dt);
  const k = s.keeper;
  if (k.cd > 0) k.cd = Math.max(0, k.cd - dt);

  // 出現
  if (s.inWave) {
    s.waveTime += dt;
    while (s.queue.length && s.queue[0].t <= s.waveTime + 1e-9) {
      const q = s.queue.shift();
      spawn(s, q.type, q.path);
    }
  }

  // 灯守の移動
  if (k.target != null) {
    const p = s.map.keeperPts[k.target];
    const sp = KEEPERS[k.type].speed * dt;
    const d = dist(k.x, k.y, p.x, p.y);
    if (d <= sp) { k.x = p.x; k.y = p.y; k.point = k.target; k.target = null; }
    else { k.x += ((p.x - k.x) / d) * sp; k.y += ((p.y - k.y) / d) * sp; }
  }

  // 塔の効果
  const lit = s.towers.filter(isLit).map((t) => ({ t, p: s.map.peds[t.ped], r: towerRadius(t) }));
  const pos = new Map();
  for (const e of s.enemies) pos.set(e, enemyPos(s, e));
  for (const e of s.enemies) {
    const q = pos.get(e);
    e._yellow = false; e._slow = 1;
    for (const L of lit) {
      if (dist(L.p.x, L.p.y, q.x, q.y) > L.r) continue;
      if (L.t.type === 'yellow') e._yellow = true;
      if (L.t.type === 'blue' && !ENEMIES[e.type].blueImmune) e._slow = Math.min(e._slow, TOWERS.blue.slow[L.t.level - 1]);
    }
  }
  const armorMul = (e) => (ENEMIES[e.type].armor && !e._yellow ? RULES.armor : 1) * shellMul(e);
  for (const L of lit) {
    if (L.t.type === 'red') {
      let best = null; let bestRem = Infinity;
      for (const e of s.enemies) {
        if (e.hp <= 0) continue;
        const q = pos.get(e);
        if (dist(L.p.x, L.p.y, q.x, q.y) > L.r) continue;
        const rem = remaining(s, e);
        if (rem < bestRem) { bestRem = rem; best = e; }
      }
      if (best) { best.hp -= TOWERS.red.dps[L.t.level - 1] * dt * armorMul(best); L.t.aim = best.id; } else L.t.aim = null;
    } else if (L.t.type === 'white') {
      let any = false;
      for (const e of s.enemies) {
        const q = pos.get(e);
        if (dist(L.p.x, L.p.y, q.x, q.y) > L.r) continue;
        e.hp -= TOWERS.white.dps[L.t.level - 1] * dt * armorMul(e); any = true;
      }
      L.t.aim = any ? -1 : null;
    }
  }

  // 敵の特技
  for (const e of s.enemies) {
    const d = ENEMIES[e.type];
    if (e.hp <= 0) continue;
    e.timer += dt;
    if (d.shell) e.shellT += dt;
    if (d.drain && e.timer >= 4) {
      e.timer -= 4;
      if (s.energy > 0) { s.energy = Math.max(0, s.energy - 2); const q = pos.get(e); s.fx.push({ kind: 'drain', x: q.x, y: q.y }); }
    }
    if (d.heal && e.timer >= 6) {
      e.timer -= 6;
      const q = pos.get(e);
      for (const o of s.enemies) {
        if (o === e || o.hp <= 0) continue;
        const qo = pos.get(o) || enemyPos(s, o);
        if (dist(q.x, q.y, qo.x, qo.y) <= 1) o.hp = Math.min(o.maxHp, o.hp + 6);
      }
      s.fx.push({ kind: 'bell', x: q.x, y: q.y });
    }
    if (d.summon) {
      if (e.phase === 1 && e.hp < e.maxHp / 2) { e.phase = 2; const q = pos.get(e); s.fx.push({ kind: 'phase', x: q.x, y: q.y }); }
      if (e.timer >= 12) {
        e.timer -= 12;
        if (e.summons < 4) {
          e.summons += 1;
          spawn(s, 'rabbit', e.path, e.s, { noReward: true });
          spawn(s, 'rabbit', e.path, Math.max(0, e.s - 0.35), { noReward: true });
          const q = pos.get(e); s.fx.push({ kind: 'summon', x: q.x, y: q.y });
        }
      }
    }
  }

  // 撃破（通過より先）
  processDeaths(s);

  // 灯守の足止め
  if (k.target == null && k.cd <= 0) {
    let best = null; let bestRem = Infinity;
    for (const e of s.enemies) {
      if (e.stun > 0) continue;
      const q = enemyPos(s, e);
      if (dist(q.x, q.y, k.x, k.y) > KEEPER_REACH) continue;
      const rem = remaining(s, e);
      if (rem < bestRem) { bestRem = rem; best = e; }
    }
    if (best) {
      best.stun = ENEMIES[best.type].boss ? KEEPER_STOP_BOSS : KEEPER_STOP;
      k.cd = KEEPER_CD;
      s.fx.push({ kind: 'stop', x: k.x, y: k.y, id: best.id });
    }
  }

  // 移動
  const ren = k.type === 'ren';
  for (const e of s.enemies) {
    if (e.stun > 0) { e.stun = Math.max(0, e.stun - dt); continue; }
    const d = ENEMIES[e.type];
    let sp = d.speed;
    if (d.summon && e.phase === 2) sp = 0.4;
    let mul = e._slow ?? 1;
    if (ren && mul < 1) { const q = enemyPos(s, e); if (dist(q.x, q.y, k.x, k.y) <= 1) mul *= 0.9; }
    e.s += sp * mul * dt;
  }

  // 通過
  const keep = [];
  for (const e of s.enemies) {
    if (e.s >= s.map.paths[e.path].len) {
      const d = ENEMIES[e.type];
      const loss = d.leak;
      s.hp -= loss;
      s.stats.leaks += 1;
      s.lastLeak = { path: e.path, type: e.type };
      s.fx.push({ kind: 'leak', path: e.path, type: e.type, loss });
    } else keep.push(e);
  }
  s.enemies = keep;
  s.stats.minHp = Math.min(s.stats.minHp, Math.max(0, s.hp));
  if (s.hp <= 0) { s.hp = 0; s.result = 'lose'; s.inWave = false; s.fx.push({ kind: 'lose' }); return; }

  // 波の完了
  if (s.inWave && s.queue.length === 0 && s.enemies.length === 0) {
    s.inWave = false;
    gain(s, WAVE_BONUS);
    s.fx.push({ kind: 'waveClear', n: s.waveIdx });
    if (s.waveIdx >= s.waves.length) { s.result = 'win'; s.fx.push({ kind: 'win' }); }
  }
}

export function starsFor(hp) {
  if (hp <= 0) return 0;
  if (hp >= HP_MAX) return 3;
  if (hp >= 8) return 2;
  return 1;
}

// ───────── 保存（波間のみ） ─────────
export function snapshot(s) {
  if (s.inWave || s.result) return null;
  return {
    v: 1, night: s.night, mode: s.mode, keeper: s.keeper.type, assist: s.assist,
    hp: s.hp, energy: s.energy, waveIdx: s.waveIdx,
    towers: s.towers.map((t) => ({ ped: t.ped, type: t.type, level: t.level, spent: t.spent })),
    keeperPoint: s.keeper.point,
    stats: { minHp: s.stats.minHp, kills: s.stats.kills, maxBurst: s.stats.maxBurst, signalBest: s.stats.signalBest, signals: s.stats.signals, leaks: s.stats.leaks },
  };
}

function restore(s, snap) {
  s.hp = snap.hp; s.energy = snap.energy; s.waveIdx = snap.waveIdx;
  s.towers = []; s.nextTowerId = 1;
  for (const t of snap.towers) placeTower(s, t.ped, t.type, t.level, t.spent);
  const p = s.map.keeperPts[snap.keeperPoint];
  if (p) { s.keeper.x = p.x; s.keeper.y = p.y; s.keeper.point = snap.keeperPoint; }
  Object.assign(s.stats, snap.stats, { recent: [] });
}

export function resume(snap) {
  return createNight(snap.night, { mode: snap.mode, keeper: snap.keeper, assist: snap.assist, restore: snap });
}

// ───────── 進行の記録 ─────────
export function emptyProfile() {
  return {
    v: 1,
    stars: { normal: Array(NIGHTS.length).fill(0), tide: Array(NIGHTS.length).fill(0) },
    assistStars: { normal: Array(NIGHTS.length).fill(0), tide: Array(NIGHTS.length).fill(0) },
    best: {}, losses: {}, seen: [], save: null,
    settings: { sound: true, shake: true },
  };
}

export function unlockedNights(profile, mode = 'normal') {
  const st = profile.stars[mode];
  const as = profile.assistStars[mode];
  let n = 1;
  for (let i = 0; i < NIGHTS.length - 1; i++) if (st[i] > 0 || as[i] > 0) n = Math.max(n, i + 2);
  return Math.min(NIGHTS.length, n);
}
export function tideUnlocked(profile) {
  return profile.stars.normal.every((v, i) => v > 0 || profile.assistStars.normal[i] > 0);
}
export function totalStars(profile, mode = 'normal') { return profile.stars[mode].reduce((a, b) => a + b, 0); }

// 夜の結果を記録に反映（勝ち負けとも）。負けても星や解放は失わない。
export function recordResult(profile, s) {
  const key = `${s.mode}:${s.night}`;
  if (s.result === 'win') {
    const stars = starsFor(s.hp);
    const table = s.assist ? profile.assistStars : profile.stars;
    table[s.mode][s.night] = Math.max(table[s.mode][s.night], stars);
    profile.losses[key] = 0;
    const prev = profile.best[key];
    if (!s.assist && (!prev || s.hp > prev.hp || (s.hp === prev.hp && s.stats.signalBest > prev.signalBest))) {
      profile.best[key] = { hp: s.hp, signalBest: s.stats.signalBest, maxBurst: s.stats.maxBurst, keeper: s.keeper.type };
    }
    return stars;
  }
  if (s.result === 'lose') profile.losses[key] = (profile.losses[key] || 0) + 1;
  return 0;
}

export function shouldOfferAssist(profile, night, mode = 'normal') {
  return (profile.losses[`${mode}:${night}`] || 0) >= 2;
}

export function shareText(s, stars) {
  const n = NIGHTS[s.night];
  const mode = s.mode === 'tide' ? '潮替わり' : '';
  const star = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  const sig = s.stats.signalBest > 0 ? `、合図で${s.stats.signalBest}体` : '';
  const keeper = KEEPERS[s.keeper.type].name;
  const assist = s.assist ? '（補助あり）' : '';
  return `月下の灯台と影の大行進 ${mode}第${s.night + 1}夜『${n.name}』を耐久${s.hp}で守った${sig}。${star} 灯守:${keeper}${assist}`;
}

// 記録した操作を1つ適用する（攻略の再現・共有画像のデモ用）
export function applyAction(s, a) {
  switch (a.a) {
    case 'build': return build(s, a.ped, a.type).ok;
    case 'up': { const t = towerAt(s, a.ped); return !!t && upgrade(s, t.id).ok; }
    case 'move': { const t = towerAt(s, a.from); return !!t && relocate(s, t.id, a.ped).ok; }
    case 'sell': { const t = towerAt(s, a.ped); return !!t && sell(s, t.id).ok; }
    case 'sig': return signal(s, a.x, a.y).ok;
    case 'keep': return moveKeeper(s, a.p).ok;
    case 'wave': return startWave(s);
    default: return false;
  }
}

// 操作の記録を先頭から再生し、夜の終わりまで進める
export function replay(nightIndex, mode, plan, maxFrames = 60 * 60 * 30) {
  const s = createNight(nightIndex, { mode, keeper: plan.keeper, assist: !!plan.assist });
  const acts = plan.actions;
  let i = 0;
  let failed = 0;
  while (!s.result && s.frame < maxFrames) {
    while (i < acts.length && acts[i].f <= s.frame) { if (!applyAction(s, acts[i])) failed += 1; i += 1; }
    if (!s.inWave && !s.result && i >= acts.length) break;
    step(s);
    s.fx.length = 0;
  }
  return { state: s, failed };
}
