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

test('目線の調整：両目と頭の向きの特徴量から画面の位置をほぼ再現できる（2乗の曲がりも）', () => {
  const truth = ([lu, lv, ru, rv, yaw, pitch]) => { const u = (lu + ru) / 2, v = (lv + rv) / 2; return { x: 0.5 + u * 3 + u * u * 4 + yaw * 1.5, y: 0.5 + v * 2.5 + pitch * 1.2 }; };
  const samples = []; let k = 0;
  for (let gx = 0; gx < 5; gx++) for (let gy = 0; gy < 5; gy++) for (let r = 0; r < 4; r++) {
    const u = (gx - 2) * 0.05, v = (gy - 2) * 0.06, yaw = ((k * 7) % 5 - 2) * 0.02, pitch = ((k * 3) % 5 - 2) * 0.02; k++;
    const f = [u + 0.003, v, u - 0.003, v + 0.002, yaw, pitch, 0, 0];
    samples.push({ f, ...truth(f) });
  }
  const p = L.fitGaze(samples, 1e-6);
  const f = [0.07, -0.04, 0.066, -0.038, 0.01, -0.02, 0, 0], q = p(f), t = truth(f);
  assert.ok(Math.hypot(q.x - t.x, q.y - t.y) < 0.03, JSON.stringify({ q, t }));
  assert.ok(p.error < 0.03, '当てはまりの誤差が小さい');
  assert.equal(L.fitGaze(samples.slice(0, 2)), null);
});

test('ずれ直し：狙いの点を見ているとき、補正が狙いの方へ少しずつ寄る（上限つき）', () => {
  const p = L.fitGaze([{ f: [0, 0, 0, 0, 0, 0, 0, 0], x: 0.5, y: 0.5 }, { f: [0.1, 0, 0.1, 0, 0, 0, 0, 0], x: 0.8, y: 0.5 }, { f: [0, 0.1, 0, 0.1, 0, 0, 0, 0], x: 0.5, y: 0.8 }, { f: [0.1, 0.1, 0.1, 0.1, 0, 0, 0, 0], x: 0.8, y: 0.8 }], 1e-4);
  for (let i = 0; i < 10; i++) L.nudgeBias(p, { x: 0.4, y: 0.5 }, { x: 0.5, y: 0.5 }, 0.1);
  assert.ok(p.bias.x > 0.05 && p.bias.x < 0.1);
  for (let i = 0; i < 200; i++) L.nudgeBias(p, { x: 0, y: 0 }, { x: 1, y: 1 }, 0.5);
  assert.ok(p.bias.x <= 0.25 && p.bias.y <= 0.25, '上限');
});

test('なめらかにする：止まっているときの震えを消し、大きく動けば追う', () => {
  const sm = L.smoother();
  let o; for (let i = 0; i < 60; i++) o = sm(0.5 + (i % 2 ? 0.004 : -0.004), 0.5, 1 / 30);
  const a = sm(0.503, 0.5, 1 / 30), b = sm(0.497, 0.5, 1 / 30);
  assert.deepEqual(a, b, '小さな震えでは筆先が動かない');
  for (let i = 0; i < 20; i++) o = sm(0.9, 0.5, 1 / 30);
  assert.ok(o.x > 0.85, `大きく動けば追う（${o.x.toFixed(2)}）`);
});

test('まばたき：短いまばたきでは筆を上げず、長く閉じると上げる', () => {
  const g = L.blinkGate(0.18);
  assert.equal(g(true, 0.1), false);
  assert.equal(g(false, 0.016), false);
  assert.equal(g(true, 0.1), false);
  assert.equal(g(true, 0.1), true);
});

test('お手本なぞり：15面、お手本は紙の中。筆が下りている間だけ線が残る', () => {
  assert.equal(L.SKIES.length, 3);
  for (const pg of L.SKIES) { assert.equal(pg.levels.length, 5); for (const lv of pg.levels) for (const st of lv.strokes) for (const [x, y] of st) assert.ok(x >= 0.05 && x <= 0.95 && y >= 0.05 && y <= 0.95, lv.name); }
  const tr = L.createTrace(L.SKIES[0].levels[0]);
  L.stepTrace(tr, { x: 0.2, y: 0.2, down: false }, 0.1);
  assert.equal(tr.strokes.length, 0, '筆が上がっていれば描かない');
  L.stepTrace(tr, { x: 0.2, y: 0.2, down: true }, 0.1); L.stepTrace(tr, { x: 0.3, y: 0.3, down: true }, 0.1);
  L.stepTrace(tr, { x: 0.3, y: 0.3, down: false }, 0.1); L.stepTrace(tr, { x: 0.5, y: 0.5, down: true }, 0.1);
  assert.equal(tr.strokes.length, 2, '筆を上げると線が分かれる');
});

test('お手本なぞり：お手本どおりなら★3、半分なら★1、ずれた線は★0', () => {
  const lv = L.SKIES[0].levels[0];
  const draw = (pts) => { const tr = L.createTrace(lv); for (const [x, y] of pts) L.stepTrace(tr, { x, y, down: true }, 0.05); return L.scoreTrace(tr); };
  const T = L.sampleTemplate(lv);
  const full = draw(T.map(([x, y], i) => [x + Math.sin(i) * 0.01, y + Math.cos(i) * 0.01]));
  assert.equal(full.stars, 3); assert.ok(full.coverage > 0.95);
  const half = draw(T.slice(0, Math.floor(T.length * 0.55)));
  assert.equal(half.stars, 1);
  const off = draw([[0.1, 0.1], [0.15, 0.12], [0.12, 0.18]]);
  assert.equal(off.stars, 0);
  const tr = L.createTrace(lv); let r = null; for (let k = 0; k < 1000 && !r; k++) r = L.stepTrace(tr, { x: 0.5, y: 0.5, down: false }, 0.1);
  assert.equal(r, 'done'); assert.ok(tr.t >= L.LIMIT, '制限時間で終わる');
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
