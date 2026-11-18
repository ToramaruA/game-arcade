// ゲームごとの自動プレイヤー（tests/autoplay/<slug>.mjs）を動かし、戦法ごとの勝ち数を表にする。
// 使い方: npm run autoplay -- <slug> [--runs 8] [--stages 1,2,3] [--md]
//   --runs   各面・各戦法を何回遊ぶか（seed 1..N）
//   --stages 表に入れる面を番号（1始まり）で絞る
//   --md     PR にそのまま貼れる Markdown の表で出す
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function checkPlayer(mod) {
  const errs = [];
  if (!Array.isArray(mod.stages) || !mod.stages.length) errs.push('stages（面の一覧）がない');
  if (!Array.isArray(mod.strategies) || !mod.strategies.length) errs.push('strategies（戦法の一覧）がない');
  if (typeof mod.play !== 'function') errs.push('play(stage, strategy, seed) がない');
  for (const k of ['noop', 'naive', 'core']) {
    if (!(mod.strategies || []).some((s) => s.kind === k)) errs.push(`kind: '${k}' の戦法がない`);
  }
  for (const s of mod.strategies || []) if (!['noop', 'naive', 'core'].includes(s.kind)) errs.push(`戦法 ${s.id} の kind が noop/naive/core のどれでもない`);
  return errs;
}

export function runTable(mod, { runs = 8, stageFilter = null } = {}) {
  const stages = stageFilter ? mod.stages.filter((_, i) => stageFilter.includes(i + 1)) : mod.stages;
  const rows = stages.map((st) => ({ stage: st, wins: mod.strategies.map((sg) => {
    let w = 0;
    for (let seed = 1; seed <= runs; seed++) if (mod.play(st, sg, seed).win) w += 1;
    return w;
  }) }));
  const totals = mod.strategies.map((_, j) => rows.reduce((a, r) => a + r.wins[j], 0));
  return { stages, rows, totals, runs };
}

export function judge(mod, t) {
  const out = [];
  const max = t.stages.length * t.runs;
  const idx = (k) => mod.strategies.map((s, j) => (s.kind === k ? j : -1)).filter((j) => j >= 0);
  const noopWins = t.rows.filter((r) => idx('noop').some((j) => r.wins[j] > 0)).map((r) => r.stage.name);
  out.push(noopWins.length ? `NG 何もしないで勝てる面がある：${noopWins.join('、')}` : 'OK 何もしないで勝てる面はない');
  for (const j of idx('naive')) {
    const rate = t.totals[j] / max;
    out.push(rate >= 0.75 ? `NG 「${mod.strategies[j].name}」だけで ${Math.round(rate * 100)}% 勝てる（考える意味が薄い）` : `OK 「${mod.strategies[j].name}」だけでは ${Math.round(rate * 100)}%`);
  }
  const bestCore = Math.max(...idx('core').map((j) => t.totals[j]));
  const bestNaive = Math.max(...idx('naive').map((j) => t.totals[j]));
  out.push(bestCore > bestNaive ? `OK 遊びの核を使うほど勝てる（core ${bestCore} > naive ${bestNaive}）` : `NG 遊びの核を使っても勝ちやすくならない（core ${bestCore} ≦ naive ${bestNaive}）`);
  const coreFirst = Math.max(...idx('core').map((j) => t.rows[0].wins[j]));
  out.push(coreFirst >= Math.ceil(t.runs * 0.5) ? `OK 最初の面は core で ${coreFirst}/${t.runs} 勝てる` : `NG 最初の面が core でも ${coreFirst}/${t.runs} しか勝てない（入り口が難しすぎる）`);
  return out;
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
  const mod = await import(pathToFileURL(file).href);
  const errs = checkPlayer(mod);
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  const runs = Number(opt('runs') || 8);
  const stageFilter = opt('stages') ? opt('stages').split(',').map(Number) : null;
  const t0 = Date.now();
  const t = runTable(mod, { runs, stageFilter });
  console.log(format(mod, t, args.includes('--md')));
  console.log('');
  for (const line of judge(mod, t)) console.log(args.includes('--md') ? `- ${line}` : line);
  console.log(`\n（${t.stages.length}面 × ${mod.strategies.length}戦法 × ${runs}回、${((Date.now() - t0) / 1000).toFixed(1)}秒）`);
}
