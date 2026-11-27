// 雲海温泉と渡り鳥の宿 — 画面と操作。ルールは logic.js。
import {
  DAYS, SPECIES, SPECIES_LIST, FACILITIES, TUNE, DIRS, DIR_NAMES, DIR_LIST, PIPE_COST, SEASONS, STORIES, ORNAMENTS,
  createState, cloneState, tick, applyEdit, checkEdit, preview, metrics, evaluate, baths, isBath, itemAt, itemById,
  inside, isEntrance, heatUsed, summary, explain, windAt, labelOf, mainNeed, dayIndex, dayOf, buildable, newUnlocks,
  initialInn, innOf, emptyDex, dexApply, ornamentCount, storyCount, usersOf, shieldOf,
} from './logic.js';
import { layout, toScreen, toCell, draw, stepSteam, stepWindFlow, loadImages, birdIcon, drawOrnament } from './render.js';
import { sfx, unlock, setMuted } from './audio.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'cloudspring-bird-inn-v2';
const params = new URLSearchParams(location.search);

// ---- 保存（できなくても遊べる） ----
function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; } }
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* 保存できなくても続ける */ } }
let save = loadSave();
save.next ||= 1; save.inns ||= {}; save.cleared ||= []; save.best ||= {}; save.stars ||= {}; save.opt ||= {};
save.dex ||= emptyDex();
if (save.ornament === undefined) save.ornament = null;

// ---- 状態 ----
let s = null; // 今の日
let mode = 'campaign'; // 'campaign'（本編の続き）| 'replay'（日選択でやり直し）
let startInn = null; // その日の開始時の宿（やり直し用）
let startJSON = ''; // 開店前の状態（変わっていなければ「やり直す」は押せない）
let running = false; let paused = false; let speed = 1; let acc = 0;
let prevPos = new Map(); let frac = 1;
const ui = { sel: 0, selGuest: 0, cursor: null, mode: null, ghost: null, ghostM: null, highlights: null, positions: new Map(), time: 0, parts: [], flow: {}, calm: !!save.opt.calm, hits: [], flying: new Map(), moods: new Map(), ornament: save.ornament };
let pending = null; // 確認待ちの設備操作
let panelMsg = '';
let guide = null; // 手引きの段階
let freeze = false; // 手引き中は時計を止める
let hintStep = 0;
let warnedWind = false;
let lastStep = 0;
setMuted(!!save.opt.mute);

const canvas = $('board');
const ctx = canvas.getContext('2d');
let L = null;

const SEC = 1.4; // 1倍速で、ゲームの1秒を何秒で見せるか（考える時間を残す）
let lastAutoPause = -99; // 困った客が出たら一時停止（考える時間を作る）
const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];
const stars = (sm) => (!sm.cleared ? 0 : sm.good === sm.n ? 3 : sm.rate >= 0.8 ? 2 : 1);
const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

// ---- タイトル ----
function renderTitle() {
  const nd = dayOf(Math.min(save.next, 28));
  const box = $('titleMain'); box.innerHTML = '';
  const addBtn = (html, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.innerHTML = html; b.addEventListener('click', () => { unlock(); fn(); }); box.appendChild(b); return b; };
  if (save.cur && save.cur.state) {
    const cd = dayOf(save.cur.state.day);
    addBtn(`<b>▶ 営業の途中から</b><small>第${cd.id}日「${cd.name}」${save.cur.state.t}秒</small>`, 'big-btn primary', resumeSaved);
  }
  const done = save.next > 28;
  addBtn(done ? '<b>▶ 第28日をもう一度</b><small>すべての日を達成済み</small>' : save.next === 1 ? '<b>▶ はじめる</b><small>第1日「二つの湯」</small>' : `<b>▶ つづきから</b><small>第${nd.id}日「${nd.name}」・${SEASONS[nd.season].name}</small>`, save.cur ? 'big-btn ghost' : 'big-btn primary', () => startDay(done ? 28 : save.next));
  const row = document.createElement('div'); row.className = 'title-row';
  const b1 = document.createElement('button'); b1.type = 'button'; b1.className = 'ghost'; b1.innerHTML = `📖 図鑑 <b>${storyCount(save.dex)}</b>/36`; b1.addEventListener('click', openDex);
  const b2 = document.createElement('button'); b2.type = 'button'; b2.className = 'ghost'; b2.textContent = '📅 日をえらぶ'; b2.addEventListener('click', () => { $('dayGrid').hidden = !$('dayGrid').hidden; });
  row.append(b1, b2); box.appendChild(row);
  // 日の一覧（季節ごと）
  const grid = $('dayGrid'); grid.innerHTML = '';
  for (const se of SEASON_ORDER) {
    const sec = document.createElement('div'); sec.className = `season-row ${se}`;
    sec.innerHTML = `<span class="se">${SEASONS[se].name}</span>`;
    for (const d of DAYS.filter((x) => x.season === se)) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'day-tile';
      const open = d.id <= save.next;
      b.disabled = !open;
      const st = save.stars[d.id] || 0;
      b.innerHTML = `<b>${d.id}</b><small>${open ? (st ? starText(st) : d.id === save.next ? 'つぎ' : '') : '🔒'}</small>`;
      b.title = `第${d.id}日「${d.name}」`;
      b.addEventListener('click', () => { unlock(); startDay(d.id); });
      sec.appendChild(b);
    }
    grid.appendChild(sec);
  }
}

function showTitle() {
  running = false; $('game').hidden = true; $('title').hidden = false; renderTitle();
}

// ---- 日の開始 ----
function innFor(id) { return id === 1 ? initialInn() : save.inns[id] || null; }

function startDay(id, { resumeState = null } = {}) {
  const inn = innFor(id);
  if (!inn && !resumeState) { toast('この日はまだ遊べない'); return; }
  mode = id >= save.next ? 'campaign' : 'replay';
  startInn = inn ? JSON.parse(JSON.stringify(inn)) : null;
  s = resumeState || createState(id, { inn: startInn });
  startJSON = resumeState ? '' : JSON.stringify(s);
  $('title').hidden = true; $('game').hidden = false; window.scrollTo(0, 0);
  running = true; paused = !!resumeState; acc = 0; speed = 1; frac = 1;
  ui.sel = 0; ui.selGuest = 0; ui.mode = null; ui.ghost = null; ui.highlights = null; ui.point = null; ui.parts = []; ui.flow = {}; ui.flying.clear(); ui.moods.clear();
  pending = null; panelMsg = ''; hintStep = 0; warnedWind = s.t >= TUNE.windShiftAt - TUNE.windWarn; freeze = false; guide = null;
  hideGuide(); $('banner').hidden = true; $('toast').hidden = true;
  snapshotPos();
  resize();
  const d = dayOf(id);
  if (resumeState) {
    showGuide(`第${id}日の営業の途中から。▶再開で続きが始まる。`, [['OK', hideGuide]]);
  } else if (id === 1 && !save.cleared.includes(1)) {
    // 初日：開いたらすぐ営業。最初の客が来たところで時計を止めて、弁の操作を案内する
    guide = 'intro';
    showGuide(`${d.intro}。お客さんは、好きな温度の湯を選んで入る。`, [['はじめる', () => { stepOnce(); guide = 'swan'; freeze = true; updateGuide(); }], ['説明を飛ばす', skipGuide]]);
  } else if (id === 4 && !save.cleared.includes(4)) {
    guide = 'w1'; updateGuide();
  } else {
    const nu = newUnlocks(id);
    const extra = [];
    if (nu.length) extra.push(`新しく建てられる：${nu.map((t) => FACILITIES[t].name).join('・')}`);
    const prev = dayOf(id - 1);
    if (prev && (prev.size[0] !== d.size[0] || prev.size[1] !== d.size[1])) extra.push(`島が${d.size[0]}×${d.size[1]}に広がった`);
    if (prev && prev.cap !== d.cap) extra.push(`源泉のお湯が${d.cap}つ分に増えた`);
    guide = 'prep';
    showGuide(`第${id}日「${d.name}」：${d.intro}。${extra.length ? `${extra.join('。')}。` : ''}朝は湯が抜いてある。弁を開けて湯を張り、準備ができたら「開店する」。`, [['わかった', () => { hideGuide(); guide = null; refreshAll(); }]]);
  }
  refreshAll();
}

function resumeSaved() {
  const cur = save.cur;
  if (!cur?.state) return;
  save.cur = null; writeSave();
  startDay(cur.state.day, { resumeState: cur.state });
  if (cur.startInn) startInn = cur.startInn;
  mode = cur.mode || mode;
}

function skipGuide() {
  hideGuide(); guide = null; freeze = false; ui.point = null; ui.highlights = null;
  if (s.phase === 'prep' && s.day === 1) { s.phase = 'open'; }
  refreshAll();
}

// ---- 手引き ----
function showGuide(text, btns = []) {
  $('guide').hidden = false; $('guideText').textContent = text;
  const bb = $('guideBtns'); bb.innerHTML = '';
  for (const [label, fn] of btns) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', () => { unlock(); fn(); }); bb.appendChild(b); }
}
function hideGuide() { $('guide').hidden = true; }

function leftBath() { return s.items.find((i) => i.name === '左の湯') || baths(s)[0]; }
// 第4日の手引きで、風よけを置くマス（冷えている湯の風上の隣）
function windTarget() {
  const m = metrics(s); const w = windAt(s); const [dx, dy] = DIRS[w];
  for (const b of baths(s)) {
    if (!m[b.id].exposed) continue;
    const x = b.x + dx; const y = b.y + dy;
    if (inside(s, x, y) && checkEdit(s, { op: 'build', type: 'windbreak', x, y, dir: w }, { building: true }).ok) return { b, x, y };
  }
  return null;
}
function updateGuide() {
  if (!guide) return;
  if (guide === 'swan') {
    const lb = leftBath();
    ui.highlights = new Map([[`${lb.x},${lb.y}`, 'rgba(111,168,58,.45)']]); ui.point = [lb.x, lb.y];
    showGuide('白鳥は熱い湯が好き（40〜50度）。でも今は2つとも30度で「ぬるい…」と入れない。光っている左の湯をタップしよう。', [['説明を飛ばす', skipGuide]]);
    if (ui.sel === lb.id) guide = 'valve';
  }
  if (guide === 'valve') {
    ui.highlights = null; ui.point = null;
    showGuide('＋を押すと弁が開き、湯が5度ずつ熱くなる。40度まで上げよう（源泉のお湯は全部で6つ分）。', [['説明を飛ばす', skipGuide]]);
    const m = metrics(s);
    if (baths(s).some((b) => m[b.id].on && m[b.id].T >= 40)) {
      guide = 'go'; freeze = false;
      showGuide('いいね！ 白鳥が熱い湯へ向かう。営業中も弁はいつでも動かせる。カワセミは景色が大好き。', [['OK', () => { hideGuide(); guide = null; }]]);
      setTimeout(() => { if (guide === 'go') { hideGuide(); guide = null; } }, 6000);
    }
  }
  // ---- 第4日：風の手引き（風が吹く→湯が冷える→風よけで戻る） ----
  if (guide === 'w1') {
    const m = metrics(s);
    const cold = baths(s).filter((b) => m[b.id].exposed);
    ui.highlights = new Map(cold.map((b) => [`${b.x},${b.y}`, 'rgba(79,147,176,.45)']));
    showGuide(`強い北風（青い筋）。北側が開いた湯は${TUNE.windChill}度冷える（札「風で−${TUNE.windChill}°」）。`, [['どうすればいい？', () => { guide = 'w2'; updateGuide(); }], ['説明を飛ばす', () => { guide = null; ui.highlights = null; ui.point = null; hideGuide(); refreshAll(); }]]);
  }
  if (guide === 'w2') {
    if (s.items.some((it) => it.type === 'windbreak' && baths(s).some((b) => shieldOf(s, b, windAt(s))?.id === it.id))) { guide = 'w3'; updateGuide(); return; }
    const tg = windTarget();
    const skip = ['説明を飛ばす', () => { guide = null; ui.highlights = null; ui.point = null; hideGuide(); refreshAll(); }];
    if (!tg) {
      // 冷えている湯の北どなりが空いていない（島の端・ほかの設備）→ 湯を動かしてもらう
      const m = metrics(s);
      const cold = baths(s).filter((b) => m[b.id].exposed);
      ui.highlights = new Map(cold.map((b) => [`${b.x},${b.y}`, 'rgba(79,147,176,.45)'])); ui.point = cold[0] ? [cold[0].x, cold[0].y] : null;
      showGuide(`風よけは、湯の風上（北）どなりの空きマスに置く。光っている湯は北どなりが空いていない（島の端か、ほかの設備）。湯をタップして「移動」し、北どなりが空く場所へ動かそう。`, [skip]);
      return;
    }
    ui.highlights = new Map([[`${tg.x},${tg.y}`, 'rgba(111,168,58,.55)']]); ui.point = [tg.x, tg.y];
    showGuide(`風上（北）の隣に「風よけ」を置くと、風が止まって湯が戻る。光るマスをタップして、風よけを建てよう（${FACILITIES.windbreak.cost}）。`, [skip]);
  }
  if (guide === 'w3') {
    ui.highlights = null; ui.point = null;
    const m = metrics(s);
    const left = baths(s).filter((b) => m[b.id].exposed).length;
    banner('風が止まった！ +5度');
    showGuide(`風が止まり、湯は冷えなくなった（札「風よけ○」）。${left ? 'もう1つの湯も守ろう。' : ''}次は弁を開けて40度にし、開店しよう。`, [['OK', () => { hideGuide(); ui.highlights = null; refreshAll(); }]]);
    guide = 'w4wait';
  }
  if (guide === 'w4') {
    const m = metrics(s, TUNE.windShiftAt);
    const cold = baths(s).filter((b) => m[b.id].exposed);
    ui.highlights = new Map(cold.map((b) => [`${b.x},${b.y}`, 'rgba(79,147,176,.45)']));
    showGuide(`あと${TUNE.windShiftAt - s.t}秒で東風！ 光る湯が冷える。一時停止中なので、湯の東どなりに風よけを置ける。`, [['▶ 再開する', () => { guide = null; ui.highlights = null; hideGuide(); paused = false; cancelMode(); refreshAll(); }]]);
  }
}

// ---- 時間を進める ----
function snapshotPos() { prevPos = new Map(s.guests.map((x) => [x.id, { x: x.x, y: x.y }])); }

function stepOnce() {
  snapshotPos();
  const before = s.phase;
  const ev = tick(s);
  frac = 0;
  for (const e of ev) handleEvent(e);
  autoPause();
  if (before !== 'done' && s.phase === 'done') { save.cur = null; writeSave(); setTimeout(showResult, 900); }
  if (guide === 'w4wait' && s.t === TUNE.windShiftAt - TUNE.windWarn) { guide = 'w4'; paused = true; updateGuide(); }
  refreshAll();
}

function autoPause() {
  if (save.opt.autoPause === false) return;
  if (guide || s.phase !== 'open' || s.t - lastAutoPause < 12) return;
  const x = s.guests.find((o) => o.st === 'wait' && o.why && !o.paused && o.waited >= 2);
  if (!x) return;
  x.paused = true; lastAutoPause = s.t; paused = true; pauseSave();
  toast(`${SPECIES[x.sp].name}が待っている：${x.why}。止めておいたので、手を打ってから ▶再開`);
}

function handleEvent(e) {
  const x = e.g ? s.guests.find((o) => o.id === e.g) : null;
  if (e.type === 'arrive') sfx.chirp();
  if (e.type === 'enter') sfx.plop();
  if (e.type === 'done') {
    const b = itemById(s, x.bathOf) || null;
    if (!e.tea) ui.flying.set(x.id, { x: b ? b.x : 0, y: b ? b.y : 0, k: 0 });
    if (e.sat >= TUNE.passLine) { sfx.happy(); toast(`${SPECIES[x.sp].name} 満足 ${e.sat}点！ +${e.pay}`); }
    else { sfx.sad(); toast(`${SPECIES[x.sp].name} ${e.sat}点…（${shortWhy(x)}）`); }
  }
  if (e.type === 'teaDone') { ui.flying.set(x.id, { x: x.x, y: x.y, k: 0 }); toast(`${SPECIES[x.sp].name}が茶店でひと休み +${e.pay}`); }
  if (e.type === 'leave') { sfx.sad(); toast(`${SPECIES[x.sp].name}が帰った：${e.why}`); }
  if (e.type === 'wind') {
    sfx.wind(); banner(`風が変わった：${DIR_NAMES[e.dir]}風`);
    const m = metrics(s); const cold = baths(s).filter((b) => m[b.id].exposed && m[b.id].on);
    if (s.strong && cold.length) setTimeout(() => toast(`風で冷えた：${cold.map((b) => `${labelOf(b)} ${m[b.id].T}度（−${TUNE.windChill}）`).join('、')}`), 1900);
  }
}

function shortWhy(x) {
  const n = x.bathT || 1;
  const parts = [];
  if (x.acc[0] / n < 0.75) parts.push('お湯');
  if (x.acc[1] / n < 0.75) parts.push('声');
  if (x.acc[2] / n < 0.5) parts.push('景色');
  if (x.waited > 8) parts.push('待ち');
  return parts.length ? `${parts.join('・')}が不満` : 'あと少し';
}

let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600); }
let bannerT = 0;
function banner(t) { const el = $('banner'); el.textContent = t; el.hidden = false; clearTimeout(bannerT); bannerT = setTimeout(() => { el.hidden = true; }, 1800); }

// ---- 描画ループ ----
function frame(now) {
  const dt = Math.min(0.1, (now - (lastStep || now)) / 1000); lastStep = now;
  ui.time += dt;
  if (running && s && !$('game').hidden) {
    const live = s.phase === 'open' && !paused && !freeze && !document.hidden && !$('result').open && !$('menu').open;
    if (live) {
      acc += dt * speed / SEC;
      if (acc >= 1) { acc -= 1; stepOnce(); }
      frac = Math.min(1, acc);
    } else frac = 1;
    ui.positions.clear();
    for (const x of s.guests) {
      const p = prevPos.get(x.id) || x;
      const k = ['walk', 'bath', 'walk2', 'tea', 'wait'].includes(x.st) ? Math.min(1, frac * 1.4) : 1;
      ui.positions.set(x.id, { x: p.x + (x.x - p.x) * k, y: p.y + (x.y - p.y) * k });
    }
    for (const [id, f] of ui.flying) { f.k += dt * 0.8; if (f.k > 1) ui.flying.delete(id); }
    const m = metrics(s);
    stepSteam(ui.parts, L, s, m, dt, ui.calm);
    stepWindFlow(ui.flow, s, dt, ui.calm);
    ui.moods.clear();
    for (const x of s.guests) {
      if (x.st !== 'bath') continue;
      const b = itemById(s, x.target);
      const v = evaluate(s, x, b, m).total - Math.min(TUNE.waitPenaltyMax, x.waited * TUNE.waitPenalty);
      ui.moods.set(x.id, v >= TUNE.passLine ? 'good' : v >= 55 ? 'mid' : 'bad');
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, L, s, ui);
    updateClock();
  }
  requestAnimationFrame(frame);
}

let dpr = 1;
function resize() {
  if (!s) return;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || canvas.parentElement.clientWidth || 360;
  const og = document.body.classList.contains('og');
  const ratio = og ? window.innerHeight / window.innerWidth : w < 600 ? 0.92 : 0.66;
  const h = Math.round(w * ratio);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.height = `${h}px`;
  L = layout({ width: w, height: h }, s);
  if (og) { L.ox += w * 0.1; L.oy += h * 0.04; }
}
window.addEventListener('resize', () => { resize(); });

// ---- 入力 ----
canvas.addEventListener('pointerdown', (ev) => {
  unlock();
  if (!s) return;
  const r = canvas.getBoundingClientRect();
  const px = ev.clientX - r.left; const py = ev.clientY - r.top;
  let hit = null; let best = 1e9;
  for (const h of ui.hits) { const d = Math.hypot(h.x - px, h.y - py); if (d < h.r + 6 && d < best) { best = d; hit = h; } }
  if (hit && !ui.mode) { selectGuest(hit.g); return; }
  let [cx, cy] = toCell(L, px, py + L.TH * 0.35);
  if (!(inside(s, cx, cy) && itemAt(s, cx, cy))) [cx, cy] = toCell(L, px, py);
  if (ui.mode) { const [mx, my] = toCell(L, px, py); tapCell(mx, my); return; }
  tapCell(cx, cy);
});

canvas.addEventListener('keydown', (ev) => {
  if (!s) return;
  const mv = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[ev.key];
  if (mv) {
    ev.preventDefault();
    const c = ui.cursor || [0, 0];
    ui.cursor = [Math.max(0, Math.min(s.W - 1, c[0] + mv[0])), Math.max(0, Math.min(s.H - 1, c[1] + mv[1]))];
  } else if (ev.key === 'Enter') {
    ev.preventDefault(); const c = ui.cursor || [0, 0]; ui.cursor = c; tapCell(c[0], c[1]);
  } else if (ev.key === ' ') { ev.preventDefault(); onPlay(); }
});

const canBuild = () => s.phase === 'prep' || (s.phase === 'open' && paused);

function tapCell(x, y) {
  if (!inside(s, x, y)) { clearSel(); return; }
  if (ui.mode) { modeTap(x, y); return; }
  const it = itemAt(s, x, y);
  ui.selGuest = 0; pending = null; panelMsg = '';
  if (it) {
    ui.sel = it.id; ui.cursor = [x, y]; sfx.paper();
    if (isBath(it) && !guide) {
      // 隣（声が届く範囲）と、湯気が流れる風下のマスを見せる
      ui.highlights = new Map();
      for (const [dx, dy] of Object.values(DIRS)) if (inside(s, x + dx, y + dy)) ui.highlights.set(`${x + dx},${y + dy}`, 'rgba(240,170,90,.28)');
      if (it.q >= 3) { const [wx, wy] = DIRS[windAt(s)]; if (inside(s, x - wx, y - wy)) ui.highlights.set(`${x - wx},${y - wy}`, 'rgba(255,255,255,.75)'); }
    } else if (!guide) ui.highlights = null;
  }
  else { ui.sel = 0; ui.cursor = [x, y]; if (!guide) ui.highlights = null; }
  setTimeout(() => { const v = $('panel'); const r = v?.getBoundingClientRect(); if (r && r.top > window.innerHeight - 120) window.scrollBy({ top: Math.min(r.top - window.innerHeight + 170, r.bottom - window.innerHeight + 16) }); }, 0);
  updateGuide();
  refreshAll();
}

function clearSel() { ui.sel = 0; ui.selGuest = 0; ui.cursor = null; ui.mode = null; ui.ghost = null; pending = null; ui.highlights = null; refreshAll(); }

function selectGuest(id) { ui.selGuest = id; ui.sel = 0; ui.mode = null; pending = null; refreshAll(); }

// 移動・建設の「置き場所を選ぶ」モード
function enterMode(md) {
  ui.mode = md; pending = null; ui.ghost = null; panelMsg = '';
  const r = canvas.getBoundingClientRect(); if (r.top < 0 || r.bottom > window.innerHeight) canvas.scrollIntoView({ block: 'start' });
  ui.highlights = new Map();
  for (let y = 0; y < s.H; y++) {
    for (let x = 0; x < s.W; x++) {
      const e = modeEdit(x, y);
      if (e && checkEdit(s, e, { building: canBuild() }).ok) ui.highlights.set(`${x},${y}`, 'rgba(195,217,106,.55)');
    }
  }
  refreshAll();
}
function modeEdit(x, y) {
  const m = ui.mode; if (!m) return null;
  if (m.op === 'move') return { op: 'move', id: m.id, x, y };
  if (m.op === 'build') return { op: 'build', type: m.type, x, y, dir: windAt(s) };
  return null;
}
function modeTap(x, y) {
  const e = modeEdit(x, y);
  const pv = preview(s, e, { building: canBuild() });
  if (!pv.ok) { panelMsg = pv.reason; sfx.error(); refreshAll(); return; }
  pending = e;
  const it = pv.state.items.find((i) => (e.op === 'move' ? i.id === e.id : i.x === x && i.y === y));
  ui.ghost = { ...it }; ui.ghostM = pv.metrics; ui.ghostPipes = pv.pipes;
  panelMsg = '';
  refreshAll();
}
function confirmPending() {
  const r = applyEdit(s, pending, { building: canBuild() });
  if (!r.ok) { panelMsg = r.reason; sfx.error(); }
  else { sfx.paper(); const it = pending.op === 'move' ? itemById(s, pending.id) : itemAt(s, pending.x, pending.y); ui.sel = it?.id || 0; ui.cursor = it ? [it.x, it.y] : null; }
  pending = null; ui.mode = null; ui.ghost = null; ui.highlights = null;
  updateGuide();
  refreshAll();
}
function cancelMode() { ui.mode = null; pending = null; ui.ghost = null; ui.highlights = null; panelMsg = ''; if (s) refreshAll(); }

function doEdit(e) {
  const before = e.op === 'valve' ? itemById(s, e.id)?.q ?? 0 : 0;
  const r = applyEdit(s, e, { building: canBuild() });
  if (!r.ok) { panelMsg = r.reason; sfx.error(); }
  else {
    panelMsg = '';
    if (e.op === 'valve') sfx.valve(e.q > before); else sfx.paper();
  }
  updateGuide();
  refreshAll();
}

// ---- ボタン ----
function onPlay() {
  unlock();
  if (!s) return;
  if (s.phase === 'done') { showResult(); return; }
  if (guide === 'intro') return;
  if (s.phase === 'prep') {
    if (guide === 'prep' || guide === 'w1' || guide === 'w2') { hideGuide(); guide = guide === 'prep' ? null : 'w4wait'; ui.highlights = null; ui.point = null; }
    if (guide === 'w3') { guide = 'w4wait'; hideGuide(); }
    if (heatUsed(s) === 0 && s.day !== 1) {
      sfx.error(); toast('湯が張られていない。浴槽をタップして＋で弁を開けよう');
      ui.highlights = new Map(baths(s).map((b) => [`${b.x},${b.y}`, 'rgba(111,168,58,.45)'])); setTimeout(() => { ui.highlights = null; }, 2500);
      refreshAll(); return;
    }
    s.phase = 'open'; paused = false; cancelMode(); stepOnce(); return;
  }
  paused = !paused;
  if (!paused) { cancelMode(); if (guide === 'w4') { guide = null; ui.highlights = null; hideGuide(); } }
  else pauseSave();
  refreshAll();
}
function pauseSave() {
  if (!s || s.phase !== 'open') return;
  save.cur = { state: cloneState(s), mode, startInn }; writeSave();
}
$('btnPlay').addEventListener('click', onPlay);
$('btnSpeed').addEventListener('click', () => { speed = speed === 1 ? 2 : 1; refreshAll(); });
$('btnReset').addEventListener('click', () => {
  if (!s) return;
  $('menu').close();
  if (s.phase !== 'prep' && !confirm('この日を、開店前の状態（設備・お金）からやり直しますか？')) return;
  save.cur = null; writeSave();
  startDay(s.day);
});
$('btnHint').addEventListener('click', () => {
  if (s?.phase === 'open' && !paused) { paused = true; pauseSave(); refreshAll(); } // ヒントを読む間は止める
  const hs = hintsFor(s);
  showGuide(hs[hintStep % hs.length], [['OK', hideGuide], ...(hs.length > 1 ? [['次のヒント', () => { hintStep += 1; $('btnHint').click(); }]] : [])]);
});
$('btnMenu').addEventListener('click', () => { if (s?.phase === 'open' && !paused) { paused = true; pauseSave(); } $('optMute').checked = !!save.opt.mute; $('optCalm').checked = !!save.opt.calm; $('optAuto').checked = save.opt.autoPause !== false; $('menu').showModal(); refreshAll(); });
$('btnCloseMenu').addEventListener('click', () => $('menu').close());
$('btnToTitle').addEventListener('click', () => { $('menu').close(); pauseSave(); showTitle(); });
$('optMute').addEventListener('change', (e) => { save.opt.mute = e.target.checked; setMuted(save.opt.mute); writeSave(); });
$('optAuto').addEventListener('change', (e) => { save.opt.autoPause = e.target.checked; writeSave(); });
$('optCalm').addEventListener('change', (e) => { save.opt.calm = e.target.checked; ui.calm = save.opt.calm; writeSave(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && s?.phase === 'open' && running) { paused = true; pauseSave(); refreshAll(); } });

// その日のヒント（今の盤面から作る）
function hintsFor(st) {
  const out = [];
  const m = metrics(st);
  const kinds = [...new Set(st.guests.map((x) => x.sp))];
  out.push(`今日の客：${kinds.map((sp) => `${SPECIES[sp].name}（${needText(sp)}）`).join('、')}。`);
  if (st.strong) {
    const cold = baths(st).filter((b) => m[b.id].exposed);
    out.push(`強風の日。${DIR_NAMES[windAt(st)]}風が当たる湯は${TUNE.windChill}度冷える${cold.length ? `（いま：${cold.map(labelOf).join('、')}）` : ''}。浴槽の${DIR_NAMES[windAt(st)]}どなりに${DIR_NAMES[windAt(st)]}向きの風よけを置くと防げる。島の端で風上が外の湯は守れない。`);
    if (st.wind0 !== st.wind1) out.push(`${TUNE.windShiftAt}秒で${DIR_NAMES[st.wind1]}風に変わる。風よけの場所・向きと、弁を見直そう（一時停止中なら建て直せる）。`);
  }
  if (kinds.some((sp) => SPECIES[sp].noisy) && kinds.some((sp) => mainNeed(sp) === 'quiet')) out.push('にぎやかな鳥（ツバメ・インコ）は、同じ湯と隣の湯をうるさくする。静けさ好き（サギ・フクロウ・ヤマガラ）の湯は離すか、吸音垣を隣に。');
  if (kinds.some((sp) => mainNeed(sp) === 'view')) out.push('景色好き（カワセミ・ツル）は、島の外まで見通せる湯を選ぶ。風よけや建物は視線をさえぎる。弁3以上の湯の湯気は、風下の湯の景色を隠す。');
  if (st.base <= 20) out.push('寒い季節は熱い湯にお湯を使う。保温の湯（+5度）なら少ない弁で熱くできる。お湯は全部で' + st.cap + 'つ分。空いた湯の弁を閉めて、次の客の湯へ回そう。');
  out.push(`客がまとめて来ると席が足りなくなる。浴槽を増やそう${buildable(st.day).includes('chair') ? '。休憩椅子があれば長く待ってくれる' : ''}。`);
  return out;
}

// ---- 画面の更新 ----
function refreshAll() {
  if (!s) return;
  const d = dayOf(s.day);
  $('dayName').innerHTML = `第${s.day}日「${d.name}」<small>${SEASONS[d.season].name}・基温${s.base}度${mode === 'replay' ? '・やり直し' : ''}</small>`;
  $('money').textContent = s.money;
  const used = heatUsed(s);
  $('heat').textContent = `${used}/${s.cap}`;
  $('heatPips').innerHTML = Array.from({ length: s.cap }, (_, i) => `<i class="${i < used ? 'on' : ''}"></i>`).join('');
  const sm = summary(s);
  $('good').textContent = sm.good; $('need').textContent = sm.need;
  // 風
  const w0 = windAt(s); const w1 = s.wind1;
  const soon = s.t < TUNE.windShiftAt && s.wind0 !== s.wind1;
  const warn = soon && s.t >= TUNE.windShiftAt - TUNE.windWarn && s.phase === 'open';
  const anyone = s.guests.some((x) => x.st !== 'gone');
  if (warn && !warnedWind && anyone) { warnedWind = true; if (guide !== 'w4') toast(s.strong ? `あと${TUNE.windShiftAt - s.t}秒で${DIR_NAMES[w1]}風に変わる！ 風よけと弁を見直そう` : `あと${TUNE.windShiftAt - s.t}秒で${DIR_NAMES[w1]}風に。湯気の流れる向きが変わる`); }
  $('wind').className = `wind${warn ? ' warn' : ''}${s.strong ? ' strongday' : ''}`;
  $('wind').innerHTML = `<span class="arrow" style="transform:rotate(${windAngle(w0)}deg)">➜</span><br>${DIR_NAMES[w0]}風${s.strong ? `<span class="strong">・強（当たると−${TUNE.windChill}度）</span>` : ''}${soon ? `<br><small>${TUNE.windShiftAt}秒〜${DIR_NAMES[w1]}風</small>` : ''}`;
  // 次の客
  const nx = s.guests.filter((x) => x.st === 'pending').slice(0, 2);
  const nb = $('next'); nb.innerHTML = '<span class="lbl">次の客</span>';
  for (const x of nx) {
    const el = document.createElement('div'); el.className = 'g';
    el.appendChild(birdIcon(x.sp));
    el.insertAdjacentHTML('beforeend', `<span>${SPECIES[x.sp].name}</span><span>${x.at - s.t > 0 ? `${x.at - s.t}秒後` : 'まもなく'}</span>`);
    nb.appendChild(el);
  }
  if (!nx.length) nb.insertAdjacentHTML('beforeend', '<div class="g">もう来ない</div>');
  const tm = $('timemarks');
  if (tm.dataset.day !== String(s.day)) {
    tm.dataset.day = String(s.day);
    tm.innerHTML = s.guests.map((x) => `<i style="left:${(x.at / TUNE.dayLimit) * 100}%"></i>`).join('') + (s.wind0 !== s.wind1 ? `<i class="wmark" style="left:${(TUNE.windShiftAt / TUNE.dayLimit) * 100}%" title="風が変わる"></i>` : '');
  }
  const bp = $('btnPlay');
  bp.textContent = s.phase === 'prep' ? '▶ 開店する' : s.phase === 'done' ? '結果を見る' : paused ? '▶ 再開' : '⏸ 一時停止';
  bp.classList.toggle('pulse', s.phase === 'prep' && !guide);
  $('btnSpeed').textContent = `×${speed}`;
  bp.disabled = guide === 'intro' || guide === 'w1' || guide === 'w2';
  $('btnReset').disabled = s.phase === 'prep' && JSON.stringify(s) === startJSON;
  renderPanel();
  renderGuests();
  updateClock();
}

function windAngle(dir) {
  const [wx, wy] = DIRS[dir]; const vx = -wx; const vy = -wy;
  const sx = vx - vy; const sy = (vx + vy) / 2;
  return Math.atan2(sy, sx) * 180 / Math.PI;
}

function updateClock() {
  if (!s) return;
  $('timefill').style.width = `${Math.min(100, ((s.t - 1 + frac) / TUNE.dayLimit) * 100)}%`;
}

function needText(sp) {
  const S = SPECIES[sp];
  const n = mainNeed(sp);
  return `${S.range[0]}〜${S.range[1]}度・${n === 'temp' ? '温度' : n === 'quiet' ? '静けさ' : '景色'}重視${S.noisy ? '・にぎやか' : ''}`;
}

function renderGuests() {
  const box = $('guests');
  box.innerHTML = `<h4>今日のお客さん（${s.guests.length}羽・${Math.ceil(s.guests.length * TUNE.clearRate)}羽以上を満足70点以上で送り出す）</h4>`;
  const ul = document.createElement('ul'); ul.className = 'glist';
  for (const x of s.guests) {
    const li = document.createElement('li');
    li.className = x.st === 'gone' || x.st === 'walk2' || x.st === 'tea' ? 'gone' : x.st === 'pending' ? '' : 'now';
    li.appendChild(birdIcon(x.sp));
    const done = x.st === 'gone' || x.st === 'walk2' || x.st === 'tea';
    const st = done ? `<span class="sc ${(x.sat ?? 0) >= TUNE.passLine ? 'ok' : 'ng'}">${x.sat ?? 0}点</span>`
      : x.st === 'bath' ? '<span class="sc">入浴中</span>' : x.st === 'pending' ? `<span class="need">${x.at}秒</span>` : `<span class="sc">${x.st === 'walk' ? '移動' : '待ち'}</span>`;
    li.insertAdjacentHTML('beforeend', `<span><b>${SPECIES[x.sp].name}</b> <span class="need">${needText(x.sp)}</span></span>${st}`);
    li.addEventListener('click', () => { if (x.st !== 'pending' && x.st !== 'gone') selectGuest(x.id); });
    ul.appendChild(li);
  }
  box.appendChild(ul);
}

function factorHTML(label, val, text) {
  const cls = val >= 1 ? '' : val > 0 ? 'mid' : 'bad';
  return `<div class="factor ${cls}">${label}<b>${val >= 1 ? '○' : val > 0 ? '△' : '×'}</b>${text}</div>`;
}
function windNote(it, mm) {
  const w = windAt(s);
  if (!s.strong) return '';
  if (mm.exposed) {
    if (mm.edge) return `<p class="why wind-note">💨 ${DIR_NAMES[w]}からの強風で−${TUNE.windChill}度。この湯は島の${DIR_NAMES[w]}端で、風上が島の外なので風よけを置けない。内側へ動かすか、弁を上げて補おう。</p>`;
    return `<p class="why wind-note">💨 ${DIR_NAMES[w]}からの強風で−${TUNE.windChill}度。浴槽の${DIR_NAMES[w]}どなりに、${DIR_NAMES[w]}向きの風よけを置くと戻る。</p>`;
  }
  const next = s.t < TUNE.windShiftAt && s.wind0 !== s.wind1 ? s.wind1 : null;
  if (next) {
    const sh = shieldOf(s, it, next);
    const [dx, dy] = DIRS[next];
    const edge = !inside(s, it.x + dx, it.y + dy);
    if (!sh) return `<p class="muted">🌀 ${TUNE.windShiftAt}秒からの${DIR_NAMES[next]}風では${edge ? '島の端なので守れず' : '守られず'}、${TUNE.windChill}度冷える。</p>`;
  }
  return '<p class="muted">🛡 風よけで守られている。</p>';
}

function renderPanel() {
  const p = $('panel');
  const err = `<p class="err">${panelMsg || ''}</p>`;
  if (ui.selGuest) {
    const x = s.guests.find((o) => o.id === ui.selGuest);
    const b = x.st === 'bath' ? itemById(s, x.target) : null;
    p.innerHTML = `<h3>${SPECIES[x.sp].name} <span class="tag">${needText(x.sp)}</span></h3><p class="why">${explain(s, x)}</p>${b ? `<p class="muted">いまの見込み：${Math.round(evaluate(s, x, b, metrics(s)).total - Math.min(TUNE.waitPenaltyMax, x.waited * TUNE.waitPenalty))}点（待ち${x.waited}秒）</p>` : ''}`;
    return;
  }
  if (ui.mode) {
    const what = ui.mode.op === 'move' ? `${labelOf(itemById(s, ui.mode.id))}の移動先` : `${FACILITIES[ui.mode.type].name}を置く場所`;
    let body = `<h3>${what}を選ぶ</h3><p class="muted">緑のマスに置ける。置く前に、温度・景色・風の変化を見られる。</p>`;
    if (pending) {
      const it = ui.ghost;
      if (isBath(it)) {
        const mm = ui.ghostM[it.id];
        body += `<div class="factors">${factorHTML('温度', mm.on ? 1 : 0, mm.on ? `${mm.T}度${mm.exposed ? '（風で−5）' : ''}` : '湯なし')}${factorHTML('風', mm.exposed ? 0 : 1, !s.strong ? '弱い風' : mm.exposed ? 'さらされる' : '守られている')}${factorHTML('景色', mm.view, mm.view >= 1 ? '見える' : mm.steamBy ? '湯気' : mm.view > 0 ? '少し' : 'ふさがれる')}</div>`;
        if (ui.ghostPipes?.length) body += `<p class="muted">源泉までの管を${ui.ghostPipes.length}本引く（${ui.ghostPipes.length * PIPE_COST}）</p>`;
      } else if (it.type === 'windbreak') {
        const [dx, dy] = DIRS[it.dir]; const t = pv2(it.x - dx, it.y - dy);
        body += `<p class="why">${DIR_NAMES[it.dir]}向き：${t ? `すぐ後ろの「${t}」を${DIR_NAMES[it.dir]}風から守る` : '後ろに浴槽がないので、今の向きでは何も守らない（置いた後に回せる）'}</p>`;
      }
      const cost = ui.mode.op === 'build' ? FACILITIES[ui.mode.type].cost + (ui.ghostPipes?.length || 0) * PIPE_COST : (ui.ghostPipes?.length || 0) * PIPE_COST;
      body += `<div class="btnrow"><button type="button" id="pOk" class="on">ここに決める${cost ? `（${cost}）` : ''}</button><button type="button" id="pNo">やめる</button></div>`;
    } else body += '<div class="btnrow"><button type="button" id="pNo">やめる</button></div>';
    p.innerHTML = body + err;
    $('pOk')?.addEventListener('click', confirmPending);
    $('pNo')?.addEventListener('click', cancelMode);
    return;
  }
  const it = itemById(s, ui.sel);
  const sb = canBuild();
  // 移動・撤去は、できるとき（準備中・一時停止中）だけ出す
  const moveRow = (refund) => (sb ? `<div class="btnrow"><button type="button" id="bMove">移動</button><button type="button" id="bDel">撤去（+${refund}）</button></div>` : '');
  const bindMove = () => {
    $('bMove')?.addEventListener('click', () => enterMode({ op: 'move', id: it.id }));
    $('bDel')?.addEventListener('click', () => { doEdit({ op: 'remove', id: it.id }); ui.sel = 0; refreshAll(); });
  };
  if (it && isBath(it)) {
    const m = metrics(s); const mm = m[it.id];
    const F = FACILITIES[it.type];
    const users = usersOf(s, it);
    const nextG = s.guests.filter((x) => x.st === 'pending' || x.st === 'wait').slice(0, 2);
    const lo = 10; const hi = 55; const pos = (T) => `${Math.max(0, Math.min(100, ((T - lo) / (hi - lo)) * 100))}%`;
    const bands = [...users.map((x) => [x, '#6fa83a']), ...nextG.map((x) => [x, '#e08a9a'])].map(([x, col]) => {
      const [a, b] = SPECIES[x.sp].range; return `<span class="band" title="${SPECIES[x.sp].name}" style="left:${pos(a)};width:calc(${pos(b)} - ${pos(a)});border-color:${col}"></span>`;
    }).join('');
    const quiet = Math.max(0, mm.noise - (mm.fenced ? 1 : 0));
    const canUp = checkEdit(s, { op: 'valve', id: it.id, q: it.q + 1 }).ok;
    const canDown = it.q > 0;
    // いちばん見るもの（温度・＋−・好みのバー）を大きく、ほかは小さな1行にまとめる
    const chip = (icon, val, text) => `<span class="chip ${val >= 1 ? '' : val > 0 ? 'mid' : 'bad'}">${icon}${text}</span>`;
    const why = [];
    if (s.strong && mm.exposed) why.push(windNote(it, mm));
    else if (s.strong) { const wn = windNote(it, mm); if (!wn.includes('🛡')) why.push(wn); }
    if (mm.view === 0 && !mm.steamBy) why.push('<p class="why">🏔 まわりが建物でふさがれて景色が見えない。</p>');
    if (!mm.supplied) why.push('<p class="why">管が源泉につながっていない。</p>');
    p.innerHTML = `<h3>${labelOf(it)} <span class="tag">${F.name}・${users.length}/${F.seats}席</span></h3>
      <div class="valve"><button type="button" id="vDown" aria-label="弁を閉める" ${canDown ? '' : 'disabled'}>−</button>
      <div class="temp"><b>${mm.on ? `${mm.T}度` : '湯なし'}</b>${mm.exposed ? `<small class="chill">風で−${TUNE.windChill}度</small>` : ''}</div>
      <button type="button" id="vUp" aria-label="弁を開ける" ${canUp ? '' : 'disabled'}>＋</button></div>
      <div class="meter" title="緑の枠＝入っている客の好み、桃の枠＝次に来る客の好み">${bands}${mm.on ? `<span class="cur" style="left:${pos(mm.T)}"></span>` : ''}<div class="ticks">${[15, 25, 35, 45].map((t) => `<span style="left:${pos(t)}">${t}</span>`).join('')}</div></div>
      ${s.day <= 2 ? '<p class="legend"><i class="lg g"></i>入浴中の客の好み　<i class="lg p"></i>次の客の好み</p>' : ''}
      <div class="chips">${chip('♨', mm.on ? 1 : 0, mm.on ? `${mm.T}度` : '湯なし')}${chip('🔇', quiet === 0 ? 1 : quiet === 1 ? 0.5 : 0, quiet ? `にぎやか${quiet}` : '静か')}${chip('🏔', mm.view, mm.view >= 1 ? '景色○' : mm.steamBy ? '湯気で×' : mm.view > 0 ? '景色△' : '景色×')}${mm.stage ? '<span class="chip">🥁お祭り</span>' : ''}</div>
      ${why.join('')}${moveRow(Math.floor(F.cost / 2))}${err}`;
    $('vUp').addEventListener('click', () => doEdit({ op: 'valve', id: it.id, q: it.q + 1 }));
    $('vDown').addEventListener('click', () => doEdit({ op: 'valve', id: it.id, q: it.q - 1 }));
    bindMove();
    return;
  }
  if (it && it.type === 'windbreak') {
    const prot = (d) => { const [dx, dy] = DIRS[d]; const t = itemAt(s, it.x - dx, it.y - dy); return t && isBath(t) ? labelOf(t) : 'なし'; };
    p.innerHTML = `<h3>風よけ <span class="tag">いま ${DIR_NAMES[it.dir]}向き</span></h3>
      <p class="muted">向けた方角から来る強風を止め、すぐ後ろ（風下）の浴槽を守る。視線もさえぎる。営業中もいつでも回せる。</p>
      <div class="btnrow">${DIR_LIST.map((d) => `<button type="button" data-dir="${d}" class="${it.dir === d ? 'on' : ''}">${DIR_NAMES[d]}向き<br><small>守る：${prot(d)}</small></button>`).join('')}</div>
      ${moveRow(Math.floor(FACILITIES.windbreak.cost / 2))}${err}`;
    p.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('click', () => doEdit({ op: 'rotate', id: it.id, dir: b.dataset.dir })));
    bindMove();
    return;
  }
  if (it && it.type === 'source') {
    p.innerHTML = `<h3>源泉 <span class="tag">お湯 ${heatUsed(s)}/${s.cap}</span></h3><p class="muted">ここから床下の管を通って、管の上か隣の浴槽にお湯が届く。弁の合計は${s.cap}まで。どこかを開けたいときは、ほかを閉める。浴槽を建てると、管は自動で引かれる。</p>`;
    return;
  }
  if (it) {
    const F = FACILITIES[it.type];
    const extra = it.type === 'teahouse' ? `湯上がりの客が、道のり${TUNE.teaRange}マス以内なら寄って+${TUNE.teaFee}（${F.seats}席・${TUNE.teaTicks}秒）。隣の湯はにぎやか1。`
      : it.type === 'chair' ? `湯が空かずに待つ客が座ると、${TUNE.chairBonus}秒長く待ってくれる（${F.seats}席）。`
        : it.type === 'sign' ? '隣の湯までの道のりを、客が2マス短く感じる（選ばれやすくなる）。'
          : it.type === 'flower' ? '建物で景色がふさがれた隣の湯を、景色△（半分）にする。湯気には効かない。'
            : it.type === 'stage' ? '隣の湯のツバメ・インコが+10点。ほかの客にはにぎやか1。'
              : it.type === 'tower' ? '隣の展望湯の景色を+0.25する。'
                : it.type === 'fence' ? '隣の浴槽に届く鳥の声を1つ減らす。視線もさえぎる。'
                  : it.type === 'ornament' ? `集めた屋根飾りを飾る台（性能なし）。図鑑で飾りを選べる。${save.ornament ? '' : 'まだ飾りがない。'}` : F.desc;
    p.innerHTML = `<h3>${F.name}</h3><p class="muted">${extra}</p>${moveRow(Math.floor(F.cost / 2))}${err}`;
    bindMove();
    return;
  }
  if (ui.cursor && !it) {
    const [x, y] = ui.cursor;
    if (isEntrance(x, y)) { p.innerHTML = '<h3>入口</h3><p class="muted">渡り鳥はここに降りて、好きな湯を選んで歩いていく。</p>'; return; }
    if (!canBuild()) {
      p.innerHTML = '<h3>空きマス</h3><p class="muted">建てる・管を引くのは、準備中か一時停止中だけ。</p><div class="btnrow"><button type="button" id="bPause">⏸ 一時停止する</button></div>';
      $('bPause').addEventListener('click', () => { paused = true; pauseSave(); refreshAll(); });
      return;
    }
    const hasPipe = s.pipes[y][x];
    const list = buildable(s.day);
    const fresh = newUnlocks(s.day);
    p.innerHTML = `<h3>空きマスに建てる <span class="tag">💰${s.money}</span></h3><div class="build-list">${list.map((t) => {
      const F = FACILITIES[t]; const c = checkEdit(s, { op: 'build', type: t, x, y, dir: windAt(s) }, { building: true });
      const total = c.ok ? -c.money : F.cost;
      return `<button type="button" data-t="${t}" ${c.ok ? '' : 'disabled'} class="${guide === 'w2' && t === 'windbreak' ? 'pulse' : ''}"><b>${F.name}${fresh.includes(t) ? ' <span class="new">新</span>' : ''}</b><small>${total}・${F.desc}</small></button>`;
    }).join('')}<button type="button" id="bPipe"><b>${hasPipe ? '床下の管を外す' : '床下の管'}</b><small>${hasPipe ? '無料' : `${PIPE_COST}・源泉と浴槽をつなぐ`}</small></button></div>${err}`;
    p.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => {
      const t = b.dataset.t; const e = { op: 'build', type: t, x, y, dir: windAt(s) };
      const pv = preview(s, e, { building: true });
      if (!pv.ok) { panelMsg = pv.reason; refreshAll(); return; }
      ui.mode = { op: 'build', type: t }; pending = e; ui.ghost = pv.state.items.find((i) => i.x === x && i.y === y); ui.ghostM = pv.metrics; ui.ghostPipes = pv.pipes;
      // 風よけは、建てる前の確認を省いてすぐ置く（向きは今の風）。手引き中の迷いを減らす
      if (t === 'windbreak' || t === 'chair' || t === 'flower' || t === 'sign') { confirmPending(); return; }
      refreshAll();
    }));
    $('bPipe').addEventListener('click', () => doEdit({ op: hasPipe ? 'unpipe' : 'pipe', x, y }));
    return;
  }
  const tip = s.phase === 'prep' ? '準備中：設備をタップして様子を見る。空いたマスをタップすると建てられる。準備ができたら「開店する」。'
    : s.phase === 'done' ? 'この日は閉店。' : paused ? '一時停止中：設備の移動・建設ができる。' : '浴槽をタップして弁を調整。鳥をタップすると、満足・不満の理由が分かる。';
  p.innerHTML = `<h3>${s.phase === 'prep' ? '準備中' : s.phase === 'done' ? '閉店' : paused ? '一時停止中' : '営業中'}</h3><p class="muted">${tip}</p>${err}`;
}

function pv2(x, y) { const t = itemAt(s, x, y); return t && isBath(t) ? labelOf(t) : null; }

// ---- 結果 ----
function showResult() {
  if (!s || s.phase !== 'done' || $('result').open) return;
  const sm = summary(s);
  const st = stars(sm);
  let news = []; let ornBefore = ornamentCount(save.dex);
  if (sm.cleared) {
    if (!save.cleared.includes(s.day)) save.cleared.push(s.day);
    save.stars[s.day] = Math.max(save.stars[s.day] || 0, st);
    const r = dexApply(save.dex, s); save.dex = r.dex; news = r.news;
    if (mode === 'campaign' && s.day === save.next) { save.next = s.day + 1; if (s.day < 28) save.inns[s.day + 1] = innOf(s); }
    if (!save.ornament && ornamentCount(save.dex) > 0) { save.ornament = ORNAMENTS[0].id; ui.ornament = save.ornament; }
  }
  save.best[s.day] = Math.max(save.best[s.day] || 0, sm.good);
  save.cur = null;
  writeSave();
  $('resTitle').textContent = sm.cleared ? (sm.good === sm.n ? '全員大満足！' : '日クリア！') : 'あと少し…';
  $('resTitle').className = sm.cleared ? 'ok' : 'ng';
  $('resLead').innerHTML = `${sm.n}羽中 ${sm.good}羽が満足（必要 ${sm.need}羽）${sm.cleared ? `<br><span class="stars">${starText(st)}</span> <small class="nowrap">★1:6割 ★2:8割 ★3:全員</small>` : ''}`;
  const ul = $('resList'); ul.innerHTML = '';
  for (const x of s.guests) {
    const li = document.createElement('li'); li.appendChild(birdIcon(x.sp));
    const reason = x.left ? (x.left === 'wait' ? `入れずに帰った：${x.why || '待ちくたびれた'}` : '閉店に間に合わなかった') : resultWhy(x);
    li.insertAdjacentHTML('beforeend', `<span><b>${SPECIES[x.sp].name}</b><br><span class="r">${reason}</span></span><b style="color:${(x.sat ?? 0) >= TUNE.passLine ? '#6fa83a' : '#e0675d'}">${x.sat ?? 0}点</b>`);
    ul.appendChild(li);
  }
  const nb = $('resNews'); nb.innerHTML = '';
  if (news.length) {
    nb.innerHTML = `<h4>📖 図鑑に小話が増えた</h4>${news.map((n) => `<p><b>${SPECIES[n.sp].name}・第${'一二三'[n.k]}話</b>「${STORIES[n.sp][n.k]}」</p>`).join('')}`;
    const oc = ornamentCount(save.dex);
    if (oc > ornBefore) nb.insertAdjacentHTML('beforeend', `<p class="orn-new">🎐 屋根飾り「${ORNAMENTS.slice(ornBefore, oc).map((o) => o.name).join('・')}」が手に入った（図鑑で付け替え）</p>`);
  }
  $('resMoney').textContent = `売上 +${sm.earned}${sm.tea ? `（茶店 +${sm.tea}）` : ''}　維持費 −${sm.upkeep}　所持金 ${s.money}`;
  if (!sm.cleared) $('resMoney').insertAdjacentHTML('beforeend', '<br>「もう一度」で、この日の開店前（設備・お金）から同じ客で挑戦できる。');
  else if (sm.good < sm.n) $('resMoney').insertAdjacentHTML('beforeend', '<br>全員満足（★3）を目指すなら：不満の理由（お湯・声・景色）を見て、風よけや配置を見直そう。');
  if (mode === 'replay' && sm.cleared) $('resMoney').insertAdjacentHTML('beforeend', '<br>（やり直しの日：図鑑は増えるが、本編の宿とお金は変わらない）');
  const bb = $('resBtns'); bb.innerHTML = '';
  const add = (label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; b.addEventListener('click', () => { $('result').close(); fn(); }); bb.appendChild(b); };
  add('タイトルへ', 'ghost', showTitle);
  add('📷 記念写真', 'ghost', () => openPhoto(sm, st));
  add('もう一度', sm.cleared ? 'ghost' : 'primary', () => startDay(s.day));
  if (sm.cleared && s.day < 28) add(`次へ：第${s.day + 1}日`, 'primary', () => startDay(Math.min(save.next, s.day + 1)));
  if (sm.cleared && s.day === 28) add('🎉 エンディング', 'primary', openEnding);
  $('toast').hidden = true; $('banner').hidden = true;
  bb.querySelectorAll('button').forEach((b) => { b.disabled = true; setTimeout(() => { b.disabled = false; }, 800); });
  $('result').showModal();
}

function resultWhy(x) {
  const n = x.bathT || 1;
  const t = x.acc[0] / n; const q = x.acc[1] / n; const v = x.acc[2] / n;
  const mk = (k) => (k >= 0.95 ? '○' : k > 0.3 ? '△' : '×');
  return `お湯${mk(t)} 声${mk(q)} 景色${mk(v)}${x.waited > 4 ? `・待ち${x.waited}秒` : ''}（${needText(x.sp).split('・')[1]}）`;
}

// ---- 記念写真（実際の宿の盤面に、日・満足を重ねる） ----
function photoCanvas(lines) {
  const W = 1200; const H = 630;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fbf3e2'; g.fillRect(0, 0, W, H);
  const sc = Math.min(W / canvas.width, (H - 20) / canvas.height);
  const dw = canvas.width * sc; const dh = canvas.height * sc;
  g.drawImage(canvas, (W - dw) / 2, (H - dh) / 2, dw, dh);
  const happy = s ? s.guests.filter((x) => (x.sat ?? 0) >= TUNE.passLine) : [];
  if (happy.length) {
    g.fillStyle = 'rgba(255,250,240,.88)'; g.beginPath(); g.roundRect(24, H - 112, Math.min(W - 48, 30 + happy.length * 76), 92, 20); g.fill();
    happy.forEach((x, i) => g.drawImage(birdIcon(x.sp, 72), 36 + i * 76, H - 106, 72, 72));
  }
  g.fillStyle = 'rgba(255,250,240,.92)'; g.beginPath(); g.roundRect(24, 24, 560, 40 + lines.length * 36, 20); g.fill();
  g.fillStyle = '#6b3d47'; g.font = '800 36px system-ui, sans-serif'; g.fillText('雲海温泉と渡り鳥の宿', 46, 72);
  g.font = '700 24px system-ui, sans-serif'; g.fillStyle = '#8a6d70';
  lines.forEach((t, i) => g.fillText(t, 46, 112 + i * 34));
  return c;
}
function openPhoto(sm, st) {
  const d = dayOf(s.day);
  const c = photoCanvas([`第${s.day}日「${d.name}」 ${starText(st)}`, `${sm.n}羽中 ${sm.good}羽が満足・図鑑 ${storyCount(save.dex)}/36`]);
  $('photoLead').textContent = '';
  showPhoto(c, `cloudspring-day${s.day}.png`);
}
function showPhoto(c, name, title = '記念写真') {
  $('photoTitle').textContent = title;
  const url = c.toDataURL('image/png');
  $('photoImg').src = url;
  const a = $('photoSave'); a.href = url; a.download = name;
  $('photo').showModal();
}
$('photoClose').addEventListener('click', () => $('photo').close());

// ---- エンディング（第28日の達成） ----
function openEnding() {
  const all = SPECIES_LIST.filter((sp) => save.dex[sp]?.s?.[1]);
  const full = all.length === SPECIES_LIST.length;
  const c = document.createElement('canvas'); c.width = 1200; c.height = 630;
  const g = c.getContext('2d');
  const bg = document.querySelector('.title-art');
  if (bg?.complete && bg.naturalWidth) { const k = Math.max(1200 / bg.naturalWidth, 630 / bg.naturalHeight); g.drawImage(bg, (1200 - bg.naturalWidth * k) / 2, (630 - bg.naturalHeight * k) / 2, bg.naturalWidth * k, bg.naturalHeight * k); }
  else { g.fillStyle = '#bfe6e2'; g.fillRect(0, 0, 1200, 630); }
  g.fillStyle = 'rgba(255,250,240,.86)'; g.beginPath(); g.roundRect(40, 380, 1120, 220, 26); g.fill();
  const show = full ? SPECIES_LIST : (all.length ? all : ['swan', 'kingfisher']);
  SPECIES_LIST.forEach((sp, i) => {
    if (show.includes(sp)) g.drawImage(birdIcon(sp, 84), 60 + i * 92, 400, 84, 84);
    else { g.fillStyle = 'rgba(160,130,120,.25)'; g.beginPath(); g.arc(102 + i * 92, 445, 30, 0, Math.PI * 2); g.fill(); g.fillStyle = '#a08a84'; g.font = '800 30px system-ui'; g.textAlign = 'center'; g.fillText('？', 102 + i * 92, 456); g.textAlign = 'left'; }
  });
  g.fillStyle = '#6b3d47'; g.font = '800 40px system-ui, sans-serif';
  g.fillText(full ? '12種の渡り鳥が、そろって雲海へ' : `${show.length}種の渡り鳥が、雲海へ`, 70, 540);
  g.font = '700 24px system-ui, sans-serif'; g.fillStyle = '#8a6d70';
  g.fillText(`28日間の営業、おつかれさま。図鑑 ${storyCount(save.dex)}/36・★${Object.values(save.stars).reduce((a, b) => a + b, 0)}/84`, 70, 580);
  save.ended = true; writeSave();
  $('photoLead').textContent = full ? '全種の第二話を読んだので、全員集合の記念写真！' : '12種すべての第二話を読むと、全員集合の写真になる（日をえらんで再挑戦できる）。';
  showPhoto(c, 'cloudspring-ending.png', '🎉 28日達成！ 渡り鳥の大行進');
  setTimeout(() => { $('photoLead').textContent = ''; }, 60000);
}

// ---- 図鑑 ----
function openDex() {
  const box = $('dexList'); box.innerHTML = '';
  for (const sp of SPECIES_LIST) {
    const e = save.dex[sp] || { n: 0, s: [false, false, false] };
    const met = e.n > 0;
    const card = document.createElement('div'); card.className = `dex-card${met ? '' : ' unknown'}`;
    const ic = birdIcon(sp, 48); if (!met) ic.classList.add('shadow');
    card.appendChild(ic);
    const conds = ['満足70点以上で1羽', '満足70点以上で累計3羽', '同じ日に2羽を90点以上'];
    card.insertAdjacentHTML('beforeend', `<div><b>${met ? SPECIES[sp].name : '？？？'}</b> <small>${met ? `${needText(sp)}・満足 ${e.n}羽` : `第${SPECIES[sp].day}日ごろに来る`}</small>
      <ol>${e.s.map((ok, k) => `<li class="${ok ? 'ok' : ''}">${ok ? STORIES[sp][k] : `（${conds[k]}でひらく）`}</li>`).join('')}</ol></div>`);
    box.appendChild(card);
  }
  const oc = ornamentCount(save.dex);
  const ob = $('ornList'); ob.innerHTML = '';
  ORNAMENTS.forEach((o, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = `orn${save.ornament === o.id ? ' on' : ''}`; b.disabled = i >= oc;
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
    if (i < oc) drawOrnament(g, o.id, 32, 34, 18); else { g.fillStyle = '#d8ccc0'; g.font = '28px system-ui'; g.textAlign = 'center'; g.fillText('🔒', 32, 44); }
    b.appendChild(c); b.insertAdjacentHTML('beforeend', `<small>${i < oc ? o.name : `第二話${i + 1}種`}</small>`);
    b.addEventListener('click', () => { save.ornament = save.ornament === o.id ? null : o.id; ui.ornament = save.ornament; writeSave(); openDex(); });
    ob.appendChild(b);
  });
  $('dexCount').textContent = `小話 ${storyCount(save.dex)}/36・屋根飾り ${oc}/10`;
  if (!$('dex').open) $('dex').showModal();
}
$('dexClose').addEventListener('click', () => { $('dex').close(); if (!$('title').hidden) renderTitle(); });

// ---- 起動 ----
loadImages({ bg: 'art/bg-cloudsea.webp' }).then(() => {});
requestAnimationFrame(frame);
renderTitle();
if (params.get('day')) { const id = Number(params.get('day')); if (dayIndex(id) >= 0 && (id === 1 || save.inns[id])) startDay(id); }
if (params.get('og')) {
  // 共有画像用：冬の日を、配置を直した後の営業中の場面で見せる
  document.body.classList.add('og');
  import('./solutions.js').then(({ SOLUTIONS }) => {
    let inn;
    for (const d of DAYS) {
      if (d.id === 26) break;
      const st = createState(d.id, { inn });
      for (const [t, e] of SOLUTIONS[d.id] || []) if (t < 0) applyEdit(st, e, { building: true });
      while (st.phase !== 'done') { for (const [t, e] of SOLUTIONS[d.id] || []) if (t === st.t) applyEdit(st, e); tick(st); }
      inn = innOf(st);
    }
    save.inns[26] = inn;
    startDay(26); skipGuide(); hideGuide();
    for (const [t, e] of SOLUTIONS[26] || []) if (t < 0) applyEdit(s, e, { building: true });
    s.phase = 'open';
    for (let i = 0; i < 9; i++) { for (const [t, e] of SOLUTIONS[26] || []) if (t === s.t) applyEdit(s, e); tick(s); }
    paused = true; snapshotPos(); resize(); refreshAll();
    const t = document.createElement('div'); t.className = 'og-title';
    t.innerHTML = '<b>雲海温泉と<br>渡り鳥の宿</b><span>お湯を分け、風を読み、渡り鳥をもてなそう</span>';
    document.body.appendChild(t);
    const k = document.createElement('img'); k.className = 'og-koko'; k.src = 'art/char-koko-welcome.webp'; document.body.appendChild(k);
  });
}
// テスト・確認用（画面の状態を外から見られるように）
window.__inn = {
  get state() { return s; }, get save() { return save; }, startDay, stepOnce, skipGuide, openDex, openEnding, showResult,
  setPaused: (v) => { paused = v; refreshAll(); },
  // 確認用：本編をある日まで進めた状態にする（保存した達成手順で）
  async jumpTo(day) {
    const { SOLUTIONS } = await import('./solutions.js');
    let inn;
    for (const d of DAYS) {
      if (d.id === day) break;
      const st = createState(d.id, { inn });
      for (const [t, e] of SOLUTIONS[d.id] || []) if (t < 0) applyEdit(st, e, { building: true });
      while (st.phase !== 'done') { for (const [t, e] of SOLUTIONS[d.id] || []) if (t === st.t) applyEdit(st, e); tick(st); }
      const r = dexApply(save.dex, st); save.dex = r.dex;
      if (!save.cleared.includes(d.id)) save.cleared.push(d.id);
      save.stars[d.id] = stars(summary(st));
      inn = innOf(st); save.inns[d.id + 1] = inn;
    }
    save.next = day; writeSave();
  },
  cellPoint: (x, y) => { const [px, py] = toScreen(L, x, y); const r = canvas.getBoundingClientRect(); return [r.left + px, r.top + py - L.TH * 0.2]; },
};
