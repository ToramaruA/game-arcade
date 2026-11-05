import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CARDS, GROUPS, RECIPES, TOTAL, MAX_SLOTS, HISTORY_MAX, keyOf, isCard, evaluate, isNear, recipeById,
  addCard, removeAt, newState, observe, countFound, isFound, isComplete, hints, codexEntry, kindCounts,
  serialize, parseSaved, shareText,
} from '../../site/games/broken-sky-observatory/logic.js';

const run = (s, ...orders) => orders.reduce((st, o) => observe(st, o), s);

test('カードは重複なしで、グループの合計と一致する', () => {
  assert.equal(new Set(CARDS).size, CARDS.length);
  assert.equal(GROUPS.reduce((a, g) => a + g.cards.length, 0), CARDS.length);
  assert.ok(CARDS.length >= 20 && CARDS.length <= 32);
});

test('当たりの依頼はすべて実在のカード・最大4枚で、別の当たりと重ならない', () => {
  const seen = new Map();
  for (const r of RECIPES) {
    assert.ok(r.name && r.line && r.hint, r.id);
    assert.ok(r.keys.length >= 1, r.id);
    for (const k of r.keys) {
      const parts = k ? k.split('+') : [];
      assert.ok(parts.length <= MAX_SLOTS, `${r.id} ${k}`);
      parts.forEach((c) => assert.ok(isCard(c), `${r.id}: ${c}`));
      assert.ok(!seen.has(k), `重複: ${k} (${seen.get(k)} と ${r.id})`);
      seen.set(k, r.id);
    }
  }
  assert.equal(new Set(RECIPES.map((r) => r.id)).size, TOTAL);
  assert.equal(new Set(RECIPES.map((r) => r.name)).size, TOTAL);
});

test('並び順に関係なく同じ依頼は同じ結果になる', () => {
  assert.equal(keyOf(['魚', '雨']), keyOf(['雨', '魚']));
  assert.equal(evaluate(['魚', '雨']).recipe.id, 'fish-rain');
  assert.equal(evaluate(['雨', '魚']).recipe.id, 'fish-rain');
  assert.equal(evaluate(['落ちる', '布団']).recipe.id, 'futon-fly');
});

test('重ねがけで段階的に変わる（雨→本降り→豪雨→街が沈む）', () => {
  assert.equal(evaluate(['雨']).recipe.id, 'rain1');
  assert.equal(evaluate(['雨', '雨']).recipe.id, 'rain2');
  assert.equal(evaluate(['雨', '雨', '雨']).recipe.id, 'rain3');
  assert.equal(evaluate(['雨', '雨', '雨', '雨']).recipe.id, 'rain4');
});

test('ネタ・慣用句の当たりがある（狐の嫁入り・布団が吹っ飛んだ・槍が降る）', () => {
  assert.equal(evaluate(['きつね', '雨']).recipe.id, 'fox-wedding');
  assert.equal(evaluate(['太陽', 'きつね', '雨']).recipe.id, 'fox-wedding');
  assert.equal(evaluate(['布団', '落ちる']).recipe.name, '布団が吹っ飛んだ');
  assert.equal(evaluate(['槍', '雨']).recipe.id, 'yari');
  assert.ok(RECIPES.filter((r) => r.kind === 'neta').length >= 10);
});

test('外れはツッコミか「あと少し」を返す。1枚の外れはカード固有のツッコミ', () => {
  const one = evaluate(['布団']);
  assert.equal(one.hit, false); assert.match(one.message, /布団/);
  const near = evaluate(['うさぎ', '団子']);
  assert.equal(near.hit, false); assert.equal(near.near, true);
  const miss = evaluate(['雪', '雷']);
  assert.equal(miss.hit, false); assert.equal(miss.near, false); assert.ok(miss.message.length > 0);
  assert.equal(isNear('鯨+団子'), false);
});

test('何も選ばずに依頼すると隠しの当たり', () => {
  assert.equal(evaluate([]).recipe.id, 'empty');
});

test('依頼は最大4枚。不正なカードは入らず、外せる', () => {
  let o = [];
  for (const c of ['雨', '雨', '雨', '雨', '雨']) o = addCard(o, c);
  assert.equal(o.length, MAX_SLOTS);
  assert.deepEqual(addCard([], 'ラーメン'), []);
  assert.deepEqual(removeAt(['雨', '魚'], 0), ['魚']);
});

test('当たりは自動で図鑑に記録。同じ当たりは数が増えない', () => {
  let s = newState();
  s = observe(s, ['魚', '雨']);
  assert.ok(s.last.hit && s.last.fresh);
  assert.equal(countFound(s), 1);
  s = observe(s, ['雨', '魚']);
  assert.equal(s.last.fresh, false);
  assert.equal(countFound(s), 1);
  s = observe(s, ['雪', '雷']);
  assert.equal(countFound(s), 1);
  assert.equal(s.last.hit, false);
});

test('記録紙は直近6件で、同じ依頼は先頭に寄せる', () => {
  let s = newState();
  for (const c of ['雨', '雪', '雷', '虹', '霧', '月', '太陽']) s = observe(s, [c]);
  assert.equal(s.history.length, HISTORY_MAX);
  s = observe(s, ['月']);
  assert.equal(s.history[0].key, '月');
  assert.equal(s.history.filter((h) => h.key === '月').length, 1);
});

test('図鑑：未発見は番号以外を返さない。発見済みは名前と依頼の言葉', () => {
  let s = newState();
  const i = RECIPES.findIndex((r) => r.id === 'cat-rain');
  assert.deepEqual(codexEntry(s, i), { no: i + 1, found: false });
  s = observe(s, ['ねこ', '雨']);
  const e = codexEntry(s, i);
  assert.equal(e.name, '猫が降る');
  assert.deepEqual(e.order.sort(), ['ねこ', '雨'].sort());
});

test('ヒントは未発見の当たりだけから出し、隠しは出さない', () => {
  let s = newState();
  const h0 = hints(s);
  assert.equal(h0.length, 3);
  const first = RECIPES.find((r) => r.kind !== 'secret');
  s = observe(s, first.keys[0] ? first.keys[0].split('+') : []);
  assert.ok(!hints(s).includes(first.hint));
  const secretHints = RECIPES.filter((r) => r.kind === 'secret').map((r) => r.hint);
  for (const h of hints(newState())) assert.ok(!secretHints.includes(h));
});

test('全部の当たりを見つけると完了', () => {
  let s = newState();
  for (const r of RECIPES) s = observe(s, r.keys[0] ? r.keys[0].split('+') : []);
  assert.equal(countFound(s), TOTAL);
  assert.ok(isComplete(s));
  const kc = kindCounts(s);
  assert.equal(Object.values(kc).reduce((a, [f]) => a + f, 0), TOTAL);
});

test('保存と復元。壊れた保存データや知らないIDは捨てる', () => {
  let s = run(newState(), ['ねこ', '雨'], ['月']);
  const back = newState(parseSaved(serialize(s)));
  assert.ok(isFound(back, 'cat-rain') && isFound(back, 'moon'));
  assert.deepEqual(parseSaved('{壊れた'), []);
  assert.deepEqual(parseSaved('["cat-rain","nope",3]'), ['cat-rain']);
  assert.deepEqual(parseSaved(null), []);
  assert.ok(recipeById('cat-rain'));
});

test('共有文：伏せると依頼した言葉と現象名が出ない', () => {
  const s = observe(newState(), ['布団', '落ちる']);
  const open = shareText(s, false);
  assert.match(open, /布団/); assert.match(open, /吹っ飛んだ/);
  const hidden = shareText(s, true);
  assert.doesNotMatch(hidden, /布団|落ちる|吹っ飛んだ/);
  assert.match(hidden, /1\//);
  const miss = observe(newState(), ['雪', '雷']);
  assert.doesNotMatch(shareText(miss, false), /雪|雷/);
});
