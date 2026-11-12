import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../site/games/mist-whale-thread-hero/logic.js';

const TS = L.TS;
const idle = () => L.emptyInput();
const run = (st, frames, inp = {}) => {
  for (let i = 0; i < frames; i++) L.step(st, { ...idle(), ...inp, jumpPressed: !!inp.jumpPressed && i === 0, threadPressed: !!inp.threadPressed && i === 0 }, 1 / 60);
  return st;
};
const kinds = (st) => new Set(st.enemies.map((e) => e.kind));
// 敵を全部どけて、仕掛けだけの状態にする
const calm = (st) => { st.enemies.forEach((e) => { e.dead = true; }); if (st.fray) st.fray.delay = 999; return st; };

test('15面・3章×5面・各面に星鈴3個（合計45）と灯台がある', () => {
  assert.equal(L.STAGE_COUNT, 15);
  assert.equal(L.STAR_TOTAL, 45);
  for (let i = 0; i < 15; i++) {
    const st = L.createLevelState(i);
    assert.equal(st.def.chapter, Math.floor(i / 5), `${i + 1}面の章`);
    assert.equal(st.stars.length, 3, `${i + 1}面の星鈴`);
    assert.ok(st.exit, `${i + 1}面の灯台`);
    assert.ok(st.start, `${i + 1}面の開始位置`);
    assert.ok(st.def.name && st.def.gimmick, `${i + 1}面の名前と仕掛け`);
  }
});

test('各面に明記した仕掛けが入っていて、6種類の敵が全部出る', () => {
  const s = (i) => L.createLevelState(i);
  assert.ok(s(0).hooks.length >= 2);
  assert.ok(s(1).levers.length >= 1);
  assert.ok(kinds(s(2)).has('moth') && s(2).switches.length >= 1);
  assert.ok(s(3).tiles.some((r) => r.includes('W')));
  assert.ok(s(4).enemies.some((e) => e.kind === 'bee' && e.chase) && s(4).bells.filter((b) => !b.clock).length === 2);
  assert.ok(s(5).seeds.length >= 2);
  assert.ok(kinds(s(6)).has('lamp'));
  assert.ok(s(7).tiles.some((r) => r.includes('X')));
  assert.ok(s(8).hooks.some((h) => h.fading));
  assert.ok(kinds(s(9)).has('serpent'));
  assert.ok(kinds(s(10)).has('eater'));
  assert.ok(kinds(s(11)).has('moth') && kinds(s(11)).has('bee'));
  assert.ok(s(12).tiles.some((r) => r.includes('T')) && s(12).bells.some((b) => b.clock));
  assert.ok(s(13).ships.length >= 2);
  assert.ok(s(14).fray && s(14).bells.filter((b) => !b.clock).length === 3);
  const all = new Set();
  for (let i = 0; i < 15; i++) s(i).enemies.forEach((e) => all.add(e.kind));
  for (let i = 0; i < 15; i++) if (s(i).fray) all.add('fray');
  assert.deepEqual([...all].sort(), ['bee', 'eater', 'fray', 'lamp', 'moth', 'serpent', 'window']);
});

test('左右に走れて、壁で止まる', () => {
  const st = calm(L.createLevelState(0));
  const x0 = st.player.x;
  run(st, 30, { right: true });
  assert.ok(st.player.x > x0 + 60, '右へ進む');
  assert.equal(st.player.face, 1);
  const x1 = st.player.x;
  run(st, 20, { left: true });
  assert.ok(st.player.x < x1, '左へ戻る');
  assert.equal(st.player.face, -1);
  // 第1面の段差（列11の壁）にぶつかる
  run(st, 120, { right: true });
  assert.ok(st.player.x + st.player.w <= 11 * TS + 1, '段差の壁を抜けない');
});

test('ジャンプで上がり、地面に着地する。長押しの方が高い', () => {
  const st = calm(L.createLevelState(0));
  run(st, 5);
  const y0 = st.player.y;
  assert.ok(st.player.onGround);
  let minY = y0;
  L.step(st, { ...idle(), jump: true, jumpPressed: true });
  for (let i = 0; i < 80; i++) { L.step(st, { ...idle(), jump: true }); minY = Math.min(minY, st.player.y); }
  assert.ok(y0 - minY > 2 * TS, '2マス以上跳べる');
  assert.ok(st.player.onGround && Math.abs(st.player.y - y0) < 1, '元の高さに着地');
  const st2 = calm(L.createLevelState(0)); run(st2, 5);
  let minY2 = st2.player.y;
  L.step(st2, { ...idle(), jump: true, jumpPressed: true });
  for (let i = 0; i < 80; i++) { L.step(st2, idle()); minY2 = Math.min(minY2, st2.player.y); }
  assert.ok(minY2 > minY + 20, '短く押すと低い');
});

test('糸：向いている方向の近いフックを選び、背後・範囲外・壁の向こうは選ばない', () => {
  const st = calm(L.createLevelState(0));
  st.player.x = 16 * TS; st.player.y = 10 * TS; st.player.face = 1;
  const t = L.pickTarget(st, 1);
  assert.equal(t?.kind, 'hook');
  assert.equal(t.ref, st.hooks[0]);
  assert.equal(L.pickTarget(st, -1), null, '背後のフックは選ばない');
  st.player.x = 4 * TS;
  assert.equal(L.pickTarget(st, 1), null, '範囲外');
  // 壁の向こう：第2面の扉の奥のフックは扉越しに選べない
  const s2 = calm(L.createLevelState(1));
  s2.player.x = 38 * TS; s2.player.y = 10 * TS;
  assert.ok(L.lineOfSight(s2, 38 * TS, 10 * TS, 39 * TS, 10 * TS));
  assert.ok(!L.lineOfSight(s2, 38 * TS, 10 * TS, 42 * TS, 10 * TS), '閉じた扉は視線を遮る');
});

test('糸：フックへ引かれて穴を渡る。0.6秒は再発射できない', () => {
  const st = calm(L.createLevelState(0));
  st.player.x = 16 * TS; st.player.y = 10 * TS; st.player.face = 1;
  run(st, 1, { threadPressed: true });
  assert.equal(st.thread.phase, 'fly');
  assert.ok(Math.abs(st.cooldown - L.THREAD.cooldown) < 0.02);
  run(st, 9);
  assert.ok(st.player.zip, 'フックへ移動中');
  run(st, 1, { threadPressed: true });
  // 空中で J を押すと糸を切る（再発射ではない）
  assert.equal(st.thread, null);
  assert.ok(st.cooldown > 0);
  const n = st.events.length;
  run(st, 1, { threadPressed: true });
  assert.equal(st.thread, null, 'クールダウン中は出ない');
  void n;
  // やり直し：最後まで引かれると向こう岸へ
  const s2 = calm(L.createLevelState(0));
  s2.player.x = 16 * TS; s2.player.y = 10 * TS; s2.player.face = 1;
  run(s2, 1, { threadPressed: true, right: true });
  run(s2, 90, { right: true });
  assert.ok(s2.player.x > 22 * TS && s2.player.onGround, '穴を越えて着地');
  assert.equal(s2.falls, 0);
});

test('レバーに糸をかけると橋が出る', () => {
  const st = calm(L.createLevelState(1));
  st.player.x = 20 * TS; st.player.y = 10 * TS; st.player.face = 1;
  assert.equal(L.isSolidTile(st, 22, 11), false);
  assert.equal(L.pickTarget(st, 1)?.kind, 'lever');
  run(st, 20, { threadPressed: true });
  assert.equal(st.groups[0], true);
  assert.equal(L.isSolidTile(st, 22, 11), true, '橋が出た');
});

test('影蛾：予告（warn）してから突っこみ、糸で縛ると止まり、引いて鈴スイッチを鳴らせる', () => {
  const st = L.createLevelState(2);
  const moth = st.enemies.find((e) => e.kind === 'moth' && Math.abs(e.hx - 42.5 * TS) < 1);
  st.enemies.forEach((e) => { if (e !== moth) e.dead = true; });
  st.player.x = 39.5 * TS; st.player.y = 10 * TS; st.player.invuln = 99;
  const seen = [];
  for (let i = 0; i < 120 && moth.state !== 'dive'; i++) { run(st, 1); if (seen[seen.length - 1] !== moth.state) seen.push(moth.state); }
  assert.ok(seen.includes('warn') && seen.indexOf('warn') < seen.indexOf('dive'), `予告→突進: ${seen}`);
  // 縛る
  const st2 = L.createLevelState(2);
  const m2 = st2.enemies.find((e) => e.kind === 'moth' && Math.abs(e.hx - 42.5 * TS) < 1);
  st2.enemies.forEach((e) => { if (e !== m2) e.dead = true; });
  st2.player.x = 39 * TS; st2.player.y = 10 * TS; st2.player.face = 1; st2.player.invuln = 99;
  m2.cool = 99;
  assert.equal(L.pickTarget(st2, 1)?.ref, m2, '敵を優先して狙う');
  run(st2, 10, { threadPressed: true });
  assert.ok(m2.bound > 0, '縛った');
  const bx = m2.x; const by = m2.y;
  run(st2, 20);
  assert.ok(Math.hypot(m2.x - bx, m2.y - by) < 1, '縛られている間は動かない');
  assert.equal(st2.groups[0], false);
  run(st2, 1, { threadPressed: true });
  assert.ok(m2.drag, '引き寄せ');
  run(st2, 40);
  assert.equal(st2.groups[0], true, '鈴スイッチを通って橋が出た');
});

test('鎧蜂：身構えてから突進する。牙灯：点線の予告のあと光線でダメージ', () => {
  const st = L.createLevelState(11);
  const bee = st.enemies.find((e) => e.kind === 'bee');
  st.enemies.forEach((e) => { if (e !== bee) e.dead = true; });
  st.player.x = bee.x - 3 * TS; st.player.y = bee.y - 20; st.player.invuln = 99;
  const seen = [];
  for (let i = 0; i < 160; i++) { run(st, 1); if (seen[seen.length - 1] !== bee.state) seen.push(bee.state); }
  assert.ok(seen.indexOf('warn') >= 0 && seen.indexOf('warn') < seen.indexOf('charge'), `身構え→突進: ${seen}`);

  const s2 = L.createLevelState(6);
  const lamp = s2.enemies.find((e) => e.kind === 'lamp');
  s2.enemies.forEach((e) => { if (e !== lamp) e.dead = true; });
  s2.player.x = 16 * TS; s2.player.y = 10 * TS; s2.player.invuln = 0;
  const states = [];
  let hearts = s2.player.hearts;
  for (let i = 0; i < 240; i++) {
    // 光線の高さに立たせる
    if (lamp.beam) s2.player.y = lamp.beam.y - 20;
    s2.player.vy = 0;
    run(s2, 1);
    if (states[states.length - 1] !== lamp.state) states.push(lamp.state);
    if (s2.player.hearts < hearts) break;
  }
  assert.ok(states.includes('warn') && states.indexOf('warn') < states.indexOf('fire'), `予告→発射: ${states}`);
  assert.ok(s2.player.hearts < hearts, '光線に当たるとハートが減る');
});

test('海蛇：縛ると背中が足場になり、糸喰いは近くの糸を食いちぎる', () => {
  const st = calm(L.createLevelState(9));
  const sp = st.enemies.find((e) => e.kind === 'serpent');
  sp.dead = false; sp.state = 'leap'; sp.s = 0.7; sp.bound = 2;
  const surf = L.surfaces(st).find((x) => x.kind === 'serpent');
  assert.ok(surf, '縛った海蛇は足場');
  const mid = (sp.x0 + sp.x1) / 2;
  st.player.x = mid - 12; st.player.y = surf.yAt(mid) - 80; st.player.vy = 0;
  run(st, 30);
  assert.ok(st.player.onGround && st.player.ride?.kind === 'serpent', '背中に立てる');
  assert.equal(st.falls, 0);

  const s2 = L.createLevelState(10);
  const eater = s2.enemies.find((e) => e.kind === 'eater');
  s2.enemies.forEach((e) => { if (e !== eater) e.dead = true; });
  s2.player.x = 12 * TS; s2.player.y = 10 * TS; s2.player.face = 1;
  eater.x = 14 * TS; eater.y = 9 * TS; eater.hx = eater.x; eater.hy = eater.y;
  run(s2, 6, { threadPressed: true });
  assert.equal(s2.thread, null, '糸が切られた');
  assert.ok(s2.player.tangled > 0, 'しばらく糸が使えない');
  run(s2, 1, { threadPressed: true });
  assert.equal(s2.thread, null);
});

test('ハート3つ：3回当たると灯（チェックポイント）からハート3つで再開', () => {
  const st = L.createLevelState(2);
  st.enemies.forEach((e) => { e.dead = true; });
  st.player.x = 30 * TS; st.player.y = 10 * TS;
  run(st, 5);
  assert.ok(st.checkpoints[0].on, '灯をともした');
  for (let k = 0; k < 3; k++) { st.player.invuln = 0; st.player.x = 21 * TS; st.player.y = 12 * TS - 20; st.player.vy = 0; run(st, 1); }
  assert.equal(st.player.hearts, 0);
  assert.ok(st.player.dying > 0);
  assert.equal(st.gameOvers, 1);
  run(st, 90);
  assert.equal(st.player.hearts, 3, 'ハート3つで');
  assert.ok(Math.abs(st.player.x + st.player.w / 2 - st.checkpoints[0].x) < 2, '灯から再開');
  assert.ok(st.player.dying <= 0);
});

test('落ちたらハートが1減って灯から即再開（2秒以内）', () => {
  const st = calm(L.createLevelState(0));
  st.player.x = 19 * TS; st.player.y = 12 * TS;
  run(st, 30);
  assert.equal(st.player.hearts, 2);
  run(st, 60);
  assert.ok(st.player.dying <= 0 && st.player.onGround, '1秒ほどで戻る');
});

test('鐘を全部鳴らすまで灯台は閉じている（第5面・第15面）', () => {
  const st = calm(L.createLevelState(4));
  assert.ok(L.exitLocked(st));
  st.player.x = st.exit.x - 10; st.player.y = st.exit.y - 40;
  run(st, 2);
  assert.equal(st.cleared, false);
  st.bells.forEach((b) => { b.rung = true; });
  run(st, 2);
  assert.equal(st.cleared, true);
});

test('星鈴：クリアで記録、面を順に解放、12色の糸、結末3種', () => {
  let save = L.newSave();
  assert.ok(L.isUnlocked(save, 0));
  assert.ok(!L.isUnlocked(save, 1));
  save = L.applyClear(save, { index: 0, stars: [true, false, true], time: 20, hits: 0, noDamage: true, fast: true });
  assert.ok(L.isUnlocked(save, 1));
  assert.ok(!L.isUnlocked(save, 2));
  assert.equal(L.totalStars(save), 2);
  save = L.applyClear(save, { index: 0, stars: [false, true, false], time: 30, hits: 2, noDamage: false, fast: false });
  assert.deepEqual(save.stages[0].stars, [true, true, true], '取った星鈴は消えない');
  assert.equal(save.stages[0].best, 20);
  assert.equal(save.stages[0].nd, true);
  assert.equal(L.THREAD_COLORS.length, 12);
  assert.deepEqual(L.unlockedColors(save).filter(Boolean).length, 2);
  assert.ok(L.isChapterUnlocked(save, 0) && !L.isChapterUnlocked(save, 1));
  let full = L.newSave();
  for (let i = 0; i < 15; i++) full = L.applyClear(full, { index: i, stars: [true, true, true], time: 99, hits: 1, noDamage: false, fast: false });
  assert.equal(L.totalStars(full), 45);
  assert.ok(L.unlockedColors(full).every(Boolean));
  assert.equal(L.endingFor(full), 'sew');
  assert.equal(L.endingFor(L.newSave()), 'sleep');
  let mid = L.newSave();
  for (let i = 0; i < 10; i++) mid = L.applyClear(mid, { index: i, stars: [true, true, true], time: 99, hits: 1 });
  assert.equal(L.endingFor(mid), 'return');
  assert.equal(L.STORY.length, 3);
  assert.equal(Object.keys(L.ENDINGS).length, 3);
});

test('保存と読み込み：往復でき、壊れたデータでも落ちない', () => {
  let save = L.newSave();
  save = L.applyClear(save, { index: 0, stars: [true, true, false], time: 25.34, hits: 0, noDamage: true, fast: true });
  save.color = 1;
  const back = L.deserialize(L.serialize(save));
  assert.deepEqual(back.stages, save.stages);
  assert.equal(back.color, 1);
  assert.deepEqual(L.deserialize('{oops').stages, {});
  assert.deepEqual(L.deserialize(null).stages, {});
  const odd = L.deserialize(JSON.stringify({ stages: { 99: { clear: true }, x: 1, 2: { stars: [1, 0, 'a'], clear: 1 } }, color: 77 }));
  assert.deepEqual(Object.keys(odd.stages), ['2']);
  assert.deepEqual(odd.stages[2].stars, [true, false, true]);
  assert.equal(odd.color, 0);
});

test('初見は固定配置、クリア後は3つの位相から選ぶ', () => {
  const save = L.applyClear(L.newSave(), { index: 0, stars: [false, false, false], time: 50, hits: 0 });
  assert.equal(L.variantFor(L.newSave(), 0, () => 0.9), 0);
  assert.equal(L.variantFor(save, 0, () => 0.9), 2);
  const a = L.createLevelState(2, { variant: 0 }).enemies.map((e) => e.phase);
  const b = L.createLevelState(2, { variant: 1 }).enemies.map((e) => e.phase);
  assert.notDeepEqual(a, b);
});

test('全ステージ：1マス単位の地図で、出口と星鈴45個すべてに届く経路がある', () => {
  for (let i = 0; i < 15; i++) {
    const r = L.reachability(i);
    assert.ok(r.exit, `${i + 1}面の出口`);
    r.stars.forEach((ok, k) => assert.ok(ok, `${i + 1}面の星鈴${k + 1}`));
    r.levers.forEach((ok, k) => assert.ok(ok, `${i + 1}面のレバー${k + 1}`));
    r.bells.forEach((ok, k) => assert.ok(ok, `${i + 1}面の鐘${k + 1}`));
  }
});

// ───── 実際の物理で解く：入力の組み合わせを探索して灯台に着くことを確かめる ─────
const ACTS = [{ r: 1 }, { l: 1 }, { r: 1, j: 1 }, { l: 1, j: 1 }, { r: 1, t: 1 }, { l: 1, t: 1 }, { r: 1, j: 1, t: 6 }, { l: 1, j: 1, t: 6 }, {}, { t: 1 }, { j: 1 }, { r: 1, t: 1, t2: 1 }, { l: 1, t: 1, t2: 1 }];
const N = 10;
function act(st, a) {
  for (let j = 0; j < N && !st.cleared; j++) {
    L.step(st, { left: !!a.l, right: !!a.r, jump: !!a.j, jumpPressed: !!a.j && j === 0, threadPressed: (a.t === 1 && j === 0) || (a.t === 6 && j === 6) || (!!a.t2 && j === 9) }, 1 / 60);
  }
}
const clone = (st) => { const c = structuredClone({ ...st, def: null, events: [] }); c.def = st.def; return c; };
function solve(i, max = 60000) {
  const st0 = L.createLevelState(i);
  const ex = st0.exit;
  const key = (s) => [Math.round(s.player.x / 10), Math.round(s.player.y / 10), s.player.onGround ? 1 : 0, s.player.zip ? 1 : 0, s.groups.join(''), s.bells.map((b) => (b.rung ? 1 : 0)).join(''), s.ships.map((x) => Math.round(x.x / 40)).join(':'), s.seeds.map((x) => Math.round(x.x / 20)).join(':'), s.bells.some((b) => b.ring > 0) ? 1 : 0, s.player.hearts, s.enemies.filter((e) => e.kind === 'serpent').map((e) => `${e.state}${Math.round(e.s * 8)}${e.bound > 0 ? 'b' : ''}${e.state === 'wait' ? Math.round(e.timer * 4) : ''}`).join(':'), L.clockOpen(s) ? 1 : 0].join(',');
  const h = (s) => {
    let d = Math.abs(s.player.x - ex.x) + Math.abs(s.player.y - ex.y) * 0.5;
    if (L.exitLocked(s)) { const b = s.bells.find((x) => !x.clock && !x.rung); d = Math.abs(s.player.x - b.x) + Math.abs(s.player.y - b.y) + 2000 * s.bells.filter((x) => !x.clock && !x.rung).length; }
    return d + (3 - s.player.hearts) * 300 - (s.groups[0] ? 200 : 0) - (s.groups[1] ? 200 : 0);
  };
  let open = [{ s: st0, len: 0, f: 0 }];
  const seen = new Set([key(st0)]);
  let n = 0;
  while (open.length && n < max) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift(); n++;
    for (const a of ACTS) {
      const s = clone(cur.s);
      act(s, a);
      if (s.cleared) return { ok: true, time: s.time, st: s };
      if (s.player.hearts < 1 || s.gameOvers > 0 || s.falls > 0) continue;
      const k = key(s);
      if (seen.has(k)) continue;
      seen.add(k);
      open.push({ s, len: cur.len + 1, f: h(s) + (cur.len + 1) * 4 });
    }
    if (open.length > 4000) { open.sort((a, b) => a.f - b.f); open = open.slice(0, 2500); }
  }
  return { ok: false };
}

test('全ステージ：実際の物理と敵の動きのまま、入力だけで灯台にたどり着ける', () => {
  for (let i = 0; i < 15; i++) {
    const r = solve(i);
    assert.ok(r.ok, `${i + 1}面『${L.LEVELS[i].name}』に到達経路がない`);
    assert.ok(r.time < L.LEVELS[i].par, `${i + 1}面の目標タイム（${L.LEVELS[i].par}秒）は達成可能`);
  }
});

test('雲の舟：岸から糸で引き寄せ、乗ったままフックへ投げると舟ごと進む', () => {
  const st = calm(L.createLevelState(13));
  const ship = st.ships[0];
  const home = ship.x;
  // 岸の端に立ち、舟を引き寄せる
  st.player.x = 12 * TS; st.player.y = 10 * TS; st.player.face = 1;
  assert.equal(L.pickTarget(st, 1)?.kind, 'ship');
  run(st, 60, { threadPressed: true });
  assert.ok(ship.x < home, '舟が手元へ来た');
  assert.equal(ship.x, ship.xmin);
  // 舟に乗る
  st.player.x = ship.x + 40; st.player.y = ship.y - 60; st.player.vy = 0;
  run(st, 20);
  assert.equal(st.player.ride?.kind, 'ship');
  const px = st.player.x;
  run(st, 1, { threadPressed: true });
  run(st, 120);
  assert.ok(ship.x > home, '舟がフックの方へ進んだ');
  assert.ok(st.player.x > px + 80, 'ミオも一緒に運ばれた');
  assert.equal(st.falls, 0);
});

test('窓の顔：近づくと窓から顔を出し（予告）、見つめた場所へ腕を伸ばす。糸をかけると引っ込む', () => {
  const st = L.createLevelState(1);
  const win = st.enemies.find((e) => e.kind === 'window');
  st.enemies.forEach((e) => { if (e !== win) e.dead = true; });
  st.player.x = win.x - 2 * TS; st.player.y = 10 * TS; st.player.invuln = 0;
  win.cool = 0;
  const seen = [];
  let hit = false;
  for (let i = 0; i < 120; i++) { run(st, 1); if (seen[seen.length - 1] !== win.state) seen.push(win.state); if (st.hits > 0) { hit = true; break; } }
  assert.ok(seen.indexOf('peek') >= 0 && seen.indexOf('peek') < seen.indexOf('reach'), `顔を出す→腕: ${seen}`);
  assert.ok(hit, '立ち止まっていると腕に捕まる');
  // 顔を出している間に糸をかけると引っ込む
  const s2 = L.createLevelState(1);
  const w2 = s2.enemies.find((e) => e.kind === 'window');
  s2.enemies.forEach((e) => { if (e !== w2) e.dead = true; });
  s2.player.x = w2.x - 3 * TS; s2.player.y = 10 * TS; s2.player.face = 1; s2.player.invuln = 99;
  w2.cool = 0;
  for (let i = 0; i < 60 && w2.out < 0.6; i++) run(s2, 1);
  assert.equal(L.pickTarget(s2, 1)?.ref, w2, '顔は糸の標的になる');
  run(s2, 10, { threadPressed: true });
  assert.equal(w2.state, 'flinch');
  run(s2, 40);
  assert.equal(w2.state, 'shut');
  assert.ok(w2.cool > 1, 'しばらく出てこない');
});

test('各面に、遊びながら見える少女のひとりごとが2つずつある（面の中の位置で出る）', () => {
  for (let i = 0; i < 15; i++) {
    const st = L.createLevelState(i);
    const lines = st.def.lines || [];
    assert.equal(lines.length, 2, `${i + 1}面`);
    for (const ln of lines) { assert.ok(ln.text.trim()); assert.ok(ln.c >= 0 && ln.c < st.w, `${i + 1}面の位置`); }
  }
});
