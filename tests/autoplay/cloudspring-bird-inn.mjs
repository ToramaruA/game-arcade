// 雲海温泉と渡り鳥の宿の自動プレイヤー（標準の形。共通の MCTS が遊ぶ）。
// 判断の区切り：準備中は1操作ずつ（最大 PREP_MAX 回、その後は開店）。営業中は STEP 秒ごと。
import {
  DAYS, createState, cloneState, tick, applyEdit, checkEdit, baths, summary, TUNE,
  DIR_LIST, FACILITIES, isEntrance, itemAt, satOf,
} from '../../site/games/cloudspring-bird-inn/logic.js';

const STEP = 4;
const PREP_MAX = 4;

// 準備中の操作は「意味のありそうな置き場所」に絞る（浴槽は給湯できるマス、風よけ・吸音垣は浴槽の隣）
function prepActions(s) {
  const acts = ['open'];
  const nearBath = (x, y) => baths(s).some((b) => Math.abs(b.x - x) + Math.abs(b.y - y) === 1);
  const nearNet = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    const nx = x + dx; const ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < s.W && ny < s.H && (s.pipes[ny][nx] || itemAt(s, nx, ny)?.type === 'source');
  });
  for (const it of s.items) {
    if (FACILITIES[it.type].fixed) continue;
    const bath = !!FACILITIES[it.type].bath;
    for (let y = 0; y < s.H; y++) {
      for (let x = 0; x < s.W; x++) {
        if (isEntrance(x, y) || itemAt(s, x, y)) continue;
        if (bath ? !nearNet(x, y) : !nearBath(x, y)) continue;
        const e = { op: 'move', id: it.id, x, y };
        if (checkEdit(s, e, { building: true }).ok) acts.push(e);
      }
    }
    if (it.type === 'windbreak') for (const d of DIR_LIST) if (d !== it.dir) acts.push({ op: 'rotate', id: it.id, dir: d });
  }
  return acts;
}

function liveActions(s) {
  const acts = ['wait'];
  for (const b of baths(s)) {
    for (const q of [b.q - 1, b.q + 1]) {
      const e = { op: 'valve', id: b.id, q };
      if (checkEdit(s, e).ok) acts.push(e);
    }
  }
  for (const it of s.items) if (it.type === 'windbreak') for (const d of DIR_LIST) if (d !== it.dir) acts.push({ op: 'rotate', id: it.id, dir: d });
  return acts;
}

function run(g, n) { for (let i = 0; i < n && g.s.phase !== 'done'; i++) tick(g.s); }

export const game = {
  stages: DAYS.map((d, i) => ({ id: i, name: `第${d.id}日 ${d.name}` })),
  start(stage) { return { s: createState(DAYS[stage.id].id), prep: 0 }; },
  clone: (g) => ({ s: cloneState(g.s), prep: g.prep }),
  actions(g) { return g.s.phase === 'prep' ? prepActions(g.s) : liveActions(g.s); },
  idle(g) { return g.s.phase === 'prep' ? 'open' : 'wait'; },
  apply(g, a) {
    if (g.s.phase === 'prep') {
      if (a === 'open' || g.prep >= PREP_MAX) { run(g, STEP); return; }
      applyEdit(g.s, a, { building: true }); g.prep += 1;
      if (g.prep >= PREP_MAX) run(g, STEP);
      return;
    }
    if (a !== 'wait') applyEdit(g.s, a);
    run(g, STEP);
  },
  result(g) { if (g.s.phase !== 'done') return null; return summary(g.s).cleared ? 'win' : 'lose'; },
  // 途中の有利さ：満足して帰った客＋入浴中の客の今の点の見込み
  score(g) {
    const s = g.s; const n = s.guests.length;
    let v = 0;
    for (const x of s.guests) {
      if (x.st === 'gone') v += (x.sat ?? 0) >= TUNE.passLine ? 1 : 0;
      else if (x.st === 'bath' && x.bathT) v += satOf(s, x) >= TUNE.passLine ? 0.8 : 0.2;
      else if (x.st === 'pending' || x.st === 'walk') v += 0.4;
    }
    const need = Math.ceil(n * TUNE.clearRate);
    return Math.min(0.95, 0.8 * v / Math.max(need, 1));
  },
  naive: {
    valveOnly: { name: '温度だけ合わせる（弁だけ）', allow: (g, a) => a === 'open' || a === 'wait' || a.op === 'valve' },
    noLayout: { name: '配置を変えない（弁と風よけの向き）', allow: (g, a) => a === 'open' || a === 'wait' || a.op === 'valve' || a.op === 'rotate' },
  },
  levels: { beginner: 40, expert: 300 },
  rolloutDepth: 20,
};
