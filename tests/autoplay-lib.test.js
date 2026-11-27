// 共通の自動プレイヤー（MCTS など）が動くことを、小さなゲームで確かめる
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playGame, fromGame, exactSolve, puzzleStats } from './autoplay/lib/players.mjs';
import { toyGame } from './autoplay/lib/toy-game.mjs';
import { runTable, judge, checkPlayer, clearlyMore, exactTable, exactJudge, loadPlayer } from '../scripts/autoplay.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

test('同じ seed なら同じ結果', () => {
  const p = { type: 'mcts', iterations: 100 };
  const a = playGame(toyGame, toyGame.stages[1], p, 3); const b = playGame(toyGame, toyGame.stages[1], p, 3);
  assert.deepEqual(a, b);
});

test('考える回数が多いほど強い。核（×2）を使わないと大きな目標に届かない', async () => {
  const mod = fromGame(toyGame);
  assert.deepEqual(checkPlayer(mod), []);
  const t = await runTable(mod, { runs: 4 });
  const col = (id) => t.totals[mod.strategies.findIndex((s) => s.id === id)];
  const row = (si, id) => t.rows[si].wins[mod.strategies.findIndex((s) => s.id === id)];
  assert.equal(mod.strategies.some((s) => s.kind === 'noop'), false);
  assert.ok(col('expert') > col('beginner'), `上級 ${col('expert')} > 初心者 ${col('beginner')}`);
  assert.ok(col('expert') > col('random'));
  assert.equal(row(2, 'naive-add'), 0, '足し算だけでは目標45に届かない');
  assert.ok(row(2, 'expert') > 0, '上級者は目標45に届く');
  const lines = judge(mod, t, { puzzle: false }).join('\n');
  assert.match(lines, /上達の余地/);
  // パズル（key がある）では、noop 以外の MCTS の判定は「参考」になり、OK/NG を出さない
  const puzzleLines = judge(mod, t, { puzzle: true });
  assert.ok(puzzleLines.filter((l) => !/何もしない|1回あたりの操作/.test(l)).every((l) => l.startsWith('参考 ')), puzzleLines.join('\n'));
});

test('勝ち数の差は、偶然の範囲なら「勝てる」とみなさない', () => {
  assert.equal(clearlyMore(5, 4, 6), false, '6回中 5 対 4 は偶然の範囲');
  assert.equal(clearlyMore(60, 20, 72), true, '72回中 60 対 20 ははっきりした差');
  assert.equal(clearlyMore(3, 3, 8), false);
  assert.equal(clearlyMore(8, 0, 8), true);
});

test('並列でも直列でも同じ表になる', async () => {
  const file = path.join(HERE, 'autoplay', 'lib', 'toy-game-player.mjs');
  const mod = await loadPlayer(file);
  const a = await runTable(mod, { runs: 2 });
  const b = await runTable(mod, { runs: 2, file, jobs: 2 });
  assert.deepEqual(a.rows.map((r) => r.wins), b.rows.map((r) => r.wins));
  const ea = await exactTable(mod); const eb = await exactTable(mod, { file, jobs: 2 });
  assert.deepEqual(ea.rows, eb.rows);
});

test('パズルの判定：核を使わなくても同じ手数で解ける面が多い・試作の面で核が要らないと NG', () => {
  const st = (steps) => ({ truncated: false, steps, deadRate: 0, randomRate: 0, traps: 0 });
  const row = (name, full, naive) => ({ stage: { name }, full, naive: [naive], stats: st(full) });
  const naive = [['x', { name: '核なし' }]];
  const bad = exactJudge({ naive, rows: [row('1', 5, 5), row('2', 6, 6), row('3', 7, 9), row('4', 8, 8)] }).join('\n');
  assert.match(bad, /NG 「核なし」では解けない・遠回りになる面が 1\/4 しかない/);
  assert.match(bad, /NG 試作の面（最初の2面）は、どれも核を使わずに/);
  const good = exactJudge({ naive, rows: [row('1', 5, 5), row('2', 6, null), row('3', 7, 9), row('4', 8, 8)] }).join('\n');
  assert.match(good, /OK 「核なし」では解けない・遠回りになる面：2\/4/);
  assert.match(good, /OK 試作の面（最初の2面）で核が要る：2/);
  const easy = exactJudge({ naive, rows: [row('1', 5, null), { ...row('2', 6, null), stats: { ...st(6), randomRate: 0.9 } }] }).join('\n');
  assert.match(easy, /NG 後半の面を、でたらめでも 90% 解ける/);
});

test('何もしない戦法は、指定しなければ入らず判定にも出ない', async () => {
  const mod = fromGame(toyGame);
  const t = await runTable(mod, { runs: 1 });
  const lines = judge(mod, t, { puzzle: false }).join('\n');
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
  // 難しさの目安：全探索と同じ最短手数で、詰む局面・でたらめで解ける割合・落とし穴を出す
  const s = puzzleStats(toyGame, big);
  assert.equal(s.steps, full.steps);
  assert.ok(s.deadRate > 0 && s.deadRate < 1, `詰む局面 ${s.deadRate}`);
  assert.ok(s.randomRate >= 0 && s.randomRate < 0.5, `でたらめで解ける ${s.randomRate}`);
  assert.ok(s.traps >= 1, `落とし穴 ${s.traps}`);
});
