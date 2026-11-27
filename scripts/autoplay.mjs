// ゲームごとの自動プレイヤー（tests/autoplay/<slug>.mjs）を動かし、戦法ごとの勝ち数を表にする。
// 使い方: npm run autoplay -- <slug> [--runs 8] [--stages 1,2,3] [--jobs 4] [--md]
//   --runs   各面・各戦法を何回遊ぶか（seed 1..N）
//   --stages 表に入れる面を番号（1始まり）で絞る
//   --jobs   同時に動かす数（省略時は CPU の数）。1 なら並列にしない
//   --md     PR にそのまま貼れる Markdown の表で出す
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { Worker } from 'node:worker_threads';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIB = pathToFileURL(path.join(ROOT, 'tests', 'autoplay', 'lib', 'players.mjs')).href;

// 判定の基準（ここだけで調整する）
export const RULES = {
  naiveTooStrong: 0.75, // 核を使わない戦法の勝率がこれ以上なら NG
  firstStageWin: 0.5, // 最初の面は、初心者がこの割合以上勝てる
  z: 1.64, // 「勝ち数の差が偶然ではない」とみなす目安（片側 95%）
  minMoves: 5, // 上級者の1回あたりの操作数
  protoStages: 2, // 試作で作る面の数（最初の何面で核が要るかを見る）
  detourShare: 0.5, // パズル：核を使わないと解けない・遠回りになる面が、これ以上の割合であること
  randomTooEasy: 0.5, // パズル：後半の面を、でたらめでこの割合以上解けたら NG
  firstDeadRate: 0.5, // パズル：最初の面で詰む局面の割合がこれを超えたら注意
};

// tests/autoplay/<slug>.mjs を読む。標準の形（export const game）なら共通の自動プレイヤーで戦法を組み立てる
export async function loadPlayer(file) {
  const mod = await import(pathToFileURL(file).href);
  if (mod.game) { const { fromGame } = await import(LIB); return { ...fromGame(mod.game), game: mod.game }; }
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

// 1つの仕事（1回遊ぶ／パズルを全部調べる）。並列でも直列でも同じ結果になる
export async function doTask(mod, task) {
  const st = mod.stages[task.si];
  if (task.type === 'play') { const r = mod.play(st, mod.strategies[task.gi], task.seed); return { win: !!r.win, moves: typeof r.moves === 'number' ? r.moves : null }; }
  const lib = await import(LIB);
  if (task.type === 'exact') { const n = task.naive ? mod.game.naive[task.naive] : null; return lib.exactSolve(mod.game, st, { allow: n?.allow }).steps; }
  if (task.type === 'stats') return lib.puzzleStats(mod.game, st);
  throw new Error(`知らない仕事 ${task.type}`);
}

// 仕事の一覧を、jobs 個のワーカーで手分けして片づける（jobs<=1 ならこのまま順に）
export async function runTasks(mod, tasks, { file = null, jobs = 1 } = {}) {
  if (jobs <= 1 || !file || tasks.length < 2) { const out = []; for (const t of tasks) out.push(await doTask(mod, t)); return out; }
  const out = new Array(tasks.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(jobs, tasks.length) }, () => new Worker(new URL('./autoplay-worker.mjs', import.meta.url), { workerData: { file } }));
  await Promise.all(workers.map((w) => new Promise((resolve, reject) => {
    const feed = () => { if (next >= tasks.length) { w.terminate().then(resolve); return; } const id = next++; w.postMessage({ ...tasks[id], id }); };
    w.on('message', (m) => { out[m.id] = m.out; feed(); });
    w.on('error', reject);
    feed();
  })));
  return out;
}

const stageIndexes = (mod, stageFilter) => mod.stages.map((_, i) => i).filter((i) => !stageFilter || stageFilter.includes(i + 1));

export async function runTable(mod, { runs = 8, stageFilter = null, file = null, jobs = 1 } = {}) {
  const sis = stageIndexes(mod, stageFilter);
  const tasks = [];
  for (const si of sis) mod.strategies.forEach((_, gi) => { for (let seed = 1; seed <= runs; seed++) tasks.push({ type: 'play', si, gi, seed }); });
  const res = await runTasks(mod, tasks, { file, jobs });
  const moves = mod.strategies.map(() => []);
  const wins = new Map();
  tasks.forEach((t, k) => {
    const key = `${t.si}|${t.gi}`; wins.set(key, (wins.get(key) || 0) + (res[k].win ? 1 : 0));
    if (res[k].moves != null) moves[t.gi].push(res[k].moves);
  });
  const rows = sis.map((si) => ({ stage: mod.stages[si], wins: mod.strategies.map((_, gi) => wins.get(`${si}|${gi}`) || 0) }));
  const totals = mod.strategies.map((_, j) => rows.reduce((a, r) => a + r.wins[j], 0));
  const avgMoves = moves.map((m) => (m.length ? m.reduce((a, b) => a + b, 0) / m.length : null));
  return { stages: sis.map((si) => mod.stages[si]), rows, totals, runs, avgMoves };
}

// a/n と b/n の差が偶然ではないか（2つの割合の差の z 検定、片側）
export function clearlyMore(a, b, n, z = RULES.z) {
  if (a <= b) return false;
  const p = (a + b) / (2 * n);
  const se = Math.sqrt((p * (1 - p) * 2) / n);
  return se === 0 ? true : (a - b) / n / se >= z;
}

// MCTS の表の判定。puzzle（乱数のないパズル。全部の手を調べる判定がある）では、MCTS は人より弱く出るので
// noop 以外は「参考」として出し、OK/NG は exactJudge に任せる
export function judge(mod, t, { puzzle = !!mod.game?.key } = {}) {
  const out = [];
  const say = (ok, good, bad) => (puzzle ? `参考 ${ok ? good : bad}` : ok ? `OK ${good}` : `NG ${bad}`);
  const max = t.stages.length * t.runs;
  const idx = (k) => mod.strategies.map((s, j) => (s.kind === k ? j : -1)).filter((j) => j >= 0);
  if (idx('noop').length) {
    const noopWins = t.rows.filter((r) => idx('noop').some((j) => r.wins[j] > 0)).map((r) => r.stage.name);
    out.push(noopWins.length ? `NG 何もしないで勝てる面がある：${noopWins.join('、')}` : 'OK 何もしないで勝てる面はない');
  }
  for (const j of idx('naive')) {
    const rate = t.totals[j] / max;
    out.push(say(rate < RULES.naiveTooStrong, `「${mod.strategies[j].name}」だけでは ${Math.round(rate * 100)}%`, `「${mod.strategies[j].name}」だけで ${Math.round(rate * 100)}% 勝てる（考える意味が薄い）`));
  }
  const best = (k) => idx(k).reduce((a, j) => (t.totals[j] > t.totals[a] ? j : a), idx(k)[0]);
  const bc = best('core'); const bn = best('naive');
  const cw = t.totals[bc]; const nw = t.totals[bn];
  out.push(say(clearlyMore(cw, nw, max), `遊びの核を使うほど勝てる（core ${cw} > naive ${nw}、差は偶然ではない）`,
    cw > nw ? `核を使う方が勝つが、差が小さく偶然の範囲（core ${cw} > naive ${nw}）。--runs を増やして測り直す`
      : `遊びの核を使っても勝ちやすくならない（core ${cw} ≦ naive ${nw}）${mod.standard ? '。核を使わない戦法は操作が少ないぶん先読みが深く、有利に出やすい。levels.expert を増やしても同じか確かめる' : ''}`));
  // 試作の面（最初の数面）のどこかで、核が要ること
  const proto = t.rows.slice(0, RULES.protoStages);
  const protoNeed = proto.filter((r) => clearlyMore(Math.max(...idx('core').map((j) => r.wins[j])), Math.max(...idx('naive').map((j) => r.wins[j])), t.runs));
  if (t.rows.length) out.push(say(protoNeed.length > 0, `試作の面（最初の${proto.length}面）で核が要る：${protoNeed.map((r) => r.stage.name).join('、')}`, `試作の面（最初の${proto.length}面）では、核を使わなくても同じくらい勝てる（試作で核の面白さが伝わらない）`));
  const lv = (l) => mod.strategies.findIndex((s) => s.level === l);
  const b = lv('beginner'); const e = lv('expert');
  const firstIdx = b >= 0 ? b : bc;
  const first = t.rows[0].wins[firstIdx];
  out.push(say(first >= Math.ceil(t.runs * RULES.firstStageWin), `最初の面は「${mod.strategies[firstIdx].name}」で ${first}/${t.runs} 勝てる`, `最初の面が「${mod.strategies[firstIdx].name}」で ${first}/${t.runs} しか勝てない（入り口が難しすぎる）`));
  if (b >= 0 && e >= 0) {
    const eb = t.totals[e]; const bb = t.totals[b];
    out.push(say(clearlyMore(eb, bb, max), `上達の余地がある（上級者 ${eb} > 初心者 ${bb}。よく考えるほど勝てる）`,
      eb > bb ? `上級者の方が勝つが、差が小さく偶然の範囲（上級者 ${eb} > 初心者 ${bb}）。--runs を増やして測り直す`
        : `上達の余地が小さい（上級者 ${eb} ≦ 初心者 ${bb}。考えても勝ちやすさが変わらない＝運任せか単純すぎる）`));
    const hard = t.rows.slice(-Math.max(1, Math.floor(t.rows.length / 3)));
    const hardRate = hard.reduce((a, r) => a + r.wins[e], 0) / (hard.length * t.runs);
    out.push(say(hardRate < 1, `後半の面は上級者でも ${Math.round(hardRate * 100)}%（手応えが残る）`, '後半の面も上級者が全勝（すぐ解けてしまう）'));
    const m = t.avgMoves[e];
    if (m != null) out.push(m >= RULES.minMoves ? `OK 1回あたりの操作は上級者で平均 ${m.toFixed(1)} 回` : `注意 1回あたりの操作が上級者でも平均 ${m.toFixed(1)} 回（眺めている時間が長いかもしれない）`);
  }
  if (!mod.standard) {
    const cores = mod.strategies.filter((s) => s.kind === 'core').map((s) => `「${s.name}」`).join('');
    out.push(`注意 core の戦法${cores}は、このゲーム用に書いた戦法。作り手の想定した解き方しか測れないので、PR にそう書く（ほかの解き方で楽に勝てるかは、この表では分からない）`);
  }
  return out;
}

// 乱数のないパズル（game.key がある）：全部の手を調べて、核を使わない遊び方でも解けるか・何手かかるか・難しさの目安を出す
export async function exactTable(mod, { stageFilter = null, file = null, jobs = 1 } = {}) {
  const game = mod.game;
  const sis = stageIndexes(mod, stageFilter);
  const naive = Object.entries(game.naive || {});
  const tasks = [];
  for (const si of sis) {
    tasks.push({ type: 'exact', si, naive: null }, { type: 'stats', si });
    for (const [id] of naive) tasks.push({ type: 'exact', si, naive: id });
  }
  const res = await runTasks(mod, tasks, { file, jobs });
  const per = 2 + naive.length;
  const rows = sis.map((si, k) => ({ stage: mod.stages[si], full: res[k * per], stats: res[k * per + 1], naive: naive.map((_, j) => res[k * per + 2 + j]) }));
  return { naive, rows };
}

export function exactJudge(x) {
  const lines = [];
  const unsolved = x.rows.filter((r) => r.full == null).map((r) => r.stage.name);
  lines.push(unsolved.length ? `NG 解けない面がある：${unsolved.join('、')}` : 'OK 全部の面が解ける');
  const needs = (r, j) => r.full != null && (r.naive[j] == null || r.naive[j] > r.full);
  x.naive.forEach(([, n], j) => {
    const c = x.rows.filter((r) => needs(r, j)).length;
    const share = x.rows.length ? c / x.rows.length : 0;
    lines.push(share >= RULES.detourShare
      ? `OK 「${n.name}」では解けない・遠回りになる面：${c}/${x.rows.length}`
      : `NG 「${n.name}」では解けない・遠回りになる面が ${c}/${x.rows.length} しかない（残りの面では、その仕組みを使わなくても同じ手数で解ける。面を作り直すか、使わずに済む面を減らす）`);
  });
  const proto = x.rows.slice(0, RULES.protoStages);
  const protoNeed = proto.filter((r) => x.naive.some((_, j) => needs(r, j)));
  if (x.naive.length) {
    lines.push(protoNeed.length
      ? `OK 試作の面（最初の${proto.length}面）で核が要る：${protoNeed.map((r) => r.stage.name).join('、')}`
      : `NG 試作の面（最初の${proto.length}面）は、どれも核を使わずに同じ手数で解ける（試作で核の面白さが伝わらない）`);
  }
  const st = x.rows.map((r) => r.stats).filter((s) => s && !s.truncated && s.steps != null);
  if (x.rows.length && st.length) {
    const hard = x.rows.slice(-Math.max(1, Math.floor(x.rows.length / 3))).map((r) => r.stats).filter((s) => s && !s.truncated && s.steps != null);
    const hr = hard.length ? hard.reduce((a, s) => a + s.randomRate, 0) / hard.length : 0;
    lines.push(hr < RULES.randomTooEasy ? `OK 後半の面は、でたらめでは ${Math.round(hr * 100)}% しか解けない（手応えが残る）` : `NG 後半の面を、でたらめでも ${Math.round(hr * 100)}% 解ける（考えなくても解ける）`);
    const f = x.rows[0].stats;
    if (f && !f.truncated && f.steps != null && f.deadRate > RULES.firstDeadRate) lines.push(`注意 最初の面で、詰む局面が ${Math.round(f.deadRate * 100)}%（やり直しが多く、入り口でつまずくかもしれない）`);
  }
  const cut = x.rows.filter((r) => r.stats?.truncated).map((r) => r.stage.name);
  if (cut.length) lines.push(`注意 局面が多すぎて難しさを測れなかった面：${cut.join('、')}`);
  return lines;
}

export function formatExact(x, md) {
  const pct = (v) => `${Math.round(v * 100)}%`;
  const head = ['面', '最短（全部使う）', ...x.naive.map(([, n]) => `最短（${n.name}）`), '詰む局面', 'でたらめで解ける', '落とし穴'];
  const cell = (v) => (v == null ? '解けない' : `${v}手`);
  const stat = (s) => (!s || s.truncated || s.steps == null ? ['—', '—', '—'] : [pct(s.deadRate), pct(s.randomRate), `${s.traps}か所`]);
  const body = x.rows.map((r) => [r.stage.name, cell(r.full), ...r.naive.map(cell), ...stat(r.stats)]);
  const lines = exactJudge(x);
  const note = '詰む局面＝最短手数以内でたどり着く局面のうち、もう解けない割合／でたらめで解ける＝でたらめに動いて最短の3倍以内に解ける割合／落とし穴＝最短の道の上で、その一手で詰む手がある場面の数';
  if (md) return `${[head, head.map(() => '---'), ...body].map((r) => `| ${r.join(' | ')} |`).join('\n')}\n\n${note}\n\n${lines.map((l) => `- ${l}`).join('\n')}`;
  const all = [head, ...body];
  const wid = head.map((_, j) => Math.max(...all.map((r) => String(r[j]).length)));
  return `${all.map((r) => r.map((c, j) => String(c).padEnd(wid[j])).join('  ')).join('\n')}\n\n${note}\n\n${lines.join('\n')}`;
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
  const slug = args.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--runs', '--stages', '--jobs'].includes(args[i - 1])));
  const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : null; };
  if (!slug) { console.error('使い方: npm run autoplay -- <slug> [--runs 8] [--stages 1,2,3] [--jobs 4] [--md]'); process.exit(1); }
  const file = path.join(ROOT, 'tests', 'autoplay', `${slug}.mjs`);
  if (!fs.existsSync(file)) { console.error(`${path.relative(ROOT, file)} がない。tests/autoplay/README.md の形で作る`); process.exit(1); }
  const mod = await loadPlayer(file);
  const errs = checkPlayer(mod);
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  const md = args.includes('--md');
  const runs = Number(opt('runs') || 8);
  const jobs = Number(opt('jobs') || os.availableParallelism?.() || os.cpus().length);
  const stageFilter = opt('stages') ? opt('stages').split(',').map(Number) : null;
  const t0 = Date.now();
  const puzzle = !!mod.game?.key;
  if (puzzle) {
    console.log('■ 全部の手を調べた結果（乱数のないパズル。OK/NG はこちらで判断する）\n');
    console.log(formatExact(await exactTable(mod, { stageFilter, file, jobs }), md));
    console.log('\n■ 共通の自動プレイヤー（MCTS）の勝ち数（参考。パズルでは MCTS は先の長い面が苦手で、人より弱く出る）\n');
  }
  const t = await runTable(mod, { runs, stageFilter, file, jobs });
  console.log(format(mod, t, md));
  console.log('');
  for (const line of judge(mod, t)) console.log(md ? `- ${line}` : line);
  console.log(`\n（${t.stages.length}面 × ${mod.strategies.length}戦法 × ${runs}回、${jobs}並列、${((Date.now() - t0) / 1000).toFixed(1)}秒）`);
}
