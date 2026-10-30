// 画面に依存しないゲームのルール。Node のテストからも import できるよう DOM を触らない。
// 座標は原点中心の単位空間（図形は半径 1 の円に収まる）。

export const ROUNDS = 5;
export const MIN_CUT_LENGTH = 0.04;
const EPS = 1e-9;

export function polygonArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

// p→q を通る直線（両方向に無限に延長）で凸多角形を2つに分ける。
// 無効な入力（ゼロ長、2つの正面積に分かれない）は null。
export function cutPolygon(poly, p, q) {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  if (Math.hypot(dx, dy) < MIN_CUT_LENGTH) return null;
  const len = Math.hypot(dx, dy);
  const d = poly.map((v) => ((dx * (v.y - p.y) - dy * (v.x - p.x)) / len));
  const a = [];
  const b = [];
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    const vi = poly[i];
    const vj = poly[j];
    if (d[i] >= 0) a.push(vi);
    if (d[i] <= 0) b.push(vi);
    if ((d[i] > 0 && d[j] < 0) || (d[i] < 0 && d[j] > 0)) {
      const t = d[i] / (d[i] - d[j]);
      const m = { x: vi.x + (vj.x - vi.x) * t, y: vi.y + (vj.y - vi.y) * t };
      a.push(m);
      b.push(m);
    }
  }
  if (a.length < 3 || b.length < 3) return null;
  const areaA = polygonArea(a);
  const areaB = polygonArea(b);
  const total = polygonArea(poly);
  if (areaA <= total * EPS || areaB <= total * EPS) return null;
  return { a, b, areaA, areaB, normal: { x: -dy / len, y: dx / len } };
}

export function scoreFromAreas(areaA, areaB) {
  const s = Math.round(100 * (1 - Math.abs(areaA - areaB) / (areaA + areaB)));
  return Math.max(0, Math.min(100, s));
}

// 小さい方を先にした「45.3 : 54.7」形式。
export function formatRatio(areaA, areaB) {
  const total = areaA + areaB;
  const lo = Math.min(areaA, areaB) / total * 100;
  const hi = 100 - lo;
  return `${lo.toFixed(1)} : ${hi.toFixed(1)}`;
}

// 不規則な凸多角形。楕円上の点なので必ず凸。細すぎ・小さすぎを避ける。
export function generateShape(rng = Math.random) {
  const n = 5 + Math.floor(rng() * 4);
  const base = rng() * Math.PI * 2;
  const step = (Math.PI * 2) / n;
  const rot = rng() * Math.PI;
  const ratio = 0.7 + rng() * 0.3;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const ang = base + step * (i + (rng() - 0.5) * 0.7);
    const ex = Math.cos(ang);
    const ey = Math.sin(ang) * ratio;
    pts.push({
      x: ex * Math.cos(rot) - ey * Math.sin(rot),
      y: ex * Math.sin(rot) + ey * Math.cos(rot),
    });
  }
  const scale = 0.92 / Math.max(...pts.map((v) => Math.hypot(v.x, v.y)));
  return pts.map((v) => ({ x: v.x * scale, y: v.y * scale }));
}

export function newGame(rng = Math.random) {
  return { round: 1, scores: [], total: 0, phase: 'aiming', shape: generateShape(rng), cut: null };
}

// 戻り値: { state, ok }。無効な線・結果表示中は state を変えない。
export function applyCut(state, p, q) {
  if (state.phase !== 'aiming') return { state, ok: false };
  const res = cutPolygon(state.shape, p, q);
  if (!res) return { state, ok: false };
  const score = scoreFromAreas(res.areaA, res.areaB);
  const scores = [...state.scores, score];
  const total = state.total + score;
  const phase = scores.length >= ROUNDS ? 'done' : 'result';
  return { state: { ...state, scores, total, phase, cut: { ...res, score } }, ok: true };
}

export function nextRound(state, rng = Math.random) {
  if (state.phase !== 'result') return state;
  return { ...state, round: state.round + 1, phase: 'aiming', shape: generateShape(rng), cut: null };
}
