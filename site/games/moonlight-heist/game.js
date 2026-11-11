import * as L from './logic.js';
import { STORY, INTRO, EPILOGUE } from './rooms.js';
import { drawMemory, drawTitleArt } from './art.js';

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
  radio: () => { tone(1400, 0.04, 'square', 0.05); tone(1800, 0.05, 'square', 0.04, null, 0.06); },
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
  if (typeof radioClear === 'function' && name !== 'pause' && name !== 'options') radioClear();
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
  mode = 'title'; run = null;
  const started = Object.keys(save.rooms).length > 0;
  show('title', `<div class="ttl">
    <div class="ttl-head"><p class="ttl-sub">夜を預かる月の館</p>
    <h2 class="logo"><span>月光美術館と</span>十二の怪盗</h2></div>
    <div class="ttl-foot"><p class="ttl-lead">夜守に見つからず「夜のかけら」を集めきれば、<br>怪盗ルウは自由になれる。</p>
    <nav class="menu">
      <button class="pri" data-a="${started ? 'continue' : 'new'}">${started ? `つづきから　第${firstUnplayed() + 1}室` : 'はじめる'}</button>
      <button data-a="rooms">室えらび</button>
      <button data-a="album">アルバム　<small>${total()}/45・記憶 ${L.memoriesUnlocked(save).filter(Boolean).length}/6</small></button>
      <button data-a="options">せってい</button>
    </nav>
    <p class="who fox-l tl">${FOX}<span><b>無線 ― キツネ</b>案内は俺に任せろ。足跡はこっちで照らす。</span></p>
    <p class="ttl-keys">${isTouchUI() ? '左下のパッドで移動　右下のボタンで忍び足・おとり' : 'WASD/矢印：移動　Shift：忍び足　Space：おとり'}</p>
    <p class="ttl-keys"><a href="/">Game Arcade</a></p></div></div>`, 'title');
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
  const mu = L.memoriesUnlocked(save);
  let h = `<div class="card"><h2>アルバム ${total()}/45</h2>`;
  h += `<div class="chap">ルウの記憶 ${mu.filter(Boolean).length}/${mu.length}</div><div class="alb mems">`;
  L.MEMORIES.forEach((m, i) => {
    h += mu[i] ? `<button data-a="mem" data-i="${i}"><canvas class="thumb" data-m="${i}" width="240" height="150"></canvas><b>${i + 1}. ${m.title}</b></button>` : `<div class="no"><span class="thumb lock">☾</span><b>${i + 1}. ？？？</b>第${m.room + 1}室のかけらで戻る</div>`;
  });
  h += `</div><div class="chap">夜のかけらと展示品</div><p class="sub">集めるほど結末が変わる。</p><div class="alb">`;
  ROOMS.forEach((room, ri) => {
    const s = save.rooms[ri];
    room.items.forEach((it, k) => {
      const have = s && (k === 0 || (s.opts || []).includes(k));
      h += `<div class="${have ? '' : 'no'}"><b>${have ? it[0] : '？？？'}</b>${have ? it[1] : `第${ri + 1}室の${k === 0 ? 'かけら' : '展示品'}`}</div>`;
    });
  });
  show('album', h + '</div><button data-a="title">もどる</button></div>');
  screenEl.querySelectorAll('canvas.thumb').forEach((c) => drawMemory(c.getContext('2d'), +c.dataset.m, c.width, c.height, 1));
}
function optionsScreen(back = 'title') {
  const o = save.opt;
  show('options', `<div class="card opt"><h2>せってい</h2>
    <label>音量<input id="oVol" type="range" min="0" max="1" step="0.1" value="${o.volume}" aria-label="音量"></label>
    <label>ゆっくりモード（夜守 0.8倍）<input id="oSlow" type="checkbox" ${o.slow ? 'checked' : ''}></label>
    <label>視界の扇を表示<input id="oView" type="checkbox" ${o.showView ? 'checked' : ''}></label>
    <label>動きを抑える<input id="oRed" type="checkbox" ${o.reduceMotion ? 'checked' : ''}></label>
    <button data-a="${back}">もどる</button>
    <button data-a="reset" style="opacity:.7">記録を消す</button></div>`);
  $('oVol').oninput = (e) => { save.opt.volume = +e.target.value; setVolume(); persist(); };
  $('oSlow').onchange = (e) => { save.opt.slow = e.target.checked; persist(); };
  $('oView').onchange = (e) => { save.opt.showView = e.target.checked; persist(); };
  $('oRed').onchange = (e) => { save.opt.reduceMotion = e.target.checked; persist(); };
}
function storyLine(l) {
  if (l.startsWith('キツネ「')) return `<p class="who fox-l">${FOX}<span><b>キツネ</b>${l.slice(3)}</span></p>`;
  if (l.startsWith('頭領「')) return `<p class="who boss-l">${CROW}<span><b>頭領</b>${l.slice(2)}</span></p>`;
  return `<p>${l}</p>`;
}
function memoryScreen(mi, next) {
  const m = L.MEMORIES[mi];
  show('memory', `<div class="card memcard"><p class="memk">ルウの記憶 ${mi + 1}/${L.MEMORIES.length}</p><h2>${m.title}</h2>
    <canvas id="memArt" width="640" height="400" aria-label="記憶の一枚絵"></canvas>
    <div class="lines">${m.lines.map((l, i) => storyLine(l).replace('<p', `<p style="animation-delay:${0.6 + i * 0.5}s"`)).join('')}</div>
    <button class="pri" data-a="next">つづける</button></div>`, 'mem');
  memShown = mi; storyNext = next;
  clearTimeout(toastTimer); $('toast').classList.remove('on');
}
let memShown = -1;
function memoryArtTick(t) {
  if (screenName !== 'memory') return;
  const c = $('memArt'); if (!c) return;
  drawMemory(c.getContext('2d'), memShown, c.width, c.height, reduceMotion() ? 1 : t);
}
function storyScreen(lines, next, title = '', cls = '') {
  show('story', `<div class="card"><h2>${title}</h2><div class="lines">${lines.map((l, i) => storyLine(l).replace('<p', `<p style="animation-delay:${i * 0.5}s"`)).join('')}</div><button class="pri" data-a="next">つづける</button></div>`, cls);
  storyNext = next;
}
let storyNext = null;

function resultScreen() {
  const room = ROOMS[roomIdx], s = save.rooms[roomIdx];
  const got = run.items.filter((i) => i.kind === 'opt' && i.got).length;
  const last = roomIdx === 14;
  show('result', `<div class="card"><p class="sub">${room.name}</p><h2>クリア</h2>
    <div class="rk"><span>${L.rankOf(room, run)}</span></div>
    <div class="stat"><span><b>${fmt(run.time)}</b>タイム</span><span><b>${run.alerts}</b>見つかった</span><span><b>${got}/2</b>展示品</span></div>
    <p class="sub">自己ベスト ${fmt(s.time)}　最高ランク ${s.rank}</p>
    ${L.memoryIndex(roomIdx) >= 0 ? `<p class="memgot">☾ ルウの記憶 ${L.memoryIndex(roomIdx) + 1}/6「${L.MEMORIES[L.memoryIndex(roomIdx)].title}」が戻った</p>` : ''}
    ${got < 2 ? '<p class="sub">まだ取っていない展示品がある。もう一度忍び込んでみる？</p>' : ''}
    <button class="pri" data-a="${last ? 'ending' : 'nextroom'}">${last ? '結末へ' : '次の室へ'}</button>
    <div class="row2"><button data-a="retry">もう一度</button><button data-a="rooms">室えらび</button></div></div>`, 'clear');
}
function endingScreen() {
  const e = L.endingFor(save);
  storyScreen([...e.lines, ...EPILOGUE], () => { titleScreen(); }, `結末「${e.title}」<br><small style="font-size:13px;color:#a9b8e8">集めた展示品 ${total()}/45</small>`);
}
function pauseScreen() {
  paused = true;
  show('pause', `<div class="card"><h2>ポーズ</h2><button class="pri" data-a="resume">再開</button><button data-a="restart">この室をやり直す</button><button data-a="options-p">せってい</button><button data-a="rooms">室えらび</button><button data-a="title">タイトルへ</button></div>`);
}

screenEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  audio();
  const a = b.dataset.a;
  if (a === 'new') storyScreen(INTRO, () => startRoom(0), '序章　最後の仕事');
  else if (a === 'continue') startRoom(firstUnplayed());
  else if (a === 'rooms') { paused = false; roomsScreen(); }
  else if (a === 'album') albumScreen();
  else if (a === 'mem') memoryScreen(+b.dataset.i, albumScreen);
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
  $('hChap').textContent = W < 480 ? `☾ ${c.sub}　${ri - c.rooms[0] + 1}/5` : `☾ ${c.sub}・${c.name}　${ri - c.rooms[0] + 1}/5`;
  $('hRoom').textContent = ROOMS[ri].name;
  hideScreen();
  tutorialT = 0;
  const flavor = c.flavor[phase];
  void flavor;
  radioClear(); tutDone = new Set(save.rooms[0] ? ['opt'] : []);
  tutorialOn = ri === 0 && !save.rooms[0];
  if (!tutorialOn) radio(ROOMS[ri].hint);
}
let tutorialOn = false;
function newRun() {
  run = L.createRun(ROOMS[roomIdx], phase, { slow: save.opt.slow });
  initMotes(run.room); sparks = [];
  fade = 0; flash = 0;
  updateHud();
}
function updateHud() {
  $('hItems').textContent = `${total() + (run ? run.items.filter((i) => i.got && !(save.rooms[roomIdx]?.opts || []).includes(i.idx) && !(i.kind === 'key' && save.rooms[roomIdx])).length : 0)}/45`;
  $('hDecoy').innerHTML = run ? `<i>おとり</i>${'<em class="st"></em>'.repeat(run.decoys)}${'<em class="st off"></em>'.repeat(CFG.decoyCount - run.decoys)}` : '';
  if (run) $('collectFill').style.height = `${(run.items.filter((i) => i.got).length / run.items.length) * 100}%`;
}
let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms);
}

// ---------- 無線（キツネ） ----------
const FOX = `<svg class="fox" viewBox="0 0 40 40" aria-hidden="true"><path d="M5 4l9 9h12l9-9 1 15c0 9-7 17-16 17S4 28 4 19z" fill="#f4ecdc"/><path d="M5 4l9 9-7 4zM35 4l-9 9 7 4z" fill="#d6414f"/><path d="M9 21c3-3 7-3 9 0-3 2-6 2-9 0zM31 21c-3-3-7-3-9 0 3 2 6 2 9 0z" fill="#16204a"/><path d="M13 27h14l-7 6z" fill="#d6414f"/><circle cx="20" cy="30" r="1.6" fill="#16204a"/><path d="M17 15l3 4 3-4" stroke="#c9a24a" stroke-width="1.5" fill="none"/></svg>`;
document.querySelector('#radio .radio-face').innerHTML = FOX;
const CROW = `<svg class="fox" viewBox="0 0 40 40" aria-hidden="true"><path d="M4 16c4-9 28-9 32 0l-4 8-12 12L8 24z" fill="#1a1020"/><path d="M8 18c4-3 8-3 10 0-3 3-7 3-10 0zM32 18c-4-3-8-3-10 0 3 3 7 3 10 0z" fill="#d6414f"/><path d="M16 22h8l-4 12z" fill="#c9a24a"/><path d="M6 12l6 2M34 12l-6 2" stroke="#5a3a6a" stroke-width="2"/></svg>`;
let radioQ = [], radioCur = '', radioT = 0, radioShown = 0, tutDone = new Set();
function radio(text, now = false) {
  text = L.radioText(text, isTouchUI());
  if (now) { radioQ = []; radioCur = ''; }
  if (radioCur) { if (!radioQ.includes(text) && radioCur !== text) radioQ.push(text); return; }
  radioCur = text; radioShown = 0; radioT = Math.min(7, Math.max(3.2, 1.4 + text.length * 0.09));
  $('radioName').textContent = '無線 ― キツネ'; $('radioText').textContent = reduceMotion() ? text : '';
  if (reduceMotion()) radioShown = text.length;
  $('radio').classList.add('on'); document.body.classList.add('radio-on');
  sfx.radio();
}
function radioClear() { radioQ = []; radioCur = ''; $('radio').classList.remove('on'); document.body.classList.remove('radio-on'); }
function radioTick(dt) {
  if (!radioCur) return;
  if (radioShown < radioCur.length) { radioShown = Math.min(radioCur.length, radioShown + dt * 28); $('radioText').textContent = radioCur.slice(0, Math.ceil(radioShown)); return; }
  radioT -= dt;
  if (radioT <= 0) { const n = radioQ.shift(); radioCur = ''; if (n) radio(n); else radioClear(); }
}

function handleEvents() {
  const room = run.room;
  for (const ev of run.events.splice(0)) {
    if (ev === 'key') {
      { const it = run.items.filter((i) => i.kind === 'key' && i.got).pop(); if (it) burst(it.x + 0.5, it.y + 0.5, 40, '255,240,190'); }
      const mi = L.memoryIndex(roomIdx);
      if (mi >= 0 && !(save.mem || []).includes(mi)) {
        save.mem = [...(save.mem || []), mi]; persist();
        paused = true; keys.clear();
        setTimeout(() => memoryScreen(mi, () => { paused = false; hideScreen(); lastT = 0; }), reduceMotion() ? 100 : 500);
      }
      sfx.key(); flash = 0.6; toast(`「${room.items[0][0]}」${room.items[0][1]}`, 3200); updateHud();
      const left = run.items.filter((i) => i.kind === 'key' && !i.got).length;
      if (room.finalAlarm) { /* final イベント側で話す */ }
      else if (left > 0) radio(`かけら確保。あと${left}つだ。`, true);
      else if (roomIdx === 0) radio('いいぞ、かけらだ！ 出口の扉が青く光った。来た道の上、左上の扉へ。', true);
      else radio('かけらはそろった。出口が青く光ってる。抜けろ。', true);
    }
    else if (ev === 'opt') {
      const got = run.items.filter((i) => i.kind === 'opt' && i.got);
      const idx = got[got.length - 1].idx; burst(got[got.length - 1].x + 0.5, got[got.length - 1].y + 0.5, 22, '255,215,140'); sfx.opt(); toast(`「${room.items[idx][0]}」${room.items[idx][1]}`, 3200); updateHud();
      if (!tutDone.has('opt')) { tutDone.add('opt'); radio('展示品も拾ったか。頭領の注文じゃないが……集めておけ。何かある気がする。'); }
    }
    else if (ev === 'alert') { sfx.alert(); radio('見つかった！ 走って物陰へ、視線を切れ！', true); shake = reduceMotion() ? 0 : 0.25; }
    else if (ev === 'decoy') { sfx.decoy(); updateHud(); }
    else if (ev === 'fake') { sfx.fake(); radio('そいつはにせものだ。光る足跡の台座が本物だぞ。', true); }
    else if (ev === 'final') { sfx.final(); flash = 1.2; radio('最後のかけらだ！ 館が目を覚ました、出口まで走れ！', true); }
    else if (ev === 'caught') { sfx.caught(); }
    else if (ev === 'clear') { sfx.clear(); onClear(); }
  }
}
function onClear() {
  const first = !save.rooms[roomIdx];
  save = L.recordClear(save, roomIdx, run); persist(); updateHud();
  const room = ROOMS[roomIdx];
  void first;
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
  TS = W < 700 ? Math.max(32, Math.min(48, Math.floor(Math.min(W / 9.5, (H - 260) / 11)))) : Math.max(36, Math.min(56, Math.floor(Math.min(W / 17, (H - 90) / 12))));
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
    ctx.fillStyle = ch.floor[0]; ctx.fillRect(px, py, TS + 0.5, TS + 0.5);
    ctx.globalAlpha = 0.25 + hash(x, y, 11) * 0.35; ctx.fillStyle = ch.floor[1]; ctx.fillRect(px, py, TS + 0.5, TS + 0.5); ctx.globalAlpha = 1;
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
    ctx.fillStyle = 'rgba(8,6,30,0.55)'; ctx.fillRect(px, py, TS + 0.5, TS + 0.5);
    for (let k = 0; k < 3; k++) if (hash(x, y, 20 + k) > 0.45) { ctx.fillStyle = `rgba(230,225,255,${0.25 + hash(x, y, 30 + k) * 0.5})`; ctx.fillRect(px + hash(x, y, 40 + k) * TS, py + hash(x, y, 50 + k) * TS, 1.5, 1.5); }
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
  const sg = ctx.createRadialGradient(px + s / 2, py + s * 0.4, 2, px + s / 2, py + s * 0.4, s * 0.6); sg.addColorStop(0, 'rgba(190,210,255,0.22)'); sg.addColorStop(1, 'rgba(190,210,255,0)'); ctx.fillStyle = sg; ctx.fillRect(px - s * 0.2, py - s * 0.2, s * 1.4, s * 1.4);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(px + s / 2, py + s * 0.88, s * 0.36, s * 0.12, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#8f8aa8'; ctx.fillRect(px + s * 0.2, py + s * 0.72, s * 0.6, s * 0.16);
  ctx.fillStyle = '#c9a24a'; ctx.fillRect(px + s * 0.2, py + s * 0.72, s * 0.6, 1.5);
  // 三日月の光輪
  ctx.strokeStyle = 'rgba(255,236,170,0.85)'; ctx.lineWidth = Math.max(1.5, s * 0.04);
  ctx.beginPath(); ctx.arc(px + s / 2, py + s * 0.28, s * 0.22, Math.PI * 0.85, Math.PI * 2.15); ctx.stroke();
  // 衣のひだ
  ctx.fillStyle = tone; ctx.beginPath(); ctx.moveTo(px + s * 0.26, py + s * 0.73); ctx.quadraticCurveTo(px + s * 0.3, py + s * 0.42, px + s * 0.5, py + s * 0.38); ctx.quadraticCurveTo(px + s * 0.7, py + s * 0.42, px + s * 0.74, py + s * 0.73); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(80,70,120,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px + s * 0.42, py + s * 0.45); ctx.lineTo(px + s * 0.38, py + s * 0.72); ctx.moveTo(px + s * 0.58, py + s * 0.45); ctx.lineTo(px + s * 0.62, py + s * 0.72); ctx.stroke();
  // 眠る顔
  ctx.fillStyle = tone; ctx.beginPath(); ctx.arc(px + s / 2, py + s * 0.28, s * 0.13, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(60,50,100,0.6)'; ctx.beginPath(); ctx.arc(px + s * 0.45, py + s * 0.28, s * 0.03, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.beginPath(); ctx.arc(px + s * 0.55, py + s * 0.28, s * 0.03, 0.2, Math.PI - 0.2); ctx.stroke();
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
    // 三日月のかけら
    ctx.save(); ctx.beginPath(); ctx.rect(cx - TS, cy - TS, TS * 2, TS * 2); ctx.arc(cx + TS * 0.1, cy - TS * 0.06, TS * 0.18 * pulse, 0, 7); ctx.clip('evenodd');
    ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(cx, cy, TS * 0.22 * pulse, 0, 7); ctx.fill(); ctx.restore();
    for (let k = 0; k < 3; k++) { const a = t * 1.6 + k * 2.09, r = TS * 0.42; ctx.fillStyle = 'rgba(255,248,220,0.9)'; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.5, 1.8, 0, 7); ctx.fill(); }
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
    for (; d < (room.view || CFG.viewDist); d += 0.1) if (L.blockedSight(room, Math.floor(g.x + dx * d), Math.floor(g.y + dy * d), ms)) break;
    pts.push([g.x + dx * d, g.y + dy * d]);
  }
  return pts;
}

function drawGuard(g, t) {
  // 夜守（よもり）：仮面をつけた、宙に浮く影の番人
  const s = TS, rm = reduceMotion();
  const hov = rm ? 0 : Math.sin(t * 2.4 + g.x) * s * 0.04;
  const cx = wx(g.x), cy = wy(g.y) + hov;
  const chase = g.mode === 'chase';
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx, wy(g.y) + s * 0.34, s * 0.22, s * 0.07, 0, 0, 7); ctx.fill();
  // ぼんやりした気配
  const au = ctx.createRadialGradient(cx, cy, s * 0.1, cx, cy, s * 0.6);
  au.addColorStop(0, chase ? 'rgba(255,80,110,0.4)' : 'rgba(190,160,255,0.42)'); au.addColorStop(1, 'rgba(120,100,255,0)');
  ctx.fillStyle = au; ctx.fillRect(cx - s, cy - s, s * 2, s * 2);
  // 衣（すそがゆらぐ）
  const body = ctx.createLinearGradient(cx, cy - s * 0.45, cx, cy + s * 0.35);
  body.addColorStop(0, '#4a3a90'); body.addColorStop(1, 'rgba(40,28,90,0.25)');
  ctx.fillStyle = body; ctx.beginPath();
  ctx.moveTo(cx - s * 0.08, cy - s * 0.48);
  ctx.quadraticCurveTo(cx - s * 0.34, cy - s * 0.2, cx - s * 0.3, cy + s * 0.3);
  for (let k = 0; k <= 4; k++) { const xx = cx - s * 0.3 + k * s * 0.15, yy = cy + s * 0.3 + (k % 2 ? -s * 0.08 : 0) + (rm ? 0 : Math.sin(t * 6 + k + g.x) * s * 0.03); ctx.lineTo(xx, yy); }
  ctx.quadraticCurveTo(cx + s * 0.34, cy - s * 0.2, cx + s * 0.08, cy - s * 0.48);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(220,200,255,0.75)'; ctx.lineWidth = 1.5; ctx.stroke();
  // 頭巾の角
  ctx.fillStyle = '#1c1440'; ctx.beginPath(); ctx.moveTo(cx - s * 0.16, cy - s * 0.32); ctx.lineTo(cx - s * 0.22, cy - s * 0.56); ctx.lineTo(cx - s * 0.04, cy - s * 0.4); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + s * 0.16, cy - s * 0.32); ctx.lineTo(cx + s * 0.22, cy - s * 0.56); ctx.lineTo(cx + s * 0.04, cy - s * 0.4); ctx.fill();
  // 月の仮面
  const mx = cx + g.fx * s * 0.05, my = cy - s * 0.22 + g.fy * s * 0.03;
  ctx.fillStyle = '#f2eedf'; ctx.beginPath(); ctx.ellipse(mx, my, s * 0.13, s * 0.15, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = chase ? '#ff5468' : '#16204a'; ctx.lineWidth = Math.max(1.5, s * 0.035); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(mx - s * 0.05, my - s * 0.01, s * 0.035, 0.2, Math.PI - 0.2, chase); ctx.stroke();
  ctx.beginPath(); ctx.arc(mx + s * 0.05, my - s * 0.01, s * 0.035, 0.2, Math.PI - 0.2, chase); ctx.stroke();
  ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.arc(mx, my + s * 0.08, s * 0.018, 0, 7); ctx.fill();
  ctx.lineCap = 'butt';
  // 青い灯のランタン
  const lx = cx + g.fx * s * 0.36, ly = cy + g.fy * s * 0.36 + s * 0.02;
  const gl = ctx.createRadialGradient(lx, ly, 1, lx, ly, s * 0.55); gl.addColorStop(0, chase ? 'rgba(255,150,160,0.9)' : 'rgba(200,220,255,0.9)'); gl.addColorStop(1, 'rgba(140,170,255,0)');
  ctx.fillStyle = gl; ctx.fillRect(lx - s, ly - s, s * 2, s * 2);
  ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 1.2; ctx.strokeRect(lx - s * 0.06, ly - s * 0.08, s * 0.12, s * 0.15);
  ctx.fillStyle = chase ? '#ffd0d6' : '#eef4ff'; ctx.beginPath(); ctx.arc(lx, ly, s * 0.05, 0, 7); ctx.fill();
  // 警戒アイコン
  const sus = g.mode === 'investigate' || g.mode === 'search';
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
// 館の明かり：全体を夜の暗さにして、ルウのまわり・夜守のランタンと視線・かけら・月光だけを照らす
function drawLighting(room, ms, t) {
  if (!dark || dark.width !== cv.width || dark.height !== cv.height) { dark = document.createElement('canvas'); dark.width = cv.width; dark.height = cv.height; dctx = dark.getContext('2d'); }
  dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.globalCompositeOperation = 'source-over'; dctx.clearRect(0, 0, dark.width, dark.height);
  dctx.fillStyle = room.dark ? 'rgba(3,2,16,0.78)' : 'rgba(6,3,24,0.5)'; dctx.fillRect(0, 0, dark.width, dark.height);
  dctx.setTransform(DPR, 0, 0, DPR, 0, 0); dctx.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a) => { const g = dctx.createRadialGradient(x, y, r * 0.1, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); dctx.fillStyle = g; dctx.beginPath(); dctx.arc(x, y, r, 0, 7); dctx.fill(); };
  // 窓からの月光の帯
  if (!room.dark) for (let i = 0; i < 3; i++) {
    const bx = wx(room.rows[0].length * (0.2 + i * 0.3)), by = wy(1);
    const g = dctx.createLinearGradient(bx, by, bx + TS * 3, by + TS * 7); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = g; dctx.beginPath(); dctx.moveTo(bx, by); dctx.lineTo(bx + TS * 1.4, by); dctx.lineTo(bx + TS * 5, by + TS * 7); dctx.lineTo(bx + TS * 2.6, by + TS * 7); dctx.fill();
  }
  hole(wx(run.p.x), wy(run.p.y), TS * 3.2, 0.95);
  for (const g of run.guards) {
    hole(wx(g.x + g.fx * 0.36), wy(g.y + g.fy * 0.36), TS * 2.2, 0.9);
    if (save.opt.showView) { const pts = coneRays(g, ms, room); dctx.fillStyle = 'rgba(0,0,0,0.55)'; dctx.beginPath(); pts.forEach(([x, y], k) => (k ? dctx.lineTo(wx(x), wy(y)) : dctx.moveTo(wx(x), wy(y)))); dctx.closePath(); dctx.fill(); }
  }
  for (const l of room.lights || []) { const lp = L.lightPos(l, run.t); hole(wx(lp.x), wy(lp.y), l.r * TS * 2.2, 1); }
  for (const it of run.items) if (!it.got) hole(wx(it.x + 0.5), wy(it.y + 0.5), TS * (it.kind === 'key' ? 2 : 1.3), 0.85);
  const info = L.roomInfo(room);
  if (info.exit) hole(wx(info.exit[0] + 0.5), wy(info.exit[1] + 0.5), TS * (run.exitOpen ? 2.2 : 1.2), run.exitOpen ? 0.9 : 0.5);
  if (roomIdx === 0 || room.pedestals) L.hintTrail(room, phase).forEach(([x, y], k) => { if (k % 2 === 0) hole(wx(x + 0.5), wy(y + 0.5), TS * 0.7, 0.6); });
  ctx.save(); ctx.beginPath(); ctx.rect(wx(0), wy(0), room.rows[0].length * TS, room.rows.length * TS); ctx.clip();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(dark, 0, 0); ctx.restore(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // ランタンのあたたかい灯
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const g of run.guards) { const lx = wx(g.x + g.fx * 0.36), ly = wy(g.y + g.fy * 0.36); const gg = ctx.createRadialGradient(lx, ly, 2, lx, ly, TS * 1.6); gg.addColorStop(0, g.mode === 'chase' ? 'rgba(255,80,100,0.35)' : 'rgba(255,200,120,0.28)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gg; ctx.fillRect(lx - TS * 2, ly - TS * 2, TS * 4, TS * 4); }
  ctx.restore(); void t;
}
// 部屋の外：星空と月。部屋のふちは金の線と光で縁取る
function drawPlaySky(room, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a0828'); g.addColorStop(1, '#1e1446'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const ox = -cam.x * 0.08, oy = -cam.y * 0.08;
  for (let i = 0; i < 140; i++) { const a = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.3 + i)); ctx.fillStyle = `rgba(255,248,225,${a * hash(i, 4, 3)})`; ctx.fillRect(((hash(i, 1, 3) * W * 1.3 + ox) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15, ((hash(i, 2, 3) * H * 1.3 + oy) % (H * 1.3) + H * 1.3) % (H * 1.3) - H * 0.15, 1.6, 1.6); }
  const mx = W * 0.82 + ox * 2, my = H * 0.16 + oy * 2, mr = Math.min(W, H) * 0.09;
  const mg = ctx.createRadialGradient(mx, my, mr * 0.3, mx, my, mr * 5); mg.addColorStop(0, 'rgba(255,246,215,0.35)'); mg.addColorStop(1, 'rgba(255,246,215,0)'); ctx.fillStyle = mg; ctx.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
  ctx.fillStyle = '#fbf3da'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
  // 雲
  ctx.fillStyle = 'rgba(110,90,200,0.18)';
  for (let i = 0; i < 6; i++) { const x = ((i * 0.22 + t * 0.006) % 1.4 - 0.2) * W, y = H * (0.25 + (i % 3) * 0.28) + oy; ctx.beginPath(); ctx.ellipse(x, y, W * 0.22, H * 0.035, 0, 0, 7); ctx.fill(); }
  void room;
}
function drawRoomFrame(room) {
  const x0 = wx(0), y0 = wy(0) - TS * 0.1, w = room.rows[0].length * TS, h = room.rows.length * TS + TS * 0.1;
  ctx.save();
  ctx.shadowColor = 'rgba(160,140,255,0.6)'; ctx.shadowBlur = 40; ctx.strokeStyle = 'rgba(236,214,160,0.75)'; ctx.lineWidth = 2; ctx.strokeRect(x0 - 6, y0 - 6, w + 12, h + 12);
  ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(236,214,160,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(x0 - 11, y0 - 11, w + 22, h + 22);
  ctx.fillStyle = '#f1d98a'; ctx.font = `${Math.round(TS * 0.45)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  [[x0 - 8, y0 - 8, '☾'], [x0 + w + 8, y0 - 8, '☽'], [x0 - 8, y0 + h + 8, '✦'], [x0 + w + 8, y0 + h + 8, '✦']].forEach(([x, y, c]) => { ctx.fillStyle = '#120c30'; ctx.beginPath(); ctx.arc(x, y, TS * 0.28, 0, 7); ctx.fill(); ctx.fillStyle = '#f1d98a'; ctx.fillText(c, x, y + 1); });
  ctx.textBaseline = 'alphabetic'; ctx.restore();
}

// ---------- 幻想の演出：記憶の光の粒・足あとの光・かけらの散光 ----------
let motes = [], sparks = [];
function initMotes(room) {
  const w = room.rows[0].length, h = room.rows.length;
  motes = Array.from({ length: Math.round(w * h * 0.3) }, (_, i) => { const big = hash(i, 8, 7) > 0.85; return { x: hash(i, 1, 7) * w, y: hash(i, 2, 7) * h, r: big ? 2.2 + hash(i, 3, 7) * 2 : 0.7 + hash(i, 3, 7) * 1.4, big, sp: (big ? 0.05 : 0.1) + hash(i, 4, 7) * 0.16, ph: hash(i, 5, 7) * 6.28, hue: hash(i, 6, 7) }; });
}
function burst(x, y, n, col) { if (reduceMotion()) return; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 0.6 + Math.random() * 2; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, life: 1, col }); } }
function drawMagic(room, t, dt) {
  const h = room.rows.length, rm = reduceMotion();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const m of motes) {
    if (!rm) { m.y -= m.sp * dt; m.x += Math.sin(t * 0.7 + m.ph) * 0.05 * dt; if (m.y < 0.5) m.y = h - 0.5; }
    const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + m.ph));
    const px = wx(m.x), py = wy(m.y);
    ctx.fillStyle = m.hue > 0.6 ? `rgba(255,230,170,${a})` : m.hue > 0.3 ? `rgba(190,200,255,${a})` : `rgba(220,180,255,${a})`;
    if (!m.big) { ctx.beginPath(); ctx.arc(px, py, m.r, 0, 7); ctx.fill(); }
    ctx.fillStyle = `rgba(200,200,255,${a * (m.big ? 0.09 : 0.1)})`; ctx.beginPath(); ctx.arc(px, py, m.r * (m.big ? 6 : 4), 0, 7); ctx.fill();
  }
  sparks = sparks.filter((p) => (p.life -= dt * 0.9) > 0);
  for (const p of sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.6 * dt; ctx.fillStyle = `rgba(${p.col},${p.life})`; ctx.beginPath(); ctx.arc(wx(p.x), wy(p.y), 1.2 + p.life * 1.8, 0, 7); ctx.fill(); }
  ctx.restore();
}
let lastRenderT = 0, trailT = 0;
function render(t) {
  const rdt = Math.min(0.05, lastRenderT ? t - lastRenderT : 0.016); lastRenderT = t;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#070b22'; ctx.fillRect(0, 0, W, H);
  if (!run) { drawBackdrop(t); return; }
  drawPlaySky(run.room, t);
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
    g.addColorStop(0, 'rgba(200,215,255,0.16)'); g.addColorStop(1, 'rgba(180,170,255,0)');
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
    const grad = ctx.createRadialGradient(wx(g.x), wy(g.y), 4, wx(g.x), wy(g.y), (run.room.view || CFG.viewDist) * TS);
    grad.addColorStop(0, chase ? 'rgba(255,90,110,0.55)' : 'rgba(255,165,90,0.5)'); grad.addColorStop(1, chase ? 'rgba(255,90,110,0.1)' : 'rgba(255,130,80,0.1)');
    ctx.fillStyle = grad; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(wx(x), wy(y)) : ctx.moveTo(wx(x), wy(y)))); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = chase ? 'rgba(255,110,130,0.75)' : 'rgba(255,140,90,0.7)'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 5]); ctx.stroke(); ctx.setLineDash([]);
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
  drawLighting(room, ms, t);
  drawRoomFrame(room);
  // ルウの足もとに光の粒
  if (Math.hypot(run.p.vx, run.p.vy) > 0.3 && (trailT -= rdt) <= 0 && !reduceMotion()) { trailT = 0.07; sparks.push({ x: run.p.x + (Math.random() - 0.5) * 0.3, y: run.p.y + 0.25, vx: (Math.random() - 0.5) * 0.3, vy: -0.4, life: 0.7, col: '170,200,255' }); }
  drawMagic(room, t, rdt);
  { ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const mg = ctx.createRadialGradient(W * 0.5, -H * 0.1, 10, W * 0.5, -H * 0.1, Math.max(W, H) * 0.9);
    mg.addColorStop(0, 'rgba(150,140,255,0.16)'); mg.addColorStop(1, 'rgba(90,60,160,0)');
    ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  // 暗転・閃光・ビネット
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,10,0)'); vg.addColorStop(1, 'rgba(0,0,10,0.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (run.gauge > 0.55 && !reduceMotion()) { ctx.fillStyle = `rgba(200,30,50,${(run.gauge - 0.5) * 0.18 + Math.sin(t * 6) * 0.03})`; ctx.fillRect(0, 0, W, H); }
  if (flash > 0) { ctx.fillStyle = `rgba(255,252,235,${Math.min(0.8, flash) * (reduceMotion() ? 0.3 : 1)})`; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,10,${Math.min(1, fade)})`; ctx.fillRect(0, 0, W, H); }
}
function drawPlanet(cx, cy, r, t) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#9fe0b8'); g.addColorStop(0.6, '#2f8f78'); g.addColorStop(1, '#13483f');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#d9914a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.35, r * 0.35, -0.3, 0, 7); ctx.stroke();
}
function drawBackdrop(t) {
  drawTitleArt(ctx, W, H, reduceMotion() ? 1 : t, !reduceMotion());
}

// ---------- ループ ----------
function frame(ts) {
  const t = ts / 1000, dt = Math.min(0.05, lastT ? t - lastT : 0.016); lastT = t;
  if (mode === 'play' && !paused && run) {
    if (run.status === 'play') {
      const inp = readInput();
      L.step(run, inp, dt);
      handleEvents();
      if (tutorialOn) { const cue = L.tutorialCue(run, tutDone, isTouchUI()); if (cue) { tutDone.add(cue.id); radio(cue.text, cue.id === 'gauge'); } }
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
      if (run.caughtT > 1.0) { handleEvents(); newRun(); toast('つかまった！ 入口からやり直し', 1800); radio('ザザッ……捕まったか。大丈夫だ、入口から仕切り直そう。', true); }
    }
    handleEvents();
    updateCamera(dt, false);
    radioTick(dt);
    $('gaugeBar').style.setProperty('--g', run.gauge.toFixed(3));
  } else if (run && mode === 'clearing') {
    updateCamera(dt, false);
  }
  if (flash > 0) flash -= dt * 1.2;
  if (shake > 0) shake -= dt;
  render(t);
  memoryArtTick(t);
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
