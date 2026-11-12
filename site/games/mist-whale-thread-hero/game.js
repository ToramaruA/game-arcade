// 霧鯨と糸の勇者 — 描画・入力・画面の切り替え
import * as L from './logic.js';
import { createAudio } from './audio.js';
import { pixelCanvas } from './pixel.js';
import * as P from './pixart.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const OG = qs.has('og');
const SET_KEY = 'mist-whale-thread-hero:settings';

const storage = (() => {
  try { const s = window.localStorage; s.getItem('x'); return s; } catch { return { getItem: () => null, setItem: () => {}, removeItem: () => {} }; }
})();
const get = (k) => { try { return storage.getItem(k); } catch { return null; } };
const put = (k, v) => { try { storage.setItem(k, v); } catch { /* 保存できなくても遊べる */ } };

let save = L.deserialize(get(L.SAVE_KEY));
const settings = (() => { try { return JSON.parse(get(SET_KEY) || '{}'); } catch { return {}; } })();
let reduce = settings.reduce ?? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const persist = () => put(L.SAVE_KEY, L.serialize(save));
const audio = createAudio(storage, 'mist-whale-thread-hero:audio');

const cv = $('cv'); const out = cv.getContext('2d');
// 低い解像度のバッファに描いて、ドットのまま拡大する
const lo = document.createElement('canvas'); const ctx = lo.getContext('2d', { willReadFrequently: true });
let dpr = 1; let W = 0; let H = 0; let PIX = 3; let R = 1 / 3;
let mode = 'title';
let st = null;
let cam = { x: 0, y: 0 };
let t = 0;
let particles = [];
let rings = [];
let shake = 0;
let flash = 0;
let throwAnim = 0;
let clearTimer = 0;
let lastResult = null;
let hintText = '';

// ───────────────────────── 画面サイズ ─────────────────────────
function resize() {
  const r = cv.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = Math.max(1, r.width); H = Math.max(1, r.height);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  PIX = W < 520 ? 3 : Math.max(2, Math.min(5, Math.round(H / (OG ? 180 : 195))));
  lo.width = Math.ceil(W / PIX); lo.height = Math.ceil(H / PIX); R = lo.width / W;
}
window.addEventListener('resize', resize);
try { new ResizeObserver(() => resize()).observe(document.getElementById('cv')); } catch { /* 古いブラウザは resize だけ */ }


// ───────────────────────── 入力 ─────────────────────────
const held = { left: false, right: false, jump: false };
const keyHeld = { left: false, right: false, jump: false };
const padHeld = { left: false, right: false, jump: false };
let pend = { jump: false, thread: false };
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyJ: 'thread', KeyK: 'thread', KeyX: 'thread', KeyZ: 'jump' };
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') { if (mode === 'play') openPause(); else if (mode === 'pause') closePause(); return; }
  const k = KEYMAP[e.code];
  if (!k) { if ((e.code === 'Enter') && mode === 'title') { e.preventDefault(); $('startBtn').click(); } return; }
  if (mode !== 'play') return;
  if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
  e.preventDefault();
  audio.unlock();
  if (k === 'thread') { if (!e.repeat) pend.thread = true; return; }
  if (k === 'jump' && !e.repeat) pend.jump = true;
  keyHeld[k] = true;
});
window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k && k !== 'thread') keyHeld[k] = false; });
window.addEventListener('blur', () => { Object.keys(keyHeld).forEach((k) => { keyHeld[k] = false; padHeld[k] = false; }); });

const pad = $('pad');
function setupPad() {
  const touchy = window.matchMedia?.('(hover: none), (pointer: coarse)').matches || window.innerWidth <= 760 || qs.has('pad');
  pad.classList.toggle('show', touchy && !OG);
  for (const b of pad.querySelectorAll('.pk')) {
    const k = b.dataset.k;
    const down = (e) => {
      e.preventDefault(); audio.unlock();
      try { b.setPointerCapture(e.pointerId); } catch { /* 古い端末 */ }
      b.classList.add('on');
      if (k === 'thread') pend.thread = true; else { if (k === 'jump') pend.jump = true; padHeld[k] = true; }
    };
    const up = (e) => { e.preventDefault(); b.classList.remove('on'); if (k !== 'thread') padHeld[k] = false; };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
setupPad();
window.addEventListener('resize', () => { if (!pad.classList.contains('show') && window.innerWidth <= 760 && !OG) pad.classList.add('show'); });

function readInput() {
  held.left = keyHeld.left || padHeld.left; held.right = keyHeld.right || padHeld.right; held.jump = keyHeld.jump || padHeld.jump;
  const inp = { left: held.left, right: held.right, jump: held.jump, jumpPressed: pend.jump, threadPressed: pend.thread };
  pend = { jump: false, thread: false };
  return inp;
}

// ───────────────────────── 演出 ─────────────────────────
function burst(x, y, color, n = 12, sp = 160, life = 0.6, size = 3) {
  const k = reduce ? Math.ceil(n / 3) : n;
  for (let i = 0; i < k; i++) {
    const a = Math.random() * Math.PI * 2; const v = sp * (0.4 + Math.random() * 0.8);
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life, max: life, color, size: size * (0.6 + Math.random() * 0.8), g: 300 });
  }
}
function ring(x, y, color, r = 60, life = 0.8) { rings.push({ x, y, color, r, life, max: life }); }
function hideToast() { $('toast').classList.remove('show'); }
function toast(msg, ms = 1400) {
  const el = $('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), ms);
}

function handleEvents() {
  const p = st.player; const px = p.x + p.w / 2; const py = p.y + p.h / 2;
  for (const ev of st.events) {
    switch (ev.type) {
      case 'jump': audio.play('jump'); burst(px, p.y + p.h, 'rgba(255,255,255,.6)', 5, 60, 0.3, 2); break;
      case 'land': audio.play('land'); burst(px, p.y + p.h, 'rgba(255,255,255,.5)', 6, 70, 0.3, 2); break;
      case 'throw': audio.play('throw'); throwAnim = 0.25; break;
      case 'whiff': audio.play('whiff'); throwAnim = 0.25; break;
      case 'hit': {
        audio.play('hit'); const a = L.threadAnchor(st); if (a) { burst(a.x, a.y, colorNow(), 10, 120, 0.4, 2.5); ring(a.x, a.y, colorNow(), 26, 0.35); }
        break;
      }
      case 'bind': audio.play('bind'); break;
      case 'yank': audio.play('yank'); break;
      case 'fling': audio.play('fling'); break;
      case 'lever': audio.play('lever'); setTimeout(() => audio.play('bridge'), 120); toast('橋が鳴った！', 900); break;
      case 'switch': audio.play('bell'); audio.play('bridge'); toast('鈴が鳴って、道が開いた！', 1200); break;
      case 'bell': {
        audio.play('bell');
        const b = st.bells.find((x) => x.swing > 0.9) || st.bells[0];
        if (b) { ring(b.x, b.y, '#ffd76a', 120, 1.2); burst(b.x, b.y, '#ffe9a0', 24, 220, 1, 3); }
        if (ev.clock) toast('時計の門が開いたまま！', 1200);
        else if (ev.left > 0) toast(`鐘が鳴った！ あと${ev.left}つ`, 1300);
        else toast(st.fray ? '空を縫い止めた！ 灯台へ走れ！' : '灯台が開いた！', 1600);
        flash = reduce ? 0 : 0.4;
        break;
      }
      case 'sew': audio.play('sew'); break;
      case 'star': audio.play('star', ev.n); { const s = st.stars.find((x) => x.got && !x.fx); if (s) { s.fx = 1; burst(s.x, s.y, '#ffe680', 18, 180, 0.8, 3); ring(s.x, s.y, '#ffe680', 40, 0.5); } } updateHud(); break;
      case 'hurt': audio.play('hurt'); shake = reduce ? 0 : 0.35; burst(px, py, '#ff6a6a', 10, 150, 0.5, 3); updateHud(true); break;
      case 'fall': audio.play('fall'); updateHud(true); break;
      case 'down': audio.play('down'); toast('ミオは霧に包まれた… 灯から再開', 1600); break;
      case 'respawn': updateHud(); break;
      case 'checkpoint': audio.play('checkpoint'); toast('灯をともした', 900); break;
      case 'defeat': audio.play('defeat'); burst(ev.x, ev.y, '#e9dcff', 20, 200, 0.8, 3); ring(ev.x, ev.y, '#e9dcff', 40, 0.5); break;
      case 'eaten': audio.play('eaten'); toast('糸を食いちぎられた！', 900); burst(px, py - 10, '#ffd76a', 8, 100, 0.5, 2); break;
      case 'nothread': audio.play('nothread'); break;
      case 'lampwarn': if (nearX(ev, 500)) audio.play('lampwarn'); break;
      case 'laser': audio.play('laser'); break;
      case 'charge': audio.play('charge'); break;
      case 'dive': audio.play('dive'); break;
      case 'ripple': audio.play('ripple'); break;
      case 'splash': audio.play('splash'); break;
      case 'crumble': audio.play('crumble'); { const [c, r] = ev.k.split(',').map(Number); burst(c * L.TS + 20, r * L.TS + 6, '#f0a845', 4, 80, 0.8, 4); } break;
      case 'clock': audio.play('clock', ev.open); break;
      case 'dock': audio.play('dock'); break;
      case 'peek': audio.play('peek'); break;
      case 'grab': audio.play('grab'); shake = reduce ? 0 : Math.max(shake, 0.15); break;
      case 'flinch': audio.play('flinch'); toast('引っ込んだ…', 700); break;
      case 'clear': audio.play('clear'); clearTimer = 0.9; burst(st.exit.x, st.exit.y - 100, '#ffe680', 40, 260, 1.2, 3); break;
      default: break;
    }
  }
}
const nearX = () => true;

// ───────────────────────── HUD ─────────────────────────
const HEART_SVG = '<svg class="heart" viewBox="-1 -1 11 10" shape-rendering="crispEdges" aria-hidden="true"><g fill="#0b0716" transform="translate(0.6 0.6)"><rect x="1" y="0" width="1" height="1"/><rect x="2" y="0" width="1" height="1"/><rect x="6" y="0" width="1" height="1"/><rect x="7" y="0" width="1" height="1"/><rect x="0" y="1" width="1" height="1"/><rect x="1" y="1" width="1" height="1"/><rect x="2" y="1" width="1" height="1"/><rect x="3" y="1" width="1" height="1"/><rect x="5" y="1" width="1" height="1"/><rect x="6" y="1" width="1" height="1"/><rect x="7" y="1" width="1" height="1"/><rect x="8" y="1" width="1" height="1"/><rect x="0" y="2" width="1" height="1"/><rect x="1" y="2" width="1" height="1"/><rect x="2" y="2" width="1" height="1"/><rect x="3" y="2" width="1" height="1"/><rect x="4" y="2" width="1" height="1"/><rect x="5" y="2" width="1" height="1"/><rect x="6" y="2" width="1" height="1"/><rect x="7" y="2" width="1" height="1"/><rect x="8" y="2" width="1" height="1"/><rect x="0" y="3" width="1" height="1"/><rect x="1" y="3" width="1" height="1"/><rect x="2" y="3" width="1" height="1"/><rect x="3" y="3" width="1" height="1"/><rect x="4" y="3" width="1" height="1"/><rect x="5" y="3" width="1" height="1"/><rect x="6" y="3" width="1" height="1"/><rect x="7" y="3" width="1" height="1"/><rect x="8" y="3" width="1" height="1"/><rect x="1" y="4" width="1" height="1"/><rect x="2" y="4" width="1" height="1"/><rect x="3" y="4" width="1" height="1"/><rect x="4" y="4" width="1" height="1"/><rect x="5" y="4" width="1" height="1"/><rect x="6" y="4" width="1" height="1"/><rect x="7" y="4" width="1" height="1"/><rect x="2" y="5" width="1" height="1"/><rect x="3" y="5" width="1" height="1"/><rect x="4" y="5" width="1" height="1"/><rect x="5" y="5" width="1" height="1"/><rect x="6" y="5" width="1" height="1"/><rect x="3" y="6" width="1" height="1"/><rect x="4" y="6" width="1" height="1"/><rect x="5" y="6" width="1" height="1"/><rect x="4" y="7" width="1" height="1"/></g><g fill="#e0313f"><rect x="1" y="0" width="1" height="1"/><rect x="2" y="0" width="1" height="1"/><rect x="6" y="0" width="1" height="1"/><rect x="7" y="0" width="1" height="1"/><rect x="0" y="1" width="1" height="1"/><rect x="1" y="1" width="1" height="1"/><rect x="2" y="1" width="1" height="1"/><rect x="3" y="1" width="1" height="1"/><rect x="5" y="1" width="1" height="1"/><rect x="6" y="1" width="1" height="1"/><rect x="7" y="1" width="1" height="1"/><rect x="8" y="1" width="1" height="1"/><rect x="0" y="2" width="1" height="1"/><rect x="1" y="2" width="1" height="1"/><rect x="2" y="2" width="1" height="1"/><rect x="3" y="2" width="1" height="1"/><rect x="4" y="2" width="1" height="1"/><rect x="5" y="2" width="1" height="1"/><rect x="6" y="2" width="1" height="1"/><rect x="7" y="2" width="1" height="1"/><rect x="8" y="2" width="1" height="1"/><rect x="0" y="3" width="1" height="1"/><rect x="1" y="3" width="1" height="1"/><rect x="2" y="3" width="1" height="1"/><rect x="3" y="3" width="1" height="1"/><rect x="4" y="3" width="1" height="1"/><rect x="5" y="3" width="1" height="1"/><rect x="6" y="3" width="1" height="1"/><rect x="7" y="3" width="1" height="1"/><rect x="8" y="3" width="1" height="1"/><rect x="1" y="4" width="1" height="1"/><rect x="2" y="4" width="1" height="1"/><rect x="3" y="4" width="1" height="1"/><rect x="4" y="4" width="1" height="1"/><rect x="5" y="4" width="1" height="1"/><rect x="6" y="4" width="1" height="1"/><rect x="7" y="4" width="1" height="1"/><rect x="2" y="5" width="1" height="1"/><rect x="3" y="5" width="1" height="1"/><rect x="4" y="5" width="1" height="1"/><rect x="5" y="5" width="1" height="1"/><rect x="6" y="5" width="1" height="1"/><rect x="3" y="6" width="1" height="1"/><rect x="4" y="6" width="1" height="1"/><rect x="5" y="6" width="1" height="1"/><rect x="4" y="7" width="1" height="1"/></g><rect x="1" y="1" width="1" height="1" fill="#ffd8e0"/><rect x="2" y="1" width="1" height="1" fill="#ffa8b8"/><rect x="1" y="2" width="1" height="1" fill="#ffa8b8"/></svg>';
let lastHearts = 3;
function updateHud(pop = false) {
  if (!st) return;
  const hearts = $('hearts');
  const n = Math.max(0, st.player.hearts);
  if (hearts.childElementCount !== 3) hearts.innerHTML = HEART_SVG.repeat(3);
  [...hearts.children].forEach((h, i) => { h.classList.toggle('lost', i >= n); if (pop && i === n) { h.classList.remove('pop'); void h.getBBox?.(); h.classList.add('pop'); } });
  lastHearts = n;
  const ch = L.CHAPTERS[st.def.chapter];
  $('stageName').textContent = W < 520 ? `${ch.sub} ${st.index + 1}` : `${ch.name} ${st.index + 1}『${st.def.name}』`;
  $('starCount').querySelector('b').textContent = `${st.starsGot.size}/3`;
}
function updateSpool() {
  if (!st) return;
  const el = $('spool'); const p = st.player;
  const prog = p.tangled > 0 ? 1 - p.tangled / L.THREAD.tangle : 1 - st.cooldown / L.THREAD.cooldown;
  el.style.setProperty('--p', String(Math.max(0, Math.min(1, prog))));
  const ready = prog >= 1 && !st.thread;
  el.classList.toggle('ready', ready);
  el.classList.toggle('tangled', p.tangled > 0);
  $('spoolLabel').textContent = p.tangled > 0 ? '絡' : '糸';
  $('spoolRing').style.background = `conic-gradient(${p.tangled > 0 ? '#ff5a8a' : colorNow()} ${prog * 360}deg, rgba(255,255,255,.12) 0)`;
  pad.querySelector('.pk-t').classList.toggle('cool', !ready && !st.thread);
}
function updateHint() {
  if (!st) return;
  const col = (st.player.x + st.player.w / 2) / L.TS;
  let text = '';
  for (const h of st.def.hints || []) if (col >= h.c && col < h.c + 14) text = h.text;
  if (st.index >= 3 && save.stages[st.index]?.clear) text = '';
  if (text && pad.classList.contains('show')) text = text.replace('← → で走る ／ Space で跳ぶ', '◀▶で走る／ジャンプで跳ぶ').replace('（J ／ 糸ボタン）', '（糸ボタン）').replace('もう一度 J で', 'もう一度 糸で');
  if (text !== hintText) { hintText = text; const el = $('hint'); el.textContent = text; el.classList.toggle('off', !text); }
}

function colorNow() { return P.threadColor(save.color, t); }

// ───────────────────────── 面の開始 ─────────────────────────
function startStage(i, { restart = false } = {}) {
  const variant = OG ? 0 : L.variantFor(save, i);
  st = L.createLevelState(i, { variant });
  particles = []; rings = []; clearTimer = 0; hintText = '';
  cam.x = Math.max(0, st.player.x - 100); cam.y = L.ROWS * L.TS - 360;
  audio.setChapter(st.def.chapter);
  mode = 'play';
  showOnly('play');
  updateHud();
  if (!restart) toast(`${L.CHAPTERS[st.def.chapter].sub} ${i + 1}『${st.def.name}』`, 1500);
}

function showOnly(which) {
  $('title').hidden = which !== 'title';
  $('map').hidden = which !== 'map';
  $('hud').hidden = which !== 'play';
  $('hint').style.display = which === 'play' ? '' : 'none';
  pad.style.display = which === 'play' ? '' : 'none';
}

// ───────────────────────── 描画（ドット絵：1マス=16ドット） ─────────────────────────
function render(dt) {
  renderScene(dt);
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.imageSmoothingEnabled = false;
  out.drawImage(lo, 0, 0, lo.width * PIX * dpr, lo.height * PIX * dpr);
}
function renderScene(dt) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, lo.width, lo.height);
  if (mode === 'title' || (!st && mode !== 'map')) { renderTitle(); return; }
  if (mode === 'map') { renderMapBg(); return; }
  const w = lo.width; const h = lo.height; const K = P.K;
  const vw = w / K; const vh = h / K;
  const p = st.player;
  // カメラ（世界の単位）
  const lead = p.face > 0 ? 0.36 : 0.64;
  let tx = p.x + p.w / 2 - vw * lead;
  const lw = st.w * L.TS;
  tx = lw <= vw ? (lw - vw) / 2 : Math.max(0, Math.min(lw - vw, tx));
  const mapH = L.ROWS * L.TS;
  let ty = p.y + p.h / 2 - vh * 0.55;
  ty = vh >= mapH ? mapH - vh : Math.max(-vh * 0.35, Math.min(mapH - vh, ty));
  cam.x += (tx - cam.x) * Math.min(1, dt * 6); cam.y += (ty - cam.y) * Math.min(1, dt * 4);
  if (OG) { cam.x = p.x - vw * 0.3; cam.y = Math.min(mapH - vh, st.ogBell.y - vh * 0.32); }
  let sx = 0; let sy = 0;
  if (shake > 0) { sx = Math.round((Math.random() - 0.5) * 6 * shake); sy = Math.round((Math.random() - 0.5) * 6 * shake); }
  const ch = st.def.chapter;
  const rung = st.bells.filter((b) => !b.clock && b.rung).length;
  P.drawBackground(ctx, ch, cam.x * K, cam.y * K, w, h, t, {
    eye: st.index === 14 ? 1 : ch === 2 ? 0.45 : 0,
    cracks: st.index === 14 ? 1 - rung / 3 : ch === 2 ? 0.5 : 0,
    gold: st.index === 14 ? rung / 3 : 0,
  });
  const ox = -Math.round(cam.x * K) + sx; const oy = -Math.round(cam.y * K) + sy;
  ctx.setTransform(1, 0, 0, 1, ox, oy);
  const c0 = Math.floor(cam.x / L.TS) - 1; const c1 = Math.ceil((cam.x + vw) / L.TS) + 1;
  const r0 = Math.floor(cam.y / L.TS) - 1; const r1 = Math.ceil((cam.y + vh) / L.TS) + 1;
  P.drawWindowHouses(ctx, st, t);
  P.drawTiles(ctx, st, ch, c0, c1, r0, r1, t);
  const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0) || p.face;
  const preview = !st.thread && p.dying <= 0 ? L.pickTarget(st, dir) : null;
  P.drawObjects(ctx, st, t, preview);
  for (const e of st.enemies) P.drawEnemy(ctx, e, t);
  if (preview && preview.kind !== 'hook') P.targetRing(ctx, preview.x, preview.y, t, st.cooldown > 0 || p.tangled > 0);
  // 主人公と糸
  let pose = null;
  if (p.dying <= 0 || Math.floor(t * 10) % 2) {
    const px = p.x + p.w / 2;
    const scared = st.enemies.some((e) => !e.dead && ['warn', 'charge', 'dive', 'peek', 'reach'].includes(e.state) && Math.abs(e.x - px) < 5.5 * L.TS && Math.abs(e.y - p.y) < 4 * L.TS)
      || (st.fray && st.fray.dying <= 0 && px - st.fray.x < 6 * L.TS) || p.tangled > 0;
    pose = P.drawHero(ctx, p, t, { throwing: throwAnim > 0 || (st.thread && st.thread.phase !== 'miss'), hurt: p.invuln > 0.6 || p.dying > 0, scared, og: OG });
  }
  if (st.thread) {
    const hp = pose?.handPx || [Math.round((p.x + p.w / 2) * K), Math.round(p.y * K)];
    const th = st.thread; const to = L.threadAnchor(st);
    const prog = th.phase === 'fly' ? Math.min(1, th.t / L.THREAD.fly) : th.phase === 'miss' ? Math.min(1, th.t / 0.12) * (th.t > 0.16 ? Math.max(0, 1 - (th.t - 0.16) / 0.12) : 1) : 1;
    if (to) P.drawThread(ctx, { x: hp[0], y: hp[1] }, { x: to.x * K, y: to.y * K }, colorNow(), th.phase, prog);
  }
  if (p.tangled > 0) { ctx.fillStyle = '#ff5a8a'; for (let i = 0; i < 4; i++) ctx.fillRect(Math.round((p.x + p.w / 2) * K) - 4 + i * 3, Math.round(p.y * K) - 18 + (Math.floor(t * 8 + i) % 2), 2, 1); }
  if (st.fray) P.drawFray(ctx, st.fray, Math.round(cam.y * K) - 10, Math.round(cam.y * K) + h + 10, t);
  // 粒と輪
  for (const q of particles) { if (q.life / q.max < 0.3 && Math.floor(t * 20) % 2) continue; ctx.fillStyle = q.color; const sz = q.size > 2.5 ? 2 : 1; ctx.fillRect(Math.round(q.x * K), Math.round(q.y * K), sz, sz); }
  for (const r of rings) {
    const u = 1 - r.life / r.max; const rr = Math.round(r.r * K * (0.2 + u)); ctx.fillStyle = r.color;
    const n = Math.max(8, rr * 2); for (let i = 0; i < n; i++) { if (i % 2 && u > 0.5) continue; const a = i / n * Math.PI * 2; ctx.fillRect(Math.round(r.x * K + Math.cos(a) * rr), Math.round(r.y * K + Math.sin(a) * rr), 1, 1); }
  }
  // 画面効果
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (flash > 0) { ctx.fillStyle = `rgba(255,226,122,${flash * 0.5})`; ctx.fillRect(0, 0, w, h); }
  if (p.invuln > 0.7 && p.dying <= 0) { ctx.fillStyle = `rgba(216,40,60,${(p.invuln - 0.7) * 0.6})`; ctx.fillRect(0, 0, w, h); }
  if (p.dying > 0) { ctx.fillStyle = `rgba(244,241,232,${Math.min(0.5, (1 - p.dying) * 0.6)})`; ctx.fillRect(0, 0, w, h); }
}

function renderTitle() {
  const w = lo.width; const h = lo.height;
  P.drawBackground(ctx, 0, t * 6, 0, w, h, t, {});
  const ws = Math.max(0.7, Math.min(w / 230, h / 150));
  P.drawTitleWhale(ctx, Math.round(w * 0.6), Math.round(h * 0.42), ws, t);
  // 手前の鯨の背（地面）
  ctx.fillStyle = '#120c1c'; ctx.fillRect(0, Math.round(h * 0.86) - 1, w, h);
  ctx.fillStyle = '#5a7488'; ctx.fillRect(0, Math.round(h * 0.86), w, h);
  ctx.fillStyle = '#3a6a50'; ctx.fillRect(0, Math.round(h * 0.86), w, 3);
  ctx.fillStyle = '#24484a'; for (let x = 0; x < w; x += 3) ctx.fillRect(x, Math.round(h * 0.86) - 1 - (x % 9 === 0 ? 1 : 0), 1, 1);
  ctx.fillStyle = '#3e5468'; for (let x = 4; x < w; x += 23) ctx.fillRect(x, Math.round(h * 0.86) + 7 + (x % 3), 4, 1);
  // 主人公が星鈴へ糸を投げる（大きく）
  const sc = w < 200 ? 2 : h > 260 ? 3 : 2;
  const hx = Math.round(Math.min(w * 0.12, 50)); const jump = Math.round(Math.abs(Math.sin(t * 2.2)) * 6);
  const footY = Math.round(h * (w < 200 ? 0.7 : 0.86));
  if (w < 200) { ctx.fillStyle = '#120c1c'; ctx.fillRect(hx - 4, footY, 30 * sc + 8, 5); ctx.fillStyle = '#5a7488'; ctx.fillRect(hx - 3, footY, 30 * sc + 6, 3); ctx.fillStyle = '#3a6a50'; ctx.fillRect(hx - 3, footY, 30 * sc + 6, 1); }
  const hy = footY - 37 * sc - jump;
  const bx = Math.round(hx + Math.min(w * 0.5, 150)); const by = footY - 38 * sc - 10 + Math.round(Math.sin(t * 2) * 2);
  const hand = P.drawHeroBig(ctx, hx, hy, sc, t, { throwing: true, onGround: false, vy: -10 });
  P.drawThread(ctx, { x: hand[0], y: hand[1] }, { x: bx, y: by }, colorNow(), 'hold', 1);
  P.drawStarBell(ctx, bx, by, t, 2);
}

function renderMapBg() {
  const ch = Math.min(2, Math.floor(nextStage() / 5));
  P.drawBackground(ctx, ch, t * 6, 0, lo.width, lo.height, t, { eye: ch === 2 ? 0.6 : 0, cracks: ch === 2 ? 0.5 : 0 });
}

// ───────────────────────── ループ ─────────────────────────
let last = performance.now(); let acc = 0;
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  t += dt;
  if (mode === 'play' && st) {
    acc += dt;
    while (acc >= 1 / 60) {
      acc -= 1 / 60;
      L.step(st, readInput(), 1 / 60);
      handleEvents();
    }
    if (st.cleared && clearTimer > 0) { clearTimer -= dt; if (clearTimer <= 0) finishStage(); }
    updateSpool(); updateHint();
    audio.setTension(st.fray ? 1 : st.enemies.some((e) => e.state === 'warn' || e.state === 'charge' || e.state === 'dive') ? 0.6 : 0);
  }
  for (const q of particles) { q.life -= dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
  particles = particles.filter((q) => q.life > 0);
  for (const r of rings) r.life -= dt;
  rings = rings.filter((r) => r.life > 0);
  shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt); throwAnim = Math.max(0, throwAnim - dt);
  render(dt);
  requestAnimationFrame(frame);
}

// ───────────────────────── クリアと結果 ─────────────────────────
function finishStage() {
  mode = 'result'; hideToast(); updateHud();
  const res = L.stageResult(st);
  const before = L.unlockedColors(save);
  const firstClear = !save.stages[res.index]?.clear;
  save = L.applyClear(save, res);
  persist();
  const after = L.unlockedColors(save);
  const newColors = L.THREAD_COLORS.filter((c, i) => after[i] && !before[i]);
  lastResult = { res, firstClear };
  $('resStage').textContent = `${L.CHAPTERS[st.def.chapter].sub} ${res.index + 1}『${st.def.name}』`;
  const bells = $('resBells'); bells.innerHTML = '';
  res.stars.forEach((got, i) => {
    const c = document.createElement('canvas'); c.width = 18; c.height = 18; c.className = 'px';
    pixelCanvas(c, (g) => { if (!got) g.globalAlpha = 0.3; P.drawStarBell(g, 9, 9, got ? 0.3 + i : 0, 1); });
    c.setAttribute('aria-label', got ? '星鈴 取った' : '星鈴 まだ');
    bells.appendChild(c);
  });
  const m = Math.floor(res.time / 60); const sec = (res.time % 60).toFixed(1).padStart(4, '0');
  $('resTime').textContent = `${m}:${sec}`;
  $('resPar').textContent = `目標 ${Math.floor(st.def.par / 60)}:${String(st.def.par % 60).padStart(2, '0')}`;
  $('resHits').textContent = String(res.hits);
  $('resBadges').innerHTML = `<span class="badge ${res.noDamage ? 'on' : ''}">無傷</span><span class="badge ${res.fast ? 'on' : ''}">速い</span><span class="badge on">星鈴 ${L.totalStars(save)}/45</span>`;
  const un = $('resUnlock');
  un.hidden = !newColors.length;
  if (newColors.length) un.textContent = `新しい糸の色：${newColors.map((c) => c.name).join('・')}（星座ノートで変えられる）`;
  $('nextBtn').textContent = res.index === L.STAGE_COUNT - 1 ? '結末へ' : (res.index % 5 === 4 ? '章の終わりへ' : '次の面へ');
  $('result').hidden = false;
  $('nextBtn').focus({ preventScroll: true });
}

function nextStage() { for (let i = 0; i < L.STAGE_COUNT; i++) if (!save.stages[i]?.clear) return i; return L.STAGE_COUNT - 1; }

$('nextBtn').addEventListener('click', () => {
  audio.play('ui');
  $('result').hidden = true;
  const i = lastResult.res.index;
  if (i % 5 === 4) showStory(Math.floor(i / 5));
  else if (i + 1 < L.STAGE_COUNT) startStage(i + 1);
  else openMap();
});
$('againBtn').addEventListener('click', () => { audio.play('ui'); $('result').hidden = true; startStage(lastResult.res.index); });
$('resMapBtn').addEventListener('click', () => { audio.play('ui'); $('result').hidden = true; openMap(); });

let storyCh = 0;
function showStory(ch) {
  mode = 'story'; storyCh = ch;
  const S = L.STORY[ch];
  $('storyHead').textContent = `${L.CHAPTERS[ch].sub}『${L.CHAPTERS[ch].name}』のおわり`;
  $('storyLines').innerHTML = S.lines.map((l, i) => `<p style="animation-delay:${reduce ? 0 : i * 0.7}s">${l}</p>`).join('');
  const full = L.chapterStars(save, ch) >= 15;
  $('storySecret').hidden = !full;
  $('storySecret').textContent = S.secret;
  if (!full) { $('storySecret').hidden = false; $('storySecret').textContent = `この章の星鈴 ${L.chapterStars(save, ch)}/15 ── 全部集めると、隠された回想が読める。`; }
  save.seen[`story${ch}`] = true; persist();
  $('story').hidden = false;
}
$('storyBtn').addEventListener('click', () => {
  audio.play('ui'); $('story').hidden = true;
  if (storyCh === 2) showEnding();
  else if ((storyCh + 1) * 5 < L.STAGE_COUNT) startStage((storyCh + 1) * 5);
  else openMap();
});

function showEnding() {
  mode = 'story';
  const key = L.endingFor(save); const E = L.ENDINGS[key];
  save.seen[`end_${key}`] = true; persist();
  $('endTitle').textContent = `『${E.title}』`;
  $('endText').textContent = E.text;
  $('endStats').textContent = `星鈴 ${L.totalStars(save)}/45 ・ 評価 ${L.badgeCount(save)}/30 ・ 見た結末 ${Object.keys(L.ENDINGS).filter((k) => save.seen[`end_${k}`]).length}/3`;
  $('ending').hidden = false;
}
$('endBtn').addEventListener('click', () => { audio.play('ui'); $('ending').hidden = true; openMap(); });

// ───────────────────────── 地図 ─────────────────────────
function openMap() {
  mode = 'map'; st = null; showOnly('map');
  $('mapTotal').querySelector('b').textContent = `${L.totalStars(save)}/45`;
  const nx = nextStage();
  const bands = ['#8fd17e', '#3f9d86', '#d6b45a'];
  $('chapters').innerHTML = L.CHAPTERS.map((c, ci) => {
    const open = L.isChapterUnlocked(save, ci);
    const nodes = L.LEVELS.map((lv, i) => ({ lv, i })).filter((o) => o.lv.chapter === ci).map(({ lv, i }) => {
      const s = save.stages[i]; const un = L.isUnlocked(save, i);
      const stars = [0, 1, 2].map((j) => (s?.stars[j] ? '<span>●</span>' : '<span class="off">○</span>')).join('');
      return `<button type="button" class="node ${s?.clear ? 'clear' : ''} ${i === nx && !s?.clear ? 'next' : ''}" data-i="${i}" ${un ? '' : 'disabled'}>
        <span class="no">${i + 1}</span><span class="nm">${un ? lv.name : '？？？'}<small>${un ? lv.gimmick : 'ひとつ前の面をクリアすると開く'}</small></span><span class="st">${stars}</span></button>`;
    }).join('');
    return `<section class="chap ${open ? '' : 'locked'}" style="--band:${bands[ci]}"><h3><span>${c.sub}『${c.name}』</span><span class="cstars">星鈴 ${L.chapterStars(save, ci)}/15</span></h3><div class="nodes">${nodes}</div></section>`;
  }).join('');
  for (const b of $('chapters').querySelectorAll('.node')) b.addEventListener('click', () => { audio.unlock(); audio.play('ui'); startStage(Number(b.dataset.i)); });
  const nb = $('chapters').querySelector('.node.next') || $('chapters').querySelector('.node:not([disabled])');
  nb?.scrollIntoView({ block: 'nearest' });
}
$('mapBack').addEventListener('click', () => { audio.play('ui'); mode = 'title'; showOnly('title'); });
$('startBtn').addEventListener('click', () => {
  audio.unlock(); audio.play('ui');
  if (L.clearedCount(save) === 0) startStage(0); else openMap();
});

// ───────────────────────── 一時停止 ─────────────────────────
function openPause() {
  if (mode !== 'play') return;
  mode = 'pause'; hideToast();
  $('pauseInfo').textContent = `${st.index + 1}『${st.def.name}』 星鈴 ${st.starsGot.size}/3 ・ 被弾 ${st.hits}`;
  $('pause').hidden = false; $('resumeBtn').focus({ preventScroll: true });
}
function closePause() { $('pause').hidden = true; mode = 'play'; last = performance.now(); }
$('menuBtn').addEventListener('click', () => { audio.play('ui'); openPause(); });
$('resumeBtn').addEventListener('click', () => { audio.play('ui'); closePause(); });
$('retryBtn').addEventListener('click', () => { audio.play('ui'); $('pause').hidden = true; startStage(st.index, { restart: true }); });
$('toMapBtn').addEventListener('click', () => { audio.play('ui'); $('pause').hidden = true; openMap(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play' && !OG) openPause(); });

// ───────────────────────── 星座ノート ─────────────────────────
let noteReturn = null; let noteTab = 'bells';
function openNote(tab = 'bells') {
  noteReturn = mode; if (mode === 'pause') $('pause').hidden = true;
  mode = 'note'; noteTab = tab; renderNote(); $('note').hidden = false;
}
function closeNote() {
  $('note').hidden = true;
  mode = noteReturn || 'title';
  if (mode === 'pause') $('pause').hidden = false;
  if (mode === 'map') openMap();
}
$('noteClose').addEventListener('click', () => { audio.play('ui'); closeNote(); });
$('titleNoteBtn').addEventListener('click', () => { audio.unlock(); audio.play('ui'); openNote(); });
$('mapNoteBtn').addEventListener('click', () => { audio.play('ui'); openNote(); });
$('pauseNoteBtn').addEventListener('click', () => { audio.play('ui'); openNote('how'); });
for (const b of $('noteTabs').querySelectorAll('button')) b.addEventListener('click', () => { audio.play('ui'); noteTab = b.dataset.tab; renderNote(); });

const FOES = [
  { kind: 'moth', name: '影蛾', text: '近づくと「！」のあと突っこむ。縛って J で引けば、鈴やいばらへ投げられる。' },
  { kind: 'bee', name: '鎧蜂', text: '地をはう重い蜂。身をかがめたら突進の合図。跳んでかわす。' },
  { kind: 'lamp', name: '牙灯', text: '赤い点線のあとに光線。糸で引くと向きが変わる。光線は敵も消す。' },
  { kind: 'serpent', name: '海蛇', text: '霧の川の波紋から跳ねる。縛ると2.6秒、背中が橋になる。' },
  { kind: 'eater', name: '糸喰い', text: '糸の近くに寄ると食いちぎる。しばらく糸が使えない。' },
  { kind: 'window', name: '窓の顔', text: '近づくと窓からぬっと顔を出し、見つめた場所へ長い腕を伸ばす。糸をかけると引っ込む。' },
  { kind: 'fray', name: '夢のほつれ', text: '最後の面で後ろから迫る。鐘を鳴らすと押し返せる。' },
];

function renderNote() {
  for (const b of $('noteTabs').querySelectorAll('button')) b.setAttribute('aria-current', String(b.dataset.tab === noteTab));
  const body = $('noteBody');
  if (noteTab === 'bells') {
    body.innerHTML = L.CHAPTERS.map((c, ci) => `<h3><span>${c.sub}『${c.name}』</span><small>${L.chapterStars(save, ci)}/15</small></h3>` + L.LEVELS.map((lv, i) => ({ lv, i })).filter((o) => o.lv.chapter === ci).map(({ lv, i }) => {
      const s = save.stages[i]; const un = L.isUnlocked(save, i);
      if (!un) return `<div class="nrow lock"><span>${i + 1}. ？？？</span><span class="b"><span class="off">○○○</span></span><span class="tags">未到達</span></div>`;
      const stars = [0, 1, 2].map((j) => (s?.stars[j] ? '●' : '<span class="off">○</span>')).join('');
      const tags = s?.clear ? `${s.nd ? '無傷 ' : ''}${s.fast ? '速い ' : ''}${s.best != null ? `${s.best}秒` : ''}` : 'まだ';
      return `<div class="nrow"><span>${i + 1}. ${lv.name}</span><span class="b">${stars}</span><span class="tags">${tags}</span></div>`;
    }).join('')).join('') + `<p class="muted">星鈴 ${L.totalStars(save)}/45 ・ 無傷と速いの評価 ${L.badgeCount(save)}/30</p>`;
  } else if (noteTab === 'colors') {
    const un = L.unlockedColors(save);
    body.innerHTML = `<p>星鈴を集めると、糸の色が増える。</p><div class="colors">${L.THREAD_COLORS.map((c, i) => `<button type="button" class="cswatch ${save.color === i ? 'sel' : ''}" data-i="${i}" ${un[i] ? '' : 'disabled'} style="--c:${c.c === 'rainbow' ? 'linear-gradient(90deg,#ff6a6a,#ffd76a,#9fe07a,#7fd4ff,#c49cff)' : c.c}"><i></i>${un[i] ? c.name : '？？？'}<small>${un[i] ? (save.color === i ? '使用中' : 'えらぶ') : `星鈴${c.need}個`}</small></button>`).join('')}</div>`;
    for (const b of body.querySelectorAll('.cswatch')) b.addEventListener('click', () => { save.color = Number(b.dataset.i); persist(); audio.play('hit'); renderNote(); });
  } else if (noteTab === 'memory') {
    body.innerHTML = L.STORY.map((S, ci) => {
      const seen = save.seen[`story${ci}`];
      if (!seen) return `<div class="mem"><b>${L.CHAPTERS[ci].sub}</b><p class="muted" style="text-align:left">章の最後の面をクリアすると読める。</p></div>`;
      const full = L.chapterStars(save, ci) >= 15;
      return `<div class="mem"><b>${L.CHAPTERS[ci].sub}『${L.CHAPTERS[ci].name}』</b>${S.lines.map((l) => `<p>${l}</p>`).join('')}<p class="secret">${full ? S.secret : `隠された回想：この章の星鈴 ${L.chapterStars(save, ci)}/15`}</p></div>`;
    }).join('') + `<h3>結末</h3>` + Object.entries(L.ENDINGS).map(([k, E]) => `<div class="mem"><b>${save.seen[`end_${k}`] ? `『${E.title}』` : '？？？'}</b>${save.seen[`end_${k}`] ? `<p>${E.text}</p>` : ''}</div>`).join('') + '<p class="muted">結末は星鈴の数と評価で変わる（3種）。</p>';
  } else if (noteTab === 'how') {
    body.innerHTML = `<h3>ミオ</h3><p>霧鯨の夢を縫う「夢縫い」の見習い子猫。武器はぶかぶかの指ぬきの兜と、背丈より長い縫い針だけ。こわがりで、こわいものが来ると兜をかぶって縮こまる。</p><h3>操作</h3><div class="keys"><span><kbd>←</kbd><kbd>→</kbd> / <kbd>A</kbd><kbd>D</kbd></span><span>走る</span><span><kbd>Space</kbd> / <kbd>↑</kbd></span><span>ジャンプ（長押しで高く）</span><span><kbd>J</kbd></span><span>糸を投げる・縛った敵を引く</span><span><kbd>Esc</kbd></span><span>一時停止</span></div>
      <p>スマホは画面下の4つのボタン。左右とジャンプ・糸は同時に押せる。</p>
      <h3>糸</h3><p>押した方向（なければ向いている方向）の、届く範囲で一番近い対象に自動でかかる。金の輪が出ているのが次の標的。</p>
      <ul><li><b>金のフック</b>：その場所まで一気に飛ぶ。空中でも投げられる。</li><li><b>レバー・鐘</b>：引くと橋が出る・扉が開く・灯台が開く。</li><li><b>敵</b>：1秒縛る。縛っている間にもう一度 J で手元へ引き寄せる。鈴スイッチに通す・いばらに落とす・別の敵にぶつけると倒せる。</li><li><b>種・雲の舟</b>：手元へ引き寄せる。舟に乗ってフックへ投げると舟ごと進む。</li></ul>
      <p>投げたあと0.6秒は次が投げられない（左上の糸巻きが満ちたらOK）。</p>
      <h3>ハートと灯</h3><p>ハートは3つ。なくなると最後にともした灯から、ハート3つで再開。星鈴はその面をクリアしたときに記録される。</p>
      <h3>敵</h3><div class="foes">${FOES.map((f) => `<div class="foe"><canvas width="60" height="46" class="px" data-k="${f.kind}"></canvas><b>${f.name}</b>${f.text}</div>`).join('')}</div>`;
    for (const c of body.querySelectorAll('.foe canvas')) drawFoe(c, c.dataset.k);
  } else {
    body.innerHTML = `<div class="setting"><span>音</span><button type="button" class="toggle" id="setMute" aria-pressed="${!audio.state.muted}">${audio.state.muted ? 'オフ' : 'オン'}</button></div>
      <div class="setting"><span>動きを減らす（画面ゆれ・粒を減らす）</span><button type="button" class="toggle" id="setReduce" aria-pressed="${reduce}">${reduce ? 'オン' : 'オフ'}</button></div>
      <div class="setting"><span>記録を消す</span><button type="button" class="toggle" id="setWipe">消す</button></div>`;
    $('setMute').addEventListener('click', () => { audio.setMuted(!audio.state.muted); renderNote(); });
    $('setReduce').addEventListener('click', () => { reduce = !reduce; settings.reduce = reduce; put(SET_KEY, JSON.stringify(settings)); renderNote(); });
    $('setWipe').addEventListener('click', () => { if (window.confirm('星鈴と進行の記録をすべて消しますか？')) { save = L.newSave(); persist(); renderNote(); } });
  }
}

function drawFoe(c, kind) { pixelCanvas(c, (g) => P.drawFoeIcon(g, kind, 0.3)); }

// ───────────────────────── OG（共有画像） ─────────────────────────
function setupOg() {
  document.body.classList.add('og');
  const card = document.createElement('div'); card.className = 'og-card';
  card.innerHTML = '<div class="t">霧鯨と糸の勇者</div><div class="s">走れ、跳べ、光の糸を投げろ。</div>';
  $('stage').appendChild(card);
  save.color = 0;
  st = L.createLevelState(14);
  const bell = st.bells.reduce((a, b) => (b.x < a.x ? b : a));
  st.ogBell = bell;
  st.tiles = st.tiles.map((r) => r.replace(/X/g, '.'));
  for (const e of st.enemies) if (e.kind === 'eater') e.dead = true;
  st.player.x = bell.x - 120; st.player.y = 7.4 * L.TS; st.player.onGround = false; st.player.vx = 200; st.player.vy = -120; st.player.face = 1; st.player.anim = 30; st.player.invuln = 0;
  st.thread = { phase: 'hold', t: 0, target: { kind: 'bell', ref: bell }, release: 99 };
  st.fray.x = st.player.x - 190;
  for (const e of st.enemies) if (e.kind === 'bee') { e.x = st.player.x + 110; e.face = -1; e.state = 'warn'; }
  st.starsGot.add(0); st.stars[0].got = true;
  mode = 'og'; showOnly('play'); updateHud();
  const loopOg = () => { t += 1 / 60; render(1); requestAnimationFrame(loopOg); };
  resize(); requestAnimationFrame(loopOg);
}

// ───────────────────────── 起動 ─────────────────────────
resize();
if (OG) setupOg();
else {
  showOnly('title');
  if (qs.has('stage')) { const i = Math.max(0, Math.min(L.STAGE_COUNT - 1, Number(qs.get('stage')) - 1)); startStage(i); }
  requestAnimationFrame(frame);
}

// テストと確認用
window.__mwth = {
  get st() { return st; }, get mode() { return mode; }, get save() { return save; },
  start: (i) => startStage(i), openMap, openNote, showStory, showEnding,
  setSave(o) { save = L.deserialize(JSON.stringify(o)); persist(); },
  finish() { if (st) { st.cleared = true; finishStage(); } },
};
