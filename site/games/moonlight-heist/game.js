import * as L from './logic.js';
import { STORY } from './rooms.js';

const { ROOMS, CHAPTERS, CFG } = L;
const $ = (id) => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const params = new URLSearchParams(location.search);
const OG = params.get('og') === '1';

let save = L.loadSave(localStorage);
const persist = () => L.saveSave(localStorage, save);
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const reduceMotion = () => save.opt.reduceMotion || prefersReduced;

let run = null, roomIdx = 0, phase = 0, mode = 'title', paused = false;
let screenName = '', tutorialT = 0, flash = 0, shake = 0, fade = 0, cam = { x: 0, y: 0 }, lastT = 0;
const keys = new Set();
const touch = { dx: 0, dy: 0, sneak: false, decoy: false };

// ---------- 音（Web Audio で生成） ----------
let ac = null, master = null, bgm = null, beatT = 0, stepT = 0;
function audio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = save.opt.volume * 0.5; master.connect(ac.destination);
    const g = ac.createGain(); g.gain.value = 0.05; g.connect(master);
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain();
    o1.type = 'triangle'; o1.frequency.value = 55; o2.type = 'sine'; o2.frequency.value = 82.4;
    lfo.frequency.value = 0.12; lg.gain.value = 0.03; lfo.connect(lg); lg.connect(g.gain);
    o1.connect(g); o2.connect(g); o1.start(); o2.start(); lfo.start();
    bgm = { g, o2 };
  } catch { ac = null; }
  return ac;
}
function setVolume() { if (master) master.gain.value = save.opt.volume * 0.5; }
function tone(f, d, type = 'sine', v = 0.3, to = null, delay = 0) {
  if (!ac || save.opt.volume <= 0) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02);
}
const sfx = {
  step: () => tone(120 + Math.random() * 30, 0.05, 'triangle', 0.1),
  key: () => { tone(660, 0.25, 'sine', 0.3); tone(990, 0.4, 'sine', 0.25, null, 0.1); tone(1320, 0.5, 'sine', 0.2, null, 0.22); },
  opt: () => { tone(880, 0.2, 'sine', 0.25); tone(1175, 0.3, 'sine', 0.2, null, 0.1); },
  decoy: () => { tone(300, 0.12, 'square', 0.1, 120); tone(180, 0.1, 'square', 0.12, 90, 0.18); },
  alert: () => { tone(520, 0.18, 'sawtooth', 0.18, 780); tone(780, 0.3, 'sawtooth', 0.18, 520, 0.15); },
  caught: () => tone(240, 0.6, 'sawtooth', 0.25, 50),
  clear: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.45, 'triangle', 0.25, null, i * 0.12)); },
  relief: () => tone(392, 0.5, 'sine', 0.15, 330),
  beat: () => { tone(60, 0.12, 'sine', 0.5); tone(55, 0.14, 'sine', 0.4, null, 0.16); },
  fake: () => tone(200, 0.3, 'square', 0.1, 140),
  final: () => { [262, 330, 392, 523, 659].forEach((f, i) => tone(f, 0.8, 'triangle', 0.2, null, i * 0.08)); },
};

// ---------- 画面 ----------
const screenEl = $('screen');
function show(name, html, cls = '') {
  screenName = name; screenEl.className = 'screen on ' + cls; screenEl.innerHTML = html;
  if (reduceMotion()) screenEl.classList.add('rm');
  $('touch').hidden = true; $('hud').hidden = true; $('gaugeBar').hidden = true; $('collect').hidden = true;
  const f = screenEl.querySelector('button'); if (f) f.focus({ preventScroll: true });
}
function hideScreen() {
  screenName = ''; screenEl.className = 'screen'; screenEl.innerHTML = '';
  $('hud').hidden = false; $('gaugeBar').hidden = false; $('collect').hidden = false;
  $('touch').hidden = !isTouchUI();
}
const isTouchUI = () => matchMedia('(pointer: coarse)').matches || innerWidth < 700 || 'ontouchstart' in window;
const roomChapter = (ri) => CHAPTERS.findIndex((c) => c.rooms.includes(ri));
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const total = () => L.collectedTotal(save);
const firstUnplayed = () => { for (let i = 0; i < 15; i++) if (!save.rooms[i]) return i; return 14; };

function titleScreen() {
  mode = 'title';
  const started = Object.keys(save.rooms).length > 0;
  show('title', `<div class="card">
    <p class="sub">閉館後の美術館 ― 見習い怪盗ルウ</p>
    <h2 class="big">月光美術館と<br>十二の怪盗</h2>
    <p>見つからないように展示室を進み、<br>盗まれた「夜のかけら」を取り戻せ。</p>
    <button class="pri" data-a="${started ? 'continue' : 'new'}">${started ? `つづきから（第${firstUnplayed() + 1}室）` : 'はじめる'}</button>
    <div class="row2"><button data-a="rooms">室えらび</button><button data-a="album">アルバム ${total()}/45</button></div>
    <button data-a="options">せってい</button>
    <p class="sub">WASD/矢印：移動　Shift：忍び足　Space：おとり</p>
    <p class="sub"><a href="/" style="color:#7f8ab5">Game Arcade</a></p></div>`, 'title');
}
function roomsScreen() {
  let h = '<div class="card"><h2>室えらび</h2>';
  CHAPTERS.forEach((c) => {
    h += `<div class="chap">${c.sub}　${c.name}</div><div class="grid">`;
    c.rooms.forEach((ri) => {
      const ok = L.unlocked(save, ri) || params.has('unlock'), s = save.rooms[ri];
      h += `<button data-a="room" data-i="${ri}" ${ok ? '' : 'disabled'}>${ri + 1}<small>${s ? s.rank : ok ? '・' : '🔒'}</small></button>`;
    });
    h += '</div>';
  });
  show('rooms', h + '<button data-a="title">もどる</button></div>');
}
function albumScreen() {
  let h = `<div class="card"><h2>アルバム ${total()}/45</h2><p class="sub">夜のかけらと展示品。集めるほど結末が変わる。</p><div class="alb">`;
  ROOMS.forEach((room, ri) => {
    const s = save.rooms[ri];
    room.items.forEach((it, k) => {
      const have = s && (k === 0 || (s.opts || []).includes(k));
      h += `<div class="${have ? '' : 'no'}"><b>${have ? it[0] : '？？？'}</b>${have ? it[1] : `第${ri + 1}室の${k === 0 ? 'かけら' : '展示品'}`}</div>`;
    });
  });
  show('album', h + '</div><button data-a="title">もどる</button></div>');
}
function optionsScreen(back = 'title') {
  const o = save.opt;
  show('options', `<div class="card opt"><h2>せってい</h2>
    <label>音量<input id="oVol" type="range" min="0" max="1" step="0.1" value="${o.volume}" aria-label="音量"></label>
    <label>ゆっくりモード（警備員 0.8倍）<input id="oSlow" type="checkbox" ${o.slow ? 'checked' : ''}></label>
    <label>視界の扇を表示<input id="oView" type="checkbox" ${o.showView ? 'checked' : ''}></label>
    <label>動きを抑える<input id="oRed" type="checkbox" ${o.reduceMotion ? 'checked' : ''}></label>
    <button data-a="${back}">もどる</button>
    <button data-a="reset" style="opacity:.7">記録を消す</button></div>`);
  $('oVol').oninput = (e) => { save.opt.volume = +e.target.value; setVolume(); persist(); };
  $('oSlow').onchange = (e) => { save.opt.slow = e.target.checked; persist(); };
  $('oView').onchange = (e) => { save.opt.showView = e.target.checked; persist(); };
  $('oRed').onchange = (e) => { save.opt.reduceMotion = e.target.checked; persist(); };
}
function storyScreen(lines, next, title = '') {
  show('story', `<div class="card"><h2>${title}</h2><div class="lines">${lines.map((l, i) => `<p style="animation-delay:${i * 0.5}s">${l}</p>`).join('')}</div><button class="pri" data-a="next">つづける</button></div>`);
  storyNext = next;
}
let storyNext = null;

function resultScreen() {
  const room = ROOMS[roomIdx], s = save.rooms[roomIdx];
  const got = run.items.filter((i) => i.kind === 'opt' && i.got).length;
  const last = roomIdx === 14;
  show('result', `<div class="card"><p class="sub">${room.name}</p><h2>クリア</h2>
    <div class="rk">${L.rankOf(room, run)}</div>
    <div class="stat"><span><b>${fmt(run.time)}</b>タイム</span><span><b>${run.alerts}</b>見つかった</span><span><b>${got}/2</b>展示品</span></div>
    <p class="sub">自己ベスト ${fmt(s.time)}　最高ランク ${s.rank}</p>
    ${got < 2 ? '<p class="sub">まだ取っていない展示品がある。もう一度忍び込んでみる？</p>' : ''}
    <button class="pri" data-a="${last ? 'ending' : 'nextroom'}">${last ? '結末へ' : '次の室へ'}</button>
    <div class="row2"><button data-a="retry">もう一度</button><button data-a="rooms">室えらび</button></div></div>`, 'clear');
}
function endingScreen() {
  const e = L.endingFor(save);
  storyScreen(e.lines, () => { titleScreen(); }, `結末「${e.title}」<br><small style="font-size:13px;color:#a9b8e8">集めた展示品 ${total()}/45</small>`);
}
function pauseScreen() {
  paused = true;
  show('pause', `<div class="card"><h2>ポーズ</h2><button class="pri" data-a="resume">再開</button><button data-a="restart">この室をやり直す</button><button data-a="options-p">せってい</button><button data-a="rooms">室えらび</button><button data-a="title">タイトルへ</button></div>`);
}

screenEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  audio();
  const a = b.dataset.a;
  if (a === 'new') startRoom(0);
  else if (a === 'continue') startRoom(firstUnplayed());
  else if (a === 'rooms') { paused = false; roomsScreen(); }
  else if (a === 'album') albumScreen();
  else if (a === 'options') optionsScreen('title');
  else if (a === 'options-p') optionsScreen('pause');
  else if (a === 'pause') pauseScreen();
  else if (a === 'title') { paused = false; run = null; titleScreen(); }
  else if (a === 'room') startRoom(+b.dataset.i);
  else if (a === 'resume') { paused = false; hideScreen(); }
  else if (a === 'restart') { paused = false; startRoom(roomIdx, phase); }
  else if (a === 'retry') startRoom(roomIdx);
  else if (a === 'nextroom') startRoom(Math.min(14, roomIdx + 1));
  else if (a === 'ending') endingScreen();
  else if (a === 'next') { const n = storyNext; storyNext = null; n && n(); }
  else if (a === 'reset') { if (confirm('記録をすべて消しますか？')) { save = L.emptySave(); persist(); titleScreen(); } }
});

// ---------- 開始・結果 ----------
function startRoom(ri, ph) {
  roomIdx = ri; phase = ph ?? Math.floor(Math.random() * 3);
  if (params.has('phase')) phase = +params.get('phase');
  newRun();
  mode = 'play'; paused = false;
  const c = CHAPTERS[roomChapter(ri)];
  $('hChap').textContent = `${c.sub} ${ri - c.rooms[0] + 1}/5`;
  $('hRoom').textContent = ROOMS[ri].name;
  hideScreen();
  tutorialT = 0;
  const flavor = c.flavor[phase];
  toast(`${ROOMS[ri].name} ― ${flavor}`, 3200);
}
function newRun() {
  run = L.createRun(ROOMS[roomIdx], phase, { slow: save.opt.slow });
  fade = 0; flash = 0;
  updateHud();
}
function updateHud() {
  $('hItems').textContent = `${total() + (run ? run.items.filter((i) => i.got && !(save.rooms[roomIdx]?.opts || []).includes(i.idx) && !(i.kind === 'key' && save.rooms[roomIdx])).length : 0)}/45`;
  $('hDecoy').textContent = run ? 'おとり ' + '●'.repeat(run.decoys) + '○'.repeat(CFG.decoyCount - run.decoys) : '';
  if (run) $('collectFill').style.height = `${(run.items.filter((i) => i.got).length / run.items.length) * 100}%`;
}
let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms);
}

function handleEvents() {
  const room = run.room;
  for (const ev of run.events.splice(0)) {
    if (ev === 'key') { sfx.key(); flash = 0.6; const it = run.items.filter((i) => i.kind === 'key' && i.got).length; toast(`「${room.items[0][0]}」${room.items[0][1]}`, 3200); void it; updateHud(); }
    else if (ev === 'opt') {
      const got = run.items.filter((i) => i.kind === 'opt' && i.got);
      const idx = got[got.length - 1].idx; sfx.opt(); toast(`「${room.items[idx][0]}」${room.items[idx][1]}`, 3200); updateHud();
    }
    else if (ev === 'alert') { sfx.alert(); toast('見つかった！ 走って、視線を切れ！', 2200); shake = reduceMotion() ? 0 : 0.25; }
    else if (ev === 'decoy') { sfx.decoy(); updateHud(); }
    else if (ev === 'fake') { sfx.fake(); toast('にせもの…光る足跡の台座が本物だ。', 2600); }
    else if (ev === 'final') { sfx.final(); flash = 1.2; toast('最後のかけら！ 館が目を覚ます。出口まで走れ！', 3600); }
    else if (ev === 'caught') { sfx.caught(); }
    else if (ev === 'clear') { sfx.clear(); onClear(); }
  }
}
function onClear() {
  save = L.recordClear(save, roomIdx, run); persist(); updateHud();
  const room = ROOMS[roomIdx];
  const after = () => resultScreen();
  setTimeout(() => {
    if (room.endEvent && room.endEvent !== 'ch3') storyScreen(STORY[room.endEvent], after, `${CHAPTERS[roomChapter(roomIdx)].sub}　おわり`);
    else if (room.endEvent === 'ch3') storyScreen(STORY.ch3, after, '最後の月光');
    else after();
  }, reduceMotion() ? 200 : 700);
  mode = 'clearing';
}

// ---------- 入力 ----------
const KEYMAP = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
addEventListener('keydown', (e) => {
  if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); if (mode === 'play' && !paused) e.preventDefault(); audio(); }
  else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.add('sneak');
  else if (e.code === 'Space') { if (mode === 'play' && !paused) { e.preventDefault(); keys.add('decoy'); audio(); } }
  else if ((e.code === 'KeyP' || e.code === 'Escape') && mode === 'play') { paused ? (paused = false, hideScreen()) : pauseScreen(); }
  else if (e.code === 'KeyM') toggleMute();
});
addEventListener('keyup', (e) => {
  if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]);
  else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.delete('sneak');
});
addEventListener('blur', () => { keys.clear(); if (mode === 'play' && !paused) pauseScreen(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play' && !paused) pauseScreen(); });
function toggleMute() { save.opt.volume = save.opt.volume > 0 ? 0 : 0.6; setVolume(); persist(); $('bMute').textContent = save.opt.volume > 0 ? '♪' : '×'; }
$('bMute').onclick = () => { audio(); toggleMute(); };
$('bPause').onclick = () => { audio(); if (mode === 'play') pauseScreen(); };

// タッチ：方向パッド（アナログ入力）・忍び足（押している間）・おとり
const dpad = $('dpad'), knob = $('knob');
function dpadMove(e) {
  const r = dpad.getBoundingClientRect();
  let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
  const l = Math.hypot(dx, dy);
  if (l > 1) { dx /= l; dy /= l; }
  touch.dx = l < 0.18 ? 0 : dx; touch.dy = l < 0.18 ? 0 : dy;
  knob.style.transform = `translate(${dx * 40}px,${dy * 40}px)`;
}
dpad.addEventListener('pointerdown', (e) => { audio(); dpad.setPointerCapture(e.pointerId); dpadMove(e); e.preventDefault(); });
dpad.addEventListener('pointermove', (e) => { if (dpad.hasPointerCapture(e.pointerId)) dpadMove(e); });
const dpadEnd = () => { touch.dx = 0; touch.dy = 0; knob.style.transform = ''; };
dpad.addEventListener('pointerup', dpadEnd); dpad.addEventListener('pointercancel', dpadEnd);
const bS = $('bSneak'), bD = $('bDecoy');
bS.addEventListener('pointerdown', (e) => { audio(); touch.sneak = !touch.sneak; bS.classList.toggle('on', touch.sneak); e.preventDefault(); });
bD.addEventListener('pointerdown', (e) => { audio(); touch.decoy = true; e.preventDefault(); });

function readInput() {
  let dx = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0), dy = (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0);
  if (!dx && !dy) { dx = touch.dx; dy = touch.dy; }
  const decoy = keys.has('decoy') || touch.decoy;
  keys.delete('decoy'); touch.decoy = false;
  const mag = Math.min(1, Math.hypot(dx, dy));
  return { dx, dy, sneak: keys.has('sneak') || touch.sneak || (touch.dx || touch.dy ? mag < 0.4 && mag > 0 && false : false), decoy };
}

// ---------- 描画 ----------
const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 1274126177) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
let W = 0, H = 0, DPR = 1, TS = 44;
function resize() {
  DPR = Math.min(2, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  TS = W < 700 ? Math.max(30, Math.min(44, Math.floor(W / 10.5))) : Math.max(36, Math.min(56, Math.floor(Math.min(W / 17, (H - 90) / 12))));
}
addEventListener('resize', resize);

function wx(x) { return x * TS - cam.x; }
function wy(y) { return y * TS - cam.y; }

function updateCamera(dt, snap) {
  const room = run.room, rw = room.rows[0].length * TS, rh = room.rows.length * TS;
  const topPad = 56, botPad = isTouchUI() && W < 700 ? 190 : 20;
  const vh = H - topPad - botPad;
  const target = (size, view, p, off) => (size <= view ? -(view - size) / 2 - off : Math.max(-off, Math.min(size - view - off, p - view / 2 - off)));
  const tx = target(rw, W, run.p.x * TS, 0);
  const ty = target(rh, vh, run.p.y * TS, 0) - topPad + (rh <= vh ? 0 : 0);
  const k = snap ? 1 : Math.min(1, dt * 6);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
}

function drawFloor(room, ch, t) {
  const rows = room.rows;
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[0].length; x++) {
    const c = rows[y][x], px = wx(x), py = wy(y);
    if (px > W || py > H || px < -TS || py < -TS) continue;
    if (c === '#') continue;
    const dark = (x + y) % 2;
    ctx.fillStyle = ch.floor[dark]; ctx.fillRect(px, py, TS + 0.5, TS + 0.5);
    // 大理石の筋
    ctx.strokeStyle = 'rgba(200,215,255,0.06)'; ctx.lineWidth = 1;
    const a = hash(x, y, 1), b = hash(x, y, 2);
    ctx.beginPath(); ctx.moveTo(px + a * TS, py); ctx.bezierCurveTo(px + b * TS, py + TS * 0.3, px + a * TS, py + TS * 0.7, px + b * TS, py + TS); ctx.stroke();
    // 金の星図
    if (hash(x, y, 3) > 0.72) {
      ctx.fillStyle = 'rgba(224,190,100,0.55)';
      const sx = px + hash(x, y, 4) * TS * 0.8 + TS * 0.1, sy = py + hash(x, y, 5) * TS * 0.8 + TS * 0.1;
      ctx.fillRect(sx, sy, 2, 2);
      if (hash(x, y, 6) > 0.6) { ctx.strokeStyle = 'rgba(224,190,100,0.22)'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + TS * 0.4, sy + TS * 0.25); ctx.stroke(); }
    }
    if (c === 'm') {
      ctx.fillStyle = '#3a4150'; ctx.fillRect(px, py, TS, TS);
      ctx.strokeStyle = '#c9a24a99'; ctx.strokeRect(px + 2.5, py + 2.5, TS - 5, TS - 5);
      ctx.fillStyle = '#c9a24a'; [[5, 5], [TS - 6, 5], [5, TS - 6], [TS - 6, TS - 6]].forEach(([ox, oy]) => ctx.fillRect(px + ox, py + oy, 2, 2));
    }
    if (c === 'S') { ctx.fillStyle = 'rgba(214,65,79,0.28)'; ctx.fillRect(px + 3, py + 3, TS - 6, TS - 6); }
  }
}

function drawWalls(room, ch) {
  const rows = room.rows;
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[0].length; x++) {
    if (rows[y][x] !== '#') continue;
    const px = wx(x), py = wy(y);
    if (px > W || py > H || px < -TS || py < -TS) continue;
    ctx.fillStyle = ch.wall; ctx.fillRect(px, py, TS + 0.5, TS + 0.5);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(px, py, TS, TS);
    const below = L.tileAt(room, x, y + 1) !== '#';
    if (below) {
      ctx.fillStyle = ch.wall; ctx.fillRect(px, py + TS * 0.55, TS + 0.5, TS * 0.45);
      ctx.fillStyle = ch.trim; ctx.fillRect(px, py + TS * 0.55, TS + 0.5, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px, py + TS - 5, TS, 5);
      const hsh = hash(x, y, 9);
      if (hsh > 0.55 && L.tileAt(room, x - 1, y) === '#' && L.tileAt(room, x + 1, y) === '#') {
        // 金縁の額（小さな絵）
        ctx.fillStyle = ch.trim; ctx.fillRect(px + TS * 0.2, py + TS * 0.12, TS * 0.6, TS * 0.42);
        const kind = Math.floor(hash(x, y, 10) * 3);
        ctx.fillStyle = ['#1c3a7a', '#2a5a5a', '#5a2a3a'][kind]; ctx.fillRect(px + TS * 0.25, py + TS * 0.17, TS * 0.5, TS * 0.32);
        ctx.fillStyle = '#f4f1e6'; ctx.beginPath(); ctx.arc(px + TS * 0.62, py + TS * 0.28, TS * 0.06, 0, 7); ctx.fill();
      }
    }
  }
}

function drawStatue(px, py, tone = '#e9e6dc') {
  const s = TS;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(px + s / 2, py + s * 0.88, s * 0.36, s * 0.12, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#b8b2a0'; ctx.fillRect(px + s * 0.18, py + s * 0.68, s * 0.64, s * 0.2);
  ctx.fillStyle = tone; ctx.beginPath(); ctx.moveTo(px + s * 0.28, py + s * 0.7); ctx.quadraticCurveTo(px + s * 0.5, py + s * 0.3, px + s * 0.72, py + s * 0.7); ctx.fill();
  ctx.beginPath(); ctx.arc(px + s / 2, py + s * 0.28, s * 0.14, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.stroke();
}
function drawCase(px, py, x, y, ch) {
  const s = TS;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(px + 3, py + s * 0.8, s - 4, s * 0.14);
  ctx.fillStyle = ch.trim; ctx.fillRect(px + 2, py + s * 0.12, s - 4, s * 0.72);
  ctx.fillStyle = '#0d1432'; ctx.fillRect(px + 5, py + s * 0.18, s - 10, s * 0.55);
  const kind = Math.floor(hash(x, y, 20) * 3);
  ctx.strokeStyle = '#f4e5b0'; ctx.fillStyle = '#f4e5b0'; ctx.lineWidth = 1.2;
  const cx = px + s / 2, cy = py + s * 0.46;
  if (kind === 0) { // 星座
    const pts = [[-0.22, -0.1], [-0.05, 0.08], [0.1, -0.12], [0.24, 0.06]];
    ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(cx + a * s, cy + b * s) : ctx.moveTo(cx + a * s, cy + b * s))); ctx.stroke();
    pts.forEach(([a, b]) => { ctx.beginPath(); ctx.arc(cx + a * s, cy + b * s, 2, 0, 7); ctx.fill(); });
  } else if (kind === 1) { // 鳥
    ctx.beginPath(); ctx.moveTo(cx - s * 0.2, cy); ctx.quadraticCurveTo(cx - s * 0.08, cy - s * 0.18, cx, cy); ctx.quadraticCurveTo(cx + s * 0.08, cy - s * 0.18, cx + s * 0.2, cy); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy + s * 0.04, 2.5, 0, 7); ctx.fill();
  } else { // 時計
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.17, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - s * 0.12); ctx.moveTo(cx, cy); ctx.lineTo(cx + s * 0.08, cy + s * 0.02); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(160,200,255,0.18)'; ctx.fillRect(px + 5, py + s * 0.18, s - 10, s * 0.2);
}
function drawGlass(px, py) {
  ctx.fillStyle = 'rgba(150,200,240,0.22)'; ctx.fillRect(px, py, TS, TS);
  ctx.strokeStyle = 'rgba(210,235,255,0.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(px + 1, py + 1, TS - 2, TS - 2);
  ctx.beginPath(); ctx.moveTo(px + TS * 0.2, py + TS * 0.8); ctx.lineTo(px + TS * 0.55, py + TS * 0.15); ctx.stroke();
}
function drawPlant(px, py, x, y) {
  const s = TS;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(px + s / 2, py + s * 0.88, s * 0.4, s * 0.1, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#7a4a2a'; ctx.fillRect(px + s * 0.3, py + s * 0.62, s * 0.4, s * 0.26);
  for (let i = 0; i < 6; i++) {
    const a = hash(x, y, 30 + i) * 6.28, r = s * (0.18 + hash(x, y, 40 + i) * 0.12);
    ctx.fillStyle = ['#2f8f5a', '#3fae6f', '#256f48'][i % 3];
    ctx.beginPath(); ctx.arc(px + s / 2 + Math.cos(a) * r, py + s * 0.42 + Math.sin(a) * r * 0.7, s * 0.2, 0, 7); ctx.fill();
  }
}
function drawMirror(px, py, t) {
  const g = ctx.createLinearGradient(px, py, px + TS, py + TS);
  g.addColorStop(0, '#c8d6f0'); g.addColorStop(0.5, '#6f86b8'); g.addColorStop(1, '#d8e4fa');
  ctx.fillStyle = '#c9a24a'; ctx.fillRect(px, py, TS + 0.5, TS + 0.5);
  ctx.fillStyle = g; ctx.fillRect(px + 3, py + 3, TS - 6, TS - 6);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.moveTo(px + TS * 0.25, py + TS * 0.9); ctx.lineTo(px + TS * 0.7, py + TS * 0.1); ctx.stroke();
}
function drawBook(px, py) {
  ctx.fillStyle = '#4a2f1d'; ctx.fillRect(px, py, TS, TS);
  for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) {
    ctx.fillStyle = ['#7a2a3a', '#2a4a7a', '#c9a24a', '#2a6a4a'][(i + r) % 4];
    ctx.fillRect(px + 2 + i * (TS / 6), py + 3 + r * (TS / 3), TS / 6 - 2, TS / 3 - 4);
  }
  ctx.strokeStyle = '#f4e5b0aa'; ctx.setLineDash([3, 3]); ctx.strokeRect(px + 1, py + 1, TS - 2, TS - 2); ctx.setLineDash([]);
}
function drawPedestal(px, py, real, t) {
  ctx.fillStyle = '#b8b2a0'; ctx.fillRect(px + TS * 0.2, py + TS * 0.5, TS * 0.6, TS * 0.38);
  ctx.fillStyle = '#d8d2c0'; ctx.fillRect(px + TS * 0.15, py + TS * 0.44, TS * 0.7, TS * 0.1);
  void real; void t;
}

function drawExit(px, py, open, t) {
  const s = TS;
  ctx.fillStyle = open ? '#2a5cc0' : '#1a2a5a'; ctx.fillRect(px + 3, py + 3, s - 6, s - 6);
  ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 2; ctx.strokeRect(px + 3, py + 3, s - 6, s - 6);
  ctx.fillStyle = open ? '#fff6c9' : '#c9a24a'; ctx.beginPath(); ctx.arc(px + s * 0.74, py + s * 0.52, 2.5, 0, 7); ctx.fill();
  if (open) { const g = ctx.createRadialGradient(px + s / 2, py + s / 2, 2, px + s / 2, py + s / 2, s * (1 + Math.sin(t * 4) * 0.1)); g.addColorStop(0, 'rgba(160,200,255,0.6)'); g.addColorStop(1, 'rgba(160,200,255,0)'); ctx.fillStyle = g; ctx.fillRect(px - s, py - s, s * 3, s * 3); }
  else { ctx.strokeStyle = '#c9a24a'; ctx.beginPath(); ctx.moveTo(px + s * 0.3, py + s * 0.35); ctx.lineTo(px + s * 0.7, py + s * 0.65); ctx.moveTo(px + s * 0.7, py + s * 0.35); ctx.lineTo(px + s * 0.3, py + s * 0.65); ctx.stroke(); }
}

function drawItem(it, t) {
  if (it.got) return;
  const cx = wx(it.x + 0.5), cy = wy(it.y + 0.5), pulse = 1 + Math.sin(t * 4 + it.x) * 0.12;
  if (it.kind === 'key') {
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, TS * 0.9 * pulse);
    g.addColorStop(0, 'rgba(255,250,220,0.95)'); g.addColorStop(0.4, 'rgba(255,230,150,0.35)'); g.addColorStop(1, 'rgba(255,230,150,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - TS, cy - TS, TS * 2, TS * 2);
    ctx.fillStyle = '#fffbe8'; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const r = (i % 2 ? 0.12 : 0.3) * TS * pulse, a = (i / 8) * 6.28 - 1.57; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(255,215,120,0.28)'; ctx.beginPath(); ctx.arc(cx, cy, TS * 0.32 * pulse, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8c15a'; ctx.beginPath(); ctx.moveTo(cx, cy - TS * 0.17); ctx.lineTo(cx + TS * 0.13, cy); ctx.lineTo(cx, cy + TS * 0.17); ctx.lineTo(cx - TS * 0.13, cy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff3c0'; ctx.stroke();
  }
}

function drawTrail(room, t) {
  if (!(roomIdxIs(0) || room.pedestals)) return;
  const trail = L.hintTrail(room, phase);
  trail.forEach(([x, y], i) => {
    if (i % 2) return;
    const a = 0.45 + 0.5 * Math.max(0, Math.sin(t * 3 - i * 0.5));
    ctx.fillStyle = `rgba(255,236,160,${a})`;
    const px = wx(x + 0.5) + (i % 4 ? 4 : -4), py = wy(y + 0.5);
    ctx.beginPath(); ctx.ellipse(px, py, 6, 9, 0.4, 0, 7); ctx.fill();
  });
}
const roomIdxIs = (n) => roomIdx === n;

function coneRays(g, ms, room) {
  const pts = [[g.x, g.y]];
  const base = Math.atan2(g.fy, g.fx), N = 36;
  for (let i = 0; i <= N; i++) {
    const a = base - CFG.viewHalf + (i / N) * CFG.viewHalf * 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    let d = 0.2;
    for (; d < CFG.viewDist; d += 0.1) if (L.blockedSight(room, Math.floor(g.x + dx * d), Math.floor(g.y + dy * d), ms)) break;
    pts.push([g.x + dx * d, g.y + dy * d]);
  }
  return pts;
}

function drawGuard(g, t) {
  const cx = wx(g.x), cy = wy(g.y), s = TS;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.28, s * 0.26, s * 0.1, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#6a2230'; ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.05, s * 0.24, s * 0.28, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8c9a0'; ctx.beginPath(); ctx.arc(cx, cy - s * 0.2, s * 0.14, 0, 7); ctx.fill();
  ctx.fillStyle = '#16204a'; ctx.beginPath(); ctx.ellipse(cx, cy - s * 0.3, s * 0.18, s * 0.1, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(cx - s * 0.2, cy - s * 0.31, s * 0.4, s * 0.05);
  ctx.fillStyle = '#e8c15a'; ctx.fillRect(cx - 2, cy - s * 0.38, 4, 4);
  // ランタン
  const lx = cx + g.fx * s * 0.34, ly = cy + g.fy * s * 0.34 + s * 0.05;
  const gl = ctx.createRadialGradient(lx, ly, 1, lx, ly, s * 0.5); gl.addColorStop(0, 'rgba(255,200,110,0.9)'); gl.addColorStop(1, 'rgba(255,170,60,0)');
  ctx.fillStyle = gl; ctx.fillRect(lx - s, ly - s, s * 2, s * 2);
  ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.arc(lx, ly, s * 0.07, 0, 7); ctx.fill();
  // 警戒アイコン
  const chase = g.mode === 'chase', sus = g.mode === 'investigate' || g.mode === 'search';
  if (chase || sus) {
    ctx.font = `700 ${Math.round(s * 0.6)}px sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3;
    ctx.strokeStyle = '#0b1236'; ctx.fillStyle = chase ? '#ff5468' : '#ffd25a';
    const txt = chase ? '!' : '?', yy = cy - s * 0.55 - (reduceMotion() ? 0 : Math.abs(Math.sin(t * 8)) * 3);
    ctx.strokeText(txt, cx, yy); ctx.fillText(txt, cx, yy);
  }
}

function drawPlayer(t) {
  const p = run.p, cx = wx(p.x), cy = wy(p.y), s = TS;
  const moving = Math.hypot(p.vx, p.vy) > 0.3, bob = moving && !reduceMotion() ? Math.sin(t * 14) * 1.5 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.3, s * 0.28, s * 0.1, 0, 0, 7); ctx.fill();
  // マント
  ctx.fillStyle = '#0a0d1f'; ctx.beginPath(); ctx.moveTo(cx - s * 0.3, cy + s * 0.3 + bob); ctx.quadraticCurveTo(cx - s * 0.3, cy - s * 0.15 + bob, cx, cy - s * 0.12 + bob); ctx.quadraticCurveTo(cx + s * 0.3, cy - s * 0.15 + bob, cx + s * 0.3, cy + s * 0.3 + bob); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3a4a8a'; ctx.lineWidth = 1.5; ctx.stroke();
  // 頭
  ctx.fillStyle = '#0a0d1f'; ctx.beginPath(); ctx.arc(cx, cy - s * 0.22 + bob, s * 0.17, 0, 7); ctx.fill();
  ctx.fillStyle = '#f2d6b0'; ctx.beginPath(); ctx.ellipse(cx + p.fx * 2, cy - s * 0.21 + bob, s * 0.1, s * 0.07, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#0a0d1f'; ctx.fillRect(cx + p.fx * 2 - 4, cy - s * 0.23 + bob, 2, 2); ctx.fillRect(cx + p.fx * 2 + 2, cy - s * 0.23 + bob, 2, 2);
  // 赤いスカーフ
  ctx.fillStyle = '#e0364a'; ctx.fillRect(cx - s * 0.16, cy - s * 0.1 + bob, s * 0.32, s * 0.07);
  const sw = reduceMotion() ? 0 : Math.sin(t * 9) * 3;
  ctx.beginPath(); ctx.moveTo(cx - s * 0.12, cy - s * 0.06 + bob); ctx.lineTo(cx - s * 0.38 - p.vx * 3, cy + s * 0.04 + sw + bob - p.vy * 3); ctx.lineTo(cx - s * 0.1, cy - s * 0.01 + bob); ctx.fill();
  // 警戒リング
  if (run.gauge > 0.02) {
    ctx.strokeStyle = run.gauge > 0.7 ? '#ff5468' : '#ffd25a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy - s * 0.02, s * 0.46, -1.57, -1.57 + run.gauge * 6.28); ctx.stroke();
  }
}

function drawLights(room, t) {
  for (const l of room.lights || []) {
    const lp = L.lightPos(l, run.t), x = wx(lp.x), y = wy(lp.y), r = l.r * TS;
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.15);
    g.addColorStop(0, 'rgba(255,255,245,0.55)'); g.addColorStop(0.75, 'rgba(235,240,255,0.3)'); g.addColorStop(1, 'rgba(235,240,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.2, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
  }
}

let dark = null, dctx = null;
function drawDarkness(room) {
  if (!dark || dark.width !== cv.width || dark.height !== cv.height) { dark = document.createElement('canvas'); dark.width = cv.width; dark.height = cv.height; dctx = dark.getContext('2d'); }
  dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.globalCompositeOperation = 'source-over'; dctx.clearRect(0, 0, dark.width, dark.height);
  dctx.fillStyle = 'rgba(2,4,20,0.72)'; dctx.fillRect(0, 0, dark.width, dark.height);
  dctx.setTransform(DPR, 0, 0, DPR, 0, 0); dctx.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a) => { const g = dctx.createRadialGradient(x, y, r * 0.1, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); dctx.fillStyle = g; dctx.beginPath(); dctx.arc(x, y, r, 0, 7); dctx.fill(); };
  hole(wx(run.p.x), wy(run.p.y), TS * 3.2, 0.95);
  for (const g of run.guards) hole(wx(g.x), wy(g.y), TS * 2.5, 0.9);
  for (const l of room.lights || []) { const lp = L.lightPos(l, run.t); hole(wx(lp.x), wy(lp.y), l.r * TS * 2.2, 1); }
  for (const it of run.items) if (!it.got) hole(wx(it.x + 0.5), wy(it.y + 0.5), TS * 1.6, 0.8);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(dark, 0, 0); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

function render(t) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#070b22'; ctx.fillRect(0, 0, W, H);
  if (!run) { drawBackdrop(t); return; }
  const room = run.room, ch = CHAPTERS[roomChapter(roomIdx)];
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 6 * shake * 4, (Math.random() - 0.5) * 6 * shake * 4);
  const ms = new Set(L.moverCells(room, run.t).map(([x, y]) => `${x},${y}`));
  drawFloor(room, ch, t);
  // 窓から差す月光の筋
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const bx = wx(room.rows[0].length * (0.2 + i * 0.3)), by = wy(1);
    const g = ctx.createLinearGradient(bx, by, bx + TS * 3, by + TS * 7);
    g.addColorStop(0, 'rgba(190,210,255,0.10)'); g.addColorStop(1, 'rgba(190,210,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + TS * 1.4, by); ctx.lineTo(bx + TS * 5, by + TS * 7); ctx.lineTo(bx + TS * 2.6, by + TS * 7); ctx.fill();
  }
  ctx.restore();
  drawTrail(room, t);
  // 出口・台座
  const info = L.roomInfo(room);
  if (info.exit) drawExit(wx(info.exit[0]), wy(info.exit[1]), run.exitOpen, t);
  for (const [fx, fy] of info.fakes) drawPedestal(wx(fx), wy(fy), false, t);
  for (const it of run.items) drawItem(it, t);
  // 視界の扇
  if (save.opt.showView) for (const g of run.guards) {
    const pts = coneRays(g, ms, room);
    const chase = g.mode === 'chase';
    const grad = ctx.createRadialGradient(wx(g.x), wy(g.y), 4, wx(g.x), wy(g.y), CFG.viewDist * TS);
    grad.addColorStop(0, chase ? 'rgba(255,90,100,0.5)' : 'rgba(255,225,150,0.42)'); grad.addColorStop(1, chase ? 'rgba(255,90,100,0.08)' : 'rgba(255,225,150,0.06)');
    ctx.fillStyle = grad; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(wx(x), wy(y)) : ctx.moveTo(wx(x), wy(y)))); ctx.closePath(); ctx.fill();
  }
  // 音の輪・おとり
  for (const n of run.noise) { ctx.strokeStyle = `rgba(200,225,255,${0.5 * (1 - n.t / 0.8)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(wx(n.x), wy(n.y), n.r * TS * Math.min(1, n.t / 0.5), 0, 7); ctx.stroke(); }
  if (run.decoyObj) { ctx.fillStyle = '#d8d2c0'; ctx.beginPath(); ctx.arc(wx(run.decoyObj.x), wy(run.decoyObj.y), 4, 0, 7); ctx.fill(); }
  // 遮蔽物（y順に描く）
  const things = [];
  const rows = room.rows;
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[0].length; x++) {
    const c = rows[y][x];
    if ('PCGpMD'.includes(c)) things.push({ y, x, c });
  }
  for (const [x, y] of L.moverCells(room, run.t)) things.push({ y, x, c: room.movers.some((m) => m.planet) ? 'Q' : 'R' });
  things.sort((a, b) => a.y - b.y);
  drawWalls(room, ch);
  // 次の位置の予告
  for (const m of room.movers || []) {
    const idx = Math.floor(run.t / m.period) % m.positions.length, left = m.period - (run.t % m.period);
    if (left < 1.5 && !m.planet) { ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; m.positions[(idx + 1) % m.positions.length].forEach(([x, y]) => ctx.strokeRect(wx(x) + 3, wy(y) + 3, TS - 6, TS - 6)); ctx.setLineDash([]); }
    if (m.planet && left < 1.2 && idx === 0) { ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; m.positions[1].forEach(([x, y]) => ctx.strokeRect(wx(x) + 3, wy(y) + 3, TS - 6, TS - 6)); ctx.setLineDash([]); }
  }
  const guardsSorted = [...run.guards];
  let gi = 0, drewPlayer = false;
  for (const th of things) {
    while (!drewPlayer && run.p.y < th.y + 0.5) { drawPlayer(t); drewPlayer = true; }
    while (gi < guardsSorted.length && guardsSorted[gi].y < th.y + 0.5) drawGuard(guardsSorted[gi++], t);
    const px = wx(th.x), py = wy(th.y);
    if (th.c === 'P') drawStatue(px, py);
    else if (th.c === 'R') drawStatue(px, py, '#e6c79a');
    else if (th.c === 'C') drawCase(px, py, th.x, th.y, ch);
    else if (th.c === 'G') drawGlass(px, py);
    else if (th.c === 'p') drawPlant(px, py, th.x, th.y);
    else if (th.c === 'M') drawMirror(px, py, t);
    else if (th.c === 'D') drawBook(px, py);
    else if (th.c === 'Q') { /* 惑星は下でまとめて描く */ }
  }
  if (!drewPlayer) drawPlayer(t);
  while (gi < guardsSorted.length) drawGuard(guardsSorted[gi++], t);
  // 惑星
  if (room.movers) for (const m of room.movers) if (m.planet) {
    const cells = L.moverCells(room, run.t).filter(() => true).slice(0, 2);
    if (cells.length) { const cx = wx(cells[0][0] + 0.5), cy = wy((cells[0][1] + cells[1][1]) / 2 + 1), r = TS * 0.95; drawPlanet(cx, cy, r, t); }
  }
  drawLights(room, t);
  if (room.dark) drawDarkness(room);
  // 暗転・閃光・ビネット
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,10,0)'); vg.addColorStop(1, 'rgba(0,0,10,0.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (run.gauge > 0.55 && !reduceMotion()) { ctx.fillStyle = `rgba(200,30,50,${(run.gauge - 0.5) * 0.18 + Math.sin(t * 6) * 0.03})`; ctx.fillRect(0, 0, W, H); }
  if (flash > 0) { ctx.fillStyle = `rgba(255,252,235,${Math.min(0.8, flash) * (reduceMotion() ? 0.3 : 1)})`; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,10,${Math.min(1, fade)})`; ctx.fillRect(0, 0, W, H); }
  // 初回の手引き
  if (roomIdx === 0 && !save.rooms[0] && mode === 'play' && !paused) {
    ctx.font = '700 16px "Hiragino Mincho ProN",serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#0b1236'; ctx.fillStyle = '#f4e5b0';
    const msg = '視線を避けて光を取ろう', yy = H - (isTouchUI() && W < 700 ? 205 : 36);
    ctx.strokeText(msg, W / 2, yy); ctx.fillText(msg, W / 2, yy);
  }
}
function drawPlanet(cx, cy, r, t) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#9fe0b8'); g.addColorStop(0.6, '#2f8f78'); g.addColorStop(1, '#13483f');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#d9914a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.35, r * 0.35, -0.3, 0, 7); ctx.stroke();
}
function drawBackdrop(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b2756'); g.addColorStop(1, '#070b22'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const mx = W * 0.72, my = H * 0.28, mr = Math.min(W, H) * 0.14;
  const mg = ctx.createRadialGradient(mx, my, mr * 0.2, mx, my, mr * 3); mg.addColorStop(0, 'rgba(255,250,230,0.5)'); mg.addColorStop(1, 'rgba(255,250,230,0)'); ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f4f1e6'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
  ctx.fillStyle = '#1b2756'; ctx.beginPath(); ctx.arc(mx + mr * 0.45, my - mr * 0.1, mr * 0.9, 0, 7); ctx.fill();
  for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(224,190,100,${0.2 + hash(i, 1) * 0.5})`; ctx.fillRect(hash(i, 2) * W, hash(i, 3) * H * 0.6, 2, 2); }
  ctx.fillStyle = '#0a0d1f'; for (let i = 0; i < 12; i++) { const bw = W / 10, bh = 30 + hash(i, 9) * 70; ctx.fillRect(i * bw - 10, H * 0.78 - bh, bw - 4, bh + H); }
  void t;
}

// ---------- ループ ----------
function frame(ts) {
  const t = ts / 1000, dt = Math.min(0.05, lastT ? t - lastT : 0.016); lastT = t;
  if (mode === 'play' && !paused && run) {
    if (run.status === 'play') {
      const inp = readInput();
      L.step(run, inp, dt);
      handleEvents();
      // 足音・心拍・BGM
      if (ac && save.opt.volume > 0) {
        stepT -= dt;
        if (run.lastAction === 'walk' && stepT <= 0) { sfx.step(); stepT = 0.32; }
        if (run.lastAction === 'sneak' && stepT <= 0) { tone(90, 0.04, 'triangle', 0.04); stepT = 0.5; }
        if (run.lastAction === 'dash' && stepT <= 0) { sfx.step(); stepT = 0.18; }
        beatT -= dt;
        if (run.gauge > 0.5 && beatT <= 0) { sfx.beat(); beatT = 0.9 - run.gauge * 0.4; }
        const chase = L.anyChase(run);
        if (bgm) bgm.o2.frequency.value = chase ? 98 : 82.4;
        if (wasChase && !chase && run.gauge < 0.5) sfx.relief();
        wasChase = chase;
      }
    } else if (run.status === 'caught') {
      L.step(run, {}, dt);
      fade = Math.min(1, run.caughtT / 0.5);
      if (run.caughtT > 1.0) { handleEvents(); newRun(); toast('つかまった！ 入口からやり直し', 1800); }
    }
    handleEvents();
    updateCamera(dt, false);
    $('gaugeFill').style.width = `${Math.round(run.gauge * 100)}%`;
  } else if (run && mode === 'clearing') {
    updateCamera(dt, false);
  }
  if (flash > 0) flash -= dt * 1.2;
  if (shake > 0) shake -= dt;
  render(t);
  requestAnimationFrame(frame);
}
let wasChase = false;

// ---------- 起動 ----------
resize();
$('bMute').textContent = save.opt.volume > 0 ? '♪' : '×';
if (OG) {
  run = null;
  roomIdx = 0; phase = 0; newRun();
  for (let i = 0; i < 70; i++) L.step(run, { dx: 0, dy: 0, sneak: false }, 0.05);
  run.p.x = 1.5; run.p.y = 8.5;
  mode = 'og';
  $('hChap').textContent = '第1章 1/5'; $('hRoom').textContent = ROOMS[0].name; $('hud').hidden = false;
  updateCamera(0, true);
  screenEl.className = 'screen';
} else if (params.has('room')) {
  const ri = Math.max(0, Math.min(14, +params.get('room') - 1));
  startRoom(ri, params.has('phase') ? +params.get('phase') : 0);
  if (params.get('state')) window.__heist = { run: () => run };
  updateCamera(0, true);
} else {
  titleScreen();
}
window.__heist = { run: () => run, L, mode: () => mode };
if (run) updateCamera(0, true);
requestAnimationFrame(frame);
