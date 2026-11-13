import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, step, emit, spawnEnemy, autopilot, DT, P, ZONE, W, H, SEAS, BOSSES,
  lancePower, absorbRadius, gaugeGain, fireInterval, parseSave, defaultSave, recordClear,
  newCampaign, advanceCampaign, needsRoute, upgradeChoices, medalCount, MEDAL_TOTAL,
} from '../../site/games/thunderbird-sky-fleet/logic.js';
import * as L from '../../site/games/thunderbird-sky-fleet/logic.js';
import { ENEMY_TYPES, ENEMY_ORDER } from '../../site/games/thunderbird-sky-fleet/data.js';

// 波の外（敵の出ない状態）で自機の操作だけを試すための状態
function quiet(opts = {}) {
  const s = createState({ sea: 1, ...opts });
  s.phase = 'wave'; s.waveIdx = 0; s.spawnIdx = 1e9; s.waveT = -1e9; // 出現も波の終了も起こさない
  s.seaDef = { ...s.seaDef, waves: [{ spawns: [], minT: 1e9 }, ...s.seaDef.waves.slice(1)] };
  return s;
}
const run = (s, input, sec) => { for (let i = 0; i < Math.round(sec / DT); i++) step(s, typeof input === 'function' ? input(s) : input); };
const bullet = (s, x, y, c, vx = 0) => s.bullets.push({ x, y, vx, vy: 0, c, r: c === 'b' ? 7 : 6, t: 0, d: 0 });

test('データ：敵8種・6海域×3波=18波・ボス6体（各3攻撃・HP20）', () => {
  assert.equal(ENEMY_ORDER.length, 8);
  assert.deepEqual(Object.keys(ENEMY_TYPES).sort(), [...ENEMY_ORDER].sort());
  assert.equal(SEAS.length, 6);
  assert.equal(SEAS.reduce((n, s) => n + s.waves.length, 0), 18);
  assert.equal(BOSSES.length, 6);
  for (const b of BOSSES) assert.equal(b.attacks.length, 3);
  assert.equal(createState({ sea: 0, fromBoss: true }).phase, 'waveGap');
  for (const sea of SEAS) for (const w of sea.waves) for (const sp of w.spawns) assert.ok(ENEMY_TYPES[sp.type], sp.type);
  // 全8種が実際にどこかの波に出る
  const used = new Set(SEAS.flatMap((s) => s.waves.flatMap((w) => w.spawns.map((sp) => sp.type))));
  assert.equal(used.size, 8);
  // 12種類以上の弾幕パターン
  const pats = new Set([...Object.values(ENEMY_TYPES).map((e) => e.fire?.pat).filter(Boolean),
    ...BOSSES.flatMap((b) => b.attacks.map((a) => a.spec.pat)),
    ...SEAS.flatMap((s) => s.waves.flatMap((w) => w.spawns.map((sp) => sp.fire?.pat).filter(Boolean)))]);
  assert.ok(pats.size >= 12, `弾幕は ${pats.size} 種類`);
});

test('射撃と吸収は排他：両方押すと吸収だけになり、弾は出ない', () => {
  const s = quiet();
  run(s, { fire: true, absorb: true }, 1);
  assert.equal(s.shots.length, 0);
  assert.equal(s.player.absorbing, true);
  run(s, { fire: true }, 0.5);
  assert.ok(s.shots.length > 0);
});

test('通常射撃は押している間 0.16秒ごとに1発', () => {
  const s = quiet();
  let shots = 0;
  for (let i = 0; i < 60; i++) { step(s, { fire: true }); shots += s.events.filter((e) => e.type === 'shot').length; s.events.length = 0; }
  // 1秒で 1/0.16 = 6.25 → 6〜7発
  assert.ok(shots >= 6 && shots <= 7, `${shots}発`);
  assert.ok(Math.abs(fireInterval({ rate: 1 }) - 0.128) < 1e-9);
});

test('吸収中は移動速度65%', () => {
  const a = quiet(); const b = quiet();
  a.player.y = b.player.y = H / 2; a.player.x = b.player.x = 100;
  run(a, { mx: 1 }, 0.5); run(b, { mx: 1, absorb: true }, 0.5);
  const da = a.player.x - 100; const db = b.player.x - 100;
  assert.ok(Math.abs(db / da - 0.65) < 0.01, `${db / da}`);
});

test('自機は画面の左半分から出られない', () => {
  const s = quiet();
  run(s, { mx: 1, my: -1 }, 5);
  assert.equal(s.player.x, ZONE.x1); assert.equal(s.player.y, ZONE.y0);
  assert.ok(ZONE.x1 <= W / 2);
});

test('青弾だけ吸える：半径60以内の青を消して1発20充電。赤は吸えずに被弾', () => {
  const s = quiet();
  const p = s.player;
  bullet(s, p.x + 50, p.y, 'b'); bullet(s, p.x + 40, p.y + 20, 'b'); bullet(s, p.x + 200, p.y, 'b');
  step(s, { absorb: true });
  assert.equal(p.gauge, 40);
  assert.equal(s.bullets.length, 1, '範囲外の青は残る');
  // 赤弾：吸収中でも消えずに当たる
  bullet(s, p.x + 3, p.y, 'r');
  step(s, { absorb: true });
  assert.equal(p.hp, 2);
  assert.equal(p.gauge, 40);
  assert.equal(absorbRadius({ wing: 1 }), 74);
  assert.equal(gaugeGain({ eff: 2 }), 30);
});

test('射撃中に青弾に当たると被弾する（吸収中のみ回収できる）', () => {
  const s = quiet();
  bullet(s, s.player.x + 2, s.player.y, 'b');
  step(s, { fire: true });
  assert.equal(s.player.hp, 2);
  assert.equal(s.player.gauge, 0);
});

test('被弾後1.2秒は無敵、その後はまた当たる', () => {
  const s = quiet(); const p = s.player;
  bullet(s, p.x, p.y, 'r'); step(s, {});
  assert.equal(p.hp, 2);
  run(s, {}, 1.0);
  bullet(s, p.x, p.y, 'r'); step(s, {});
  assert.equal(p.hp, 2, '無敵中');
  s.bullets.length = 0; run(s, {}, 0.3);
  bullet(s, p.x, p.y, 'r'); step(s, {});
  assert.equal(p.hp, 1);
});

test('雷ゲージ：上限100、40未満で離しても出ず保持、40〜79は威力2、80以上は威力4で全消費', () => {
  assert.equal(lancePower(39), 0); assert.equal(lancePower(40), 2); assert.equal(lancePower(79), 2); assert.equal(lancePower(80), 4);
  const s = quiet(); const p = s.player;
  for (let i = 0; i < 7; i++) bullet(s, p.x + 30, p.y + (i - 3) * 6, 'b');
  step(s, { absorb: true });
  assert.equal(p.gauge, 100, '上限');
  p.gauge = 20;
  step(s, { absorb: true }); step(s, {});
  assert.equal(p.gauge, 20, '40未満は保持');
  assert.equal(s.lances.length, 0);
  p.gauge = 60; step(s, { absorb: true }); step(s, {});
  assert.equal(p.gauge, 0); assert.equal(s.lances.at(-1).power, 2);
  p.gauge = 80; step(s, { absorb: true }); step(s, {});
  assert.equal(s.lances.at(-1).power, 4);
});

test('雷槍は貫通する：一直線上の巡洋艦と後ろの修理ドローンを同時に撃破', () => {
  const s = quiet(); const p = s.player; p.y = 270;
  const c = spawnEnemy(s, { type: 'cruiser', y: 270, x: 700 }); const d = spawnEnemy(s, { type: 'drone', y: 275, x: 860 });
  const off = spawnEnemy(s, { type: 'scout', y: 100, x: 600 });
  assert.equal(c.hp, 4); // 通常弾なら4発必要
  p.gauge = 80; step(s, { absorb: true }); step(s, {});
  assert.ok(c.dead && d.dead, '2機とも落ちる');
  assert.ok(!off.dead, '線上にいない敵は無事');
  assert.equal(s.stats.lanceMax, 2);
  assert.ok(s.events.some((e) => e.type === 'multi') || s.stats.lanceMax >= 2);
});

test('鏡鳥：閉じている間の通常弾は赤弾で返り、雷槍は通る', () => {
  const s = quiet(); const p = s.player; p.y = 270;
  const m = spawnEnemy(s, { type: 'mirror', y: 270, x: 400 });
  m.st = 'stay'; m.fire = null;
  assert.equal(m.closed, true);
  run(s, { fire: true }, 0.3);
  assert.equal(m.hp, 3);
  assert.ok(s.bullets.some((b) => b.c === 'r'), '赤弾が返ってくる');
  s.bullets.length = 0;
  p.gauge = 80; step(s, { absorb: true }); step(s, {});
  assert.ok(m.dead);
});

test('ミサイル（赤）は吸えないが通常弾で撃ち落とせる', () => {
  const s = quiet(); const p = s.player; p.y = 270;
  emit(s, { pat: 'missile', speed: 100, turn: 1 }, 400, 270);
  assert.equal(s.bullets[0].c, 'r');
  run(s, { fire: true }, 0.4);
  assert.equal(s.bullets.length, 0);
  assert.equal(p.hp, 3);
});

test('修復ドローンは近くの傷ついた艦を直す', () => {
  const s = quiet();
  const c = spawnEnemy(s, { type: 'cruiser', y: 270, x: 760, hx: 760 }); const d = spawnEnemy(s, { type: 'drone', y: 270, x: 860, hx: 860 });
  c.fire = null; c.hp = 2;
  run(s, {}, 3);
  assert.ok(d.st === 'stay');
  assert.ok(c.hp >= 3);
});

test('ボス：装甲中は通常弾が効かず、雷槍で装甲が割れて削れる', () => {
  const s = createState({ sea: 0, fromBoss: true, practice: true });
  run(s, {}, 2.4);
  assert.ok(s.boss);
  run(s, { target: { x: 120, y: 40 } }, 6); // 登場を待つ
  const b = s.boss; b.ph = 'rest'; b.pt = -100; s.bullets.length = 0;
  s.player.y = b.y; s.player.x = 300;
  run(s, { fire: true, target: { x: 300, y: b.y } }, 1);
  assert.equal(b.hp, 20, '装甲で弾かれる');
  s.player.gauge = 80; step(s, { absorb: true, target: { x: 300, y: b.y } }); step(s, { target: { x: 300, y: b.y } });
  assert.equal(b.hp, 16);
  assert.equal(b.armored, false);
  run(s, { fire: true, target: { x: 300, y: b.y } }, 1);
  assert.ok(b.hp < 16);
  run(s, {}, P.bossOpen + 0.5);
  assert.equal(b.armored, true);
});

test('ボス攻撃：予告（warn）→発射の順に進み、3つの攻撃を順番に繰り返す', () => {
  const s = createState({ sea: 1, fromBoss: true, practice: true });
  const seen = [];
  run(s, (st) => { if (st.boss && !seen.includes(`${st.boss.ai}:${st.boss.ph}`)) seen.push(`${st.boss.ai}:${st.boss.ph}`); return {}; }, 30);
  for (const a of [0, 1, 2]) {
    const w = seen.indexOf(`${a}:warn`); const f = seen.indexOf(`${a}:fire`);
    assert.ok(w >= 0 && f > w, `攻撃${a}は予告してから撃つ`);
  }
});

test('波の遷移：3波を倒すとボス、ボスを倒すと海域クリア', () => {
  const s = createState({ sea: 2, practice: true });
  const phases = [];
  run(s, (st) => { const k = `${st.phase}${st.phase === 'wave' ? st.waveIdx : ''}`; if (phases.at(-1) !== k) phases.push(k); return autopilot(st); }, 400);
  assert.deepEqual(phases.filter((p) => p.startsWith('wave') || p === 'boss' || p === 'clear').filter((p) => p !== 'waveGap'),
    ['wave0', 'wave1', 'wave2', 'boss', 'clear']);
  assert.ok(s.result);
});

test('チュートリアル（第1海域・第1波）：移動→射撃→吸収→雷槍の順に一行ずつ案内する', () => {
  const s = createState({ sea: 0 });
  const hints = [];
  run(s, (st) => { if (st.hint && hints.at(-1) !== st.hint) hints.push(st.hint); return autopilot(st); }, 60);
  const idx = (w) => hints.findIndex((h) => h.includes(w));
  assert.ok(idx('動かす') >= 0 && idx('撃つ') > idx('動かす') && idx('吸') > idx('撃つ') && idx('離して雷槍') > idx('吸'), hints.join(' / '));
  assert.ok(!s.tut, 'チュートリアルが終わる');
  // 赤弾は第2波まで出ない
  const s2 = createState({ sea: 0 });
  let red = false;
  run(s2, (st) => { if (st.waveIdx === 0 && st.bullets.some((b) => b.c === 'r' && b.d <= 0)) red = true; return autopilot(st); }, 40);
  assert.equal(red, false);
});

test('HP0でゲームオーバー（海域入口から再挑戦）。練習モードでは回復して続く', () => {
  const s = quiet(); const p = s.player;
  for (let i = 0; i < 3; i++) { p.inv = 0; bullet(s, p.x, p.y, 'r'); step(s, {}); }
  assert.equal(s.phase, 'dead');
  const r = createState({ sea: s.sea, upgrades: s.upgrades });
  assert.equal(r.player.hp, 3); assert.equal(r.phase, 'intro');
  const pr = quiet({ practice: true });
  for (let i = 0; i < 3; i++) { pr.player.inv = 0; bullet(pr, pr.player.x, pr.player.y, 'r'); step(pr, {}); }
  assert.equal(pr.phase, 'wave'); assert.equal(pr.player.hp, 3);
});

test('ボス戦で倒れたら「ボス前から」再挑戦できる', () => {
  const s = createState({ sea: 3, fromBoss: true });
  run(s, {}, 6);
  const p = s.player;
  for (let i = 0; i < 3; i++) { p.inv = 0; bullet(s, p.x, p.y, 'r'); step(s, {}); }
  assert.equal(s.phase, 'dead'); assert.equal(s.deadAtBoss, true);
});

test('保存・再開：壊れた保存は初期値、クリアで勲章・到達海域・日誌が増え、6海域で高難度解除', () => {
  assert.deepEqual(parseSave('{broken'), defaultSave());
  assert.deepEqual(parseSave(null), defaultSave());
  let sv = defaultSave();
  sv = recordClear(sv, { sea: 0, time: 200, hits: 0, kills: 40, lanceMax: 2, medals: { nohit: true, lance2: true, time: true } });
  assert.equal(sv.reached, 1); assert.equal(sv.cleared[0], true); assert.equal(medalCount(sv), 3);
  assert.deepEqual(sv.logs, [0]);
  const re = parseSave(JSON.stringify(sv));
  assert.deepEqual(re, sv);
  sv = recordClear(sv, { sea: 5, time: 300, hits: 2, kills: 40, lanceMax: 1, medals: { nohit: false, lance2: false, time: true } });
  assert.equal(sv.hard, true);
  // 練習では進行は変わらないが勲章は取れる
  const pr = recordClear(defaultSave(), { sea: 2, time: 100, hits: 0, kills: 1, lanceMax: 2, medals: { nohit: true, lance2: true, time: false } }, { practice: true });
  assert.equal(pr.reached, 0); assert.equal(medalCount(pr), 2);
  assert.equal(MEDAL_TOTAL, 18);
});

test('キャンペーン：海域ごとの強化2択、第3海域の前に航路分岐、合計記録', () => {
  let c = newCampaign();
  assert.deepEqual(upgradeChoices(0).length, 2);
  for (let sea = 0; sea < 5; sea++) assert.equal(upgradeChoices(sea).length, 2);
  assert.equal(upgradeChoices(5).length, 0);
  c = advanceCampaign(c, { kills: 10, hits: 1, time: 100, lanceMax: 2, killsByType: { scout: 5 } }, 'wing');
  assert.equal(c.sea, 1); assert.equal(c.upgrades.wing, 1); assert.equal(needsRoute(c), false);
  c = advanceCampaign(c, { kills: 10, hits: 0, time: 100, lanceMax: 1, killsByType: { scout: 2 } }, 'eff');
  assert.equal(c.sea, 2); assert.equal(needsRoute(c), true);
  assert.equal(c.totals.kills, 20); assert.equal(c.totals.killsByType.scout, 7); assert.deepEqual(c.picks, ['wing', 'eff']);
});

test('航路：雲上の難路は敵が硬く青弾が増え、雷雲の速攻路は赤弾が増える', () => {
  const b = createState({ sea: 2, route: 'blue' }); const r = createState({ sea: 2, route: 'red' }); const n = createState({ sea: 2 });
  const eb = spawnEnemy(b, { type: 'gunship', y: 200 }); const en = spawnEnemy(n, { type: 'gunship', y: 200 });
  assert.equal(eb.hp, en.hp + 1);
  const sb = spawnEnemy(b, { type: 'sparrow', y: 200 });
  assert.match(sb.fire.colors, /b/);
  const er = spawnEnemy(r, { type: 'gunship', y: 200 });
  assert.match(er.fire.colors, /r/);
});

test('同じシードなら同じ展開になる（弾幕はシード固定で検証可能）', () => {
  const a = createState({ sea: 4, practice: true }); const b = createState({ sea: 4, practice: true });
  run(a, autopilot, 30); run(b, autopilot, 30);
  assert.equal(a.bullets.length, b.bullets.length);
  assert.equal(a.player.x, b.player.x); assert.equal(a.score, b.score);
});

test('雷予告：落雷する列は自機の隣のどちらかを必ず空け、予告時間内に逃げ込める', () => {
  for (let seed = 1; seed < 60; seed++) {
    const s = quiet({ seed }); s.player.y = ZONE.y0 + ((seed * 37) % (ZONE.y1 - ZONE.y0));
    emit(s, { pat: 'lightning', lanes: 6, strike: 3, live: 0.45 }, 800, 270, { warn: 0.95 });
    const hz = s.hazards;
    const safeY = [];
    for (let y = ZONE.y0; y <= ZONE.y1; y += 2) if (hz.every((h) => Math.abs(y - h.y0) >= h.w / 2 + P.hitR)) safeY.push(y);
    assert.ok(safeY.length > 0);
    const need = Math.min(...safeY.map((y) => Math.abs(y - s.player.y)));
    assert.ok(need <= 0.95 * P.speed * P.slow, `seed ${seed}: ${need}px 動く必要がある`);
  }
});

test('6ボスとも回避経路がある：ボス戦の間ずっと、左半分に弾も予告線もない安全な場所が残る', () => {
  for (let sea = 0; sea < 6; sea++) {
    const s = createState({ sea, fromBoss: true, practice: true });
    let worst = Infinity;
    for (let i = 0; i < 60 * 70 && s.phase !== 'clear'; i++) {
      step(s, { target: { x: 130, y: 60 + ((i / 3) % 420) } });
      if (i % 15) continue;
      let ok = false;
      for (let x = ZONE.x0; x <= ZONE.x1 && !ok; x += 12) {
        for (let y = ZONE.y0; y <= ZONE.y1 && !ok; y += 12) {
          const bd = s.bullets.reduce((m, b) => Math.min(m, Math.hypot(b.x - x, b.y - y)), Infinity);
          const inHz = s.hazards.some((h) => { const dx = Math.cos(h.ang); const dy = Math.sin(h.ang); const rx = x - h.x0; const ry = y - h.y0; return rx * dx + ry * dy > 0 && Math.abs(-rx * dy + ry * dx) < h.w / 2 + 10; });
          if (bd > 30 && !inHz) ok = true;
        }
      }
      if (!ok) worst = Math.min(worst, i);
    }
    assert.equal(worst, Infinity, `${BOSSES[sea].name}: 安全な場所がない瞬間がある`);
  }
});

test('クリア可能性：自動操縦で全6海域（3波＋ボス）を最後まで抜けられる', () => {
  for (let sea = 0; sea < 6; sea++) {
    const s = createState({ sea, practice: true, upgrades: { wing: 1, eff: 1, rate: 1 } });
    run(s, (st) => (st.phase === 'clear' ? {} : autopilot(st)), 480);
    assert.equal(s.phase, 'clear', `第${sea + 1}海域が終わらない（phase=${s.phase}, wave=${s.waveIdx}, bossHp=${s.boss?.hp}）`);
    assert.ok(s.result.hits <= 15, `第${sea + 1}海域：被弾 ${s.result.hits}`);
  }
  // 練習でない通常の状態でも第1海域は抜けられる
  const s = createState({ sea: 0 });
  run(s, (st) => autopilot(st), 400);
  assert.equal(s.phase, 'clear');
});

test('序章：主機がいきなり現れリオがさらわれる。主機は倒せず、自機は落ちない。12.6秒で第一海域の本編へ', () => {
  const s = L.createState({ sea: 0, prologue: true, seed: 3 });
  assert.equal(s.phase, 'prologue');
  const seen = new Set();
  for (let i = 0; i < 60 * 13.5; i++) {
    L.step(s, { x: 0, y: 0, fire: i % 2 === 0, absorb: false }, L.DT);
    for (const e of s.events) seen.add(e.type); s.events.length = 0;
    assert.equal(s.player.hp, L.P.hpMax, '序章では被弾しても体力は減らない');
    if (s.boss) assert.ok(s.boss.hp > 900, '主機は倒せない');
  }
  assert.ok(seen.has('proBoss') && seen.has('allyDown'), '主機の登場とリオの捕獲が起きる');
  for (let i = 0; i < 60; i++) { L.step(s, {}, L.DT); }
  assert.equal(s.boss, null); assert.equal(s.pro, null);
  assert.ok(s.phase === 'intro' || s.phase === 'wave', '本編へ進む');
  const t = L.createState({ sea: 0, prologue: true }); L.endPrologue(t);
  assert.equal(t.phase, 'intro', 'とばすとすぐ本編');
  assert.equal(L.createState({ sea: 1, prologue: true }).phase, 'intro', '序章は第一海域だけ');
});
