import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENCOUNTERS, ROUTES, SPECIES, MAX_HULL, MAX_STIMULI, newGame, preview, stimulate, shoot, advance,
  quality, summarize, shareText, updateBest, explore, clampDist, encounterOf,
} from '../../site/games/abyssal-signal/logic.js';

const ok = (r) => { assert.ok(r.ok, `rejected: ${r.reason}`); return r.state; };
const at = (index, over = {}, route = 'standard') => ({ ...newGame(route), index, ...over });

test('反応表：A/B/C の光・音・静止', () => {
  const dist = (sp, k) => SPECIES[sp].react[k];
  assert.deepEqual(['light', 'sound', 'wait'].map((k) => dist('A', k)), [1, -1, 0]);
  assert.deepEqual(['light', 'sound', 'wait'].map((k) => dist('B', k)), [0, 1, -1]);
  assert.deepEqual(['light', 'sound', 'wait'].map((k) => dist('C', k)), [-1, 0, 1]);
});

test('各遭遇は遠・ピント0から始まる。全5遭遇の表が固定', () => {
  const s = newGame();
  assert.equal(s.dist, 0); assert.equal(s.focus, 0); assert.equal(s.hull, MAX_HULL);
  assert.deepEqual(ENCOUNTERS.map((e) => e.depth), [600, 1200, 1800, 2400, 3000]);
  assert.deepEqual(ENCOUNTERS.map((e) => e.species), ['A', 'B', 'A', 'B', 'C']);
  assert.deepEqual(ENCOUNTERS.map((e) => e.target), ['全身', '殻の模様', '発光器官', '捕食姿勢', '頭部']);
});

test('距離は 0〜2 にクランプされる', () => {
  assert.equal(clampDist(-3), 0);
  assert.equal(clampDist(9), 2);
  const s = newGame(); // A: 音で後退、遠のままで無傷
  const s2 = ok(stimulate(s, 'sound'));
  assert.equal(s2.dist, 0);
  assert.equal(s2.hull, MAX_HULL);
});

test('近距離になる操作で種別損傷、中距離までは無傷', () => {
  let s = newGame();
  s = ok(stimulate(s, 'light')); // 遠→中
  assert.equal(s.dist, 1); assert.equal(s.hull, 7);
  s = ok(stimulate(s, 'light')); // 中→近 A=1
  assert.equal(s.dist, 2); assert.equal(s.hull, 6);
  const s3 = at(1, { dist: 1 });
  assert.equal(preview(s3, 'sound').damage, 2); // B
  assert.equal(preview(at(4, { dist: 1 }), 'wait').damage, 3); // C
});

test('近距離でさらに接近しても無傷にならず、離れて中距離なら無傷', () => {
  let s = at(0, { dist: 2, focus: 0, used: 0 });
  const r = preview(s, 'light'); // 近のまま
  assert.equal(r.dist, 2); assert.equal(r.damage, 1);
  s = ok(stimulate(s, 'light'));
  assert.equal(s.hull, 6);
  const back = ok(stimulate(at(0, { dist: 2 }), 'sound')); // 後退→中
  assert.equal(back.dist, 1); assert.equal(back.hull, 7);
});

test('近距離の維持（ピント合わせ）でも損傷が出る', () => {
  const s = at(0, { dist: 2 }); // Aの静止は維持 0
  const p = preview(s, 'wait');
  assert.equal(p.dist, 2); assert.equal(p.damage, 1); assert.equal(p.focus, 1);
});

test('ピント：維持で1、距離が変わると0へ、上限で止まった接近は増やさない', () => {
  let s = newGame();
  s = ok(stimulate(s, 'wait')); // A 維持
  assert.equal(s.focus, 1); assert.equal(s.dist, 0);
  s = ok(stimulate(s, 'light')); // 動く
  assert.equal(s.focus, 0); assert.equal(s.dist, 1);
  // 近で接近が止まる（B, 光=0 は維持なので別に、Cで確認）
  const c = at(4, { dist: 2, focus: 0 });
  const p = preview(c, 'wait'); // C: +1 だが上限
  assert.equal(p.dist, 2); assert.equal(p.focus, 0);
  assert.equal(preview(newGame(), 'sound').focus, 0); // 遠で後退が止まってもピントは増えない
});

test('撮影品質：全5対象 × 遠中近 × ピント', () => {
  const expected = [[1, 4, 2], [1, 2, 4], [1, 2, 4], [1, 4, 2], [1, 2, 4]];
  ENCOUNTERS.forEach((enc, i) => {
    for (let d = 0; d < 3; d++) {
      assert.equal(quality(enc, d, 0), expected[i][d]);
      assert.equal(quality(enc, d, 1), expected[i][d] + 1);
    }
  });
  const best = ENCOUNTERS.reduce((a, e) => a + Math.max(...e.base) + 1, 0);
  assert.equal(best, 25);
});

test('航路補正は近距離の損傷だけを増やす', () => {
  assert.deepEqual(ROUTES.map((r) => r.id), ['standard', 'shell', 'glow']);
  const shell = at(1, { dist: 1 }, 'shell');
  assert.equal(preview(shell, 'sound').damage, 3); // B 2 + 1
  assert.equal(preview(shell, 'light').damage, 0); // 中のまま維持は無傷
  assert.equal(preview(at(1, { dist: 1 }, 'standard'), 'sound').damage, 2);
  const glow = at(2, { dist: 1 }, 'glow');
  assert.equal(preview(glow, 'light').damage, 2); // A 1 + 1
  assert.equal(preview(at(0, { dist: 1 }, 'glow'), 'light').damage, 1);
});

test('同じ航路・同じ操作は完全に再現される', () => {
  const run = () => {
    let s = newGame('shell');
    for (const k of ['wait', 'light', 'light']) s = ok(stimulate(s, k));
    return s;
  };
  assert.deepEqual(run(), run());
});

test('刺激は1遭遇3回まで', () => {
  let s = newGame();
  for (let i = 0; i < MAX_STIMULI; i++) s = ok(stimulate(s, 'wait'));
  const r = stimulate(s, 'wait');
  assert.equal(r.ok, false); assert.equal(r.reason, 'no-stimuli');
  assert.equal(shoot(s, 'next').ok, true); // 撮影は可能
});

test('撮影は無傷で、スナップショットを保存しロックする', () => {
  let s = newGame();
  s = ok(stimulate(s, 'light'));
  const hull = s.hull;
  const shot = ok(shoot(s, 'next'));
  assert.equal(shot.hull, hull);
  assert.equal(shot.photos.length, 1);
  assert.deepEqual(
    { d: shot.photos[0].dist, f: shot.photos[0].focus, sp: shot.photos[0].species, t: shot.photos[0].target, depth: shot.photos[0].depth, q: shot.photos[0].quality },
    { d: 1, f: 0, sp: 'A', t: '全身', depth: 600, q: 4 },
  );
});

test('二重撮影・撮影後の刺激・次遭遇への入力持越しを拒否する', () => {
  const s = ok(shoot(newGame(), 'next'));
  assert.equal(shoot(s, 'next').reason, 'locked');
  assert.equal(shoot(s, 'return').reason, 'locked');
  assert.equal(stimulate(s, 'light').reason, 'locked');
  const n = ok(advance(s));
  assert.equal(n.index, 1); assert.equal(n.used, 0); assert.equal(n.dist, 0); assert.equal(n.focus, 0);
  assert.equal(n.shotTaken, false);
  assert.equal(advance(n).ok, false); // 撮影前は進めない
  assert.equal(n.photos.length, 1);
});

test('最終深度は「撮影して帰還」のみ', () => {
  const s = at(4);
  assert.equal(shoot(s, 'next').reason, 'last');
  const r = ok(shoot(s, 'return'));
  assert.equal(r.over, 'returned');
});

test('致死の操作は確認なしでは通らない', () => {
  const s = at(4, { dist: 1, hull: 3 }); // C 静止 +1 → 近 3 損傷 → 耐久0
  const p = preview(s, 'wait');
  assert.equal(p.lethal, true); assert.equal(p.hullAfter, 0);
  const r = stimulate(s, 'wait');
  assert.equal(r.ok, false); assert.equal(r.reason, 'needs-confirm');
});

test('耐久0でロスト。写真は未回収で成功記録に入らない', () => {
  let s = ok(shoot(newGame(), 'next'));
  s = ok(advance(s));
  s = { ...s, dist: 1, hull: 2 };
  s = ok(stimulate(s, 'sound', true)); // B 損傷2 → 耐久0
  assert.equal(s.over, 'lost'); assert.equal(s.hull, 0);
  const sum = summarize(s);
  assert.equal(sum.lost, true); assert.equal(sum.returned, false);
  assert.equal(sum.total, 0); assert.equal(sum.count, 0);
  assert.equal(sum.photos.length, 1); // 履歴は見られる
  assert.equal(updateBest(5, sum).isNew, false);
  assert.match(shareText(s, sum.lastPhoto), /ロスト/);
  assert.equal(stimulate(s, 'light', true).reason, 'over');
  assert.equal(shoot(s, 'return').reason, 'over');
});

test('途中帰還も成功。写真の合計・枚数・深度・耐久を返す', () => {
  let s = newGame();
  s = ok(stimulate(s, 'light')); // 中
  s = ok(shoot(s, 'next')); // 4
  s = ok(advance(s));
  s = ok(stimulate(s, 'sound')); // B 遠→中
  s = ok(shoot(s, 'return')); // 2
  const sum = summarize(s);
  assert.equal(sum.returned, true); assert.equal(sum.count, 2); assert.equal(sum.total, 6);
  assert.equal(sum.depth, 1200); assert.equal(sum.hull, 7);
  assert.deepEqual(updateBest(null, sum), { best: 6, isNew: true });
  assert.deepEqual(updateBest(8, sum), { best: 8, isNew: false });
  assert.equal(shareText(s, sum.photos[1]), '1200mで鎧クラゲを撮影。耐久7で帰還。深海、未確認反応');
});

test('最終帰還の共有文は実際の状態から作られ、未訪問の生物を書かない', () => {
  let s = at(4, { dist: 1, focus: 0, hull: 1 });
  s = ok(shoot(s, 'return'));
  const text = shareText(s, s.photos[0]);
  assert.equal(text, '3000mで海底の王を撮影。耐久1で帰還。深海、未確認反応');
  assert.doesNotMatch(text, /リボンレイ|鎧クラゲ/);
});

test('リトライ：newGame は完全に初期化される（航路は選べる）', () => {
  const a = newGame('glow');
  assert.equal(a.route, 'glow'); assert.equal(a.index, 0); assert.equal(a.hull, MAX_HULL);
  assert.deepEqual(a.photos, []); assert.equal(a.over, null); assert.equal(a.used, 0);
  assert.equal(newGame('nope').route, 'standard');
  assert.equal(encounterOf(a).depth, 600);
});

test('全列挙：各航路で帰還可能、満点は到達不能、無傷では高品質を揃えられない', () => {
  const expectedMax = { standard: 23, shell: 22, glow: 22 };
  for (const r of ROUTES) {
    const e = explore(r.id);
    assert.equal(e.returnable, true);
    assert.equal(e.maxTotal, expectedMax[r.id], r.id);
    assert.equal(e.perfectReachable, false);
    assert.equal(e.perfectNoDamage, false);
    assert.ok(e.maxTotalNoDamage < e.maxTotal, '危険な接近を含めた方が高品質');
    assert.equal(e.maxTotalNoDamage, 19);
  }
});
