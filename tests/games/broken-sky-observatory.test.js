import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOTAL, ANOMALIES, TIMES, WINDS, PRESSURES, TIME_CLUE, WIND_CLUE, PRESS_CLUE, HISTORY_MAX,
  idOf, decode, describe, anomalyOf, hintOf, newState, select, observe, record, canRecord,
  hints, codexEntry, anomalySlots, serialize, parseSaved, shareText, countFound, countAnomalies, isComplete, conditionText,
} from '../../site/games/broken-sky-observatory/logic.js';

const obs = (s, t, w, p) => observe(select(select(select(s, 't', t), 'w', w), 'p', p));

test('3軸4択の全64組合せが1〜64の別IDに1対1対応する', () => {
  const ids = new Set();
  for (let t = 0; t < 4; t++) for (let w = 0; w < 4; w++) for (let p = 0; p < 4; p++) {
    const id = idOf(t, w, p);
    ids.add(id);
    assert.deepEqual(decode(id), { t, w, p });
  }
  assert.equal(ids.size, 64);
  assert.equal(Math.min(...ids), 1); assert.equal(Math.max(...ids), 64);
});

test('64件すべて名前・一文が異なり、同じ入力は常に同じ現象', () => {
  const names = new Set(), lines = new Set();
  for (let id = 1; id <= TOTAL; id++) { const d = describe(id); names.add(d.name); lines.add(d.line); assert.deepEqual(describe(id), d); }
  assert.equal(names.size, 64); assert.equal(lines.size, 64);
});

test('特異現象は12件・ID固定で重複なし、通常は52件', () => {
  assert.equal(ANOMALIES.length, 12);
  assert.equal(new Set(ANOMALIES.map((a) => a.id)).size, 12);
  assert.equal(new Set(ANOMALIES.map((a) => a.key)).size, 12);
  assert.equal(new Set(ANOMALIES.map((a) => a.name)).size, 12);
  let n = 0; for (let id = 1; id <= TOTAL; id++) if (describe(id).anomaly) n++;
  assert.equal(n, 12);
  assert.equal(anomalyOf(idOf(3, 3, 3)).name, '地平線の巨大な瞳');
  assert.equal(anomalyOf(idOf(3, 2, 3)).name, '逆さの海');
});

test('ヒントは特異現象の条件と一致し、現象名は書かない', () => {
  for (const a of ANOMALIES) {
    const h = hintOf(a);
    assert.ok(h.includes(TIME_CLUE[a.t]) && h.includes(WIND_CLUE[a.w]) && h.includes(PRESS_CLUE[a.p]));
    assert.ok(!h.includes(a.name));
    // そのヒントに合う組合せを探すと、必ずその特異現象にたどり着く
    const hit = [];
    for (let id = 1; id <= TOTAL; id++) { const d = decode(id); if (h.includes(TIME_CLUE[d.t]) && h.includes(WIND_CLUE[d.w]) && h.includes(PRESS_CLUE[d.p])) hit.push(id); }
    assert.deepEqual(hit, [a.id]);
  }
});

test('ヒントは未発見の特異現象から最大3件、発見すると減る', () => {
  let s = newState();
  assert.equal(hints(s).length, 3);
  s = record(obs(s, ...Object.values({ t: ANOMALIES[0].t, w: ANOMALIES[0].w, p: ANOMALIES[0].p })));
  assert.ok(!hints(s).includes(hintOf(ANOMALIES[0])));
  s = newState(ANOMALIES.map((a) => a.id));
  assert.deepEqual(hints(s), []);
});

test('観測しただけでは図鑑は変わらず、記録で1件増える。既登録は重複しない', () => {
  let s = newState();
  s = obs(s, 3, 3, 3);
  assert.equal(countFound(s), 0);
  assert.ok(canRecord(s));
  s = record(s);
  assert.equal(countFound(s), 1); assert.equal(countAnomalies(s), 1);
  assert.ok(!canRecord(s));
  assert.equal(countFound(record(s)), 1);
  s = obs(s, 3, 3, 3);
  assert.equal(countFound(record(s)), 1);
});

test('ダイヤル選択は観測を押すまで空を変えない／図鑑を開いても選択は保持', () => {
  let s = newState();
  const before = s.observed;
  s = select(s, 't', 3);
  assert.equal(s.observed, before);
  assert.equal(s.sel.t, 3);
  s = select(s, 't', 9); s = select(s, 'x', 1);
  assert.equal(s.sel.t, 3);
});

test('履歴は直近6件', () => {
  let s = newState();
  for (let i = 0; i < 9; i++) s = obs(s, i % 4, 0, 0);
  assert.equal(s.history.length, HISTORY_MAX);
  assert.equal(s.history[0], idOf(0, 0, 0));
});

test('保存・復元と破損データの安全な初期化', () => {
  let s = newState();
  s = record(obs(s, 1, 1, 1)); s = record(obs(s, 3, 3, 3));
  const raw = serialize(s);
  assert.equal(raw.length, 64);
  const back = newState(parseSaved(raw));
  assert.deepEqual(back.codex, s.codex);
  for (const bad of [null, undefined, '', 'abc', '1'.repeat(63), '2'.repeat(64), 5, {}]) assert.deepEqual(parseSaved(bad), []);
});

test('未発見の枠は番号以外の情報を一切返さない', () => {
  const s = newState();
  for (let id = 1; id <= TOTAL; id++) assert.deepEqual(codexEntry(s, id), { id, found: false });
  for (const slot of anomalySlots(s)) assert.deepEqual(Object.keys(slot).sort(), ['found', 'slot']);
  const s2 = record(obs(s, 3, 3, 3));
  assert.equal(codexEntry(s2, idOf(3, 3, 3)).name, '地平線の巨大な瞳');
  assert.deepEqual(codexEntry(s2, idOf(3, 3, 2)), { id: idOf(3, 3, 2), found: false });
});

test('全64件の収集で完了', () => {
  assert.ok(!isComplete(newState()));
  assert.ok(isComplete(newState(Array.from({ length: 64 }, (_, i) => i + 1))));
});

test('共有文：通常は現象名と条件、伏せ字では名前も条件も出さない', () => {
  let s = record(obs(newState(), 3, 2, 3));
  const open = shareText(s, false);
  assert.ok(open.includes('逆さの海') && open.includes('深夜／上昇／不明') && open.includes('1/64'));
  const hidden = shareText(s, true);
  assert.ok(!hidden.includes('逆さの海'));
  for (const w of [...TIMES, ...WINDS, ...PRESSURES]) assert.ok(!hidden.includes(w + '／'), w);
  assert.ok(!hidden.includes('条件'));
  assert.ok(hidden.includes('特異現象を1件発見') && hidden.includes('1/64'));
  assert.equal(conditionText(idOf(3, 2, 3)), '深夜／上昇／不明');
});
