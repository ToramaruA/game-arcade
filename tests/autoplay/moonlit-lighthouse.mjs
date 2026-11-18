// 月下の灯台と影の大行進の自動プレイヤー（本編18夜）。
// 実際の手は site/games/moonlit-lighthouse/dev/solve.mjs の自動プレイ（波の予告を見て塔を置く・合図・灯守）を使う。
import { NIGHTS } from '../../site/games/moonlit-lighthouse/levels.js';
import { createNight, step, startWave, keepersAvailable } from '../../site/games/moonlit-lighthouse/logic.js';
import { attemptExport, setVariant } from '../../site/games/moonlit-lighthouse/dev/solve.mjs';

export const stages = NIGHTS.map((n, i) => ({ id: i, name: `第${i + 1}夜` }));

export const strategies = [
  { id: 'noop', name: '何もしない', kind: 'noop' },
  { id: 'redOnly', name: '赤だけ並べる', kind: 'naive' },
  { id: 'noSignal', name: '色を混ぜる（合図なし）', kind: 'naive' },
  { id: 'full', name: '色を混ぜて合図', kind: 'core' },
];

export function play(stage, strategy, seed) {
  const n = stage.id;
  if (strategy.id === 'noop') {
    const s = createNight(n);
    while (!s.result && s.frame < 60 * 60 * 30) { if (!s.inWave) startWave(s); step(s); s.fx.length = 0; }
    return { win: s.result === 'win', score: s.hp };
  }
  setVariant(strategy.id === 'full' ? null : strategy.id);
  try {
    const { s } = attemptExport(n, 'normal', seed, keepersAvailable(n).at(-1));
    return { win: s.result === 'win', score: s.hp };
  } finally { setVariant(null); }
}
