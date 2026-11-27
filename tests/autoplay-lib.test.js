// 共通の自動プレイヤー（MCTS など）が動くことを、小さなゲームで確かめる
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playGame, fromGame, exactSolve } from './autoplay/lib/players.mjs';
import { toyGame } from './autoplay/lib/toy-game.mjs';
import { runTable, judge, checkPlayer } from '../scripts/autoplay.mjs';

test('同じ seed なら同じ結果', () => {
  const p = { type: 'mcts', iterations: 100 };
  const a = playGame(toyGame, toyGame.stages[1], p, 3); const b = playGame(toyGame, toyGame.stages[1], p, 3);
  assert.deepEqual(a, b);
});

test('考える回数が多いほど強い。核（×2）を使わないと大きな目標に届かない', () => {
  const mod = fromGame(toyGame);
  assert.deepEqual(checkPlayer(mod), []);
  const t = runTable(mod, { runs: 4 });
  const col = (id) => t.totals[mod.strategies.findIndex((s) => s.id === id)];
  const row = (si, id) => t.rows[si].wins[mod.strategies.findIndex((s) => s.id === id)];
  assert.equal(mod.strategies.some((s) => s.kind === 'noop'), false);
  assert.ok(col('expert') > col('beginner'), `上級 ${col('expert')} > 初心者 ${col('beginner')}`);
  assert.ok(col('expert') > col('random'));
  assert.equal(row(2, 'naive-add'), 0, '足し算だけでは目標45に届かない');
  assert.ok(row(2, 'expert') > 0, '上級者は目標45に届く');
  const lines = judge(mod, t).join('\n');
  assert.match(lines, /上達の余地/);
  assert.doesNotMatch(lines, /何もしない/);
});

test('放置の検証は明示的に指定した場合だけ実行・判定する', () => {
  const mod = fromGame({ ...toyGame, testNoop: true });
  assert.deepEqual(checkPlayer(mod), []);
  const noop = mod.strategies.find((s) => s.kind === 'noop');
  assert.ok(noop);
  assert.equal(mod.play(mod.stages[0], noop, 1).win, false);
  const wins = mod.strategies.map((s) => s.kind === 'noop' ? 1 : 0);
  const t = { stages: [mod.stages[0]], rows: [{ stage: mod.stages[0], wins }], totals: wins, runs: 1, avgMoves: wins.map(() => null) };
  assert.match(judge(mod, t).join('\n'), /NG 何もしないで勝てる面がある/);
  const zeros = wins.map(() => 0);
  assert.match(judge(mod, { ...t, rows: [{ stage: mod.stages[0], wins: zeros }], totals: zeros }).join('\n'), /OK 何もしないで勝てる面はない/);
});

test('乱数のないパズル向け：全部の手を調べて最短手数を出し、核を使わないと解けない面が分かる', () => {
  const big = toyGame.stages[2];
  const full = exactSolve(toyGame, big);
  assert.ok(full.steps != null && full.steps <= 8, `目標45は解ける（${full.steps}手）`);
  assert.equal(exactSolve(toyGame, big, { allow: toyGame.naive.add.allow }).steps, null, '足し算だけでは解けない');
});
