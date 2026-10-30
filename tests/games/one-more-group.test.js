import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPACITY, TRIPS, baseGroups, createState, newGame, replay, board, depart, canBoard, canDepart, load, remaining, visible, mustDepart,
} from '../../site/games/one-more-group/logic.js';

const rngOf = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const sum = (a) => a.reduce((x, y) => x + y, 0);

test('18組・63人（1〜6人組が各3組）', () => {
  const g = baseGroups();
  assert.equal(g.length, 18);
  assert.equal(sum(g), 63);
  for (let n = 1; n <= 6; n++) assert.equal(g.filter((x) => x === n).length, 3);
  assert.deepEqual([...newGame(rngOf(7)).queue].sort(), [...g].sort());
});

test('先頭3組が見え、選ぶと順序を保って即補充', () => {
  let s = createState([1, 2, 3, 4, 5, 6]);
  assert.deepEqual(visible(s), [1, 2, 3]);
  s = board(s, 1);
  assert.deepEqual(s.queue, [1, 3, 4, 5, 6]);
  assert.deepEqual(visible(s), [1, 3, 4]);
  assert.deepEqual(s.riding, [2]);
});

test('容量境界：ちょうど満員は可、超過は拒否', () => {
  let s = createState([6, 4, 5, 1]);
  s = board(s, 0); s = board(s, 0);
  assert.equal(load(s), 10);
  assert.equal(remaining(s), 0);
  assert.equal(canBoard(s, 0).ok, false);
  const t = board(s, 0);
  assert.equal(t, s);
  let u = createState([6, 5, 4]);
  u = board(u, 0);
  assert.equal(canBoard(u, 0).ok, false);
  assert.equal(canBoard(u, 1).ok, true);
});

test('どれも乗せられないと出発を促す', () => {
  let s = createState([6, 5, 5, 5, 1]);
  s = board(s, 0);
  assert.equal(mustDepart(s), true);
  assert.equal(mustDepart(createState([1, 2, 3])), false);
});

test('空便は出発不可、出発で加点して空の次便へ', () => {
  let s = createState([3, 4, 5, 1]);
  assert.equal(canDepart(s), false);
  assert.equal(depart(s), s);
  s = board(board(s, 0), 0);
  s = depart(s);
  assert.equal(s.delivered, 7);
  assert.equal(s.trip, 2);
  assert.deepEqual(s.riding, []);
});

test('5便で終了し、以降の入力は無視', () => {
  let s = createState(baseGroups());
  for (let i = 0; i < TRIPS; i++) { s = board(s, 0); s = depart(s); }
  assert.equal(s.finished, true);
  assert.equal(s.trip, TRIPS);
  const before = s;
  assert.equal(board(s, 0), before);
  assert.equal(depart(s), before);
  assert.equal(canBoard(s, 0).ok, false);
  assert.ok(s.delivered <= 50);
});

test('同じ並びで再挑戦すると完全に初期化される', () => {
  let s = newGame(rngOf(3));
  const init = [...s.initial];
  s = depart(board(s, 0));
  const r = replay(s);
  assert.deepEqual(r.queue, init);
  assert.deepEqual(r.initial, init);
  assert.equal(r.delivered, 0);
  assert.equal(r.trip, 1);
  assert.equal(r.finished, false);
  assert.equal(CAPACITY, 10);
});
