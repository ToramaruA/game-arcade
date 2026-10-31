import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOTAL, newGame, apply, preview, connected, severedBy, remaining, projectedReturn, explore, checkTotal, legalOps,
  emptyProgress, sanitizeProgress, isUnlocked, recordResult, shareText, tutorialStep,
} from '../../site/games/last-hull/logic.js';

const run = (s, ...ops) => ops.reduce((st, op) => { const r = apply(st, op); assert.ok(r.ok, `rejected: ${r.reason}`); return r.state; }, s);
const ev = (from, to) => ({ type: 'evac', from, to });
const cut = (child) => ({ type: 'cut', child });
const cool = { type: 'cool' };

test('初期状態：合計36人、機関・艇あり、最初の事故は居住環', () => {
  const s = newGame(1);
  assert.equal(remaining(s), TOTAL);
  assert.equal(s.turns, 2);
  assert.equal(s.coolant, 1);
  assert.equal(projectedReturn(s), 36);
});

test('避難は min(8, n) 人で1手を使う', () => {
  let s = run(newGame(1), ev('L', 'H'));
  assert.equal(s.people.L, 10); assert.equal(s.people.H, 8); assert.equal(s.turns, 1);
  s = newGame(1); s.people.H = 3;
  s = run(s, ev('H', 'C'));
  assert.equal(s.people.C, 7); assert.equal(s.people.H, 0);
});

test('中央切断：C から到達できなくなる全区画と人数を失う', () => {
  const s = newGame(2);
  assert.deepEqual(severedBy(s, 'H').sort(), ['E', 'G', 'H', 'L']);
  const p = preview(s, cut('H'));
  assert.equal(p.severedPeople, 32);
  const t = run(s, cut('H'));
  assert.deepEqual([...connected(t)].sort(), ['C', 'P']);
  assert.equal(t.cutLost, 32);
});

test('最終手の切断・冷却は間に合う（解消が猶予0より優先）', () => {
  const s = run(newGame(1), ev('L', 'H'), cut('L'));
  assert.equal(s.incident, 1); assert.equal(s.turns, 2);
  const c = run(newGame(1), ev('L', 'H'), cool);
  assert.equal(c.incident, 1);
});

test('冷却剤は1回。使用済みは無効で手数不変', () => {
  const s = run(newGame(1), cool);
  assert.equal(s.coolant, 0);
  const r = apply(s, cool);
  assert.equal(r.ok, false); assert.equal(r.state.turns, s.turns);
});

test('対象区画が切断済みなら事故を消費なしでスキップ', () => {
  const s = run(newGame(2), cool, ev('L', 'H'), cut('L'));
  assert.equal(s.phase, 'play');
  // 02 では L:冷却 → H:... 別経路：H を切るとEの事故はスキップ
  const t = run(newGame(2), cool, ev('L', 'H'), ev('H', 'C'), cut('H'));
  assert.equal(t.phase, 'done');
  assert.deepEqual(t.skipped, [2]);
  assert.equal(t.result.returned, 12); assert.equal(t.result.means, 'pod');
});

test('無効操作：空区画・切断済み接続・終了後は手数不変', () => {
  const s = newGame(1);
  for (const op of [ev('H', 'C'), ev('L', 'E'), cut('C')]) { const r = apply(s, op); assert.equal(r.ok, false); assert.equal(r.state, s); }
  const done = run(newGame(1), ev('L', 'H'), cut('L'), ev('G', 'H'), cut('G'), cool);
  assert.equal(done.phase, 'done');
  assert.equal(apply(done, ev('H', 'C')).ok, false);
  const c = run(newGame(1), ev('L', 'H'), cut('L'));
  assert.equal(apply(c, cut('L')).ok, false);
  assert.equal(apply(c, ev('L', 'H')).ok, false);
});

test('猶予0で火元が残ると船喪失（帰還0人・全項目の合計が36）', () => {
  const s = run(newGame(1), ev('L', 'H'), ev('H', 'C'));
  assert.equal(s.phase, 'done');
  assert.equal(s.result.outcome, 'lost'); assert.equal(s.result.returned, 0);
  assert.equal(s.result.stranded, 36);
  assert.ok(checkTotal(s));
  assert.equal(preview(run(newGame(1), ev('L', 'H')), ev('H', 'C')).fatal, true);
});

test('標準シナリオ：機関が残れば接続中の24人が帰還', () => {
  const s = run(newGame(1), ev('L', 'H'), cut('L'), ev('G', 'H'), cut('G'), cool);
  assert.equal(s.result.returned, 24); assert.equal(s.result.means, 'engine');
  assert.equal(s.result.cutLost, 12); assert.equal(s.result.stranded, 0);
  assert.ok(checkTotal(s));
  assert.equal(shareText(s), '居住環と温室を切り離し、24人が機関で帰還。切り離せ、最後の一隻');
});

test('機関を失うと艇の定員まで（超過は取り残し）', () => {
  const s = run(newGame(2), ev('L', 'H'), cut('L'), cool, ev('E', 'H'), cut('E'));
  assert.equal(s.result.returned, 26); assert.equal(s.result.means, 'pod'); assert.equal(s.result.stranded, 0);
  const t = run(newGame(1), cool, ev('G', 'H'), cut('G'), ev('E', 'H'), cut('E'));
  assert.equal(t.result.means, 'pod'); assert.equal(t.result.returned, 18);
  assert.ok(t.result.stranded > 0); assert.ok(checkTotal(t));
});

test('艇も機関も失えば帰還0人', () => {
  const s = run(newGame(2), cut('P'), cool, ev('L', 'H'), ev('H', 'C'), cut('H'));
  assert.equal(s.result.outcome, 'return');
  assert.equal(s.result.means, 'none'); assert.equal(s.result.returned, 0); assert.ok(checkTotal(s));
});

test('全行動列の列挙：到達可能な最大帰還は 01=24, 02=26 で、常に合計36', () => {
  assert.equal(explore(1).max, 24);
  assert.equal(explore(2).max, 26);
  assert.ok(explore(1).outcomes.includes('lost:0'));
  const walk = (s, depth) => {
    if (s.phase === 'done') { assert.ok(checkTotal(s)); return; }
    if (depth > 6) return;
    for (const op of legalOps(s)) walk(apply(s, op).state, depth + 1);
  };
  walk(newGame(1), 0); walk(newGame(2), 0);
});

test('再挑戦：新しい状態は人数・冷却剤・事故が初期化される', () => {
  const s = newGame(1);
  assert.deepEqual(newGame(1), s);
  assert.equal(newGame(1).coolant, 1);
});

test('解放：01で1人以上帰還で02が解放。ベストも保存', () => {
  let p = emptyProgress();
  assert.equal(isUnlocked(p, 2), false);
  const s = run(newGame(1), ev('L', 'H'), cut('L'), ev('G', 'H'), cut('G'), cool);
  const r = recordResult(p, s);
  assert.ok(r.newlyUnlocked); assert.equal(isUnlocked(r.progress, 2), true); assert.equal(r.progress.best[1], 24);
  const lost = run(newGame(1), ev('L', 'H'), ev('H', 'C'));
  assert.equal(recordResult(emptyProgress(), lost).newlyUnlocked, false);
  assert.deepEqual(sanitizeProgress('x'), emptyProgress());
  assert.deepEqual(sanitizeProgress({ unlocked: [9, 2], best: { 1: 99, 2: 5 } }), { unlocked: [1, 2], best: { 2: 5 } });
});

test('共有文：船喪失は必ず「帰還0人」', () => {
  const s = run(newGame(1), ev('L', 'H'), ev('H', 'C'));
  assert.match(shareText(s), /帰還0人/);
});

test('手引き：最初の事故だけ、選ぶ→動かす→切り離すの順に案内して消える', () => {
  const s0 = newGame(1);
  assert.equal(tutorialStep(s0, null), 'pick');
  assert.equal(tutorialStep(s0, 'L'), 'act');
  assert.equal(tutorialStep(s0, 'C'), 'pick');
  const s1 = run(s0, ev('L', 'H'));
  assert.equal(tutorialStep(s1, 'H'), 'cut');
  const s2 = run(s1, cut('L'));
  assert.equal(tutorialStep(s2, null), null);
  assert.equal(tutorialStep(run(s0, cool), null), null);
  assert.equal(tutorialStep(run(s0, ev('L', 'H'), ev('H', 'C')), null), null);
});
