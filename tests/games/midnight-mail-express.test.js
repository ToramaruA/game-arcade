import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../site/games/midnight-mail-express/logic.js';

const mk = (over = {}) => ({ kind: 0, first: 0, ok: [1, 2], ng: [3], board: 0, mystery: false, ...over });
function fakeRun(passengers, stations = [0, 1, 2, 4]) {
  const tpl = {
    id: 5, line: 1, idx: 0, name: 't', pairs: [[stations[0], 9], [stations[1], 9], [stations[2], 9]], terminal: stations[3],
    passengers, need: 1, T: 10, cap: 3, maxStars: 10, thresholds: [6, 8, 10],
  };
  const r = L.createRun(tpl, () => 0.9); // mirror なし
  return r;
}

test('15便・3路線・12種の客・12駅', () => {
  assert.equal(L.RUNS.length, 15);
  assert.equal(L.LINES.length, 3);
  assert.equal(L.STATIONS.length, 12);
  assert.equal(L.KINDS.length, 12);
  L.LINES.forEach((l) => assert.equal(l.runs.length, 5));
});

test('15便それぞれに到達可能なクリア経路がある（全探索）', () => {
  for (const t of L.RUNS) {
    const s = L.solve(t);
    assert.ok(s.maxCorrect >= t.need, `便${t.id}: 最大${s.maxCorrect}人 < 必要${t.need}人`);
    assert.equal(t.pairs.length, 3);
    for (const [a, b] of t.pairs) assert.notEqual(a, b);
    assert.equal(new Set([...t.pairs.flat(), t.terminal]).size, 7, '駅の重複なし');
    assert.deepEqual(t.thresholds, [Math.ceil(s.maxStars * 0.6), Math.ceil(s.maxStars * 0.8), s.maxStars]);
    t.passengers.forEach((p) => {
      assert.ok(!p.ok.includes(p.first) && p.ok.length >= 2, '許容駅は第1希望と別で2つ以上');
      assert.ok(!p.ng.includes(p.first) && p.ng.every((n) => !p.ok.includes(n)), '禁止駅は希望と重ならない');
    });
  }
});

test('少なくとも1便は、全員を第1希望へ届ける経路が存在しない（駅の取捨選択が必要）', () => {
  const dil = L.RUNS.filter((t) => !L.solve(t).allFirst);
  assert.ok(dil.length >= 10, `競合する便 ${dil.length}`);
  assert.equal(L.solve(L.RUNS[3]).allFirst, false);
});

test('第1希望・許容・禁止・それ以外の判定', () => {
  const p = mk();
  assert.deepEqual(L.evaluateDrop(p, 0), { type: 'first', stars: 2, regret: -1 });
  assert.deepEqual(L.evaluateDrop(p, 2), { type: 'ok', stars: 1, regret: -1 });
  assert.deepEqual(L.evaluateDrop(p, 3), { type: 'ng', stars: 0, regret: 2 });
  assert.deepEqual(L.evaluateDrop(p, 3, true), { type: 'ng', stars: 0, regret: 1 });
  assert.deepEqual(L.evaluateDrop(p, 7), { type: 'wrong', stars: 0, regret: 1 });
});

test('降車窓の境界：到着2秒前〜2秒後', () => {
  assert.equal(L.inWindow(7.99, 10), false);
  assert.equal(L.inWindow(8, 10), true);
  assert.equal(L.inWindow(12, 10), true);
  assert.equal(L.inWindow(12.01, 10), false);
  assert.equal(L.isLocked(6.7, 10), false);
  assert.equal(L.isLocked(6.8, 10), true);
});

test('降車は窓の中だけ。連打しても二重降車しない', () => {
  const r = fakeRun([mk()]);
  assert.equal(L.dropPassenger(r, 0), null, '窓の外では降りられない');
  L.arrive(r);
  const e = L.dropPassenger(r, 0);
  assert.equal(e.result.type, 'first');
  assert.equal(L.dropPassenger(r, 0), null, '2回目は無視');
  assert.equal(r.correct, 1); assert.equal(r.stars, 2);
});

test('予約：窓の外で押すと、到着時に1名だけ自動で降りる', () => {
  const r = fakeRun([mk(), mk({ kind: 1, first: 0 })]);
  assert.ok(L.reserve(r, 0));
  assert.ok(L.reserve(r, 1)); // 予約は1名分（上書き）
  const ev = L.arrive(r);
  assert.equal(ev.length, 1); assert.equal(ev[0].passenger.id, 1);
  assert.equal(L.aboard(r).length, 1);
});

test('分岐：降車判定は実際に選んだ路線の駅ID。固定後は切り替えられない', () => {
  const r = fakeRun([mk({ first: 9, ok: [5, 6] })], [0, 1, 2, 4]);
  const [l, rt] = L.pairAt(r, 0); assert.deepEqual([l, rt], [0, 9]);
  assert.ok(L.setSwitch(r, 1)); assert.equal(L.stationAt(r, 0), 9);
  L.lockSwitch(r); assert.equal(L.setSwitch(r, 0), false); assert.equal(L.stationAt(r, 0), 9);
  L.arrive(r); assert.equal(L.dropPassenger(r, 0).result.type, 'first');
});

test('未練：正しい降車で-1、誤降車で+1、禁止駅+2、6で終了、3連続ミスで終了', () => {
  const ps = [mk({ first: 0, ng: [0] }), mk({ kind: 1 }), mk({ kind: 2 })];
  const r = fakeRun(ps);
  L.arrive(r);
  // 全員、0駅で降ろす: p0 は first なので正解…ng と first は排他なので別データで試す
  const r2 = fakeRun([mk({ first: 9, ok: [8, 7], ng: [0] }), mk({ kind: 1, first: 9, ok: [8, 7], ng: [0] }), mk({ kind: 2, first: 9, ok: [8, 7], ng: [0] })]);
  L.arrive(r2);
  L.dropPassenger(r2, 0); assert.equal(r2.regret, 2);
  L.dropPassenger(r2, 1); assert.equal(r2.regret, 4);
  L.dropPassenger(r2, 2); assert.equal(r2.regret, 6);
  assert.ok(r2.finished); assert.equal(r2.outcome.reason, 'regret'); assert.equal(r2.outcome.cleared, false);
  // 3連続ミス（誤降車 +1 ずつ）
  const r3 = fakeRun([mk({ first: 9, ok: [8, 7], ng: [] }), mk({ kind: 1, first: 9, ok: [8, 7], ng: [] }), mk({ kind: 2, first: 9, ok: [8, 7], ng: [] })]);
  L.arrive(r3); L.dropPassenger(r3, 0); L.dropPassenger(r3, 1); assert.equal(r3.finished, false); L.dropPassenger(r3, 2);
  assert.equal(r3.outcome.reason, 'miss');
  assert.match(L.failText(r3), /3回続けて/);
  // 正解で未練が減り、0未満にならない
  const r4 = fakeRun([mk(), mk({ kind: 1, first: 9, ok: [8, 7], ng: [] })]);
  L.arrive(r4); L.dropPassenger(r4, 1); assert.equal(r4.regret, 1); L.dropPassenger(r4, 0); assert.equal(r4.regret, 0);
});

test('降ろし忘れは終点で未練+1。次の便から立て直せる', () => {
  const r = fakeRun([mk({ first: 7, ok: [8, 6] })]);
  for (let i = 0; i < 4; i++) { L.arrive(r); const c = L.closeWindow(r); if (i < 3) assert.equal(c.finished, false); else assert.equal(c.finished, true); }
  assert.equal(r.regret, 1); assert.equal(r.left, 1); assert.equal(r.outcome.cleared, false);
});

test('乗車：同時に乗れるのは定員まで。降りると次の客が乗る', () => {
  const ps = [0, 1, 2, 3].map((i) => mk({ kind: i, first: 0, board: 0 }));
  const tpl = { id: 5, line: 1, idx: 0, name: 't', pairs: [[0, 9], [1, 9], [2, 9]], terminal: 4, passengers: ps, need: 1, T: 10, cap: 3, maxStars: 8, thresholds: [5, 7, 8] };
  const r = L.createRun(tpl, () => 0.9);
  assert.equal(L.aboard(r).length, 3);
  assert.equal(new Set(L.aboard(r).map((p) => p.slot)).size, 3);
  L.arrive(r); L.dropPassenger(r, L.aboard(r)[0].id);
  const c = L.closeWindow(r);
  assert.equal(c.boarded.length, 1); assert.equal(L.aboard(r).length, 3);
});

test('星の数：閾値60/80/100%。クリアすれば最低1', () => {
  const t = { thresholds: [6, 8, 10] };
  assert.equal(L.starCount(t, 3, true), 1);
  assert.equal(L.starCount(t, 6, true), 1);
  assert.equal(L.starCount(t, 8, true), 2);
  assert.equal(L.starCount(t, 10, true), 3);
  assert.equal(L.starCount(t, 10, false), 0);
});

test('保存と復元（保存できない環境でも落ちない）', () => {
  const mem = {}; const storage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  const s = L.loadSave(storage);
  s.clear[0] = { stars: 2, perfect: true }; s.album[3] = { line: 0, station: 3 }; s.mute = true;
  assert.ok(L.writeSave(storage, s));
  const s2 = L.loadSave(storage);
  assert.deepEqual(s2.clear[0], { stars: 2, perfect: true }); assert.equal(s2.album[3].line, 0); assert.equal(s2.mute, true);
  assert.deepEqual(L.loadSave(null), L.emptySave());
  assert.deepEqual(L.loadSave({ getItem() { throw new Error('x'); } }), L.emptySave());
  assert.deepEqual(L.loadSave({ getItem: () => '{broken' }), L.emptySave());
  assert.equal(L.writeSave({ setItem() { throw new Error('quota'); } }, s), false);
});

test('15便の解放：便は順に、路線は前の路線を3便クリアで', () => {
  const s = L.emptySave();
  assert.ok(L.isUnlocked(s, 0)); assert.ok(!L.isUnlocked(s, 1)); assert.ok(!L.isUnlocked(s, 5));
  for (let i = 0; i < 4; i++) { s.clear[i] = { stars: 1 }; assert.ok(L.isUnlocked(s, i + 1)); }
  assert.ok(L.isUnlocked(s, 5), '3便クリアで次の路線');
  for (let id = 0; id < 14; id++) s.clear[id] = { stars: 1 };
  for (let id = 0; id < 15; id++) assert.ok(L.isUnlocked(s, id), `便${id}`);
});

test('結果を記録：クリアで星・完全運行・アルバム。失敗ではクリアは残らない', () => {
  const r = fakeRun([mk({ first: 0, ok: [1, 2] }), mk({ kind: 1, first: 1, ok: [0, 2] })]);
  L.arrive(r); L.dropPassenger(r, 0); L.closeWindow(r); L.arrive(r); L.dropPassenger(r, 1); L.closeWindow(r);
  L.arrive(r); L.closeWindow(r); L.arrive(r); L.closeWindow(r);
  assert.ok(r.finished && r.outcome.cleared && r.outcome.perfect);
  const s = L.recordRun(L.emptySave(), r);
  assert.equal(s.clear[5].perfect, true); assert.ok(s.album[0] && s.album[1]);
  assert.match(L.shareText(r, true), /運行完了/);
  assert.ok(!/星屑停留所/.test(L.shareText(r, true)));
  assert.match(L.shareText(r, false), /星屑停留所/);
});

test('隠し客（車掌）：3路線のアルバムが揃うと総合便だけに現れ、クリア可能性を保つ', () => {
  const s = L.emptySave();
  assert.equal(L.hiddenUnlocked(s), false);
  s.album[0] = { line: 0 }; s.album[1] = { line: 1 }; assert.equal(L.hiddenUnlocked(s), false);
  s.album[2] = { line: 2 }; assert.equal(L.hiddenUnlocked(s), true);
  assert.equal(L.withHidden(L.RUNS[0]), L.RUNS[0], '総合便以外には出ない');
  for (const id of [4, 9, 14]) {
    const h = L.withHidden(L.RUNS[id]);
    if (h.hidden) {
      assert.equal(h.terminal, L.NOWHERE);
      assert.ok(h.passengers.some((p) => p.kind === 11));
      assert.ok(L.solve(h).maxCorrect >= h.need);
    }
  }
  assert.ok([4, 9, 14].some((id) => L.withHidden(L.RUNS[id]).hidden), 'どれかの総合便で車掌が現れる');
});

test('生成は毎回同じ（検証済みテンプレートを固定）', async () => {
  const again = (await import('../../site/games/midnight-mail-express/logic.js?again')).RUNS;
  assert.deepEqual(again.map((t) => t.pairs), L.RUNS.map((t) => t.pairs));
});

test('乗車順の入れ替えでもクリア可能性は変わらない', () => {
  for (const t of L.RUNS) for (let k = 0; k < 5; k++) {
    let a = k + 1; const rng = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
    const r = L.createRun(t, rng);
    const t2 = { ...t, passengers: r.passengers.map(({ id, status, slot, result, dropStop, ...p }) => p) };
    assert.ok(L.solve(t2).maxCorrect >= t.need, `便${t.id} シャッフル${k}`);
  }
});
