// 切り離せ、最後の一隻：ルール（DOM を触らない ES module）
// 区画は木構造。C（艦橋）が根で、C から到達できる区画だけが「船」。
export const COMPS = ['C', 'H', 'E', 'L', 'G', 'P'];
export const NAMES = { C: '艦橋', H: '中央通路', E: '機関', L: '居住環', G: '温室', P: '脱出艇' };
export const PARENT = { H: 'C', E: 'H', L: 'H', G: 'H', P: 'C' }; // 接続 = 子区画の ID で呼ぶ（C–H は 'H'）
export const INITIAL = { C: 4, H: 0, E: 4, L: 18, G: 10, P: 0 };
export const TOTAL = 36;
export const EVAC = 8;
export const COOLANT = 1;

export const SCENARIOS = [
  { id: 1, name: '居住環炎上', pod: 18, incidents: [{ at: 'L', turns: 2 }, { at: 'G', turns: 2 }, { at: 'E', turns: 2 }], goal: '退避と切断を理解し、冷却剤の使いどころを決める' },
  { id: 2, name: '背骨の亀裂', pod: 26, incidents: [{ at: 'L', turns: 2 }, { at: 'H', turns: 3 }, { at: 'E', turns: 2 }], goal: '中央切断で機関・温室が同時に離れる' },
];
export const scenarioById = (id) => SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
export const edgeLabel = (child) => `${NAMES[PARENT[child]]}–${NAMES[child]}`;

const sum = (o) => COMPS.reduce((a, c) => a + o[c], 0);

export function newGame(scenarioId = 1) {
  const sc = scenarioById(scenarioId);
  return {
    scenario: sc.id,
    people: { ...INITIAL },
    cut: { H: false, E: false, L: false, G: false, P: false }, // 切断済みの接続（子区画 ID）
    incident: 0,
    turns: sc.incidents[0].turns,
    coolant: COOLANT,
    phase: 'play', // play | done
    skipped: [],   // 「対象区画切断済み」でスキップした事故の index
    resolved: [],  // 解消済みの事故 index
    cutLost: 0,
    log: [],       // [{type, ...}] 操作履歴
    lostComps: [], // 切り離された区画（順）
    result: null,
  };
}

/** C から到達できる区画（切断済みの接続は通れない） */
export function connected(s) {
  const set = new Set(['C']);
  let grew = true;
  while (grew) {
    grew = false;
    for (const child of Object.keys(PARENT)) {
      if (!set.has(child) && !s.cut[child] && set.has(PARENT[child])) { set.add(child); grew = true; }
    }
  }
  return set;
}
/** child の接続を切ったときに C から離れる区画（現在つながっているものだけ） */
export function severedBy(s, child) {
  if (!PARENT[child] || s.cut[child]) return [];
  const now = connected(s);
  if (!now.has(child)) return [];
  const next = connected({ ...s, cut: { ...s.cut, [child]: true } });
  return COMPS.filter((c) => now.has(c) && !next.has(c));
}
export const remaining = (s) => { const n = connected(s); return COMPS.filter((c) => n.has(c)).reduce((a, c) => a + s.people[c], 0); };
export const hasEngine = (s) => connected(s).has('E');
export const hasPod = (s) => connected(s).has('P');
export const currentIncident = (s) => (s.phase === 'play' ? scenarioById(s.scenario).incidents[s.incident] : null);
export const incidentsLeft = (s) => (s.phase === 'play' ? scenarioById(s.scenario).incidents.length - s.incident : 0);

/** 全事故解消後（または今の船体で）帰還できる人数 */
export function projectedReturn(s) {
  const left = remaining(s);
  if (hasEngine(s)) return left;
  if (hasPod(s)) return Math.min(left, scenarioById(s.scenario).pod);
  return 0;
}

/** 操作の事前確認（状態は変えない） */
export function preview(s, op) {
  const bad = (reason) => ({ valid: false, reason });
  if (s.phase !== 'play') return bad('終了後は操作できません');
  const inc = currentIncident(s);
  const conn = connected(s);
  const base = { valid: true, resolves: false, fatal: false, severed: [], severedPeople: 0, moved: 0 };
  if (op.type === 'evac') {
    const { from, to } = op;
    if (!conn.has(from) || !conn.has(to)) return bad('切り離された区画には移れません');
    const adj = (PARENT[from] === to && !s.cut[from]) || (PARENT[to] === from && !s.cut[to]);
    if (!adj) return bad('隣り合う接続中の区画だけに避難できます');
    if (s.people[from] <= 0) return bad('その区画は無人です');
    base.moved = Math.min(EVAC, s.people[from]);
  } else if (op.type === 'cut') {
    if (!PARENT[op.child]) return bad('そこは切断できません');
    if (s.cut[op.child]) return bad('すでに切断済みです');
    base.severed = severedBy(s, op.child);
    if (!base.severed.length) return bad('切り離された区画の接続は切れません');
    base.severedPeople = base.severed.reduce((a, c) => a + s.people[c], 0);
    base.resolves = base.severed.includes(inc.at);
  } else if (op.type === 'cool') {
    if (s.coolant <= 0) return bad('冷却剤は使用済みです');
    base.resolves = true;
  } else return bad('不明な操作');
  base.fatal = !base.resolves && s.turns <= 1;
  return base;
}

function finish(s) {
  const left = remaining(s);
  let returned; let means;
  if (hasEngine(s)) { returned = left; means = 'engine'; }
  else if (hasPod(s)) { returned = Math.min(left, scenarioById(s.scenario).pod); means = 'pod'; }
  else { returned = 0; means = 'none'; }
  return { ...s, phase: 'done', result: { outcome: 'return', means, returned, cutLost: s.cutLost, stranded: TOTAL - returned - s.cutLost } };
}
/** 解消した事故の次へ。切断済みの対象はスキップ（手数消費なし） */
function nextIncident(s) {
  const incs = scenarioById(s.scenario).incidents;
  let i = s.incident + 1;
  const skipped = [...s.skipped];
  while (i < incs.length && !connected(s).has(incs[i].at)) { skipped.push(i); i += 1; }
  if (i >= incs.length) return finish({ ...s, incident: i, skipped });
  return { ...s, incident: i, turns: incs[i].turns, skipped };
}

/** 操作の実行。{ ok, state, reason, info } */
export function apply(s, op) {
  const p = preview(s, op);
  if (!p.valid) return { ok: false, state: s, reason: p.reason };
  const inc = currentIncident(s);
  let n = { ...s, people: { ...s.people }, cut: { ...s.cut }, log: [...s.log], resolved: [...s.resolved], lostComps: [...s.lostComps] };
  if (op.type === 'evac') {
    n.people[op.from] -= p.moved; n.people[op.to] += p.moved;
    n.log.push({ type: 'evac', from: op.from, to: op.to, n: p.moved });
  } else if (op.type === 'cut') {
    n.cut[op.child] = true;
    for (const c of p.severed) { n.cutLost += n.people[c]; n.lostComps.push(c); }
    n.log.push({ type: 'cut', child: op.child, severed: p.severed, lost: p.severedPeople });
  } else {
    n.coolant -= 1;
    n.log.push({ type: 'cool', at: inc.at });
  }
  if (p.resolves) {
    n.resolved.push(s.incident);
    return { ok: true, state: nextIncident(n), info: { resolved: true } };
  }
  n.turns -= 1;
  if (n.turns <= 0) {
    return { ok: true, state: { ...n, phase: 'done', result: { outcome: 'lost', means: 'none', returned: 0, cutLost: n.cutLost, stranded: TOTAL - n.cutLost } }, info: { lost: true } };
  }
  return { ok: true, state: n, info: {} };
}

/** 保存・共有用の結果検証：帰還 + 切断で失った + 終幕の未帰還 = 36 */
export const checkTotal = (s) => !s.result || s.result.returned + s.result.cutLost + s.result.stranded === TOTAL;

// ---- 全行動列の列挙（検証用）----
export function legalOps(s) {
  const ops = [];
  const conn = connected(s);
  for (const child of Object.keys(PARENT)) {
    const par = PARENT[child];
    if (s.cut[child] || !conn.has(child)) continue;
    ops.push({ type: 'evac', from: child, to: par }, { type: 'evac', from: par, to: child }, { type: 'cut', child });
  }
  ops.push({ type: 'cool' });
  return ops.filter((o) => preview(s, o).valid);
}
const key = (s) => JSON.stringify([s.incident, s.turns, s.coolant, s.phase, s.people, s.cut, s.result && s.result.returned]);
export function explore(scenarioId) {
  const seen = new Map();
  const outcomes = new Set();
  let max = 0; let terminals = 0;
  const visit = (s) => {
    if (s.phase === 'done') { terminals += 1; outcomes.add(`${s.result.outcome}:${s.result.returned}`); max = Math.max(max, s.result.returned); return; }
    const k = key(s);
    if (seen.has(k)) return;
    seen.set(k, true);
    for (const op of legalOps(s)) visit(apply(s, op).state);
  };
  visit(newGame(scenarioId));
  return { max, outcomes: [...outcomes].sort(), states: seen.size, terminals };
}

// ---- 解放・ベスト（localStorage 用の純粋関数）----
export function emptyProgress() { return { unlocked: [1], best: {} }; }
export function sanitizeProgress(raw) {
  const p = emptyProgress();
  if (!raw || typeof raw !== 'object') return p;
  if (Array.isArray(raw.unlocked)) for (const id of raw.unlocked) if (SCENARIOS.some((s) => s.id === id) && !p.unlocked.includes(id)) p.unlocked.push(id);
  if (raw.best && typeof raw.best === 'object') {
    for (const sc of SCENARIOS) { const v = raw.best[sc.id]; if (Number.isInteger(v) && v >= 0 && v <= TOTAL) p.best[sc.id] = v; }
  }
  return p;
}
export const isUnlocked = (progress, id) => id === 1 || progress.unlocked.includes(id);
export const unlockCondition = (id) => (id === 2 ? 'シナリオ01で1人以上を帰還させると解放' : '');
/** 結果を反映。{ progress, newlyUnlocked, improved } */
export function recordResult(progress, state) {
  const p = sanitizeProgress({ unlocked: [...progress.unlocked], best: { ...progress.best } });
  const r = state.result;
  let newlyUnlocked = false; let improved = false;
  if (!r) return { progress: p, newlyUnlocked, improved };
  if (p.best[state.scenario] === undefined || r.returned > p.best[state.scenario]) { improved = p.best[state.scenario] !== undefined; p.best[state.scenario] = r.returned; }
  if (state.scenario === 1 && r.returned >= 1 && !p.unlocked.includes(2)) { p.unlocked.push(2); newlyUnlocked = true; }
  return { progress: p, newlyUnlocked, improved };
}

// ---- 共有文 ----
export function shareText(s) {
  const r = s.result;
  const title = '切り離せ、最後の一隻';
  if (!r) return title;
  if (r.outcome === 'lost') return `船喪失。帰還0人／乗員${TOTAL}人。${title}`;
  const cuts = s.lostComps.map((c) => NAMES[c]);
  const head = cuts.length ? `${cuts.join('と')}を切り離し、` : '切り離しなしで、';
  if (r.returned === 0) return `${head}帰還0人。${title}`;
  const by = r.means === 'engine' ? '機関で' : '脱出艇で';
  return `${head}${r.returned}人が${by}帰還。${title}`;
}
