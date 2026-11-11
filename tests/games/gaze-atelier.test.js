import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../site/games/gaze-atelier/logic.js';

test('お題は100種、5分類×20、表示名の重複なし', () => {
  assert.equal(L.PROMPTS.length, 100);
  for (const c of L.CATEGORIES) assert.equal(L.PROMPTS.filter((p) => p.cat === c).length, 20, c);
  const names = L.PROMPTS.map((p) => L.normalize(p.name));
  assert.equal(new Set(names).size, 100);
});

test('自由入力の答え合わせ：ひらがな・カタカナ・漢字・空白の揺れを受け付ける', () => {
  const id = L.PROMPTS.find((p) => p.name === 'ねこ').id;
  for (const a of ['ねこ', 'ネコ', '猫', ' にゃんこ ', 'ねこ！']) assert.ok(L.isCorrect(id, a), a);
  assert.ok(!L.isCorrect(id, 'いぬ'));
  assert.ok(!L.isCorrect(id, ''));
  const ufo = L.PROMPTS.find((p) => p.name === 'ユーフォー').id;
  assert.ok(L.isCorrect(ufo, 'UFO') && L.isCorrect(ufo, 'ゆーふぉー'));
});

test('4択：正解を含む4つ、重複なし、同じ種なら同じ並び', () => {
  for (let id = 0; id < 100; id += 7) {
    const c = L.guessChoices(id, 123);
    assert.equal(c.length, 4); assert.ok(c.includes(id)); assert.equal(new Set(c).size, 4);
    assert.deepEqual(L.guessChoices(id, 123), c);
  }
});

test('線データを圧縮して共有リンクにし、元に戻せる', () => {
  const strokes = [
    Array.from({ length: 50 }, (_, i) => ({ x: 0.2 + i * 0.01, y: 0.5 + Math.sin(i / 5) * 0.1, t: i * 0.05 })),
    Array.from({ length: 10 }, (_, i) => ({ x: 0.7, y: 0.2 + i * 0.05, t: 4 + i * 0.1 })),
  ];
  const code = L.encodeDrawing({ promptId: 42, seed: 777, strokes });
  assert.match(code, /^[A-Za-z0-9_-]+$/, 'URL に入れられる文字だけ');
  assert.ok(code.length < 600, `短い（${code.length}文字）`);
  const d = L.decodeDrawing(code);
  assert.equal(d.promptId, 42); assert.equal(d.seed, 777); assert.equal(d.strokes.length, 2);
  const a = strokes[0][strokes[0].length - 1], b = d.strokes[0][d.strokes[0].length - 1];
  assert.ok(Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01);
  assert.ok(Math.abs(d.strokes[1][0].t - 4) < 0.2, '2本目の書き始めの時間が残る');
  assert.ok(Math.abs(L.drawingDuration(d.strokes) - L.drawingDuration(strokes)) < 0.3);
  assert.throws(() => L.decodeDrawing('***'));
  assert.throws(() => L.decodeDrawing(''));
});

test('目線の調整：特徴量から画面の位置をほぼ再現できる', () => {
  const truth = (f) => ({ x: 0.5 + (f[0] - 0.5) * 3 + f[2] * 2, y: 0.5 + (f[1] - 0.5) * 2.5 + f[3] * 1.5 });
  const samples = [];
  for (const [u, v, hx, hy] of [[0.5, 0.5, 0, 0], [0.4, 0.4, -0.05, -0.04], [0.6, 0.4, 0.05, -0.04], [0.6, 0.6, 0.05, 0.04], [0.4, 0.6, -0.05, 0.04]]) {
    for (let k = 0; k < 15; k++) { const f = [u + (k % 3 - 1) * 0.004, v + (k % 5 - 2) * 0.003, hx + (k % 2) * 0.002, hy]; samples.push({ f, ...truth([u, v, hx, hy]) }); }
  }
  const p = L.fitGaze(samples, 1e-5);
  const q = p([0.55, 0.45, 0.02, -0.02]), t = truth([0.55, 0.45, 0.02, -0.02]);
  assert.ok(Math.hypot(q.x - t.x, q.y - t.y) < 0.08, JSON.stringify({ q, t }));
  assert.equal(L.fitGaze(samples.slice(0, 2)), null);
});

test('まばたき：短いまばたきでは筆を上げず、長く閉じると上げる', () => {
  const g = L.blinkGate(0.18);
  assert.equal(g(true, 0.1), false);
  assert.equal(g(false, 0.016), false);
  assert.equal(g(true, 0.1), false);
  assert.equal(g(true, 0.1), true);
});

test('星座なぞり：15面、星を順に見つめるとつながり、星の数がつく', () => {
  assert.equal(L.SKIES.length, 3);
  for (const s of L.SKIES) { assert.equal(s.levels.length, 5); for (const lv of s.levels) for (const [x, y] of lv.stars) assert.ok(x >= 0.05 && x <= 0.95 && y >= 0.05 && y <= 0.95); }
  const lv = L.SKIES[0].levels[0], tr = L.createTrace(lv);
  let out = [];
  for (let i = 1; i < lv.stars.length; i++) { const [x, y] = lv.stars[i]; for (let k = 0; k < 30; k++) { const r = L.stepTrace(tr, { x, y }, 0.02); if (r) out.push(r); } }
  assert.deepEqual(out, ['link', 'done']);
  assert.equal(L.rateTrace(tr), 3, '速くてきれいなら星3');
  const slow = L.createTrace(lv); slow.done = true; slow.t = 99; slow.dev = 10; slow.devN = 10;
  assert.equal(L.rateTrace(slow), 1);
  const tr2 = L.createTrace(lv);
  assert.equal(L.stepTrace(tr2, { x: 0.9, y: 0.9 }, 5), null, '星から離れていればつながらない');
});

test('星座の解放：前の面に星があれば次が開く。夜空は全面クリアで開く', () => {
  let s = L.emptySave();
  assert.ok(L.levelUnlocked(s, 0, 0) && !L.levelUnlocked(s, 0, 1) && !L.skyUnlocked(s, 1));
  s = L.recordStars(s, 0, 0, 2);
  assert.ok(L.levelUnlocked(s, 0, 1));
  s = L.recordStars(s, 0, 0, 1); assert.equal(s.stars['0-0'], 2, '最高記録を残す');
  for (let i = 1; i < 5; i++) s = L.recordStars(s, 0, i, 1);
  assert.ok(L.skyUnlocked(s, 1) && L.levelUnlocked(s, 1, 0));
});

test('交代モード：当てた人と描いた人に1点、3周で終わる', () => {
  const p = L.createParty(['A', 'B', 'C']);
  assert.equal(L.partyDrawer(p).name, 'A');
  assert.equal(L.partyResolve(p, 1, 0), false);
  assert.deepEqual(p.players.map((x) => x.score), [1, 1, 0]);
  L.partyResolve(p, -1, 1);
  assert.deepEqual(p.players.map((x) => x.score), [1, 1, 0]);
  let end = false; let n = 2; while (!end) { end = L.partyResolve(p, 2, n++); }
  assert.equal(p.log.length, 9, '3人×3周');
  assert.equal(L.partyRanking(p)[0].name, 'C');
});

test('アトリエ：描いたお題を数え、100枚まで保存。保存の読み書き', () => {
  let s = L.emptySave();
  for (let i = 0; i < 120; i++) s = L.addToGallery(s, { promptId: i % 30, code: 'x', at: i });
  assert.equal(s.gallery.length, 100); assert.equal(s.drawn.length, 30); assert.equal(s.gallery[0].at, 119);
  const store = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } };
  L.saveSave(store, s); assert.equal(L.loadSave(store).drawn.length, 30);
  assert.equal(L.loadSave({ getItem: () => '{bad' }).v, 1);
  assert.equal(L.loadSave({ getItem: () => { throw new Error(); } }).v, 1);
});

test('共有文はお題を明かさない', () => {
  const t = L.shareText({ correct: true, seconds: 3.24, tries: 1 });
  assert.match(t, /？？？/); assert.match(t, /3\.2 秒/);
  for (const p of L.PROMPTS) assert.ok(!t.includes(p.name) || p.name.length < 2 && !t.includes(`「${p.name}」`));
});
