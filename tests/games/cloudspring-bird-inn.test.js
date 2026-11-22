import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAYS, TUNE, SPECIES, SPECIES_LIST, STORIES, ORNAMENTS, createState, cloneState, tick, applyEdit, checkEdit, metrics, summary,
  suppliedSet, heatUsed, tempScore, quietScore, chooseBath, evaluate, explain, baths, initialInn, innOf, buildable,
  pipeRoute, dexApply, emptyDex, ornamentCount, storyCount, itemAt, dayOf, sizeOf, capOf, FACILITIES,
} from '../../site/games/cloudspring-bird-inn/logic.js';
import { SOLUTIONS } from '../../site/games/cloudspring-bird-inn/solutions.js';

function play(day, inn, plan = []) {
  const s = createState(day, { inn });
  for (const [t, e] of plan) if (t < 0) assert.ok(applyEdit(s, e, { building: true }).ok, `第${day}日 準備の操作 ${JSON.stringify(e)}`);
  while (s.phase !== 'done') {
    for (const [t, e] of plan) if (t === s.t) assert.ok(applyEdit(s, e).ok, `第${day}日 ${t}秒の操作 ${JSON.stringify(e)}`);
    tick(s);
  }
  return s;
}

// 本編（宿を引き継ぐ）を保存した手順で第1日から順に遊ぶ
function campaign() {
  const out = []; let inn = initialInn();
  for (const d of DAYS) { const s = play(d.id, inn, SOLUTIONS[d.id]); out.push({ d, s, start: inn }); inn = innOf(s); }
  return out;
}
const CAMP = campaign();

// 自由に設備を置いた試し盤
function board(day, items, { pipes = [], money = 200, W, H } = {}) {
  const [w, h] = sizeOf(day);
  const inn = { W: W || w, H: H || h, money, nid: 100, pipes: Array.from({ length: H || h }, () => Array(W || w).fill(false)), items: items.map((it, i) => ({ id: i + 1, q: 0, dir: 'N', ...it })) };
  for (const [x, y] of pipes) inn.pipes[y][x] = true;
  const s = createState(day, { inn });
  items.forEach((it, i) => { if (it.q) s.items[i].q = it.q; }); // 朝は弁が閉じるので、試し盤では後から開ける
  return s;
}

test('全28日・12種・16設備・36話・10飾りがそろっている', () => {
  assert.equal(DAYS.length, 28);
  assert.deepEqual(DAYS.map((d) => d.id), Array.from({ length: 28 }, (_, i) => i + 1));
  assert.equal(SPECIES_LIST.length, 12);
  assert.equal(Object.keys(FACILITIES).length + 1, 16, '15種＋床下の管');
  for (const sp of SPECIES_LIST) { assert.equal(STORIES[sp].length, 3); for (const t of STORIES[sp]) assert.ok(t.length <= 60, `${sp}: ${t}`); }
  assert.equal(ORNAMENTS.length, 10);
  // 季節ごとの客の数 6/8/10/12、初登場の種は2羽以上
  for (const d of DAYS) {
    assert.equal(d.guests.length, { spring: 6, summer: 8, autumn: 10, winter: 12 }[d.season], `第${d.id}日の客の数`);
    for (const [sp, at] of d.guests) { assert.ok(SPECIES[sp].day <= d.id, `第${d.id}日に早すぎる ${sp}`); assert.ok(at >= 0 && at <= 88); }
    for (const sp of SPECIES_LIST.filter((k) => SPECIES[k].day === d.id)) assert.ok(d.guests.filter(([x]) => x === sp).length >= 2, `第${d.id}日 初登場の${sp}は2羽以上`);
  }
  // 強風の日
  assert.deepEqual(DAYS.filter((d) => d.strong).map((d) => d.id), [4, 7, 13, 15, 19, 21, 24, 25, 26, 28]);
});

test('季節の温度式：基温＋5q＋保温−強風（春25/夏30/秋20/冬15）', () => {
  for (const [day, base] of [[1, 25], [8, 30], [15, 20], [22, 15]]) {
    const s = board(day, [{ type: 'source', x: 2, y: 0 }, { type: 'bath', x: 2, y: 1, q: 2 }]);
    const m = metrics(s);
    const b = baths(s)[0];
    assert.equal(s.base, base);
    assert.equal(m[b.id].T, base + 10 - (s.strong && m[b.id].exposed ? 5 : 0));
  }
  // 第26日（冬・強風・北風）：風よけなしの保温の湯は 15+20+5−5=35、北の隣に北向きの風よけで40
  const s = board(26, [{ type: 'source', x: 2, y: 3 }, { type: 'hot', x: 2, y: 2, q: 4 }]);
  const hot = baths(s)[0];
  assert.equal(metrics(s)[hot.id].T, 35);
  assert.ok(applyEdit(s, { op: 'build', type: 'windbreak', x: 2, y: 1, dir: 'N' }, { building: true }).ok);
  assert.equal(metrics(s)[hot.id].T, 40);
  // 東向きでは北風を止めない
  applyEdit(s, { op: 'rotate', id: s.items.at(-1).id, dir: 'E' });
  assert.equal(metrics(s)[hot.id].T, 35);
  // 島の端で風上が外の湯は守れない（edge）
  const e = board(26, [{ type: 'source', x: 2, y: 1 }, { type: 'bath', x: 2, y: 0, q: 2 }]);
  const mm = metrics(e)[baths(e)[0].id];
  assert.equal(mm.exposed, true); assert.equal(mm.edge, true);
});

test('温度・静けさの評価', () => {
  assert.equal(tempScore('swan', 45), 1);
  assert.equal(tempScore('swan', 35), 0.5);
  assert.equal(tempScore('swan', 20), 0);
  assert.equal(quietScore(0), 1); assert.equal(quietScore(1), 0.5); assert.equal(quietScore(2), 0);
});

test('弁の合計は源泉の容量まで（春夏6・秋冬8）。超える操作は拒否して残りを伝える', () => {
  assert.equal(capOf(1), 6); assert.equal(capOf(14), 6); assert.equal(capOf(15), 8); assert.equal(capOf(28), 8);
  const s = createState(1, { inn: initialInn() });
  const [a, b] = baths(s);
  assert.ok(applyEdit(s, { op: 'valve', id: a.id, q: 4 }).ok);
  assert.equal(heatUsed(s), 5);
  const r = checkEdit(s, { op: 'valve', id: b.id, q: 3 });
  assert.equal(r.ok, false); assert.match(r.reason, /残り1/);
  assert.equal(heatUsed(s), 5, '拒否したら変わらない（他から勝手に奪わない）');
});

test('毎朝、弁は閉じた状態から始まる（第1日の手引きだけ少し張ってある）', () => {
  const s1 = createState(1, { inn: initialInn() });
  assert.ok(baths(s1).every((b) => b.q === 1));
  const inn = innOf(CAMP[0].s);
  assert.ok(baths(createState(2, { inn })).every((b) => b.q === 0));
});

test('管が切れた浴槽は弁が閉じ、合計と一致する', () => {
  const s = createState(1, { inn: initialInn() });
  const left = s.items.find((i) => i.name === '左の湯');
  assert.ok(suppliedSet(s).has(left.id));
  assert.ok(applyEdit(s, { op: 'unpipe', x: 1, y: 1 }, { building: true }).ok);
  assert.ok(applyEdit(s, { op: 'unpipe', x: 2, y: 1 }, { building: true }).ok);
  assert.equal(suppliedSet(s).has(left.id), false);
  assert.equal(left.q, 0);
  assert.equal(checkEdit(s, { op: 'valve', id: left.id, q: 1 }).ok, false);
});

test('浴槽を建てると、源泉までの管を自動で引き、その分のお金がかかる', () => {
  const s = createState(1, { inn: initialInn() });
  const route = pipeRoute(s, 0, 3);
  assert.ok(route.length >= 1);
  const before = s.money;
  const r = applyEdit(s, { op: 'build', type: 'bath', x: 0, y: 3 }, { building: true });
  assert.ok(r.ok);
  assert.equal(before - s.money, 20 + route.length * TUNE.pipeCost);
  const nb = itemAt(s, 0, 3);
  assert.ok(suppliedSet(s).has(nb.id), '新しい浴槽に湯が届く');
});

test('閉じた湯（q=0）は選ばれず、熱すぎる・ぬるすぎる湯にも入らない', () => {
  const s = createState(1, { inn: initialInn() });
  s.phase = 'open';
  tick(s); // 白鳥が来る。両方30度でぬるい
  const swan = s.guests[0];
  assert.equal(swan.st, 'wait');
  assert.match(swan.why, /ぬるすぎ/);
  assert.equal(chooseBath(s, swan).best, null);
});

test('入口から浴槽への道をふさぐ配置は拒否する', () => {
  const s = createState(1, { inn: initialInn() });
  assert.ok(applyEdit(s, { op: 'build', type: 'windbreak', x: 1, y: 0 }, { building: true }).ok);
  const r = checkEdit(s, { op: 'build', type: 'windbreak', x: 0, y: 1 }, { building: true });
  assert.equal(r.ok, false);
  assert.match(r.reason, /ふさが/);
});

test('営業中は建設できない（停止中だけ）。弁と風よけの回転はできる', () => {
  const s = createState(4, { inn: initialInn() });
  applyEdit(s, { op: 'build', type: 'windbreak', x: 1, y: 1, dir: 'N' }, { building: true });
  s.phase = 'open';
  const wb = s.items.at(-1);
  assert.equal(checkEdit(s, { op: 'move', id: 2, x: 0, y: 3 }, { building: false }).ok, false);
  assert.equal(checkEdit(s, { op: 'build', type: 'bath', x: 0, y: 3 }, { building: false }).ok, false);
  assert.equal(checkEdit(s, { op: 'rotate', id: wb.id, dir: 'E' }).ok, true);
  assert.equal(checkEdit(s, { op: 'move', id: 2, x: 0, y: 3 }, { building: true }).ok, true);
});

test('建てられる設備は日ごとに増える（設計の解放日）', () => {
  assert.deepEqual(buildable(1), ['bath', 'windbreak']);
  assert.ok(buildable(3).includes('fence') && buildable(3).includes('teahouse'));
  assert.ok(buildable(5).includes('chair') && buildable(5).includes('sign'));
  assert.ok(buildable(8).includes('shallow') && buildable(8).includes('group'));
  assert.ok(buildable(11).includes('flower') && buildable(11).includes('stage'));
  assert.ok(buildable(15).includes('hot') && buildable(15).includes('view'));
  assert.equal(buildable(18).length, 14, '源泉以外の14種（ほかに床下の管）');
  const s = createState(2, { inn: innOf(CAMP[0].s) });
  assert.equal(checkEdit(s, { op: 'build', type: 'fence', x: 0, y: 3 }, { building: true }).ok, false);
});

test('島は 4×4→4×5→5×5→6×6 に広がり、入口と設備はそのまま', () => {
  assert.deepEqual([sizeOf(1), sizeOf(8), sizeOf(15), sizeOf(22)], [[4, 4], [4, 5], [5, 5], [6, 6]]);
  const end7 = CAMP[6].s;
  const s8 = createState(8, { inn: innOf(end7) });
  assert.equal(s8.W * s8.H, 20);
  assert.deepEqual(s8.items.map((i) => [i.type, i.x, i.y]), end7.items.map((i) => [i.type, i.x, i.y]));
});

test('席の数を超えて予約しない（浅湯は1席・団体湯は3席）', () => {
  const s = board(12, [{ type: 'source', x: 2, y: 0 }, { type: 'shallow', x: 2, y: 1, q: 2 }, { type: 'group', x: 3, y: 2, q: 1 }], { pipes: [[3, 0], [3, 1]] });
  for (const x of s.guests) x.at = 999;
  for (const i of [0, 1, 2, 3]) s.guests[i].at = 0; // アヒル4羽が同時に
  s.phase = 'open'; tick(s);
  const sh = s.items.find((i) => i.type === 'shallow'); const gr = s.items.find((i) => i.type === 'group');
  const on = (b) => s.guests.filter((x) => (x.st === 'walk' || x.st === 'bath') && x.target === b.id).length;
  assert.equal(on(sh), 1); assert.equal(on(gr), 3);
});

test('入浴中の客がいる浴槽は移動・撤去できない', () => {
  const s = createState(1, { inn: initialInn() });
  applyEdit(s, { op: 'valve', id: 2, q: 3 });
  s.phase = 'open';
  for (let i = 0; i < 6; i++) tick(s);
  const swan = s.guests[0];
  assert.equal(swan.st, 'bath');
  assert.equal(checkEdit(s, { op: 'move', id: swan.target, x: 0, y: 3 }, { building: true }).ok, false);
  assert.equal(checkEdit(s, { op: 'remove', id: swan.target }, { building: true }).ok, false);
});

test('予約中に弁が閉じたら、待ちに戻る', () => {
  const s = createState(1, { inn: initialInn() });
  applyEdit(s, { op: 'valve', id: 2, q: 3 });
  s.phase = 'open'; tick(s);
  const swan = s.guests[0];
  assert.equal(swan.st, 'walk');
  applyEdit(s, { op: 'valve', id: 2, q: 0 });
  tick(s);
  assert.equal(swan.st, 'wait');
});

test('騒音：にぎやかな鳥・茶店・お祭り台は隣の湯をうるさくし、吸音垣で1減る', () => {
  const s = board(18, [{ type: 'source', x: 4, y: 0 }, { type: 'bath', x: 2, y: 1, q: 3 }, { type: 'teahouse', x: 3, y: 1 }, { type: 'stage', x: 1, y: 1 }], { pipes: [[3, 0], [2, 0]] });
  const b = baths(s)[0];
  assert.equal(metrics(s)[b.id].noise, 2);
  applyEdit(s, { op: 'build', type: 'fence', x: 2, y: 2 }, { building: true });
  const owl = { id: 99, sp: 'owl' };
  assert.equal(evaluate(s, owl, b, metrics(s)).noise, 1);
  // お祭り台の隣で、ツバメは+10
  const sw = { id: 98, sp: 'swallow' };
  assert.equal(evaluate(s, sw, b, metrics(s)).bonus, 10);
});

test('眺望：建物でふさがれると×、花壇で△、展望湯は風よけごしに見え、湯気は風下の景色を消す', () => {
  // 四方を囲んだ浴槽
  const s = board(18, [{ type: 'source', x: 2, y: 0 }, { type: 'bath', x: 2, y: 2, q: 1 }, { type: 'fence', x: 1, y: 2 }, { type: 'fence', x: 3, y: 2 }, { type: 'windbreak', x: 2, y: 3 }], { pipes: [[2, 1]] });
  const b = baths(s)[0];
  assert.equal(metrics(s)[b.id].view, 0);
  assert.ok(applyEdit(s, { op: 'remove', id: 3 }, { building: true }).ok);
  assert.ok(applyEdit(s, { op: 'build', type: 'flower', x: 1, y: 2 }, { building: true }).ok);
  assert.equal(metrics(s)[b.id].view, 0.5, '花壇で半分');
  // 展望湯：風よけごしに見える
  const v = board(18, [{ type: 'source', x: 2, y: 0 }, { type: 'view', x: 2, y: 2, q: 1 }, { type: 'fence', x: 1, y: 2 }, { type: 'fence', x: 3, y: 2 }, { type: 'windbreak', x: 2, y: 3 }], { pipes: [[2, 1]] });
  assert.equal(metrics(v)[baths(v)[0].id].view, 1);
  // 湯気：南風の日（第18日は南風）、弁3の湯の北どなりの湯は景色0
  const st = board(18, [{ type: 'source', x: 0, y: 2 }, { type: 'bath', x: 1, y: 2, q: 3 }, { type: 'bath', x: 1, y: 1, q: 1 }], { pipes: [[0, 1]] });
  const [low, up] = [baths(st)[0], baths(st)[1]];
  const m = metrics(st);
  assert.equal(m[up.id].view, 0); assert.equal(m[up.id].steamBy, low.id);
});

test('茶店：湯上がりの客が寄ると+2、休憩椅子：座ると10秒長く待てる', () => {
  const s = board(5, [{ type: 'source', x: 2, y: 0 }, { type: 'bath', x: 2, y: 1, q: 3 }, { type: 'teahouse', x: 0, y: 2 }, { type: 'chair', x: 1, y: 2 }]);
  for (const x of s.guests) x.at = 999;
  s.guests[0].at = 0; s.guests[1].at = 0; s.guests[4].at = 0; // 白鳥3羽（席は2）
  s.phase = 'open';
  let sat = false; let tea = 0;
  while (s.phase !== 'done') { const ev = tick(s); if (ev.some((e) => e.type === 'sit')) sat = true; tea += ev.filter((e) => e.type === 'teaDone').length; }
  assert.ok(sat, '3羽目は椅子に座った');
  assert.equal(s.guests[4].limit, TUNE.waitLimit + TUNE.chairBonus);
  assert.ok(tea >= 1, '茶店に寄った');
  assert.equal(s.teaMoney, tea * TUNE.teaFee);
});

test('案内板：隣の湯を選びやすくする', () => {
  const mk = (withSign) => {
    const items = [{ type: 'source', x: 3, y: 1 }, { type: 'bath', x: 2, y: 1, q: 3 }, { type: 'bath', x: 1, y: 3, q: 3 }];
    if (withSign) items.push({ type: 'sign', x: 2, y: 3 });
    const s = board(5, items, { pipes: [[3, 2], [3, 3], [2, 3]] });
    s.phase = 'open'; tick(s);
    return s.guests[0].target;
  };
  assert.equal(mk(false), 2, '近い湯');
  assert.equal(mk(true), 3, '案内板のある遠い湯');
});

test('鳥の説明に、お湯・声・景色の理由が出る（風で冷えたことも）', () => {
  const s = createState(1, { inn: initialInn() });
  applyEdit(s, { op: 'valve', id: 2, q: 3 });
  s.phase = 'open';
  for (let i = 0; i < 6; i++) tick(s);
  const t = explain(s, s.guests[0]);
  assert.match(t, /お湯○/); assert.match(t, /声/); assert.match(t, /景色/);
  const w = createState(4, { inn: initialInn() });
  applyEdit(w, { op: 'valve', id: 2, q: 4 });
  w.phase = 'open';
  for (let i = 0; i < 6; i++) tick(w);
  assert.match(explain(w, w.guests[0]), /風で−5/);
});

test('何もしないと、どの日も達成できない（本編の宿でも、最初の宿でも）', () => {
  for (const c of CAMP) assert.equal(summary(play(c.d.id, c.start)).cleared, false, `第${c.d.id}日（本編の宿）`);
  for (const d of DAYS) assert.equal(summary(play(d.id, { ...initialInn(), money: 150 })).cleared, false, `第${d.id}日（最初の宿）`);
});

test('全28日に、達成できる手順がある（本編：宿を引き継いで第1日から順に再生）', () => {
  for (const c of CAMP) {
    const sm = summary(c.s);
    assert.ok(sm.cleared, `第${c.d.id}日：${sm.good}/${sm.n}`);
  }
});

test('第4日：風よけを置くと、風で冷えた湯が5度戻る（手引きの流れ）', () => {
  const s = createState(4, { inn: initialInn() });
  const m = metrics(s);
  const cold = baths(s).filter((b) => m[b.id].exposed);
  assert.ok(cold.length >= 1, '北風で冷える湯がある');
  const b = cold.find((x) => x.y > 0);
  applyEdit(s, { op: 'valve', id: b.id, q: 3 });
  const T0 = metrics(s)[b.id].T;
  assert.ok(applyEdit(s, { op: 'build', type: 'windbreak', x: b.x, y: b.y - 1, dir: 'N' }, { building: true }).ok);
  assert.equal(metrics(s)[b.id].T, T0 + 5);
});

test('冬の強風日：弁だけでは届かず、配置を変えると届く（最初の宿から）', () => {
  for (const day of [24, 26, 28]) {
    const inn = { ...initialInn(), money: 150 };
    // 弁だけ：白鳥の湯を最大まで
    const s = createState(day, { inn });
    const [a, b] = baths(s);
    const valveOnly = play(day, inn, [[0, { op: 'valve', id: a.id, q: 4 }], [0, { op: 'valve', id: b.id, q: 2 }]]);
    assert.equal(summary(valveOnly).cleared, false, `第${day}日 弁だけ`);
  }
});

test('同じ手順なら同じ結果（決定的）。複製しても同じ続きになる', () => {
  const c = CAMP[25];
  const a = play(c.d.id, c.start, SOLUTIONS[26]); const b = play(c.d.id, c.start, SOLUTIONS[26]);
  assert.deepEqual(a.guests.map((x) => x.sat), b.guests.map((x) => x.sat));
  const s = createState(26, { inn: c.start }); s.phase = 'open';
  for (let i = 0; i < 30; i++) tick(s);
  const d = cloneState(s);
  for (let i = 0; i < 40; i++) { tick(s); tick(d); }
  assert.deepEqual(s, d);
});

test('日のやり直しは開始時の宿から（資金・図鑑が増えない）。所持金は最低40', () => {
  const c = CAMP[9];
  const again = createState(c.d.id, { inn: c.start });
  assert.equal(again.money, Math.max(c.start.money, TUNE.supportMoney));
  const poor = createState(5, { inn: { ...initialInn(), money: 3 } });
  assert.equal(poor.money, TUNE.supportMoney);
  // 失敗した日は図鑑に入れない（UI は日クリア時だけ dexApply を呼ぶ）。同じ結果を2回入れると数は増えるが、話は二重に開かない
  const r1 = dexApply(emptyDex(), CAMP[0].s);
  const r2 = dexApply(r1.dex, CAMP[0].s);
  assert.ok(r1.news.length > 0);
  assert.ok(r2.news.every((n) => !r1.news.some((o) => o.sp === n.sp && o.k === n.k)));
});

test('図鑑：本編と日のやり直しで、36話すべてと屋根飾り10種が取れる', () => {
  let dex = emptyDex();
  for (const c of CAMP) dex = dexApply(dex, c.s).dex;
  // 本編だけで足りない第三話は、その種が2羽以上来る日をやり直して90点以上にすれば取れる
  for (const sp of SPECIES_LIST) {
    for (let k = 0; k < 3; k++) {
      if (dex[sp].s[k]) continue;
      const day = DAYS.find((d) => d.guests.filter(([x]) => x === sp).length >= 2 && CAMP[d.id - 1].s.guests.filter((x) => x.sp === sp && x.sat >= (k === 2 ? TUNE.greatLine : TUNE.passLine)).length >= (k === 2 ? 2 : 1));
      assert.ok(day, `${SPECIES[sp].name} 第${k + 1}話を取れる日がない`);
      dex = dexApply(dex, CAMP[day.id - 1].s).dex;
    }
  }
  assert.equal(storyCount(dex), 36);
  assert.equal(ornamentCount(dex), 10);
});

test('速さ（1倍・2倍）は見た目だけで、結果は同じ（1秒ずつ同じ順に進む）', () => {
  const c = CAMP[14];
  const a = play(c.d.id, c.start, SOLUTIONS[15]);
  // 2倍速は「1フレームで2回 tick」と同じ
  const s = createState(15, { inn: c.start });
  for (const [t, e] of SOLUTIONS[15]) if (t < 0) applyEdit(s, e, { building: true });
  while (s.phase !== 'done') {
    for (let k = 0; k < 2 && s.phase !== 'done'; k++) { for (const [t, e] of SOLUTIONS[15]) if (t === s.t) applyEdit(s, e); tick(s); }
  }
  assert.deepEqual(a.guests.map((x) => x.sat), s.guests.map((x) => x.sat));
});

test('dayOf と需要表の風向き', () => {
  for (const d of DAYS) { assert.ok(['N', 'E', 'S', 'W'].includes(d.wind[0])); assert.ok(['N', 'E', 'S', 'W'].includes(d.wind[1])); assert.notEqual(d.wind[0], d.wind[1]); }
  assert.equal(dayOf(26).name, '白鳥と氷の客');
});
