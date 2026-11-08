// 開発用ソルバ：角度と呼び戻し時刻を探索し、撃破・規定球数・全破壊のリプレイを作る。
import { createBattle, cloneBattle, fire, recall, canRecall, step, breakableIds, FIXED_DT } from './logic.js';

const key = (b) => JSON.stringify([b.hp, Object.keys(b.gone).sort()]);

export function outcomes(b0, { angleMin = -75, angleMax = 75, angleStep = 1.5, recallStep = 0.2 } = {}) {
  const res = [];
  for (let a = angleMin; a <= angleMax + 1e-9; a += angleStep) {
    const angle = Math.round(a * 100) / 100;
    const b = cloneBattle(b0);
    if (!fire(b, angle)) continue;
    let nextSnap = 0.4;
    let guard = 0;
    while (b.status === 'fly' && guard++ < 3000) {
      if (b.shot.mode === 'out' && b.shot.t + 1e-9 >= nextSnap) {
        nextSnap += recallStep;
        if (canRecall(b)) {
          const c = cloneBattle(b);
          recall(c);
          const t = c.shot.recallT;
          let g2 = 0;
          while (c.status === 'fly' && g2++ < 3000) step(c);
          res.push({ angle, recall: Math.round(t * 1000) / 1000, b: c });
        }
      }
      step(b);
    }
    res.push({ angle, recall: null, b });
  }
  return res;
}

export function solve(level, opts = {}) {
  const start = createBattle(level);
  const need = breakableIds(level);
  let frontier = [{ b: start, path: [] }];
  const seen = new Set([key(start)]);
  const best = { clear: null, perfect: null, clearNoRecall: null, parOk: null };
  const seenNR = new Set([key(start)]);
  let frontNR = [{ b: start, path: [] }];
  for (let depth = 1; depth <= level.ammo; depth++) {
    const next = [];
    for (const node of frontier) {
      for (const o of outcomes(node.b, opts)) {
        const path = [...node.path, { angle: o.angle, recall: o.recall }];
        if (o.b.status === 'won') {
          const perfect = need.every((id) => o.b.gone[id]);
          if (!best.clear) best.clear = { shots: depth, path };
          if (perfect && !best.perfect) best.perfect = { shots: depth, path };
          continue;
        }
        if (o.b.status !== 'aim') continue;
        const k = key(o.b);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ b: o.b, path });
      }
    }
    frontier = next;
    // 呼び戻しなしだけの探索
    if (!best.clearNoRecall) {
      const nn = [];
      for (const node of frontNR) {
        for (const o of outcomes(node.b, { ...opts, recallStep: 99 })) {
          if (o.recall !== null) continue;
          const path = [...node.path, { angle: o.angle, recall: null }];
          if (o.b.status === 'won') { if (!best.clearNoRecall) best.clearNoRecall = { shots: depth, path }; continue; }
          if (o.b.status !== 'aim') continue;
          const k = key(o.b);
          if (seenNR.has(k)) continue;
          seenNR.add(k); nn.push({ b: o.b, path });
        }
      }
      frontNR = nn;
    }
    if (best.clear && best.perfect && best.clearNoRecall) break;
    if (!next.length) break;
  }
  return { ...best, states: seen.size };
}

// 呼び戻し時刻の連続有効区間（同じ結果になる時刻の幅）を 0.01 秒刻みで測る
export function recallWindow(level, prefix, shot) {
  // prefix: それまでのリプレイ。shot: { angle, recall }
  const keyOf = (b) => JSON.stringify([b.hp, Object.keys(b.gone).sort(), b.status]);
  const b0 = createBattle(level);
  for (const sh of prefix) replayShot(b0, sh);
  const target = (() => { const c = cloneBattle(b0); replayShot(c, shot); return keyOf(c); })();
  const okAt = (t) => { const c = cloneBattle(b0); replayShot(c, { angle: shot.angle, recall: t }); return keyOf(c) === target; };
  let lo = shot.recall; let hi = shot.recall;
  while (okAt(lo - 0.01) && shot.recall - lo < 1) lo -= 0.01;
  while (okAt(hi + 0.01) && hi - shot.recall < 1) hi += 0.01;
  return Math.round((hi - lo) * 100) / 100;
}

export function replayShot(b, sh) {
  fire(b, sh.angle);
  let rec = false; let g = 0;
  while (b.status === 'fly' && g++ < 100000) {
    if (!rec && sh.recall != null && b.shot.t + 1e-9 >= sh.recall) { if (canRecall(b)) recall(b); rec = true; }
    step(b);
  }
}
