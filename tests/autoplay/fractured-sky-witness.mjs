// 空が割れた日の証人（試作：第1章・第3章）の自動プレイヤー。
// 物語ゲームなので「勝ち」は、その章で証言の矛盾を立証できたか（証明を得たか）で数える。
// 結末の見通し（どの結末に手が届くか）は report() で別に集計する。
import { newGame, visit, advance, present, giveUp, choose, choiceOptions, siteList, testimonies, chapterEvidence, endingOutlook } from '../../site/games/fractured-sky-witness/logic.js';
import { EVIDENCE } from '../../site/games/fractured-sky-witness/story.js';
import { rng } from './lib/players.mjs';

export const stages = [{ id: 1, name: '第1章 風のない落下' }, { id: 3, name: '第3章 弟が作った鍵' }];

export const strategies = [
  { id: 'noop', name: '何もしない', kind: 'noop' },
  { id: 'random', name: 'でたらめに提示', kind: 'naive' },
  { id: 'first', name: '最初の2つを最初の証言へ', kind: 'naive' },
  { id: 'core', name: '証拠の線と証言を読む', kind: 'core' },
];

// 証言を読んで「何が分かれば崩せるか」を考えた結果（人が証言のヒントから読む内容）
const READS = { t1a: 'wind', t1b: 'inside', t3a: 'key', t3b: 'kin' };

function pickPresent(s, strategy, R) {
  const evs = chapterEvidence(s);
  const ts = testimonies(s);
  if (strategy === 'first') return [ts[0].id, evs[0], evs[1]];
  if (strategy === 'core') {
    for (const t of ts) {
      const m = evs.filter((e) => EVIDENCE[e].tag === READS[t.id]);
      if (m.length >= 2) return [t.id, m[0], m[1]];
    }
  }
  const a = evs[Math.floor(R() * evs.length)];
  const rest = evs.filter((e) => e !== a);
  return [ts[Math.floor(R() * ts.length)].id, a, rest[Math.floor(R() * rest.length)]];
}

// 1周（試作の終わりまで）遊ぶ。choicePlan: 章番号 -> 'P'|'Q'|'H'（なければ乱数）
export function run(strategy, seed, choicePlan = null) {
  const R = rng(seed * 2654435761 + 7);
  const s = newGame();
  let moves = 0;
  if (strategy === 'noop') return { s, moves };
  for (let guard = 0; guard < 200 && s.phase !== 'end'; guard++) {
    if (s.phase === 'intro' || s.phase === 'investigate') {
      const open = siteList(s).filter((x) => !x.visited && !x.locked);
      const site = s.ch === 1 && !s.visited.length ? 'plaza' : open[Math.floor(R() * open.length)].id;
      if (s.phase === 'intro' && !(s.ch === 1 && !s.visited.length)) advance(s);
      visit(s, site); moves += 1;
    } else if (s.phase === 'trial') {
      const [t, a, b] = pickPresent(s, strategy, R);
      present(s, t, a, b); moves += 1;
    } else if (s.phase === 'choice') {
      const opts = choiceOptions(s).filter((o) => o.allowed).map((o) => o.id);
      const want = choicePlan?.[s.ch];
      choose(s, want && opts.includes(want) ? want : opts[Math.floor(R() * opts.length)]); moves += 1;
    } else advance(s);
  }
  return { s, moves };
}

export function play(stage, strategy, seed) {
  const { s, moves } = run(strategy.id, seed);
  return { win: !!s.proofs[stage.id], moves, note: s.phase };
}

// 結末の見通しを集計（試作版の「1万周」）
export function report(n = 10000) {
  const plans = {
    'でたらめ（提示も選択も無作為）': ['random', null],
    '証拠を読む＋選択は無作為': ['core', null],
    '一律に公開(P)': ['core', { 1: 'P', 3: 'P' }],
    '一律に約束(Q)': ['core', { 1: 'Q', 3: 'Q' }],
    '一律に保留(H)': ['core', { 1: 'H', 3: 'H' }],
  };
  const out = {};
  for (const [name, [st, plan]] of Object.entries(plans)) {
    const c = { end: 0, proofs: 0 }; const reach = {};
    for (let i = 1; i <= n; i++) {
      const { s } = run(st, i, plan);
      if (s.phase === 'end') c.end += 1;
      c.proofs += Object.keys(s.proofs).length;
      for (const e of endingOutlook(s)) if (e.status === 'open' || e.status === 'near') reach[e.name] = (reach[e.name] || 0) + 1;
    }
    out[name] = { 終幕到達: c.end / n, 平均証明数: c.proofs / n, 手が届く結末: Object.fromEntries(Object.entries(reach).map(([k, v]) => [k, Math.round((v / n) * 1000) / 10])) };
  }
  return out;
}
