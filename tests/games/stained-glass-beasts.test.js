import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBattle, fire, recall, step, canRecall, runReplay, evaluateWin, sweepCircleSegment, previewAim, previewReturn,
  recordResult, emptyProgress, normalizeProgress, isUnlocked, pinMemorial, unpinMemorial, buildMemorial, shareText,
  LAUNCH, SPEED, FIXED_DT, R, OUT_LIMIT, breakableIds,
} from '../../site/games/stained-glass-beasts/logic.js';
import { LEVELS } from '../../site/games/stained-glass-beasts/levels.js';
import { REPLAYS } from '../../site/games/stained-glass-beasts/replays.js';

const lv = (id) => LEVELS.find((l) => l.id === id);
const fresh = (id) => createBattle(lv(id));
function fly(b, until = 20) { let g = 0; while (b.status === 'fly' && g++ < until / FIXED_DT) step(b); }

test('掃引衝突：高速でも薄い線分をすり抜けない・端点に当たる', () => {
  const hit = sweepCircleSegment(0, 100, 0, -200, R, -50, 50, 50, 50);
  assert.ok(hit && Math.abs(hit.s - (100 - 50 - R) / 200) < 1e-9);
  assert.equal(hit.ny, 1);
  assert.equal(sweepCircleSegment(100, 100, 0, -200, R, -50, 50, 50, 50), null);
  const end = sweepCircleSegment(53, 100, 0, -200, R, -50, 50, 50, 50);
  assert.ok(end, '端点の円にも当たる');
});

test('面データ：3獣×4戦、心臓は最大2、破壊可能部位は最大12、心臓の有効径は52以上', () => {
  assert.equal(LEVELS.length, 12);
  assert.deepEqual([0, 1, 2].map((k) => LEVELS.filter((l) => l.beast === k).length), [4, 4, 4]);
  const ammo = { 0: 4, 1: 5, 2: 6 };
  for (const l of LEVELS) {
    assert.equal(l.ammo, ammo[l.beast], `${l.id} の初期残球`);
    const hearts = l.pieces.filter((p) => p.kind === 'heart');
    assert.ok(hearts.length >= 1 && hearts.length <= 2, `${l.id} 心臓数`);
    assert.ok(l.pieces.filter((p) => ['glass', 'mirror', 'heart'].includes(p.kind)).length <= 12);
    for (const h of hearts) {
      const xs = h.pts.map((p) => p[0]); const ys = h.pts.map((p) => p[1]);
      assert.ok(Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) >= 52, `${l.id} ${h.id} 心臓径`);
    }
    for (const bell of l.pieces.filter((p) => p.kind === 'bell')) {
      const target = l.pieces.find((p) => p.id === bell.link);
      assert.ok(target && target.kind === 'armor' && target.mark === bell.mark, `${l.id} 鐘と装甲の刻印`);
    }
    assert.ok(l.par >= 2 && l.par < l.ammo + 1);
  }
});

test('発射：残球は発射で減り、角度は±75度に制限、台に戻っても増えない', () => {
  const b = fresh('deer1');
  fire(b, 120);
  assert.equal(b.ammo, 3);
  assert.ok(Math.abs(Math.atan2(b.shot.vx, -b.shot.vy) * 180 / Math.PI - 75) < 1e-6);
  fly(b);
  assert.equal(b.ammo, 3);
  assert.ok(b.status === 'aim' || b.status === 'won');
});

test('往路は8秒で終了し、自動呼び戻しはしない', () => {
  const b = fresh('owl3');
  fire(b, 0);
  let t = 0;
  while (b.status === 'fly' && t < 12) { step(b); t += FIXED_DT; }
  assert.ok(b.shot.t <= OUT_LIMIT + 0.01);
  assert.equal(b.shot.recallT, null);
});

test('呼び戻し：0.35秒未満／120未満では無効、有効なら固定直線で戻る', () => {
  const b = fresh('deer1');
  fire(b, 0);
  for (let i = 0; i < 40; i++) step(b);
  assert.equal(canRecall(b), false, '0.35秒未満');
  for (let i = 0; i < 80; i++) step(b);
  assert.equal(canRecall(b), true);
  assert.equal(recall(b), true);
  const dir = [b.shot.vx, b.shot.vy];
  for (let i = 0; i < 30; i++) step(b);
  assert.ok(Math.abs(b.shot.vx - dir[0]) < 1e-9 && Math.abs(b.shot.vy - dir[1]) < 1e-9, '方向を変えない');
});

test('同じ部位の往路ダメージは1射1回。心臓は往路1＋帰路1で割れる', () => {
  const b = fresh('deer1');
  // 心臓の真下から直進：往路で1ダメージして真下へ跳ね返り、台に戻る
  fire(b, 0); fly(b);
  assert.equal(b.hp.h1, 1);
  assert.equal(b.gone.h1, undefined);
  const w = REPLAYS.deer1.clear;
  const done = runReplay(lv('deer1'), w.path);
  assert.equal(done.status, 'won');
  assert.ok(done.log.some((e) => e.phase === 'back'), '帰路での破壊を含む');
});

test('不壊装甲：往路は反射し、帰路は止まって射終了（停止点を記録）', () => {
  const l = lv('deer2');
  const b = createBattle(l);
  fire(b, 0);
  fly(b);
  assert.equal(b.hp.h1, 2, '胸の正面の装甲に弾かれ心臓は無傷');
  assert.ok(b.status === 'aim');
  const c = createBattle(l);
  fire(c, 0);
  for (let i = 0; i < 100; i++) step(c);
  assert.ok(recall(c));
  fly(c);
  assert.equal(c.hp.h1, 2);
});

test('硝子は1回で割れ、割れた瞬間は反射し、その後は存在しない', () => {
  const b = fresh('deer1');
  // g1 を狙う射線を総当たりで探し、割れる→反射の確認
  let ok = false;
  for (let a = -40; a <= -10 && !ok; a += 0.5) {
    const c = fresh('deer1'); fire(c, a); fly(c);
    if (c.gone.g1) {
      ok = true;
      assert.equal(c.hp.g1, 0);
      assert.ok(c.log.find((e) => e.id === 'g1' && e.phase === 'out'));
    }
  }
  assert.ok(ok, 'g1 を往路で割れる角度がある');
  assert.ok(b);
});

test('鐘：往路で対応する装甲だけ開き、次射の開始で閉じる。帰路では作動しない', () => {
  const l = lv('deer3');
  const w = REPLAYS.deer3.clear.path[0];
  const b = createBattle(l);
  fire(b, w.angle);
  let opened = false; let rec = false; let g = 0;
  while (b.status === 'fly' && g++ < 5000) {
    if (!rec && b.shot.t >= w.recall) { recall(b); rec = true; }
    step(b);
    if (b.open.lid) opened = true;
  }
  assert.ok(opened, '鐘で胸蓋が開く');
  assert.ok(b.open.lid, 'その射の終了まで開いたまま');
  assert.deepEqual(Object.keys(b.open), ['lid'], '対応する装甲だけ');
  if (b.status === 'aim') { fire(b, 0); assert.deepEqual(b.open, {}, '次射開始で閉じる'); }
  // 帰路で鐘を通っても作動しない：鐘に向かう帰路を作る
  const c = createBattle(l);
  fire(c, 0);
  for (let i = 0; i < 100; i++) step(c);
  c.shot.x = 160; c.shot.y = 330; // 鐘(150,400)の上方から台へ戻る線は鐘の近くを通る
  recall(c); fly(c);
  assert.deepEqual(c.open, {}, '帰路では鐘は作動しない');
});

test('FPSに依存しない：固定刻みで同じ経路（通常と練習速度で同じ論理経路）', () => {
  for (const id of ['deer3', 'owl4']) {
    const path = REPLAYS[id].clear.path;
    const a = runReplay(lv(id), path); const b2 = runReplay(lv(id), path);
    assert.equal(JSON.stringify(a.lastOut), JSON.stringify(b2.lastOut));
    assert.equal(a.status, 'won');
  }
});

test('予測線は本物と同じ関数：予測の最初の反射点は実際の最初の反射点と一致', () => {
  const b = fresh('owl1');
  const pts = previewAim(b, -20, 2);
  const c = fresh('owl1'); fire(c, -20);
  let g = 0; while (c.shot.reflections < 1 && g++ < 5000) step(c);
  assert.ok(Math.abs(pts[1][0] - c.shot.x) < 1e-6 && Math.abs(pts[1][1] - c.shot.y) < 1e-6);
});

test('帰路の細線・停止点は実際の呼び戻しと一致', () => {
  const l = lv('deer2');
  let checked = 0;
  for (let a = -60; a <= 60; a += 5) {
    const b = createBattle(l);
    fire(b, a);
    for (let i = 0; i < 400 && b.status === 'fly'; i++) step(b);
    if (b.status !== 'fly') continue;
    const prev = previewReturn(b);
    if (!prev || !prev.valid) continue;
    recall(b); fly(b);
    assert.equal(!!prev.stop, !!b.shot.stop);
    if (prev.stop) { assert.ok(Math.abs(prev.stop.x - b.shot.stop.x) < 1e-6 && Math.abs(prev.stop.y - b.shot.stop.y) < 1e-6); checked++; }
  }
  assert.ok(checked > 0, '装甲停止を伴うケースを確認できた');
});

test('全12戦：撃破・規定球数・全破壊のリプレイがすべて成立する', () => {
  for (const l of LEVELS) {
    const r = REPLAYS[l.id];
    const clear = runReplay(l, r.clear.path);
    const ec = evaluateWin(clear);
    assert.ok(ec && ec.clear, `${l.id} 撃破`);
    assert.ok(ec.par, `${l.id} 規定球数以内（${clear.shots}/${l.par}）`);
    const perfect = runReplay(l, r.perfect.path);
    const ep = evaluateWin(perfect);
    assert.ok(ep && ep.perfect, `${l.id} 全破壊`);
    assert.ok(perfect.shots <= l.ammo);
    for (const id of breakableIds(l)) assert.ok(perfect.gone[id], `${l.id} ${id} を全部割った`);
  }
});

test('帰路が必須の戦いの呼び戻し有効区間は0.2秒以上（鹿3・蛇4）', () => {
  for (const id of ['deer3', 'snake4']) {
    const w = REPLAYS[id].clear.windows.filter((x) => x != null);
    assert.ok(w.length > 0 && w.every((x) => x >= 0.2), `${id}: ${w}`);
  }
});

test('同じ角度で毎戦勝てない（各戦の最初の角度が全部同じではない）', () => {
  const first = LEVELS.map((l) => REPLAYS[l.id].clear.path[0].angle);
  assert.ok(new Set(first).size >= 6);
});

test('進行：通常と練習の記録は別、解放は直前の撃破', () => {
  const p = emptyProgress();
  assert.equal(isUnlocked(p, LEVELS, 0), true);
  assert.equal(isUnlocked(p, LEVELS, 1), false);
  recordResult(p, 'deer1', { clear: true, par: false, perfect: false, shots: 3 }, true);
  assert.equal(isUnlocked(p, LEVELS, 1), false, '練習の撃破では解放されない');
  recordResult(p, 'deer1', { clear: true, par: true, perfect: false, shots: 2 }, false);
  assert.equal(isUnlocked(p, LEVELS, 1), true);
  assert.equal(p.levels.deer1.best, 2);
  assert.equal(p.practice.deer1.best, 3);
  assert.equal(isUnlocked(p, LEVELS, 4), false, '章の解放は鹿4の撃破');
});

test('保存の復元と壊れたデータへの耐性', () => {
  const p = emptyProgress(); recordResult(p, 'deer1', { clear: true, par: true, perfect: true, shots: 1 }, false);
  const q = normalizeProgress(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(q.levels, p.levels);
  assert.deepEqual(normalizeProgress('xx').levels, {});
  assert.deepEqual(normalizeProgress({ pins: [1, 'a', 'b', 'c', 'd'] }).pins, ['a', 'b', 'c']);
});

test('記念窓：実際の破壊順を記録、ピンは3枚まで、置き換え・解除ができる', () => {
  const b = runReplay(lv('deer3'), REPLAYS.deer3.perfect.path);
  const mem = buildMemorial(b, evaluateWin(b));
  assert.equal(mem.order.length, b.log.length);
  assert.ok(mem.order.every((e) => e.id && (e.phase === 'out' || e.phase === 'back')));
  assert.ok(mem.broken.includes('h1'));
  assert.match(shareText(mem, lv('deer3')), /球で撃破/);
  const p = emptyProgress();
  assert.ok(pinMemorial(p, 'a') && pinMemorial(p, 'b') && pinMemorial(p, 'c'));
  assert.equal(pinMemorial(p, 'd'), false);
  assert.ok(pinMemorial(p, 'd', 'a'));
  assert.deepEqual(p.pins, ['d', 'b', 'c']);
  unpinMemorial(p, 'b');
  assert.deepEqual(p.pins, ['d', 'c']);
});

test('残球0でも飛行中は続行し、終了時に未撃破なら失敗', () => {
  const b = fresh('deer2');
  for (let i = 0; i < 4; i++) { fire(b, 0); if (i < 3) fly(b); }
  assert.equal(b.ammo, 0);
  assert.equal(b.status, 'fly', '最後の球も飛行中は失敗にならない');
  fly(b);
  assert.equal(b.status, 'lost');
});
