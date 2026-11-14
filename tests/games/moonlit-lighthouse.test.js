// 月下の灯台と影の大行進：ルールのテスト
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NIGHTS, REGIONS, CODEX, KEEPERS, wavesFor, parseWave, tideOrder,
} from '../../site/games/moonlit-lighthouse/levels.js';
import {
  createNight, step, build, upgrade, relocate, sell, sellValue, signal, cancelReservation, moveKeeper, setPaused,
  startWave, canStartWave, buildMap, isOverlap, colorsAt, towerAt, snapshot, resume, starsFor, emptyProfile, recordResult,
  shouldOfferAssist, unlockedNights, tideUnlocked, replay, enemyPos, shareText, keepersAvailable,
  TOWERS, ENEMIES, COLS, ROWS, DT, ENERGY_CAP, SIGNAL_COST, SIGNAL_CD, SIGNAL_DMG, RELOCATE_COST, WAVE_BONUS, dist,
} from '../../site/games/moonlit-lighthouse/logic.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOL = JSON.parse(fs.readFileSync(path.join(HERE, '..', '..', 'site', 'games', 'moonlit-lighthouse', 'solutions.json'), 'utf8'));
const run = (s, frames) => { for (let i = 0; i < frames; i++) { step(s); s.fx.length = 0; } };

// 空の盤面に敵を1体置くための補助
function sandbox(night = 3, opts = {}) {
  const s = createNight(night, opts);
  s.towers = []; s.energy = 1000;
  return s;
}
function addEnemy(s, type, pathIdx = 0, at = 0) {
  s.queue = [{ t: 0, type, path: pathIdx }];
  s.inWave = true; s.waveTime = 0;
  step(s); s.fx.length = 0;
  const e = s.enemies[s.enemies.length - 1];
  e.s = at;
  return e;
}
// 道のある地点に一番近い台座
function pedNear(s, x, y, used = []) {
  let best = -1; let bd = Infinity;
  s.map.peds.forEach((p, i) => { if (used.includes(i)) return; const d = dist(p.x, p.y, x, y); if (d < bd) { bd = d; best = i; } });
  return best;
}

// 道0の上で、台座 a から1.6以内・台座 b から2.0以内の地点を探す
function spot(s) {
  const p = s.map.paths[0];
  for (let d = 1; d < p.len - 1; d += 0.25) {
    const q = enemyPosAt(p, d);
    for (let a = 0; a < s.map.peds.length; a++) {
      if (dist(s.map.peds[a].x, s.map.peds[a].y, q.x, q.y) > 1.6) continue;
      for (let b = 0; b < s.map.peds.length; b++) {
        if (b !== a && dist(s.map.peds[b].x, s.map.peds[b].y, q.x, q.y) <= 2.0) return { d, q, a, b };
      }
    }
  }
  throw new Error('spot not found');
}

// ───────── データ ─────────
test('18夜・3地域、6/7/8波で合計126波', () => {
  assert.equal(NIGHTS.length, 18);
  assert.equal(REGIONS.length, 3);
  let total = 0;
  NIGHTS.forEach((n, i) => {
    const expect = i < 6 ? 6 : i < 12 ? 7 : 8;
    assert.equal(n.waves.length, expect, `第${i + 1}夜の波数`);
    total += n.waves.length;
  });
  assert.equal(total, 126);
});

test('敵は通常8種＋ボス3種、図鑑は11枚', () => {
  const normal = Object.keys(ENEMIES).filter((k) => !ENEMIES[k].boss && k !== 'mini');
  const boss = Object.keys(ENEMIES).filter((k) => ENEMIES[k].boss);
  assert.equal(normal.length, 8);
  assert.equal(boss.length, 3);
  assert.equal(Object.keys(CODEX).length, 11);
});

test('各波の体数と出現間隔が地域の範囲内（ボス波は護衛6体まで）', () => {
  NIGHTS.forEach((n, i) => {
    const range = i < 6 ? [6, 10] : i < 12 ? [10, 14] : [12, 18];
    n.waves.forEach((w, wi) => {
      const groups = parseWave(w);
      const count = groups.reduce((a, g) => a + g.count, 0);
      const boss = groups.find((g) => ENEMIES[g.type].boss);
      for (const g of groups) if (g.count > 1) assert.ok(g.interval >= 1 && g.interval <= 2, `第${i + 1}夜 波${wi + 1} 間隔`);
      if (boss) {
        assert.equal(wi, n.waves.length - 1, 'ボスは最終波');
        assert.equal(boss.delay, 0, 'ボスは最終波の最初に出る');
        assert.ok(count - 1 <= 6, `第${i + 1}夜 護衛は6体まで`);
      } else {
        assert.ok(count >= range[0] && count <= range[1], `第${i + 1}夜 波${wi + 1} の体数 ${count}`);
      }
    });
  });
  for (const i of [5, 11, 17]) assert.ok(parseWave(NIGHTS[i].waves.at(-1)).some((g) => ENEMIES[g.type].boss), `第${i + 1}夜にボス`);
  for (let i = 0; i < 18; i++) if (![5, 11, 17].includes(i)) assert.ok(NIGHTS[i].waves.every((w) => parseWave(w).every((g) => !ENEMIES[g.type].boss)), `第${i + 1}夜にボスはいない`);
});

test('地形：台座は8〜12で道の上にない、待機点は道の上、道は灯台で終わる、入口は2本以上（後半は3本）', () => {
  NIGHTS.forEach((n, i) => {
    const m = buildMap(i);
    assert.ok(m.peds.length >= 8 && m.peds.length <= 12, `第${i + 1}夜 台座 ${m.peds.length}`);
    for (const p of m.peds) {
      assert.ok(!m.cells.has(`${p.cx},${p.cy}`), `第${i + 1}夜 台座(${p.cx},${p.cy})が道の上`);
      assert.ok(p.cx >= 0 && p.cx < COLS && p.cy >= 0 && p.cy < ROWS);
    }
    for (const k of m.keeperPts) assert.ok(m.cells.has(`${Math.floor(k.x)},${Math.floor(k.y)}`), `第${i + 1}夜 待機点が道の上にない`);
    for (const p of m.paths) {
      const last = p.pts.at(-1);
      assert.equal(last.x, m.lh.x); assert.equal(last.y, m.lh.y);
      for (let k = 1; k < p.pts.length; k++) assert.ok(p.pts[k].x === p.pts[k - 1].x || p.pts[k].y === p.pts[k - 1].y, '道は縦横の線');
    }
    assert.ok(m.paths.length >= 2 && m.paths.length <= 3);
    if (i === 6 || i >= 12) assert.equal(m.paths.length, 3, `第${i + 1}夜は3方向`);
  });
  // 第1夜の第1波は一本道だけ
  assert.deepEqual([...new Set(parseWave(NIGHTS[0].waves[0]).map((g) => g.path))], [0]);
});

test('第1夜：赤と青が設置済み、電池50で移設10＋合図20が収まる', () => {
  const s = createNight(0);
  assert.equal(s.energy, 50);
  assert.deepEqual(s.towers.map((t) => t.type).sort(), ['blue', 'red']);
  assert.ok(RELOCATE_COST + SIGNAL_COST <= s.energy);
  // 青を中央の台座へ移すと、赤との重なりが道の上にできる
  const blue = s.towers.find((t) => t.type === 'blue');
  assert.ok(relocate(s, blue.id, 2).ok);
  run(s, 130);
  const p = s.map.paths[0];
  let hits = 0;
  for (let d = 0; d < p.len; d += 0.25) { const q = enemyPosAt(p, d); if (isOverlap(s, q.x, q.y)) hits++; }
  assert.ok(hits >= 6, `重なりが道にかかる（${hits}）`);
});
function enemyPosAt(p, d) { return enemyPos({ map: { paths: [p] } }, { path: 0, s: d }); }

test('第1夜は何もしなくても最初の波を耐えられる', () => {
  const s = createNight(0);
  startWave(s);
  while (s.inWave && !s.result) { step(s); s.fx.length = 0; }
  assert.equal(s.result, null);
  assert.ok(s.hp >= 1);
});

// ───────── 電池 ─────────
test('建設・強化・撤去の電池（撤去は投入の60%切り捨て、移設費は返らない）', () => {
  const s = sandbox(3);
  s.energy = 200;
  const r = build(s, 0, 'red');
  assert.ok(r.ok); assert.equal(s.energy, 160);
  assert.ok(upgrade(s, r.tower.id).ok); assert.equal(s.energy, 130);
  assert.equal(r.tower.level, 2);
  assert.ok(relocate(s, r.tower.id, 1).ok); assert.equal(s.energy, 120);
  assert.equal(r.tower.level, 2, '移設しても強化は保つ');
  assert.equal(sellValue(r.tower), Math.floor((40 + 30) * 0.6));
  assert.ok(sell(s, r.tower.id).ok); assert.equal(s.energy, 120 + 42);
  assert.equal(towerAt(s, 1), null);
});

test('電池が足りないと建てられない／使えない塔は建てられない／台座は1つに1本', () => {
  const s = sandbox(0);
  s.energy = 39;
  assert.equal(build(s, 0, 'red').reason, 'energy');
  s.energy = 300;
  assert.equal(build(s, 0, 'yellow').reason, 'locked', '黄は第3夜から');
  assert.ok(build(s, 0, 'red').ok);
  assert.equal(build(s, 0, 'blue').reason, 'occupied');
  assert.equal(upgrade(s, s.towers[0].id).ok, true);
  assert.equal(upgrade(s, s.towers[0].id).ok, true);
  assert.equal(upgrade(s, s.towers[0].id).reason, 'max');
});

test('撃破報酬（一般3・重敵5・ボス20）、波完了で+25、上限240、時間では増えない', () => {
  const s = sandbox(5);
  s.energy = 0;
  const e = addEnemy(s, 'rabbit'); e.hp = 0.001; e.maxHp = 12;
  s.towers = []; build;
  s.energy = 0;
  e.hp = -1; step(s); s.fx.length = 0;
  assert.equal(s.energy, 3 + WAVE_BONUS, '兎3＋波完了25');
  const s2 = sandbox(5); s2.energy = 0;
  const d = addEnemy(s2, 'deer'); d.hp = -1; step(s2);
  assert.equal(s2.energy, 5 + WAVE_BONUS);
  const s3 = sandbox(5); s3.energy = 0;
  const k = addEnemy(s3, 'kingdeer'); k.hp = -1; step(s3);
  assert.equal(s3.energy, 20 + WAVE_BONUS);
  const s4 = sandbox(5); s4.energy = 235;
  const r = addEnemy(s4, 'rat'); r.hp = -1; step(s4);
  assert.equal(s4.energy, ENERGY_CAP);
  const s5 = createNight(3); const before = s5.energy; run(s5, 600);
  assert.equal(s5.energy, before, '待っても電池は増えない');
});

// ───────── 光と重なり ─────────
test('二色の重なりにだけ合図できる（単色は実行されず消費なし）、三色でも威力は同じ', () => {
  const s = sandbox(3);
  const { d, q, a, b } = spot(s);
  build(s, a, 'red');
  const e0 = s.energy;
  assert.equal(signal(s, q.x, q.y).reason, 'single');
  assert.equal(s.energy, e0, '単色では消費なし');
  build(s, b, 'blue');
  assert.ok(isOverlap(s, q.x, q.y));
  const e = addEnemy(s, 'rabbit', 0, d); e.hp = 100; e.maxHp = 100;
  const before = s.energy;
  assert.ok(signal(s, q.x, q.y).ok);
  assert.equal(s.energy, before - SIGNAL_COST);
  assert.equal(e.hp, 100 - SIGNAL_DMG);
  assert.equal(e.stun, 2);
  assert.equal(signal(s, q.x, q.y).reason, 'cd', '共通の待ち時間');
  assert.equal(s.signalCd, SIGNAL_CD);
  // 三色でも同じ威力
  const c = s.map.peds.findIndex((p, i) => i !== a && i !== b && dist(p.x, p.y, q.x, q.y) <= 2.2);
  if (c >= 0) {
    build(s, c, 'yellow');
    s.signalCd = 0; e.hp = 100;
    assert.ok(signal(s, q.x, q.y).ok);
    assert.equal(e.hp, 100 - SIGNAL_DMG);
  }
});

test('合図は鎧を無視し、赤・白は黄の外で鎧に半減', () => {
  const s = sandbox(3);
  const { d, q, a, b } = spot(s);
  const t = addEnemy(s, 'turtle', 0, d);
  t.hp = 100; t.maxHp = 100; t.stun = 1e9;
  build(s, a, 'red');
  run(s, 60);
  assert.ok(Math.abs((100 - t.hp) - 6 * 0.5) < 0.05, `鎧で半減 ${100 - t.hp}`);
  build(s, b, 'yellow');
  const h0 = t.hp;
  run(s, 60);
  assert.ok(Math.abs((h0 - t.hp) - 6) < 0.05, `黄の中で通常 ${h0 - t.hp}`);
  const s2 = sandbox(3);
  const t2 = addEnemy(s2, 'turtle', 0, d); t2.hp = 100; t2.stun = 1e9;
  build(s2, a, 'red'); build(s2, b, 'blue');
  s2.towers.forEach((tw) => { tw.off = 0; });
  assert.ok(signal(s2, q.x, q.y).ok);
  assert.equal(100 - t2.hp, SIGNAL_DMG, '合図は鎧を無視');
});

test('青は重ならず最も強い倍率だけ、霧蛾には効かない、停止中は速度0', () => {
  const s = sandbox(3);
  const { d, a, b } = spot(s);
  const e = addEnemy(s, 'rat', 0, d); e.hp = 1e6; e.maxHp = 1e6;
  build(s, a, 'blue'); build(s, b, 'blue');
  const tb = towerAt(s, b); upgrade(s, tb.id); upgrade(s, tb.id);
  step(s);
  const s0 = e.s; step(s);
  assert.ok(Math.abs((e.s - s0) - ENEMIES.rat.speed * TOWERS.blue.slow[2] * DT) < 1e-9, '強い方の倍率だけ');
  const m = addEnemy(s, 'moth', 0, d); m.hp = 1e6;
  const m0 = m.s; step(s);
  assert.ok(Math.abs((m.s - m0) - ENEMIES.moth.speed * DT) < 1e-9, '霧蛾は青を無視');
  e.stun = 1; const s1 = e.s; step(s);
  assert.equal(e.s, s1, '停止中は動かない');
});

test('レンのそばでは青の足止めがさらに0.9倍', () => {
  const s = sandbox(12, { keeper: 'ren' });
  const { d, q, b } = spot(s);
  const e = addEnemy(s, 'rat', 0, d); e.hp = 1e6;
  build(s, b, 'blue');
  s.keeper.x = q.x; s.keeper.y = q.y; s.keeper.target = null; s.keeper.cd = 99;
  step(s);
  const s0 = e.s; step(s);
  assert.ok(Math.abs((e.s - s0) - ENEMIES.rat.speed * TOWERS.blue.slow[0] * 0.9 * DT) < 1e-6, `${(e.s - s0) / DT}`);
});

test('移設した塔は2秒消灯（効果なし）、停止中はタイマーも止まる', () => {
  const s = sandbox(3);
  const r = build(s, 0, 'red').tower;
  relocate(s, r.id, 1);
  assert.equal(r.off, 2);
  assert.equal(colorsAt(s, s.map.peds[1].x, s.map.peds[1].y).size, 0, '消灯中は光らない');
  setPaused(s, true); run(s, 300);
  assert.equal(r.off, 2, '停止中は進まない');
  setPaused(s, false); run(s, 121);
  assert.equal(r.off, 0);
  assert.ok(colorsAt(s, s.map.peds[1].x, s.map.peds[1].y).has('red'));
});

// ───────── 一時停止と予約 ─────────
test('停止中：建設は即反映、合図は予約（費用は先払い・取消で全額返却）、再開時に不成立なら返却', () => {
  const s = createNight(0);
  setPaused(s, true);
  const f = s.frame; step(s); assert.equal(s.frame, f, '停止中は進行ゼロ');
  const blue = s.towers.find((t) => t.type === 'blue');
  assert.ok(relocate(s, blue.id, 2).ok);
  const ov = findOverlap(s);
  assert.equal(ov, null, '消灯中なので重なりはまだない');
  setPaused(s, false); run(s, 121); setPaused(s, true);
  const p = findOverlap(s);
  assert.ok(p);
  const e0 = s.energy;
  const r = signal(s, p.x, p.y);
  assert.ok(r.reserved);
  assert.equal(s.energy, e0 - SIGNAL_COST);
  assert.equal(signal(s, p.x, p.y).reason, 'reserved', '予約は1件まで');
  assert.ok(cancelReservation(s, 'signal'));
  assert.equal(s.energy, e0);
  // 予約→重なりを壊す→再開で返却・待ち時間なし
  signal(s, p.x, p.y);
  const red = s.towers.find((t) => t.type === 'red');
  sell(s, red.id);
  const e1 = s.energy;
  setPaused(s, false);
  assert.equal(s.energy, e1 + SIGNAL_COST);
  assert.equal(s.signalCd, 0);
});
function findOverlap(s) {
  for (const p of s.map.paths) for (let d = 0; d < p.len; d += 0.25) { const q = enemyPosAt(p, d); if (isOverlap(s, q.x, q.y)) return q; }
  return null;
}

test('灯守：停止中の移動は予約、到着後に近くの先頭を2秒停止（ボス0.5秒）・8秒待ち', () => {
  const s = sandbox(5);
  setPaused(s, true);
  assert.ok(moveKeeper(s, 0).reserved);
  assert.equal(s.keeper.target, null);
  setPaused(s, false);
  assert.equal(s.keeper.target, 0);
  run(s, 60 * 20);
  const kp = s.map.keeperPts[0];
  assert.equal(s.keeper.x, kp.x); assert.equal(s.keeper.y, kp.y);
  const e = addEnemy(s, 'rat', kp.path, 0);
  // 敵を待機点の手前に置く
  const p = s.map.paths[kp.path];
  let best = 0; for (let d = 0; d < p.len; d += 0.05) { const q = enemyPosAt(p, d); if (dist(q.x, q.y, kp.x, kp.y) < 0.01) { best = d; break; } }
  e.s = best - 0.3; e.hp = 1e6;
  step(s);
  assert.equal(e.stun > 1.9, true);
  assert.equal(s.keeper.cd > 7.9, true);
  const k = addEnemy(s, 'kingdeer', kp.path, best - 0.2); k.hp = 1e6;
  s.keeper.cd = 0; step(s);
  assert.ok(k.stun > 0 && k.stun <= 0.5);
});

// ───────── 敵の特技 ─────────
test('双子影は倒すと小鼠2体（1回だけ・報酬0・通過1）', () => {
  const s = sandbox(5); s.energy = 0;
  const w = addEnemy(s, 'twin', 0, 3);
  w.hp = -1; step(s);
  const minis = s.enemies.filter((e) => e.type === 'mini');
  assert.equal(minis.length, 2);
  assert.equal(s.energy, 3);
  for (const m of minis) m.hp = -1;
  step(s);
  assert.equal(s.enemies.filter((e) => e.type === 'mini').length, 0, '小鼠は割れない');
  assert.equal(s.energy, 3 + WAVE_BONUS);
  assert.equal(ENEMIES.mini.leak, 1);
});

test('吸灯魚は4秒ごとに電池2、0未満にならない／鐘梟は6秒ごと周囲を6回復（最大HPまで）', () => {
  const s = sandbox(8); s.energy = 3;
  const f = addEnemy(s, 'fish', 0, 2); f.stun = 1e9; f.hp = 1e6;
  run(s, 60 * 4 + 1);
  assert.equal(s.energy, 1);
  run(s, 60 * 4);
  assert.equal(s.energy, 0);
  const s2 = sandbox(8);
  const o = addEnemy(s2, 'owl', 0, 3); o.stun = 1e9;
  const r = addEnemy(s2, 'rat', 0, 3.3); r.stun = 1e9; r.hp = 10;
  const far = addEnemy(s2, 'rat', 0, 6); far.stun = 1e9; far.hp = 10;
  run(s2, 60 * 6 + 2);
  assert.equal(r.hp, 16);
  assert.equal(far.hp, 10, '1マスより遠いと回復しない');
  run(s2, 60 * 6);
  assert.equal(r.hp, 18, '最大HPを超えない');
});

test('夜の主：12秒ごとに兎2体（最大4回・報酬0）、HP半分で速度0.4', () => {
  const s = sandbox(17); s.energy = 0;
  const L = addEnemy(s, 'lord', 0, 1); L.stun = 1e9;
  s.hp = 1e6;
  for (let i = 0; i < 60 * 12 * 6 + 5; i++) { step(s); s.fx.length = 0; for (const e of s.enemies) if (e.type === 'rabbit') e.stun = 1e9; }
  const rabbits = s.enemies.filter((e) => e.type === 'rabbit');
  assert.equal(rabbits.length, 8);
  assert.equal(L.summons, 4);
  assert.ok(rabbits.every((e) => e.noReward));
  for (const r of rabbits) r.hp = -1;
  step(s);
  assert.equal(s.energy, 0, '召喚の兎は報酬0');
  L.stun = 0; L.hp = L.maxHp * 0.4;
  step(s);
  const s0 = L.s; step(s);
  assert.ok(Math.abs((L.s - s0) - 0.4 * DT) < 1e-9);
});

test('潮の大亀：10秒ごとに4秒甲羅を閉じ、黄の中でも被ダメ半分（合図にも掛かる）', () => {
  const s = sandbox(11);
  const { d, q, a, b } = spot(s);
  const T = addEnemy(s, 'kingturtle', 0, d);
  T.hp = 1000; T.stun = 1e9; T.shellT = 6.5;
  build(s, a, 'red'); build(s, b, 'yellow');
  const h0 = T.hp; run(s, 30);
  assert.ok(Math.abs((h0 - T.hp) - 6 * 0.5 * 0.5) < 0.05, `閉じた甲羅 ${h0 - T.hp}`);
  T.shellT = 0.5;
  const h1 = T.hp; run(s, 30);
  assert.ok(Math.abs((h1 - T.hp) - 6 * 0.5) < 0.05, `開いた甲羅 ${h1 - T.hp}`);
  T.shellT = 7;
  const h2 = T.hp; assert.ok(signal(s, q.x, q.y).ok);
  assert.equal(h2 - T.hp, SIGNAL_DMG * 0.5);
});

test('同じフレームでは撃破が通過より先、耐久0は波の終わりより優先', () => {
  const s = sandbox(5); s.hp = 1;
  const e = addEnemy(s, 'rat', 0, 0);
  e.s = s.map.paths[0].len - 0.001; e.hp = -1;
  step(s);
  assert.equal(s.result, null, '撃破が先なので通過しない');
  assert.equal(s.hp, 1);
  const s2 = sandbox(5); s2.hp = 1;
  const e2 = addEnemy(s2, 'rat', 0, 0); e2.s = s2.map.paths[0].len - 0.0001; e2.hp = 1e6;
  step(s2);
  assert.equal(s2.result, 'lose', '最後の敵が抜けて耐久0なら負け');
  const s3 = sandbox(5); s3.hp = 10;
  const d = addEnemy(s3, 'deer', 0, 0); d.s = s3.map.paths[0].len - 0.0001; d.hp = 1e6;
  step(s3);
  assert.equal(s3.hp, 8, '鹿の通過は2');
  const s4 = sandbox(5); s4.hp = 10;
  const k = addEnemy(s4, 'kingdeer', 0, 0); k.s = s4.map.paths[0].len - 0.0001; k.hp = 1e6;
  step(s4);
  assert.equal(s4.result, 'lose', 'ボスの通過は10');
});

test('次の波は前の波が空になってから、波の開始で合図・灯守の待ち時間は0', () => {
  const s = createNight(1);
  assert.ok(startWave(s));
  assert.equal(canStartWave(s), false);
  while (s.inWave) { step(s); s.fx.length = 0; if (s.result) break; }
  s.signalCd = 5; s.keeper.cd = 5;
  if (!s.result) { assert.ok(startWave(s)); assert.equal(s.signalCd, 0); assert.equal(s.keeper.cd, 0); }
});

// ───────── 保存と記録 ─────────
test('途中保存は波間のみ、復帰すると同じ状態から続く', () => {
  const s = createNight(2);
  build(s, 3, 'yellow');
  startWave(s);
  assert.equal(snapshot(s), null, '戦闘中は保存しない');
  while (s.inWave && !s.result) { step(s); s.fx.length = 0; }
  const snap = snapshot(s);
  assert.ok(snap);
  const r = resume(JSON.parse(JSON.stringify(snap)));
  assert.equal(r.hp, s.hp); assert.equal(r.energy, s.energy); assert.equal(r.waveIdx, s.waveIdx);
  assert.deepEqual(r.towers.map((t) => [t.ped, t.type, t.level]), s.towers.map((t) => [t.ped, t.type, t.level]));
  assert.equal(r.inWave, false);
});

test('星：1=クリア、2=耐久8以上、3=耐久10。補助ありは別記録、負けても星や解放は失わない', () => {
  assert.deepEqual([0, 1, 7, 8, 9, 10].map(starsFor), [0, 1, 1, 2, 2, 3]);
  const p = emptyProfile();
  assert.equal(unlockedNights(p), 1);
  const s = createNight(0); s.result = 'win'; s.hp = 9;
  assert.equal(recordResult(p, s), 2);
  assert.equal(p.stars.normal[0], 2);
  assert.equal(unlockedNights(p), 2);
  const lose = createNight(0); lose.result = 'lose'; lose.hp = 0;
  recordResult(p, lose); recordResult(p, lose);
  assert.equal(p.stars.normal[0], 2, '負けても星は減らない');
  assert.ok(shouldOfferAssist(p, 0));
  const a = createNight(1, { assist: true });
  assert.equal(a.energy, 120 + 40, '補助は初期電池+40');
  a.result = 'win'; a.hp = 10;
  recordResult(p, a);
  assert.equal(p.stars.normal[1], 0, '補助の成績は本編の星に入れない');
  assert.equal(p.assistStars.normal[1], 3);
  assert.equal(unlockedNights(p), 3, '補助でも次の夜は解放');
  assert.equal(tideUnlocked(p), false);
  p.stars.normal = p.stars.normal.map(() => 1);
  assert.equal(tideUnlocked(p), true);
});

test('結果のコピー文に夜名・耐久・合図の数・灯守が入る', () => {
  const s = createNight(5); s.result = 'win'; s.hp = 1; s.stats.signalBest = 7;
  const t = shareText(s, 1);
  assert.match(t, /第6夜『鹿の渡し場』を耐久1で守った、合図で7体/);
  assert.match(t, /ミナ/);
});

test('灯守は段階解放（ソラ第7夜・レン第13夜）', () => {
  assert.deepEqual(keepersAvailable(0), ['mina']);
  assert.deepEqual(keepersAvailable(6), ['mina', 'sora']);
  assert.deepEqual(keepersAvailable(12), ['mina', 'sora', 'ren']);
  assert.equal(KEEPERS.mina.signalR, 1.5); assert.equal(KEEPERS.sora.speed, 3);
});

// ───────── 潮替わり ─────────
test('潮替わり：波の順を固定の別順にし入口を入れ替える（敵数は同じ・ボスの道は同じ）', () => {
  assert.deepEqual(tideOrder(6), [1, 0, 3, 2, 4, 5]);
  NIGHTS.forEach((n, i) => {
    const a = wavesFor(i, 'normal'); const b = wavesFor(i, 'tide');
    assert.equal(a.length, b.length);
    const count = (ws) => ws.flat().reduce((x, g) => x + g.count, 0);
    assert.equal(count(a), count(b));
    assert.notDeepEqual(b, a);
    const bossA = a.at(-1).find((g) => ENEMIES[g.type].boss); const bossB = b.at(-1).find((g) => ENEMIES[g.type].boss);
    if (bossA) assert.equal(bossB.path, bossA.path);
  });
});

// ───────── 攻略の再現（全波の勝利検証） ─────────
for (const mode of ['normal', 'tide']) {
  test(`${mode === 'normal' ? '本編' : '潮替わり'}の全18夜を、保存した攻略入力で再現して勝てる`, () => {
    for (let n = 0; n < NIGHTS.length; n++) {
      const plan = SOL[`${mode}:${n}`];
      assert.ok(plan, `${mode}:${n} の攻略がない`);
      const { state, failed } = replay(n, mode, plan);
      assert.equal(state.result, 'win', `${mode} 第${n + 1}夜`);
      assert.equal(state.waveIdx, state.waves.length);
      assert.equal(failed, 0, `${mode} 第${n + 1}夜 無効な操作`);
    }
  });
}

test('各地域で、塔の配置が異なる2つ目の攻略でも勝てる', () => {
  const perRegion = [0, 0, 0];
  for (let n = 0; n < NIGHTS.length; n++) {
    const alt = SOL[`alt:normal:${n}`];
    if (!alt) continue;
    const a = replay(n, 'normal', alt).state; const b = replay(n, 'normal', SOL[`normal:${n}`]).state;
    assert.equal(a.result, 'win', `第${n + 1}夜 別構成`);
    const lay = (s) => s.towers.map((t) => `${t.type}@${t.ped}`).sort().join();
    assert.notEqual(lay(a), lay(b), `第${n + 1}夜 別構成が同じ配置`);
    perRegion[Math.floor(n / 6)] += 1;
  }
  assert.ok(perRegion.every((c) => c >= 1), `地域ごとの別構成 ${perRegion}`);
});

test('何もしない（波を流すだけ）では、どの夜も勝てない', () => {
  for (const mode of ['normal', 'tide']) {
    for (let n = 0; n < NIGHTS.length; n++) {
      const s = createNight(n, { mode });
      while (!s.result && s.frame < 60 * 60 * 30) { if (!s.inWave) startWave(s); step(s); s.fx.length = 0; }
      assert.equal(s.result, 'lose', `${mode} 第${n + 1}夜が無操作で勝ててしまう`);
    }
  }
});
