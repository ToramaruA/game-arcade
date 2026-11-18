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

test('考える回数が多いほど強い。何もしないでは勝てず、核（×2）を使わないと大きな目標に届かない', () => {
  const mod = fromGame(toyGame);
  assert.deepEqual(checkPlayer(mod), []);
  const t = runTable(mod, { runs: 4 });
  const col = (id) => t.totals[mod.strategies.findIndex((s) => s.id === id)];
  const row = (si, id) => t.rows[si].wins[mod.strategies.findIndex((s) => s.id === id)];
  assert.equal(col('noop'), 0);
  assert.ok(col('expert') > col('beginner'), `上級 ${col('expert')} > 初心者 ${col('beginner')}`);
  assert.ok(col('expert') > col('random'));
  assert.equal(row(2, 'naive-add'), 0, '足し算だけでは目標45に届かない');
  assert.ok(row(2, 'expert') > 0, '上級者は目標45に届く');
  const lines = judge(mod, t).join('\n');
  assert.match(lines, /上達の余地/);
});

test('乱数のないパズル向け：全部の手を調べて最短手数を出し、核を使わないと解けない面が分かる', () => {
  const big = toyGame.stages[2];
  const full = exactSolve(toyGame, big);
  assert.ok(full.steps != null && full.steps <= 8, `目標45は解ける（${full.steps}手）`);
  assert.equal(exactSolve(toyGame, big, { allow: toyGame.naive.add.allow }).steps, null, '足し算だけでは解けない');
});
