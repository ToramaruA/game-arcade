// ひなたの巨獣と小さな引越し屋の自動プレイヤー（標準の形。共通の MCTS が遊ぶ）。
// パズルなので「負け」はない。そこで、最短手数の2倍（＋6手）を使い切ったら「あきらめた＝負け」とする。
import { LEVELS, createState, cloneState, act, moves, deliveredCount, keyOf } from '../../site/games/sunlit-giant-movers/logic.js';
import { SOLUTIONS } from '../../site/games/sunlit-giant-movers/solutions.js';

const optimal = (i) => SOLUTIONS[i].clear.replace(/[0-9]/g, '').length;

export const game = {
  stages: LEVELS.map((l, i) => ({ id: i, name: `第${i + 1}面 ${l.name ?? ''}`.trim() })),
  start(stage) { return { i: stage.id, s: createState(LEVELS[stage.id]), steps: 0, limit: optimal(stage.id) * 2 + 6 }; },
  clone: (g) => ({ ...g, s: cloneState(g.s) }),
  key: (g) => keyOf(g.s),
  actions(g) { return [...moves(LEVELS[g.i], g.s).map((m) => ({ d: m.d, k: m.k, ev: m.r.ev.type })), 'wait']; },
  idle: () => 'wait',
  apply(g, a) {
    g.steps += 1;
    if (a === 'wait') return;
    const r = act(LEVELS[g.i], g.s, a.d, a.k);
    if (r.ok) g.s = r.state;
  },
  result(g) { return g.s.cleared ? 'win' : g.steps >= g.limit ? 'lose' : null; },
  // 途中の有利さ：届けた数と、乗せている数
  score(g) {
    const lv = LEVELS[g.i]; const n = lv.animals.length;
    return 0.1 + 0.6 * (deliveredCount(lv, g.s) / n) + 0.1 * (g.s.riders.length / n);
  },
  naive: {
    oneAtATime: { name: '1匹ずつしか乗せない', allow: (g, a) => a === 'wait' || a.ev !== 'board' || g.s.riders.length === 0 },
    noRelay: { name: '停留台に降ろさない', allow: (g, a) => a === 'wait' || a.ev !== 'drop' },
  },
  levels: { beginner: 40, expert: 400 },
  rolloutDepth: 25,
};
