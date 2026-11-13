// 描画・操作・画面遷移。ルールは logic.js、絵は art.js、音は audio.js。
import {
  createState, step, DT, P, W, H, SEAS, BOSSES, absorbRadius, parseSave, recordClear, newCampaign,
  advanceCampaign, needsRoute, upgradeChoices, medalCount, MEDAL_TOTAL, autopilot, bossMuzzles, emit, endPrologue, PRO, PROLOGUE_END,
} from './logic.js';
import { UPGRADES, ROUTES, MEDALS, ENEMY_TYPES, ENEMY_ORDER, TUTORIAL } from './data.js';
import * as art from './art.js';
import { createAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const KEY = 'thunderbird-sky-fleet:v1';
const store = {
  get() { try { return localStorage.getItem(KEY); } catch { return null; } },
  set(v) { try { localStorage.setItem(KEY, v); } catch { /* 保存できなくても遊べる */ } },
};
let save = parseSave(store.get());
const persist = () => store.set(JSON.stringify(save));
const audio = createAudio(save.settings);
const params = new URLSearchParams(location.search);
const OG = params.has('og');
const AUTO = params.has('auto'); // 自動操縦のデモ（動作確認用）
const KANJI = ['一', '二', '三', '四', '五', '六'];

const stage = $('stage'); const cv = $('cv'); const ctx = cv.getContext('2d');
const touchMode = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
const view = { sc: 1, portrait: false, dpr: 1, cw: W, ch: H, ox: 0, oy: 0 };

const app = { mode: 'title', camp: null, practice: null, state: null, ending: null, difficulty: 'normal' };
let realT = 0; let shake = 0; let flash = 0; let hurtFlash = 0; let freeze = 0;
const fx = { parts: [], texts: [], heals: [] };

// ---------- 画面サイズ ----------
function layout() {
  const vw = stage.clientWidth; const vh = stage.clientHeight;
  const portrait = vh > vw * 1.05;
  const field = !['title', 'menu'].includes(app.mode);
  const ctrlH = portrait && touchMode && field ? 134 : 0;
  const topH = portrait && field && app.mode !== 'og' ? 86 : 0; // 縦画面ではHUDを画面の上の余白に置き、ボスを隠さない
  let sc; let cw; let ch;
  if (!field) { sc = portrait ? vw / H : Math.max(vw / W, vh / H); cw = vw; ch = vh; } // タイトルは画面いっぱいに描く
  else if (portrait) { sc = Math.min(vw / H, (vh - ctrlH - topH) / W); cw = H * sc; ch = W * sc; }
  else { sc = app.mode === 'og' ? Math.max(vw / W, vh / H) : Math.min(vw / W, vh / H); cw = W * sc; ch = H * sc; }
  const ox = field ? (vw - cw) / 2 : 0; const oy = !field ? 0 : portrait ? topH + Math.max(0, (vh - ctrlH - topH - ch) / 2) : (vh - ch) / 2;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  Object.assign(view, { sc, portrait, dpr, cw, ch, ox, oy, vw, vh, ctrlH, field });
  Object.assign(cv.style, { left: `${ox}px`, top: `${oy}px`, width: `${cw}px`, height: `${ch}px` });
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  stage.classList.toggle('portrait', portrait); stage.classList.toggle('landscape', !portrait);
  const hud = $('hud'); Object.assign(hud.style, { left: `${portrait ? 0 : ox}px`, top: `${portrait ? 0 : oy}px`, width: `${portrait ? vw : cw}px` });
  $('hint').style.top = `${oy + (portrait ? ch - 70 : 80)}px`; $('hint').style.bottom = 'auto';
  $('banner').style.top = `${oy + ch * (portrait ? 0.4 : 0.56)}px`;
  $('bossBar').style.top = vw < 560 ? '68px' : '46px';
  const tk = $('talk');
  talk.low = undefined;
  if (portrait) Object.assign(tk.style, { left: '8px', right: '8px', width: 'auto', top: `${oy + 6}px`, bottom: 'auto' });
  else Object.assign(tk.style, { left: `${ox + cw * 0.14}px`, right: 'auto', width: `${cw * 0.72}px`, top: 'auto', bottom: `${vh - (oy + ch) + 12}px` });
  Object.assign($('skipPro').style, portrait ? { top: `${oy + ch - 44}px` } : { top: '' });
  $('bossCard').style.top = `${oy + ch * (portrait ? 0.3 : 0.24)}px`;
  const t = $('touch'); t.style.height = `${portrait ? ctrlH : vh}px`;
}
window.addEventListener('resize', layout);

function fieldTransform(sx = 0, sy = 0) {
  const k = view.sc * view.dpr;
  if (view.portrait) ctx.setTransform(0, -k, k, 0, sx * view.dpr, W * k + sy * view.dpr);
  else ctx.setTransform(k, 0, 0, k, sx * view.dpr, sy * view.dpr);
}
// 画面上の移動量 → ゲーム内の移動量
function screenToField(dx, dy) { return view.portrait ? { x: -dy / view.sc, y: dx / view.sc } : { x: dx / view.sc, y: dy / view.sc }; }

// ---------- 入力 ----------
const keys = new Set();
const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', j: 'fire', J: 'fire', ' ': 'fire', k: 'absorb', K: 'absorb', Shift: 'absorb' };
window.addEventListener('keydown', (e) => {
  const k = KEYMAP[e.key];
  if (k && app.mode === 'play') { keys.add(k); e.preventDefault(); audio.ensure(); }
  if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && (app.mode === 'play' || app.mode === 'pause')) { togglePause(); e.preventDefault(); }
  if (e.key === 'Enter' && app.mode === 'title' && document.activeElement === document.body) startCampaign();
});
window.addEventListener('keyup', (e) => { const k = KEYMAP[e.key]; if (k) keys.delete(k); if (e.key === 'Shift') keys.delete('absorb'); });
window.addEventListener('blur', () => { keys.clear(); touch.fire = touch.absorb = false; touch.drag = null; if (app.mode === 'play') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && app.mode === 'play') togglePause(); });

const touch = { fire: false, absorb: false, drag: null };
function bindHold(btn, prop) {
  const on = (e) => { e.preventDefault(); audio.ensure(); touch[prop] = true; btn.classList.add('on'); try { btn.setPointerCapture(e.pointerId); } catch { /* 無視 */ } };
  const off = () => { touch[prop] = false; btn.classList.remove('on'); };
  btn.addEventListener('pointerdown', on); btn.addEventListener('pointerup', off); btn.addEventListener('pointercancel', off); btn.addEventListener('lostpointercapture', off);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}
bindHold($('btnFire'), 'fire'); bindHold($('btnAbsorb'), 'absorb');
stage.addEventListener('pointerdown', (e) => {
  if (app.mode !== 'play' && app.mode !== 'ending') return;
  if (e.target.closest('button, .screen')) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const p = app.mode === 'play' ? app.state.player : app.ending.p;
  touch.drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, px: p.x, py: p.y, target: { x: p.x, y: p.y } };
  audio.ensure();
});
stage.addEventListener('pointermove', (e) => {
  const d = touch.drag; if (!d || d.id !== e.pointerId) return;
  const f = screenToField(e.clientX - d.sx, e.clientY - d.sy);
  d.target = { x: d.px + f.x * 1.25, y: d.py + f.y * 1.25 };
});
const endDrag = (e) => { if (touch.drag && touch.drag.id === e.pointerId) touch.drag = null; };
stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);

function readInput() {
  const sx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
  const sy = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
  const m = view.portrait ? { x: -sy, y: sx } : { x: sx, y: sy };
  const input = { mx: m.x, my: m.y, fire: keys.has('fire') || touch.fire, absorb: keys.has('absorb') || touch.absorb };
  if (touch.drag && !sx && !sy) input.target = touch.drag.target;
  return input;
}

// ---------- 画面の切り替え ----------
const SCREENS = ['title', 'pause', 'settings', 'clear', 'dead', 'practice', 'logbook', 'ending'];
function show(id) { for (const s of SCREENS) $(s).hidden = s !== id; }
function setMode(m) {
  const wasField = view.field;
  app.mode = m;
  if (wasField !== !['title', 'menu'].includes(m)) layout();
  const playing = m === 'play' || m === 'pause';
  $('hud').hidden = !(playing || m === 'og');
  $('touch').hidden = !(touchMode && m === 'play');
  $('keys').hidden = !(m === 'play' && !touchMode && app.state && app.state.sea === 0 && !app.practice);
  if (m !== 'play') { $('hint').classList.remove('on'); }
  if (m !== 'play' && m !== 'pause') hideTalk();
  if (m === 'title') { show('title'); refreshTitle(); audio.stopBgm(); }
}

function refreshTitle() {
  const pr = save.progress;
  $('startBtn').textContent = pr ? `航海開始（第${KANJI[pr.sea]}海域から）` : '航海開始';
  $('newBtn').hidden = !pr;
  $('contInfo').textContent = pr ? `${SEAS[pr.sea].name}・改修${pr.picks.length}つ${pr.route ? `・${ROUTES[pr.route].name}` : ''}` : (medalCount(save) ? `勲章 ${medalCount(save)}/${MEDAL_TOTAL}` : '');
  $('diffBtn').hidden = !save.hard || !!pr;
  $('diffBtn').textContent = `難度：${app.difficulty === 'hard' ? '高難度' : '通常'}`;
}

function startCampaign(fresh = false) {
  audio.ensure(); audio.sfx.ui();
  if (save.progress && !fresh) app.camp = JSON.parse(JSON.stringify(save.progress));
  else app.camp = newCampaign(app.difficulty);
  app.practice = null;
  startSea();
}
function startSea(fromBoss = false) {
  const c = app.camp;
  save.progress = JSON.parse(JSON.stringify(c)); persist();
  app.state = createState({ sea: c.sea, upgrades: c.upgrades, route: c.route, difficulty: c.difficulty, fromBoss, prologue: c.sea === 0 && !fromBoss && !c.proSeen, seed: 1000 + c.sea * 131 + Math.floor(Math.random() * 1e6) });
  beginPlay();
}
function startPractice(sea, fromBoss) {
  audio.ensure(); audio.sfx.ui();
  app.practice = { sea, fromBoss }; app.camp = null;
  const up = { wing: Math.floor((sea + 2) / 3), eff: Math.floor((sea + 1) / 3), rate: Math.floor(sea / 3) };
  app.state = createState({ sea, upgrades: up, practice: true, fromBoss, seed: 77 + sea + Math.floor(Math.random() * 1e6) });
  beginPlay();
}
function beginPlay() {
  show(null); fx.parts.length = 0; fx.texts.length = 0; fx.heals.length = 0; keys.clear();
  touch.fire = touch.absorb = false; touch.drag = null;
  setMode('play');
  const s = app.state;
  hideTalk(); freeze = 0;
  if (s.phase === 'prologue') { banner('序章', '奪われた僚機', '空を覆う大艦隊に挑む、セナと恋人のリオ。最後の夜間飛行', 2.6); audio.setSea(0, false); audio.startBgm(); }
  else { banner(`第${KANJI[s.sea]}海域`, s.seaDef.name, s.fromBoss ? 'ボス前から' : s.seaDef.intro, 3); audio.setSea(s.sea, false); audio.startBgm(); }
  $('skipPro').hidden = s.phase !== 'prologue';
}
function togglePause() {
  if (app.mode === 'play') {
    setMode('pause'); show('pause');
    const s = app.state;
    $('pauseInfo').textContent = `第${KANJI[s.sea]}海域 ${s.seaDef.name}・${s.boss ? 'ボス戦' : `第${Math.min(3, s.waveIdx + 1)}波`}${app.practice ? '（練習）' : ''}`;
    audio.stopBgm();
  } else if (app.mode === 'pause') { show(null); setMode('play'); audio.startBgm(); }
}

let bannerTimer = 0;
function banner(k, t, s, dur, cls = '') {
  const b = $('banner');
  b.className = `banner on ${cls}`;
  b.innerHTML = `<span class="b-k">${k}</span><span class="b-t">${t}</span>${s ? `<span class="b-s">${s}</span>` : ''}`;
  bannerTimer = dur;
}

// ---------- 演出 ----------
function part(x, y, o = {}) { if (fx.parts.length < 500) fx.parts.push({ x, y, vx: o.vx || 0, vy: o.vy || 0, life: o.life || 0.6, t: 0, col: o.col || '#ffd36a', size: o.size || 3, kind: o.kind || 'dot', tx: o.tx, ty: o.ty }); }
function text(x, y, s, o = {}) { fx.texts.push({ x, y, s, t: 0, life: o.life || 1, col: o.col || '#fff3d0', size: o.size || 18 }); }
function burst(x, y, n, col, spd = 160, size = 3) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2; const v = spd * (0.3 + Math.random()); part(x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, col, size: size * (0.5 + Math.random()), life: 0.4 + Math.random() * 0.5 }); } }
const doShake = (v) => { if (save.settings.shake) shake = Math.max(shake, v); };

// ---------- 会話ウィンドウ（顔・名前・文字送り） ----------
const NAMES = { sena: 'セナ', rio: 'リオ', boss: '天の主機' };
const faceCtx = $('face').getContext('2d');
const talk = { on: false, who: '', text: '', t: 0, dur: 0, shout: false, comm: false, tut: -1 };
function say(who, textS, dur, o = {}) {
  Object.assign(talk, { on: true, who, text: textS, t: 0, dur, shout: !!o.shout, comm: !!o.comm, tut: o.tut ?? -1 });
  const el = $('talk'); el.hidden = false;
  el.className = `talk ${who}${talk.shout ? ' shout' : ''}${talk.comm ? ' comm' : ''}`;
  setText('talkName', NAMES[who] || '');
  $('talkKeys').innerHTML = o.keys || '';
  $('talkText').textContent = '';
}
function hideTalk() { talk.on = false; talk.tut = -1; $('talk').hidden = true; for (const id of ['btnFire', 'btnAbsorb']) $(id).classList.remove('guide'); }
function updateTalk(dt) {
  if (!talk.on) return;
  talk.t += dt;
  const n = Math.min(talk.text.length, Math.floor(talk.t * 32) + 1);
  setText('talkText', talk.text.slice(0, n));
  art.drawFace(faceCtx, talk.who, { shout: talk.shout, comm: talk.comm, t: realT });
  if (talk.dur > 0 && talk.t > talk.dur + 0.5) hideTalk();
  // スマホ縦：序章はボスが画面の上に来るので、会話枠を下に置く
  const low = view.portrait && app.state && app.state.phase === 'prologue';
  if (view.portrait && talk.low !== low) { talk.low = low; $('talk').style.top = low ? `${view.oy + view.ch - 150}px` : `${view.oy + 6}px`; }
}
// チュートリアル：リオが籠の中から通信で教える。操作はキー／ボタンの絵で見せ、スマホは押すボタンを光らせる
function tutKeys(step) {
  const K = (k) => `<kbd>${k}</kbd>`;
  if (touchMode) return ['<span>画面のどこでも <em>ドラッグ</em> で移動</span>', '<span><span class="tb f">撃つ</span> を押し続ける</span>', '<span><span class="tb a">吸う</span> を押し続けて、青い丸を吸う</span>', '<span><span class="tb a">吸う</span> から指を離すと雷槍</span>'][step];
  return [`<span>${K('W')}${K('A')}${K('S')}${K('D')} か 矢印キー で移動</span>`, `<span>${K('J')} か ${K('Space')} を押し続けて撃つ</span>`, `<span>${K('K')} か ${K('Shift')} を押し続けて、青い丸を吸う</span>`, `<span>${K('K')} を離すと雷槍</span>`][step];
}
function syncTutorial(s) {
  const step = s.tut ? s.tut.step : -1;
  if (step === talk.tut) return;
  if (step < 0) { if (talk.tut >= 0) hideTalk(); return; }
  say('rio', TUTORIAL[step].rio, 0, { comm: true, keys: tutKeys(step), tut: step });
  $('btnFire').classList.toggle('guide', step === 1);
  $('btnAbsorb').classList.toggle('guide', step >= 2);
}

function handleEvents(s) {
  const p = s.player;
  for (const e of s.events) {
    switch (e.type) {
      case 'shot': audio.sfx.shot(); break;
      case 'absorb':
        part(e.x, e.y, { kind: 'suck', tx: p.x, ty: p.y, col: '#9ffbff', size: 5, life: 0.25 });
        audio.sfx.absorb(e.gauge);
        if (e.crossed) { audio.sfx.threshold(e.crossed); text(p.x + 40, p.y - 50, e.crossed >= 80 ? '雷槍 最大威力' : '雷槍 OK', { col: '#bffcff', size: 16 }); }
        break;
      case 'lance': audio.sfx.lance(e.power); doShake(e.power >= 4 ? 7 : 4); flash = 0.25; break;
      case 'multi': text(e.x, e.y - 30, `${e.kills}機 同時撃破！`, { col: '#ffe08a', size: 30, life: 1.6 }); audio.sfx.multi(e.kills); break;
      case 'boom': burst(e.x, e.y, e.r > 25 ? 34 : 18, e.by === 'lance' ? '#cffcff' : '#ffb35a', e.r > 25 ? 220 : 150, e.r > 25 ? 5 : 3); part(e.x, e.y, { kind: 'ring', col: '#ffe6a0', life: 0.45, size: e.r * 2.2 }); audio.sfx.boom(e.r > 25); if (e.r > 25) doShake(3); break;
      case 'spark': burst(e.x, e.y, e.missile ? 10 : 3, e.missile ? '#ff9a6a' : '#fff0b0', 90, 2); audio.sfx.spark(); break;
      case 'clink': burst(e.x, e.y, 4, '#ffe6a0', 120, 2); if (s.phase === 'prologue') { burst(e.x, e.y, 6, '#ffffff', 160, 2); if (Math.random() < 0.5) text(e.x - 14 + Math.random() * 20, e.y - 20, '無効', { col: '#ff9a8a', size: 22, life: 0.6 }); } else if (Math.random() < 0.25) text(e.x - 10, e.y - 14, '装甲', { col: '#ffe08a', size: 13, life: 0.5 }); audio.sfx.clink(); break;
      case 'reflect': burst(e.x, e.y, 6, '#ffffff', 140, 2); text(e.x, e.y - 16, '反射', { col: '#ffb5a0', size: 13, life: 0.5 }); audio.sfx.clink(); break;
      case 'hurt': doShake(9); hurtFlash = 0.45; burst(p.x, p.y, 20, '#ff6a4a', 200, 3); audio.sfx.hurt(); break;
      case 'heal': fx.heals.push({ x: e.x, y: e.y, tx: e.tx, ty: e.ty, t: 0 }); text(e.tx, e.ty - 30, '+修理', { col: '#9dffc0', size: 12, life: 0.6 }); audio.sfx.heal(); break;
      case 'boss': banner('警報', e.name, '装甲は雷槍で割れる。割れたら通常弾も通る', 3.2, 'boss'); audio.sfx.warn(); audio.setSea(s.sea, true); break;
      case 'bwarn': audio.sfx.warn(); break;
      case 'zap': audio.sfx.zap(); doShake(3); break;
      case 'wave': if (!(s.tut && e.idx === 0)) banner(`第${KANJI[e.idx]}波`, e.name, '', 2); break;
      case 'bossDown': burst(e.x, e.y, 120, '#ffd36a', 320, 6); part(e.x, e.y, { kind: 'ring', col: '#fff', life: 0.9, size: 400 }); audio.sfx.boom(true); doShake(14); flash = 0.6; break;
      case 'fizzle': audio.sfx.fizzle(); break;
      case 'bounce': part(e.x, e.y, { kind: 'ring', col: '#bff', life: 0.25, size: 18 }); break;
      case 'practiceRefill': text(p.x, p.y - 40, '練習：体力回復', { col: '#bffcff', size: 14 }); break;
      case 'armor': break;
      case 'say': say(e.who, e.text, e.dur, { shout: e.text.includes('！！'), comm: e.who === 'rio' && s.phase !== 'prologue' }); break;
      case 'proAlarm': audio.stopBgm(); audio.sfx.siren(); audio.sfx.rumble(); doShake(5); break;
      case 'proBoss': { const c = $('bossCard'); c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); audio.sfx.boom(true); audio.sfx.rumble(); doShake(16); flash = 0.55; freeze = 0.12; audio.setSea(5, true); audio.startBgm(); break; }
      case 'proBeam': audio.sfx.charge(); break;
      case 'proGraze': burst(p.x, p.y, 8, '#ff9a6a', 120, 2); audio.sfx.clink(); break;
      case 'allyDown': burst(e.x, e.y, 80, '#ffb35a', 280, 5); part(e.x, e.y, { kind: 'ring', col: '#fff', life: 0.8, size: 220 }); audio.sfx.lance(4); audio.sfx.boom(true); audio.sfx.hurt(); doShake(18); hurtFlash = 0.8; flash = 0.9; freeze = 0.55; break;
      case 'proEnd': $('skipPro').hidden = true; hideTalk(); $('bossCard').classList.remove('on'); audio.startBgm(); if (app.camp) { app.camp.proSeen = true; save.progress = JSON.parse(JSON.stringify(app.camp)); persist(); } banner('第一海域', s.seaDef.name, 'リオを取り戻す。まずは雷鳥の扱いを思い出せ', 3); audio.setSea(0, false); break;
      default: break;
    }
  }
  s.events.length = 0;
}

function updateFx(dt) {
  shake = Math.max(0, shake - dt * 30); flash = Math.max(0, flash - dt); hurtFlash = Math.max(0, hurtFlash - dt);
  for (const q of fx.parts) {
    q.t += dt;
    if (q.kind === 'suck') { const k = Math.min(1, q.t / q.life); q.x += (q.tx - q.x) * k * 0.5; q.y += (q.ty - q.y) * k * 0.5; }
    else { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.96; q.vy *= 0.96; }
  }
  fx.parts = fx.parts.filter((q) => q.t < q.life);
  for (const t of fx.texts) { t.t += dt; t.y -= 26 * dt; }
  fx.texts = fx.texts.filter((t) => t.t < t.life);
  for (const h of fx.heals) h.t += dt;
  fx.heals = fx.heals.filter((h) => h.t < 0.45);
  updateTalk(dt);
  if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) $('banner').classList.remove('on'); }
}

// ---------- 描画 ----------
function drawText(x, y, s, size, col, alpha = 1) {
  ctx.save(); ctx.translate(x, y); if (view.portrait) ctx.rotate(Math.PI / 2);
  ctx.globalAlpha = alpha; ctx.font = `800 ${size}px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif`; ctx.textAlign = 'center';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,8,2,.85)'; ctx.strokeText(s, 0, 0); ctx.fillStyle = col; ctx.fillText(s, 0, 0);
  ctx.restore();
}
// スマホでは、キー操作の説明をボタン操作の説明に言い換える
function touchHint(t) {
  return t.replace('動かす：WASD／矢印キー（スマホは画面をドラッグ）', '動かす：画面のどこでもドラッグ')
    .replace('J／Space を押し続ける', '「撃つ」を押し続ける')
    .replace('K／Shift を押し続けて', '「吸う」を押し続けて');
}
function drawFx() {
  for (const h of fx.heals) {
    ctx.strokeStyle = `rgba(125,255,176,${1 - h.t / 0.45})`; ctx.lineWidth = 3; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.tx, h.ty); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const q of fx.parts) {
    const a = 1 - q.t / q.life;
    if (q.kind === 'ring') { ctx.strokeStyle = q.col; ctx.globalAlpha = a; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - a) + 4, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.globalAlpha = a; ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  for (const t of fx.texts) drawText(t.x, t.y, t.s, t.size, t.col, Math.min(1, (1 - t.t / t.life) * 2));
}

// ---------- 序章の演出 ----------
const SHOW_BOSS = BOSSES[SEAS[5].boss];
// 空が赤黒く沈み、雲の下を巨大な影が昇ってくる
function drawProBack(s, t) {
  const pt = s.pro.t;
  if (pt < PRO.alarm) return;
  const k = Math.min(1, (pt - PRO.alarm) / 1.2) * (pt > PRO.leave ? Math.max(0.35, 1 - (pt - PRO.leave) / 1.4) : 1);
  ctx.fillStyle = `rgba(30,0,4,${0.5 * k})`; ctx.fillRect(-50, -50, W + 100, H + 100);
  const pulse = 0.5 + 0.5 * Math.sin(pt * 7);
  const g = ctx.createRadialGradient(W * 0.75, H + 60, 20, W * 0.75, H + 60, 420);
  g.addColorStop(0, `rgba(255,40,20,${0.45 * k * (0.6 + 0.4 * pulse)})`); g.addColorStop(1, 'rgba(255,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(-50, -50, W + 100, H + 100);
  if (pt < PRO.boss) {
    const u = (pt - PRO.alarm) / (PRO.boss - PRO.alarm);
    const fake = { def: SHOW_BOSS, x: 0, y: 0, t: pt, hp: 999, armored: true, flash: 0, wing: 0.3, ph: 'warn', pt: 0, ai: 0 };
    ctx.save(); ctx.translate(W * 0.68 - u * 40, H + 260 - u * 340); ctx.scale(2.1, 2.1);
    ctx.globalAlpha = 0.75; ctx.filter = 'brightness(0)';
    art.drawBoss(ctx, fake, pt, []);
    ctx.restore();
    const eg = ctx.createRadialGradient(W * 0.68 - u * 40, H + 250 - u * 340, 2, W * 0.68 - u * 40, H + 250 - u * 340, 60);
    eg.addColorStop(0, `rgba(255,230,190,${0.9 * pulse})`); eg.addColorStop(0.25, 'rgba(255,40,20,.8)'); eg.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(W * 0.68 - u * 40, H + 250 - u * 340, 60, 0, Math.PI * 2); ctx.fill();
  }
}
// 主機の光線：予告（細い赤線と溜め）→ リオが割り込んで受ける
function drawProFront(s, t) {
  const bm = s.pro.beam; const b = s.boss;
  if (!bm || !b) return;
  const mx = b.x - 90; const my = b.y;
  const a = s.pro.ally;
  if (!a.captured) {
    const k = Math.min(1, bm.t / 1);
    const r = 10 + k * 40;
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, r); g.addColorStop(0, '#fff'); g.addColorStop(0.3, 'rgba(255,90,60,.95)'); g.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill();
    if (Math.floor(t * 16) % 2 === 0) {
      ctx.strokeStyle = 'rgba(255,60,40,.9)'; ctx.lineWidth = 2 + k * 3; ctx.setLineDash([18, 10]);
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(s.player.x, bm.y); ctx.stroke(); ctx.setLineDash([]);
    }
  } else if (bm.t < 1.7) {
    const w = 26 * (1 - Math.max(0, bm.t - 1) / 0.7);
    for (const [lw, col] of [[w * 2.2, 'rgba(255,60,30,.45)'], [w, 'rgba(255,200,160,.95)'], [w * 0.4, '#fff']]) {
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, lw); ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(a.x + 20, a.y); ctx.stroke();
    }
  }
}
// 画面の上下の黒帯（映画のような帯）と、警報の帯
function drawProScreen(s, t) {
  const pt = s.pro.t; const Wc = cv.width; const Hc = cv.height; const d = view.dpr;
  const inK = Math.min(1, pt / 0.6) * Math.min(1, Math.max(0, (PROLOGUE_END - pt) / 0.6));
  const bh = Math.round(Hc * 0.075 * inK);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, Wc, bh); ctx.fillRect(0, Hc - bh, Wc, bh);
  if (pt >= PRO.alarm && pt < PRO.boss + 0.8) {
    const blink = Math.floor(pt * 4) % 2 === 0;
    ctx.fillStyle = `rgba(255,0,0,${blink ? 0.16 : 0.06})`; ctx.fillRect(0, 0, Wc, Hc);
    // 画面中央の大きな WARNING（点滅）
    if (pt < PRO.boss) {
      ctx.save(); ctx.globalAlpha = blink ? 0.95 : 0.35; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const fs = Math.min(Wc * 0.13, 64 * d);
      ctx.font = `900 ${fs}px system-ui, sans-serif`; ctx.lineWidth = 4 * d; ctx.strokeStyle = '#400'; ctx.strokeText('WARNING', Wc / 2, Hc * 0.36); ctx.fillStyle = '#ff4a30'; ctx.fillText('WARNING', Wc / 2, Hc * 0.36);
      ctx.font = `800 ${fs * 0.32}px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif`; ctx.fillStyle = '#ffe0d0'; ctx.fillText('雲の下に 巨大な艦影', Wc / 2, Hc * 0.36 + fs * 0.75);
      ctx.restore();
    }
    const sh = 26 * d;
    for (const [y, dir] of view.portrait ? [[Hc - bh - sh, -1]] : [[bh, 1]]) { // 会話ウィンドウと重ならない側に出す
      ctx.fillStyle = 'rgba(160,0,0,.88)'; ctx.fillRect(0, y, Wc, sh);
      ctx.save(); ctx.beginPath(); ctx.rect(0, y, Wc, sh); ctx.clip();
      ctx.fillStyle = 'rgba(255,200,0,.9)';
      const off = (pt * 120 * d * dir) % (24 * d);
      for (let x = -48 * d + off; x < Wc + 48 * d; x += 24 * d) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 10 * d, y); ctx.lineTo(x + 2 * d, y + sh); ctx.lineTo(x - 8 * d, y + sh); ctx.closePath(); ctx.globalAlpha = 0.25; ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.font = `900 ${15 * d}px system-ui, sans-serif`; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffe9d8';
      const msg = 'WARNING ◆ 巨大反応 接近 ◆ ';
      const mw = ctx.measureText(msg).width; const o2 = ((pt * 90 * d * dir) % mw + mw) % mw;
      for (let x = -mw + o2; x < Wc; x += mw) ctx.fillText(msg, x, y + sh / 2 + d);
      ctx.restore();
    }
  }
}

function renderPlay(s, t) {
  const sx = shake ? (Math.random() - 0.5) * shake : 0; const sy = shake ? (Math.random() - 0.5) * shake : 0;
  fieldTransform(sx, sy);
  art.drawSky(ctx, s.sea, s.t);
  if (s.pro) drawProBack(s, t);
  for (const h of s.hazards) art.drawHazard(ctx, h, t);
  const b = s.boss;
  if (b && (b.hp > 0 || s.phase === 'bossDown')) {
    let warn = [];
    if (b.ph === 'warn' && b.hp > 0) {
      const a = b.def.attacks[b.ai]; const red = !a.spec.colors || a.spec.colors.includes('r');
      warn = bossMuzzles(b).map((m) => ({ ...m, red, ang: Math.atan2(s.player.y - m.y, s.player.x - m.x) }));
    }
    if (s.phase === 'bossDown') { ctx.globalAlpha = Math.max(0, 1 - s.phaseT / 2.4); art.drawBoss(ctx, b, t, []); ctx.globalAlpha = 1; if (Math.random() < 0.5) burst(b.x + (Math.random() - 0.5) * 160, b.y + (Math.random() - 0.5) * 160, 6, '#ffb35a', 160, 4); }
    else art.drawBoss(ctx, b, t, warn);
  }
  for (const e of s.enemies) art.drawEnemy(ctx, e, t);
  // 序章：僚機リオ（銀青の雷鳥）。さらわれた後は主機から伸びる赤い鎖で引かれていく
  if (s.pro && s.pro.ally) {
    const a = s.pro.ally;
    if (a.captured && b) {
      // 太い鎖（輪を連ねる）と、リオを閉じこめる籠
      const x0 = b.x - 30, y0 = b.y + 30, dx = a.x - x0, dy = a.y - y0, len = Math.hypot(dx, dy), n = Math.max(2, Math.floor(len / 16));
      ctx.save(); ctx.translate(x0, y0); ctx.rotate(Math.atan2(dy, dx));
      for (let i = 0; i < n; i++) { ctx.strokeStyle = i % 2 ? '#ff6a4a' : '#ffb07a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(i * 16 + 8, 0, 10, i % 2 ? 3 : 6, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
      const jx = Math.sin(t * 40) * 3;
      ctx.strokeStyle = '#ffcf9a'; ctx.lineWidth = 3;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(a.x + i * 14 + jx, a.y - 32); ctx.lineTo(a.x + i * 14 + jx, a.y + 30); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(a.x + jx, a.y - 32, 36, 8, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.save(); ctx.filter = 'hue-rotate(170deg) saturate(.7) brightness(1.15)';
    art.drawBird(ctx, a.x, a.y, { wing: a.captured ? 0.3 : 1, t: t + 0.4, scale: 0.72, blink: a.captured });
    ctx.restore();
    if (!a.captured) { if (view.portrait) drawText(a.x + 46, a.y, 'リオ', 15, '#bfe8ff', 1); else drawText(a.x, a.y - 44, 'リオ', 15, '#bfe8ff', 1); }
  }
  // 自機の弾
  for (const sh of s.shots) { ctx.fillStyle = '#ffe9a8'; ctx.fillRect(sh.x - 10, sh.y - 1.5, 16, 3); ctx.fillStyle = '#fff'; ctx.fillRect(sh.x + 2, sh.y - 1, 5, 2); }
  const p = s.player;
  if (p.absorbing) art.drawAbsorb(ctx, p.x, p.y, absorbRadius(s.upgrades), t);
  art.drawBird(ctx, p.x, p.y, { wing: p.wing, lights: Math.floor(p.gauge / 20), t, blink: p.inv > 0, absorbing: p.absorbing, scale: view.portrait ? 1.25 : 1 });
  // 自機の当たり判定（小さな芯）
  ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2); ctx.fill();
  for (const bl of s.bullets) if (bl.d <= 0) art.drawBullet(ctx, bl, t);
  for (const l of s.lances) art.drawLance(ctx, l);
  drawFx();
  if (s.pro) drawProFront(s, t);
  // 画面全体の光
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (flash > 0) { ctx.fillStyle = `rgba(220,250,255,${flash * 0.5})`; ctx.fillRect(0, 0, cv.width, cv.height); }
  if (hurtFlash > 0) {
    const g = ctx.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.3, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * 0.7);
    g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,30,10,${hurtFlash})`); ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
  }
  if (s.pro) drawProScreen(s, t);
}

// タイトル：左下に翼を広げた雷鳥、右に巨大な銅の帆船と渦雲
function renderTitle(t) {
  const k = view.sc * view.dpr; const lw = view.cw / view.sc; const lh = view.ch / view.sc;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  art.drawSky(ctx, 0, t, { w: lw, h: lh, noSwirl: true, sky: ['#070c24', '#1a2450', '#3a3a62', 'rgba(150,170,255,.6)', 'rgba(5,8,25,.7)', 'rgba(30,40,86,.7)', 'rgba(52,62,112,.75)', 'rgba(96,96,150,.85)'] });
  const port = view.portrait;
  // 右（縦画面では上）に黒群青の渦雲と巨大な銅の帆船
  const shx = port ? lw * 0.58 : lw - 250; const shy = port ? lh * 0.2 : lh * 0.33;
  art.swirlAt(ctx, shx + 40, shy - 20, port ? 300 : 380, t, 'rgba(130,150,255,.7)', 0.22);
  ctx.save(); ctx.translate(shx, shy + Math.sin(t * 0.8) * 6); art.galleon(ctx, t, port ? 1.25 : 1.45); ctx.restore();
  for (let i = 0; i < 4; i++) art.drawEnemy(ctx, { type: i % 2 ? 'scout' : 'sparrow', x: shx - 150 + i * 55 + Math.sin(t + i) * 10, y: shy - (port ? 150 : 130) + i * 26 + Math.cos(t * 1.3 + i) * 8, id: i, r: 15, flash: 0, maxHp: 1, hp: 1 }, t);
  // 左下に翼を広げた雷鳥と、前から来る青弾（1つだけ赤）
  const bx = port ? lw * 0.3 : 190; const by = port ? lh * 0.76 : lh * 0.68;
  for (let i = 0; i < 6; i++) art.drawBullet(ctx, { x: bx + 420 - ((t * 120 + i * 60) % 360), y: by - 10 + Math.sin(i) * 6, c: i === 3 ? 'r' : 'b', r: i === 3 ? 6 : 7, vx: -1, vy: 0 }, t);
  art.drawBird(ctx, bx, by + Math.sin(t * 1.4) * 8, { wing: 1, lights: 3 + Math.floor((t * 2) % 3), t, scale: port ? 2.2 : 2.1 });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function renderEnding(t) {
  const e = app.ending;
  fieldTransform();
  art.drawSky(ctx, 5, t, { sky: art.CLEAR_SKY, calm: true });
  for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(980 - ((e.t * 40 + i * 330) % 1300), 150 + i * 120); ctx.scale(-1, 1); art.galleon(ctx, t + i, 0.55 + i * 0.12, false); ctx.restore(); }
  for (const q of e.debris) { q.x += q.vx / 60; q.y += q.vy / 60; q.vy += 1.2; ctx.fillStyle = '#c8933a'; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(t * q.r); ctx.fillRect(-q.s, -q.s / 2, q.s * 2, q.s); ctx.restore(); }
  art.drawBird(ctx, e.p.x, e.p.y, { wing: 1, lights: 5, t, scale: 1.3 });
  drawFx();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------- HUD ----------
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function updateHud() {
  const s = app.state; if (!s || (app.mode !== 'play' && app.mode !== 'og' && app.mode !== 'pause')) return;
  const p = s.player;
  const hpKey = `${p.hp}`;
  if (hudCache.hp !== hpKey) { hudCache.hp = hpKey; $('hp').innerHTML = [0, 1, 2].map((i) => `<i class="${i < p.hp ? '' : 'off'}"></i>`).join(''); }
  $('gaugeFill').style.width = `${p.gauge}%`;
  setText('gaugeNum', String(Math.round(p.gauge)));
  const lv = p.gauge >= 80 ? 'lv2' : p.gauge >= 40 ? 'lv1' : '';
  if (hudCache.lv !== lv) { hudCache.lv = lv; $('gauge').className = `gauge ${lv}`; }
  const wave = s.phase === 'prologue' ? '序章' : s.boss ? 'ボス' : `${Math.min(3, s.waveIdx + 1)}/3`;
  setText('seaChip', view.cw < 560 ? `第${KANJI[s.sea]}海域・${wave}` : `第${KANJI[s.sea]}海域 ${s.seaDef.name}・${wave}${app.practice ? '・練習' : ''}`);
  const b = s.boss;
  $('bossBar').hidden = !(b && b.ph !== 'enter' && b.hp > 0);
  if (b) {
    setText('bossName', b.def.name);
    $('bossFill').style.width = `${Math.min(1, b.hp / P.bossHp) * 100}%`;
    const st = b.armored ? '装甲' : '弱点露出';
    if (hudCache.bst !== st) { hudCache.bst = st; $('bossState').textContent = st; $('bossState').className = b.armored ? '' : 'open'; }
  }
  const h = $('hint');
  syncTutorial(s);
  if (s.hint && app.mode === 'play' && !talk.on && s.phase !== 'prologue') { setText('hint', touchMode ? touchHint(s.hint) : s.hint); h.classList.add('on'); } else h.classList.remove('on');
  $('btnAbsorb').classList.toggle('lit', p.absorbing && p.gauge >= 40);
}

// ---------- 海域クリア・墜落 ----------
function fmtTime(sec) { const m = Math.floor(sec / 60); const s = Math.floor(sec % 60); return `${m}:${String(s).padStart(2, '0')}`; }
function medalHtml(sea, result, before) {
  return MEDALS.map((m) => {
    const got = save.medals[`${sea}-${m.id}`]; const now = result && result.medals[m.id]; const fresh = now && !before[`${sea}-${m.id}`];
    return `<span class="medal ${got ? 'got' : ''} ${fresh ? 'new' : ''}" title="${m.desc}"><i></i>${m.name}${fresh ? '！' : ''}</span>`;
  }).join('');
}
function onClear() {
  const s = app.state; const r = s.result;
  const before = { ...save.medals };
  save = recordClear(save, r, { practice: !!app.practice });
  persist();
  audio.sfx.clear(); audio.stopBgm();
  if (!app.practice && s.sea === 5) { app.camp = advanceCampaign(app.camp, r, null); return startEnding(r); }
  setMode('clear'); show('clear');
  $('clearKicker').textContent = `第${KANJI[s.sea]}海域 突破${app.practice ? '（練習）' : ''}`;
  $('clearTitle').textContent = s.seaDef.name;
  $('clearLog').textContent = `航海日誌：${s.seaDef.log}`;
  $('clearStats').innerHTML = [
    ['時間', `${fmtTime(r.time)}`, `規定 ${fmtTime(s.seaDef.par)}`], ['被弾', `${r.hits}`], ['撃墜', `${r.kills}`], ['雷槍の最多同時', `${r.lanceMax}機`], ['吸った青弾', `${r.absorbed}`],
  ].map(([k, v, x]) => `<div class="stat">${k}<b>${v}</b>${x ? `<small>${x}</small>` : ''}</div>`).join('');
  $('clearMedals').innerHTML = medalHtml(s.sea, r, before);
  const cards = $('choiceCards'); const btns = $('clearBtns'); cards.innerHTML = ''; btns.innerHTML = '';
  if (app.practice) {
    $('choiceHead').hidden = true;
    addBtn(btns, 'もう一度', 'big-btn', () => startPractice(app.practice.sea, app.practice.fromBoss));
    addBtn(btns, '練習を選ぶ', 'ghost-btn', openPractice);
    addBtn(btns, 'タイトルへ', 'ghost-btn', () => setMode('title'));
    return;
  }
  $('choiceHead').hidden = false; $('choiceHead').textContent = '自機改修　どちらか1つ（最終戦まで持ち越す）';
  for (const key of upgradeChoices(s.sea)) {
    const u = UPGRADES[key]; const lv = app.camp.upgrades[key] || 0;
    const c = document.createElement('button'); c.type = 'button'; c.className = 'card';
    c.innerHTML = `<div class="ic">${{ wing: '翼', eff: '管', rate: '銃' }[key]}</div><b>${u.name}</b><span>${u.desc}</span><em>いまの段階 ${lv} → ${lv + 1}</em>`;
    c.addEventListener('click', () => { audio.sfx.ui(); app.camp = advanceCampaign(app.camp, r, key); afterUpgrade(); });
    cards.appendChild(c);
  }
}
function afterUpgrade() {
  if (needsRoute(app.camp)) {
    $('choiceHead').textContent = '航路を選ぶ（第三〜第六海域の弾幕が変わる）';
    const cards = $('choiceCards'); cards.innerHTML = '';
    for (const key of ['blue', 'red']) {
      const r = ROUTES[key]; const c = document.createElement('button'); c.type = 'button'; c.className = `card route-${key}`;
      c.innerHTML = `<div class="ic">${key === 'blue' ? '雲' : '雷'}</div><b>${r.name}</b><span>${r.desc}</span>`;
      c.addEventListener('click', () => { audio.sfx.ui(); app.camp.route = key; startSea(); });
      cards.appendChild(c);
    }
    return;
  }
  startSea();
}
function addBtn(parent, label, cls, fn) { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; b.addEventListener('click', fn); parent.appendChild(b); return b; }

function onDead() {
  const s = app.state;
  audio.stopBgm();
  setMode('dead'); show('dead');
  $('deadTitle').textContent = `第${KANJI[s.sea]}海域 ${s.seaDef.name}`;
  $('deadInfo').textContent = `${s.deadAtBoss ? `${s.boss.def.name}との戦いで` : `第${Math.min(3, s.waveIdx + 1)}波で`}墜落。改修は海域に入った時のまま、入口からやり直せる。`;
  $('retryBossBtn').hidden = !s.deadAtBoss;
}
$('skipPro').addEventListener('click', () => { if (app.state && app.state.phase === 'prologue') { endPrologue(app.state); handleEvents(app.state); } });
$('retryBtn').addEventListener('click', () => { audio.ensure(); if (app.practice) startPractice(app.practice.sea, app.practice.fromBoss); else startSea(); });
$('retryBossBtn').addEventListener('click', () => { audio.ensure(); if (app.practice) startPractice(app.practice.sea, true); else startSea(true); });
$('deadTitleBtn').addEventListener('click', () => setMode('title'));

function startEnding(r) {
  const c = app.camp;
  save.runs = [...save.runs, { route: c.route, picks: c.picks, kills: c.totals.kills, hits: c.totals.hits, time: Math.round(c.totals.time), difficulty: c.difficulty, lanceMax: c.totals.lanceMax }].slice(-10);
  save.progress = null; persist();
  app.ending = { t: 0, p: { x: 200, y: 300 }, debris: Array.from({ length: 30 }, () => ({ x: 800 + (Math.random() - 0.5) * 120, y: 270 + (Math.random() - 0.5) * 120, vx: (Math.random() - 0.3) * 200, vy: -Math.random() * 160, s: 4 + Math.random() * 10, r: (Math.random() - 0.5) * 6 })) };
  setMode('ending'); show(null);
  text(480, 200, '天の主機、停止', { size: 40, life: 4, col: '#fff3d0' });
  setTimeout(() => { if (app.mode === 'ending') showEndingCard(c); }, 4200);
}
function showEndingCard(c) {
  show('ending');
  const tot = c.totals;
  $('endStats').innerHTML = [
    ['航路', c.route ? ROUTES[c.route].name : '—'], ['改修', ['wing', 'eff', 'rate'].map((k) => `${{ wing: '翼', eff: '管', rate: '銃' }[k]}${c.upgrades[k] || 0}`).join('・')],
    ['総撃墜', tot.kills], ['被弾', tot.hits], ['航海時間', fmtTime(tot.time)], ['勲章', `${medalCount(save)}/${MEDAL_TOTAL}`],
  ].map(([k, v]) => `<div class="stat">${k}<b>${v}</b></div>`).join('');
  $('endUnlock').textContent = c.difficulty === 'hard' ? '高難度で全海域を突破した。' : '高難度が解放された（タイトルの「難度」で切り替え）。';
  drawEndCard(c);
}
// 航海日誌の絵：雷鳥と、撃墜した艦の種類ごとの数
function drawEndCard(c) {
  const ec = $('endCv'); const g = ec.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  const grd = g.createLinearGradient(0, 0, 0, 260); grd.addColorStop(0, '#2a3e6e'); grd.addColorStop(1, '#e8d6b0');
  g.fillStyle = grd; g.fillRect(0, 0, 640, 260);
  for (let i = 0; i < 5; i++) art.cloud(g, 60 + i * 140, 225, 26, 'rgba(255,255,255,.75)', 'rgba(255,255,255,.9)');
  art.drawBird(g, 90, 100, { wing: 1, lights: 5, t: 1, scale: 1.0 });
  g.font = '800 22px serif'; g.fillStyle = '#fff3d0'; g.fillText('セナの航海日誌', 170, 50);
  g.font = '14px sans-serif'; g.fillStyle = '#f2e6cc';
  g.fillText(`航路：${c.route ? ROUTES[c.route].name : '—'}　改修：${c.picks.map((k) => UPGRADES[k].name).join('・')}`, 170, 76);
  g.fillText(`被弾 ${c.totals.hits}　雷槍の最多同時 ${c.totals.lanceMax}機　${c.difficulty === 'hard' ? '高難度' : '通常'}`, 170, 98);
  ENEMY_ORDER.forEach((type, i) => {
    const x = 70 + i * 72; const y = 160;
    g.save(); art.drawEnemy(g, { type, x, y, id: i, r: ENEMY_TYPES[type].r, flash: 0, maxHp: 1, hp: 1, closed: false, fireT: 1 }, 1); g.restore();
    g.font = 'bold 15px sans-serif'; g.fillStyle = '#1a0e06'; g.textAlign = 'center'; g.fillText(`×${c.totals.killsByType[type] || 0}`, x, y + 44); g.textAlign = 'left';
  });
}
$('endTitleBtn').addEventListener('click', () => setMode('title'));
$('endSaveBtn').addEventListener('click', () => {
  try { const a = document.createElement('a'); a.href = $('endCv').toDataURL('image/png'); a.download = 'thunderbird-logbook.png'; a.click(); } catch { /* 保存できない環境 */ }
});

// ---------- 練習・日誌・設定 ----------
function openPractice() {
  audio.ensure(); show('practice'); app.mode = 'menu';
  const list = $('seaList'); list.innerHTML = '';
  SEAS.forEach((sea, i) => {
    const open = i <= save.reached || save.cleared[i];
    const best = save.best[i];
    const row = document.createElement('div'); row.className = `sea-row ${open ? '' : 'locked'}`;
    row.innerHTML = `<div><div class="nm">第${KANJI[i]}海域 ${open ? sea.name : '？？？'}<span class="mini-medals">${MEDALS.map((m) => `<i class="${save.medals[`${i}-${m.id}`] ? 'got' : ''}"></i>`).join('')}</span></div>
      <div class="meta">${open ? `ボス：${BOSSES[sea.boss].name}${best ? `・最速 ${fmtTime(best.time)}` : ''}` : 'まだ辿り着いていない'}</div></div><div class="acts"></div>`;
    if (open) {
      addBtn(row.querySelector('.acts'), '入口から', '', () => startPractice(i, false));
      addBtn(row.querySelector('.acts'), 'ボスから', '', () => startPractice(i, true));
    }
    list.appendChild(row);
  });
}
function openLog() {
  show('logbook'); app.mode = 'menu';
  $('medalTotal').textContent = `勲章 ${medalCount(save)} / ${MEDAL_TOTAL}（各海域：${MEDALS.map((m) => `${m.name}＝${m.desc}`).join('／')}）`;
  $('logList').innerHTML = SEAS.map((sea, i) => {
    const got = save.logs.includes(i);
    return `<div class="log-entry ${got ? '' : 'locked'}"><div class="nm">第${KANJI[i]}海域 ${got || i <= save.reached ? sea.name : '？？？'}<span class="mini-medals">${MEDALS.map((m) => `<i class="${save.medals[`${i}-${m.id}`] ? 'got' : ''}"></i>`).join('')}</span></div><p>${got ? sea.log : 'まだ書かれていない頁。'}</p></div>`;
  }).join('');
  $('runList').innerHTML = save.runs.length ? save.runs.slice().reverse().map((r) => `<div>・${r.difficulty === 'hard' ? '【高難度】' : ''}${r.route ? ROUTES[r.route].name : ''}／${r.picks.map((k) => UPGRADES[k].name).join('・')}／撃墜${r.kills}・被弾${r.hits}・${fmtTime(r.time)}</div>`).join('') : '<div>まだ全海域を突破していない。</div>';
}
let settingsBack = 'title';
function openSettings(back) {
  settingsBack = back; show('settings');
  $('setSound').checked = save.settings.sound; $('setVol').value = save.settings.vol; $('setShake').checked = save.settings.shake;
}
$('setSound').addEventListener('change', (e) => { save.settings.sound = e.target.checked; audio.apply(); persist(); if (e.target.checked) { audio.ensure(); audio.sfx.ui(); } });
$('setVol').addEventListener('input', (e) => { save.settings.vol = +e.target.value; audio.apply(); persist(); });
$('setShake').addEventListener('change', (e) => { save.settings.shake = e.target.checked; persist(); });
$('setClose').addEventListener('click', () => { if (settingsBack === 'pause') show('pause'); else setMode('title'); });

$('startBtn').addEventListener('click', () => startCampaign());
$('newBtn').addEventListener('click', () => { if (confirm('いまの航海の記録（続き）を消して、第一海域から始めますか？ 勲章と日誌は残ります。')) { save.progress = null; persist(); startCampaign(true); } });
$('diffBtn').addEventListener('click', () => { app.difficulty = app.difficulty === 'hard' ? 'normal' : 'hard'; refreshTitle(); });
$('practiceBtn').addEventListener('click', openPractice);
$('practiceBack').addEventListener('click', () => setMode('title'));
$('logBtn').addEventListener('click', openLog);
$('logBack').addEventListener('click', () => setMode('title'));
$('setBtn').addEventListener('click', () => openSettings('title'));
$('pauseBtn').addEventListener('click', togglePause);
$('resumeBtn').addEventListener('click', togglePause);
$('pauseSetBtn').addEventListener('click', () => openSettings('pause'));
$('pauseTitleBtn').addEventListener('click', () => setMode('title'));

// ---------- ループ ----------
let last = performance.now(); let acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; realT += dt;
  if (app.mode === 'play' && app.state && freeze > 0) { freeze -= dt; acc = 0; }
  else if (app.mode === 'play' && app.state) {
    acc += dt; let n = 0;
    while (acc >= DT && n < 6) { step(app.state, AUTO ? autopilot(app.state) : readInput()); handleEvents(app.state); acc -= DT; n++; if (app.state.phase === 'clear' || app.state.phase === 'dead') break; }
    if (n >= 6) acc = 0;
    if (app.state.phase === 'clear' && app.state.phaseT >= 0) onClear();
    else if (app.state.phase === 'dead' && app.state.phaseT > 0.9) onDead();
  } else if (app.mode === 'ending') {
    const e = app.ending; e.t += dt;
    const inp = readInput(); const sp = 260 * dt;
    if (inp.target) { const dx = inp.target.x - e.p.x; const dy = inp.target.y - e.p.y; const d = Math.hypot(dx, dy); if (d > 1) { e.p.x += (dx / d) * Math.min(d, sp); e.p.y += (dy / d) * Math.min(d, sp); } }
    else { e.p.x += inp.mx * sp; e.p.y += inp.my * sp; }
    e.p.x = Math.max(40, Math.min(900, e.p.x)); e.p.y = Math.max(40, Math.min(500, e.p.y));
  }
  if (app.mode !== 'og') updateFx(dt);
  if (app.mode === 'play' || app.mode === 'pause' || app.mode === 'dead' || app.mode === 'clear' || app.mode === 'og') renderPlay(app.state, app.mode === 'og' ? 3.2 : realT);
  else if (app.mode === 'ending') renderEnding(realT);
  else renderTitle(realT);
  updateHud();
  requestAnimationFrame(frame);
}

// ---------- 共有画像用（?og=1）：第六海域「天の主機」を雷槍が貫く場面 ----------
function setupOg() {
  const s = createState({ sea: 5, fromBoss: true, practice: true, upgrades: { wing: 2, eff: 1, rate: 2 }, seed: 9 });
  for (let i = 0; i < 60 * 9.6; i++) { step(s, autopilot(s)); s.events.length = 0; }
  const b = s.boss; b.armored = false; b.hp = 7; b.y = 280; b.ai = 0; b.ph = 'fire';
  s.player.x = 230; s.player.y = 284; s.player.gauge = 0; s.player.wing = 1; s.player.inv = 0; s.player.hp = 2;
  s.bullets = s.bullets.filter((bl) => Math.abs(bl.y - 284) > 40 || bl.x < 230);
  emit(s, { pat: 'line', n: 1, speed: 185, colors: 'b' }, 600, 150); emit(s, { pat: 'line', n: 1, speed: 185, colors: 'b' }, 520, 150); emit(s, { pat: 'line', n: 1, speed: 185, colors: 'b' }, 440, 150);
  emit(s, { pat: 'line', n: 1, speed: 185, colors: 'b' }, 560, 420); emit(s, { pat: 'line', n: 1, speed: 185, colors: 'b' }, 480, 420);
  s.lances = [{ x: s.player.x + 24, y: 284, t: 0.06, power: 4, half: 20 }];
  for (const e of s.enemies) e.x = Math.max(e.x, 600);
  s.hint = ''; app.state = s;
  burst(b.x - 80, 284, 40, '#e9ffff', 200, 4);
  text(560, 230, '雷槍 最大威力', { size: 26, col: '#bffcff', life: 99 });
  setMode('og'); show(null); $('ogLogo').hidden = false;
  $('hud').hidden = true;
}

layout();
if (OG) setupOg(); else setMode('title');
requestAnimationFrame(frame);
// 動作確認用（Playwright から状態を作るため）
window.__tb = {
  app, startPractice, startCampaign, get save() { return save; },
  ff(sec) { const s = app.state; for (let i = 0; i < sec * 60 && s.phase !== 'clear' && s.phase !== 'dead'; i++) { step(s, autopilot(s)); handleEvents(s); } fx.parts.length = 0; fx.texts.length = 0; bannerTimer = 0.01; },
};
