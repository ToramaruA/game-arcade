import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAYS, TUNE, createState, cloneState, tick, applyEdit, checkEdit, metrics, summary, suppliedSet, heatUsed,
  tempScore, quietScore, chooseBath, evaluate, explain, baths,
} from '../../site/games/cloudspring-bird-inn/logic.js';
import { SOLUTIONS } from '../../site/games/cloudspring-bird-inn/solutions.js';

function play(day, plan = []) {
  const s = createState(day);
  for (const [t, e] of plan) if (t < 0) assert.ok(applyEdit(s, e, { building: true }).ok, `準備の操作 ${JSON.stringify(e)}`);
  while (s.phase !== 'done') {
    for (const [t, e] of plan) if (t === s.t) assert.ok(applyEdit(s, e).ok, `${t}秒の操作 ${JSON.stringify(e)}`);
    tick(s);
  }
  return s;
}

test('4季節の温度式：基温＋5q＋保温−強風', () => {
  const s = createState(26);
  const m = metrics(s);
  const hot = s.items.find((i) => i.type === 'hot');
  const sh = s.items.find((i) => i.type === 'shallow');
  assert.equal(m[hot.id].T, 15 + 20 + 5 - 5, '保温の湯は北風にさらされて35度');
  assert.equal(m[hot.id].exposed, true);
  assert.equal(m[sh.id].T, 15 + 10 - 5, '浅湯は風よけに守られて20度');
  assert.equal(m[sh.id].exposed, false);
  const d1 = createState(1); const m1 = metrics(d1);
  for (const b of baths(d1)) assert.equal(m1[b.id].T, 30, '春 基温25＋弁1');
});

test('温度・静けさの評価', () => {
  assert.equal(tempScore('swan', 45), 1);
  assert.equal(tempScore('swan', 35), 0.5);
  assert.equal(tempScore('swan', 20), 0);
  assert.equal(quietScore(0), 1); assert.equal(quietScore(1), 0.5); assert.equal(quietScore(2), 0);
});

test('弁の合計は源泉の容量まで。超える操作は拒否して残りを伝える', () => {
  const s = createState(1);
  const [a, b] = baths(s);
  assert.ok(applyEdit(s, { op: 'valve', id: a.id, q: 4 }).ok);
  assert.equal(heatUsed(s), 5);
  const r = checkEdit(s, { op: 'valve', id: b.id, q: 3 });
  assert.equal(r.ok, false); assert.match(r.reason, /残り1/);
  assert.equal(heatUsed(s), 5, '拒否したら変わらない（他から勝手に奪わない）');
});

test('管が切れた浴槽は弁が閉じ、合計と一致する', () => {
  const s = createState(1);
  const left = s.items.find((i) => i.name === '左の湯');
  assert.ok(suppliedSet(s).has(left.id));
  assert.ok(applyEdit(s, { op: 'unpipe', x: 1, y: 1 }, { building: true }).ok);
  assert.ok(applyEdit(s, { op: 'unpipe', x: 2, y: 1 }, { building: true }).ok);
  assert.equal(suppliedSet(s).has(left.id), false);
  assert.equal(left.q, 0);
  assert.equal(checkEdit(s, { op: 'valve', id: left.id, q: 1 }).ok, false);
});

test('閉じた湯（q=0）は選ばれず、熱すぎる湯にも入らない', () => {
  const s = createState(1);
  s.phase = 'open';
  tick(s); // 白鳥が来る。両方30度でぬるい
  const swan = s.guests[0];
  assert.equal(swan.st, 'wait');
  assert.match(swan.why, /ぬるすぎ/);
  const { best } = chooseBath(s, swan);
  assert.equal(best, null);
});

test('入口から浴槽への道をふさぐ配置は拒否する', () => {
  const s = createState(1);
  // 入口 (0,0) の隣を両方ふさぐ
  assert.ok(applyEdit(s, { op: 'build', type: 'windbreak', x: 1, y: 0 }, { building: true }).ok);
  const r = checkEdit(s, { op: 'build', type: 'windbreak', x: 0, y: 1 }, { building: true });
  assert.equal(r.ok, false);
  assert.match(r.reason, /ふさが/);
});

test('営業中は建設できない（停止中だけ）。弁と風よけの回転はできる', () => {
  const s = createState(26);
  s.phase = 'open';
  assert.equal(checkEdit(s, { op: 'move', id: 2, x: 2, y: 1 }, { building: false }).ok, false);
  assert.equal(checkEdit(s, { op: 'rotate', id: 5, dir: 'N' }).ok, true);
  assert.equal(checkEdit(s, { op: 'move', id: 2, x: 2, y: 1 }, { building: true }).ok, true);
});

test('席の数を超えて予約しない（浅湯は1席）', () => {
  const s = createState(26);
  // ペンギンを同時に3羽来させる
  for (const g of s.guests) g.at = 999;
  s.guests[1].at = 0; s.guests[4].at = 0; s.guests[9].at = 0;
  s.phase = 'open'; tick(s);
  const sh = s.items.find((i) => i.type === 'shallow');
  const onSh = s.guests.filter((g) => (g.st === 'walk' || g.st === 'bath') && g.target === sh.id);
  assert.equal(onSh.length, 1);
});

test('入浴中の客がいる浴槽は移動・撤去できない', () => {
  const s = createState(1);
  applyEdit(s, { op: 'valve', id: 2, q: 3 });
  s.phase = 'open';
  for (let i = 0; i < 6; i++) tick(s);
  const swan = s.guests[0];
  assert.equal(swan.st, 'bath');
  assert.equal(checkEdit(s, { op: 'move', id: swan.target, x: 0, y: 3 }, { building: true }).ok, false);
  assert.equal(checkEdit(s, { op: 'remove', id: swan.target }, { building: true }).ok, false);
});

test('予約中に弁が閉じたら、待ちに戻る', () => {
  const s = createState(1);
  applyEdit(s, { op: 'valve', id: 2, q: 3 });
  s.phase = 'open'; tick(s);
  const swan = s.guests[0];
  assert.equal(swan.st, 'walk');
  applyEdit(s, { op: 'valve', id: 2, q: 0 });
  tick(s);
  assert.equal(swan.st, 'wait');
});

test('鳥の説明に、お湯・声・景色の理由が出る', () => {
  const s = createState(1);
  applyEdit(s, { op: 'valve', id: 2, q: 3 });
  s.phase = 'open';
  for (let i = 0; i < 6; i++) tick(s);
  const t = explain(s, s.guests[0]);
  assert.match(t, /お湯○/); assert.match(t, /声/); assert.match(t, /景色/);
});

test('何もしないと、どの日も達成できない', () => {
  for (const d of DAYS) assert.equal(summary(play(d.id)).cleared, false, `第${d.id}日`);
});

test('全日に、達成できる手順がある（保存した手順を再生）', () => {
  for (const d of DAYS) {
    const s = play(d.id, SOLUTIONS[d.id]);
    const sm = summary(s);
    assert.ok(sm.cleared, `第${d.id}日：${sm.good}/${sm.n}`);
  }
});

test('第26日：弁だけでは届かず、配置を変えると届く', () => {
  // 弁だけの代表的な手：展望湯に2、風が変わったら浅湯を上げる
  const s = play(26, [[0, { op: 'valve', id: 4, q: 2 }], [60, { op: 'valve', id: 4, q: 1 }], [60, { op: 'valve', id: 3, q: 3 }]]);
  assert.equal(summary(s).cleared, false);
  const best = play(26, SOLUTIONS[26]);
  assert.ok(summary(best).good >= summary(s).good + 4);
});

test('同じ手順なら同じ結果（決定的）。複製しても同じ続きになる', () => {
  const a = play(26, SOLUTIONS[26]); const b = play(26, SOLUTIONS[26]);
  assert.deepEqual(a.guests.map((g) => g.sat), b.guests.map((g) => g.sat));
  const s = createState(26); s.phase = 'open';
  for (let i = 0; i < 30; i++) tick(s);
  const c = cloneState(s);
  for (let i = 0; i < 40; i++) { tick(s); tick(c); }
  assert.deepEqual(s, c);
});

test('日のやり直しは開始状態から（資金が増えない）', () => {
  const s = play(26, SOLUTIONS[26]);
  assert.ok(s.money > 0);
  const again = createState(26);
  assert.equal(again.money, DAYS.find((d) => d.id === 26).money);
  assert.ok(again.money >= TUNE.supportMoney);
});
