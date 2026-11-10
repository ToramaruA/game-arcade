import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../site/games/moonlight-heist/logic.js';

const { ROOMS, CFG } = L;
const blank = (rows, extra = {}) => ({ name: 't', rows, guards: [], par: 10, ...extra });
const idle = { dx: 0, dy: 0, sneak: false };
const run = (r, sec, input = idle, dt = 0.05) => { for (let t = 0; t < sec; t += dt) L.step(r, input, dt); return r; };

test('3章×5室＝15室、各室に開始・出口・必須品がある', () => {
  assert.equal(ROOMS.length, 15);
  assert.equal(L.CHAPTERS.reduce((n, c) => n + c.rooms.length, 0), 15);
  let total = 0;
  ROOMS.forEach((room, i) => {
    const w = room.rows[0].length;
    room.rows.forEach((r) => assert.equal(r.length, w, `room ${i + 1} 幅が揃っていない`));
    const info = L.roomInfo(room);
    assert.ok(info.start && info.exit, `room ${i + 1}`);
    assert.ok(L.keyCells(room, 0).length >= 1);
    assert.equal(info.opts.length, 2, `room ${i + 1} 任意品は2個`);
    assert.equal(room.items.length, 3);
    total += L.keyCells(room, 0).length + info.opts.length;
  });
  assert.ok(total >= 15 + 30);
  // 収集枠は全45（必須15=各室1枠、任意30）
  assert.equal(ROOMS.length + ROOMS.length * 2, 45);
});

test('警備員の巡回点は床にあり、まっすぐ通れる', () => {
  ROOMS.forEach((room, i) => {
    const allMoverCells = (room.movers || []).flatMap((m) => m.positions.flat());
    room.guards.forEach((g) => {
      g.pts.forEach(([x, y]) => assert.ok(!'#PCGpM'.includes(L.tileAt(room, x, y)), `room ${i + 1} 巡回点が障害物`));
      const n = g.loop ? g.pts.length : g.pts.length - 1;
      for (let k = 0; k < n; k++) {
        const a = g.pts[k], b = g.pts[(k + 1) % g.pts.length];
        assert.ok(L.lineClear({ ...room, rows: room.rows.map((r) => r.replace(/[PCpM]/g, '.')) }, a[0] + 0.5, a[1] + 0.5, b[0] + 0.5, b[1] + 0.5), `room ${i + 1} 巡回線が壁を通る`);
        assert.ok(a[0] === b[0] || a[1] === b[1], `room ${i + 1} 巡回は縦横`);
      }
      void allMoverCells;
    });
  });
});

test('各室に重ならない2ルート以上がある', () => {
  ROOMS.forEach((room, i) => assert.ok(L.routeCount(room, 0) >= 2, `room ${i + 1} のルートが1本しかない`));
});

test('警備員に見つからずにクリアできる経路が、巡回位相3種すべてで存在する', () => {
  ROOMS.forEach((room, i) => {
    for (let ph = 0; ph < 3; ph++) assert.ok(L.safeRouteExists(room, ph, 150), `room ${i + 1} 位相${ph} に安全な経路がない`);
  });
});

test('壁・彫像・ケースは視線を遮り、ガラスは遮らない', () => {
  const wall = blank(['#######', '#.P...#', '#######']);
  assert.equal(L.lineClear(wall, 1.5, 1.5, 5.5, 1.5), false);
  const glass = blank(['#######', '#.G...#', '#######']);
  assert.equal(L.lineClear(glass, 1.5, 1.5, 5.5, 1.5), true);
  const g = { x: 1.5, y: 1.5, fx: 1, fy: 0 };
  assert.equal(L.guardSees(glass, g, 5.5, 1.5), true);
  assert.equal(L.guardSees(wall, g, 5.5, 1.5), false);
  assert.equal(L.guardSees(glass, g, 1.5 - 1, 1.5), false, '背後は見えない');
  assert.equal(L.guardSees(blank(['##########', '#........#', '##########']), g, 8.5, 1.5), false, '6セルより遠い');
});

test('移動：壁にぶつかり、ガラスは通れず、速度は忍び足が遅い', () => {
  const room = blank(['########', '#S.G..E#', '########']);
  const r = L.createRun(room);
  run(r, 3, { dx: 1, dy: 0, sneak: false });
  assert.ok(r.p.x < 3, 'ガラスで止まる');
  const a = L.createRun(blank(['##########', '#S.......#', '##########']));
  const b = L.createRun(blank(['##########', '#S.......#', '##########']));
  run(a, 1, { dx: 1, dy: 0, sneak: false }); run(b, 1, { dx: 1, dy: 0, sneak: true });
  assert.ok(a.p.x - 1.5 > b.p.x - 1.5);
  assert.ok(a.p.x - 1.5 < CFG.walk + 0.1);
});

test('視界に入ると警戒ゲージが上がり、満タンで追跡、遮蔽後は減衰する', () => {
  const room = blank(['############', '#S.........#', '############'], { guards: [{ pts: [[9, 1], [10, 1]] }] });
  const r = L.createRun(room);
  r.guards[0].fx = -1; r.guards[0].fy = 0; r.guards[0].wait = 1e9;
  r.guards[0].x = 6.5; r.time = 2;
  run(r, 1, idle);
  assert.ok(r.gauge > 0.1 && r.gauge < 1, `gauge ${r.gauge}`);
  run(r, 3, idle);
  assert.ok(r.alerts >= 1);
  assert.ok(r.guards[0].mode === 'chase' || r.status === 'caught');
});

test('忍び足は足音0、通常は半径2、金属床は半径4', () => {
  const room = blank(['############', '#S.mmm.....#', '############'], { guards: [{ pts: [[9, 1], [10, 1]] }] });
  const r = L.createRun(room);
  r.guards[0].fx = 1; r.guards[0].fy = 0; r.guards[0].x = 9.5; r.guards[0].pts = [[9, 1], [9, 1]];
  run(r, 1.5, { dx: 1, dy: 0, sneak: true });
  assert.equal(r.guards[0].mode, 'patrol', '忍び足では聞こえない');
  const r2 = L.createRun(room);
  r2.guards[0].fx = 1; r2.guards[0].fy = 0; r2.guards[0].x = 7.5; r2.guards[0].pts = [[7, 1], [7, 1]];
  r2.p.x = 4.5; // 金属床
  run(r2, 0.5, { dx: 1, dy: 0, sneak: false });
  assert.notEqual(r2.guards[0].mode, 'patrol', '金属床は半径4で聞こえる');
});

test('おとり：前方3セルまで、壁の手前に落ち、警備員が調べに来る。2個まで', () => {
  const room = blank(['##############', '#S...........#', '##############'], { guards: [{ pts: [[11, 1], [12, 1]] }] });
  const r = L.createRun(room);
  r.guards[0].fx = -1; r.guards[0].fy = 0; r.guards[0].x = 8.5; r.guards[0].pts = [[11, 1], [11, 1]];
  r.p.fx = 1; r.p.fy = 0; r.p.x = 4.5;
  assert.ok(L.throwDecoy(r));
  assert.ok(r.decoyObj.x > 7 && r.decoyObj.x <= 7.6, `x ${r.decoyObj.x}`);
  assert.equal(r.guards[0].mode, 'investigate');
  assert.ok(L.throwDecoy(r)); assert.equal(L.throwDecoy(r), false);
  const wallRoom = blank(['########', '#S#....#', '########']);
  const w = L.createRun(wallRoom); w.p.fx = 1; w.p.fy = 0; L.throwDecoy(w);
  assert.ok(w.decoyObj.x < 2);
});

test('調査→元の巡回に戻る、追跡→見失って捜索→巡回', () => {
  const room = blank(['################', '#S.............#', '################'], { guards: [{ pts: [[12, 1], [13, 1]] }] });
  const r = L.createRun(room);
  r.guards[0].pts = [[12, 1], [13, 1]]; r.guards[0].x = 12.5; r.guards[0].pi = 1;
  r.p.x = 1.5; r.p.fx = 1; r.p.fy = 0;
  L.throwDecoy(r); // 3セル先 → 距離が遠く聞こえない場合もあるので直接
  const g = r.guards[0];
  g.mode = 'chase'; r.lastSeen = { x: 6.5, y: 1.5 }; g.replan = 0;
  run(r, 6, idle);
  assert.ok(['search', 'return', 'patrol'].includes(g.mode), g.mode);
  run(r, 8, idle);
  assert.equal(g.mode, 'patrol');
});

test('捕獲後に再開すると、その室の収集は戻り、開始位置に戻る', () => {
  const room = ROOMS[0];
  const r = L.createRun(room, 0);
  r.items[1].got = true;
  r.status = 'caught';
  const again = L.createRun(room, 0);
  assert.equal(again.items.filter((i) => i.got).length, 0);
  const s = L.roomInfo(room).start;
  assert.deepEqual([again.p.x, again.p.y], [s[0] + 0.5, s[1] + 0.5]);
});

test('必須品を集めて出口でクリア。最終室は回収で一斉追跡', () => {
  const room = blank(['########', '#SKE...#', '########']);
  const r = L.createRun(room);
  run(r, 3, { dx: 1, dy: 0, sneak: false });
  assert.equal(r.status, 'clear');
  const fin = ROOMS[14];
  const f = L.createRun(fin, 0);
  f.items.filter((i) => i.kind === 'key').forEach((i, n, a) => { if (n < a.length - 1) i.got = true; });
  const last = f.items.find((i) => i.kind === 'key' && !i.got);
  f.p.x = last.x + 0.5; f.p.y = last.y + 0.5;
  L.step(f, idle, 0.05);
  assert.ok(f.exitOpen && f.finalTriggered);
  assert.ok(f.guards.every((g) => g.mode === 'chase'));
});

test('A*：壁を避けて到達できる', () => {
  const room = blank(['#######', '#.#...#', '#.#.#.#', '#...#.#', '#######']);
  const p = L.findPath(room, 1, 1, 5, 1);
  assert.ok(p && p.length > 5);
  assert.equal(L.findPath(blank(['#####', '#.#.#', '#####']), 1, 1, 3, 1), null);
});

test('動く遮蔽物：周期で位置が変わり視線を遮る', () => {
  const room = ROOMS[5];
  const a = L.moverCells(room, 0), b = L.moverCells(room, 10.1);
  assert.notDeepEqual(a, b);
  assert.deepEqual(L.moverCells(room, 0), L.moverCells(room, 20));
});

test('サーチライトに入ると警戒ゲージが上がる', () => {
  const room = ROOMS[10];
  const r = L.createRun(room, 0);
  r.guards = [];
  const lp = L.lightPos(room.lights[0], 0);
  r.p.x = lp.x; r.p.y = lp.y; r.time = 2;
  L.step(r, idle, 0.05);
  assert.ok(r.gauge > 0 || r.lightSeen);
});

test('評価・保存・復元・結末', () => {
  const room = ROOMS[0];
  const r = L.createRun(room, 0);
  r.items.forEach((i) => { i.got = true; }); r.time = 30;
  assert.equal(L.rankOf(room, r), 'S');
  r.alerts = 5; r.time = 999; r.items.forEach((i) => { if (i.kind === 'opt') i.got = false; });
  assert.equal(L.rankOf(room, r), 'C');
  let s = L.emptySave();
  r.status = 'clear';
  s = L.recordClear(s, 0, r);
  const store = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } };
  L.saveSave(store, s);
  const back = L.loadSave(store);
  assert.deepEqual(back.rooms, s.rooms);
  assert.ok(L.unlocked(back, 1) && !L.unlocked(back, 2));
  assert.equal(L.loadSave({ getItem: () => '{bad' }).v, 1);
  assert.equal(L.loadSave({ getItem: () => { throw new Error('x'); } }).v, 1);
  const full = L.emptySave();
  for (let i = 0; i < 15; i++) full.rooms[i] = { rank: 'S', time: 1, alerts: 0, opts: [1, 2] };
  assert.equal(L.collectedTotal(full), 45);
  assert.equal(L.endingFor(full).title, '夜を返す');
  assert.equal(L.endingFor(L.emptySave()).title, '夜を独り占めしない');
});

test('巡回位相が違うと警備員の開始位置が変わる', () => {
  const room = ROOMS[1];
  const a = L.createRun(room, 0).guards[0], b = L.createRun(room, 1).guards[0];
  assert.ok(Math.abs(a.x - b.x) > 0.5 || Math.abs(a.y - b.y) > 0.5);
});

test('無線：第1室の手引きは 移動→足跡→警備員 の順で、ゲージが上がれば割り込む', async () => {
  const { INTRO, STORY, EPILOGUE } = await import('../../site/games/moonlight-heist/rooms.js');
  assert.ok(INTRO.some((l) => l.includes('解放')), '序章で「自由になれる」目的が分かる');
  assert.ok(INTRO.some((l) => l.startsWith('キツネ「')));
  for (const k of ['ch1', 'ch2', 'ch3']) assert.ok(STORY[k].some((l) => l.startsWith('キツネ「')), k);
  assert.ok(EPILOGUE.some((l) => l.includes('自由')));
  const r = L.createRun(ROOMS[0], 0), done = new Set();
  const next = (touch = false) => { const c = L.tutorialCue(r, done, touch); if (c) done.add(c.id); return c; };
  assert.match(L.tutorialCue(r, new Set(), true).text, /パッド/);
  assert.equal(next().id, 'move');
  assert.equal(next(), null, '動くまでは次を言わない');
  r.p.x += 2;
  assert.equal(next().id, 'trail');
  r.gauge = 0.5;
  assert.notEqual(L.tutorialCue(r, done, false)?.id, 'gauge', '始まってすぐはゲージで割り込まない');
  r.t = 5;
  assert.equal(next().id, 'gauge', 'ゲージは順番より優先');
  r.gauge = 0; r.t = 12;
  assert.equal(next().id, 'guard');
  r.t = 30;
  assert.match(next(true).text, /「おとり」ボタン/);
  assert.equal(next(), null);
  assert.equal(L.radioText('床が鳴る。Shift で忍び足。', true), '床が鳴る。「忍び足」ボタンで忍び足。');
  assert.equal(L.radioText('Space で投げる', false), 'Space で投げる');
});
