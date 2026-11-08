import {
  W, H, FIXED_DT, createBattle, fire, recall, canRecall, step, previewAim, previewReturn, clampAngle,
  evaluateWin, buildMemorial, shareText, recordResult, normalizeProgress, isCleared, isUnlocked, lockReason,
  totalStars, pinMemorial, unpinMemorial, SAVE_KEY, OUT_WARN,
} from './logic.js';
import { LEVELS, BEASTS } from './levels.js';
import { REPLAYS } from './replays.js';
import { drawBattle, drawMemorial, drawBeastThumb, makeMotes, spawnBreak, spawnSpark, stepParticles } from './render.js';
import * as audio from './audio.js';

const $ = (id) => document.getElementById(id);
const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const OG = params.get('og') === '1';

// ───── 保存（失敗してもセッション内で進める）─────
let progress = normalizeProgress(null);
try { progress = normalizeProgress(JSON.parse(localStorage.getItem(SAVE_KEY))); } catch { /* メモリのみ */ }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch { /* 無視 */ } }

// ───── 状態 ─────
const canvas = $('board'); const ctx = canvas.getContext('2d');
const motes = makeMotes();
let b = null; let levelIndex = 0; let practice = false; let speed = 1;
let paused = false; let acc = 0; let last = null; let time = 0;
let kAngle = 0; let aim = null; let pointerAim = null;
let parts = []; let retPrev = null; let retFrame = 0; let sample = null; let sampleOn = false;
let aimCache = { key: '', pts: [] };
let resultTimer = null; let toastTimer = null;
const lastSound = {};

function toast(msg, ms = 2400) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
function snd(name, ...a) {
  const now = performance.now();
  if (now - (lastSound[name] || 0) < 35) return;
  lastSound[name] = now; audio.sfx[name]?.(...a);
}

// ───── 画面切り替え ─────
function show(name) {
  for (const id of ['battle', 'menu', 'memorials']) $(id).hidden = id !== name;
  if (name === 'battle') resizeCanvas();
}

function stars(r) { return r ? `${r.clear ? '◆' : '◇'}${r.par ? '◆' : '◇'}${r.perfect ? '◆' : '◇'}` : '◇◇◇'; }

function renderMenu() {
  const box = $('chapters'); box.textContent = '';
  BEASTS.forEach((beast, bi) => {
    const first = LEVELS.findIndex((l) => l.beast === bi);
    const locked = !isUnlocked(progress, LEVELS, first);
    const card = document.createElement('div'); card.className = 'chap' + (locked ? ' locked' : '');
    const cv = document.createElement('canvas'); cv.width = 520; cv.height = 300; cv.setAttribute('aria-label', beast.full);
    card.append(cv);
    const h = document.createElement('h3'); h.textContent = `${bi + 1}章　${beast.full}${locked ? '　🔒' : ''}`; card.append(h);
    LEVELS.forEach((l, i) => {
      if (l.beast !== bi) return;
      const un = isUnlocked(progress, LEVELS, i);
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'lv'; btn.disabled = !un;
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = l.name;
      const sm = document.createElement('small'); sm.textContent = un ? `球${l.ammo}・規定${l.par}球` : `🔒 ${lockReason(LEVELS, i)}`; nm.append(sm);
      const st = document.createElement('span'); st.className = 'st'; st.textContent = un ? stars(progress.levels[l.id]) : '🔒';
      btn.append(nm, st); btn.addEventListener('click', () => { audio.start(); startLevel(i); });
      card.append(btn);
    });
    box.append(card);
    drawBeastThumb(cv.getContext('2d'), bi, 520, 300, 0);
  });
  $('stars').textContent = `◆ ${totalStars(progress, LEVELS)} / ${LEVELS.length * 3}`;
}

function continueIndex() {
  for (let i = 0; i < LEVELS.length; i++) if (isUnlocked(progress, LEVELS, i) && !isCleared(progress, LEVELS[i].id)) return i;
  return LEVELS.length - 1;
}

// ───── 戦い ─────
function startLevel(i) {
  levelIndex = i; const level = LEVELS[i];
  b = createBattle(level); practice = speed !== 1; acc = 0; last = null; paused = false;
  parts = []; retPrev = null; sample = null; sampleOn = false; kAngle = 0; aim = null; pointerAim = null; aimCache = { key: '', pts: [] };
  clearTimeout(resultTimer); $('overlay').hidden = true;
  $('lv-name').textContent = level.name;
  $('btn-sample').hidden = level.id !== 'deer1';
  $('btn-sample').textContent = '見本の射線を出す';
  $('aimhint').textContent = i === 0 && !progress.seenIntro ? '↓ 下へ引いて狙う → 離して撃つ' : '引いて狙う → 離して撃つ（飛行中に呼び戻すと一直線に戻る）';
  show('battle'); updateHud(); renderGoals();
  if (i === 0 && !progress.seenIntro) toast('下の余白を引いて狙い、離して撃つ');
  else toast(level.tip, 3200);
}

function updateHud() {
  const ammo = $('ammo'); ammo.textContent = '';
  for (let i = 0; i < b.level.ammo; i++) { const d = document.createElement('span'); d.className = 'dot' + (i < b.ammo ? '' : ' off'); ammo.append(d); }
  const hs = b.level.pieces.filter((p) => p.kind === 'heart').map((p) => (b.gone[p.id] ? '◇◇' : (b.hp[p.id] >= 2 ? '◆◆' : '◆◇')));
  $('hearts').textContent = `心 ${hs.join(' ')}`;
  ammo.title = `残り${b.ammo}球`;
  $('btn-recall').disabled = !canRecall(b);
}

function renderGoals() {
  const r = progress.levels[b.level.id]; const pr = progress.practice[b.level.id];
  const g = $('goals'); g.textContent = '';
  const items = [['撃破', r?.clear], [`${b.level.par}球以内で撃破`, r?.par], ['全破壊（硝子と薄金鏡をすべて割ってから最後の心臓）', r?.perfect]];
  for (const [t, on] of items) { const d = document.createElement('div'); d.className = 'g' + (on ? ' on' : ''); d.textContent = `${on ? '◆' : '◇'} ${t}`; g.append(d); }
  $('side-beast').textContent = `${BEASTS[b.level.beast].full}　${b.level.name}`;
  $('side-tip').textContent = b.level.tip;
  const sg = $('side-goals'); sg.textContent = ''; sg.append(...Array.from(g.children).map((n) => n.cloneNode(true)));
  if (pr?.clear) { const d = document.createElement('div'); d.textContent = `練習速度では撃破済み（最少${pr.best}球・記録は別）`; g.append(d); }
}

function currentAngle() { return pointerAim && pointerAim.angle != null ? pointerAim.angle : kAngle; }

function doFire() {
  if (!b || paused || b.status !== 'aim') return false;
  const angle = currentAngle();
  if (pointerAim && pointerAim.angle == null) return false;
  audio.start();
  if (!fire(b, angle)) return false;
  if (!progress.seenIntro) { progress.seenIntro = true; save(); }
  snd('launch'); updateHud(); retPrev = null;
  $('aimhint').textContent = '飛行中：呼び戻すと一直線に戻り、帰り道でも攻撃';
  return true;
}
function doRecall() {
  if (!b || paused) return;
  if (recall(b)) { snd('recall'); updateHud(); retPrev = null; }
}

function handleEvents() {
  const ev = b.events; if (!ev.length) return;
  for (const e of ev.splice(0)) {
    if (e.type === 'wall') continue;
    const piece = e.id ? b.level.pieces.find((p) => p.id === e.id) : null;
    if (e.type === 'armor') { snd('armor'); spawnSpark(parts, e.x, e.y, '#ffffff'); }
    else if (e.type === 'bell') { snd('bell'); spawnSpark(parts, e.x, e.y, '#F5C76A'); }
    else if (piece) {
      if (e.broken) { snd(piece.kind === 'heart' ? 'heart' : 'glass', e.chain); spawnBreak(parts, piece, reduced); if (piece.kind === 'heart') snd('heart'); }
      else { snd(piece.kind === 'heart' ? 'heart' : 'glassHit'); spawnSpark(parts, e.x, e.y, '#F5C76A'); }
    }
  }
  updateHud();
}

function onShotEnd() {
  updateHud(); retPrev = null;
  $('aimhint').textContent = '引いて狙う → 離して撃つ（飛行中に呼び戻すと一直線に戻る）';
  if (b.shot?.stop) { snd('fail'); toast('鉛の装甲に止められた（×）'); }
  if (b.status === 'won' || b.status === 'lost') {
    const win = evaluateWin(b);
    if (win) { recordResult(progress, b.level.id, win, practice); snd('win'); }
    else snd('lose');
    const mem = buildMemorial(b, win);
    const id = `${b.level.id}@${mem.at}`;
    for (const k of Object.keys(progress.memorials)) if (k.startsWith(`${b.level.id}@`) && !progress.pins.includes(k)) delete progress.memorials[k];
    progress.memorials[id] = mem; save();
    resultTimer = setTimeout(() => showResult(win, id, mem), reduced ? 300 : 900);
  }
}

function showResult(win, memId, mem) {
  const ov = $('overlay'); ov.textContent = '';
  const p = document.createElement('div'); p.className = 'panel';
  const h = document.createElement('h3'); h.textContent = win ? '砕いた！' : '未撃破…'; p.append(h);
  const t = document.createElement('p'); t.textContent = win ? `${b.shots}球で撃破${practice ? '（練習速度・記録は別）' : ''}` : '球を使い切った。同じ戦いにすぐ再挑戦できる。'; p.append(t);
  if (win) {
    for (const [label, on] of [['撃破', true], [`${b.level.par}球以内`, win.par], ['全破壊', win.perfect]]) {
      const l = document.createElement('div'); l.className = 'goal-line' + (on ? ' on' : ''); l.innerHTML = '<span></span><span></span>';
      l.children[0].textContent = label; l.children[1].textContent = on ? '◆ 達成' : '◇ まだ'; p.append(l);
    }
  }
  const row = document.createElement('div'); row.className = 'row';
  const mk = (txt, fn, cls = 'chip') => { const x = document.createElement('button'); x.type = 'button'; x.className = cls; x.textContent = txt; x.addEventListener('click', fn); row.append(x); };
  if (win && levelIndex + 1 < LEVELS.length) mk('次の戦い', () => startLevel(levelIndex + 1), 'primary');
  mk('もう一度', () => startLevel(levelIndex), win ? 'chip' : 'primary');
  mk('記念窓', () => openMemview(memId));
  mk('選択へ', toMenu);
  p.append(row); ov.append(p); ov.hidden = false;
  renderGoals();
}

function toMenu() { clearTimeout(resultTimer); $('overlay').hidden = true; b = null; renderMenu(); show('menu'); }

function setPaused(v) {
  if (!b || b.status === 'won' || b.status === 'lost') return;
  paused = v; last = null;
  $('btn-pause').textContent = v ? '再開' : '一時停止';
  const ov = $('overlay');
  if (v) {
    ov.textContent = '';
    const p = document.createElement('div'); p.className = 'panel';
    p.innerHTML = '<h3>一時停止</h3><p>時間も判定も止まっています。</p>';
    const row = document.createElement('div'); row.className = 'row';
    for (const [txt, fn, cls] of [['再開', () => setPaused(false), 'primary'], ['やり直し', () => startLevel(levelIndex), 'chip'], ['選択へ', toMenu, 'chip']]) {
      const x = document.createElement('button'); x.type = 'button'; x.className = cls; x.textContent = txt; x.addEventListener('click', fn); row.append(x);
    }
    p.append(row); ov.append(p); ov.hidden = false;
  } else ov.hidden = true;
}

// ───── ループ ─────
function frame(now) {
  requestAnimationFrame(frame);
  if (!b || $('battle').hidden) { last = null; return; }
  const dtReal = last == null ? 0 : Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) {
    time += dtReal;
    if (b.status === 'fly') {
      acc += dtReal * speed;
      let guard = 0;
      while (acc >= FIXED_DT && b.status === 'fly' && guard++ < 40) {
        step(b); acc -= FIXED_DT;
        if (b.events.length) handleEvents();
        if (b.status !== 'fly') { onShotEnd(); break; }
      }
      if (b.status === 'fly') {
        if (b.shot.t > OUT_WARN && b.shot.mode === 'out') $('aimhint').textContent = 'まもなく往路が終わる…';
        retFrame = (retFrame + 1) % 3;
        if (retFrame === 0 || !retPrev) retPrev = previewReturn(b);
        const rb = $('btn-recall'); const ok = canRecall(b);
        rb.disabled = !ok;
        const lit = !!(ok && retPrev && retPrev.hearts.some((id) => !b.gone[id]));
        rb.classList.toggle('glow', lit); rb.classList.toggle('ready', ok);
      }
    } else {
      acc = 0;
      $('btn-recall').classList.remove('glow', 'ready'); $('btn-recall').disabled = true;
    }
    stepParticles(parts, dtReal * (speed === 1 ? 1 : speed));
  }
  // 照準
  if (b.status === 'aim' && !OG) {
    const a = currentAngle();
    const key = `${a.toFixed(2)}|${b.shots}|${Object.keys(b.gone).length}|${Object.values(b.hp).join()}`;
    if (key !== aimCache.key) aimCache = { key, pts: previewAim(b, a, 2) };
    aim = { angle: a, pts: aimCache.pts };
  } else aim = null;
  drawBattle(ctx, { battle: b, time, motes, aim, retPrev: b.status === 'fly' ? retPrev : null, parts, sample: sampleOn ? sample : null });
}

// ───── 入力 ─────
function pointerHandlers(el, accept) {
  el.addEventListener('pointerdown', (e) => {
    if (!b || paused || b.status !== 'aim') return;
    if (accept && !accept(e)) return;
    audio.start();
    el.setPointerCapture?.(e.pointerId);
    pointerAim = { sx: e.clientX, sy: e.clientY, angle: null, id: e.pointerId };
    $('aimpad').classList.add('active');
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (!pointerAim || e.pointerId !== pointerAim.id) return;
    const dx = pointerAim.sx - e.clientX; const dy = e.clientY - pointerAim.sy;
    const dist = Math.hypot(dx, dy);
    pointerAim.angle = dist >= 18 && dy > 8 ? clampAngle((Math.atan2(dx, dy) * 180) / Math.PI) : null;
  });
  const end = (e, fireIt) => {
    if (!pointerAim || e.pointerId !== pointerAim.id) return;
    const ok = fireIt && pointerAim.angle != null;
    const a = pointerAim.angle;
    pointerAim = null; $('aimpad').classList.remove('active');
    if (ok) { kAngle = a; pointerAim = null; doFire(); } else if (fireIt) toast('もう少し引いてから離す');
  };
  el.addEventListener('pointerup', (e) => end(e, true));
  el.addEventListener('pointercancel', (e) => end(e, false));
}
pointerHandlers($('aimpad'));
pointerHandlers(canvas, (e) => { const r = canvas.getBoundingClientRect(); return (e.clientY - r.top) / r.height > 0.55; });

window.addEventListener('keydown', (e) => {
  if ($('battle').hidden || !b || $('memview').hidden === false) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    if (b.status === 'aim' && !paused) { kAngle = clampAngle(Math.round(kAngle) + (e.key === 'ArrowLeft' ? -1 : 1)); pointerAim = null; e.preventDefault(); }
  } else if (e.key === 'Enter') { if (b.status === 'aim' && !paused) { e.preventDefault(); doFire(); } }
  else if (e.key === ' ') { e.preventDefault(); doRecall(); }
  else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') setPaused(!paused);
  else if (e.key === 'r' || e.key === 'R') startLevel(levelIndex);
});

$('btn-recall').addEventListener('pointerdown', (e) => { e.preventDefault(); doRecall(); });
$('btn-pause').addEventListener('click', () => setPaused(!paused));
$('btn-retry').addEventListener('click', () => startLevel(levelIndex));
$('btn-menu').addEventListener('click', toMenu);
$('btn-speed').addEventListener('click', () => {
  speed = speed === 1 ? 0.65 : 1; $('btn-speed').setAttribute('aria-pressed', String(speed !== 1));
  if (speed !== 1 && b) practice = true;
  toast(speed !== 1 ? '練習速度：この戦いの記録は練習として別に保存' : '通常速度');
});
$('btn-sound').addEventListener('click', () => { progress.muted = !progress.muted; applyAudio(); save(); });
$('vol').addEventListener('input', (e) => { progress.volume = Number(e.target.value) / 100; progress.muted = false; applyAudio(); save(); });
$('btn-sample').addEventListener('click', () => {
  sampleOn = !sampleOn;
  if (sampleOn) { const a = REPLAYS[b.level.id].clear.path[0].angle; sample = previewAim(b, a, 3); }
  $('btn-sample').textContent = sampleOn ? '見本の射線を消す' : '見本の射線を出す';
});
function applyAudio() {
  audio.setVolume(progress.volume, progress.muted);
  $('btn-sound').setAttribute('aria-pressed', String(progress.muted)); $('btn-sound').textContent = progress.muted ? '音 OFF' : '音 ON';
  $('vol').value = String(Math.round(progress.volume * 100));
}
document.addEventListener('visibilitychange', () => { if (document.hidden && b && !paused && b.status !== 'won' && b.status !== 'lost') setPaused(true); last = null; });

$('btn-continue').addEventListener('click', () => { audio.start(); startLevel(continueIndex()); });
$('btn-memorials').addEventListener('click', () => { renderMemorials(); show('memorials'); });
$('mem-back').addEventListener('click', () => { renderMenu(); show('menu'); });

// ───── 記念窓 ─────
let viewing = null;
function memList() {
  return Object.entries(progress.memorials)
    .map(([id, m]) => ({ id, m, level: LEVELS.find((l) => l.id === m.levelId) })).filter((x) => x.level)
    .sort((a, c) => (progress.pins.includes(c.id) ? 1 : 0) - (progress.pins.includes(a.id) ? 1 : 0) || c.m.at - a.m.at);
}
function renderMemorials() {
  const box = $('mem-list'); box.textContent = '';
  const list = memList();
  if (!list.length) { const p = document.createElement('p'); p.className = 'lead'; p.textContent = 'まだ記念窓はありません。戦いの最後の1射で窓ができます。'; box.append(p); return; }
  for (const { id, m, level } of list) {
    const d = document.createElement('div'); d.className = 'mem-item' + (progress.pins.includes(id) ? ' pinned' : '');
    const cv = document.createElement('canvas'); cv.width = 240; cv.height = 300; drawMemorial(cv.getContext('2d'), level, m, 240, 300);
    const lb = document.createElement('div'); lb.textContent = `${progress.pins.includes(id) ? '★ ' : ''}${level.name}　${m.result === 'won' ? m.shots + '球撃破' : '未撃破'}`;
    const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'chip'; bt.textContent = '開く';
    bt.addEventListener('click', () => openMemview(id));
    d.append(cv, lb, bt); box.append(d);
  }
}
function openMemview(id) {
  const m = progress.memorials[id]; if (!m) return;
  const level = LEVELS.find((l) => l.id === m.levelId);
  viewing = { id, m, level };
  drawMemorial($('memcanvas').getContext('2d'), level, m, 480, 600);
  $('memtext').value = shareText(m, level);
  $('mem-msg').textContent = '';
  refreshPin();
  $('memview').hidden = false;
}
function refreshPin() {
  const pinned = progress.pins.includes(viewing.id);
  $('mem-pin').textContent = pinned ? 'ピン解除' : (progress.pins.length >= 3 ? '古いピンと置き換え' : 'ピン留め');
}
$('mem-pin').addEventListener('click', () => {
  if (progress.pins.includes(viewing.id)) { unpinMemorial(progress, viewing.id); $('mem-msg').textContent = 'ピンを外しました（次の記念窓で置き換わります）'; }
  else if (progress.pins.length >= 3) { pinMemorial(progress, viewing.id, progress.pins[0]); $('mem-msg').textContent = '3枚までなので、いちばん古いピンと置き換えました'; }
  else { pinMemorial(progress, viewing.id); $('mem-msg').textContent = 'ピン留めしました'; }
  save(); refreshPin();
});
$('mem-close').addEventListener('click', () => { $('memview').hidden = true; if (!$('memorials').hidden) renderMemorials(); });
$('mem-png').addEventListener('click', () => {
  try {
    const c = document.createElement('canvas'); c.width = 640; c.height = 800;
    drawMemorial(c.getContext('2d'), viewing.level, viewing.m, 640, 800);
    c.toBlob((blob) => {
      if (!blob) { $('mem-msg').textContent = '保存できませんでした。画面を長押し／スクリーンショットで残せます'; return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `stained-glass-${viewing.level.id}.png`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      $('mem-msg').textContent = 'PNGを保存しました';
    }, 'image/png');
  } catch { $('mem-msg').textContent = '保存できませんでした。画面のカードを撮影してください'; }
});
$('mem-copy').addEventListener('click', async () => {
  const ta = $('memtext');
  try { await navigator.clipboard.writeText(ta.value); $('mem-msg').textContent = 'コピーしました（自動投稿はしません）'; }
  catch {
    ta.focus(); ta.select();
    try { document.execCommand('copy'); $('mem-msg').textContent = 'コピーしました'; } catch { $('mem-msg').textContent = '選択した文章を手動でコピーしてください'; }
  }
});

// ───── 画面サイズ ─────
function resizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(200, Math.round(canvas.clientWidth * dpr)); const h = Math.round((w * H) / W);
  if (canvas.width !== w) { canvas.width = w; canvas.height = h; }
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
}
new ResizeObserver(resizeCanvas).observe($('boardwrap'));
window.addEventListener('resize', resizeCanvas);

// ───── 起動 ─────
applyAudio();
renderMenu();
requestAnimationFrame(frame);
window.__sgb = { startLevel, get battle() { return b; }, doFire, doRecall, setAngle: (a) => { kAngle = a; pointerAim = null; }, progress: () => progress, openMemview, renderMemorials, show, setPaused };

if (OG) {
  document.body.classList.add('og');
  const lv = LEVELS.findIndex((l) => l.id === 'deer3');
  startLevel(lv);
  const rp = REPLAYS.deer3.clear.path[0];
  fire(b, rp.angle);
  let guard = 0;
  while (b.status === 'fly' && guard++ < 100000) {
    if (b.shot.mode === 'out' && b.shot.t >= rp.recall) { recall(b); }
    step(b);
    if (b.shot.mode === 'back' && b.shot.t >= rp.recall + 0.35) break;
  }
  b.events = []; paused = true; $('overlay').hidden = true; $('toast').classList.remove('show');
  b.events.length = 0;
  setTimeout(() => $('toast').classList.remove('show'), 0);
} else if (params.get('screen') === 'memorials') { renderMemorials(); show('memorials'); }
