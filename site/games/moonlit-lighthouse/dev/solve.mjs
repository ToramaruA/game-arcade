// 開発用：自動プレイで各夜の攻略手順を探し、solutions.json に保存する。
// 使い方: node site/games/moonlit-lighthouse/dev/solve.mjs [night番号(1始まり)|all] [normal|tide|both]
// 自動プレイは「波の予告を見て塔を置く／移す／強化する」「重なりに群れが入ったら合図」「抜けそうな道へ灯守」を行う。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NIGHTS } from '../levels.js';
import {
  createNight, step, applyAction, wavePreview, towerAt, towerRadius, TOWERS, ENEMIES, dist, pointAt,
  isOverlap, signalRadius, RULES, enemyPos, remaining, upgradeCost, towerAvailable, keepersAvailable, SIGNAL_COST, replay, colorsAt, signalDamage,
} from '../logic.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'solutions.json');

let MIX = 0.35;
export function setMix(v) { MIX = v; }
function rng(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }

function coverage(s, px, py, r, weights) {
  let c = 0;
  s.map.paths.forEach((p, pi) => {
    const w = weights[pi] || 0;
    if (!w) return;
    for (let d = 0; d <= p.len; d += 0.5) {
      const q = pointAt(p, d);
      if (dist(q.x, q.y, px, py) <= r) c += w * (0.6 + 0.8 * (d / p.len));
    }
  });
  return c;
}

function waveInfo(s, idx) {
  const prev = wavePreview(s, idx);
  const w = {}; let armor = 0; let moth = 0; let total = 0; let boss = false;
  for (const p of prev) for (const g of p.groups) {
    const d = ENEMIES[g.type];
    const hp = d.hp * g.count;
    w[p.path] = (w[p.path] || 0) + hp;
    total += hp;
    if (d.armor) armor += hp;
    if (d.blueImmune) moth += hp;
    if (d.boss) boss = true;
  }
  for (const k of Object.keys(w)) w[k] /= total || 1;
  // 夜全体の道の重みも少し混ぜる（先の波に備える）
  const all = {}; let sum = 0;
  for (let i = idx; i < s.waves.length; i++) for (const g of s.waves[i]) { const v = ENEMIES[g.type].hp * g.count; all[g.path] = (all[g.path] || 0) + v; sum += v; }
  for (const k of Object.keys(all)) w[k] = (w[k] || 0) * (1 - MIX) + (all[k] / sum) * MIX;
  return { w, armor: armor / (total || 1), moth: moth / (total || 1), boss };
}

function samplesFor(s, info) {
  const out = [];
  s.map.paths.forEach((p, pi) => {
    const w = info.w[pi] || 0;
    if (!w) return;
    for (let d = 0.25; d <= p.len; d += 0.5) {
      const q = pointAt(p, d);
      if (q.x < 0 || q.x > 12 || q.y < 0 || q.y > 8) continue;
      out.push({ x: q.x, y: q.y, w: w * (0.6 + 0.8 * (d / p.len)) });
    }
  });
  return out;
}

// 塔の組み合わせの価値（だいたいの「与えるダメージ×重み」）
function fieldOf(s, towers, smp) {
  const f = smp.map(() => ({ red: 0, white: 0, slow: 1, yellow: false, colors: new Set() }));
  for (const t of towers) {
    const p = s.map.peds[t.ped]; const r = towerRadius(t);
    smp.forEach((q, i) => {
      if (dist(q.x, q.y, p.x, p.y) > r) return;
      const c = f[i]; c.colors.add(t.type);
      if (t.type === 'red') c.red += TOWERS.red.dps[t.level - 1];
      if (t.type === 'white') c.white += TOWERS.white.dps[t.level - 1];
      if (t.type === 'blue') c.slow = Math.min(c.slow, TOWERS.blue.slow[t.level - 1]);
      if (t.type === 'yellow') c.yellow = true;
    });
  }
  return f;
}
function fieldValue(f, smp, info, prm) {
  let v = 0;
  f.forEach((c, i) => {
    const armorMul = c.yellow ? 1 : 1 - info.armor * 0.5;
    const slowMul = 1 / (c.slow * (1 - info.moth) + info.moth);
    const dmg = (c.red + c.white * prm.crowd * (1 + info.moth)) * armorMul * slowMul;
    v += smp[i].w * (Math.min(dmg, prm.cap) + (c.colors.size >= 2 ? prm.sigBonus : 0));
  });
  return v;
}

function plan(s, act, info, R, prm) {
  const smp = samplesFor(s, info);
  for (let guard = 0; guard < 14; guard++) {
    const base = fieldValue(fieldOf(s, s.towers, smp), smp, info, prm);
    let best = null;
    const consider = (towers, a, cost, vcost = cost) => {
      if (cost > s.energy - (a.a === 'build' || a.a === 'up' ? prm.reserve : 0)) return;
      const gain = fieldValue(fieldOf(s, towers, smp), smp, info, prm) - base;
      if (gain <= 0) return;
      const v = gain / vcost * (1 + (R() - 0.5) * prm.noise) * (a.type ? prm.type[a.type] : 1);
      if (v > prm.minValue && (!best || v > best.v)) best = { v, a };
    };
    s.map.peds.forEach((p, i) => {
      if (towerAt(s, i)) return;
      if (smp.every((q) => dist(q.x, q.y, p.x, p.y) > 3)) return;
      for (const type of ['red', 'blue', 'yellow', 'white']) {
        if (!towerAvailable(s.night, type)) continue;
        consider([...s.towers, { ped: i, type, level: 1 }], { a: 'build', ped: i, type }, TOWERS[type].cost);
      }
    });
    for (const t of s.towers) {
      const c = upgradeCost(t); if (c == null) continue;
      consider(s.towers.map((q) => (q === t ? { ...q, level: q.level + 1 } : q)), { a: 'up', ped: t.ped }, c, c / prm.upgrade);
    }
    for (const t of s.towers) {
      if (t.off > 0) continue;
      s.map.peds.forEach((q, i) => {
        if (towerAt(s, i)) return;
        if (dist(q.x, q.y, s.map.peds[t.ped].x, s.map.peds[t.ped].y) > 6 && R() < 0.5) return;
        consider(s.towers.map((o) => (o === t ? { ...o, ped: i } : o)), { a: 'move', from: t.ped, ped: i }, 10, 45);
      });
    }
    if (!best) break;
    act(best.a);
  }
}

function bestSignal(s) {
  const r = signalRadius(s);
  let best = null;
  for (const e of s.enemies) {
    const c = enemyPos(s, e);
    for (const [ox, oy] of [[0, 0], [0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]]) {
      const x = c.x + ox; const y = c.y + oy;
      if (!isOverlap(s, x, y)) continue;
      let score = 0; let kills = 0; let urgent = false;
      const D = signalDamage(colorsAt(s, x, y).size);
      for (const o of s.enemies) {
        const q = enemyPos(s, o);
        if (dist(q.x, q.y, x, y) > r) continue;
        const d = ENEMIES[o.type];
        score += Math.min(o.hp, D) / D + (d.boss ? 2 : 0) + (remaining(s, o) < 4 ? 1 : 0);
        if (o.hp <= D) kills += 1;
        if (d.boss || remaining(s, o) < 2.5) urgent = true;
      }
      if (!best || score > best.score) best = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, score, kills, urgent };
    }
  }
  return best;
}

export function attemptExport(...a) { return attempt(...a); }
let VARIANT = null;
export function setVariant(v) { VARIANT = v; }
function attempt(nightIndex, mode, seed, keeper) {
  const R = rng(seed * 7919 + nightIndex * 31 + (mode === 'tide' ? 5 : 0));
  const prm = {
    reserve: [0, 10, 20, 30][Math.floor(R() * 4)],
    noise: 0.2 + R() * 0.8,
    minValue: 0.01,
    synergy: 0.2 + R() * 0.6,
    upgrade: 0.6 + R() * 0.8,
    sigMin: 1,
    sigKills: 3 + Math.floor(R() * 2),
    type: { red: 0.8 + R() * 0.5, blue: 0.8 + R() * 0.5, yellow: 0.8 + R() * 0.5, white: 0.8 + R() * 0.5 },
    crowd: 1.5 + R() * 1.5, cap: 18 + R() * 20, sigBonus: R() * 3,
  };
  if (VARIANT === 'redOnly') { prm.type = { red: 1.3, blue: 1e-9, yellow: 1e-9, white: 1e-9 }; prm.sigBonus = 0; prm.sigMin = 1e9; }
  if (VARIANT === 'noSignal') prm.sigMin = 1e9;
  if (VARIANT === 'noKeeper') prm.noKeeper = true;
  const s = createNight(nightIndex, { mode, keeper });
  const actions = [];
  const act = (a) => { if (applyAction(s, a)) actions.push({ f: s.frame, ...a }); };
  const maxFrames = 60 * 60 * 25;
  while (!s.result && s.frame < maxFrames) {
    if (!s.inWave) {
      if (s.waveIdx >= s.waves.length) break;
      const info = waveInfo(s, s.waveIdx);
      plan(s, act, info, R, prm);
      // 灯守：一番重い道の出口前へ
      let bp = 0; let bw = -1; for (const [k, v] of Object.entries(info.w)) if (v > bw) { bw = v; bp = Number(k); }
      const pts = s.map.keeperPts.map((p, i) => ({ ...p, i })).filter((p) => p.path === bp);
      const target = pts[Math.floor(R() * pts.length)] || pts[0];
      if (target && s.keeper.point !== target.i) act({ a: 'keep', p: target.i });
      act({ a: 'wave' });
    } else if (s.frame % 6 === 0) {
      if (s.signalCd <= 0 && s.energy >= RULES.sigCost) {
        const b = bestSignal(s);
        if (b && prm.sigMin < 1e8 && (b.kills >= prm.sigKills || b.urgent)) act({ a: 'sig', x: b.x, y: b.y });
      }
      if (!prm.noKeeper && s.keeper.target == null && s.keeper.cd <= 1) {
        // 一番出口に近い影の道の、その影より先の待機点へ
        let worst = null;
        for (const e of s.enemies) if (!worst || remaining(s, e) < remaining(s, worst)) worst = e;
        if (worst && remaining(s, worst) < 6) {
          const wp = enemyPos(s, worst);
          let bi = -1; let bd = Infinity;
          s.map.keeperPts.forEach((p, i) => {
            if (p.path !== worst.path && !s.map.paths[worst.path].pts.some((q) => dist(q.x, q.y, p.x, p.y) < 0.1)) return;
            const d = dist(p.x, p.y, wp.x, wp.y);
            if (d < bd) { bd = d; bi = i; }
          });
          if (bi >= 0 && bi !== s.keeper.point && bd < 2.5) act({ a: 'keep', p: bi });
        }
      }
      if (s.frame % 60 === 0 && s.energy >= 70) {
        const info = waveInfo(s, s.waveIdx - 1);
        plan(s, act, info, R, { ...prm, reserve: 30 });
      }
    }
    step(s);
    s.fx.length = 0;
  }
  return { s, actions, prm };
}

export function solve(nightIndex, mode, { tries = 60, keeper = 'mina', start = 1 } = {}) {
  let best = null;
  for (let seed = start; seed < start + tries; seed++) {
    const { s, actions } = attempt(nightIndex, mode, seed, keeper);
    if (s.result === 'win' && (!best || s.hp > best.hp)) {
      best = { hp: s.hp, seed, keeper, actions, towers: s.towers.map((t) => `${t.type}${t.level}@${t.ped}`).sort().join(' ') };
      if (s.hp >= 9) break;
    }
  }
  return best;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const which = process.argv[2] || 'all';
  const modes = (process.argv[3] || 'both') === 'both' ? ['normal', 'tide'] : [process.argv[3]];
  const tries = Number(process.argv[4] || 60);
  const nights = which === 'all' ? NIGHTS.map((_, i) => i) : which.split(',').map((n) => Number(n) - 1);
  let data = {};
  try { data = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { /* 新規 */ }
  for (const mode of modes) {
    for (const n of nights) {
      const keepers = keepersAvailable(n);
      const keeper = keepers[n % keepers.length];
      const t0 = Date.now();
      const best = solve(n, mode, { tries, keeper });
      const key = `${mode}:${n}`;
      if (best) {
        data[key] = { keeper: best.keeper, hp: best.hp, actions: best.actions };
        const chk = replay(n, mode, data[key]);
        console.log(`${key} ${NIGHTS[n].name} WIN hp=${best.hp} seed=${best.seed} keeper=${keeper} replay=${chk.state.result}/${chk.state.hp} ${best.towers} (${Date.now() - t0}ms)`);
      } else {
        console.log(`${key} ${NIGHTS[n].name} FAIL (${Date.now() - t0}ms)`);
      }
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(data));
}
