import * as L from './logic.js';
import * as R from './render.js';
import { createAudio } from './audio.js';

const { GARDENS, DIRS, WIND_NAMES, WIND_ARROWS } = L;
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const OG = params.get('og') === '1';
if (OG) document.body.classList.add('og');
const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
let store = null;
try { store = window.localStorage; store.getItem('x'); } catch { store = { getItem: () => null, setItem: () => {} }; }
const SAVE = 'wind-garden:v1';
const audio = createAudio(store);

let game = L.newGame();
if (OG) {
  game = L.sanitize({ cur: 0, got: [true, ...Array(14).fill(false)], gardens: [{ x: 3, y: 4, wind: 1, fluff: [[3, 6]], bloom: [true], turns: 3 }, {}, {}, {}, {}] });
} else {
  try { game = L.sanitize(JSON.parse(store.getItem(SAVE) || 'null')); } catch { game = L.newGame(); }
}
const save = () => { if (OG) return; try { store.setItem(SAVE, JSON.stringify(game)); } catch { /* 保存できなくても遊べる */ } };

// ---------- 画面の状態 ----------
const cv = $('cv'); const ctx = cv.getContext('2d');
let W = 0; let H = 0; let DPR = 1;
const view = { gi: -1, minX: 0, minY: 0, scale: 1, ox: 0, oy: 0 };
const anim = { px: 0, py: 0, fluff: [], bridge: {}, vane: [1, 0], lockUntil: 0, moving: false, facing: [1, 0], hist: 0 };
const fx = []; // 画面座標の粒・光
let toastTimer = 0; let everMoved = false; let everTurned = false; let celebrate = 0; let resetArmed = 0;
let started = performance.now();

function resize() {
  const r = cv.getBoundingClientRect();
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  view.gi = -1;
}
function fitView() {
  const b = R.viewBox(game.cur);
  const bw = b.maxX - b.minX; const bh = b.maxY - b.minY;
  const s = Math.min(W / bw, H / bh) * 0.97;
  view.scale = Math.min(s, 1.7);
  view.ox = W / 2 - ((b.minX + b.maxX) / 2) * view.scale;
  view.oy = H / 2 - ((b.minY + b.maxY) / 2) * view.scale - (OG ? 0 : 8);
  view.gi = game.cur;
}
const toScreen = (x, y, z = 0) => { const [sx, sy] = R.proj(x, y, z); return [sx * view.scale + view.ox, sy * view.scale + view.oy]; };

function resetAnim() {
  const gs = game.gardens[game.cur];
  anim.px = gs.x; anim.py = gs.y;
  anim.fluff = gs.fluff.map(([x, y]) => [x, y]);
  anim.bridge = {};
  GARDENS[game.cur].bridges.forEach((b) => { anim.bridge[`${b.x},${b.y}`] = L.bridgeActive(game.cur, b.x, b.y, gs.wind) ? 1 : 0; });
  anim.vane = R.windVector(gs.wind);
}

// ---------- 通知 ----------
function toast(msg, ms = 2400) {
  const el = $('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ---------- HUD ----------
function updateHud() {
  const gi = game.cur; const g = GARDENS[gi]; const gs = game.gardens[gi];
  $('gname').innerHTML = `${g.name} <b>${L.gardenGot(game, gi)}/3</b>`;
  $('total').innerHTML = `☁ <b>${L.gotCount(game)}/15</b>`;
  $('compassArrow').textContent = '↑';
  $('compassName').textContent = WIND_NAMES[gs.wind];
  $('compassArrow').style.display = 'inline-block';
  $('compassArrow').style.transform = `rotate(${gs.wind * 90 + 45}deg)`;
  const tabs = $('tabs');
  if (!tabs.children.length) {
    GARDENS.forEach((gg, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tab'; b.dataset.i = i;
      b.addEventListener('click', () => travel(i));
      tabs.appendChild(b);
    });
  }
  [...tabs.children].forEach((b, i) => {
    const open = L.isUnlocked(game, i);
    b.disabled = !open; b.setAttribute('aria-current', String(i === gi));
    b.textContent = open ? `${i + 1} ${GARDENS[i].name}` : `${i + 1} 🔒`;
    b.setAttribute('aria-label', open ? `${i + 1}の庭 ${GARDENS[i].name}` : `${i + 1}の庭は鍵がかかっています`);
  });
  const can = L.canTurn(game);
  const wb = $('windBtn'); wb.disabled = !can;
  const next = (gs.wind + 1) % 4;
  $('wbSub').textContent = can ? `次は ${WIND_ARROWS[next]} ${WIND_NAMES[next]}` : (L.onSolid(game) ? '風見鶏のそばで' : '橋の上では回せない');
  wb.setAttribute('aria-label', can ? `風を回す。次は${WIND_NAMES[next]}` : '風を回す（風見鶏のそばで使えます）');
  const hb = $('hintbar');
  let hint = '';
  if (!everMoved && L.gotCount(game) === 0) hint = coarse ? '方向パッドで歩こう（ななめに進みます）' : '矢印キー／WASD か方向パッドで歩こう（ななめに進みます）';
  else if (!everTurned && L.gotCount(game) >= 1 && game.gardens[0].turns === 0 && gi === 0) hint = '金色の風見鶏のそばで「風を回す」（Space）';
  else if (can && L.totalTurns(game) < 6) hint = '次の風：青い点線＝橋が現れる／橙の点線＝橋が消える';
  hb.textContent = hint; hb.classList.toggle('off', !hint);
  audio.setLevel(L.gotCount(game));
  $('muteBtn').textContent = audio.state.muted ? '×' : '♪';
  $('muteBtn').setAttribute('aria-pressed', String(audio.state.muted));
}

// ---------- 操作 ----------
const held = []; // 押している方向（後から押したものが優先）
let lastStep = 0;
const STEP_MS = 150;
function doMove(dir) {
  const now = performance.now();
  if (now < anim.lockUntil) return false;
  const gi = game.cur; const prev = { x: game.gardens[gi].x, y: game.gardens[gi].y };
  const r = L.move(game, dir);
  anim.facing = [DIRS[dir][0] - DIRS[dir][1], DIRS[dir][0] + DIRS[dir][1]];
  if (r.result === 'blocked') { audio.bump(); bump(dir); return false; }
  everMoved = true;
  game = r.game; audio.step();
  anim.moving = true;
  r.revealed.forEach((id) => onReveal(id));
  r.collected.forEach((id) => onCollect(id));
  if (r.result === 'locked-gate') {
    const need = L.UNLOCK_NEED - L.gardenGot(game, gi);
    toast(`門は閉じている。この庭の雲をあと${need}個見つけよう`);
  } else if (r.result === 'gate') {
    game.gardens[gi].x = prev.x; game.gardens[gi].y = prev.y; // 戻ったとき門の上に立たない
    audio.gate(); sail(r.to, true);
  }
  if (r.collected.length && game.finished && !celebrate) startFinale();
  save(); updateHud();
  return true;
}
const bumpFx = { t: 0, dir: 0 };
function bump(dir) { bumpFx.t = performance.now(); bumpFx.dir = dir; }

function doTurn() {
  if (performance.now() < anim.lockUntil) return;
  if (!L.canTurn(game)) {
    toast(L.onSolid(game) ? '風見鶏のそば（となり）で風を回せる' : '橋の上では風を回せない');
    return;
  }
  const r = L.turn(game);
  if (r.result !== 'turned') return;
  everTurned = true;
  game = r.game; audio.whoosh();
  anim.lockUntil = performance.now() + (reduce ? 120 : 520);
  const gs = game.gardens[game.cur];
  // 雲粒を散らす
  GARDENS[game.cur].bridges.forEach((b) => {
    const was = anim.bridge[`${b.x},${b.y}`] > 0.5; const is = b.winds.includes(gs.wind);
    if (was !== is) { const [sx, sy] = toScreen(b.x + 0.5, b.y + 0.5, 6); sparkle(sx, sy, 8, 'rgba(255,255,255,.95)', 40); }
  });
  r.revealed.forEach((id) => onReveal(id));
  const bloomNow = r.moved.length && game.gardens[game.cur].bloom.some(Boolean);
  if (bloomNow && r.revealed.length) audio.bloom();
  toast(`${WIND_NAMES[gs.wind]}に変わった`, 1200);
  save(); updateHud();
}

function onReveal(id) {
  const gi = Math.floor(id / 3); const c = GARDENS[gi].clouds[id % 3];
  if (gi !== game.cur) return;
  const [sx, sy] = toScreen(c.x + 0.5, c.y + 0.5, 20);
  sparkle(sx, sy, 16, `hsla(${c.hue},100%,80%,1)`, 60);
  audio.found(); toast('どこかで雲が現れた！', 2000);
}
function onCollect(id) {
  const gi = Math.floor(id / 3); const c = GARDENS[gi].clouds[id % 3];
  audio.collect(L.gotCount(game));
  const [sx, sy] = toScreen(game.gardens[game.cur].x + 0.5, game.gardens[game.cur].y + 0.5, 30);
  fx.push({ type: 'orb', t0: performance.now(), x: sx, y: sy, hue: c.hue, id });
  toast(`${c.name}を連れ帰った「${c.say}」 ${L.gotCount(game)}/15`, 2800);
  if (L.gardenGot(game, gi) === L.UNLOCK_NEED && gi < 4) setTimeout(() => toast(`${GARDENS[gi + 1].name}への門が光った`, 2400), 1500);
}
function sparkle(x, y, n, color, speed) {
  const k = reduce ? 0.4 : 1;
  for (let i = 0; i < n * k; i++) { const a = Math.random() * 7; fx.push({ type: 'p', t0: performance.now(), x, y, vx: Math.cos(a) * speed * (0.4 + Math.random()), vy: Math.sin(a) * speed * (0.4 + Math.random()) - 10, life: 0.7 + Math.random() * 0.5, color, r: 2 + Math.random() * 2.5 }); }
}

let fading = false;
function sail(to, viaGate) {
  if (fading) return; fading = true;
  const f = $('fade'); f.classList.add('on');
  setTimeout(() => {
    game = L.enterGarden(game, to);
    if (viaGate) { const info = L.gardenInfo(to); game.gardens[to].x = info.start[0]; game.gardens[to].y = info.start[1]; }
    resetAnim(); view.gi = -1; save(); updateHud();
    toast(`${GARDENS[to].name}`, 1800);
    setTimeout(() => { f.classList.remove('on'); fading = false; }, 120);
  }, reduce ? 60 : 480);
}
function travel(i) { if (i !== game.cur && L.isUnlocked(game, i)) { audio.gate(); sail(i, false); } }

function startFinale() {
  celebrate = performance.now(); audio.finale();
  toast('15個そろった！ 花畑に小さな合奏が響く', 4500);
  setTimeout(() => { openCard(); }, 6500);
}

function pump() {
  const now = performance.now();
  if (held.length && now - lastStep >= STEP_MS && !fading && dex.hidden && cardModal.hidden) { if (doMove(held[held.length - 1])) lastStep = now; else lastStep = now + 80; }
}
// キーボード
const KEYS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3, W: 0, D: 1, S: 2, A: 3 };
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLElement && e.target.closest('[role="dialog"]')) { if (e.key === 'Escape') closeModals(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  audio.unlock();
  if (e.key in KEYS) { e.preventDefault(); const d = KEYS[e.key]; if (!held.includes(d)) { held.push(d); pump(); } return; }
  if (e.key === ' ' || e.key === 'Enter') {
    if (e.target instanceof HTMLButtonElement && e.target !== $('windBtn')) return; // ボタン自体の操作を優先
    e.preventDefault(); if (!e.repeat) doTurn();
  }
  if (e.key === 'm' || e.key === 'M') toggleMute();
});
window.addEventListener('keyup', (e) => { if (e.key in KEYS) { const i = held.indexOf(KEYS[e.key]); if (i >= 0) held.splice(i, 1); } });
window.addEventListener('blur', () => { held.length = 0; });

// 方向パッド（押している間は歩き続ける）
document.querySelectorAll('.d').forEach((b) => {
  const d = Number(b.dataset.dir);
  const on = (e) => { e.preventDefault(); audio.unlock(); b.setPointerCapture?.(e.pointerId); if (!held.includes(d)) { held.push(d); pump(); } b.classList.add('on'); };
  const off = () => { const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); b.classList.remove('on'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
});
$('windBtn').addEventListener('click', () => { audio.unlock(); doTurn(); });
$('windBtn').addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation(); });
$('resetBtn').addEventListener('click', () => {
  audio.unlock();
  const now = performance.now();
  if (now - resetArmed > 3000) { resetArmed = now; toast('もう一度押すと、この庭を最初の状態に戻します（雲は残る）', 3000); return; }
  resetArmed = 0; game = L.resetGarden(game); resetAnim(); save(); updateHud(); toast('庭を最初の状態に戻した');
});
function toggleMute() { audio.setMuted(!audio.state.muted); updateHud(); }
$('muteBtn').addEventListener('click', toggleMute);

// ---------- 図鑑・結果カード ----------
const dex = $('dex'); const cardModal = $('cardModal');
function closeModals() { dex.hidden = true; cardModal.hidden = true; }
function openDex() {
  const body = $('dexBody'); body.textContent = '';
  GARDENS.forEach((g, gi) => {
    const sec = document.createElement('div'); sec.className = 'dex-g';
    const h = document.createElement('h3'); h.innerHTML = `<span>${gi + 1}. ${g.name}</span><span>${L.gardenGot(game, gi)} / 3</span>`; sec.appendChild(h);
    if (!L.isUnlocked(game, gi)) { const d = document.createElement('div'); d.className = 'locked'; d.textContent = `🔒 前の庭で雲を${L.UNLOCK_NEED}個見つけると行ける`; sec.appendChild(d); body.appendChild(sec); return; }
    const row = document.createElement('div'); row.className = 'dex-row';
    g.clouds.forEach((c, k) => {
      const id = L.cloudId(gi, k); const got = game.got[id];
      const s = document.createElement('div'); s.className = `slot${got ? ' got' : ''}`;
      const cn = document.createElement('canvas'); cn.width = 96; cn.height = 96; const cc = cn.getContext('2d');
      if (got) R.drawCloudBody(cc, 48, 52, 26, c.hue, true);
      else { cc.fillStyle = '#c9d4e4'; R.drawCloudBody(cc, 48, 52, 26, 215, false); cc.globalCompositeOperation = 'source-atop'; cc.fillStyle = '#c3cfe0'; cc.fillRect(0, 0, 96, 96); cc.globalCompositeOperation = 'source-over'; cc.fillStyle = '#6b7c96'; cc.font = 'bold 28px sans-serif'; cc.textAlign = 'center'; cc.fillText('？', 48, 62); }
      s.appendChild(cn);
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = got ? c.name : '？？？'; s.appendChild(nm);
      const sub = document.createElement('div'); sub.className = got ? 'say' : 'hint'; sub.textContent = got ? `「${c.say}」` : g.hints[k]; s.appendChild(sub);
      row.appendChild(s);
    });
    sec.appendChild(row); body.appendChild(sec);
  });
  const n = L.gotCount(game); $('dexCount').textContent = `${n}/15`;
  if (n >= 13 && n < 15) { const d = document.createElement('div'); d.className = 'locked'; const miss = GARDENS.map((g, gi) => [g, gi, L.gardenGot(game, gi)]).filter((a) => a[2] < 3).map((a) => `${a[0].name}（あと${3 - a[2]}）`); d.textContent = `あと少し！ まだ見つけていない雲：${miss.join('、')}`; body.prepend(d); }
  dex.hidden = false; $('dexClose').focus();
}
$('dexBtn').addEventListener('click', openDex);
$('dexClose').addEventListener('click', closeModals);
$('cardClose').addEventListener('click', closeModals);
[dex, cardModal].forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closeModals(); }));
$('vol').value = String(Math.round(audio.state.vol * 100));
$('vol').addEventListener('input', (e) => { audio.setVol(Number(e.target.value) / 100); if (audio.state.muted) audio.setMuted(false); updateHud(); });

function makeCard() {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const g = c.getContext('2d');
  R.drawBackground(g, 1200, 630, 'night', 3, true);
  g.fillStyle = 'rgba(10,15,60,.45)'; g.fillRect(0, 0, 1200, 630);
  R.drawSea(g, 1200, 640, 'night', 0, true);
  const n = L.gotCount(game);
  g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = 'bold 64px sans-serif'; g.fillText('風の庭と迷子の雲', 600, 120);
  const cx = 600; const cy = 330;
  for (let i = 0; i < 15; i++) {
    const a = (i / 15) * Math.PI * 2 - Math.PI / 2; const rr = 190; const x = cx + Math.cos(a) * rr * 1.45; const y = cy + Math.sin(a) * rr * 0.62;
    const cl = GARDENS[Math.floor(i / 3)].clouds[i % 3];
    if (game.got[i]) { const gl = g.createRadialGradient(x, y, 4, x, y, 46); gl.addColorStop(0, `hsla(${cl.hue},100%,85%,.8)`); gl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.beginPath(); g.arc(x, y, 46, 0, 7); g.fill(); R.drawCloudBody(g, x, y, 30, cl.hue, true); }
    else { g.globalAlpha = 0.35; R.drawCloudBody(g, x, y, 26, 230, false); g.globalAlpha = 1; }
  }
  R.drawFlower(g, cx, cy + 40, 2.4, n === 15 ? '#fff0a0' : '#aab3ff', '#ffb0e8', 0);
  g.fillStyle = '#fff'; g.font = 'bold 54px sans-serif'; g.fillText(`見つけた雲 ${n}/15`, 600, 520);
  g.font = '30px sans-serif'; g.fillStyle = '#dfe6ff';
  const visited = GARDENS.filter((_, i) => L.isUnlocked(game, i)).length;
  g.fillText(`風を回した回数 ${L.totalTurns(game)}回　訪れた庭 ${visited}/5`, 600, 575);
  return c;
}
function openCard() {
  const c = makeCard();
  try { c.toBlob((b) => { if (!b) return; const u = URL.createObjectURL(b); $('cardImg').src = u; $('cardDl').href = u; }, 'image/png'); } catch { $('cardImg').src = c.toDataURL('image/png'); $('cardDl').href = c.toDataURL('image/png'); }
  dex.hidden = true; cardModal.hidden = false; $('cardClose').focus();
}
$('cardBtn').addEventListener('click', openCard);

// ---------- 描画 ----------
function draw(now) {
  const t = (now - started) / 1000;
  const gi = game.cur; const gs = game.gardens[gi]; const g = GARDENS[gi]; const T = R.THEMES[g.theme];
  if (view.gi !== gi) { fitView(); resetAnim(); }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  R.drawBackground(ctx, W, H, g.theme, t, reduce);
  windMotes(t, gs.wind, T);
  R.drawSea(ctx, W, H + 34, g.theme, t, reduce);

  // 補間
  const dt = Math.min(0.05, (now - (draw.last || now)) / 1000); draw.last = now;
  const sp = 8.5 * dt; const mv = (a, b) => { const d = b - a; return Math.abs(d) <= sp ? b : a + Math.sign(d) * sp; };
  const bx = anim.px; const by = anim.py;
  anim.px = mv(anim.px, gs.x); anim.py = mv(anim.py, gs.y);
  anim.moving = bx !== anim.px || by !== anim.py;
  anim.fluff.forEach((f, i) => { const tg = gs.fluff[i]; if (!tg) return; const s = 4 * dt; f[0] += Math.max(-s, Math.min(s, tg[0] - f[0])); f[1] += Math.max(-s, Math.min(s, tg[1] - f[1])); });
  const wv = R.windVector(gs.wind);
  anim.vane[0] += (wv[0] - anim.vane[0]) * Math.min(1, dt * 6); anim.vane[1] += (wv[1] - anim.vane[1]) * Math.min(1, dt * 6);
  g.bridges.forEach((b) => { const k = `${b.x},${b.y}`; const tg = b.winds.includes(gs.wind) ? 1 : 0; const c = anim.bridge[k] ?? tg; anim.bridge[k] = reduce ? tg : c + Math.max(-dt * 3.2, Math.min(dt * 3.2, tg - c)); });

  ctx.save(); ctx.translate(view.ox, view.oy); ctx.scale(view.scale, view.scale);
  const near = L.canTurn(game); const pv = near ? L.windPreview(game) : null;
  const pond = R.POND[gi];
  const items = [];
  for (let y = 0; y < L.SIZE; y++) for (let x = 0; x < L.SIZE; x++) {
    const c = L.cellAt(gi, x, y); const d = x + y;
    if (pond && x >= pond[0] && x <= pond[2] && y >= pond[1] && y <= pond[3] && !L.isGround(gi, x, y)) items.push({ d: d - 0.5, f: () => R.drawWaterCell(ctx, x, y, t, reduce) });
    if (L.isGround(gi, x, y)) {
      items.push({ d, f: () => R.drawTile(ctx, gi, x, y, T, t, reduce) });
      if (c === 'F') items.push({ d: d + 0.05, f: () => R.drawBed(ctx, gi, x, y, gs.bloom[L.gardenInfo(gi).beds.findIndex((b) => b[0] === x && b[1] === y)], t, reduce) });
      if (c === 'G') items.push({ d: d + 0.05, f: () => R.drawGate(ctx, x, y, L.isUnlocked(game, gi + 1), t) });
    }
    if (c === 'T') { items.push({ d: d - 0.2, f: () => R.drawTile(ctx, gi, x, y, T, t, reduce) }); items.push({ d: d + 0.05, f: () => R.drawObstacle(ctx, gi, x, y, t, reduce) }); }
    if (c === 'V') {
      items.push({ d: d - 0.2, f: () => R.drawTile(ctx, gi, x, y, T, t, reduce) });
      items.push({ d: d + 0.05, f: () => R.drawVane(ctx, x, y, anim.vane, t, near && Math.abs(gs.x - x) + Math.abs(gs.y - y) === 1, reduce) });
    }
  }
  g.bridges.forEach((b) => {
    const v = anim.bridge[`${b.x},${b.y}`] ?? 0; const d = b.x + b.y;
    items.push({ d: d + 0.02, f: () => R.drawCloudTile(ctx, b.x, b.y, v, T, t, reduce) });
    if (pv) {
      if (pv.appear.some((a) => a[0] === b.x && a[1] === b.y)) items.push({ d: d + 0.5, f: () => R.drawDashed(ctx, b.x, b.y, 'rgba(60,140,255,1)', t) });
      if (pv.vanish.some((a) => a[0] === b.x && a[1] === b.y)) items.push({ d: d + 0.5, f: () => R.drawDashed(ctx, b.x, b.y, 'rgba(255,160,20,1)', t) });
    }
  });
  (g.bells || []).forEach((b) => items.push({ d: b.x + b.y + 0.04, f: () => R.drawBell(ctx, b.x, b.y, t, gs.wind === 2, reduce) }));
  if (g.pedestal) items.push({ d: g.pedestal.x + g.pedestal.y + 0.05, f: () => R.drawPedestal(ctx, g.pedestal.x, g.pedestal.y, gs.hist, t) });
  if (g.centerFlower) { const st = game.got[14] ? 2 : L.gotCount(game) >= L.FINAL_NEED ? 1 : 0; items.push({ d: g.centerFlower.x + g.centerFlower.y + 0.03, f: () => R.drawCenterFlower(ctx, g.centerFlower.x, g.centerFlower.y, st, t, reduce) }); }
  if (gi === 4 && game.finished) for (let i = 0; i < 14; i++) { const x = (i * 5) % 9; const y = (i * 7) % 9; if (L.isGround(gi, x, y) && L.cellAt(gi, x, y) === '#' && !(x === gs.x && y === gs.y)) items.push({ d: x + y + 0.02, f: () => { const [cx, cy] = R.proj(x + 0.5, y + 0.5); R.drawFlower(ctx, cx + 8, cy + 3, 0.7, ['#fff0a0', '#9ff0ff', '#ffb0f0'][i % 3], '#fff', 0); } }); }
  anim.fluff.forEach((f) => items.push({ d: f[0] + f[1] + 0.3, f: () => { const [cx, cy] = R.proj(f[0] + 0.5, f[1] + 0.5); R.drawFluff(ctx, cx, cy, t, reduce); } }));
  g.clouds.forEach((c, k) => {
    const id = L.cloudId(gi, k);
    if (game.revealed[id] && !game.got[id]) items.push({ d: c.x + c.y + 0.35, f: () => { const [cx, cy] = R.proj(c.x + 0.5, c.y + 0.5); R.drawCloudMob(ctx, cx, cy, c.hue, t, reduce, k + gi); } });
  });
  // 主人公（弾かれたときの小さな揺れ）
  let bumpOff = [0, 0]; const bt = (now - bumpFx.t) / 1000;
  if (bt < 0.25 && !reduce) { const a = Math.sin(bt / 0.25 * Math.PI) * 5; bumpOff = [-(DIRS[bumpFx.dir][0] - DIRS[bumpFx.dir][1]) * a * 0.5, -(DIRS[bumpFx.dir][0] + DIRS[bumpFx.dir][1]) * a * 0.25]; }
  items.push({ d: anim.px + anim.py + 0.4, f: () => { const [cx, cy] = R.proj(anim.px + 0.5, anim.py + 0.5); R.drawPlayer(ctx, cx + bumpOff[0], cy + bumpOff[1], t, anim.moving, anim.facing, reduce); } });
  items.sort((a, b) => a.d - b.d);
  items.forEach((it) => it.f());
  if (near) { // 風見鶏が使えるときの足元の輪
    const x = Math.round(anim.px); const y = Math.round(anim.py); R.drawRing(ctx, x, y, t);
  }
  ctx.restore();
  drawFx(now, t);
  // 歩き続ける
  pump();
  requestAnimationFrame(draw);
}

const motes = Array.from({ length: 34 }, (_, i) => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random(), r: Math.random() }));
function windMotes(t, wind, T) {
  const [vx, vy] = R.windVector(wind); const n = reduce ? 8 : motes.length;
  ctx.fillStyle = T.leaf;
  for (let i = 0; i < n; i++) {
    const m = motes[i]; const k = reduce ? 0 : t * 0.045 * m.s;
    const x = (((m.x + vx * k) % 1) + 1) % 1 * W; const y = (((m.y + vy * k * 0.6) % 1) + 1) % 1 * H * 0.9;
    ctx.globalAlpha = 0.65; ctx.beginPath(); ctx.ellipse(x, y, 3 + m.r * 2, 1.6 + m.r, Math.atan2(vy, vx), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawFx(now, t) {
  const tgt = $('total').getBoundingClientRect(); const cr = cv.getBoundingClientRect();
  const tx = tgt.left + tgt.width / 2 - cr.left; const ty = tgt.top + tgt.height / 2 - cr.top;
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; const age = (now - f.t0) / 1000;
    if (f.type === 'p') {
      if (age > f.life) { fx.splice(i, 1); continue; }
      const x = f.x + f.vx * age; const y = f.y + f.vy * age + 30 * age * age;
      ctx.globalAlpha = 1 - age / f.life; ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(x, y, f.r, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    } else if (f.type === 'orb') {
      const dur = reduce ? 0.5 : 1.3;
      if (age > dur) { fx.splice(i, 1); sparkle(tx, ty, 10, `hsla(${f.hue},100%,80%,1)`, 40); continue; }
      let x; let y; const p = age / dur;
      if (p < 0.45 && !reduce) { const a = (p / 0.45) * Math.PI * 2 - 1.2; x = f.x + Math.cos(a) * 34; y = f.y + Math.sin(a) * 18 - 10; }
      else { const q = reduce ? p : (p - 0.45) / 0.55; const sx = reduce ? f.x : f.x + Math.cos(Math.PI * 2 - 1.2) * 34; const sy = reduce ? f.y : f.y + Math.sin(Math.PI * 2 - 1.2) * 18 - 10; const e = q * q * (3 - 2 * q); x = sx + (tx - sx) * e; y = sy + (ty - sy) * e - Math.sin(e * Math.PI) * 30; }
      R.drawCloudBody(ctx, x, y, 11, f.hue, true);
    }
  }
  if (celebrate && now - celebrate < 7000 && game.cur === 4) {
    const gs = game.gardens[4]; const [cx, cy] = toScreen(gs.x + 0.5, gs.y + 0.5, 40); const k = (now - celebrate) / 1000;
    for (let i = 0; i < 15; i++) { const cl = GARDENS[Math.floor(i / 3)].clouds[i % 3]; const a = k * 0.9 + (i / 15) * Math.PI * 2; const rr = 70 + Math.min(1, k / 2) * 60; ctx.globalAlpha = Math.min(1, k) ; R.drawCloudBody(ctx, cx + Math.cos(a) * rr * 1.5, cy + Math.sin(a) * rr * 0.6 - 20, 10, cl.hue, true); }
    ctx.globalAlpha = 1;
  }
}

// ---------- 起動 ----------
new ResizeObserver(resize).observe(cv);
resize();
if (new URLSearchParams(location.search).get('og') === '1') { everMoved = true; }
resetAnim(); updateHud();
if (!OG && L.gotCount(game) === 0 && game.gardens[0].turns === 0) toast('迷子の雲を15個、見つけよう', 3500);
document.addEventListener('visibilitychange', () => { held.length = 0; });
requestAnimationFrame(draw);
