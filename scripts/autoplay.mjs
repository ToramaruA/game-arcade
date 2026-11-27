// ゲームごとの自動プレイヤー（tests/autoplay/<slug>.mjs）を動かし、戦法ごとの勝ち数を表にする。
// 使い方: npm run autoplay -- <slug> [--runs 8] [--stages 1,2,3] [--md]
//   --runs   各面・各戦法を何回遊ぶか（seed 1..N）
//   --stages 表に入れる面を番号（1始まり）で絞る
//   --md     PR にそのまま貼れる Markdown の表で出す
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// tests/autoplay/<slug>.mjs を読む。標準の形（export const game）なら共通の自動プレイヤーで戦法を組み立てる
export async function loadPlayer(file) {
  const mod = await import(pathToFileURL(file).href);
  if (mod.game) { const { fromGame } = await import(pathToFileURL(path.join(ROOT, 'tests', 'autoplay', 'lib', 'players.mjs')).href); return { ...fromGame(mod.game), game: mod.game }; }
  return mod;
}

export function checkPlayer(mod) {
  const errs = [];
  if (!Array.isArray(mod.stages) || !mod.stages.length) errs.push('stages（面の一覧）がない');
  if (!Array.isArray(mod.strategies) || !mod.strategies.length) errs.push('strategies（戦法の一覧）がない');
  if (typeof mod.play !== 'function') errs.push('play(stage, strategy, seed) がない');
  for (const k of ['naive', 'core']) {
    if (!(mod.strategies || []).some((s) => s.kind === k)) errs.push(`kind: '${k}' の戦法がない`);
  }
  for (const s of mod.strategies || []) if (!['noop', 'naive', 'core'].includes(s.kind)) errs.push(`戦法 ${s.id} の kind が noop/naive/core のどれでもない`);
  return errs;
}

export function runTable(mod, { runs = 8, stageFilter = null } = {}) {
  const stages = stageFilter ? mod.stages.filter((_, i) => stageFilter.includes(i + 1)) : mod.stages;
  const moves = mod.strategies.map(() => []);
  const rows = stages.map((st) => ({ stage: st, wins: mod.strategies.map((sg, j) => {
    let w = 0;
    for (let seed = 1; seed <= runs; seed++) { const r = mod.play(st, sg, seed); if (r.win) w += 1; if (typeof r.moves === 'number') moves[j].push(r.moves); }
    return w;
  }) }));
  const totals = mod.strategies.map((_, j) => rows.reduce((a, r) => a + r.wins[j], 0));
  const avgMoves = moves.map((m) => (m.length ? m.reduce((a, b) => a + b, 0) / m.length : null));
  return { stages, rows, totals, runs, avgMoves };
}

export function judge(mod, t) {
  const out = [];
  const max = t.stages.length * t.runs;
  const idx = (k) => mod.strategies.map((s, j) => (s.kind === k ? j : -1)).filter((j) => j >= 0);
  if (idx('noop').length) {
    const noopWins = t.rows.filter((r) => idx('noop').some((j) => r.wins[j] > 0)).map((r) => r.stage.name);
    out.push(noopWins.length ? `NG 何もしないで勝てる面がある：${noopWins.join('、')}` : 'OK 何もしないで勝てる面はない');
  }
  for (const j of idx('naive')) {
    const rate = t.totals[j] / max;
    out.push(rate >= 0.75 ? `NG 「${mod.strategies[j].name}」だけで ${Math.round(rate * 100)}% 勝てる（考える意味が薄い）` : `OK 「${mod.strategies[j].name}」だけでは ${Math.round(rate * 100)}%`);
  }
  const bestCore = Math.max(...idx('core').map((j) => t.totals[j]));
  const bestNaive = Math.max(...idx('naive').map((j) => t.totals[j]));
  out.push(bestCore > bestNaive ? `OK 遊びの核を使うほど勝てる（core ${bestCore} > naive ${bestNaive}）` : `NG 遊びの核を使っても勝ちやすくならない（core ${bestCore} ≦ naive ${bestNaive}）`);
  const lv = (l) => mod.strategies.findIndex((s) => s.level === l);
  const b = lv('beginner'); const e = lv('expert');
  // 最初の面：初心者がいれば初心者で、いなければ core の一番強いもので見る
  const firstIdx = b >= 0 ? b : idx('core').reduce((a, j) => (t.totals[j] > t.totals[a] ? j : a), idx('core')[0]);
  const first = t.rows[0].wins[firstIdx];
  out.push(first >= Math.ceil(t.runs * 0.5) ? `OK 最初の面は「${mod.strategies[firstIdx].name}」で ${first}/${t.runs} 勝てる` : `NG 最初の面が「${mod.strategies[firstIdx].name}」で ${first}/${t.runs} しか勝てない（入り口が難しすぎる）`);
  if (b >= 0 && e >= 0) {
    out.push(t.totals[e] > t.totals[b] ? `OK 上達の余地がある（上級者 ${t.totals[e]} > 初心者 ${t.totals[b]}。よく考えるほど勝てる）` : `NG 上達の余地が小さい（上級者 ${t.totals[e]} ≦ 初心者 ${t.totals[b]}。考えても勝ちやすさが変わらない＝運任せか単純すぎる）`);
    const hard = t.rows.slice(-Math.max(1, Math.floor(t.rows.length / 3)));
    const hardRate = hard.reduce((a, r) => a + r.wins[e], 0) / (hard.length * t.runs);
    out.push(hardRate < 1 ? `OK 後半の面は上級者でも ${Math.round(hardRate * 100)}%（手応えが残る）` : 'NG 後半の面も上級者が全勝（すぐ解けてしまう）');
    const m = t.avgMoves[e];
    if (m != null) out.push(m >= 5 ? `OK 1回あたりの操作は上級者で平均 ${m.toFixed(1)} 回` : `注意 1回あたりの操作が上級者でも平均 ${m.toFixed(1)} 回（眺めている時間が長いかもしれない）`);
  }
  return out;
}

// 乱数のないパズル（game.key がある）：全部の手を調べて、核を使わない遊び方でも解けるか・何手かかるかを出す
export async function exactTable(game, stageFilter = null) {
  const { exactSolve } = await import(pathToFileURL(path.join(ROOT, 'tests', 'autoplay', 'lib', 'players.mjs')).href);
  const stages = stageFilter ? game.stages.filter((_, i) => stageFilter.includes(i + 1)) : game.stages;
  const naive = Object.entries(game.naive || {});
  const rows = stages.map((st) => ({ stage: st, full: exactSolve(game, st).steps, naive: naive.map(([, n]) => exactSolve(game, st, { allow: n.allow }).steps) }));
  return { naive, rows };
}
export function formatExact(x, md) {
  const head = ['面', '最短（全部使う）', ...x.naive.map(([, n]) => `最短（${n.name}）`)];
  const cell = (v) => (v == null ? '解けない' : `${v}手`);
  const body = x.rows.map((r) => [r.stage.name, cell(r.full), ...r.naive.map(cell)]);
  const lines = [];
  const needs = x.naive.map((_, j) => x.rows.filter((r) => r.full != null && (r.naive[j] == null || r.naive[j] > r.full)).length);
  x.naive.forEach(([, n], j) => lines.push(`${needs[j] ? 'OK' : 'NG'} 「${n.name}」では解けない・遠回りになる面：${needs[j]}/${x.rows.length}${needs[j] ? '' : '（核を使わなくても全部同じ手数で解ける）'}`));
  const unsolved = x.rows.filter((r) => r.full == null).map((r) => r.stage.name);
  lines.unshift(unsolved.length ? `NG 解けない面がある：${unsolved.join('、')}` : 'OK 全部の面が解ける');
  if (md) return `${[head, head.map(() => '---'), ...body].map((r) => `| ${r.join(' | ')} |`).join('\n')}\n\n${lines.map((l) => `- ${l}`).join('\n')}`;
  const all = [head, ...body];
  const wid = head.map((_, j) => Math.max(...all.map((r) => String(r[j]).length)));
  return `${all.map((r) => r.map((c, j) => String(c).padEnd(wid[j])).join('  ')).join('\n')}\n\n${lines.join('\n')}`;
}

function format(mod, t, md) {
  const head = ['面', ...mod.strategies.map((s) => `${s.name}（${s.kind}）`)];
  const body = t.rows.map((r) => [r.stage.name, ...r.wins.map((w) => `${w}/${t.runs}`)]);
  const foot = ['合計', ...t.totals.map((w) => `${w}/${t.stages.length * t.runs}`)];
  if (md) return [head, head.map(() => '---'), ...body, foot].map((r) => `| ${r.join(' | ')} |`).join('\n');
  const all = [head, ...body, foot];
  const wid = head.map((_, j) => Math.max(...all.map((r) => String(r[j]).length)));
  return all.map((r) => r.map((c, j) => String(c).padEnd(wid[j])).join('  ')).join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith('--'));
  const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : null; };
  if (!slug) { console.error('使い方: npm run autoplay -- <slug> [--runs 8] [--stages 1,2,3] [--md]'); process.exit(1); }
  const file = path.join(ROOT, 'tests', 'autoplay', `${slug}.mjs`);
  if (!fs.existsSync(file)) { console.error(`${path.relative(ROOT, file)} がない。tests/autoplay/README.md の形で作る`); process.exit(1); }
  const mod = await loadPlayer(file);
  const errs = checkPlayer(mod);
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  const runs = Number(opt('runs') || 8);
  const stageFilter = opt('stages') ? opt('stages').split(',').map(Number) : null;
  const t0 = Date.now();
  const t = runTable(mod, { runs, stageFilter });
  console.log(format(mod, t, args.includes('--md')));
  console.log('');
  if (mod.game?.key) console.log('（乱数のないパズルでは、MCTS は先の長い面が苦手で人より弱く出る。下の「全部の手を調べた結果」を優先して判断する）');
  for (const line of judge(mod, t)) console.log(args.includes('--md') ? `- ${line}` : line);
  console.log(`\n（${t.stages.length}面 × ${mod.strategies.length}戦法 × ${runs}回、${((Date.now() - t0) / 1000).toFixed(1)}秒）`);
  if (mod.game?.key) {
    console.log('\n■ 全部の手を調べた結果（乱数のないパズル向け。こちらの方が正確）\n');
    console.log(formatExact(await exactTable(mod.game, stageFilter), args.includes('--md')));
  }
}
