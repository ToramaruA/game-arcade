// 雲海温泉と渡り鳥の宿 — 画面と操作。ルールは logic.js。
import {
  DAYS, SPECIES, FACILITIES, TUNE, DIRS, DIR_NAMES, DIR_LIST, PIPE_COST, SEASONS,
  createState, cloneState, tick, applyEdit, checkEdit, preview, metrics, evaluate, baths, isBath, itemAt,
  inside, isEntrance, heatUsed, summary, explain, windAt, labelOf, satOf, mainNeed, dayIndex,
} from './logic.js';
import { layout, toScreen, toCell, draw, stepSteam, loadImages, birdIcon } from './render.js';
import { sfx, unlock, setMuted } from './audio.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'cloudspring-bird-inn-v1';
const params = new URLSearchParams(location.search);

// ---- 保存（できなくても遊べる） ----
function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; } }
function writeSave(v) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(v)); } catch { /* 保存できなくても続ける */ } }
let save = loadSave();
save.cleared ||= []; save.best ||= {}; save.opt ||= {};

// ---- 状態 ----
let s = null; // 今の日
let startSnap = null; // その日の開始状態（やり直し用）
let running = false; let paused = false; let speed = 1; let acc = 0;
let prevPos = new Map(); let frac = 1;
const ui = { sel: 0, selGuest: 0, cursor: null, mode: null, ghost: null, ghostM: null, highlights: null, positions: new Map(), time: 0, parts: [], calm: !!save.opt.calm, hits: [], flying: new Map(), moods: new Map() };
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

// ---- タイトル ----
function renderTitle() {
  const box = $('dayCards'); box.innerHTML = '';
  for (const d of DAYS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = `day-card ${d.season}`;
    const done = save.cleared.includes(d.id);
    b.innerHTML = `<span class="num">第<b>${d.id}</b>日</span><span class="nm">${d.name}${done ? ' <span class="ok">✓</span>' : ''}</span><span class="ds">${SEASONS[d.season].name}・${d.guests.length}羽${d.strong ? '・強風' : ''}${d.id === 26 ? '（試作で先取り）' : '・ここからはじめる'}</span>`;
    b.addEventListener('click', () => { unlock(); startDay(d.id); });
    box.appendChild(b);
  }
}

function showTitle() {
  running = false; $('game').hidden = true; $('title').hidden = false; renderTitle();
}

// ---- 日の開始 ----
function startDay(id) {
  s = createState(id);
  startSnap = cloneState(s);
  $('title').hidden = true; $('game').hidden = false;
  running = true; paused = false; acc = 0; speed = 1; frac = 1;
  ui.sel = 0; ui.selGuest = 0; ui.mode = null; ui.ghost = null; ui.highlights = null; ui.point = null; ui.parts = []; ui.flying.clear(); ui.moods.clear();
  pending = null; panelMsg = ''; hintStep = 0; warnedWind = false; freeze = false;
  snapshotPos();
  resize();
  const d = DAYS[dayIndex(id)];
  if (id === 1) {
    // 初日：開いたらすぐ営業。最初の客が来たところで時計を止めて、弁の操作を案内する
    guide = 'intro';
    showGuide(d.intro + '。お客さんは、好きな温度の湯を選んで入る。', [['はじめる', () => { stepOnce(); guide = 'swan'; freeze = true; updateGuide(); }], ['説明を飛ばす', skipGuide]]);
  } else {
    guide = 'prep';
    showGuide(`${d.intro}。いまは準備中。浴槽をタップすると、温度・静けさ・景色が見える。『風』『景×』の札に注目。`, [['わかった', () => { hideGuide(); guide = null; }]]);
  }
  refreshAll();
}

function skipGuide() {
  hideGuide(); guide = null; freeze = false; ui.point = null; ui.highlights = null;
  if (s.phase === 'prep') { s.phase = 'open'; }
  refreshAll();
}

// ---- 手引き ----
function showGuide(text, btns = []) {
  $('guide').hidden = false; $('guideText').textContent = text;
  const bb = $('guideBtns'); bb.innerHTML = '';
  for (const [label, fn] of btns) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', () => { unlock(); fn(); }); bb.appendChild(b); }
}
function hideGuide() { $('guide').hidden = true; }

function leftBath() { return s.items.find((i) => i.name === '左の湯'); }
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
}

// ---- 時間を進める ----
function snapshotPos() { prevPos = new Map(s.guests.map((g) => [g.id, { x: g.x, y: g.y }])); }

function stepOnce() {
  snapshotPos();
  const before = s.phase;
  const ev = tick(s);
  frac = 0;
  for (const e of ev) handleEvent(e);
  if (before !== 'done' && s.phase === 'done') setTimeout(showResult, 900);
  refreshAll();
}

function handleEvent(e) {
  const g = e.g ? s.guests.find((x) => x.id === e.g) : null;
  if (e.type === 'arrive') sfx.chirp();
  if (e.type === 'enter') sfx.plop();
  if (e.type === 'done') {
    const b = s.items.find((i) => i.id === g.target);
    const [x, y] = b ? [b.x, b.y] : [0, 0];
    ui.flying.set(g.id, { x, y, k: 0 });
    if (e.sat >= TUNE.passLine) { sfx.happy(); toast(`${SPECIES[g.sp].name} 満足 ${e.sat}点！ +${e.pay}`); }
    else { sfx.sad(); toast(`${SPECIES[g.sp].name} ${e.sat}点…（${shortWhy(g)}）`); }
  }
  if (e.type === 'leave') { sfx.sad(); toast(`${SPECIES[g.sp].name}が帰った：${e.why}`); }
  if (e.type === 'wind') { sfx.wind(); banner(`風が変わった：${DIR_NAMES[e.dir]}風`); }
}

function shortWhy(g) {
  const n = g.bathT || 1;
  const parts = [];
  if (g.acc[0] / n < 0.75) parts.push('お湯');
  if (g.acc[1] / n < 0.75) parts.push('声');
  if (g.acc[2] / n < 0.5) parts.push('景色');
  if (g.waited > 8) parts.push('待ち');
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
    const live = s.phase === 'open' && !paused && !freeze && !document.hidden && !$('result').open;
    if (live) {
      acc += dt * speed;
      const interval = 1;
      if (acc >= interval) { acc -= interval; stepOnce(); }
      frac = Math.min(1, acc / interval);
    } else frac = 1;
    // 位置の補間
    ui.positions.clear();
    for (const g of s.guests) {
      const p = prevPos.get(g.id) || g;
      const k = g.st === 'walk' || g.st === 'bath' ? Math.min(1, frac * 1.4) : 1;
      ui.positions.set(g.id, { x: p.x + (g.x - p.x) * k, y: p.y + (g.y - p.y) * k });
    }
    for (const [id, f] of ui.flying) { f.k += dt * 0.8; if (f.k > 1) ui.flying.delete(id); }
    const m = metrics(s);
    stepSteam(ui.parts, L, s, m, dt, ui.calm);
    // 入浴中の鳥の表情（今の点数）
    ui.moods.clear();
    for (const g of s.guests) {
      if (g.st !== 'bath') continue;
      const b = s.items.find((i) => i.id === g.target);
      const v = evaluate(s, g, b, m).total - Math.min(TUNE.waitPenaltyMax, g.waited * TUNE.waitPenalty);
      ui.moods.set(g.id, v >= TUNE.passLine ? 'good' : v >= 55 ? 'mid' : 'bad');
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, L, s, { ...ui, sel: ui.sel, hits: ui.hits });
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
  const ratio = og ? window.innerHeight / window.innerWidth : w < 600 ? 0.86 : 0.66;
  const h = Math.round(w * ratio);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.height = `${h}px`;
  L = layout({ width: w, height: h }, s);
  if (og) { L.ox += w * 0.1; L.oy += h * 0.04; }
}
window.addEventListener('resize', () => { resize(); });

// ---- 入力 ----
function cellFromEvent(ev) {
  const r = canvas.getBoundingClientRect();
  const px = ev.clientX - r.left; const py = ev.clientY - r.top;
  return { px, py };
}

canvas.addEventListener('pointerdown', (ev) => {
  unlock();
  if (!s) return;
  const { px, py } = cellFromEvent(ev);
  // 鳥
  let hit = null; let best = 1e9;
  for (const h of ui.hits) { const d = Math.hypot(h.x - px, h.y - py); if (d < h.r + 6 && d < best) { best = d; hit = h; } }
  if (hit && !ui.mode) { selectGuest(hit.g); return; }
  // 設備（背が高いので少し上も拾う）
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
  if (it) { ui.sel = it.id; ui.cursor = [x, y]; sfx.paper(); }
  else { ui.sel = 0; ui.cursor = [x, y]; }
  updateGuide();
  refreshAll();
}

function clearSel() { ui.sel = 0; ui.selGuest = 0; ui.cursor = null; ui.mode = null; ui.ghost = null; pending = null; ui.highlights = null; refreshAll(); }

function selectGuest(id) { ui.selGuest = id; ui.sel = 0; ui.mode = null; pending = null; refreshAll(); }

// 移動・建設の「置き場所を選ぶ」モード
function enterMode(mode) {
  ui.mode = mode; pending = null; ui.ghost = null; panelMsg = '';
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
  ui.ghost = { ...it }; ui.ghostM = pv.metrics;
  panelMsg = '';
  refreshAll();
}
function confirmPending() {
  const r = applyEdit(s, pending, { building: canBuild() });
  if (!r.ok) { panelMsg = r.reason; sfx.error(); }
  else { sfx.paper(); const it = pending.op === 'move' ? s.items.find((i) => i.id === pending.id) : itemAt(s, pending.x, pending.y); ui.sel = it?.id || 0; }
  pending = null; ui.mode = null; ui.ghost = null; ui.highlights = null;
  refreshAll();
}
function cancelMode() { ui.mode = null; pending = null; ui.ghost = null; ui.highlights = null; panelMsg = ''; refreshAll(); }

function doEdit(e) {
  const r = applyEdit(s, e, { building: canBuild() });
  if (!r.ok) { panelMsg = r.reason; sfx.error(); }
  else {
    panelMsg = '';
    if (e.op === 'valve') sfx.valve(e.q > (s.items.find((i) => i.id === e.id)?.q ?? 0) - 1);
    else sfx.paper();
  }
  updateGuide();
  refreshAll();
}

// ---- ボタン ----
function onPlay() {
  unlock();
  if (!s) return;
  if (s.phase === 'done') { showResult(); return; }
  if (guide === 'intro') { $('guideBtns').querySelector('button')?.click(); return; }
  if (s.phase === 'prep') { if (guide === 'prep') { hideGuide(); guide = null; } s.phase = 'open'; paused = false; cancelMode(); stepOnce(); return; }
  paused = !paused;
  if (!paused) cancelMode();
  refreshAll();
}
$('btnPlay').addEventListener('click', onPlay);
$('btnSpeed').addEventListener('click', () => { speed = speed === 1 ? 2 : 1; refreshAll(); });
$('btnReset').addEventListener('click', () => {
  if (!s) return;
  if (s.phase !== 'prep' && !confirm('この日を最初の状態からやり直しますか？')) return;
  startDay(s.day);
});
$('btnHint').addEventListener('click', () => {
  const hs = HINTS[s.day] || [];
  if (!hs.length) return;
  showGuide(hs[hintStep % hs.length], [['OK', hideGuide], ...(hs.length > 1 ? [['次のヒント', () => { hintStep += 1; $('btnHint').click(); }]] : [])]);
});
$('btnMenu').addEventListener('click', () => { paused = s?.phase === 'open' ? true : paused; $('optMute').checked = !!save.opt.mute; $('optCalm').checked = !!save.opt.calm; $('menu').showModal(); refreshAll(); });
$('btnCloseMenu').addEventListener('click', () => $('menu').close());
$('btnToTitle').addEventListener('click', () => { $('menu').close(); showTitle(); });
$('optMute').addEventListener('change', (e) => { save.opt.mute = e.target.checked; setMuted(save.opt.mute); writeSave(save); });
$('optCalm').addEventListener('change', (e) => { save.opt.calm = e.target.checked; ui.calm = save.opt.calm; writeSave(save); });
document.addEventListener('visibilitychange', () => { if (document.hidden && s?.phase === 'open') { paused = true; refreshAll(); } });

const HINTS = {
  1: ['白鳥は40〜50度、カワセミは25〜35度が好き。湯の色と札の数字が温度。', 'カワセミは景色をいちばん気にする。湯気（弁3以上の湯から風下へ流れる）が景色をさえぎることも。'],
  26: [
    '保温の湯の札に『風』がついている。北風が当たって5度下がり、35度しか出ない。白鳥は40度以上がほしい。',
    'ツルは景色がいちばん大事。保温の湯は四方を建物にふさがれて『景×』。展望湯を温めるお湯は足りない…。',
    '準備中（または一時停止中）なら、保温の湯を『移動』できる。源泉や管の隣で、島の外まで見通せる場所はどこ？',
    '風よけは、向けた方角から来る風を、すぐ後ろ（風下）の浴槽で止める。60秒で東風に変わるので、向きか場所の見直しを。',
    'ペンギンは冷たい湯（20〜30度）。東風になると浅湯も風にさらされて冷えすぎる。弁を1つ上げよう。',
  ],
};

// ---- 画面の更新 ----
function refreshAll() {
  if (!s) return;
  const d = DAYS[dayIndex(s.day)];
  $('dayName').innerHTML = `第${s.day}日「${d.name}」<small>${SEASONS[d.season].name}・基温${s.base}度</small>`;
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
  if (warn && !warnedWind) { warnedWind = true; toast(`あと${TUNE.windShiftAt - s.t}秒で${DIR_NAMES[w1]}風に変わる！ 風よけと弁を見直そう`); }
  $('wind').className = `wind${warn ? ' warn' : ''}`;
  $('wind').innerHTML = `<span class="arrow" style="transform:rotate(${windAngle(w0)}deg)">➜</span><br>${DIR_NAMES[w0]}風${s.strong ? '<span class="strong">・強</span>' : ''}${soon ? `<br><small>${TUNE.windShiftAt}秒〜${DIR_NAMES[w1]}風</small>` : ''}`;
  // 次の客
  const nx = s.guests.filter((g) => g.st === 'pending').slice(0, 2);
  const nb = $('next'); nb.innerHTML = '<span class="lbl">次の客</span>';
  for (const g of nx) {
    const el = document.createElement('div'); el.className = 'g';
    el.appendChild(birdIcon(g.sp));
    el.insertAdjacentHTML('beforeend', `<span>${SPECIES[g.sp].name}</span><span>${g.at - s.t > 0 ? `${g.at - s.t}秒後` : 'まもなく'}</span>`);
    nb.appendChild(el);
  }
  if (!nx.length) nb.insertAdjacentHTML('beforeend', '<div class="g">もう来ない</div>');
  // 時間の印
  const tm = $('timemarks');
  if (tm.dataset.day !== String(s.day)) {
    tm.dataset.day = String(s.day);
    tm.innerHTML = s.guests.map((g) => `<i style="left:${(g.at / TUNE.dayLimit) * 100}%"></i>`).join('') + (s.wind0 !== s.wind1 ? `<i class="wmark" style="left:${(TUNE.windShiftAt / TUNE.dayLimit) * 100}%" title="風が変わる"></i>` : '');
  }
  // ボタン
  const bp = $('btnPlay');
  bp.textContent = s.phase === 'prep' ? '▶ 開店する' : s.phase === 'done' ? '結果を見る' : paused ? '▶ 再開' : '⏸ 一時停止';
  bp.classList.toggle('pulse', s.phase === 'prep' && guide !== 'prep');
  $('btnSpeed').textContent = `${speed}倍`;
  $('btnReset').disabled = s.phase === 'prep' && JSON.stringify(s) === JSON.stringify(startSnap);
  renderPanel();
  renderGuests();
  updateClock();
}

function windAngle(dir) {
  // 風の吹いていく向きを、画面上の角度にする（等角）
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
  for (const g of s.guests) {
    const li = document.createElement('li');
    li.className = g.st === 'gone' ? 'gone' : g.st === 'pending' ? '' : 'now';
    li.appendChild(birdIcon(g.sp));
    const st = g.st === 'gone' ? `<span class="sc ${(g.sat ?? 0) >= TUNE.passLine ? 'ok' : 'ng'}">${g.sat ?? 0}点</span>`
      : g.st === 'bath' ? `<span class="sc">入浴中</span>` : g.st === 'pending' ? `<span class="need">${g.at}秒</span>` : `<span class="sc">${g.st === 'walk' ? '移動' : '待ち'}</span>`;
    li.insertAdjacentHTML('beforeend', `<span><b>${SPECIES[g.sp].name}</b> <span class="need">${needText(g.sp)}</span></span>${st}`);
    li.addEventListener('click', () => { if (g.st !== 'pending' && g.st !== 'gone') selectGuest(g.id); });
    ul.appendChild(li);
  }
  box.appendChild(ul);
}

function factorHTML(label, val, text) {
  const cls = val >= 1 ? '' : val > 0 ? 'mid' : 'bad';
  return `<div class="factor ${cls}">${label}<b>${val >= 1 ? '○' : val > 0 ? '△' : '×'}</b>${text}</div>`;
}

function renderPanel() {
  const p = $('panel');
  const err = `<p class="err">${panelMsg || ''}</p>`;
  if (ui.selGuest) {
    const g = s.guests.find((x) => x.id === ui.selGuest);
    p.innerHTML = `<h3>${SPECIES[g.sp].name} <span class="tag">${needText(g.sp)}</span></h3><p class="why">${explain(s, g)}</p>${g.st === 'bath' ? `<p class="muted">いまの見込み：${Math.round(evaluate(s, g, s.items.find((i) => i.id === g.target), metrics(s)).total - Math.min(TUNE.waitPenaltyMax, g.waited * TUNE.waitPenalty))}点（待ち${g.waited}秒）</p>` : ''}`;
    return;
  }
  if (ui.mode) {
    const what = ui.mode.op === 'move' ? `${labelOf(s.items.find((i) => i.id === ui.mode.id))}の移動先` : `${FACILITIES[ui.mode.type].name}を置く場所`;
    let body = `<h3>${what}を選ぶ</h3><p class="muted">緑のマスに置ける。置く前に、温度・景色・風の変化を見られる。</p>`;
    if (pending) {
      const it = ui.ghost;
      if (isBath(it)) {
        const mm = ui.ghostM[it.id];
        body += `<div class="factors">${factorHTML('温度', mm.on ? 1 : 0, mm.on ? `${mm.T}度${mm.exposed ? '（風−5）' : ''}` : '湯なし')}${factorHTML('風', mm.exposed ? 0 : 1, mm.exposed ? 'さらされる' : '守られている')}${factorHTML('景色', mm.view, mm.view ? '見える' : mm.steamBy ? '湯気' : 'ふさがれる')}</div>`;
        if (!mm.supplied) body += '<p class="err">ここは源泉・管とつながらない（湯が出ない）</p>';
      }
      const cost = ui.mode.op === 'build' ? FACILITIES[ui.mode.type].cost : 0;
      body += `<div class="btnrow"><button type="button" id="pOk" class="on">ここに決める${cost ? `（${cost}）` : ''}</button><button type="button" id="pNo">やめる</button></div>`;
    } else body += '<div class="btnrow"><button type="button" id="pNo">やめる</button></div>';
    p.innerHTML = body + err;
    $('pOk')?.addEventListener('click', confirmPending);
    $('pNo')?.addEventListener('click', cancelMode);
    return;
  }
  const it = s.items.find((i) => i.id === ui.sel);
  if (it && isBath(it)) {
    const m = metrics(s); const mm = m[it.id];
    const F = FACILITIES[it.type];
    const users = s.guests.filter((g) => (g.st === 'bath' || g.st === 'walk') && g.target === it.id);
    const nextG = s.guests.filter((g) => g.st === 'pending' || g.st === 'wait').slice(0, 2);
    const lo = 10; const hi = 55; const pos = (T) => `${Math.max(0, Math.min(100, ((T - lo) / (hi - lo)) * 100))}%`;
    const bands = [...users.map((g) => [g, '#6fa83a']), ...nextG.map((g) => [g, '#e08a9a'])].map(([g, col]) => {
      const [a, b] = SPECIES[g.sp].range; return `<span class="band" title="${SPECIES[g.sp].name}" style="left:${pos(a)};width:calc(${pos(b)} - ${pos(a)});border-color:${col}"></span>`;
    }).join('');
    const quiet = (() => { let n = mm.noise - (mm.fenced ? 1 : 0); n = Math.max(0, n); return n; })();
    const canUp = checkEdit(s, { op: 'valve', id: it.id, q: it.q + 1 }).ok;
    const canDown = it.q > 0;
    const sb = canBuild();
    p.innerHTML = `<h3>${labelOf(it)} <span class="tag">${F.name}・${F.seats}席${F.heat ? `・${F.heat > 0 ? '+' : ''}${F.heat}度` : ''}</span></h3>
      <div class="valve"><button type="button" id="vDown" aria-label="弁を閉める" ${canDown ? '' : 'disabled'}>−</button>
      <div class="temp"><b>${mm.on ? `${mm.T}度` : '止まっている'}</b><small>弁 ${it.q}/${TUNE.qMax}・基温${s.base}＋${5 * it.q}${F.heat ? (F.heat > 0 ? `＋保温${F.heat}` : `${F.heat}（浅い）`) : ''}${mm.exposed ? '−風5' : ''}</small></div>
      <button type="button" id="vUp" aria-label="弁を開ける" ${canUp ? '' : 'disabled'}>＋</button></div>
      <div class="meter">${bands}${mm.on ? `<span class="cur" style="left:${pos(mm.T)}"></span>` : ''}<div class="ticks">${[15, 25, 35, 45].map((t) => `<span style="left:${pos(t)}">${t}</span>`).join('')}</div></div>
      <p class="muted">緑の枠＝入っている客の好み、桃の枠＝次に来る客の好み</p>
      <div class="factors">${factorHTML('温度', mm.on ? 1 : 0, mm.on ? `${mm.T}度${mm.exposed ? '・風で−5' : ''}` : '湯なし')}${factorHTML('静けさ', quiet === 0 ? 1 : quiet === 1 ? 0.5 : 0, quiet ? `にぎやか${quiet}` : mm.fenced ? '吸音垣で静か' : '静か')}${factorHTML('景色', mm.view, mm.view ? '見える' : mm.steamBy ? '湯気で×' : '建物で×')}</div>
      <p class="muted">${!mm.supplied ? '管が源泉につながっていない。' : ''}入浴中・向かう客 ${users.length}/${F.seats}</p>
      <div class="btnrow"><button type="button" id="bMove" ${sb ? '' : 'disabled'}>移動</button><button type="button" id="bDel" ${sb ? '' : 'disabled'}>撤去（+${Math.floor(F.cost / 2)}）</button></div>
      ${sb ? '' : '<p class="muted">移動・撤去は一時停止中にできる</p>'}${err}`;
    $('vUp').addEventListener('click', () => doEdit({ op: 'valve', id: it.id, q: it.q + 1 }));
    $('vDown').addEventListener('click', () => doEdit({ op: 'valve', id: it.id, q: it.q - 1 }));
    $('bMove').addEventListener('click', () => enterMode({ op: 'move', id: it.id }));
    $('bDel').addEventListener('click', () => { doEdit({ op: 'remove', id: it.id }); ui.sel = 0; refreshAll(); });
    return;
  }
  if (it && it.type === 'windbreak') {
    const sb = canBuild();
    const prot = (d) => { const [dx, dy] = DIRS[d]; const t = itemAt(s, it.x - dx, it.y - dy); return t && isBath(t) ? labelOf(t) : 'なし'; };
    p.innerHTML = `<h3>風よけ <span class="tag">いま ${DIR_NAMES[it.dir]}向き</span></h3>
      <p class="muted">向けた方角から来る強風を止め、すぐ後ろ（風下）の浴槽を守る。視線もさえぎる。営業中もいつでも回せる。</p>
      <div class="btnrow">${DIR_LIST.map((d) => `<button type="button" data-dir="${d}" class="${it.dir === d ? 'on' : ''}">${DIR_NAMES[d]}向き<br><small>守る：${prot(d)}</small></button>`).join('')}</div>
      <div class="btnrow"><button type="button" id="bMove" ${sb ? '' : 'disabled'}>移動</button><button type="button" id="bDel" ${sb ? '' : 'disabled'}>撤去（+4）</button></div>${err}`;
    p.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('click', () => doEdit({ op: 'rotate', id: it.id, dir: b.dataset.dir })));
    $('bMove').addEventListener('click', () => enterMode({ op: 'move', id: it.id }));
    $('bDel').addEventListener('click', () => { doEdit({ op: 'remove', id: it.id }); ui.sel = 0; refreshAll(); });
    return;
  }
  if (it && it.type === 'fence') {
    const sb = canBuild();
    p.innerHTML = `<h3>吸音垣</h3><p class="muted">隣の浴槽に届く鳥の声を1つ減らす。視線もさえぎる。</p>
      <div class="btnrow"><button type="button" id="bMove" ${sb ? '' : 'disabled'}>移動</button><button type="button" id="bDel" ${sb ? '' : 'disabled'}>撤去（+5）</button></div>${err}`;
    $('bMove').addEventListener('click', () => enterMode({ op: 'move', id: it.id }));
    $('bDel').addEventListener('click', () => { doEdit({ op: 'remove', id: it.id }); ui.sel = 0; refreshAll(); });
    return;
  }
  if (it && it.type === 'source') {
    p.innerHTML = `<h3>源泉 <span class="tag">お湯 ${heatUsed(s)}/${s.cap}</span></h3><p class="muted">ここから床下の管を通って、隣り合う浴槽にお湯が届く。弁の合計は${s.cap}まで。どこかを開けたいときは、ほかを閉める。</p>`;
    return;
  }
  if (ui.cursor && !it) {
    const [x, y] = ui.cursor;
    if (isEntrance(x, y)) { p.innerHTML = '<h3>入口</h3><p class="muted">渡り鳥はここに降りて、好きな湯を選んで歩いていく。</p>'; return; }
    if (!canBuild()) {
      p.innerHTML = `<h3>空きマス</h3><p class="muted">建てる・管を引くのは、準備中か一時停止中だけ。</p><div class="btnrow"><button type="button" id="bPause">⏸ 一時停止する</button></div>`;
      $('bPause').addEventListener('click', () => { paused = true; refreshAll(); });
      return;
    }
    const d = DAYS[dayIndex(s.day)];
    const hasPipe = s.pipes[y][x];
    p.innerHTML = `<h3>空きマスに建てる <span class="tag">💰${s.money}</span></h3><div class="build-list">${d.build.map((t) => {
      const F = FACILITIES[t]; const okk = checkEdit(s, { op: 'build', type: t, x, y }, { building: true }).ok;
      return `<button type="button" data-t="${t}" ${okk ? '' : 'disabled'}><b>${F.name}</b><small>${F.cost}・${buildDesc(t)}</small></button>`;
    }).join('')}<button type="button" id="bPipe"><b>${hasPipe ? '管を外す' : '床下の管'}</b><small>${hasPipe ? '+1' : `${PIPE_COST}・源泉と浴槽をつなぐ`}</small></button></div>${err}`;
    p.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { const t = b.dataset.t; const pv = preview(s, { op: 'build', type: t, x, y, dir: windAt(s) }, { building: true }); if (!pv.ok) { panelMsg = pv.reason; refreshAll(); return; } ui.mode = { op: 'build', type: t }; pending = { op: 'build', type: t, x, y, dir: windAt(s) }; ui.ghost = pv.state.items.find((i) => i.x === x && i.y === y); ui.ghostM = pv.metrics; refreshAll(); }));
    $('bPipe').addEventListener('click', () => doEdit({ op: hasPipe ? 'unpipe' : 'pipe', x, y }));
    return;
  }
  const tip = s.phase === 'prep' ? '準備中：設備をタップして様子を見る。空いたマスをタップすると建てられる。準備ができたら「開店する」。'
    : s.phase === 'done' ? 'この日は閉店。' : paused ? '一時停止中：設備の移動・建設ができる。' : '浴槽をタップして弁を調整。鳥をタップすると、満足・不満の理由が分かる。';
  p.innerHTML = `<h3>${s.phase === 'prep' ? '準備中' : s.phase === 'done' ? '閉店' : paused ? '一時停止中' : '営業中'}</h3><p class="muted">${tip}</p>${err}`;
}

function buildDesc(t) {
  return { bath: '2席', hot: '2席・+5度', shallow: '1席・−5度', view: '1席・風よけ越しに景色', windbreak: '強風を止める', fence: '隣の声を−1' }[t] || '';
}

// ---- 結果 ----
function showResult() {
  if (!s || s.phase !== 'done' || $('result').open) return;
  const sm = summary(s);
  if (sm.cleared && !save.cleared.includes(s.day)) save.cleared.push(s.day);
  save.best[s.day] = Math.max(save.best[s.day] || 0, sm.good);
  writeSave(save);
  $('resTitle').textContent = sm.cleared ? (sm.good === sm.n ? '全員大満足！' : '日クリア！') : 'あと少し…';
  $('resTitle').className = sm.cleared ? 'ok' : 'ng';
  $('resLead').textContent = `${sm.n}羽中 ${sm.good}羽が満足（必要 ${sm.need}羽）`;
  const ul = $('resList'); ul.innerHTML = '';
  for (const g of s.guests) {
    const li = document.createElement('li'); li.appendChild(birdIcon(g.sp));
    const reason = g.left ? (g.left === 'wait' ? `入れずに帰った：${g.why || '待ちくたびれた'}` : '閉店に間に合わなかった') : resultWhy(g);
    li.insertAdjacentHTML('beforeend', `<span><b>${SPECIES[g.sp].name}</b><br><span class="r">${reason}</span></span><b style="color:${(g.sat ?? 0) >= TUNE.passLine ? '#6fa83a' : '#e0675d'}">${g.sat ?? 0}点</b>`);
    ul.appendChild(li);
  }
  $('resMoney').textContent = `売上 +${sm.earned}　維持費 −${sm.upkeep}　所持金 ${s.money}`;
  const bb = $('resBtns'); bb.innerHTML = '';
  const add = (label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; b.addEventListener('click', () => { $('result').close(); fn(); }); bb.appendChild(b); };
  add('タイトルへ', 'ghost', showTitle);
  add('もう一度', sm.cleared ? 'ghost' : 'primary', () => startDay(s.day));
  const ni = dayIndex(s.day) + 1;
  if (sm.cleared && DAYS[ni]) add(`次へ：第${DAYS[ni].id}日`, 'primary', () => startDay(DAYS[ni].id));
  $('result').showModal();
}

function resultWhy(g) {
  const n = g.bathT || 1; const S = SPECIES[g.sp];
  const t = g.acc[0] / n; const q = g.acc[1] / n; const v = g.acc[2] / n;
  const mk = (x) => (x >= 0.95 ? '○' : x > 0.3 ? '△' : '×');
  return `お湯${mk(t)} 声${mk(q)} 景色${mk(v)}${g.waited > 4 ? `・待ち${g.waited}秒` : ''}（${needText(g.sp).split('・')[1]}）`;
}

// ---- 起動 ----
loadImages({ bg: 'art/bg-cloudsea.webp' }).then(() => {});
requestAnimationFrame(frame);
renderTitle();
if (params.get('day')) { const id = Number(params.get('day')); if (dayIndex(id) >= 0) startDay(id); }
if (params.get('og')) {
  // 共有画像用：冬の日を、配置を直した後の営業中の場面で見せる
  document.body.classList.add('og');
  import('./solutions.js').then(({ SOLUTIONS }) => {
    startDay(26); skipGuide();
    s.phase = 'prep';
    for (const [t, e] of SOLUTIONS[26]) if (t < 0) applyEdit(s, e, { building: true });
    s.phase = 'open';
    for (let i = 0; i < 27; i++) { for (const [t, e] of SOLUTIONS[26]) if (t === s.t) applyEdit(s, e); tick(s); }
    paused = true; snapshotPos(); resize(); refreshAll();
    const t = document.createElement('div'); t.className = 'og-title';
    t.innerHTML = '<b>雲海温泉と<br>渡り鳥の宿</b><span>お湯を分け、風を読み、渡り鳥をもてなそう</span>';
    document.body.appendChild(t);
    const k = document.createElement('img'); k.className = 'og-koko'; k.src = 'art/char-koko-welcome.webp'; document.body.appendChild(k);
  });
}
// テスト・確認用（画面の状態を外から見られるように）
window.__inn = { get state() { return s; }, startDay, stepOnce, skipGuide, cellPoint: (x, y) => { const [px, py] = toScreen(L, x, y); const r = canvas.getBoundingClientRect(); return [r.left + px, r.top + py - L.TH * 0.2]; } };
