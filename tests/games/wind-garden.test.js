import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../site/games/wind-garden/logic.js';

const mv = (g, d) => L.move(g, d).game;
const walk = (g, dirs) => dirs.reduce((s, d) => { const r = L.move(s, d); assert.notEqual(r.result, 'blocked', `blocked dir ${d} at ${s.gardens[s.cur].x},${s.gardens[s.cur].y}`); return r.game; }, g);
const N = 0, E = 1, S = 2, W = 3;

test('マップは9x9で、開始位置・風見鶏・雲の位置が地面にある', () => {
  assert.equal(L.GARDENS.length, 15);
  assert.equal(L.WORLDS.length, 3);
  L.WORLDS.forEach((w) => assert.equal(w.gardens.length, 5));
  L.GARDENS.forEach((g, gi) => {
    assert.equal(g.rows.length, 9); g.rows.forEach((r) => assert.equal(r.length, 9));
    assert.equal(g.clouds.length, 3);
    g.clouds.forEach((c) => assert.ok(L.isGround(gi, c.x, c.y), `${g.name}:${c.name} が地面にない`));
    assert.ok(g.rows.join('').includes('S'));
    assert.ok(g.rows.join('').includes('V'));
  });
  assert.equal(L.CLOUD_COUNT, 45);
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
  const MILL = L.GARDENS.findIndex((x) => x.id === 'mill'); const H = MILL * 3 + 2;
  let g = L.enterGarden({ ...L.newGame(), got: L.newGame().got.map((_, i) => i < MILL * 3 && i % 3 < 2) }, MILL);
  assert.equal(g.cur, MILL);
  g = walk(g, [N]); // (1,7) 風見鶏(1,6)の真下
  assert.ok(L.canTurn(g));
  for (let i = 0; i < 5; i++) { g = L.turn(g).game; assert.equal(g.revealed[H], false, `${i + 1}回目で出てはいけない`); }
  g = L.turn(g).game; // 6回目：…N,E,S
  assert.deepEqual(g.gardens[MILL].hist.slice(-3), [0, 1, 2]);
  assert.equal(g.revealed[H], true);
  // 逆順（東→北…）では出ない：5回で止めた状態は未発見
});

test('最後の雲は他のすべてを集めるまで出ない', () => {
  const F = L.CLOUD_COUNT - 1;
  const got = Array(L.CLOUD_COUNT).fill(true); got[F] = false; got[F - 1] = false;
  let g = { ...L.newGame(), got, revealed: got.slice() };
  g = L.enterGarden(g, L.LAST);
  g = { ...g, revealed: g.revealed.slice() };
  const sanitized = L.sanitize(JSON.parse(JSON.stringify(g)));
  assert.equal(sanitized.revealed[F], false);
  const got2 = Array(L.CLOUD_COUNT).fill(true); got2[F] = false;
  assert.equal(L.sanitize({ got: got2 }).revealed[F], true);
});

test('全45個を集めると finished になる', () => {
  const F = L.CLOUD_COUNT - 1;
  const got = Array(L.CLOUD_COUNT).fill(true); got[F] = false;
  let g = L.sanitize({ got, cur: L.LAST });
  g = L.turn(g).game; // 開始位置(1,4)は風見鶏(1,3)の隣。東風で橋が架かる
  g = walk(g, [E, E]); // 橋(2,4) → (3,4)
  assert.equal(g.finished, false);
  assert.equal(g.gardens[L.LAST].x, 3);
  const r = L.move(g, E);
  assert.deepEqual(r.collected, [F]);
  assert.equal(r.game.finished, true);
});

test('全15庭：初期状態から3つの雲すべてに、風と歩行だけで到達できる（状態探索）', () => {
  L.GARDENS.forEach((g, gi) => {
    const r = L.exploreGarden(gi);
    assert.ok(r.complete, `${g.name}: 探索が打ち切られた`);
    assert.deepEqual(r.got, [0, 1, 2], `${g.name}: 取れない雲がある`);
    assert.ok(r.allTurns !== null);
    if (gi < L.LAST) assert.ok(r.gate, `${g.name}: 門に着けない`);
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
    assert.equal(g.got.length, L.CLOUD_COUNT); assert.equal(g.gardens.length, L.GARDENS.length);
    assert.ok(g.cur >= 0 && g.cur < L.GARDENS.length);
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

test('後から足した庭は、最初の庭より手数がかかる（中身の確認）', () => {
  const idx = (id) => L.GARDENS.findIndex((g) => g.id === id);
  for (const id of ['forest', 'snow', 'sakura', 'falls', 'candy', 'oasis', 'dune', 'ruins', 'cactus', 'mirage']) {
    const r = L.exploreGarden(idx(id));
    assert.ok(r.allTurns >= 3, `${id}: ${r.allTurns}手で全部取れてしまう`);
  }
  assert.ok(L.exploreGarden(idx('forest')).allTurns >= 10, '木漏れ日の森は綿毛どうしをぶつける長めの謎');
  assert.ok(L.exploreGarden(idx('candy')).allTurns >= 10, 'わたあめの島は綿毛を何度も押す長めの謎');
});

test('ワールド：最初は草原だけ。草原の5つめの庭まで進むと砂漠と空が開く。各ワールドの中は順番に開く', () => {
  const g = L.newGame();
  assert.ok(L.worldUnlocked(g, 0));
  assert.equal(L.worldUnlocked(g, 1), false); assert.equal(L.worldUnlocked(g, 2), false);
  const upTo4 = { ...g, got: g.got.map((_, i) => i < 12 && i % 3 < 2) };
  assert.ok(L.isUnlocked(upTo4, 4));
  assert.ok(L.worldUnlocked(upTo4, 1) && L.worldUnlocked(upTo4, 2));
  assert.equal(L.isUnlocked(upTo4, L.worldFirst(1) + 1), false, '砂漠の2つめは砂漠の1つめで2個必要');
  assert.equal(L.worldGot(upTo4, 0), 8);
});

test('ワールドの最後の庭の門は、ワールド選択（map）へ戻る。2個そろうまでは閉じている', () => {
  const MILL = 4; const [gx, gy] = L.gardenInfo(MILL).gate;
  const base = L.enterGarden({ ...L.newGame(), got: L.newGame().got.map((_, i) => i < 15 && i % 3 < 2) }, MILL);
  assert.equal(base.cur, MILL);
  const enter = (g) => {
    for (let d = 0; d < 4; d++) {
      const [dx, dy] = L.DIRS[d]; const sx = gx - dx; const sy = gy - dy;
      if (!L.isGround(MILL, sx, sy)) continue;
      const h = JSON.parse(JSON.stringify(g)); h.gardens[MILL] = { ...h.gardens[MILL], x: sx, y: sy };
      return L.move(h, d).result;
    }
    return null;
  };
  assert.equal(enter(base), 'map');
  const noClouds = { ...base, got: base.got.map((v, i) => (Math.floor(i / 3) === MILL ? false : v)) };
  assert.equal(enter(noClouds), 'locked-gate');
});

test('以前の保存（5庭・15個／10庭・30個）を、庭の名前で今の並びへ引き継ぐ', () => {
  const idx = (id) => L.GARDENS.findIndex((g) => g.id === id);
  const got = Array(15).fill(false); got[0] = true; got[1] = true; got[12] = true; got[13] = true;
  const g = L.sanitize({ got, cur: 4, gardens: [{}, {}, {}, {}, { x: 3, y: 4, wind: 1 }] });
  assert.equal(g.got.length, 45);
  assert.ok(g.got[0] && g.got[1]);
  assert.ok(g.got[idx('night') * 3] && g.got[idx('night') * 3 + 1], '夜空の雲が夜空の花畑へ移る');
  assert.equal(g.got.filter(Boolean).length, 4);
  assert.ok(L.isUnlocked(g, g.cur), '開いていない庭にはいない');
  const got30 = Array(30).fill(false); got30[4 * 3] = true; got30[8 * 3 + 2] = true;
  const h = L.sanitize({ got: got30 });
  assert.ok(h.got[idx('forest') * 3] && h.got[idx('candy') * 3 + 2]);
});

test('着せ替え：集めた雲の数で解放、未解放は着られない、保存で戻る', () => {
  let g = L.newGame();
  assert.deepEqual(g.outfit, { coat: 'yellow', hat: 'none' });
  assert.equal(L.outfitUnlocked(g, 'coat', 'sky'), false);
  assert.deepEqual(L.setOutfit(g, 'coat', 'sky').outfit, g.outfit);
  const some = { ...g, got: g.got.map((_, i) => i < 4) };
  assert.ok(L.outfitUnlocked(some, 'coat', 'sky'));
  const dressed = L.setOutfit(L.setOutfit(some, 'coat', 'sky'), 'hat', 'flower');
  assert.deepEqual(dressed.outfit, { coat: 'sky', hat: 'flower' });
  assert.equal(L.outfitOf(dressed).coat.name, 'そらいろ');
  const back = L.sanitize(JSON.parse(JSON.stringify(dressed)));
  assert.deepEqual(back.outfit, { coat: 'sky', hat: 'flower' });
  // 未解放の着せ替えが保存に入っていても戻される
  assert.deepEqual(L.sanitize({ outfit: { coat: 'rainbow', hat: 'star' } }).outfit, { coat: 'yellow', hat: 'none' });
  // 増えた着せ替えの通知
  assert.deepEqual(L.newOutfits(3, 4).map((o) => o.id), ['sky']);
  assert.deepEqual(L.nextOutfit(L.newGame()), { ...L.HATS[1], kind: 'hat', left: 2 });
  assert.ok(L.newOutfits(44, 45).some((o) => o.id === 'rainbow'));
  // すべての着せ替えは雲45個以内で手に入る
  [...L.COATS, ...L.HATS].forEach((o) => assert.ok(o.need <= L.CLOUD_COUNT));
});
