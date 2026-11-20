// 雲海温泉と渡り鳥の宿 — ルール（DOM を触らない）。
// 1秒＝1tick。温度・静けさ・眺望・鳥の行動・採点はすべてここで決める。
// 状態は JSON で丸ごと複製できる（自動プレイ・保存・予告のため）。

// ---- 調整できる値（ここにまとめる） ----
export const TUNE = {
  bathTicks: 12, // 入浴の長さ（秒）
  waitLimit: 20, // 待てる長さ（秒）
  waitPenalty: 0.5, // 待ち1秒あたりの減点
  waitPenaltyMax: 10,
  passLine: 70, // 満足とみなす点
  clearRate: 0.6, // 日クリアに必要な満足客の割合
  dayLimit: 120, // 営業の最大秒数
  windShiftAt: 60, // 風が変わる時刻
  windWarn: 10, // 風の予告（秒前）
  fee: 8, tip: 4,
  qMax: 4,
  refuseTempScore: 0, // 温度評価がこれ以下の湯には入らない（熱すぎ／冷たすぎ）
  supportMoney: 40,
};

export const SEASONS = {
  spring: { name: '春', base: 25 }, summer: { name: '夏', base: 30 },
  autumn: { name: '秋', base: 20 }, winter: { name: '冬', base: 15 },
};

// 方角。x は東へ、y は南へ増える。
export const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
export const DIR_NAMES = { N: '北', E: '東', S: '南', W: '西' };
export const DIR_LIST = ['N', 'E', 'S', 'W'];

// 客の種類（全12種。試作で使うのは一部）。range=好きな温度、w=[温度, 静けさ, 景色] の比重（合計100）
export const SPECIES = {
  swan: { name: '白鳥', range: [40, 50], w: [60, 25, 15], day: 1 },
  kingfisher: { name: 'カワセミ', range: [25, 35], w: [25, 15, 60], day: 1 },
  swallow: { name: 'ツバメ', range: [30, 40], w: [40, 30, 30], noisy: true, day: 2 },
  heron: { name: 'サギ', range: [35, 45], w: [25, 60, 15], day: 8 },
  duck: { name: 'アヒル', range: [30, 40], w: [60, 25, 15], day: 9 },
  parakeet: { name: 'インコ', range: [30, 40], w: [40, 30, 30], noisy: true, day: 10 },
  owl: { name: 'フクロウ', range: [35, 45], w: [25, 60, 15], day: 15 },
  crane: { name: 'ツル', range: [40, 50], w: [25, 15, 60], day: 16 },
  whiteeye: { name: 'メジロ', range: [30, 40], w: [40, 30, 30], day: 17 },
  penguin: { name: 'ペンギン', range: [20, 30], w: [60, 25, 15], day: 22 },
  tit: { name: 'ヤマガラ', range: [35, 45], w: [25, 60, 15], day: 23 },
  rainbow: { name: '虹羽鳥', range: [35, 45], w: [40, 30, 30], day: 28 },
};

// 設備。heat=温度補正、seats=席数、bath=浴槽か
export const FACILITIES = {
  source: { name: '源泉', cost: 0, fixed: true },
  bath: { name: '普通の湯', cost: 20, bath: true, seats: 2, heat: 0 },
  hot: { name: '保温の湯', cost: 30, bath: true, seats: 2, heat: 5 },
  shallow: { name: '浅湯', cost: 20, bath: true, seats: 1, heat: -5 },
  view: { name: '展望湯', cost: 30, bath: true, seats: 1, heat: 0, seeThrough: true },
  windbreak: { name: '風よけ', cost: 8 },
  fence: { name: '吸音垣', cost: 10 },
};
export const PIPE_COST = 2;

// ---- 日（試作は2日） ----
// layout: [type, x, y, extra]。pipes: [x,y]。guests: [species, 到着秒]
export const DAYS = [
  {
    id: 1, name: '二つの湯', season: 'spring', size: [4, 4], cap: 6,
    wind: ['N', 'E'], strong: false, money: 60,
    intro: '鳥の好みに合わせて、お湯を分けよう',
    build: ['bath', 'windbreak'],
    layout: [['source', 3, 0], ['bath', 1, 2, { q: 1, name: '左の湯' }], ['bath', 3, 2, { q: 1, name: '右の湯' }]],
    pipes: [[3, 1], [2, 1], [1, 1]],
    guests: [['swan', 0], ['kingfisher', 8], ['swan', 16], ['kingfisher', 24], ['swan', 32], ['swan', 40]],
  },
  {
    id: 26, name: '白鳥と氷の客', season: 'winter', size: [6, 6], cap: 8,
    wind: ['N', 'E'], strong: true, money: 60,
    intro: '冬の強風。熱い湯・冷たい湯・景色を、限られたお湯で両立しよう',
    build: ['bath', 'hot', 'shallow', 'view', 'windbreak', 'fence'],
    layout: [
      ['source', 2, 2],
      ['hot', 2, 3, { q: 4, name: '保温の湯' }],
      ['shallow', 4, 1, { q: 2, name: '浅湯' }],
      ['view', 3, 3, { q: 0, name: '展望湯' }],
      ['windbreak', 2, 4, { dir: 'S' }],
      ['windbreak', 4, 0, { dir: 'N' }],
      ['fence', 0, 3],
    ],
    pipes: [[2, 3], [3, 2], [4, 2], [3, 3]],
    guests: [
      ['swan', 0], ['penguin', 6], ['crane', 14], ['swallow', 20], ['penguin', 26], ['owl', 32],
      ['swan', 40], ['crane', 48], ['swallow', 54], ['penguin', 62], ['owl', 70], ['swan', 80],
    ],
  },
];

export const dayIndex = (id) => DAYS.findIndex((d) => d.id === id);

// ---- 状態 ----
export function createState(dayId, opts = {}) {
  const d = DAYS[dayIndex(dayId)];
  if (!d) throw new Error(`no day ${dayId}`);
  const [W, H] = d.size;
  let nid = 1;
  const items = d.layout.map(([type, x, y, extra = {}]) => ({ id: nid++, type, x, y, q: 0, dir: 'N', ...extra }));
  const pipes = Array.from({ length: H }, () => Array(W).fill(false));
  for (const [x, y] of d.pipes) pipes[y][x] = true;
  const guests = d.guests.map(([sp, at], i) => ({
    id: i + 1, sp, at, st: 'pending', x: 0, y: 0, path: [], target: 0,
    waited: 0, bathT: 0, acc: [0, 0, 0], sat: null, why: '', chair: false,
  }));
  const s = {
    day: d.id, W, H, base: SEASONS[d.season].base, cap: d.cap, strong: d.strong,
    wind0: d.wind[0], wind1: d.wind[1], t: 0, phase: 'prep',
    items, pipes, guests, nid,
    money: Math.max(opts.money ?? d.money, TUNE.supportMoney), earned: 0,
  };
  syncSupply(s);
  return s;
}

export const cloneState = (s) => JSON.parse(JSON.stringify(s));

export const windAt = (s, t = s.t) => (t >= TUNE.windShiftAt ? s.wind1 : s.wind0);
export const isBath = (it) => !!FACILITIES[it.type]?.bath;
export const baths = (s) => s.items.filter(isBath);
export const itemAt = (s, x, y) => s.items.find((it) => it.x === x && it.y === y);
export const inside = (s, x, y) => x >= 0 && y >= 0 && x < s.W && y < s.H;
export const isEntrance = (x, y) => x === 0 && y === 0;
export const seatsOf = (it) => FACILITIES[it.type]?.seats ?? 0;
export const heatUsed = (s) => baths(s).reduce((a, b) => a + b.q, 0);

// 源泉と管がつながっている範囲（上下左右）。浴槽はその範囲の上か隣にあれば給湯される。
export function network(s) {
  const src = s.items.find((it) => it.type === 'source');
  const seen = new Set();
  if (!src) return seen;
  const st = [[src.x, src.y]];
  seen.add(`${src.x},${src.y}`);
  while (st.length) {
    const [x, y] = st.pop();
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = x + dx; const ny = y + dy; const k = `${nx},${ny}`;
      if (inside(s, nx, ny) && s.pipes[ny][nx] && !seen.has(k)) { seen.add(k); st.push([nx, ny]); }
    }
  }
  return seen;
}

export function suppliedSet(s) {
  const net = network(s);
  const out = new Set();
  for (const b of baths(s)) {
    if (net.has(`${b.x},${b.y}`) || Object.values(DIRS).some(([dx, dy]) => net.has(`${b.x + dx},${b.y + dy}`))) out.add(b.id);
  }
  return out;
}

// 管が切れた浴槽は弁を閉じる（合計の数字と見た目を一致させる）
function syncSupply(s) {
  const sup = suppliedSet(s);
  for (const b of baths(s)) if (!sup.has(b.id)) b.q = 0;
  return sup;
}

const bathers = (s, b) => s.guests.filter((g) => g.st === 'bath' && g.target === b.id);
const reservedCount = (s, b) => s.guests.filter((g) => (g.st === 'walk' || g.st === 'bath') && g.target === b.id).length;

// 各浴槽の温度・風・眺望・騒音をまとめて出す（予告と実際で同じ関数を使う）
export function metrics(s, t = s.t) {
  const wind = windAt(s, t);
  const [wx, wy] = DIRS[wind];
  const sup = suppliedSet(s);
  const out = {};
  const bs = baths(s);
  for (const b of bs) {
    const F = FACILITIES[b.type];
    // 強風：風上の隣に、風へ向けた風よけがなければ −5
    let exposed = false;
    if (s.strong) {
      const wb = itemAt(s, b.x + wx, b.y + wy);
      exposed = !(wb && wb.type === 'windbreak' && wb.dir === wind);
    }
    const on = sup.has(b.id) && b.q > 0;
    const T = s.base + 5 * b.q + F.heat - (exposed ? 5 : 0);
    // 眺望：四方のどれかに、島の外まで建物のない直線
    const rays = {};
    let view = 0;
    for (const [dn, [dx, dy]] of Object.entries(DIRS)) {
      let x = b.x + dx; let y = b.y + dy; let clear = true; let blocker = null;
      while (inside(s, x, y)) {
        const it = itemAt(s, x, y);
        if (it && !(F.seeThrough && it.type === 'windbreak')) { clear = false; blocker = it; break; }
        x += dx; y += dy;
      }
      rays[dn] = clear ? null : blocker.id;
      if (clear) view = 1;
    }
    out[b.id] = { id: b.id, T, on, exposed, view, rays, steamBy: null, noise: 0, noiseBy: [], fenced: false, supplied: sup.has(b.id) };
  }
  // 湯気：q>=3 の浴槽の風下1マスの浴槽は眺望0
  for (const b of bs) {
    if (b.q >= 3 && sup.has(b.id)) {
      const down = itemAt(s, b.x - wx, b.y - wy);
      if (down && out[down.id]) { out[down.id].view = 0; out[down.id].steamBy = b.id; }
    }
  }
  // 騒音：隣（と同じ浴槽）で入浴中のツバメ・インコ。吸音垣が隣にあれば −1
  for (const b of bs) {
    const m = out[b.id];
    for (const g of s.guests) {
      if (g.st !== 'bath' || !SPECIES[g.sp].noisy) continue;
      const tb = s.items.find((it) => it.id === g.target);
      if (!tb) continue;
      if (Math.abs(tb.x - b.x) + Math.abs(tb.y - b.y) <= 1) { m.noise += 1; m.noiseBy.push(g.id); }
    }
    m.fenced = Object.values(DIRS).some(([dx, dy]) => itemAt(s, b.x + dx, b.y + dy)?.type === 'fence');
  }
  return out;
}

export const quietScore = (noise) => (noise <= 0 ? 1 : noise === 1 ? 0.5 : 0);
export function tempScore(sp, T) {
  const [lo, hi] = SPECIES[sp].range;
  if (T >= lo && T <= hi) return 1;
  const d = T < lo ? lo - T : T - hi;
  return Math.max(0, 1 - 0.1 * d);
}

// ある客が、ある浴槽に入ったときの今の点数（0〜100）と内訳
export function evaluate(s, g, b, m, selfId = g.id) {
  const sp = SPECIES[g.sp];
  const mm = m[b.id];
  let noise = mm.noise;
  // 自分自身の声は数えない
  if (sp.noisy && mm.noiseBy.includes(selfId)) noise -= 1;
  if (mm.fenced) noise -= 1;
  noise = Math.max(0, noise);
  const t = mm.on ? tempScore(g.sp, mm.T) : 0;
  const q = quietScore(noise);
  const v = mm.view;
  const total = (sp.w[0] * t + sp.w[1] * q + sp.w[2] * v);
  return { total, t, q, v, noise, T: mm.T, on: mm.on };
}

// ---- 経路 ----
export function walkable(s, x, y) {
  return inside(s, x, y) && !itemAt(s, x, y);
}

export function bfs(s, fx, fy) {
  const dist = Array.from({ length: s.H }, () => Array(s.W).fill(-1));
  const prev = Array.from({ length: s.H }, () => Array(s.W).fill(null));
  if (!walkable(s, fx, fy) && !(fx === 0 && fy === 0)) return { dist, prev };
  dist[fy][fx] = 0;
  const q = [[fx, fy]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = x + dx; const ny = y + dy;
      if (walkable(s, nx, ny) && dist[ny][nx] < 0) { dist[ny][nx] = dist[y][x] + 1; prev[ny][nx] = [x, y]; q.push([nx, ny]); }
    }
  }
  return { dist, prev };
}

// 浴槽の入口（隣の歩けるマス）のうち、いちばん近いもの
function nearestDoor(s, b, field) {
  let best = null;
  for (const [dx, dy] of Object.values(DIRS)) {
    const x = b.x + dx; const y = b.y + dy;
    if (!inside(s, x, y)) continue;
    const d = field.dist[y][x];
    if (d >= 0 && (!best || d < best.d)) best = { x, y, d };
  }
  return best;
}

function pathTo(field, x, y) {
  const out = [];
  let cur = [x, y];
  while (cur && field.dist[cur[1]][cur[0]] > 0) { out.unshift(cur); cur = field.prev[cur[1]][cur[0]]; }
  return out;
}

// 客の浴槽選び：到達でき、席が空き、湯が出ている浴槽から「今の点数 − 道のり」が最大のもの
export function chooseBath(s, g, m = metrics(s)) {
  const field = bfs(s, g.x, g.y);
  let best = null; const reasons = [];
  for (const b of baths(s)) {
    const mm = m[b.id];
    if (!mm.on) { reasons.push('closed'); continue; }
    if (reservedCount(s, b) >= seatsOf(b)) { reasons.push('full'); continue; }
    const door = nearestDoor(s, b, field);
    if (!door) { reasons.push('noroute'); continue; }
    const ev = evaluate(s, g, b, m);
    if (ev.t <= TUNE.refuseTempScore) { reasons.push(ev.T > SPECIES[g.sp].range[1] ? 'hot' : 'cold'); continue; }
    const score = ev.total - (door.d + 1);
    const cand = { b, door, score, d: door.d };
    if (!best || score > best.score || (score === best.score && (cand.d < best.d || (cand.d === best.d && b.id < best.b.id)))) best = cand;
  }
  return { best, reasons, field };
}

const WHY_WAIT = {
  full: '空いている湯がない', hot: 'どの湯も熱すぎる', cold: 'どの湯もぬるすぎる',
  closed: '湯が出ていない', noroute: '湯までの道がない',
};
function waitReason(reasons) {
  for (const k of ['hot', 'cold', 'full', 'noroute', 'closed']) if (reasons.includes(k)) return WHY_WAIT[k];
  return '湯がない';
}

// ---- 1秒すすめる ----
export function tick(s) {
  const ev = [];
  if (s.phase === 'prep') s.phase = 'open';
  if (s.phase !== 'open') return ev;
  const t = s.t;
  if (t === TUNE.windShiftAt && s.wind0 !== s.wind1) ev.push({ type: 'wind', dir: s.wind1 });
  let m = metrics(s, t);
  // 到着
  for (const g of s.guests) if (g.st === 'pending' && g.at === t) { g.st = 'wait'; g.x = 0; g.y = 0; ev.push({ type: 'arrive', g: g.id }); }
  // 予約中に弁が閉じた → 待ちへ戻す
  for (const g of s.guests) {
    if (g.st !== 'walk') continue;
    const b = s.items.find((it) => it.id === g.target);
    if (!b || !m[b.id]?.on) { g.st = 'wait'; g.target = 0; g.path = []; g.why = '向かっていた湯が止まった'; }
  }
  // 待っている客が湯を選ぶ（到着順）
  for (const g of s.guests) {
    if (g.st !== 'wait') continue;
    const { best, reasons, field } = chooseBath(s, g, m);
    if (best) {
      g.st = 'walk'; g.target = best.b.id; g.path = pathTo(field, best.door.x, best.door.y); g.why = '';
      ev.push({ type: 'reserve', g: g.id, b: best.b.id });
    } else {
      g.why = waitReason(reasons);
    }
  }
  // 移動（1マス/秒）。入口に着いていれば湯に入る
  for (const g of s.guests) {
    if (g.st !== 'walk') continue;
    if (g.path.length) { const [nx, ny] = g.path.shift(); g.x = nx; g.y = ny; }
    else { g.st = 'bath'; g.bathT = 0; ev.push({ type: 'enter', g: g.id, b: g.target }); }
  }
  m = metrics(s, t);
  // 入浴の採点
  for (const g of s.guests) {
    if (g.st !== 'bath') continue;
    const b = s.items.find((it) => it.id === g.target);
    if (g.bathT === 0 && ev.some((e) => e.type === 'enter' && e.g === g.id)) continue; // 入った秒は数えない
    const e = evaluate(s, g, b, m);
    g.acc[0] += e.t; g.acc[1] += e.q; g.acc[2] += e.v; g.bathT += 1;
    if (g.bathT >= TUNE.bathTicks) finishGuest(s, g, ev);
  }
  // 待ち時間
  for (const g of s.guests) {
    if (g.st === 'wait' || g.st === 'walk') {
      g.waited += 1;
      if (g.st === 'wait' && g.waited >= TUNE.waitLimit) {
        g.st = 'gone'; g.sat = 0; g.left = 'wait';
        ev.push({ type: 'leave', g: g.id, why: g.why || '待ちくたびれた' });
      }
    }
  }
  s.t += 1;
  if (dayOver(s)) closeDay(s, ev);
  return ev;
}

export function satOf(s, g) {
  if (!g.bathT) return 0;
  const w = SPECIES[g.sp].w;
  const avg = (w[0] * g.acc[0] + w[1] * g.acc[1] + w[2] * g.acc[2]) / g.bathT;
  const pen = Math.min(TUNE.waitPenaltyMax, g.waited * TUNE.waitPenalty);
  return Math.max(0, Math.round(avg - pen));
}

function finishGuest(s, g, ev) {
  g.sat = satOf(s, g); g.st = 'gone';
  const pay = TUNE.fee + (g.sat >= TUNE.passLine ? TUNE.tip : 0);
  s.money += pay; s.earned += pay;
  ev.push({ type: 'done', g: g.id, sat: g.sat, pay });
}

export function dayOver(s) {
  return s.t >= TUNE.dayLimit || s.guests.every((g) => g.st === 'gone');
}

function closeDay(s, ev) {
  for (const g of s.guests) {
    if (g.st === 'gone') continue;
    if (g.st === 'bath' && g.bathT > 0) finishGuest(s, g, ev);
    else { g.st = 'gone'; g.sat = 0; g.left = 'time'; }
  }
  // 維持費
  let upkeep = 0;
  for (const it of s.items) if (it.type !== 'source') upkeep += isBath(it) ? 2 : 1;
  s.upkeep = upkeep;
  s.money = Math.max(0, s.money - upkeep);
  s.phase = 'done';
  ev.push({ type: 'close' });
}

export function summary(s) {
  const n = s.guests.length;
  const good = s.guests.filter((g) => (g.sat ?? 0) >= TUNE.passLine).length;
  const need = Math.ceil(n * TUNE.clearRate);
  return { n, good, need, rate: good / n, cleared: good >= need, earned: s.earned, upkeep: s.upkeep ?? 0 };
}

// ---- 操作（弁・回転・建設・移動・撤去・管） ----
// edit: {op:'valve', id, q} | {op:'rotate', id, dir} | {op:'build', type, x, y} | {op:'move', id, x, y}
//       | {op:'remove', id} | {op:'pipe', x, y} | {op:'unpipe', x, y}
// building=true のときだけ建設系を許す（準備中か一時停止中）
export function checkEdit(s, e, { building = s.phase === 'prep' } = {}) {
  const it = e.id ? s.items.find((i) => i.id === e.id) : null;
  if (s.phase === 'done') return no('この日は終わった');
  switch (e.op) {
    case 'valve': {
      if (!it || !isBath(it)) return no('浴槽ではない');
      if (e.q < 0 || e.q > TUNE.qMax) return no(`弁は0〜${TUNE.qMax}`);
      if (e.q > 0 && !suppliedSet(s).has(it.id)) return no('管が源泉につながっていない');
      const rest = heatUsed(s) - it.q + e.q;
      if (rest > s.cap) return no(`お湯が足りない（残り${s.cap - heatUsed(s)}）`);
      return ok();
    }
    case 'rotate':
      if (!it || it.type !== 'windbreak') return no('風よけではない');
      if (!DIRS[e.dir]) return no('向きが変');
      return ok();
    case 'build': case 'move': case 'pipe': case 'unpipe': case 'remove':
      if (!building) return no('建てる・動かすのは一時停止中だけ');
      break;
    default: return no('不明な操作');
  }
  if (e.op === 'pipe' || e.op === 'unpipe') {
    if (!inside(s, e.x, e.y)) return no('島の外');
    const has = s.pipes[e.y][e.x];
    if (e.op === 'pipe' && has) return no('もう管がある');
    if (e.op === 'unpipe' && !has) return no('管がない');
    if (e.op === 'pipe' && s.money < PIPE_COST) return no('お金が足りない');
    return ok(e.op === 'pipe' ? -PIPE_COST : 1);
  }
  if (e.op === 'remove') {
    if (!it || FACILITIES[it.type].fixed) return no('動かせない');
    if (isBath(it) && reservedCount(s, it) > 0) return no('お客さんが使っている');
    return ok(Math.floor(FACILITIES[it.type].cost / 2));
  }
  const x = e.x; const y = e.y;
  if (!inside(s, x, y)) return no('島の外');
  if (isEntrance(x, y)) return no('入口には置けない');
  const there = itemAt(s, x, y);
  if (there && there !== it) return no('ほかの設備がある');
  if (s.guests.some((g) => (g.st === 'wait' || g.st === 'walk') && g.x === x && g.y === y)) return no('お客さんが立っている');
  let cost = 0;
  if (e.op === 'build') {
    const F = FACILITIES[e.type];
    if (!F || F.fixed) return no('建てられない');
    cost = -F.cost;
    if (s.money < F.cost) return no('お金が足りない');
  } else {
    if (!it || FACILITIES[it.type].fixed) return no('動かせない');
    if (isBath(it) && reservedCount(s, it) > 0) return no('お客さんが使っている');
  }
  // 置いた後に、向かっている客・入浴中の客の道がふさがらないか
  const trial = cloneState(s);
  applyRaw(trial, e);
  const tm = metrics(trial);
  for (const g of trial.guests) {
    if (g.st !== 'walk') continue;
    const b = trial.items.find((i) => i.id === g.target);
    const f = bfs(trial, g.x, g.y);
    if (!b || !nearestDoor(trial, b, f)) return no('お客さんの通り道がふさがる');
  }
  // 入口から、どの浴槽にも行けなくなる置き方は拒否
  const f0 = bfs(trial, 0, 0);
  for (const b of baths(trial)) if (!nearestDoor(trial, b, f0)) return no(`${labelOf(b)}へ行く道がふさがる`);
  void tm;
  return ok(cost);
}

const ok = (money = 0) => ({ ok: true, money });
const no = (reason) => ({ ok: false, reason });
export const labelOf = (it) => it.name || FACILITIES[it.type].name;

function applyRaw(s, e) {
  const it = e.id ? s.items.find((i) => i.id === e.id) : null;
  switch (e.op) {
    case 'valve': it.q = e.q; break;
    case 'rotate': it.dir = e.dir; break;
    case 'build': s.items.push({ id: s.nid++, type: e.type, x: e.x, y: e.y, q: 0, dir: e.dir || 'N' }); break;
    case 'move': it.x = e.x; it.y = e.y; break;
    case 'remove': s.items = s.items.filter((i) => i !== it); break;
    case 'pipe': s.pipes[e.y][e.x] = true; break;
    case 'unpipe': s.pipes[e.y][e.x] = false; break;
    default: break;
  }
}

export function applyEdit(s, e, opts) {
  const c = checkEdit(s, e, opts);
  if (!c.ok) return c;
  applyRaw(s, e);
  s.money += c.money;
  syncSupply(s);
  return c;
}

// 予告：操作した後の各浴槽の様子（操作前と同じ関数で出す）
export function preview(s, e, opts) {
  const c = checkEdit(s, e, opts);
  if (!c.ok) return c;
  const t = cloneState(s);
  applyRaw(t, e); t.money += c.money; syncSupply(t);
  return { ...c, state: t, metrics: metrics(t) };
}

// 客をタップしたときの説明
export function explain(s, g) {
  const sp = SPECIES[g.sp];
  const [lo, hi] = sp.range;
  if (g.st === 'gone') return g.left ? `${sp.name}：${g.left === 'wait' ? '待ちくたびれて帰った' : '入れずに閉店'}（0点）` : `${sp.name}：満足 ${g.sat}点`;
  if (g.st === 'pending') return `${sp.name}：${g.at}秒に来る（${lo}〜${hi}度）`;
  if (g.st === 'wait') return `${sp.name}：${g.why || '湯を選んでいる'}（好み${lo}〜${hi}度）`;
  const b = s.items.find((i) => i.id === g.target);
  const m = metrics(s);
  const e = evaluate(s, g, b, m);
  const mark = (v) => (v >= 1 ? '○' : v > 0 ? '△' : '×');
  const tWhy = !e.on ? '湯が止まっている' : e.T < lo ? `${e.T}度でぬるい` : e.T > hi ? `${e.T}度で熱い` : `${e.T}度でちょうどいい`;
  const qWhy = e.noise <= 0 ? '静か' : e.noise === 1 ? '少しにぎやか' : 'うるさい';
  const mm = m[b.id];
  const vWhy = e.v ? '景色が見える' : mm.steamBy ? '湯気で見えない' : '建物で見えない';
  const head = g.st === 'walk' ? `${labelOf(b)}へ向かう` : `${labelOf(b)}に入浴中`;
  return `${sp.name}：${head}　お湯${mark(e.t)}（${tWhy}）／声${mark(e.q)}（${qWhy}）／景色${mark(e.v)}（${vWhy}）`;
}

// 好みの一番大事なもの（一覧の表示用）
export function mainNeed(sp) {
  const w = SPECIES[sp].w;
  const i = w.indexOf(Math.max(...w));
  return ['temp', 'quiet', 'view'][i];
}
