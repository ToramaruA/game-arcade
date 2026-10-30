import test from 'node:test';
import assert from 'node:assert/strict';
import {
  polygonArea, cutPolygon, scoreFromAreas, generateShape, newGame, applyCut, nextRound, ROUNDS, formatRatio,
} from '../../site/games/half-please/logic.js';

const square = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

function rngOf(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

test('正方形を縦に半分に切ると 100 点', () => {
  const r = cutPolygon(square, { x: 0.5, y: -1 }, { x: 0.5, y: 2 });
  near(r.areaA, 0.5); near(r.areaB, 0.5);
  assert.equal(scoreFromAreas(r.areaA, r.areaB), 100);
});

test('40:60 は 80 点、表示は 40.0 : 60.0', () => {
  const r = cutPolygon(square, { x: 0.4, y: 0 }, { x: 0.4, y: 1 });
  near(r.areaA + r.areaB, 1);
  assert.equal(scoreFromAreas(r.areaA, r.areaB), 80);
  assert.equal(formatRatio(r.areaA, r.areaB), '40.0 : 60.0');
});

test('線は両方向に延長して判定する（短い線でも形を横切る）', () => {
  const r = cutPolygon(square, { x: 0.5, y: 0.4 }, { x: 0.5, y: 0.6 });
  assert.ok(r);
  near(r.areaA, 0.5);
});

test('面積保存（ランダム形・ランダム線）', () => {
  for (let s = 1; s <= 50; s++) {
    const rng = rngOf(s);
    const shape = generateShape(rng);
    const p = { x: rng() * 2 - 1, y: rng() * 2 - 1 };
    const q = { x: rng() * 2 - 1, y: rng() * 2 - 1 };
    const r = cutPolygon(shape, p, q);
    if (r) near(r.areaA + r.areaB, polygonArea(shape), 1e-9);
  }
});

test('頂点を通る対角線で半分', () => {
  const r = cutPolygon(square, { x: 0, y: 0 }, { x: 1, y: 1 });
  near(r.areaA, 0.5); near(r.areaB, 0.5);
});

test('無効入力：ゼロ長・外側・接線は null', () => {
  assert.equal(cutPolygon(square, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }), null);
  assert.equal(cutPolygon(square, { x: 0.5, y: 0.5 }, { x: 0.5001, y: 0.5 }), null);
  assert.equal(cutPolygon(square, { x: 2, y: 0 }, { x: 2, y: 1 }), null);
  assert.equal(cutPolygon(square, { x: 0, y: -1 }, { x: 0, y: 2 }), null); // 辺に接する
  assert.equal(cutPolygon(square, { x: -1, y: 1 }, { x: 1, y: -1 }), null); // 頂点(0,0)だけに触れる
  assert.equal(cutPolygon(square, { x: -1, y: 2 }, { x: 2, y: -1 }) !== null, true);
  assert.equal(cutPolygon(square, { x: 1, y: 2 }, { x: 2, y: 1 }), null); // 頂点だけに触れる
});

test('採点範囲は 0〜100、丸め前の面積で計算', () => {
  assert.equal(scoreFromAreas(1, 0.0001), 0);
  assert.equal(scoreFromAreas(0.0001, 1), 0);
  assert.equal(scoreFromAreas(1, 1), 100);
  // 49.6:50.4 → 99.2 → 99
  assert.equal(scoreFromAreas(49.6, 50.4), 99);
  for (let i = 1; i < 100; i++) {
    const s = scoreFromAreas(i, 100 - i);
    assert.ok(s >= 0 && s <= 100);
  }
});

test('生成形：凸・十分な大きさ・余白あり', () => {
  for (let s = 1; s <= 200; s++) {
    const shape = generateShape(rngOf(s));
    assert.ok(shape.length >= 5);
    assert.ok(shape.every((v) => Math.hypot(v.x, v.y) <= 0.93));
    assert.ok(polygonArea(shape) > 0.9);
    let sign = 0;
    for (let i = 0; i < shape.length; i++) {
      const a = shape[i], b = shape[(i + 1) % shape.length], c = shape[(i + 2) % shape.length];
      const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      assert.ok(cr !== 0);
      if (!sign) sign = Math.sign(cr);
      assert.equal(Math.sign(cr), sign);
    }
  }
});

test('5問の進行・無効切断は状態を変えない・もう一度', () => {
  let st = newGame(rngOf(3));
  const bad = applyCut(st, { x: 0, y: 0 }, { x: 0, y: 0 });
  assert.equal(bad.ok, false);
  assert.equal(bad.state, st);
  for (let i = 0; i < ROUNDS; i++) {
    const r = applyCut(st, { x: -2, y: 0.01 * i }, { x: 2, y: 0.01 * i });
    assert.equal(r.ok, true);
    st = r.state;
    // 結果表示中は再度切れない
    assert.equal(applyCut(st, { x: -2, y: 0 }, { x: 2, y: 0 }).ok, false);
    st = nextRound(st, rngOf(i + 10));
  }
  assert.equal(st.phase, 'done');
  assert.equal(st.scores.length, ROUNDS);
  assert.equal(st.total, st.scores.reduce((a, b) => a + b, 0));
  assert.ok(st.total <= 500);
  const again = newGame(rngOf(99));
  assert.equal(again.total, 0);
  assert.equal(again.phase, 'aiming');
});
