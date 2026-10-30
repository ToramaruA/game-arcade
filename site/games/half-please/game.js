import { ROUNDS, applyCut, formatRatio, newGame, nextRound, cutPolygon, scoreFromAreas, generateShape } from './logic.js';

const KEY = 'half-please-best';
const $ = (id) => document.getElementById(id);
const canvas = $('board');
const ctx = canvas.getContext('2d');
const S = canvas.width;
const SCALE = S / 2.3;
const OG = new URLSearchParams(location.search).get('og') === '1';

let state = newGame();
let drag = null; // { p, q } 単位空間
let anim = 0; // 0..1 分離演出
let animStart = 0;

function loadBest() { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } }
function saveBest(v) { try { localStorage.setItem(KEY, String(v)); } catch { /* 保存できなくても遊べる */ } }
let best = loadBest();

const toPx = (v) => ({ x: S / 2 + v.x * SCALE, y: S / 2 + v.y * SCALE });
function toUnit(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: ((ev.clientX - r.left) / r.width * S - S / 2) / SCALE, y: ((ev.clientY - r.top) / r.height * S - S / 2) / SCALE };
}

function path(poly, off) {
  ctx.beginPath();
  poly.forEach((v, i) => {
    const p = toPx({ x: v.x + off.x, y: v.y + off.y });
    if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
  });
  ctx.closePath();
}

function drawPiece(poly, off, hue) {
  path(poly, off);
  ctx.fillStyle = hue;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#8a4b22';
  ctx.stroke();
  // 上面のクリーム（内側に縮めた縁取り）
  ctx.save();
  path(poly, off);
  ctx.clip();
  ctx.lineWidth = 16;
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  path(poly, off);
  ctx.stroke();
  ctx.restore();
}

function drawLine(p, q, solid) {
  const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1;
  const a = toPx({ x: p.x - dx / l * 4, y: p.y - dy / l * 4 });
  const b = toPx({ x: p.x + dx / l * 4, y: p.y + dy / l * 4 });
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(60,20,10,.45)';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.setLineDash([]);
  if (solid) {
    const s = toPx(p), e = toPx(q);
    ctx.strokeStyle = '#c2255c';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
  }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, S, S);
  const cut = state.cut;
  if (cut) {
    const e = 1 - Math.pow(1 - anim, 3);
    const d = 0.09 * e;
    drawPiece(cut.a, { x: cut.normal.x * d, y: cut.normal.y * d }, '#f3c27a');
    drawPiece(cut.b, { x: -cut.normal.x * d, y: -cut.normal.y * d }, '#f7d49b');
  } else {
    drawPiece(state.shape, { x: 0, y: 0 }, '#f5cd8a');
    if (drag) drawLine(drag.p, drag.q, true);
  }
}

function frame(t) {
  if (state.cut && anim < 1) {
    anim = Math.min(1, (t - animStart) / 350);
    draw();
    requestAnimationFrame(frame);
  }
}

function render() {
  $('round').textContent = `${Math.min(state.round, ROUNDS)} / ${ROUNDS}`;
  $('total').textContent = `合計 ${state.total}`;
  $('best').textContent = `ベスト ${best || '-'}`;
  const cut = state.cut;
  $('result').hidden = !cut;
  $('next').hidden = !cut;
  if (cut) {
    $('ratio').textContent = formatRatio(cut.areaA, cut.areaB);
    $('points').textContent = `${cut.score} 点`;
  }
  if (state.phase === 'done') {
    $('prompt').textContent = best && state.total >= best && state.total === best ? `合計 ${state.total} / 500 点（ベスト更新！）` : `合計 ${state.total} / 500 点`;
    $('next').textContent = 'もう一度';
  } else {
    $('next').textContent = '次へ';
    if (!cut) $('prompt').textContent = '線を引いて、面積を半分に！';
    else $('prompt').textContent = state.cut.score >= 95 ? 'ほぼぴったり！' : '切れました';
  }
  draw();
}

function finish() {
  if (state.total > best) { best = state.total; saveBest(best); }
}

canvas.addEventListener('pointerdown', (ev) => {
  if (state.phase !== 'aiming') return;
  canvas.setPointerCapture(ev.pointerId);
  const p = toUnit(ev);
  drag = { p, q: p, id: ev.pointerId };
  draw();
});
canvas.addEventListener('pointermove', (ev) => {
  if (!drag || ev.pointerId !== drag.id) return;
  drag.q = toUnit(ev);
  draw();
});
canvas.addEventListener('pointerup', (ev) => {
  if (!drag || ev.pointerId !== drag.id) return;
  const { p } = drag;
  const q = toUnit(ev);
  drag = null;
  const res = applyCut(state, p, q);
  if (!res.ok) {
    $('prompt').textContent = 'もう少し長く、図形を横切るように引いてね';
    draw();
    return;
  }
  state = res.state;
  if (state.phase === 'done') finish();
  anim = 0;
  animStart = performance.now();
  render();
  requestAnimationFrame(frame);
});
canvas.addEventListener('pointercancel', () => { drag = null; draw(); });

$('next').addEventListener('click', () => {
  state = state.phase === 'done' ? newGame() : nextRound(state);
  anim = 0;
  render();
});

if (OG) {
  // 共有画像用：決まった形と少しずれた切断結果を見せる
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const shape = generateShape(rng);
  const res = cutPolygon(shape, { x: -0.12, y: -2 }, { x: 0.08, y: 2 });
  state = { ...newGame(rng), shape, round: 2, scores: [88], total: 88, phase: 'result',
    cut: { ...res, score: scoreFromAreas(res.areaA, res.areaB) } };
  state.total = 88 + state.cut.score;
  anim = 1;
  document.body.classList.add('og');
}
render();
