// ひなたの巨獣と小さな引越し屋 — ルール（DOM を触らない）
// 盤面はマス目。主人公コロ（ヤドカリ）は上下左右に1マスずつ歩き、
// 動物を背中に乗せて（重さの合計3まで）、それぞれの新居へ届ける。
import { LEVELS as RAW_LEVELS } from './levels.js';

export const CAPACITY = 3;
export const HEAVY = 2; // 荷重がこれ以上なら「重い」：沈み橋は低い岸、跳ね葉は近い低台へ
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 0:上 1:右 2:下 3:左
export const SCHEMA = 2;

export const KINDS = {
  bird: { name: '小鳥', weight: 1 },
  hedgehog: { name: 'ハリネズミ', weight: 1 },
  mole: { name: 'モグラ', weight: 1 },
  squirrel: { name: 'リス', weight: 1 },
  rabbit: { name: 'ウサギ', weight: 2 },
  capybara: { name: 'カピバラ', weight: 2 },
  raccoon: { name: 'アライグマ', weight: 2 },
  koala: { name: 'コアラ', weight: 2 },
  piglet: { name: '子ブタ', weight: 3 },
  tapir: { name: 'バク', weight: 3 },
  wombat: { name: 'ウォンバット', weight: 3 },
  hippo: { name: '子カバ', weight: 3 },
};
export const KIND_IDS = Object.keys(KINDS);

export const REGIONS = [
  { id: 'turtle', name: '草原の亀', beast: '巨亀' },
  { id: 'lizard', name: '砂丘のトカゲ', beast: '巨トカゲ' },
  { id: 'elephant', name: '花畑の象', beast: '巨象' },
];

// 甲羅模様：種を集めた数で増える（性能には影響しない）
export const PATTERNS = [
  { at: 0, name: 'さんご' }, { at: 4, name: 'しましま' }, { at: 8, name: 'みずたま' },
  { at: 12, name: 'うずまき' }, { at: 16, name: 'ひまわり' }, { at: 20, name: 'こうし' },
  { at: 24, name: 'ほし' }, { at: 28, name: 'なみ' }, { at: 32, name: 'はーと' },
  { at: 36, name: 'もよう葉' }, { at: 42, name: 'にじ' }, { at: 48, name: 'はなかんむり' },
];
// 全54個そろえると「花吹雪」（甲羅模様とは別のごほうび）
export const PATTERN_THRESHOLDS = PATTERNS.map((p) => p.at);

// ---------- 面データの読み込み ----------
// map の1文字：'#' 何もない（空・背中の外）, '.' 床, '*' 種のある床, '@' 開始位置, 'o' 岩,
// '=' 階段（その高さと1つ上をつなぐ）, それ以外の文字は legend で定義。
// heights は同じ大きさの数字の並び（'#' のマスは何でもよい）。
export function parseLevel(raw, index = 0) {
  const h = raw.map.length; const w = raw.map[0].length;
  const cells = []; const legendPos = {};
  let start = -1; const rocks = []; const seeds = [];
  const lockIds = [];
  const lockIndex = (k) => { let i = lockIds.indexOf(k); if (i < 0) { lockIds.push(k); i = lockIds.length - 1; } return i; };
  for (let y = 0; y < h; y++) {
    if (raw.map[y].length !== w) throw new Error(`${raw.name}: ${y}行目の幅が違う`);
    for (let x = 0; x < w; x++) {
      const ch = raw.map[y][x];
      const hv = Number(raw.heights?.[y]?.[x] ?? 0) || 0;
      const i = y * w + x;
      const c = { i, x, y, h: hv, t: 'floor' };
      if (ch === '#') c.t = 'void';
      else if (ch === '.') c.t = 'floor';
      else if (ch === '*') { c.t = 'floor'; seeds.push(i); }
      else if (ch === '@') { c.t = 'floor'; start = i; }
      else if (ch === 'o') { c.t = 'floor'; rocks.push(i); }
      else if (ch === '=') c.t = 'stair';
      else {
        const d = raw.legend?.[ch];
        if (!d) throw new Error(`${raw.name}: 文字 '${ch}' の定義がない`);
        if (legendPos[ch] !== undefined && !['stair', 'gate'].includes(d.t)) throw new Error(`${raw.name}: '${ch}' が2か所にある`);
        legendPos[ch] = i;
        c.t = d.t;
        if (d.t === 'stair' || d.t === 'gate') { c.lock = lockIndex(d.lock); c.style = d.style || (d.t === 'stair' ? 'rope' : 'hedge'); }
        if (d.t === 'wheel') c.opens = lockIndex(d.opens);
        if (d.t === 'pad') { c.style = d.style; c.light = d.light; c.heavy = d.heavy; c.look = d.look; }
        if (d.t === 'station') c.look = d.look;
        if (d.t === 'home') c.look = d.look;
        if (d.seed) seeds.push(i);
      }
      cells.push(c);
    }
  }
  if (start < 0) throw new Error(`${raw.name}: 開始位置がない`);
  const at = (p) => (Array.isArray(p) ? p[1] * w + p[0] : legendPos[p]);
  for (const c of cells) {
    if (c.t === 'pad') {
      c.light = at(c.light); c.heavy = at(c.heavy);
      if (c.light === undefined || c.heavy === undefined) throw new Error(`${raw.name}: 葉/橋の行き先がない`);
    }
  }
  const animals = raw.animals.map((a, k) => {
    const kind = KINDS[a.kind];
    if (!kind) throw new Error(`${raw.name}: 動物 ${a.kind} がない`);
    const st = at(a.at); const home = at(a.home);
    if (st === undefined || cells[st].t !== 'station') throw new Error(`${raw.name}: ${a.kind} の待ち場所が停留台でない`);
    if (home === undefined || cells[home].t !== 'home') throw new Error(`${raw.name}: ${a.kind} の新居がない`);
    cells[home].owner = k;
    return { k, kind: a.kind, name: a.name || kind.name, weight: kind.weight, start: st, home, opens: (a.opens || []).map(lockIndex) };
  });
  const exit = cells.findIndex((c) => c.t === 'exit');
  if (exit < 0) throw new Error(`${raw.name}: 出口がない`);
  return {
    index, id: raw.id ?? index + 1, name: raw.name, region: raw.region ?? Math.floor(index / 6),
    w, h, cells, start, rocks: rocks.sort((a, b) => a - b), seeds, animals, exit, lockCount: lockIds.length, lockNames: lockIds,
    guide: raw.guide || '', hint: raw.hint || [], par: raw.par || 0, building: raw.building || '',
  };
}

export const LEVELS = RAW_LEVELS.map((r, i) => parseLevel(r, i));
export const TOTAL_SEEDS = LEVELS.reduce((s, l) => s + l.seeds.length, 0);

// ---------- 状態 ----------
// aloc[k]: 動物kの居場所。0以上=そのマス（停留台か新居）、-1=コロの背中。
export function createState(level) {
  return {
    pos: level.start, face: 2,
    riders: [], aloc: level.animals.map((a) => a.start),
    rocks: level.rocks.slice(), open: 0, seeds: 0, moves: 0, cleared: false,
  };
}
export const cloneState = (s) => ({ ...s, riders: s.riders.slice(), aloc: s.aloc.slice(), rocks: s.rocks.slice() });
export const loadOf = (level, s) => s.riders.reduce((n, k) => n + level.animals[k].weight, 0);
export const isHeavy = (load) => load >= HEAVY;
export const isOpen = (s, lock) => (s.open & (1 << lock)) !== 0;
export const delivered = (level, s, k) => s.aloc[k] === level.animals[k].home;
export const deliveredCount = (level, s) => level.animals.reduce((n, a) => n + (delivered(level, s, a.k) ? 1 : 0), 0);
export const allDelivered = (level, s) => deliveredCount(level, s) === level.animals.length;
export const seedCount = (s) => { let n = 0; let v = s.seeds; while (v) { n += v & 1; v >>>= 1; } return n; };
export const hasSeed = (level, s, cell) => { const j = level.seeds.indexOf(cell); return j >= 0 && (s.seeds & (1 << j)) !== 0; };

export function heightsOf(c) {
  if (c.t === 'stair') return [c.h, c.h + 1];
  return [c.h];
}
const meets = (a, b) => { const A = heightsOf(a); const B = heightsOf(b); return A.some((v) => B.includes(v)); };
const touches = (from, c) => heightsOf(from).includes(c.h);

export function neighbor(level, i, dir) {
  const x = (i % level.w) + DIRS[dir][0]; const y = Math.floor(i / level.w) + DIRS[dir][1];
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return -1;
  return y * level.w + x;
}
export const animalAt = (s, cell) => s.aloc.indexOf(cell);
export const padTarget = (level, cell, load) => (isHeavy(load) ? cell.heavy : cell.light);

function landOn(level, s, cell) {
  s.pos = cell;
  const j = level.seeds.indexOf(cell);
  if (j >= 0 && !(s.seeds & (1 << j))) { s.seeds |= 1 << j; return true; }
  return false;
}

// 1手を試す。戻り値 { ok, state, ev, reason, need }。ok=false のとき手数は進まない。
// pick: 停留台へ降ろすとき、どの乗客を降ろすか（riders 内の動物番号）。
export function act(level, s0, dir, pick) {
  if (s0.cleared) return { ok: false, reason: 'もうクリアしている' };
  const t = neighbor(level, s0.pos, dir);
  const fail = (reason, extra) => ({ ok: false, reason, face: dir, ...extra });
  if (t < 0) return fail('その先には何もない');
  const c = level.cells[t]; const here = level.cells[s0.pos];
  const s = cloneState(s0); s.face = dir;
  const load = loadOf(level, s0);
  const ev = { type: 'move', from: s0.pos, dir };
  if (c.t === 'void') return fail('その先は空だ');

  if (c.t === 'station') {
    if (!touches(here, c)) return fail('高さが違って届かない');
    const k = animalAt(s0, t);
    if (k >= 0) {
      const a = level.animals[k];
      if (load + a.weight > CAPACITY) return fail(`満員：${a.name}は重さ${a.weight}、あと${CAPACITY - load}しか乗れない`, { why: 'full' });
      s.aloc[k] = -1; s.riders.push(k); s.moves++;
      return { ok: true, state: s, ev: { type: 'board', k, cell: t, dir } };
    }
    if (!s0.riders.length) return fail('空の停留台。乗客を降ろす場所だ', { why: 'empty' });
    let k2 = pick;
    if (k2 === undefined) {
      if (s0.riders.length > 1) return { ok: false, need: 'pick', cell: t, dir, choices: s0.riders.slice() };
      k2 = s0.riders[0];
    }
    if (!s0.riders.includes(k2)) return fail('その動物は乗っていない');
    s.riders = s.riders.filter((r) => r !== k2); s.aloc[k2] = t; s.moves++;
    return { ok: true, state: s, ev: { type: 'drop', k: k2, cell: t, dir } };
  }

  if (c.t === 'home') {
    if (!touches(here, c)) return fail('高さが違って届かない');
    const k = c.owner; const a = level.animals[k];
    if (delivered(level, s0, k)) return fail(`${a.name}はもう引越しを終えた`, { why: 'done' });
    if (!s0.riders.includes(k)) {
      return fail(s0.riders.length ? `ここは${a.name}の新居。乗っている子の家ではない` : `ここは${a.name}の新居`, { why: 'other' });
    }
    s.riders = s.riders.filter((r) => r !== k); s.aloc[k] = t; s.moves++;
    const unlocked = [];
    for (const l of a.opens) if (!isOpen(s, l)) { s.open |= 1 << l; unlocked.push(l); }
    return { ok: true, state: s, ev: { type: 'deliver', k, cell: t, dir, unlocked, all: allDelivered(level, s) } };
  }

  if (c.t === 'pad') {
    if (!touches(here, c)) return fail('高さが違って乗れない');
    const dest = padTarget(level, c, load);
    if (s0.rocks.includes(dest)) return fail('着地点が岩で塞がっている', { why: 'blocked' });
    s.moves++;
    const seed = landOn(level, s, dest);
    return { ok: true, state: s, ev: { type: 'pad', style: c.style, pad: t, from: s0.pos, to: dest, heavy: isHeavy(load), seed, dir } };
  }

  if (s0.rocks.includes(t)) {
    if (!meets(here, c)) return fail('高さが違う');
    const b = neighbor(level, t, dir);
    const bc = b >= 0 ? level.cells[b] : null;
    if (!bc || bc.t !== 'floor' || bc.h !== c.h || s0.rocks.includes(b) || b === level.exit) return fail('岩の向こうが空いていないので押せない', { why: 'rock' });
    s.rocks = s.rocks.map((r) => (r === t ? b : r)).sort((p, q) => p - q);
    s.moves++;
    const seed = landOn(level, s, t);
    return { ok: true, state: s, ev: { type: 'push', from: t, to: b, dir, seed } };
  }

  if ((c.t === 'stair' || c.t === 'gate') && c.lock !== undefined && !isOpen(s0, c.lock)) {
    return fail(c.t === 'stair' ? 'まだ閉じている' : '花の垣根が閉じている', { why: 'locked', lock: c.lock });
  }
  if (c.t === 'exit' && !allDelivered(level, s0)) return fail('全員を新居へ届けると出口が開く', { why: 'exit' });
  if (!meets(here, c)) return fail(c.h > here.h ? '段差が高くて登れない' : '段差が高くて降りられない', { why: 'height' });

  s.moves++;
  const seed = landOn(level, s, t);
  ev.to = t; ev.seed = seed;
  if (c.t === 'wheel' && load === CAPACITY && !isOpen(s, c.opens)) {
    s.open |= 1 << c.opens; ev.wheel = c.opens;
  } else if (c.t === 'wheel') ev.wheelFail = true;
  if (c.t === 'exit') { s.cleared = true; ev.clear = true; }
  return { ok: true, state: s, ev };
}

// 解答探索に使う全手。
export function moves(level, s) {
  const out = [];
  for (let d = 0; d < 4; d++) {
    const r = act(level, s, d);
    if (r.ok) out.push({ d, r });
    else if (r.need === 'pick') {
      for (const k of r.choices) { const r2 = act(level, s, d, k); if (r2.ok) out.push({ d, k, r: r2 }); }
    }
  }
  return out;
}
export const keyOf = (s) => `${s.pos}|${s.riders.join(',')}|${s.aloc.join(',')}|${s.rocks.join(',')}|${s.open}|${s.seeds}|${s.cleared ? 1 : 0}`;

// 幅優先探索。goal(s) を満たす最短手順を返す（見つからなければ null）。
// order を渡すと、その順番でしか配達できない制約で探す。
export function solve(level, { allSeeds = false, order = null, limit = 4_000_000, from = null } = {}) {
  const s0 = from || createState(level);
  const full = (1 << level.seeds.length) - 1;
  const goal = (s) => s.cleared && (!allSeeds || s.seeds === full);
  const seen = new Map(); seen.set(keyOf(s0), null);
  let frontier = [s0]; let count = 0;
  const parents = new Map();
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      if (goal(s)) {
        const path = []; let k = keyOf(s);
        while (parents.has(k)) { const p = parents.get(k); path.unshift(p.m); k = p.key; }
        return { path, moves: s.moves, explored: count };
      }
      for (const m of moves(level, s)) {
        const ns = m.r.state;
        if (m.r.ev.type === 'deliver' && order) {
          const n = deliveredCount(level, s);
          if (order[n] !== m.r.ev.k) continue;
        }
        if (!allSeeds && m.r.ev.seed) { /* 種は経路に関係ないが状態に含める */ }
        const key = keyOf(ns);
        if (seen.has(key)) continue;
        seen.set(key, 1); parents.set(key, { key: keyOf(s), m: { d: m.d, k: m.k } });
        next.push(ns);
        if (++count > limit) return { path: null, explored: count, truncated: true };
      }
    }
    frontier = next;
  }
  return { path: null, explored: count };
}

// 手順の再生（実装と同じ遷移で確かめる）
export function replay(level, path, s = createState(level)) {
  for (const m of path) {
    const r = act(level, s, m.d, m.k);
    if (!r.ok) return { ok: false, state: s, reason: r.reason };
    s = r.state;
  }
  return { ok: true, state: s };
}

function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  return arr.flatMap((v, i) => permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [v, ...p]));
}
// 成功する配達順をすべて調べる
export function deliveryOrders(level) {
  return permutations(level.animals.map((a) => a.k)).filter((o) => solve(level, { order: o }).path);
}

// ---------- 記録・図鑑・模様 ----------
export function emptyProgress() {
  return { v: SCHEMA, levels: {}, dex: {}, pattern: 0, seen: {} };
}
// 出口に入ったときだけ記録を確定する。
export function recordClear(progress, level, s) {
  const p = structuredCloneSafe(progress);
  const rec = p.levels[level.id] || { cleared: false, seeds: 0, best: 0, allSeeds: false, bestAll: 0 };
  rec.cleared = true;
  rec.seeds |= s.seeds;
  const full = (1 << level.seeds.length) - 1;
  if (!rec.best || s.moves < rec.best) rec.best = s.moves;
  if (s.seeds === full) { rec.allSeeds = true; if (!rec.bestAll || s.moves < rec.bestAll) rec.bestAll = s.moves; }
  p.levels[level.id] = rec;
  for (const a of level.animals) {
    const d = p.dex[a.kind] || { regions: [] };
    if (!d.regions.includes(level.region)) d.regions.push(level.region);
    p.dex[a.kind] = d;
  }
  return p;
}
function structuredCloneSafe(o) { return JSON.parse(JSON.stringify(o)); }
export function totalSeeds(progress) {
  let n = 0;
  for (const l of LEVELS) { const r = progress.levels[l.id]; if (r) { let v = r.seeds; while (v) { n += v & 1; v >>>= 1; } } }
  return n;
}
export const patternsUnlocked = (n) => PATTERNS.filter((p) => n >= p.at).length;
export const clearedCount = (progress) => LEVELS.filter((l) => progress.levels[l.id]?.cleared).length;
export function levelUnlocked(progress, i) {
  if (i === 0) return true;
  // 地域の最初の面は前の地域の最終面をクリアすると開く。地域の中は前の面のクリアで開く。成績では止めない。
  return !!progress.levels[LEVELS[i - 1].id]?.cleared;
}
export function shareText(level, s, patternName) {
  return `ひなたの巨獣と小さな引越し屋 第${level.id}面『${level.name}』\n全員配達／種${seedCount(s)}/${level.seeds.length}／${s.moves}手／コロの甲羅：${patternName}`;
}

// 次に開けられる設備の条件（ヒント）
export function hints(level, s) {
  const out = [];
  for (const a of level.animals) {
    if (delivered(level, s, a.k)) continue;
    for (const l of a.opens) if (!isOpen(s, l)) out.push(`${a.name}を新居へ届けると、${lockLabel(level, l)}が開く`);
  }
  for (const c of level.cells) {
    if (c.t === 'wheel' && !isOpen(s, c.opens)) out.push(`水車の踏板は荷重3ちょうどで踏むと${lockLabel(level, c.opens)}が開く`);
  }
  return out;
}
export function lockLabel(level, l) {
  const c = level.cells.find((x) => x.lock === l);
  if (!c) return '道';
  if (c.t === 'gate') return '花の垣根';
  return c.style === 'stair' ? '帰り階段' : 'ロープ';
}

// 保存データの検証（壊れていたら null）
export function validSaved(level, saved) {
  if (!saved || saved.v !== SCHEMA || saved.level !== level.id) return null;
  const s = saved.state;
  if (!s || typeof s.pos !== 'number' || !Array.isArray(s.aloc) || s.aloc.length !== level.animals.length) return null;
  if (s.pos < 0 || s.pos >= level.cells.length) return null;
  return saved;
}
