// 自動プレイヤーの動作確認用の小さなゲーム（本物のゲームではない）。
// 1から始めて、8手で数字をちょうど目標にする。操作は +1 / +3 / ×2 / 何もしない。
// 「×2」が遊びの核。足し算だけ（naive）では大きな目標に届かない。
export const toyGame = {
  stages: [{ id: 0, name: '目標20' }, { id: 1, name: '目標27' }, { id: 2, name: '目標45' }],
  start(stage, seed) { return { n: 1, turn: 0, target: [20, 27, 45][stage.id], seed }; },
  actions() { return ['+1', '+3', 'x2', 'wait']; },
  idle() { return 'wait'; },
  key: (s) => `${s.n}|${s.turn}`,
  apply(s, a) { if (a === '+1') s.n += 1; else if (a === '+3') s.n += 3; else if (a === 'x2') s.n *= 2; s.turn += 1; },
  result(s) { if (s.n === s.target && s.turn <= 8) return 'win'; if (s.turn >= 8 || s.n > s.target) return 'lose'; return null; },
  score(s) { return Math.max(0, 1 - Math.abs(s.target - s.n) / s.target) * 0.8; },
  naive: { add: { name: '足し算だけ', allow: (s, a) => a !== 'x2' } },
  levels: { beginner: 20, expert: 400 },
  rolloutDepth: 8,
};
