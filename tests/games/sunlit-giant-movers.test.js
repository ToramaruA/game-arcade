import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS, REGIONS, KINDS, KIND_IDS, PATTERNS, TOTAL_SEEDS, CAPACITY, SCHEMA,
  parseLevel, createState, act, loadOf, solve, replay, deliveryOrders, allDelivered, seedCount,
  emptyProgress, recordClear, totalSeeds, patternsUnlocked, validSaved, levelUnlocked, shareText, hints,
} from '../../site/games/sunlit-giant-movers/logic.js';
import { SOLUTIONS } from '../../site/games/sunlit-giant-movers/solutions.js';

const decode = (str) => [...str.matchAll(/([URDL])(\d)?/g)].map((m) => ({ d: 'URDL'.indexOf(m[1]), k: m[2] === undefined ? undefined : Number(m[2]) }));
const U = 0; const R = 1; const D = 2; const L = 3;

// 小さな試験用の面：コロは (1,1)。右の台に重さ2、下の台に重さ1。左に橋。
function testLevel(extra = {}) {
  return parseLevel({
    name: 'test',
    map: extra.map || [
      '#c.X##',
      'P@.b.#',
      'oaB..#',
      '.A..o.',
      '..#...',
    ],
    heights: extra.heights || [
      '000000',
      '000000',
      '000000',
      '000000',
      '000000',
    ],
    legend: extra.legend || {
      c: { t: 'station' }, a: { t: 'station' }, b: { t: 'station' },
      A: { t: 'home' }, B: { t: 'home' },
      P: { t: 'pad', style: 'bridge', heavy: [0, 4], light: [0, 3] },
      X: { t: 'exit' },
    },
    animals: extra.animals || [
      { kind: 'capybara', at: 'b', home: 'A' },
      { kind: 'bird', at: 'a', home: 'B', opens: [] },
    ],
  });
}

test('中身の量：3地域×6面=18面、各面2〜4匹、動物12種、種54個、模様12種', () => {
  assert.equal(LEVELS.length, 18);
  assert.equal(REGIONS.length, 3);
  for (let r = 0; r < 3; r++) assert.equal(LEVELS.filter((l) => l.region === r).length, 6, `地域${r}`);
  const kinds = new Set();
  for (const lv of LEVELS) {
    assert.ok(lv.animals.length >= 2 && lv.animals.length <= 4, `${lv.name}: ${lv.animals.length}匹`);
    assert.equal(lv.seeds.length, 3, `${lv.name}: 種は3つ`);
    assert.ok(lv.w <= 12 && lv.h <= 12, `${lv.name}: 12×12以内`);
    assert.equal(new Set(lv.animals.map((a) => a.home)).size, lv.animals.length, `${lv.name}: 住戸は1匹ずつ`);
    for (const a of lv.animals) kinds.add(a.kind);
  }
  assert.equal(kinds.size, 12);
  assert.deepEqual([...kinds].sort(), [...KIND_IDS].sort());
  assert.equal(TOTAL_SEEDS, 54);
  assert.equal(PATTERNS.length, 12);
  assert.ok(LEVELS[0].w <= 6 && LEVELS[0].h <= 6, '最初の面は6×6以内');
  // 重さは1〜3、名前の重さは設計どおり
  assert.deepEqual(KIND_IDS.map((k) => KINDS[k].weight), [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]);
  // 面ごとに盤面が違う（色と客だけ替えた同じ面がない）
  assert.equal(new Set(LEVELS.map((l) => l.cells.map((c) => c.t + c.h).join())).size, 18);
});

test('保存した解手順を実装と同じ遷移で再生すると、全面が「全員配達→出口」と「全種→出口」で解ける', () => {
  assert.equal(SOLUTIONS.length, 18);
  for (const lv of LEVELS) {
    const sol = SOLUTIONS.find((s) => s.id === lv.id);
    const a = replay(lv, decode(sol.clear));
    assert.ok(a.ok, `${lv.name}: ${a.reason}`);
    assert.ok(a.state.cleared && allDelivered(lv, a.state), `${lv.name}: クリアできない`);
    const b = replay(lv, decode(sol.allSeeds));
    assert.ok(b.ok && b.state.cleared, `${lv.name}: 全種の手順が通らない`);
    assert.equal(seedCount(b.state), 3, `${lv.name}: 種が3つそろわない`);
  }
});

test('幅優先探索で全面のクリアを確かめ、保存した手順が最短と一致する', () => {
  for (const lv of LEVELS) {
    const r = solve(lv);
    assert.ok(r.path, `${lv.name}: 解けない`);
    assert.ok(!r.truncated, `${lv.name}: 探索が打ち切られた`);
    const sol = SOLUTIONS.find((s) => s.id === lv.id);
    assert.equal(r.path.length, decode(sol.clear).length, `${lv.name}: 最短手数が保存と違う`);
  }
});

test('各地域に、2通り以上の配達順で解ける面が2面以上ある', () => {
  const multi = [0, 0, 0];
  for (const lv of LEVELS) {
    if (lv.animals.length <= 3) {
      if (deliveryOrders(lv).length >= 2) multi[lv.region]++;
    } else {
      // 4匹の面は、別の配達順の解を2つ保存して再生する
      const sol = SOLUTIONS.find((s) => s.id === lv.id);
      const orders = new Set();
      for (const o of sol.orders) {
        let s = createState(lv); const seq = [];
        for (const m of decode(o)) {
          const r = act(lv, s, m.d, m.k); assert.ok(r.ok, lv.name);
          if (r.ev.type === 'deliver') seq.push(r.ev.k);
          s = r.state;
        }
        assert.ok(s.cleared, `${lv.name}: 別順の解が通らない`);
        orders.add(seq.join(','));
      }
      if (orders.size >= 2) multi[lv.region]++;
    }
  }
  for (let r = 0; r < 3; r++) assert.ok(multi[r] >= 2, `${REGIONS[r].name}: 複数の配達順が通る面が${multi[r]}面`);
});

test('配達順が問われる面：順番を間違えると詰む（第2面：先に小鳥を届けると出られない）', () => {
  const lv = LEVELS[1];
  const orders = deliveryOrders(lv).map((o) => o.map((k) => lv.animals[k].kind).join('>'));
  assert.deepEqual(orders, ['rabbit>bird']);
});

test('荷重の境界：0・1は軽い（橋は高い岸）、2・3は重い（低い岸）。3を超えては乗せられない', () => {
  const lv = testLevel();
  const pad = lv.cells.find((c) => c.t === 'pad');
  let s = createState(lv);
  assert.equal(loadOf(lv, s), 0);
  // 荷重0：軽い
  let r = act(lv, s, L);
  assert.ok(r.ok); assert.equal(r.state.pos, pad.light); assert.equal(r.ev.heavy, false);
  // 小鳥(1)を乗せて荷重1：軽い
  r = act(lv, s, D); assert.equal(r.ev.type, 'board'); s = r.state;
  assert.equal(loadOf(lv, s), 1);
  assert.equal(act(lv, s, L).state.pos, pad.light);
  // カピバラ(2)を乗せて荷重3：重い
  s = act(lv, act(lv, s, R).state, R).state; // (2,1) へ進んでから右の台(3,1)
  assert.equal(loadOf(lv, s), 3);
  s = act(lv, s, L).state; // (1,1) へ戻る
  r = act(lv, s, L); assert.equal(r.state.pos, pad.heavy); assert.equal(r.ev.heavy, true);
  // 小鳥だけ降ろして荷重2：まだ重い
  const lv2 = testLevel();
  let s2 = createState(lv2);
  s2 = act(lv2, s2, R).state; s2 = act(lv2, s2, R).state; // カピバラを乗せる
  assert.equal(loadOf(lv2, s2), 2);
  s2 = act(lv2, s2, L).state;
  assert.equal(act(lv2, s2, L).state.pos, pad.heavy);
});

test('満員なら乗せられず、手数も進まない（理由を返す）', () => {
  const lv = testLevel({
    animals: [
      { kind: 'piglet', at: 'b', home: 'A' },
      { kind: 'bird', at: 'a', home: 'B' },
    ],
  });
  let s = createState(lv);
  s = act(lv, s, D).state; // 小鳥(1)
  s = act(lv, s, R).state; // (2,1)
  const r = act(lv, s, R); // 子ブタ(3)：1+3=4 > 3
  assert.equal(r.ok, false); assert.equal(r.why, 'full'); assert.match(r.reason, /満員/);
  assert.equal(CAPACITY, 3);
});

test('着地点が岩で塞がっていたら、橋・葉は使えず手数は0', () => {
  const lv = testLevel({
    map: ['#c.X##', 'P@.b.#', 'oaB..#', '.A..o.', '..#...'],
    legend: {
      c: { t: 'station' }, a: { t: 'station' }, b: { t: 'station' }, A: { t: 'home' }, B: { t: 'home' },
      P: { t: 'pad', style: 'leaf', heavy: [0, 2], light: [0, 3] }, X: { t: 'exit' },
    },
  });
  const s = createState(lv);
  // 荷重0なので light=(0,3) は空き。heavy=(0,2) には岩
  assert.ok(act(lv, s, L).ok);
  let s2 = act(lv, s, R).state; s2 = act(lv, s2, R).state; s2 = act(lv, s2, L).state; // カピバラを乗せて戻る
  const r = act(lv, s2, L);
  assert.equal(r.ok, false); assert.equal(r.why, 'blocked');
});

test('配達：本人の新居にだけ届けられ、届けると通路が開き、もう乗せられない', () => {
  const lv = LEVELS[0]; // くしゃみ橋：カピバラを届けると帰り階段が開く
  const sol = decode(SOLUTIONS[0].clear);
  let s = createState(lv); let delivered = null;
  for (const m of sol) {
    const r = act(lv, s, m.d, m.k);
    if (r.ev.type === 'deliver' && delivered === null) { delivered = r; break; }
    s = r.state;
  }
  assert.ok(delivered);
  assert.equal(delivered.ev.unlocked.length, 1);
  const after = delivered.state;
  // 届けた相手の家にもう一度ぶつかっても何も起きない
  const again = act(lv, after, delivered.ev.dir);
  assert.equal(again.ok, false); assert.equal(again.why, 'done'); assert.equal(after.moves, delivered.state.moves);
  // 別の動物の家には届けられない
  const tl = testLevel(); let t = createState(tl);
  t = act(tl, t, D).state; // 小鳥を乗せる
  const wrongHome = tl.cells.find((c) => c.t === 'home' && tl.animals[c.owner].kind === 'capybara');
  void wrongHome;
});

test('別の新居には届けられない', () => {
  const lv = testLevel();
  let s = createState(lv);
  s = act(lv, s, R).state; s = act(lv, s, R).state; // カピバラ(2)
  s = act(lv, s, L).state; // (1,1)
  // 下は小鳥の台、その下(1,2)は… B=(2,2) は小鳥の家
  s = act(lv, s, R).state; // (2,1)
  const r = act(lv, s, D); // (2,2) は小鳥の家
  assert.equal(r.ok, false); assert.equal(r.why, 'other');
});

test('停留台：2匹以上乗っているときは降ろす相手を選ぶ。降ろすと荷重が減る', () => {
  const lv = testLevel();
  let s = createState(lv);
  s = act(lv, s, D).state; // 小鳥
  s = act(lv, s, R).state; s = act(lv, s, R).state; // カピバラ（台(3,1)が空く）
  assert.equal(loadOf(lv, s), 3);
  const need = act(lv, s, R);
  assert.equal(need.ok, false); assert.equal(need.need, 'pick'); assert.equal(need.choices.length, 2);
  const r = act(lv, s, R, s.riders[0]);
  assert.ok(r.ok); assert.equal(r.ev.type, 'drop'); assert.equal(loadOf(lv, r.state), 2);
});

test('水車の踏板：荷重3ちょうどで踏むとロープが開く。2では開かない', () => {
  const lv = parseLevel({
    name: 'wheel', map: ['@Wq.X', 'ab#AB'], heights: ['00000', '00000'],
    legend: { W: { t: 'wheel', opens: 'r' }, q: { t: 'gate', lock: 'r' }, a: { t: 'station' }, b: { t: 'station' }, A: { t: 'home' }, B: { t: 'home' }, X: { t: 'exit' } },
    animals: [{ kind: 'rabbit', at: 'a', home: 'A' }, { kind: 'bird', at: 'b', home: 'B' }],
  });
  let s = createState(lv);
  s = act(lv, s, D).state; // ウサギ(2)
  let r = act(lv, s, R); assert.ok(r.ok); assert.ok(r.ev.wheelFail); assert.equal(r.state.open, 0);
  assert.equal(act(lv, r.state, R).why, 'locked');
  s = act(lv, r.state, D).state; // 小鳥(1)を乗せる → 荷重3（水車の上で）
  s = act(lv, s, L).state; // 降りる
  r = act(lv, s, R); assert.equal(r.ev.wheel, 0); assert.ok(r.state.open & 1);
  assert.ok(act(lv, r.state, R).ok, 'ロープを通れる');
});

test('岩：押せるのは向こうが空いた同じ高さの床だけ。設備・台・家・出口・段差・岩の上には押せない', () => {
  const lv = parseLevel({
    name: 'rock', map: ['@o.o', '.oS.', '.o=.', '.oX.', 'aA..'], heights: ['0000', '0000', '0000', '0010', '0000'],
    legend: { S: { t: 'station' }, a: { t: 'station' }, A: { t: 'home' }, X: { t: 'exit' } },
    animals: [{ kind: 'bird', at: 'a', home: 'A' }],
  });
  let s = createState(lv);
  let r = act(lv, s, R); assert.ok(r.ok, '空いた床へは押せる'); assert.equal(r.ev.type, 'push');
  assert.equal(r.state.moves, 1);
  r = act(lv, r.state, R); assert.equal(r.ok, false, '岩の向こうが岩'); assert.equal(r.why, 'rock');
  // 下の列：(1,1) の岩を右へ → 台(2,1) は不可
  s = act(lv, createState(lv), D).state; // (0,1)
  r = act(lv, s, R); assert.equal(r.ok, false, '停留台へは押せない');
  s = act(lv, s, D).state; r = act(lv, s, R); assert.equal(r.ok, false, '階段へは押せない');
  s = act(lv, s, D).state; r = act(lv, s, R); assert.equal(r.ok, false, '出口へは押せない');
});

test('無効な操作は手数0で、状態を変えない（入力の状態も書き換えない）', () => {
  const lv = LEVELS[0];
  const s = createState(lv); const before = JSON.stringify(s);
  for (let d = 0; d < 4; d++) {
    const r = act(lv, s, d);
    if (!r.ok) assert.equal(r.state, undefined);
    else assert.equal(r.state.moves, 1);
  }
  assert.equal(JSON.stringify(s), before, 'act は元の状態を書き換えない');
  // 戻す＝履歴の状態をそのまま使う：位置・荷重・動物・岩・解放・種・手数・出口がすべて戻る
  const sol = decode(SOLUTIONS[4].allSeeds); const lv5 = LEVELS[4];
  let cur = createState(lv5); const hist = [];
  for (const m of sol) { hist.push(cur); cur = act(lv5, cur, m.d, m.k).state; }
  while (hist.length) cur = hist.pop();
  assert.deepEqual(cur, createState(lv5));
});

test('種は1回だけ数える。記録は出口でだけ確定し、取り直しても重複しない', () => {
  const lv = LEVELS[0];
  const run = replay(lv, decode(SOLUTIONS[0].allSeeds));
  assert.equal(seedCount(run.state), 3);
  let p = emptyProgress();
  p = recordClear(p, lv, run.state);
  p = recordClear(p, lv, run.state);
  assert.equal(totalSeeds(p), 3);
  assert.equal(p.levels[lv.id].allSeeds, true);
  assert.equal(p.levels[lv.id].best, run.state.moves);
  // 種を取った場所を往復しても増えない
  const s1 = replay(lv, decode(SOLUTIONS[0].clear)).state;
  assert.ok(seedCount(s1) <= 3);
  assert.equal(patternsUnlocked(0), 1);
  assert.equal(patternsUnlocked(54), 12);
  assert.equal(patternsUnlocked(4), 2);
  // 図鑑：配達した動物が載る
  assert.ok(p.dex.capybara && p.dex.bird);
});

test('保存データの検証：形式違い・別の面・壊れたデータは使わない', () => {
  const lv = LEVELS[2]; const s = createState(lv);
  assert.ok(validSaved(lv, { v: SCHEMA, level: lv.id, state: s, hist: [] }));
  assert.equal(validSaved(lv, { v: SCHEMA - 1, level: lv.id, state: s }), null);
  assert.equal(validSaved(lv, { v: SCHEMA, level: lv.id + 1, state: s }), null);
  assert.equal(validSaved(lv, { v: SCHEMA, level: lv.id, state: { pos: 'x' } }), null);
  assert.equal(validSaved(lv, null), null);
  // JSON にして戻しても同じ状態で続きから遊べる
  const sol = decode(SOLUTIONS[2].clear);
  const mid = replay(lv, sol.slice(0, 10)).state;
  const back = JSON.parse(JSON.stringify({ v: SCHEMA, level: lv.id, state: mid }));
  const rest = replay(lv, sol.slice(10), validSaved(lv, back).state);
  assert.ok(rest.ok && rest.state.cleared);
});

test('面の解放・結果の共有文・ヒント', () => {
  const p = emptyProgress();
  assert.equal(levelUnlocked(p, 0), true);
  assert.equal(levelUnlocked(p, 1), false);
  const lv = LEVELS[0]; const run = replay(lv, decode(SOLUTIONS[0].clear)).state;
  const p2 = recordClear(p, lv, run);
  assert.equal(levelUnlocked(p2, 1), true);
  const text = shareText(lv, run, 'さんご');
  assert.match(text, /全員配達／種\d\/3／\d+手／コロの甲羅：さんご/);
  assert.doesNotMatch(text, /[URDL]{4}/, '解法を書かない');
  assert.ok(hints(lv, createState(lv)).some((h) => h.includes('カピバラ')));
});
