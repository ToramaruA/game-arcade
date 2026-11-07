import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../site/games/wind-garden/logic.js';

const mv = (g, d) => L.move(g, d).game;
const walk = (g, dirs) => dirs.reduce((s, d) => { const r = L.move(s, d); assert.notEqual(r.result, 'blocked', `blocked dir ${d} at ${s.gardens[s.cur].x},${s.gardens[s.cur].y}`); return r.game; }, g);
const N = 0, E = 1, S = 2, W = 3;

test('マップは9x9で、開始位置・風見鶏・雲の位置が地面にある', () => {
  assert.equal(L.GARDENS.length, 5);
  L.GARDENS.forEach((g, gi) => {
    assert.equal(g.rows.length, 9); g.rows.forEach((r) => assert.equal(r.length, 9));
    assert.equal(g.clouds.length, 3);
    g.clouds.forEach((c) => assert.ok(L.isGround(gi, c.x, c.y), `${g.name}:${c.name} が地面にない`));
    assert.ok(g.rows.join('').includes('S'));
    assert.ok(g.rows.join('').includes('V'));
  });
  assert.equal(L.CLOUD_COUNT, 15);
});

test('風向き4種ごとの橋の通行判定', () => {
  // 庭1の橋は東風だけ架かる
  for (const w of [N, E, S, W]) assert.equal(L.walkable(0, 5, 3, w), w === E);
  // 庭2は北東と南西で別の橋
  assert.deepEqual([N, E, S, W].map((w) => L.walkable(1, 4, 3, w)), [true, true, false, false]);
  assert.deepEqual([N, E, S, W].map((w) => L.walkable(1, 4, 6, w)), [false, false, true, true]);
});

test('風見鶏のそばで風が 北→東→南→西 と回る。離れていると回せない', () => {
  let g = L.newGame();
  assert.equal(L.turn(g).result, 'cannot');
  g = walk(g, [E, E]); // (3,4) 風見鶏(3,3)の真下
  assert.ok(L.canTurn(g));
  const winds = [];
  for (let i = 0; i < 5; i++) { g = L.turn(g).game; winds.push(g.gardens[0].wind); }
  assert.deepEqual(winds, [1, 2, 3, 0, 1]);
  assert.equal(g.gardens[0].turns, 5);
});

test('橋の上では風を回せない／橋が消えるマスには入れない', () => {
  let g = L.newGame();
  g = walk(g, [E, E]);
  assert.equal(L.move(g, E).result, 'moved'); // (4,4)
  // 北風のままでは橋(5,3)へ進めない
  g = walk(L.newGame(), [E, E, E, N]); // (4,3)
  assert.equal(L.move(g, E).result, 'blocked');
  g = walk(L.newGame(), [E, E]); g = L.turn(g).game; // 東風
  g = walk(g, [E, N]); // (4,3)
  g = walk(g, [E]); // 橋 (5,3)
  assert.equal(L.onSolid(g), false);
  assert.equal(L.turn(g).result, 'cannot');
});

test('プレビュー：次の風で現れる橋・消える橋', () => {
  const g = L.newGame();
  assert.deepEqual(L.windPreview(g).appear, [[5, 3], [6, 3]]);
  let g2 = walk(g, [E, E]); g2 = L.turn(g2).game;
  assert.deepEqual(L.windPreview(g2).vanish, [[5, 3], [6, 3]]);
});

test('綿毛：風下へ1マス、壁では止まり、花壇に入ると花が開いて隠れ雲が出る', () => {
  let g = L.newGame();
  g = walk(g, [E, E]);
  const f = [];
  for (let i = 0; i < 5; i++) { g = L.turn(g).game; f.push(g.gardens[0].fluff[0].join(',')); }
  assert.deepEqual(f, ['2,6', '2,7', '2,7', '2,6', '3,6']);
  assert.equal(g.gardens[0].bloom[0], true);
  assert.equal(g.revealed[2], true);
});

test('雲：触れると集まり、重複して数えない。見えない雲は取れない', () => {
  let g = L.newGame();
  assert.equal(g.revealed[2], false);
  const r = L.move(walk(g, [N]), N); // (1,2)
  g = walk(L.newGame(), [N]); // (1,3)
  const r2 = L.move(g, N); // あくび雲(1,2)
  assert.deepEqual(r2.collected, [0]);
  const back = L.move(r2.game, S).game;
  const again = L.move(back, N);
  assert.deepEqual(again.collected, []);
  assert.equal(L.gotCount(again.game), 1);
  void r;
});

test('庭の解放：2個で次の庭、足りなければ門で止まる', () => {
  const g = L.newGame();
  assert.equal(L.isUnlocked(g, 1), false);
  const g2 = { ...g, got: g.got.map((_, i) => i < 2) };
  assert.equal(L.isUnlocked(g2, 1), true);
  assert.equal(L.isUnlocked(g2, 2), false);
  assert.equal(L.enterGarden(g, 1).cur, 0);
  assert.equal(L.enterGarden(g2, 1).cur, 1);
});

test('りんりん雲：南風のとき鈴の下に立つと現れる', () => {
  const base = L.enterGarden({ ...L.newGame(), got: L.newGame().got.map((_, i) => i < 2) }, 1);
  // 北風で鈴の下(1,3)に立っても出ない
  let g = walk(base, [N]);
  assert.equal(g.revealed[3], false);
  // 風見鶏(3,4)に隣接する(3,5)? 風見鶏は(3,4)。F(2,4)の上にいる
  g = walk(base, [E]); // (2,4) 花壇マス
  g = L.turn(g).game; g = L.turn(g).game; // 南風
  assert.equal(g.gardens[1].wind, S);
  g = walk(g, [W, N]); // (1,3)
  assert.equal(g.revealed[3], true);
});

test('ひみつ雲：風を 北→東→南 の順に回したときだけ出る', () => {
  let g = L.enterGarden({ ...L.newGame(), got: L.newGame().got.map((_, i) => i < 8) }, 3);
  g = walk(g, [N]); // (1,7) 風見鶏(1,6)の真下
  assert.ok(L.canTurn(g));
  for (let i = 0; i < 5; i++) { g = L.turn(g).game; assert.equal(g.revealed[11], false, `${i + 1}回目で出てはいけない`); }
  g = L.turn(g).game; // 6回目：…N,E,S
  assert.deepEqual(g.gardens[3].hist.slice(-3), [0, 1, 2]);
  assert.equal(g.revealed[11], true);
  // 逆順（東→北…）では出ない：5回で止めた状態は未発見
});

test('最後の雲は他の14個を集めるまで出ない', () => {
  const got = Array(15).fill(true); got[14] = false; got[13] = false;
  let g = { ...L.newGame(), got, revealed: got.slice() };
  g = L.enterGarden(g, 4);
  g = { ...g, revealed: g.revealed.slice() };
  const sanitized = L.sanitize(JSON.parse(JSON.stringify(g)));
  assert.equal(sanitized.revealed[14], false);
  const got2 = Array(15).fill(true); got2[14] = false;
  assert.equal(L.sanitize({ got: got2 }).revealed[14], true);
});

test('全15個を集めると finished になる', () => {
  const got = Array(15).fill(true); got[14] = false;
  let g = L.sanitize({ got, cur: 4 });
  g = L.turn(g).game; // 開始位置(1,4)は風見鶏(1,3)の隣。東風で橋が架かる
  g = walk(g, [E, E]); // 橋(2,4) → (3,4)
  assert.equal(g.finished, false);
  assert.equal(g.gardens[4].x, 3);
  const r = L.move(g, E);
  assert.deepEqual(r.collected, [14]);
  assert.equal(r.game.finished, true);
});

test('全5庭：初期状態から3つの雲すべてに、風と歩行だけで到達できる（状態探索）', () => {
  L.GARDENS.forEach((g, gi) => {
    const r = L.exploreGarden(gi);
    assert.ok(r.complete, `${g.name}: 探索が打ち切られた`);
    assert.deepEqual(r.got, [0, 1, 2], `${g.name}: 取れない雲がある`);
    assert.ok(r.allTurns !== null);
    if (gi < 4) assert.ok(r.gate, `${g.name}: 門に着けない`);
  });
});

test('詰み防止：到達できるどの状態でも、歩いて風見鶏のそばに行ける（風を回せる）', () => {
  L.GARDENS.forEach((g, gi) => {
    const { seen } = L.exploreGarden(gi);
    for (const st of seen.values()) {
      const s = st.gardens[gi];
      const visited = new Set([`${s.x},${s.y}`]); const q = [[s.x, s.y]]; let ok = false;
      while (q.length && !ok) {
        const [x, y] = q.pop();
        if (L.isGround(gi, x, y) && L.DIRS.some(([dx, dy]) => L.cellAt(gi, x + dx, y + dy) === 'V')) { ok = true; break; }
        L.DIRS.forEach(([dx, dy]) => {
          const nx = x + dx; const ny = y + dy; const k = `${nx},${ny}`;
          if (!visited.has(k) && L.inRange(nx, ny) && L.walkable(gi, nx, ny, s.wind)) { visited.add(k); q.push([nx, ny]); }
        });
      }
      assert.ok(ok, `${g.name}: 風見鶏に近づけない状態がある`);
    }
  });
});

test('庭リセットで最初の状態に戻る（集めた雲と回数は残る）', () => {
  let g = L.newGame();
  g = walk(g, [N, N]); // あくび雲(1,2)
  g = walk(g, [S, S, E, E]);
  g = L.turn(g).game;
  const r = L.resetGarden(g);
  const s = r.gardens[0];
  assert.deepEqual([s.x, s.y, s.wind], [1, 4, 0]);
  assert.equal(s.turns, 1);
  assert.equal(r.got[0], true);
});

test('保存データの復元：壊れていても安全に初期化される', () => {
  for (const bad of [null, 5, 'x', [], {}, { got: 3 }, { cur: 99, got: [true], gardens: 'a' }, { gardens: [null, 1, {}, [], { x: 'a' }] }]) {
    const g = L.sanitize(bad);
    assert.equal(g.got.length, 15); assert.equal(g.gardens.length, 5);
    assert.ok(g.cur >= 0 && g.cur < 5);
    assert.ok(L.isUnlocked(g, g.cur));
  }
  // 解放されていない庭にいる保存は戻される
  assert.equal(L.sanitize({ cur: 3 }).cur, 0);
  // 壁の中の座標は開始位置に戻る
  const g = L.sanitize({ gardens: [{ x: 5, y: 5, wind: 2 }, {}, {}, {}, {}] });
  assert.ok(L.isGround(0, g.gardens[0].x, g.gardens[0].y) || (g.gardens[0].x === 1));
  // 正常な保存は往復できる
  const a = walk(L.newGame(), [N, N, E]);
  const b = L.sanitize(JSON.parse(JSON.stringify(a)));
  assert.deepEqual(b.got, a.got);
  assert.deepEqual(b.gardens[0], a.gardens[0]);
});
