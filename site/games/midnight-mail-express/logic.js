// 画面に依存しないルール。DOM を触らない。
import { STATIONS, KINDS, LINES, RUN_PARAMS, NOWHERE } from './data.js';
export { STATIONS, KINDS, LINES, RUN_PARAMS, NOWHERE };

export const REGRET_MAX = 6; // 6 で便終了
export const MISS_STREAK_MAX = 3; // 3回連続ミスで便終了
export const WINDOW_BEFORE = 2; // 降車窓：到着の2秒前から
export const WINDOW_AFTER = 2; // 到着の2秒後まで
export const LOCK_BEFORE = 3.2; // 分岐器は到着の3.2秒前に固定される
export const RUN_COUNT = 15;
export const KIND_COUNT = 12;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---- 判定（純粋関数） ----
export function acceptable(p, st) { return st === p.first || p.ok.includes(st); }
export function evaluateDrop(p, st, easy = false) {
  if (st === p.first) return { type: 'first', stars: 2, regret: -1 };
  if (p.ok.includes(st)) return { type: 'ok', stars: 1, regret: -1 };
  if (p.ng.includes(st)) return { type: 'ng', stars: 0, regret: easy ? 1 : 2 };
  return { type: 'wrong', stars: 0, regret: 1 };
}
export function inWindow(segT, T) { return segT >= T - WINDOW_BEFORE && segT <= T + WINDOW_AFTER; }
export function isLocked(segT, T) { return segT >= T - LOCK_BEFORE; }

// ---- 便テンプレートの検証用ソルバー（簡易全探索） ----
function solveRoute(passengers, stations, cap) {
  const n = passengers.length;
  let bestStars = 0, bestCorrect = 0, allFirst = false;
  function rec(s, status, stars, correct, firsts) {
    status = status.slice();
    let aboard = status.filter((x) => x === 1).length;
    for (let i = 0; i < n; i++) {
      if (status[i] === 0 && passengers[i].board <= s && aboard < cap) { status[i] = 1; aboard++; }
    }
    if (s === 4) {
      bestStars = Math.max(bestStars, stars); bestCorrect = Math.max(bestCorrect, correct);
      if (firsts === n) allFirst = true;
      return;
    }
    const st = stations[s];
    const cand = [];
    status.forEach((x, i) => { if (x === 1 && acceptable(passengers[i], st)) cand.push(i); });
    for (let m = 0; m < (1 << cand.length); m++) {
      const next = status.slice(); let st2 = stars, c2 = correct, f2 = firsts;
      cand.forEach((i, k) => {
        if (m & (1 << k)) { next[i] = 2; c2++; if (passengers[i].first === st) { st2 += 2; f2++; } else st2 += 1; }
      });
      rec(s + 1, next, st2, c2, f2);
    }
  }
  rec(0, passengers.map(() => 0), 0, 0, 0);
  return { stars: bestStars, correct: bestCorrect, allFirst };
}
export function routeOf(tpl, mask) {
  return [0, 1, 2].map((s) => tpl.pairs[s][(mask >> s) & 1]).concat(tpl.terminal);
}
export function solve(tpl) {
  let stars = 0, correct = 0, allFirst = false, bestMask = 0;
  for (let mask = 0; mask < 8; mask++) {
    const r = solveRoute(tpl.passengers, routeOf(tpl, mask), tpl.cap);
    if (r.stars > stars) bestMask = mask;
    stars = Math.max(stars, r.stars); correct = Math.max(correct, r.correct); allFirst = allFirst || r.allFirst;
  }
  return { maxStars: stars, maxCorrect: correct, allFirst, bestMask };
}
function thresholds(maxStars) {
  return [Math.ceil(maxStars * 0.6), Math.ceil(maxStars * 0.8), maxStars];
}

// ---- 便テンプレート生成（検証済みの構成だけを返す） ----
function generate(id) {
  const line = Math.floor(id / 5), idx = id % 5;
  const P = RUN_PARAMS[id];
  const rng = mulberry32(id * 7919 + 13);
  for (let attempt = 0; attempt < 4000; attempt++) {
    const order = shuffle([...Array(11).keys()], rng);
    const terminal = order[0];
    const pairs = [order.slice(1, 3), order.slice(3, 5), order.slice(5, 7)];
    const route = new Set(order.slice(0, 7));
    const cands = shuffle([...Array(11).keys()].filter((k) => [KINDS[k].home, ...KINDS[k].ok].some((s) => route.has(s))), rng);
    if (cands.length < P.n) continue;
    const kinds = cands.slice(0, P.n);
    const passengers = kinds.map((k, i) => {
      const set = [KINDS[k].home, ...KINDS[k].ok];
      const here = set.filter((s) => route.has(s));
      const first = here[Math.floor(rng() * here.length)];
      return {
        kind: k, first, ok: set.filter((s) => s !== first), ng: KINDS[k].ng.slice(),
        board: Math.min(2, Math.floor((i * 3.2) / P.n)), mystery: rng() < P.mystery,
      };
    });
    const tpl = { id, line, idx, name: LINES[line].runs[idx], pairs, terminal, passengers, need: P.need, T: P.T, cap: P.cap, hidden: false };
    const s = solve(tpl);
    const margin = attempt < 1500 ? 1 : 0;
    if (s.maxCorrect < P.need + margin) continue;
    if (P.dilemma && s.allFirst) continue;
    if (!P.dilemma && attempt < 2000 && s.maxStars < P.n * 2 - 2) continue;
    return { ...tpl, maxStars: s.maxStars, thresholds: thresholds(s.maxStars) };
  }
  throw new Error(`便 ${id} を生成できない`);
}
export const RUNS = Array.from({ length: RUN_COUNT }, (_, i) => generate(i));

// 隠し客（車掌）を足した便。条件を満たせば終点が「どこでもない駅」になる。クリア不能になるなら足さない。
export function withHidden(tpl) {
  if (tpl.idx !== 4) return tpl;
  const conductor = { kind: 11, first: NOWHERE, ok: [], ng: [], board: 3, mystery: true };
  const t2 = { ...tpl, terminal: NOWHERE, passengers: [...tpl.passengers, conductor], hidden: true };
  const s = solve(t2);
  if (s.maxCorrect < tpl.need) return tpl;
  return { ...t2, maxStars: s.maxStars, thresholds: thresholds(s.maxStars) };
}

// ---- 運行の状態（時間の進め方は game.js 側。ここは出来事の処理だけ） ----
export function createRun(tpl, rng = Math.random) {
  const run = {
    tpl, mirror: [0, 1, 2].map(() => rng() < 0.5),
    passengers: shuffleBoard(tpl.passengers, rng).map((p, id) => ({ ...p, id, status: 'waiting', slot: -1, result: null, dropStop: -1 })),
    stop: 0, phase: 'run', side: [0, 0, 0], locked: false,
    regret: 0, stars: 0, correct: 0, missStreak: 0, mistakes: 0, left: 0,
    reserved: null, finished: false, outcome: null, log: [],
  };
  tryBoard(run);
  return run;
}
function shuffleBoard(list, rng) {
  // 同じ駅から乗る客どうしの順番だけを入れ替える（乗車駅の順は保つ）
  const out = [];
  for (let b = 0; b <= 3; b++) out.push(...shuffle(list.filter((p) => p.board === b), rng));
  return out;
}
export function pairAt(run, s) {
  if (s >= 3) return [run.tpl.terminal];
  const [a, b] = run.tpl.pairs[s];
  return run.mirror[s] ? [b, a] : [a, b];
}
export function stationAt(run, s) { return s >= 3 ? run.tpl.terminal : pairAt(run, s)[run.side[s]]; }
export function aboard(run) { return run.passengers.filter((p) => p.status === 'aboard'); }
export function tryBoard(run) {
  const boarded = [];
  for (const p of run.passengers) {
    if (p.status !== 'waiting' || p.board > run.stop) continue;
    const used = new Set(aboard(run).map((q) => q.slot));
    const slot = [0, 1, 2].find((i) => !used.has(i));
    if (slot === undefined || aboard(run).length >= run.tpl.cap) break;
    p.status = 'aboard'; p.slot = slot; boarded.push(p);
  }
  return boarded;
}
export function setSwitch(run, side) {
  if (run.finished || run.stop >= 3 || run.locked || run.phase !== 'run') return false;
  run.side[run.stop] = side === 1 ? 1 : 0;
  return true;
}
export function lockSwitch(run) { run.locked = true; }
export function reserve(run, id) {
  const p = run.passengers[id];
  if (run.finished || run.phase !== 'run' || !p || p.status !== 'aboard') return false;
  run.reserved = run.reserved === id ? null : id;
  return true;
}
export function arrive(run) {
  run.phase = 'window'; run.locked = true;
  const ev = [];
  if (run.reserved !== null) { const e = dropPassenger(run, run.reserved); if (e) ev.push(e); run.reserved = null; }
  return ev;
}
export function dropPassenger(run, id) {
  const p = run.passengers[id];
  if (run.finished || run.phase !== 'window' || !p || p.status !== 'aboard') return null; // 二重降車しない
  const st = stationAt(run, run.stop);
  const r = evaluateDrop(p, st, run.tpl.id === 0);
  p.status = 'dropped'; p.result = r.type; p.dropStop = run.stop; p.dropStation = st;
  run.stars += r.stars;
  if (r.regret < 0) run.regret = Math.max(0, run.regret + r.regret); else run.regret += r.regret;
  if (r.stars > 0) { run.correct++; run.missStreak = 0; } else { run.missStreak++; run.mistakes++; }
  const ev = { passenger: p, station: st, result: r, stop: run.stop };
  run.log.push(ev);
  if (run.regret >= REGRET_MAX) finish(run, 'regret');
  else if (run.missStreak >= MISS_STREAK_MAX) finish(run, 'miss');
  return ev;
}
export function closeWindow(run) {
  if (run.finished) return { finished: true, boarded: [] };
  if (run.stop >= 3) {
    for (const p of aboard(run)) { p.status = 'left'; run.left++; run.regret += 1; run.log.push({ passenger: p, station: null, result: { type: 'left', stars: 0, regret: 1 }, stop: 3 }); }
    if (run.regret >= REGRET_MAX) finish(run, 'regret'); else finish(run, 'end');
    return { finished: true, boarded: [] };
  }
  run.stop++; run.phase = 'run'; run.locked = false; run.reserved = null;
  return { finished: false, boarded: tryBoard(run) };
}
export function starCount(tpl, stars, cleared) {
  if (!cleared) return 0;
  const th = tpl.thresholds;
  return Math.max(1, th.filter((x) => stars >= x).length);
}
function finish(run, reason) {
  run.finished = true; run.phase = 'result';
  const cleared = reason === 'end' && run.correct >= run.tpl.need;
  const notBoarded = run.passengers.filter((p) => p.status === 'waiting').length;
  run.outcome = {
    reason, cleared, correct: run.correct, need: run.tpl.need, stars: run.stars, regret: run.regret,
    total: run.passengers.length, starCount: starCount(run.tpl, run.stars, cleared),
    perfect: cleared && run.mistakes === 0 && run.left === 0 && notBoarded === 0,
  };
}
export function failText(run) {
  const o = run.outcome;
  if (!o) return '';
  if (o.cleared) return '';
  const bad = run.log.filter((e) => e.result.stars === 0).slice(-3).map((e) => (e.station === null ? `${KINDS[e.passenger.kind].name}は降ろされないまま終点へ` : `${KINDS[e.passenger.kind].name}を${STATIONS[e.station].name}で降ろした`));
  const head = o.reason === 'regret' ? '未練があふれて、列車はあの世で止まった。' : o.reason === 'miss' ? '3回続けて違う駅で降ろしてしまった。' : `届けられたのは${o.correct}人（必要${o.need}人）。`;
  return head + (bad.length ? ' ' + bad.join('、') + '。' : '');
}

// ---- 保存・解放・アルバム ----
export const SAVE_KEY = 'midnight-mail-express-v1';
export function emptySave() { return { clear: {}, album: {}, mute: false, seenTutorial: false }; }
export function loadSave(storage) {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (!raw) return emptySave();
    const d = JSON.parse(raw);
    return { ...emptySave(), ...d, clear: d.clear || {}, album: d.album || {} };
  } catch { return emptySave(); }
}
export function writeSave(storage, save) { try { storage?.setItem(SAVE_KEY, JSON.stringify(save)); return true; } catch { return false; } }
export function isUnlocked(save, id) {
  const line = Math.floor(id / 5), idx = id % 5;
  if (idx > 0) return !!save.clear[id - 1];
  if (line === 0) return true;
  let n = 0; for (let i = 0; i < 5; i++) if (save.clear[(line - 1) * 5 + i]) n++;
  return n >= 3;
}
export function hiddenUnlocked(save) {
  const lines = new Set(Object.values(save.album).map((a) => a.line));
  return [0, 1, 2].every((l) => lines.has(l));
}
export function recordRun(save, run) {
  const o = run.outcome; const tpl = run.tpl;
  if (!o) return save;
  for (const e of run.log) {
    if (e.result.stars > 0 && !save.album[e.passenger.kind]) save.album[e.passenger.kind] = { line: tpl.line, station: e.station };
  }
  if (o.cleared) {
    const prev = save.clear[tpl.id] || { stars: 0, perfect: false };
    save.clear[tpl.id] = { stars: Math.max(prev.stars, o.starCount), perfect: prev.perfect || o.perfect };
  }
  return save;
}
export function shareText(run, hide = true) {
  const o = run.outcome;
  const mark = (e) => (e.result.stars > 0 ? '★' : '✕');
  const row = run.log.map(mark).join('');
  const names = hide ? '' : '\n' + run.log.map((e) => `${KINDS[e.passenger.kind].name}→${e.station === null ? '終点まで' : STATIONS[e.station].name}`).join(' / ');
  return `「終電、あの世ゆき」${LINES[run.tpl.line].name} ${run.tpl.idx + 1}/5 ${run.tpl.name}\n運行${o.cleared ? '完了' : '失敗'} ${o.correct}/${o.total}人 星${o.stars} 未練${o.regret}\n${row}${names}`;
}
