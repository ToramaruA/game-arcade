// 雲海温泉と渡り鳥の宿の自動プレイヤー（標準の形。共通の MCTS が遊ぶ）。
// 宿は日をまたいで引き継ぐので、各日の始まりは「保存した達成手順で前の日まで遊んだ宿」から。
// 判断の区切り：準備中は1操作ずつ（最大 PREP_MAX 回、その後は開店）。営業中は STEP 秒ごと。
//
// このファイルを直接動かすと、全28日の達成手順を探して solutions.js を書き直す（ソルバー）：
//   node tests/autoplay/cloudspring-bird-inn.mjs --solve [--from 1] [--to 28] [--iters 300]
import {
  DAYS, createState, cloneState, tick, applyEdit, checkEdit, baths, summary, TUNE, metrics, evaluate,
  DIR_LIST, DIRS, FACILITIES, isEntrance, itemAt, satOf, buildable, innOf, inside, suppliedSet, heatUsed, isBath, initialInn,
} from '../../site/games/cloudspring-bird-inn/logic.js';
import { SOLUTIONS } from '../../site/games/cloudspring-bird-inn/solutions.js';

const STEP = 4;
const PREP_MAX = 6;

// 自動プレイの各日の始まり：最初の小さな宿（源泉・浴槽2つ）のまま島だけ広がり、お金は STD_MONEY。
// 「その日に合わせて建てる・動かす」ことが要るかを、日ごとに比べるため（本編は前の日の宿を引き継ぐ）。
export const STD_MONEY = 150;
export function standardInn() { return { ...initialInn(), money: STD_MONEY }; }

// ---- 保存した手順で1日遊ぶ（テストと同じ再生のしかた） ----
export function playPlan(day, inn, plan = []) {
  const s = createState(day, { inn });
  for (const [t, e] of plan) if (t < 0) applyEdit(s, e, { building: true });
  while (s.phase !== 'done') {
    for (const [t, e] of plan) if (t === s.t) applyEdit(s, e);
    tick(s);
  }
  return s;
}

// 各日の始まりの宿（前の日まで達成手順で遊んだもの）
const innCache = new Map();
export function innBefore(day, sols = SOLUTIONS) {
  if (sols === SOLUTIONS && innCache.has(day)) return innCache.get(day);
  let inn;
  for (const d of DAYS) {
    if (d.id === day) break;
    inn = innOf(playPlan(d.id, inn, sols[d.id] || []));
  }
  if (sols === SOLUTIONS) innCache.set(day, inn);
  return inn;
}

// ---- 準備中の操作の候補（意味のありそうなものに絞る） ----
function nearBath(s, x, y) { return baths(s).some((b) => Math.abs(b.x - x) + Math.abs(b.y - y) === 1); }
function prepActions(s, { builds = true } = {}) {
  const acts = ['open'];
  const winds = [...new Set([s.wind0, s.wind1])];
  const free = [];
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) if (!isEntrance(x, y) && !itemAt(s, x, y)) free.push([x, y]);
  // 浴槽を動かす：島の縁（景色が見える）や源泉の近く
  for (const it of baths(s)) {
    for (const [x, y] of free) {
      const edgeCell = x === 0 || y === 0 || x === s.W - 1 || y === s.H - 1;
      if (!edgeCell) continue;
      const e = { op: 'move', id: it.id, x, y };
      if (checkEdit(s, e, { building: true }).ok) acts.push(e);
    }
  }
  for (const it of s.items) if (it.type === 'windbreak') for (const d of DIR_LIST) if (d !== it.dir) acts.push({ op: 'rotate', id: it.id, dir: d });
  if (builds) {
    const types = buildable(s.day);
    for (const b of baths(s)) {
      // 風よけ：浴槽の風上の隣に、風へ向けて
      if (s.strong && types.includes('windbreak')) {
        for (const w of winds) {
          const [dx, dy] = DIRS[w]; const x = b.x + dx; const y = b.y + dy;
          const e = { op: 'build', type: 'windbreak', x, y, dir: w };
          if (inside(s, x, y) && checkEdit(s, e, { building: true }).ok) acts.push(e);
        }
      }
      for (const t of ['fence', 'flower', 'sign', 'stage', 'tower']) {
        if (!types.includes(t)) continue;
        for (const [dx, dy] of Object.values(DIRS)) {
          const e = { op: 'build', type: t, x: b.x + dx, y: b.y + dy };
          if (checkEdit(s, e, { building: true }).ok) acts.push(e);
        }
      }
    }
    // 浴槽を建てる：島の縁
    for (const t of types.filter((k) => FACILITIES[k].bath)) {
      for (const [x, y] of free) {
        if (!(x === 0 || y === 0 || x === s.W - 1 || y === s.H - 1)) continue;
        const e = { op: 'build', type: t, x, y };
        if (checkEdit(s, e, { building: true }).ok) acts.push(e);
      }
    }
    if (types.includes('chair')) for (const [x, y] of free.filter(([x, y]) => x + y <= 2)) { const e = { op: 'build', type: 'chair', x, y }; if (checkEdit(s, e, { building: true }).ok) acts.push(e); }
  }
  return acts;
}

function liveActions(s) {
  const acts = ['wait'];
  for (const b of baths(s)) {
    for (const q of [b.q - 1, b.q + 1]) {
      const e = { op: 'valve', id: b.id, q };
      if (checkEdit(s, e).ok) acts.push(e);
    }
  }
  for (const it of s.items) if (it.type === 'windbreak') for (const d of DIR_LIST) if (d !== it.dir) acts.push({ op: 'rotate', id: it.id, dir: d });
  return acts;
}

function run(gs, n) { for (let i = 0; i < n && gs.s.phase !== 'done'; i++) tick(gs.s); }

export const game = {
  stages: DAYS.map((d, i) => ({ id: i, name: `第${d.id}日 ${d.name}` })),
  start(stage) { const d = DAYS[stage.id]; return { s: createState(d.id, { inn: standardInn() }), prep: 0 }; },
  clone: (gs) => ({ s: cloneState(gs.s), prep: gs.prep }),
  actions(gs) { return gs.s.phase === 'prep' ? prepActions(gs.s) : liveActions(gs.s); },
  idle(gs) { return gs.s.phase === 'prep' ? 'open' : 'wait'; },
  apply(gs, a) {
    if (gs.s.phase === 'prep') {
      if (a === 'open' || gs.prep >= PREP_MAX) { run(gs, STEP); return; }
      applyEdit(gs.s, a, { building: true }); gs.prep += 1;
      if (gs.prep >= PREP_MAX) run(gs, STEP);
      return;
    }
    if (a !== 'wait') applyEdit(gs.s, a);
    run(gs, STEP);
  },
  result(gs) { if (gs.s.phase !== 'done') return null; return summary(gs.s).cleared ? 'win' : 'lose'; },
  // 途中の有利さ：満足して帰った客＋入浴中の客の今の点の見込み
  score(gs) {
    const s = gs.s; const n = s.guests.length;
    let v = 0;
    for (const x of s.guests) {
      if (x.st === 'gone' || x.st === 'walk2' || x.st === 'tea') v += (x.sat ?? 0) >= TUNE.passLine ? 1 : 0;
      else if (x.st === 'bath' && x.bathT) v += satOf(s, x) >= TUNE.passLine ? 0.8 : 0.2;
      else if (x.st === 'pending' || x.st === 'walk') v += 0.4;
    }
    const need = Math.ceil(n * TUNE.clearRate);
    return Math.min(0.95, 0.8 * v / Math.max(need, 1));
  },
  naive: {
    valveOnly: { name: '温度だけ合わせる（弁だけ）', allow: (gs, a) => a === 'open' || a === 'wait' || a.op === 'valve' },
    noLayout: { name: '配置を変えない（弁と風よけの向き）', allow: (gs, a) => a === 'open' || a === 'wait' || a.op === 'valve' || a.op === 'rotate' },
  },
  levels: { beginner: 30, expert: 200 },
  rolloutDepth: 16,
};

// ======================================================================
// ソルバー：営業中は「弁の自動調整」、準備中の配置は山登りで探す
// ======================================================================

// 弁を変えたときの見込み（入浴中・向かう客の点＋待つ客・来る客が入れる湯の点）
function objective(s) {
  const m = metrics(s);
  let J = 0;
  for (const x of s.guests) {
    if (x.st === 'bath' || x.st === 'walk') {
      const b = s.items.find((i) => i.id === x.target);
      J += evaluate(s, x, b, m).total * (x.st === 'bath' ? 1.2 : 1);
    } else if (x.st === 'wait' || (x.st === 'pending' && x.at - s.t <= 3)) {
      let best = -40;
      for (const b of baths(s)) {
        const mm = m[b.id];
        if (!mm.on) continue;
        const used = s.guests.filter((o) => (o.st === 'walk' || o.st === 'bath') && o.target === b.id).length;
        if (used >= FACILITIES[b.type].seats) continue;
        const e = evaluate(s, x, b, m);
        if (e.t <= 0) continue;
        best = Math.max(best, e.total);
      }
      J += best * (x.st === 'wait' ? 1 : 0.8);
    }
  }
  return J - heatUsed(s) * 0.01;
}

// 今の秒に行う弁の操作（座標を1つずつ動かして見込みが上がる限り続ける）
export function controller(s) {
  const bs = baths(s);
  if (!bs.length) return [];
  const sup = suppliedSet(s);
  const q0 = new Map(bs.map((b) => [b.id, b.q]));
  let cur = objective(s);
  for (let iter = 0; iter < 8; iter++) {
    let best = null;
    for (const b of bs) {
      if (!sup.has(b.id)) continue;
      for (let q = 0; q <= TUNE.qMax; q++) {
        if (q === b.q) continue;
        if (heatUsed(s) - b.q + q > s.cap) continue;
        const old = b.q; b.q = q;
        const v = objective(s);
        b.q = old;
        if (v > cur + 0.5 && (!best || v > best.v)) best = { b, q, v };
      }
    }
    if (!best) break;
    best.b.q = best.q; cur = best.v;
  }
  const edits = [];
  // 閉める操作を先に（合計の上限に引っかからないように）
  const changed = bs.filter((b) => b.q !== q0.get(b.id)).sort((a, b) => (a.q - q0.get(a.id)) - (b.q - q0.get(b.id)));
  for (const b of bs) { const nq = b.q; b.q = q0.get(b.id); b._nq = nq; }
  for (const b of changed) { edits.push({ op: 'valve', id: b.id, q: b._nq }); }
  for (const b of bs) delete b._nq;
  return edits;
}

// 弁の自動調整つきで1日遊ぶ。戻り値 { s, plan }
export function simulate(day, inn, prep) {
  const s = createState(day, { inn });
  const plan = [];
  for (const e of prep) { if (applyEdit(s, e, { building: true }).ok) plan.push([-1, e]); }
  let lastSig = '';
  while (s.phase !== 'done') {
    const sig = s.guests.map((x) => x.st[0]).join('') + (s.t >= TUNE.windShiftAt ? 'w' : '');
    if (sig !== lastSig || s.t % 3 === 0) {
      for (const e of controller(s)) { if (applyEdit(s, e).ok) plan.push([s.t, e]); }
      lastSig = sig;
    }
    tick(s);
  }
  return { s, plan };
}

const scoreOf = (s) => { const sm = summary(s); return sm.good * 1000 + sm.avg * 10 + Math.min(s.money, 400) * 0.2; };

function mutate(prep, s0, R) {
  const p = prep.slice();
  const r = R();
  if (p.length && r < 0.25) { p.splice(Math.floor(R() * p.length), 1); return p; }
  // 今の配置（prep を適用した後）から、候補を1つ足す
  const s = cloneState(s0);
  for (const e of p) applyEdit(s, e, { building: true });
  let acts = prepActions(s).filter((a) => a !== 'open');
  // 撤去・弁の初期値
  for (const it of s.items) if (!FACILITIES[it.type].fixed) acts.push({ op: 'remove', id: it.id });
  for (const b of baths(s)) for (const q of [b.q - 1, b.q + 1]) { const e = { op: 'valve', id: b.id, q }; if (checkEdit(s, e, { building: true }).ok) acts.push(e); }
  if (!acts.length) return p;
  // 中まで含めて、ときどき島の内側にも建てる
  if (R() < 0.2) {
    const types = buildable(s.day);
    const t = types[Math.floor(R() * types.length)];
    const x = Math.floor(R() * s.W); const y = Math.floor(R() * s.H);
    acts = [{ op: 'build', type: t, x, y, dir: DIR_LIST[Math.floor(R() * 4)] }];
  }
  p.push(acts[Math.floor(R() * acts.length)]);
  return p;
}

export function solveDay(day, inn, { iters = 300, seed = 1, log = false } = {}) {
  let x = seed * 2654435761 >>> 0;
  const R = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  const s0 = createState(day, { inn });
  let best = { prep: [], ...simulate(day, inn, []) };
  best.score = scoreOf(best.s);
  let cur = best;
  for (let i = 0; i < iters; i++) {
    const prep = mutate(cur.prep, s0, R);
    const r = simulate(day, inn, prep);
    const sc = scoreOf(r.s);
    if (sc >= cur.score || R() < 0.03) {
      // 実際に効いた操作だけ残す
      cur = { prep: r.plan.filter(([t]) => t < 0).map(([, e]) => e), ...r, score: sc };
      if (sc > best.score) { best = cur; if (log) { const sm = summary(r.s); console.log(`  day${day} it${i} ${sm.good}/${sm.n} avg${sm.avg.toFixed(0)} money${r.s.money}`); } }
    }
  }
  return best;
}

// ---- 直接動かしたとき：全日の手順を探して solutions.js を書く ----
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()) && process.argv.includes('--solve');
if (isMain) {
  const fs = await import('node:fs');
  const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? Number(process.argv[i + 1]) : d; };
  const from = arg('from', 1); const to = arg('to', 28); const iters = arg('iters', 300);
  const sols = { ...SOLUTIONS };
  let inn = innBefore(from, sols);
  for (const d of DAYS) {
    if (d.id < from || d.id > to) continue;
    const t0 = Date.now();
    let best = null;
    for (let seed = 1; seed <= 3; seed++) {
      const r = solveDay(d.id, inn, { iters, seed, log: false });
      if (!best || r.score > best.score) best = r;
      if (summary(best.s).good === best.s.guests.length) break;
    }
    const sm = summary(best.s);
    console.log(`第${d.id}日 ${d.name}: ${sm.good}/${sm.n}（必要${sm.need}）${sm.cleared ? '' : ' ★未達'} 所持金${best.s.money} ${((Date.now() - t0) / 1000).toFixed(1)}秒`);
    sols[d.id] = best.plan;
    inn = innOf(best.s);
  }
  const body = Object.entries(sols).map(([k, v]) => `  ${k}: [\n${v.map(([t, e]) => `    [${t}, ${JSON.stringify(e)}],`).join('\n')}\n  ],`).join('\n');
  const head = '// 各日に勝てる手順（テストで再生して、全日に達成の道があることを確かめる）。\n// 宿は日をまたいで引き継ぐので、第1日から順に再生する。t<0 は準備中の操作、t>=0 はその秒の頭で行う操作。\n// tests/autoplay/cloudspring-bird-inn.mjs --solve で作り直せる。\n';
  fs.writeFileSync(new URL('../../site/games/cloudspring-bird-inn/solutions.js', import.meta.url), `${head}export const SOLUTIONS = {\n${body}\n};\n`);
}
