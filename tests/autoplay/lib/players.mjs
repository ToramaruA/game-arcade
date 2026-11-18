// どのゲームでも使える自動プレイヤー（何もしない／でたらめ／MCTS）。
// ゲーム側は下の「標準の形」（game オブジェクト）を書くだけでよい。詳しくは tests/autoplay/README.md。
//
// game = {
//   stages: [{ id, name }],
//   start(stage, seed) -> state      // 乱数は state の中に持つ（rng の状態も state に入れる）
//   clone(state) -> state            // 省略時は structuredClone
//   actions(state) -> [action, ...]  // 今できる操作（「何もしない」も含める）
//   idle(state) -> action            // 何もしない操作
//   apply(state, action)             // 操作して、次に判断する時点まで進める（state を書き換える）
//   result(state) -> 'win' | 'lose' | null
//   score(state) -> 0..1             // 途中の有利さ（勝ちに近いほど 1）。先読みを打ち切ったときに使う
//   naive: { <id>: { name, allow(state, action) -> bool } }  // 遊びの核を使わない遊び方（操作を絞る）
//   levels: { beginner: 30, expert: 300 }  // MCTS の考える回数（省略可）
//   key(state) -> string             // 乱数のないパズル向け（省略可）。書くと全部の手を調べて、最短手数を正確に出す
//   rolloutDepth: 20, maxSteps: 5000       // 省略可
// }

export function rng(seed) {
  let x = (seed >>> 0) || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

const clone = (game, s) => (game.clone ? game.clone(s) : structuredClone(s));
const legal = (game, s, allow) => { const a = game.actions(s); return allow ? a.filter((x) => allow(s, x)) : a; };
const value = (game, s) => { const r = game.result(s); return r === 'win' ? 1 : r === 'lose' ? 0 : Math.max(0, Math.min(1, game.score(s))); };

// MCTS（UCT）で1手を選ぶ。iterations が多いほど強い（＝腕前）。
export function mctsChoose(game, state, { iterations = 100, rolloutDepth = game.rolloutDepth ?? 20, c = 1.2, R = Math.random, allow = null } = {}) {
  const root = { n: 0, w: 0, acts: null, kids: null };
  for (let it = 0; it < iterations; it++) {
    const s = clone(game, state);
    let node = root; const path = [root];
    while (!game.result(s)) {
      if (!node.acts) { node.acts = legal(game, s, allow); node.kids = node.acts.map(() => null); }
      if (!node.acts.length) break;
      const fresh = node.kids.map((k, i) => (k ? -1 : i)).filter((i) => i >= 0);
      if (fresh.length) {
        const i = fresh[Math.floor(R() * fresh.length)];
        game.apply(s, node.acts[i]);
        node = node.kids[i] = { n: 0, w: 0, acts: null, kids: null }; path.push(node);
        break;
      }
      let best = 0; let bv = -Infinity;
      node.kids.forEach((k, i) => { const v = k.w / k.n + c * Math.sqrt(Math.log(node.n) / k.n); if (v > bv) { bv = v; best = i; } });
      game.apply(s, node.acts[best]); node = node.kids[best]; path.push(node);
    }
    for (let d = 0; d < rolloutDepth && !game.result(s); d++) {
      const a = legal(game, s, allow); if (!a.length) break;
      game.apply(s, a[Math.floor(R() * a.length)]);
    }
    const v = value(game, s);
    for (const nd of path) { nd.n += 1; nd.w += v; }
  }
  if (!root.acts || !root.acts.length) return null;
  let best = 0;
  root.kids.forEach((k, i) => { if (k && k.n > (root.kids[best]?.n ?? -1)) best = i; });
  return root.acts[best];
}

// 1回遊ぶ。player = { type: 'noop' | 'random' | 'mcts', iterations, allow }
export function playGame(game, stage, player, seed) {
  const s = game.start(stage, seed);
  const R = rng(seed * 7919 + 17);
  const idleKey = (a) => JSON.stringify(a);
  let steps = 0; let moves = 0;
  while (!game.result(s) && steps < (game.maxSteps ?? 5000)) {
    let a = null;
    if (player.type === 'random') { const acts = legal(game, s, player.allow); a = acts.length ? acts[Math.floor(R() * acts.length)] : null; }
    else if (player.type === 'mcts') a = mctsChoose(game, s, { iterations: player.iterations, R, allow: player.allow });
    if (a == null) a = game.idle(s);
    if (idleKey(a) !== idleKey(game.idle(s))) moves += 1;
    game.apply(s, a); steps += 1;
  }
  return { win: game.result(s) === 'win', score: game.score(s), moves };
}

// 標準の形の game から、表を作るための戦法を組み立てる
export function fromGame(game) {
  const L = { beginner: 30, expert: 300, ...(game.levels || {}) };
  const strategies = [
    { id: 'noop', name: '何もしない', kind: 'noop', player: { type: 'noop' } },
    { id: 'random', name: 'でたらめ', kind: 'naive', player: { type: 'random' } },
  ];
  for (const [id, n] of Object.entries(game.naive || {})) strategies.push({ id: `naive-${id}`, name: `${n.name}（よく考える）`, kind: 'naive', player: { type: 'mcts', iterations: L.expert, allow: n.allow } });
  strategies.push({ id: 'beginner', name: '初心者（核を使う）', kind: 'core', level: 'beginner', player: { type: 'mcts', iterations: L.beginner } });
  strategies.push({ id: 'expert', name: '上級者（核を使う）', kind: 'core', level: 'expert', player: { type: 'mcts', iterations: L.expert } });
  return { stages: game.stages, strategies, play: (stage, sg, seed) => playGame(game, stage, sg.player, seed) };
}

// 乱数のないパズル向け：全部の手を幅優先で調べ、勝つまでの最短手数を返す（解けなければ null）。
// allow で操作を絞ると「核を使わないと解けるか」が正確に分かる。
export function exactSolve(game, stage, { allow = null, limit = 2_000_000 } = {}) {
  const s0 = game.start(stage, 1);
  const idle = JSON.stringify(game.idle(s0));
  const seen = new Set([game.key(s0)]);
  let frontier = [s0]; let depth = 0; let count = 0;
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      if (game.result(s) === 'win') return { steps: depth, explored: count };
      if (game.result(s)) continue;
      for (const a of legal(game, s, allow)) {
        if (JSON.stringify(a) === idle) continue;
        const t = clone(game, s); game.apply(t, a);
        const k = game.key(t);
        if (seen.has(k)) continue;
        seen.add(k); next.push(t);
        if (++count > limit) return { steps: null, explored: count, truncated: true };
      }
    }
    frontier = next; depth += 1;
  }
  return { steps: null, explored: count };
}
