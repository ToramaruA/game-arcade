// 雷鳥戦記のルール本体。DOM を触らない（Node のテストからそのまま動かせる）。
// 固定 dt で step() を呼ぶ。乱数はシード固定（state.seed）なので、同じ入力なら同じ結果になる。
import { W, H, ZONE, ENEMY_TYPES, SEAS, BOSSES, UPGRADE_PAIRS, TUTORIAL, MEDALS } from './data.js';

export { W, H, ZONE, SEAS, BOSSES };
export const DT = 1 / 60;
export const P = {
  speed: 300, slow: 0.65, fireInterval: 0.16, shotSpeed: 900, absorbR: 60, gain: 20,
  lanceMin: 40, lanceStrong: 80, gaugeMax: 100, hpMax: 3, inv: 1.2, hitR: 6,
  bossHp: 20, bossOpen: 2.6, bossChip: 0.15,
};

// ---------- 乱数 ----------
function rand(s) {
  let t = (s.seed = (s.seed + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function absorbRadius(up = {}) { return P.absorbR + 14 * (up.wing || 0); }
export function gaugeGain(up = {}) { return P.gain + 5 * (up.eff || 0); }
export function fireInterval(up = {}) { return P.fireInterval * 0.8 ** (up.rate || 0); }
export function lancePower(gauge) { return gauge >= P.lanceStrong ? 4 : gauge >= P.lanceMin ? 2 : 0; }

// ---------- 状態の作成 ----------
// run: { sea, upgrades, route, difficulty, practice, fromBoss, seed }
export function createState(run = {}) {
  const sea = Math.max(0, Math.min(5, run.sea | 0));
  const hard = run.difficulty === 'hard';
  const s = {
    sea, seaDef: SEAS[sea], upgrades: { wing: 0, eff: 0, rate: 0, ...(run.upgrades || {}) },
    route: run.route || null, difficulty: hard ? 'hard' : 'normal', practice: !!run.practice,
    fromBoss: !!run.fromBoss, seed: (run.seed ?? (1234 + sea * 97)) >>> 0,
    bulletMul: hard ? 1.22 : 1, periodMul: hard ? 0.8 : 1,
    t: 0, seaT: 0, phase: 'intro', phaseT: 0, waveIdx: 0, waveT: 0, spawnIdx: 0,
    player: { x: 150, y: H / 2, hp: P.hpMax, inv: 0, fireCd: 0, absorbing: false, prevAbsorb: false, gauge: 0, wing: 1, moved: 0 },
    shots: [], bullets: [], enemies: [], boss: null, hazards: [], lances: [], events: [],
    nextId: 1, score: 0, hint: '', hintT: 0,
    tut: null,
    stats: { hits: 0, kills: 0, lanceMax: 0, lances: 0, absorbed: 0, killsByType: {} },
    result: null, deadAtBoss: false, tutDone: !!run.tutDone,
  };
  if (s.fromBoss) { s.phase = 'waveGap'; s.waveIdx = 3; s.phaseT = 0; }
  else if (run.prologue && sea === 0) {
    // 序章：いきなり天の主機が現れ、僚機のリオがさらわれる（倒せない）
    s.phase = 'prologue';
    s.pro = { t: 0, st: 0, beat: 0, stage: 'calm', fireT: 0, clinks: 0, lanceHit: false, ally: { x: 230, y: H / 2 - 80, captured: false, gone: false } };
  }
  return s;
}

function ev(s, type, data = {}) { if (s.events.length < 200) s.events.push({ type, ...data }); }
function setHint(s, text, dur = 4) { s.hint = text; s.hintT = dur; }

// ---------- 弾 ----------
function addBullet(s, x, y, ang, spd, c, extra = {}) {
  const v = spd * s.bulletMul;
  s.bullets.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, c, r: c === 'b' ? 7 : 6, t: 0, d: 0, ...extra });
}
const colorAt = (spec, i) => { const c = spec.colors || 'b'; return c[i % c.length]; };
const aimAt = (s, x, y) => Math.atan2(s.player.y - y, s.player.x - x);

// 共通の弾生成関数。8種の敵も6体のボスも、ここにパラメータを渡すだけ。
export function emit(s, spec, x, y, ctx = {}) {
  const aim = ctx.aim ?? aimAt(s, x, y);
  const t = ctx.t || 0;
  const spd = spec.speed || 150;
  let k = ctx.count || 0; // 色の並びの通し番号
  const col = () => colorAt(spec, k++);
  switch (spec.pat) {
    case 'aimed': addBullet(s, x, y, aim, spd, col()); break;
    case 'spread': {
      const n = spec.n || 3; const arc = spec.arc || 0.6; const base = spec.dir ?? aim;
      for (let i = 0; i < n; i++) addBullet(s, x, y, base + (n === 1 ? 0 : -arc / 2 + (arc * i) / (n - 1)), spd, col(), spec.bounce ? { bounce: spec.bounce } : {});
      break;
    }
    case 'ring': {
      const n = spec.n || 8; const rot = (spec.spin || 0) * t + (ctx.rot || 0);
      for (let i = 0; i < n; i++) addBullet(s, x, y, rot + (Math.PI * 2 * i) / n, spd, col());
      break;
    }
    case 'spiral': {
      const arms = spec.arms || 3; const rot = (spec.spin || 1) * t;
      for (let i = 0; i < arms; i++) addBullet(s, x, y, rot + (Math.PI * 2 * i) / arms, spd, col());
      break;
    }
    case 'stream': {
      const n = spec.n || 3;
      for (let i = 0; i < n; i++) addBullet(s, x, y, aim, spd, col(), { d: i * (spec.gap || 0.1) });
      break;
    }
    case 'line': { // 左へまっすぐ進む弾の列（青の列は吸収のごちそう）
      const n = spec.n || 1; const offs = spec.offs || [0];
      for (let i = 0; i < n; i++) for (const o of offs) addBullet(s, x, y + o, Math.PI, spd, col(), { d: i * (spec.gap || 0.2) });
      break;
    }
    case 'wall': { // 縦一列の弾の壁。自機の高さの近くに抜け道を空ける
      const step = spec.step || 32; const gapH = spec.gapH || 110;
      const gy = Math.max(ZONE.y0 + gapH / 2, Math.min(ZONE.y1 - gapH / 2, s.player.y + (rand(s) - 0.5) * 120));
      for (let yy = 14; yy < H; yy += step) if (Math.abs(yy - gy) > gapH / 2) addBullet(s, x, yy, Math.PI, spd, col());
      break;
    }
    case 'sweep': { // 時間とともに角度が動く薙ぎ払い
      const ph = ((t % (spec.sweepT * 2)) / spec.sweepT);
      const f = ph <= 1 ? ph : 2 - ph;
      addBullet(s, x, y, spec.a0 + (spec.a1 - spec.a0) * f, spd, col());
      break;
    }
    case 'missile': addBullet(s, x, y, aim, spec.speed || 165, 'r', { kind: 'missile', home: spec.turn || 1.5, life: 5.5, r: 8 }); break;
    case 'thread': { // 糸状弾：波打ちながら左へ
      const n = spec.n || 8;
      for (let i = 0; i < n; i++) addBullet(s, x, y, Math.PI, spd, col(), { d: i * (spec.gap || 0.09), wav: { amp: spec.amp || 40, freq: spec.freq || 5, ph: 0 } });
      break;
    }
    case 'rain': { // 上から降る弾
      const n = spec.n || 2;
      for (let i = 0; i < n; i++) {
        const xx = ZONE.x0 + 20 + rand(s) * (ZONE.x1 - ZONE.x0 + 120);
        addBullet(s, xx, -10, Math.PI / 2 + (rand(s) - 0.5) * 0.3, spd, col());
      }
      break;
    }
    case 'safering': { // 放射状の赤弾。翼の開閉で抜け道（すき間）が上下に動く
      const n = spec.n || 24; const gapN = spec.gapN || 4;
      const gapA = aim + Math.sin(t * 1.3 + (ctx.phase || 0)) * (spec.sway || 0.7);
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n;
        let d = Math.abs(((a - gapA) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
        if (d < (Math.PI * gapN) / n) continue;
        addBullet(s, x, y, a, spd, col());
      }
      break;
    }
    case 'lightning': { // 横一列の雷の予告→落雷。少なくとも2本は安全な列を残す
      const lanes = spec.lanes || 6; const h = H / lanes; const strike = Math.min(spec.strike || 3, lanes - 2);
      const pl = Math.max(0, Math.min(lanes - 1, Math.floor(s.player.y / h)));
      const pick = new Set([pl]);
      // 自機の隣の列のどちらかは必ず安全にする（1列ぶん動けば逃げられる）
      const nb = [pl - 1, pl + 1].filter((i) => i >= 1 && i <= lanes - 2);
      const safe = nb.length ? nb[Math.floor(rand(s) * nb.length)] : (pl <= 1 ? 1 : lanes - 2);
      let guard = 0;
      while (pick.size < strike && guard++ < 50) { const i = Math.floor(rand(s) * lanes); if (i !== safe) pick.add(i); }
      for (const i of pick) s.hazards.push({ kind: 'lane', x0: 0, y0: h * i + h / 2, ang: 0, len: W, w: h * 0.86, warn: ctx.warn ?? 1.0, live: spec.live || 0.45, t: 0 });
      break;
    }
    case 'beam': { // 砲口から予告線→太い光線
      const offs = spec.offs || [0];
      for (const o of offs) s.hazards.push({ kind: 'beam', x0: x, y0: y, ang: aim + o, len: 1200, w: spec.w || 28, warn: ctx.warn ?? 1.0, live: spec.live || 0.5, t: 0 });
      break;
    }
    default: break;
  }
  return k;
}

// 航路で弾の色や敵の硬さが変わる
function routeSpec(s, spec, type) {
  if (!spec || !s.route) return spec;
  if (s.route === 'blue' && spec.colors && spec.colors.includes('r') && spec.pat !== 'missile') {
    return { ...spec, colors: spec.colors.replace(/r/g, 'rb') };
  }
  if (s.route === 'red' && spec.colors && type !== 'cruiser' && !spec.colors.includes('r')) {
    return { ...spec, colors: spec.colors + 'r' };
  }
  return spec;
}

// ---------- 敵 ----------
export function spawnEnemy(s, sp) {
  const def = ENEMY_TYPES[sp.type];
  let hp = sp.hp ?? def.hp;
  if (s.route === 'blue' && hp >= 2) hp += 1;
  if (s.difficulty === 'hard' && hp >= 3) hp += 1;
  const fire = sp.fire === null ? null : routeSpec(s, sp.fire || def.fire, sp.type);
  const e = {
    id: s.nextId++, type: sp.type, def, x: sp.x ?? W + 50, y: sp.y, baseY: sp.y, hp, maxHp: hp,
    r: def.r, t: 0, st: def.move === 'hover' ? 'enter' : 'fly', hx: sp.hx ?? 760, stay: sp.stay ?? def.stay ?? 14,
    speed: sp.speed ?? def.speed, move: def.move, fire, fireT: 0.8 + ((s.nextId * 0.37) % 1) * 0.8, k: 0,
    armor: !!sp.armor, closed: !!def.mirror, mirrorT: 0, healT: def.heal ? def.heal.period : 0, flash: 0,
  };
  s.enemies.push(e);
  return e;
}

function updateEnemy(s, e, dt) {
  e.t += dt; e.flash = Math.max(0, e.flash - dt);
  const d = e.def;
  if (e.move === 'hover') {
    if (e.st === 'enter') { e.x -= e.speed * dt; if (e.x <= e.hx) { e.x = e.hx; e.st = 'stay'; e.stayT = 0; } }
    else if (e.st === 'stay') { e.stayT += dt; e.y = e.baseY + Math.sin(e.t * 1.3 + e.id) * 12; if (e.stayT >= e.stay) e.st = 'exit'; }
    else { e.x += e.speed * 1.3 * dt; }
  } else {
    e.x -= e.speed * dt;
    if (e.move === 'sine') e.y = e.baseY + Math.sin(e.t * (d.freq || 2) + e.id) * (d.amp || 40);
  }
  // 鏡鳥：閉じている間は通常弾を跳ね返す
  if (d.mirror) {
    e.mirrorT += dt;
    const cyc = d.mirror.closed + d.mirror.open;
    e.closed = (e.mirrorT % cyc) < d.mirror.closed;
  }
  // 修復ドローン：周りの艦（とボス）を直す
  if (d.heal && e.st === 'stay') {
    e.healT -= dt;
    if (e.healT <= 0) {
      e.healT = d.heal.period;
      for (const o of s.enemies) {
        if (o === e || o.hp >= o.maxHp) continue;
        if (Math.hypot(o.x - e.x, o.y - e.y) < d.heal.radius) { o.hp += 1; ev(s, 'heal', { x: e.x, y: e.y, tx: o.x, ty: o.y }); }
      }
      const b = s.boss;
      if (b && b.hp > 0 && b.hp < P.bossHp && Math.hypot(b.x - e.x, b.y - e.y) < d.heal.radius + 120) { b.hp = Math.min(P.bossHp, b.hp + 0.5); ev(s, 'heal', { x: e.x, y: e.y, tx: b.x, ty: b.y }); }
    }
  }
  // 射撃：画面に入っていて、撤退中でないときだけ
  const canFire = e.fire && e.st !== 'exit' && e.st !== 'enter' && e.x < W - 16 && e.x > ZONE.x1 - 60;
  if (canFire) {
    e.fireT -= dt;
    if (e.fireT <= 0) {
      e.fireT = e.fire.period * s.periodMul;
      e.k = emit(s, e.fire, e.x - e.r * 0.6, e.y, { t: e.t, count: e.k });
      ev(s, 'efire', { x: e.x, y: e.y });
    }
  }
}

function killEnemy(s, e, by) {
  e.hp = 0; e.dead = true;
  s.stats.kills += 1;
  s.stats.killsByType[e.type] = (s.stats.killsByType[e.type] || 0) + 1;
  s.score += e.def.score * (by === 'lance' ? 2 : 1);
  ev(s, 'boom', { x: e.x, y: e.y, r: e.r, by, type: e.type });
}

// ---------- ボス ----------
function spawnBoss(s) {
  const def = BOSSES[s.seaDef.boss];
  s.boss = { def, hp: P.bossHp, x: W + 170, y: H / 2, t: 0, ph: 'enter', pt: 0, ai: 0, armored: true, openT: 0, fireT: 0, k: 0, addT: def.adds ? 6 : 0, flash: 0, wing: 0 };
  ev(s, 'boss', { name: def.name });
  setHint(s, `${def.name}　装甲は雷槍で割れる`, 4);
}

export function bossMuzzles(b) {
  const a = b.def.attacks[b.ai];
  return a.muzzle.map((i) => ({ x: b.x + b.def.muzzles[i][0], y: b.y + b.def.muzzles[i][1] }));
}

function updateBoss(s, dt) {
  const b = s.boss; if (!b || b.hp <= 0) return;
  const d = b.def;
  b.t += dt; b.pt += dt; b.flash = Math.max(0, b.flash - dt);
  if (!b.armored) { b.openT -= dt; if (b.openT <= 0) { b.armored = true; ev(s, 'armor', {}); } }
  if (b.ph === 'leave') { b.x += 220 * dt; b.y += (H / 2 - 40 - b.y) * dt; return; }
  if (b.ph === 'enter') {
    b.x -= (b.showcase ? 320 : 200) * dt;
    if (b.x <= d.hx) { b.x = d.hx; b.ph = 'warn'; b.pt = 0; b.t = 0; }
    return;
  }
  if (b.showcase) {
    // 序章の主機は自分では攻撃しない（弾は序章の進行が撃つ）。雷槍を教える間はセナの正面へ寄ってくる
    const st = s.pro && s.pro.stage;
    const ty = st === 'tut3' ? s.player.y : s.pro && s.pro.beam ? H / 2 : H / 2 + Math.sin(b.t * 0.6 * Math.PI) * 40;
    b.y += (ty - b.y) * Math.min(1, dt * (st === 'tut3' ? 2.5 : 1.5));
    if (!b.armored) { b.openT -= dt; if (b.openT <= 0) b.armored = true; }
    return;
  }
  b.y = H / 2 + Math.sin(b.t * d.freq * Math.PI) * d.amp;
  const atk = d.attacks[b.ai];
  // 翼（主機）の開閉：赤弾の抜け道が動くのが見えるように
  b.wing = 0.5 + 0.5 * Math.sin(b.t * 1.3);
  if (b.ph === 'warn') {
    if (b.pt >= atk.warn) {
      b.ph = 'fire'; b.pt = 0; b.fireT = 0;
      ev(s, 'bfire', { name: atk.name });
    }
  } else if (b.ph === 'fire') {
    b.fireT -= dt;
    if (b.fireT <= 0) {
      b.fireT = atk.period * s.periodMul;
      const hz = atk.spec.pat === 'lightning' || atk.spec.pat === 'beam';
      if (hz) {
        if (atk.spec.pat === 'beam') bossMuzzles(b).forEach((m, i) => emit(s, { ...atk.spec, offs: [atk.spec.offs[i % atk.spec.offs.length]] }, m.x, m.y, { warn: 0.9 }));
        else emit(s, atk.spec, b.x, b.y, { warn: 0.95 });
      } else {
        for (const m of bossMuzzles(b)) b.k = emit(s, atk.spec, m.x, m.y, { t: b.pt + b.t, count: b.k, phase: b.t });
      }
    }
    if (b.pt >= atk.dur) { b.ph = 'rest'; b.pt = 0; }
  } else if (b.ph === 'rest') {
    if (b.pt >= 0.7) { b.ai = (b.ai + 1) % d.attacks.length; b.ph = 'warn'; b.pt = 0; ev(s, 'bwarn', { name: d.attacks[b.ai].name }); }
  }
  // 護衛の呼び出し（双塔船の修理ドローンなど）
  if (d.adds) {
    b.addT -= dt;
    if (b.addT <= 0) {
      b.addT = d.adds.period;
      if (s.enemies.filter((e) => e.type === d.adds.type).length < 2) for (const y of d.adds.ys) spawnEnemy(s, { type: d.adds.type, y, hx: d.adds.hx, stay: 30 });
    }
  }
}

// ボスに当たったときのダメージ処理。装甲中は通常弾が効かない。雷槍は装甲を割る
function hitBoss(s, dmg, kind, x, y) {
  const b = s.boss; if (!b || b.hp <= 0 || b.ph === 'enter') return false;
  if (b.showcase) {
    if (kind === 'lance' && s.pro && s.pro.stage === 'tut3') { s.pro.lanceHit = true; b.armored = false; b.openT = 3; b.flash = 0.5; ev(s, 'proCrack', { x, y }); return true; }
    b.flash = 0.04; ev(s, 'clink', { x, y }); if (s.pro) s.pro.clinks = (s.pro.clinks || 0) + 1; return true;
  }
  if (kind === 'lance') {
    b.hp = Math.max(0, b.hp - dmg); b.armored = false; b.openT = P.bossOpen; b.flash = 0.25;
    ev(s, 'bossHit', { x, y, dmg, lance: true });
  } else if (b.armored) {
    if (b.def.reflect) addBullet(s, x - 10, y, aimAt(s, x, y), 230, 'r');
    ev(s, 'clink', { x, y });
  } else {
    b.hp = Math.max(0, b.hp - P.bossChip); b.flash = 0.06;
    ev(s, 'bossHit', { x, y, dmg: P.bossChip });
  }
  if (b.hp <= 0) {
    s.phase = 'bossDown'; s.phaseT = 0; s.stats.kills += 1; s.score += 5000;
    s.bullets.length = 0; s.hazards.length = 0;
    for (const e of s.enemies) if (!e.dead) killEnemy(s, e, 'chain');
    ev(s, 'bossDown', { x: b.x, y: b.y });
  }
  return true;
}

// ---------- 自機 ----------
function hurt(s) {
  const p = s.player;
  if (p.inv > 0 || s.phase === 'bossDown' || s.phase === 'clear') return false;
  if (s.phase === 'prologue') { p.inv = 0.8; ev(s, 'proGraze', { x: p.x, y: p.y }); return true; }
  p.hp -= 1; p.inv = P.inv; s.stats.hits += 1;
  ev(s, 'hurt', { x: p.x, y: p.y, hp: p.hp });
  if (p.hp <= 0) {
    if (s.practice) { p.hp = P.hpMax; ev(s, 'practiceRefill', {}); }
    else { s.deadAtBoss = !!s.boss && s.boss.hp > 0; s.phase = 'dead'; s.phaseT = 0; ev(s, 'dead', {}); }
  }
  return true;
}

function fireLance(s) {
  const p = s.player;
  const dmg = lancePower(p.gauge);
  const half = dmg >= 4 ? 20 : 12;
  p.gauge = 0;
  let kills = 0; let hitAny = false;
  for (const e of s.enemies) {
    if (e.dead || e.x + e.r < p.x) continue;
    if (Math.abs(e.y - p.y) < e.r + half) {
      hitAny = true; e.flash = 0.2;
      e.hp -= dmg;
      if (e.hp <= 0) { killEnemy(s, e, 'lance'); kills += 1; }
    }
  }
  const b = s.boss;
  if (b && b.hp > 0 && b.ph !== 'enter' && Math.abs(b.y - p.y) < b.def.r + half) {
    hitAny = true; hitBoss(s, dmg, 'lance', b.x - b.def.r, p.y);
    if (b.hp <= 0) kills += 1;
  }
  // 雷槍の通り道の赤弾（ミサイル含む）を焼き払う
  for (const bl of s.bullets) if (bl.x > p.x && Math.abs(bl.y - p.y) < half + bl.r && bl.d <= 0) { bl.dead = true; }
  s.lances.push({ x: p.x + 24, y: p.y, t: 0, power: dmg, half });
  s.stats.lances += 1; s.stats.lanceMax = Math.max(s.stats.lanceMax, kills);
  ev(s, 'lance', { x: p.x, y: p.y, power: dmg, kills, hitAny });
  if (kills >= 2) { s.score += 500 * kills; ev(s, 'multi', { x: p.x + 200, y: p.y, kills }); }
  if (s.tut && s.tut.step === 3) s.tut.lanced = true;
}

function updatePlayer(s, input, dt) {
  const p = s.player;
  p.inv = Math.max(0, p.inv - dt);
  // 射撃と吸収は排他。両方押していたら吸収を優先し、射撃はしない
  const absorbing = !!input.absorb;
  const shooting = !!input.fire && !absorbing;
  p.absorbing = absorbing;
  p.wing += ((absorbing ? 0 : 1) - p.wing) * Math.min(1, dt * 14);
  const spd = P.speed * (absorbing ? P.slow : 1);
  let mx = 0; let my = 0;
  if (input.target) {
    const dx = input.target.x - p.x; const dy = input.target.y - p.y; const dd = Math.hypot(dx, dy);
    if (dd > 0.5) { const step = Math.min(dd, spd * dt); mx = (dx / dd) * step; my = (dy / dd) * step; }
  } else {
    let ix = input.mx || 0; let iy = input.my || 0; const l = Math.hypot(ix, iy);
    if (l > 1) { ix /= l; iy /= l; }
    mx = ix * spd * dt; my = iy * spd * dt;
  }
  p.x = Math.max(ZONE.x0, Math.min(ZONE.x1, p.x + mx));
  p.y = Math.max(ZONE.y0, Math.min(ZONE.y1, p.y + my));
  p.moved += Math.hypot(mx, my);
  p.lastMove = Math.hypot(mx, my) / dt;
  // 通常射撃
  p.fireCd = Math.max(-0.001, p.fireCd - dt);
  if (shooting && p.fireCd <= 0) {
    p.fireCd += fireInterval(s.upgrades);
    if (p.fireCd < 0) p.fireCd = fireInterval(s.upgrades);
    s.shots.push({ x: p.x + 26, y: p.y + 2, vx: P.shotSpeed, dmg: 1 });
    ev(s, 'shot', {});
  }
  // 吸収を離した瞬間：40以上なら雷槍、40未満なら何も出ずゲージを保持
  if (p.prevAbsorb && !absorbing) {
    if (p.gauge >= P.lanceMin) fireLance(s);
    else if (p.gauge > 0) { ev(s, 'fizzle', {}); s.fizzles = (s.fizzles || 0) + 1; if (s.fizzles <= 2) setHint(s, '40未満では雷槍は出ない（ゲージは残る）', 2.2); }
  }
  p.prevAbsorb = absorbing;
}

// ---------- 進行（波・チュートリアル） ----------
function updateTutorial(s, dt) {
  const tu = s.tut; const p = s.player;
  tu.t += dt;
  if (tu.step === 0 && (tu.t >= 5 || (tu.t >= 2.5 && p.moved > 120))) { tu.step = 1; setHint(s, TUTORIAL[1].text, 99); for (const y of [170, 270, 370]) spawnEnemy(s, { type: 'scout', y, fire: null, speed: 80 }); }
  if (tu.step === 1 && (tu.t >= 11 || (tu.t > 6.5 && !s.enemies.length))) {
    tu.step = 2; setHint(s, TUTORIAL[2].text, 99);
    for (const hx of [720, 850]) spawnEnemy(s, { type: 'gunship', y: 270, hx, hp: 2, armor: true, stay: 1e9, fire: { pat: 'stream', n: 2, gap: 0.4, period: 2.2, speed: 120, colors: 'b' } });
  }
  if (tu.step === 2 && p.gauge >= P.lanceMin) { tu.step = 3; setHint(s, TUTORIAL[3].text, 99); }
  if (tu.step === 3 && p.gauge < P.lanceMin && !tu.lanced) { tu.step = 2; setHint(s, TUTORIAL[2].text, 99); }
  if (tu.step >= 2 && !s.enemies.some((e) => e.armor)) { s.tut = null; s.waveT = 0; s.spawnIdx = 0; setHint(s, '見事！ 赤い三角の弾は、次の波から来る', 3.5); ev(s, 'say', { who: 'rio', text: '見事だ、セナ。次は赤い三角が来る──吸えない、避けろ。……待ってる', dur: 4 }); }
}

// 序章：天の主機がいきなり現れ、その戦いの中でリオが操作を教える。雷槍で装甲を割った直後、
// 主機の光線からセナをかばってリオがさらわれる。段階（stage）ごとに進む。とばせる。
//  calm（並んで飛ぶ）→ alarm（警報・巨大な影）→ boss（登場）→ tut0 動く → tut1 撃つ（効かない）
//  → tut2 青を吸う → tut3 雷槍で装甲を割る → crack → beam（リオが割り込む）→ hit（さらわれる）→ speech → leave → 本編
export const PRO = { alarm: 3.8, boss: 6 };
export const PROLOGUE_TUT = ['tut0', 'tut1', 'tut2', 'tut3'];
function say(s, who, text, dur, keys = '') { ev(s, 'say', { who, text, dur, keys }); }
function proStage(s, st) { s.pro.stage = st; s.pro.st = 0; s.pro.beat = 0; s.pro.fireT = 0; ev(s, 'proStage', { stage: st }); }
function updatePrologue(s, dt) {
  const pr = s.pro; const a = pr.ally; const p = s.player; const b = s.boss;
  pr.t += dt; pr.st += dt;
  const once = (k, at) => { if (pr.beat < k && pr.st >= at) { pr.beat = k; return true; } return false; };
  // 主機の弾（序章では当たっても体力は減らない）
  const fan = (n, spread, spd, c) => { if (!b) return; const ang = Math.atan2(p.y - b.y, p.x - (b.x - 90)); for (let i = 0; i < n; i++) addBullet(s, b.x - 90, b.y, ang + (i - (n - 1) / 2) * spread, spd, c); };
  const ring = (n, spd, c) => { if (!b) return; for (let i = 0; i < n; i++) { const ang = Math.PI * (0.55 + (i / (n - 1)) * 0.9); addBullet(s, b.x - 70, b.y, ang, spd, c); } };
  switch (pr.stage) {
    case 'calm':
      if (once(1, 0.9)) say(s, 'rio', 'セナ、後ろは任せた。今夜、大艦隊の港を落とす', 1.8);
      if (once(2, 2.7)) say(s, 'sena', 'うん。……終わったら、二人で暮らす約束だよ', 1.2);
      if (pr.t >= PRO.alarm) { proStage(s, 'alarm'); ev(s, 'proAlarm', {}); say(s, 'rio', '……待て。下の雲が、赤く光ってる', 2); }
      break;
    case 'alarm':
      if (pr.t >= PRO.boss) {
        proStage(s, 'boss');
        const def = BOSSES[SEAS[5].boss];
        s.boss = { def, hp: 999, x: W + 220, y: H / 2, t: 0, ph: 'enter', pt: 0, ai: 0, armored: true, openT: 0, fireT: 0, k: 0, addT: 0, flash: 0, wing: 0, showcase: true };
        ev(s, 'proBoss', { name: def.name });
      }
      break;
    case 'boss':
      if (once(1, 0.5)) say(s, 'rio', 'あれは……天の主機！ 大艦隊の心臓だ！', 1.6);
      if (pr.st >= 3) { proStage(s, 'tut0'); say(s, 'rio', '来るぞ、セナ！ 翼を動かして弾をかわせ！', 0, 'move'); }
      break;
    case 'tut0':
      pr.fireT += dt; if (pr.fireT > 1.5) { pr.fireT = 0; ring(9, 110, 'r'); }
      if ((pr.st > 1.5 && p.moved > 150) || pr.st > 6) { proStage(s, 'tut1'); s.bullets.length = 0; say(s, 'rio', 'いいぞ！ 撃ち返せ！', 0, 'fire'); }
      break;
    case 'tut1':
      pr.fireT += dt; if (pr.fireT > 2) { pr.fireT = 0; ring(7, 100, 'r'); }
      if (pr.beat === 0 && ((pr.clinks || 0) >= 10 || pr.st > 6)) { pr.beat = 1; pr.st = 0; say(s, 'sena', '撃っても……効かない！？', 1.3); }
      if (pr.beat === 1 && pr.st >= 1.4) { proStage(s, 'tut2'); s.bullets.length = 0; say(s, 'rio', '装甲が厚すぎる。あいつの青い弾を吸って、雷に変えろ！', 0, 'absorb'); }
      break;
    case 'tut2':
      pr.fireT += dt; if (pr.fireT > 1.1) { pr.fireT = 0; fan(5, 0.16, 120, 'b'); }
      if (p.gauge >= P.lanceMin) { proStage(s, 'tut3'); say(s, 'rio', '溜まった！ 正面に並んで、離せ！ 雷槍で装甲を割れ！', 0, 'lance'); }
      break;
    case 'tut3':
      pr.fireT += dt; if (pr.fireT > 1.6) { pr.fireT = 0; fan(3, 0.2, 110, 'b'); }
      if (pr.lanceHit) { proStage(s, 'crack'); s.bullets.length = 0; say(s, 'rio', '割れた！ 効いてるぞ、セナ！', 1.6); }
      else if (p.gauge < P.lanceMin && !p.absorbing && pr.st > 0.5) { proStage(s, 'tut2'); say(s, 'rio', '外れた！ もう一度、青を吸え！', 0, 'absorb'); }
      break;
    case 'crack':
      if (once(1, 1.7)) say(s, 'boss', '……小賢しい雷鳥乗りめ', 1.4);
      if (pr.st >= 3.1) {
        proStage(s, 'beam'); s.bullets.length = 0;
        pr.beam = { t: 0, y: p.y };
        ev(s, 'proBeam', {}); say(s, 'rio', 'セナ、危ない！！', 1);
      }
      break;
    case 'beam':
      if (pr.st >= 1) { proStage(s, 'hit'); a.captured = true; s.bullets.length = 0; ev(s, 'allyDown', { x: a.x, y: a.y }); say(s, 'sena', 'リオ――！！', 1.5); }
      break;
    case 'hit':
      if (pr.st >= 1.6) { proStage(s, 'speech'); say(s, 'boss', '雷鳥乗りの娘よ。この男は預かる。返してほしくば、六つの海を越えて来い', 2.6); }
      break;
    case 'speech':
      if (pr.st >= 2.6) { proStage(s, 'leave'); if (b) b.ph = 'leave'; say(s, 'sena', '待って……リオ！ ……必ず、取り戻す', 1.6); }
      break;
    case 'leave':
      if (pr.st >= 1.8) { s.tutDone = true; endPrologue(s); }
      break;
    default: break;
  }
  if (pr.beam) pr.beam.t += dt;
  // 僚機：自機の少し前を飛ぶ。光線の予告中はセナと主機の間に割って入る。さらわれた後は主機へ引き寄せられる
  if (!a.captured) {
    const k = Math.min(1, dt * (pr.beam ? 7 : 3));
    const tx = pr.beam ? p.x + 110 : p.x + 60; const ty = pr.beam ? pr.beam.y : p.y + (p.y > H / 2 ? -80 : 80);
    a.x += (tx - a.x) * k; a.y += (ty - a.y) * k;
  } else if (b) { const tx = b.x - 40, ty = b.y + 70; const k = Math.min(1, dt * (pr.stage === 'leave' ? 8 : 2.2)); a.x += (tx - a.x) * k; a.y += (ty - a.y) * k; }
}
export function endPrologue(s) {
  if (s.phase !== 'prologue') return;
  s.boss = null; s.bullets.length = 0; s.hazards.length = 0; s.enemies.length = 0; s.lances.length = 0;
  s.pro = null; s.phase = 'intro'; s.phaseT = 0; s.seaT = 0;
  s.player.hp = P.hpMax; s.player.inv = 0; s.player.gauge = 0; s.stats.hits = 0;
  setHint(s, '', 0);
  ev(s, 'proEnd', {});
}

function updateDirector(s, dt) {
  s.phaseT += dt;
  if (s.phase === 'prologue') { updatePrologue(s, dt); return; }
  if (s.phase === 'intro') {
    if (s.phaseT >= 1.5) startWave(s, 0);
    return;
  }
  if (s.phase === 'waveGap') {
    if (s.phaseT >= 1.3) {
      if (s.waveIdx < 3) startWave(s, s.waveIdx);
      else { s.phase = 'boss'; s.phaseT = 0; spawnBoss(s); }
    }
    return;
  }
  if (s.phase === 'wave') {
    if (s.tut) { updateTutorial(s, dt); return; }
    s.waveT += dt;
    const wave = s.seaDef.waves[s.waveIdx];
    const tMul = s.route === 'red' ? 0.82 : 1;
    while (s.spawnIdx < wave.spawns.length && wave.spawns[s.spawnIdx].t * tMul <= s.waveT) spawnEnemy(s, wave.spawns[s.spawnIdx++]);
    if (s.spawnIdx >= wave.spawns.length && s.enemies.length === 0 && s.waveT >= (wave.minT || 0) * tMul) {
      s.waveIdx += 1; s.phase = 'waveGap'; s.phaseT = 0;
      ev(s, 'waveClear', { idx: s.waveIdx });
    }
    return;
  }
  if (s.phase === 'bossDown') {
    if (s.phaseT >= 2.0) finishSea(s);
  }
}

function startWave(s, i) {
  s.phase = 'wave'; s.phaseT = 0; s.waveIdx = i; s.waveT = 0; s.spawnIdx = 0;
  const wave = s.seaDef.waves[i];
  if (wave.tutorial && !s.practice && s.sea === 0 && !s.tutDone) { s.tut = { step: 0, t: 0 }; setHint(s, TUTORIAL[0].text, 99); }
  else if (wave.hint) setHint(s, wave.hint, 5);
  ev(s, 'wave', { idx: i, name: wave.name });
}

function finishSea(s) {
  const st = s.stats;
  const medals = {
    nohit: st.hits === 0 && !s.fromBoss,
    lance2: st.lanceMax >= 2,
    time: !s.fromBoss && s.seaT <= s.seaDef.par,
  };
  s.result = { sea: s.sea, time: Math.round(s.seaT * 10) / 10, hits: st.hits, kills: st.kills, lanceMax: st.lanceMax, score: s.score, medals, killsByType: { ...st.killsByType }, absorbed: st.absorbed };
  s.phase = 'clear'; s.phaseT = 0;
  ev(s, 'clear', { sea: s.sea });
}

// ---------- 1ステップ ----------
export function step(s, input = {}, dt = DT) {
  if (s.phase === 'clear' || s.phase === 'dead') { s.phaseT += dt; return s; }
  s.t += dt; s.seaT += dt;
  if (s.hintT > 0) { s.hintT -= dt; if (s.hintT <= 0) s.hint = ''; }
  const p = s.player;
  if (s.phase !== 'bossDown') updatePlayer(s, input, dt);
  else { p.absorbing = false; p.prevAbsorb = false; }
  updateDirector(s, dt);
  if (s.phase === 'clear') return s;

  for (const e of s.enemies) updateEnemy(s, e, dt);
  updateBoss(s, dt);

  // 敵弾
  const R = absorbRadius(s.upgrades);
  for (const b of s.bullets) {
    if (b.dead) continue;
    if (b.d > 0) { b.d -= dt; continue; }
    b.t += dt;
    if (b.home) { // ミサイル：少しずつ自機の方へ曲がる
      const cur = Math.atan2(b.vy, b.vx); const want = Math.atan2(p.y - b.y, p.x - b.x);
      let df = ((want - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      df = Math.max(-b.home * dt, Math.min(b.home * dt, df));
      const sp = Math.hypot(b.vx, b.vy);
      b.vx = Math.cos(cur + df) * sp; b.vy = Math.sin(cur + df) * sp;
      if (b.t > b.life) b.dead = true;
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.wav) b.y += Math.cos(b.t * b.wav.freq) * b.wav.amp * b.wav.freq * dt;
    if (b.bounce && (b.y < 8 || b.y > H - 8)) { b.vy = -b.vy; b.y = Math.max(8, Math.min(H - 8, b.y)); b.bounce -= 1; ev(s, 'bounce', { x: b.x, y: b.y }); }
    if (b.x < -40 || b.x > W + 60 || b.y < -40 || b.y > H + 40) { b.dead = true; continue; }
    const dist = Math.hypot(b.x - p.x, b.y - p.y);
    // 吸収：青弾だけ。赤弾は吸えない
    if (p.absorbing && b.c === 'b' && dist < R) {
      b.dead = true; s.stats.absorbed += 1;
      const before = p.gauge;
      p.gauge = Math.min(P.gaugeMax, p.gauge + gaugeGain(s.upgrades));
      ev(s, 'absorb', { x: b.x, y: b.y, gauge: p.gauge, crossed: before < P.lanceMin && p.gauge >= P.lanceMin ? 40 : before < P.lanceStrong && p.gauge >= P.lanceStrong ? 80 : 0 });
      continue;
    }
    if (dist < b.r + P.hitR && s.phase !== 'bossDown') { if (hurt(s)) b.dead = true; }
  }

  // 予告線・雷
  for (const h of s.hazards) {
    h.t += dt;
    if (h.t >= h.warn && !h.fired) { h.fired = true; ev(s, 'zap', { kind: h.kind }); }
    if (h.t >= h.warn && h.t < h.warn + h.live) {
      const dx = Math.cos(h.ang); const dy = Math.sin(h.ang);
      const rx = p.x - h.x0; const ry = p.y - h.y0;
      const along = rx * dx + ry * dy; const perp = Math.abs(-rx * dy + ry * dx);
      if (along > 0 && along < h.len && perp < h.w / 2 + P.hitR) hurt(s);
    }
  }
  s.hazards = s.hazards.filter((h) => h.t < h.warn + h.live);

  // 自機の弾
  for (const sh of s.shots) {
    sh.x += sh.vx * dt;
    if (sh.x > W + 20) { sh.dead = true; continue; }
    for (const e of s.enemies) {
      if (e.dead) continue;
      if (Math.abs(sh.x - e.x) < e.r + 6 && Math.abs(sh.y - e.y) < e.r + 3) {
        sh.dead = true;
        if (e.closed) { // 鏡：赤弾にして返す
          addBullet(s, e.x - e.r, sh.y, aimAt(s, e.x, sh.y), 220, 'r');
          ev(s, 'reflect', { x: e.x - e.r, y: sh.y });
        } else if (e.armor) {
          ev(s, 'clink', { x: e.x - e.r, y: sh.y });
          if (s.tut && !s.hint.includes('装甲')) setHint(s, '装甲で弾かれた！ 青を吸って雷槍で貫こう', 99);
        } else {
          e.hp -= sh.dmg; e.flash = 0.08;
          ev(s, 'spark', { x: e.x - e.r * 0.5, y: sh.y });
          if (e.hp <= 0) killEnemy(s, e, 'shot');
        }
        break;
      }
    }
    if (sh.dead) continue;
    // ミサイルは撃ち落とせる
    for (const b of s.bullets) {
      if (b.kind === 'missile' && !b.dead && b.d <= 0 && Math.abs(sh.x - b.x) < 14 && Math.abs(sh.y - b.y) < 12) {
        b.dead = true; sh.dead = true; ev(s, 'spark', { x: b.x, y: b.y, missile: true }); s.score += 50; break;
      }
    }
    if (sh.dead) continue;
    const bo = s.boss;
    if (bo && bo.hp > 0 && bo.ph !== 'enter' && Math.hypot(sh.x - bo.x, sh.y - bo.y) < bo.def.r) {
      sh.dead = true; hitBoss(s, sh.dmg, 'shot', sh.x, sh.y);
    }
  }

  // 体当たり
  if (s.phase !== 'bossDown') {
    for (const e of s.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < e.r * 0.75 + P.hitR) hurt(s);
    const bo = s.boss;
    if (bo && bo.hp > 0 && Math.hypot(bo.x - p.x, bo.y - p.y) < bo.def.r * 0.8) hurt(s);
  }

  for (const l of s.lances) l.t += dt;
  s.lances = s.lances.filter((l) => l.t < 0.45);
  s.shots = s.shots.filter((x) => !x.dead);
  s.bullets = s.bullets.filter((x) => !x.dead);
  s.enemies = s.enemies.filter((e) => !e.dead && e.x > -70 && e.x < W + 120);
  return s;
}

// ---------- 強化・保存 ----------
export function upgradeChoices(sea) { return sea < UPGRADE_PAIRS.length ? UPGRADE_PAIRS[sea] : []; }
export function applyUpgrade(up, key) { const u = { wing: 0, eff: 0, rate: 0, ...up }; if (key in u) u[key] += 1; return u; }

const SAVE_V = 1;
export function defaultSave() {
  return {
    v: SAVE_V, reached: 0, cleared: [false, false, false, false, false, false], hard: false,
    medals: {}, best: {}, logs: [], runs: [],
    progress: null, // { sea, upgrades, route, difficulty, picks, totals }
    settings: { sound: true, vol: 0.7, shake: true },
  };
}
export function parseSave(text) {
  const d = defaultSave();
  if (!text) return d;
  let o; try { o = JSON.parse(text); } catch { return d; }
  if (!o || typeof o !== 'object' || o.v !== SAVE_V) return d;
  const out = { ...d, ...o, settings: { ...d.settings, ...(o.settings || {}) } };
  if (!Array.isArray(out.cleared) || out.cleared.length !== 6) out.cleared = d.cleared;
  out.reached = Math.max(0, Math.min(5, out.reached | 0));
  if (typeof out.medals !== 'object' || !out.medals) out.medals = {};
  if (!Array.isArray(out.logs)) out.logs = [];
  if (!Array.isArray(out.runs)) out.runs = [];
  if (out.progress && !(out.progress.sea >= 0 && out.progress.sea <= 5)) out.progress = null;
  return out;
}
export function medalCount(save) { return Object.values(save.medals).filter(Boolean).length; }
export const MEDAL_TOTAL = SEAS.length * MEDALS.length;

export function newCampaign(difficulty = 'normal') {
  return { sea: 0, upgrades: { wing: 0, eff: 0, rate: 0 }, route: null, difficulty, picks: [], totals: { kills: 0, hits: 0, time: 0, lanceMax: 0, killsByType: {} } };
}

// 海域クリアを保存に反映する（勲章・ベスト・日誌）。練習でも勲章は取れる
export function recordClear(save, result, ctx = {}) {
  const sv = { ...save, medals: { ...save.medals }, best: { ...save.best }, cleared: [...save.cleared], logs: [...save.logs] };
  for (const [k, v] of Object.entries(result.medals)) if (v) sv.medals[`${result.sea}-${k}`] = true;
  const b = sv.best[result.sea];
  if (!b || result.time < b.time) sv.best[result.sea] = { time: result.time, hits: result.hits };
  if (!ctx.practice) {
    sv.cleared[result.sea] = true;
    sv.reached = Math.max(sv.reached, Math.min(5, result.sea + 1));
    if (!sv.logs.includes(result.sea)) sv.logs.push(result.sea);
    if (result.sea === 5) sv.hard = true;
  }
  return sv;
}

// キャンペーン側の進行：クリア結果を合計し、次の海域へ（強化を選んでから）
export function advanceCampaign(camp, result, upgradeKey) {
  const c = { ...camp, totals: { ...camp.totals, killsByType: { ...camp.totals.killsByType } }, picks: [...camp.picks] };
  c.totals.kills += result.kills; c.totals.hits += result.hits; c.totals.time += result.time;
  c.totals.lanceMax = Math.max(c.totals.lanceMax, result.lanceMax);
  for (const [k, v] of Object.entries(result.killsByType || {})) c.totals.killsByType[k] = (c.totals.killsByType[k] || 0) + v;
  if (upgradeKey) { c.upgrades = applyUpgrade(c.upgrades, upgradeKey); c.picks.push(upgradeKey); }
  c.sea = Math.min(6, camp.sea + 1);
  return c;
}
export function needsRoute(camp) { return camp.sea === 2 && !camp.route; }

// ---------- 自動操縦（テストのクリア可能性検証と、共有画像・タイトルの演出用） ----------
// 危険（赤弾・射撃中の青弾・予告線）から離れ、青弾が近いときは吸い、溜まったら敵と高さを合わせて雷槍。
export function autopilot(s) {
  const p = s.player; const R = absorbRadius(s.upgrades);
  const targets = s.enemies.filter((e) => !e.dead && e.x < W - 10);
  const bo = s.boss && s.boss.hp > 0 && s.boss.ph !== 'enter' ? s.boss : null;
  let ty = H / 2; let tx = 150;
  if (bo) ty = bo.y; else if (targets.length) {
    let best = null; let bestN = -1;
    for (const e of targets) { const n = targets.filter((o) => Math.abs(o.y - e.y) < o.r + 16).length * 10 - Math.abs(e.y - p.y) * 0.02; if (n > bestN) { bestN = n; best = e; } }
    ty = best.y;
  }
  const blueNear = s.bullets.some((b) => b.c === 'b' && b.d <= 0 && Math.hypot(b.x - p.x, b.y - p.y) < R + 50 && b.vx < 60);
  const aligned = (bo && Math.abs(bo.y - p.y) < bo.def.r * 0.7) || targets.some((e) => Math.abs(e.y - p.y) < e.r + 8);
  let absorb = blueNear && p.gauge < 100;
  if (p.absorbing && p.gauge >= P.lanceStrong && aligned) absorb = false;
  if (p.absorbing && p.gauge >= P.lanceMin && aligned && bo && !bo.armored) absorb = false;
  if (p.gauge >= 100 && !aligned && p.absorbing) absorb = true; // 合わせるまで溜めたまま
  const spd = P.speed * (absorb ? P.slow : 1);
  const look = 0.22;
  let best = null; let bestScore = Infinity;
  for (let k = 0; k < 17; k++) {
    const a = (k / 16) * Math.PI * 2; const m = k === 16 ? 0 : 1;
    const nx = Math.max(ZONE.x0, Math.min(ZONE.x1, p.x + Math.cos(a) * spd * look * m));
    const ny = Math.max(ZONE.y0, Math.min(ZONE.y1, p.y + Math.sin(a) * spd * look * m));
    let danger = 0;
    for (const b of s.bullets) {
      if (b.c === 'b' && absorb) continue;
      for (const f of [0.5, 1]) {
        const bx = b.x + b.vx * look * f; const by = b.y + b.vy * look * f;
        const px = p.x + (nx - p.x) * f; const py = p.y + (ny - p.y) * f;
        const d = Math.hypot(bx - px, by - py);
        if (d < 34) danger += (34 - d) ** 2;
      }
    }
    for (const h of s.hazards) {
      if (h.warn - h.t > 1.0) continue;
      const dx = Math.cos(h.ang); const dy = Math.sin(h.ang);
      const far = Math.max(look, Math.min(0.9, h.warn - h.t)) / look; // 予告線は「着弾までに動ける距離」で考える
      const fx = Math.max(ZONE.x0, Math.min(ZONE.x1, p.x + (nx - p.x) * far));
      const fy = Math.max(ZONE.y0, Math.min(ZONE.y1, p.y + (ny - p.y) * far));
      const rx = fx - h.x0; const ry = fy - h.y0;
      const perp = Math.abs(-rx * dy + ry * dx); const along = rx * dx + ry * dy;
      if (along > 0 && perp < h.w / 2 + 16) danger += 4000 + (h.w / 2 + 16 - perp) * 60;
    }
    for (const e of s.enemies) { const d = Math.hypot(e.x - nx, e.y - ny); if (d < e.r + 30) danger += (e.r + 30 - d) ** 2; }
    const edge = Math.min(nx - ZONE.x0, ZONE.x1 - nx, ny - ZONE.y0, ZONE.y1 - ny);
    const score = danger * 10 + Math.abs(ny - ty) * 1.2 + Math.abs(nx - tx) * 0.4 + (edge < 30 ? (30 - edge) * 3 : 0);
    if (score < bestScore) { bestScore = score; best = { x: nx, y: ny }; }
  }
  return { target: best, absorb, fire: !absorb };
}
