// 風の庭と迷子の雲：ルール（DOM を触らない）。
import { GARDENS, WORLDS } from './gardens.js';

export { GARDENS, WORLDS };
export const STAGES = 5; // 1つのワールドの庭の数
export const SIZE = 9;
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 北 東 南 西
export const WIND_NAMES = ['北風', '東風', '南風', '西風'];
export const WIND_ARROWS = ['↗', '↘', '↙', '↖']; // 画面上の向き（北は右上）
export const CLOUD_COUNT = GARDENS.length * 3;
export const LAST = GARDENS.length - 1; // 最後の庭（夜空の花畑）
export const UNLOCK_NEED = 2; // 各庭で2個集めると次の庭が開く
export const FINAL_NEED = CLOUD_COUNT - 1; // 最後の雲は他のすべて

const GROUND = new Set(['#', 'F', 'G', 'S', 'B']); // V（風見鶏）と T（障害物）は歩けない
const FLUFF_OK = new Set(['#', 'F', 'S', 'B']);
const parsed = GARDENS.map((g) => {
  const cells = g.rows.map((r) => r.padEnd(SIZE, '.').split(''));
  let start = [0, 0];
  const vanes = [];
  const beds = [];
  let gate = null;
  cells.forEach((row, y) => row.forEach((c, x) => {
    if (c === 'S') start = [x, y];
    if (c === 'V') vanes.push([x, y]);
    if (c === 'F') beds.push([x, y]);
    if (c === 'G') gate = [x, y];
  }));
  const bridgeAt = new Map(g.bridges.map((b) => [`${b.x},${b.y}`, b.winds]));
  return { cells, start, vanes, beds, gate, bridgeAt };
});
export const gardenInfo = (i) => parsed[i];

export const inRange = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
export const cellAt = (gi, x, y) => (inRange(x, y) ? parsed[gi].cells[y][x] : '.');
export const isGround = (gi, x, y) => GROUND.has(cellAt(gi, x, y));
export const bridgeWinds = (gi, x, y) => parsed[gi].bridgeAt.get(`${x},${y}`) || null;
export const bridgeActive = (gi, x, y, wind) => { const w = bridgeWinds(gi, x, y); return !!w && w.includes(wind); };
/** プレイヤーが立てるか（地面、または今の風で架かっている橋） */
export const walkable = (gi, x, y, wind) => isGround(gi, x, y) || bridgeActive(gi, x, y, wind);

export function newGardenState(gi) {
  const p = parsed[gi];
  return {
    wind: 0, x: p.start[0], y: p.start[1],
    fluff: GARDENS[gi].fluff.map(([x, y]) => [x, y]),
    bloom: p.beds.map(() => false),
    stepped: GARDENS[gi].clouds.map(() => false),
    hist: [], turns: 0,
  };
}

export function newGame() {
  const g = {
    cur: 0,
    gardens: GARDENS.map((_, i) => newGardenState(i)),
    got: Array(CLOUD_COUNT).fill(false),
    revealed: Array(CLOUD_COUNT).fill(false),
    bestGarden: Array(GARDENS.length).fill(null),
    finished: false,
    outfit: { ...DEFAULT_OUTFIT },
  };
  updateReveals(g);
  return g;
}

const clone = (g) => JSON.parse(JSON.stringify(g));
export const cloudId = (gi, k) => gi * 3 + k;
export const gotCount = (game) => game.got.filter(Boolean).length;
export const gardenGot = (game, gi) => [0, 1, 2].filter((k) => game.got[cloudId(gi, k)]).length;
export const totalTurns = (game) => game.gardens.reduce((s, g) => s + g.turns, 0);
export const worldFirst = (wi) => wi * STAGES;
/** 庭が開いているか。ワールドの中では前の庭で2個、ほかのワールドは草原の島の最後の庭まで進むと開く */
export function isUnlocked(game, gi) {
  if (gi < 0 || gi >= GARDENS.length) return false;
  const g = GARDENS[gi];
  if (g.stage > 0) return gardenGot(game, gi - 1) >= UNLOCK_NEED;
  if (g.world === 0) return true;
  return gardenGot(game, worldFirst(0) + STAGES - 2) >= UNLOCK_NEED;
}
export const worldUnlocked = (game, wi) => isUnlocked(game, worldFirst(wi));
export const worldGot = (game, wi) => GARDENS.reduce((n, g, gi) => n + (g.world === wi ? gardenGot(game, gi) : 0), 0);
export const isLastStage = (gi) => GARDENS[gi].stage === STAGES - 1;
export const unlockedCount = (game) => GARDENS.filter((_, i) => isUnlocked(game, i)).length;

/** 雲の出現条件を調べ、新しく現れた雲の id を返す（game を直接更新する） */
function updateReveals(game) {
  const found = [];
  GARDENS.forEach((g, gi) => {
    const gs = game.gardens[gi];
    g.clouds.forEach((c, k) => {
      const id = cloudId(gi, k);
      if (game.revealed[id]) return;
      const r = c.reveal;
      let ok = false;
      if (r.type === 'visible') ok = true;
      else if (r.type === 'bloom') ok = gs.bloom[r.bed];
      else if (r.type === 'step') ok = gs.stepped[k];
      else if (r.type === 'seq') ok = gs.hist.length >= r.seq.length && r.seq.every((w, i) => gs.hist[gs.hist.length - r.seq.length + i] === w);
      else if (r.type === 'final') ok = game.got.filter((v, i) => v && i !== id).length >= FINAL_NEED;
      if (ok) { game.revealed[id] = true; found.push(id); }
    });
  });
  return found;
}

/** 歩く。result: moved / blocked / gate / locked-gate */
export function move(game, dir) {
  const gi = game.cur;
  const gs0 = game.gardens[gi];
  const [dx, dy] = DIRS[dir];
  const nx = gs0.x + dx; const ny = gs0.y + dy;
  if (!inRange(nx, ny) || !walkable(gi, nx, ny, gs0.wind)) return { game, result: 'blocked' };
  const next = clone(game);
  const gs = next.gardens[gi];
  gs.x = nx; gs.y = ny;
  const out = { game: next, result: 'moved', collected: [], revealed: [] };
  GARDENS[gi].clouds.forEach((c, k) => {
    const r = c.reveal;
    if (r.type === 'step' && r.x === nx && r.y === ny && (r.wind === undefined || r.wind === gs.wind)) gs.stepped[k] = true;
  });
  out.revealed.push(...updateReveals(next));
  GARDENS[gi].clouds.forEach((c, k) => {
    const id = cloudId(gi, k);
    if (c.x === nx && c.y === ny && next.revealed[id] && !next.got[id]) {
      next.got[id] = true; out.collected.push(id);
      if (gardenGot(next, gi) === 3 && (next.bestGarden[gi] === null || gs.turns < next.bestGarden[gi])) next.bestGarden[gi] = gs.turns;
    }
  });
  out.revealed.push(...updateReveals(next));
  if (gotCount(next) === CLOUD_COUNT) next.finished = true;
  if (cellAt(gi, nx, ny) === 'G') {
    if (isLastStage(gi)) { if (gardenGot(next, gi) >= UNLOCK_NEED) out.result = 'map'; else out.result = 'locked-gate'; }
    else if (isUnlocked(next, gi + 1)) { out.result = 'gate'; out.to = gi + 1; } else out.result = 'locked-gate';
  }
  return out;
}

export function enterGarden(game, gi) {
  if (!isUnlocked(game, gi)) return game;
  const next = clone(game);
  next.cur = gi;
  return next;
}

/** 風見鶏のそば（上下左右）にいるか */
export function nearVane(game) {
  const gi = game.cur; const { x, y } = game.gardens[gi];
  return DIRS.some(([dx, dy]) => cellAt(gi, x + dx, y + dy) === 'V');
}
/** 橋の上ではなく、地面に立っているか */
export const onSolid = (game) => { const gs = game.gardens[game.cur]; return isGround(game.cur, gs.x, gs.y); };
export const canTurn = (game) => onSolid(game) && nearVane(game);

/** 次の風で橋がどう変わるか */
export function windPreview(game) {
  const gi = game.cur; const wind = game.gardens[gi].wind; const nw = (wind + 1) % 4;
  const appear = []; const vanish = [];
  GARDENS[gi].bridges.forEach((b) => {
    const now = b.winds.includes(wind); const then = b.winds.includes(nw);
    if (!now && then) appear.push([b.x, b.y]);
    if (now && !then) vanish.push([b.x, b.y]);
  });
  return { wind: nw, appear, vanish };
}

/** 綿毛が風下へ1マス。壁・穴・橋・風見鶏・門には入らない */
export function fluffTarget(gi, gs, i, wind) {
  const [x, y] = gs.fluff[i]; const [dx, dy] = DIRS[wind];
  const nx = x + dx; const ny = y + dy;
  if (!inRange(nx, ny) || !FLUFF_OK.has(cellAt(gi, nx, ny))) return [x, y];
  if (gs.fluff.some((f, j) => j !== i && f[0] === nx && f[1] === ny)) return [x, y];
  return [nx, ny];
}

export function turn(game) {
  if (!canTurn(game)) return { game, result: 'cannot' };
  const gi = game.cur;
  const next = clone(game);
  const gs = next.gardens[gi];
  gs.wind = (gs.wind + 1) % 4;
  gs.turns += 1;
  gs.hist.push(gs.wind);
  if (gs.hist.length > 8) gs.hist.shift();
  const moved = [];
  gs.fluff.forEach((f, i) => {
    const t = fluffTarget(gi, gs, i, gs.wind);
    if (t[0] !== f[0] || t[1] !== f[1]) moved.push({ i, from: [f[0], f[1]], to: t });
    gs.fluff[i] = t;
  });
  parsed[gi].beds.forEach(([bx, by], bi) => {
    if (gs.fluff.some((f) => f[0] === bx && f[1] === by)) gs.bloom[bi] = true;
  });
  const revealed = updateReveals(next);
  return { game: next, result: 'turned', moved, revealed };
}

/** この庭を最初の状態に戻す（集めた雲・見つけた雲・風を回した回数は残す） */
export function resetGarden(game) {
  const next = clone(game);
  const fresh = newGardenState(game.cur);
  fresh.turns = next.gardens[game.cur].turns;
  next.gardens[game.cur] = fresh;
  updateReveals(next);
  return next;
}

// ---- 着せ替え（集めた雲の数で増える） ----
export const COATS = [
  { id: 'yellow', name: 'きいろ', need: 0, main: '#ffd21f', shade: '#f2b800', btn: '#b87f00' },
  { id: 'sky', name: 'そらいろ', need: 4, main: '#7cc8ff', shade: '#55aeea', btn: '#2f6fa8' },
  { id: 'sakura', name: 'さくら', need: 10, main: '#ffb3cd', shade: '#f590b4', btn: '#b84a78' },
  { id: 'mint', name: 'ミント', need: 16, main: '#8fe0c0', shade: '#66c9a4', btn: '#2f8a68' },
  { id: 'sand', name: 'すないろ', need: 22, main: '#e8c48a', shade: '#d4a868', btn: '#8a5a2a' },
  { id: 'night', name: 'よぞら', need: 30, main: '#5361c0', shade: '#3f4aa0', btn: '#fff3a8' },
  { id: 'rainbow', name: 'にじいろ', need: 45, main: 'rainbow', shade: '#c8a8ff', btn: '#ffffff' },
];
export const HATS = [
  { id: 'none', name: 'なし', need: 0 },
  { id: 'flower', name: '花かんむり', need: 2 },
  { id: 'straw', name: 'むぎわら', need: 7 },
  { id: 'cat', name: 'ねこみみ', need: 12 },
  { id: 'leaf', name: 'はっぱ', need: 18 },
  { id: 'turban', name: 'ターバン', need: 25 },
  { id: 'glasses', name: 'サングラス', need: 28 },
  { id: 'cloud', name: '雲のぼうし', need: 33 },
  { id: 'crown', name: 'おうかん', need: 38 },
  { id: 'star', name: 'ながれぼし', need: 45 },
];
const WARD = { coat: COATS, hat: HATS };
export const DEFAULT_OUTFIT = { coat: 'yellow', hat: 'none' };
export function outfitUnlocked(game, kind, id) {
  const item = (WARD[kind] || []).find((o) => o.id === id);
  return !!item && gotCount(game) >= item.need;
}
export function setOutfit(game, kind, id) {
  if (!outfitUnlocked(game, kind, id)) return game;
  return { ...game, outfit: { ...(game.outfit || DEFAULT_OUTFIT), [kind]: id } };
}
/** 雲の数が before → after に増えたとき、新しく使えるようになった着せ替え */
export function newOutfits(before, after) {
  return [...COATS.map((o) => ({ ...o, kind: 'coat' })), ...HATS.map((o) => ({ ...o, kind: 'hat' }))].filter((o) => o.need > before && o.need <= after);
}
/** 次に増える着せ替え（なければ null） */
export function nextOutfit(game) {
  const n = gotCount(game);
  const rest = [...COATS.map((o) => ({ ...o, kind: 'coat' })), ...HATS.map((o) => ({ ...o, kind: 'hat' }))].filter((o) => o.need > n).sort((a, b) => a.need - b.need);
  return rest.length ? { ...rest[0], left: rest[0].need - n } : null;
}
export const outfitOf = (game) => {
  const o = game.outfit || DEFAULT_OUTFIT;
  return { coat: COATS.find((c) => c.id === o.coat) || COATS[0], hat: HATS.find((h) => h.id === o.hat) || HATS[0] };
};

// ---- 保存 ----
// 以前の並びの保存を、今の並び（ワールドごと）に移す。並びは庭の id で対応させる
const OLD_ORDERS = [
  ['dew', 'bell', 'mirror', 'mill', 'night'], // 初版（5庭・15個）
  ['dew', 'bell', 'mirror', 'mill', 'forest', 'snow', 'sakura', 'falls', 'candy', 'night'], // 10庭版
];
function migrate(raw) {
  if (!Array.isArray(raw.got) || raw.got.length === CLOUD_COUNT) return raw;
  const order = OLD_ORDERS.find((o) => o.length * 3 === raw.got.length);
  if (!order) return raw;
  const mapG = (oi) => GARDENS.findIndex((g) => g.id === order[oi]);
  const out = { ...raw };
  const remap = (arr) => { const a = Array(CLOUD_COUNT).fill(false); arr.forEach((v, i) => { const gi = mapG(Math.floor(i / 3)); if (gi >= 0) a[gi * 3 + (i % 3)] = v; }); return a; };
  out.got = remap(raw.got);
  if (Array.isArray(raw.revealed) && raw.revealed.length === raw.got.length) out.revealed = remap(raw.revealed);
  if (Array.isArray(raw.gardens) && raw.gardens.length === order.length) { const g = Array(GARDENS.length).fill(null); raw.gardens.forEach((v, i) => { g[mapG(i)] = v; }); out.gardens = g; }
  if (Array.isArray(raw.bestGarden) && raw.bestGarden.length === order.length) { const b = Array(GARDENS.length).fill(null); raw.bestGarden.forEach((v, i) => { b[mapG(i)] = v; }); out.bestGarden = b; }
  if (Number.isInteger(raw.cur) && order[raw.cur]) out.cur = mapG(raw.cur);
  return out;
}
const isNum = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
export function sanitize(raw) {
  try {
    const base = newGame();
    if (!raw || typeof raw !== 'object') return base;
    raw = migrate(raw);
    if (Array.isArray(raw.got) && raw.got.length === CLOUD_COUNT) base.got = raw.got.map(Boolean);
    if (Array.isArray(raw.revealed) && raw.revealed.length === CLOUD_COUNT) base.revealed = raw.revealed.map(Boolean);
    base.got.forEach((v, i) => { if (v) base.revealed[i] = true; });
    if (Array.isArray(raw.bestGarden)) base.bestGarden = GARDENS.map((_, i) => (isNum(raw.bestGarden[i], 0, 99999) ? raw.bestGarden[i] : null));
    if (Array.isArray(raw.gardens) && raw.gardens.length === GARDENS.length) {
      raw.gardens.forEach((s, gi) => {
        if (!s || typeof s !== 'object') return;
        const d = newGardenState(gi);
        if (isNum(s.wind, 0, 3)) d.wind = s.wind;
        if (isNum(s.x, 0, 8) && isNum(s.y, 0, 8) && isGround(gi, s.x, s.y)) { d.x = s.x; d.y = s.y; }
        if (Array.isArray(s.fluff) && s.fluff.length === d.fluff.length
          && s.fluff.every((f) => Array.isArray(f) && isNum(f[0], 0, 8) && isNum(f[1], 0, 8) && FLUFF_OK.has(cellAt(gi, f[0], f[1])))) d.fluff = s.fluff.map((f) => [f[0], f[1]]);
        if (Array.isArray(s.bloom) && s.bloom.length === d.bloom.length) d.bloom = s.bloom.map(Boolean);
        if (Array.isArray(s.stepped) && s.stepped.length === d.stepped.length) d.stepped = s.stepped.map(Boolean);
        if (Array.isArray(s.hist)) d.hist = s.hist.filter((w) => isNum(w, 0, 3)).slice(-8);
        d.turns = isNum(s.turns, 0, 99999) ? s.turns : 0;
        base.gardens[gi] = d;
      });
    }
    if (isNum(raw.cur, 0, GARDENS.length - 1)) base.cur = raw.cur;
    while (base.cur > 0 && !isUnlocked(base, base.cur)) base.cur -= 1;
    base.finished = gotCount(base) === CLOUD_COUNT;
    if (raw.outfit && typeof raw.outfit === 'object') {
      for (const kind of ['coat', 'hat']) if (outfitUnlocked(base, kind, raw.outfit[kind])) base.outfit[kind] = raw.outfit[kind];
    }
    updateReveals(base);
    return base;
  } catch { return newGame(); }
}

// ---- 状態探索（テスト・マップ検証用） ----
/** 1つの庭を初期状態から全探索する。他の庭の雲は集め済みとして扱う（最後の雲の条件のため） */
export function exploreGarden(gi, { limit = 600000 } = {}) {
  const game = newGame();
  game.cur = gi;
  game.got = game.got.map((_, i) => Math.floor(i / 3) !== gi);
  game.revealed = game.got.slice();
  updateReveals(game);
  const key = (g) => {
    const s = g.gardens[gi];
    return [s.x, s.y, s.wind, s.fluff.join(';'), s.bloom.map(Number).join(''), s.stepped.map(Number).join(''), s.hist.slice(-3).join(''),
      [0, 1, 2].map((k) => +g.got[cloudId(gi, k)]).join(''), [0, 1, 2].map((k) => +g.revealed[cloudId(gi, k)]).join('')].join('|');
  };
  const seen = new Map([[key(game), game]]);
  const queue = [game];
  const got = new Set();
  const first = {};
  let qi = 0;
  while (qi < queue.length && seen.size < limit) {
    const g = queue[qi++];
    const nexts = [];
    for (let d = 0; d < 4; d++) {
      const r = move(g, d);
      if (r.result === 'moved' || r.result === 'gate' || r.result === 'locked-gate') nexts.push(r.game);
    }
    const t = turn(g);
    if (t.result === 'turned') nexts.push(t.game);
    for (const n of nexts) {
      const k = key(n);
      if (seen.has(k)) continue;
      seen.set(k, n); queue.push(n);
      [0, 1, 2].forEach((c) => {
        if (n.got[cloudId(gi, c)]) { got.add(c); const t2 = n.gardens[gi].turns; if (first[c] === undefined || t2 < first[c]) first[c] = t2; }
      });
    }
  }
  let allTurns = null; let gate = false;
  for (const g of seen.values()) {
    const s = g.gardens[gi];
    if (gardenGot(g, gi) === 3 && (allTurns === null || s.turns < allTurns)) allTurns = s.turns;
    if (cellAt(gi, s.x, s.y) === 'G') gate = true;
  }
  return { states: seen.size, complete: seen.size < limit, got: [...got].sort(), firstTurns: first, allTurns, gate, seen };
}

/** 風見鶏の隣に立てない島（風見鶏のない島）の一覧。詰み防止のため空であること */
export function islandsWithoutVane(gi) {
  const seen = new Set(); const bad = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (!isGround(gi, x, y) || seen.has(`${x},${y}`)) continue;
    const stack = [[x, y]]; seen.add(`${x},${y}`); const cells = [];
    while (stack.length) {
      const [cx, cy] = stack.pop(); cells.push([cx, cy]);
      DIRS.forEach(([dx, dy]) => {
        const nx = cx + dx; const ny = cy + dy;
        if (isGround(gi, nx, ny) && !seen.has(`${nx},${ny}`)) { seen.add(`${nx},${ny}`); stack.push([nx, ny]); }
      });
    }
    if (!cells.some(([cx, cy]) => DIRS.some(([dx, dy]) => cellAt(gi, cx + dx, cy + dy) === 'V'))) bad.push(cells[0]);
  }
  return bad;
}
