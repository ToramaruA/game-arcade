// 描画と操作。ルールは logic.js、データは levels.js。
import * as L from './logic.js';
import { NIGHTS, REGIONS, CODEX, STORY, KEEPERS, TYPE_CODE } from './levels.js';
import * as A from './art.js';
import { createAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const OG = qs.has('og');
const KEY = 'moonlit-lighthouse:v1';

// ───────── 保存 ─────────
function loadProfile() {
  const p = L.emptyProfile();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && raw.v === 1) {
      for (const m of ['normal', 'tide']) {
        if (Array.isArray(raw.stars?.[m])) p.stars[m] = NIGHTS.map((_, i) => raw.stars[m][i] || 0);
        if (Array.isArray(raw.assistStars?.[m])) p.assistStars[m] = NIGHTS.map((_, i) => raw.assistStars[m][i] || 0);
      }
      Object.assign(p, { best: raw.best || {}, losses: raw.losses || {}, seen: raw.seen || [], save: raw.save || null });
      Object.assign(p.settings, raw.settings || {});
    }
  } catch { /* 保存がなくても遊べる */ }
  return p;
}
function saveProfile() { try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* 保存できなくても遊べる */ } }

let profile = OG ? L.emptyProfile() : loadProfile();
const audio = createAudio();
audio.setOn(!!profile.settings.sound);

// ───────── 状態 ─────────
let S = null;
let screen = 'title';
let mode = 'normal';
const ui = { mode: 'idle', ped: null, tower: null, choice: null, target: null, sig: null };
let speed = 1;
let particles = [];
let shake = 0; let lhFlash = 0; let dawn = 0; let leakPathGlow = -1;
let guide = null;
let menuWasPaused = false;
let resultTimer = 0;
let barKey = '';
let lastKills = 0;
let fawns = [];
let lastLit = 0; let boatGlow = 0;

const cv = $('cv'); const ctx = cv.getContext('2d');
const view = { w: 0, h: 0, dpr: 1, portrait: false, cs: 40, ox: 0, oy: 0 };
let mesh = null; let meshSize = 0;

function resize() {
  const r = $('stage').getBoundingClientRect();
  view.dpr = Math.min(2, window.devicePixelRatio || 1);
  view.w = Math.max(1, r.width); view.h = Math.max(1, r.height);
  cv.width = Math.round(view.w * view.dpr); cv.height = Math.round(view.h * view.dpr);
  layoutBoard();
}
function layoutBoard() {
  const { w, h } = view;
  view.portrait = h > w * 1.05;
  const mx = 10; const myTop = 12; const myBot = 12;
  if (view.portrait) {
    view.cs = Math.min((w - mx * 2) / L.ROWS, (h - myTop - myBot) / L.COLS);
    view.ox = (w - view.cs * L.ROWS) / 2;
    view.oy = myTop + Math.max(0, (h - myTop - myBot - view.cs * L.COLS) * 0.25);
  } else {
    view.cs = Math.min((w - mx * 2) / L.COLS, (h - myTop - myBot) / L.ROWS);
    view.ox = (w - view.cs * L.COLS) / 2;
    view.oy = (h - view.cs * L.ROWS) / 2;
  }
  if (Math.abs(meshSize - view.cs * 0.22) > 0.5) { meshSize = view.cs * 0.22; mesh = A.meshPattern(ctx, meshSize); }
}
// 論理座標 → 画面
function sx(x, y) { return view.portrait ? view.ox + y * view.cs : view.ox + x * view.cs; }
function sy(x, y) { return view.portrait ? view.oy + (L.COLS - x) * view.cs : view.oy + y * view.cs; }
function toLogic(px, py) {
  if (view.portrait) return { x: L.COLS - (py - view.oy) / view.cs, y: (px - view.ox) / view.cs };
  return { x: (px - view.ox) / view.cs, y: (py - view.oy) / view.cs };
}
const boardW = () => (view.portrait ? L.ROWS : L.COLS) * view.cs;
const boardH = () => (view.portrait ? L.COLS : L.ROWS) * view.cs;

// ───────── 画面の切り替え ─────────
function showTitle() {
  screen = 'title'; S = null;
  $('hud').hidden = true; $('bar').hidden = true; $('title').hidden = false;
  $('result').hidden = true; $('menu').hidden = true; $('pausedTag').hidden = true;
  $('tContinue').hidden = !profile.save;
  $('tStart').textContent = profile.stars.normal.some((v) => v > 0) || profile.assistStars.normal.some((v) => v > 0) ? '次の夜へ' : 'はじめる';
  const tot = L.totalStars(profile);
  $('tStars').textContent = tot > 0 ? `★ ${tot} / 54　潮替わり ★ ${L.totalStars(profile, 'tide')} / 54` : '全18夜・灯守3人・影11種';
  $('tSound').textContent = `音：${profile.settings.sound ? 'ON' : 'OFF'}`;
  hideRibbon();
  requestAnimationFrame(resize);
}

function startNight(idx, opts = {}) {
  mode = opts.mode || mode || 'normal';
  const keeper = opts.keeper || (S && S.night === idx ? S.keeper.type : null) || defaultKeeper(idx);
  S = opts.restore ? L.resume(opts.restore) : L.createNight(idx, { mode, keeper, assist: !!opts.assist });
  mode = S.mode;
  screen = 'play';
  $('title').hidden = true; $('hud').hidden = false; $('bar').hidden = false;
  $('result').hidden = true; $('menu').hidden = true; $('select').hidden = true; $('codex').hidden = true;
  particles = []; fawns = []; lastLit = 0; boatGlow = 0; shake = 0; lhFlash = 0; dawn = 0; leakPathGlow = -1; resultTimer = 0; lastKills = 0;
  speed = 1; $('btnSpeed').textContent = '×1'; $('btnSpeed').classList.remove('on');
  resetUi();
  const n = NIGHTS[idx];
  const firstEver = idx === 0 && mode === 'normal' && profile.stars.normal[0] === 0 && profile.assistStars.normal[0] === 0 && !opts.fromSelect && !opts.restore;
  guide = firstEver ? { step: 'intro' } : null;
  requestAnimationFrame(resize);
  if (!opts.restore) saveSnapshot();
  let line = n.line;
  if (n.newTower === 'yellow') line = '新しい塔：黄塔（光の中の鎧を消す）';
  if (n.newTower === 'white') line = '新しい塔：白塔（光の中の全員を削る）';
  if (n.unlockKeeper) line = `灯守${KEEPERS[n.unlockKeeper].name}が仲間に！ 波の前に灯守を選べる`;
  if (guide) {
    hideRibbon(); renderCoach();
  } else {
    showRibbon(opts.restore ? `第${idx + 1}夜の波${S.waveIdx + 1}から再開` : line, 4200);
  }
  updateHud(); renderBar(true);
  if (!OG) audio.unlock();
}

function defaultKeeper(idx) {
  const av = L.keepersAvailable(idx);
  const best = profile.best[`${mode}:${idx}`];
  if (best && av.includes(best.keeper)) return best.keeper;
  return av[av.length - 1] === 'ren' && idx >= 12 ? 'ren' : av.includes('sora') && idx >= 6 && idx < 12 ? 'sora' : 'mina';
}

function saveSnapshot() {
  if (OG || !S) return;
  const snap = L.snapshot(S);
  if (snap) { profile.save = snap; mergeSeen(); saveProfile(); }
}
function mergeSeen() {
  if (!S) return;
  const set = new Set(profile.seen);
  for (const t of S.seen) set.add(t === 'mini' ? 'twin' : t);
  profile.seen = [...set];
}

function resetUi() { ui.mode = 'idle'; ui.ped = null; ui.tower = null; ui.choice = null; ui.target = null; ui.sig = null; }

// ───────── 帯・トースト ─────────
let ribbonTimer = 0;
function showRibbon(text, ms = 3200) {
  const r = $('ribbon'); r.textContent = text; r.classList.add('show');
  clearTimeout(ribbonTimer);
  if (ms > 0) ribbonTimer = setTimeout(() => r.classList.remove('show'), ms);
}
function hideRibbon() { $('ribbon').classList.remove('show'); }
let toastTimer = 0;
function toast(text, ms = 1300) {
  const t = $('toast'); t.textContent = text; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

// ───────── HUD ─────────
let lastHp = 10;
function updateHud() {
  if (!S) return;
  $('hudNo').textContent = `${S.mode === 'tide' ? '潮替わり ' : ''}第${S.night + 1}夜${S.assist ? '（補助）' : ''}`;
  $('hudName').textContent = NIGHTS[S.night].name;
  $('hudHp').textContent = S.hp;
  $('hudEn').textContent = Math.floor(S.energy);
  $('hudWave').textContent = `${Math.min(S.waveIdx, S.waves.length)}/${S.waves.length}`;
  if (S.hp < lastHp) { const el = $('hudHp').parentElement; el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
  lastHp = S.hp;
  $('btnPause').innerHTML = S.paused ? ICON_PLAY : ICON_PAUSE;
  $('btnPause').classList.toggle('on', S.paused);
  $('pausedTag').hidden = !S.paused || !$('menu').hidden || !!guide;
}

// ───────── 操作欄 ─────────
const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="5" height="16" rx="1" fill="currentColor"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 4 20 12 6 20Z" fill="currentColor"/></svg>';
const SVG = {
  tri: '<path d="M12 3 22 20H2Z"/>', circle: '<circle cx="12" cy="12" r="9"/>', diamond: '<path d="M12 2 21 12 12 22 3 12Z"/>',
  star: '<path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6Z"/>',
};
function towerIcon(type) {
  const c = A.COLORS[type];
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="${c}" stroke="#0a0c22" stroke-width="1.6" stroke-linejoin="round">${SVG[L.TOWERS[type].shape]}</g></svg>`;
}

function renderBar(force = false) {
  if (!S || screen !== 'play') return;
  const key = [ui.mode, ui.ped, ui.tower, ui.choice, ui.target, ui.sig ? ui.sig.x + ',' + ui.sig.y : '', S.inWave, S.waveIdx, S.paused, !!S.reserved.signal, S.reserved.keeper, S.keeper.type, S.result, guide?.step, guide?.hit].join('|');
  if (!force && key === barKey) { updateBar(); return; }
  barKey = key;
  const msg = $('barMsg'); const btns = $('barBtns');
  let m = ''; let b = '';
  const t = ui.tower != null ? S.towers.find((q) => q.id === ui.tower) : null;
  if (ui.mode === 'ped') {
    m = ui.choice ? `<b>${L.TOWERS[ui.choice].name}</b> ${L.TOWERS[ui.choice].desc}` : '置く塔を選ぶ（光の円が重なる所を作ろう）';
    for (const type of L.TOWER_TYPES) {
      const ok = L.towerAvailable(S.night, type);
      const from = { yellow: 3, white: 4 }[type];
      b += `<button class="bb${ui.choice === type ? ' sel' : ''}" data-act="choose" data-type="${type}" data-cost="${L.TOWERS[type].cost}" ${ok ? '' : 'disabled'}>${towerIcon(type)}<span>${L.TOWERS[type].name.slice(0, 1)}</span><small>${ok ? `⚡${L.TOWERS[type].cost}` : `第${from}夜〜`}</small></button>`;
    }
    b += `<button class="bb go" data-act="build" ${ui.choice ? '' : 'disabled'}>設置<small>${ui.choice ? `⚡${L.TOWERS[ui.choice].cost}` : '塔を選ぶ'}</small></button>`;
    b += '<button class="bb x" data-act="cancel" aria-label="やめる">✕</button>';
  } else if (ui.mode === 'tower' && t) {
    const uc = L.upgradeCost(t);
    const next = t.level < 3 ? nextLevelText(t) : '最大';
    m = `<b>${L.TOWERS[t.type].name} Lv${t.level}</b> ${L.TOWERS[t.type].desc}${t.off > 0 ? '（移設中・消灯）' : ''}`;
    b += `<button class="bb" data-act="upgrade" data-cost="${uc ?? 9999}" ${uc == null ? 'disabled' : ''}>強化<small>${uc == null ? '最大' : `⚡${uc} ${next}`}</small></button>`;
    b += `<button class="bb" data-act="relocate" data-cost="${L.RELOCATE_COST}">移設<small>⚡${L.RELOCATE_COST}・2秒消灯</small></button>`;
    b += `<button class="bb dark" data-act="sell">撤去<small>+⚡${L.sellValue(t)}</small></button>`;
    b += '<button class="bb x" data-act="cancel" aria-label="閉じる">✕</button>';
  } else if (ui.mode === 'relocate' && t) {
    m = ui.target != null ? `ここへ移す？ <b>⚡${L.RELOCATE_COST}</b>（もう一度タップでも確定）` : `<b>${L.TOWERS[t.type].name}</b>を移す先の空き台座をタップ`;
    b += `<button class="bb go" data-act="confirmMove" data-cost="${L.RELOCATE_COST}" ${ui.target != null ? '' : 'disabled'}>ここへ移す<small>⚡${L.RELOCATE_COST}</small></button>`;
    b += '<button class="bb x" data-act="cancel" aria-label="やめる">✕</button>';
  } else if (ui.mode === 'signal') {
    const nc = ui.sig ? L.colorsAt(S, ui.sig.x, ui.sig.y).size : 0;
    m = ui.sig ? `範囲OK！ <b>${nc}色</b>の重なり → <b>${L.signalDamage(nc)}ダメ</b>。<b>もう一度タップ</b>か《放つ》` : '<b>金の網目</b>（ちがう色の光の重なり）をタップ。色が多いほど強い';
    b += `<button class="bb sig" data-act="fire" ${ui.sig ? '' : 'disabled'}>放つ<small>${ui.sig ? L.signalDamage(nc) : L.SIGNAL_DMG}ダメ＋停止</small></button>`;
    b += '<button class="bb x" data-act="cancel" aria-label="やめる">✕</button>';
  } else if (ui.mode === 'keeper') {
    m = `<b>${KEEPERS[S.keeper.type].name}</b>の行き先：道の上の○をタップ`;
    b += '<button class="bb dark" data-act="cancel">やめる</button>';
  } else {
    // 通常
    const parts = [];
    if (S.reserved.signal) parts.push('合図を予約中 <button class="chip" data-act="unreserveSig">取消</button>');
    if (S.reserved.keeper != null) parts.push('灯守の移動を予約中 <button class="chip" data-act="unreserveKeep">取消</button>');
    const av = L.keepersAvailable(S.night);
    if (S.waveIdx === 0 && !S.inWave && av.length > 1) {
      parts.push('灯守：' + av.map((k) => `<button class="chip${S.keeper.type === k ? ' on' : ''}" data-act="pickKeeper" data-k="${k}">${KEEPERS[k].name}</button>`).join(''));
      parts.push(`<span>${KEEPERS[S.keeper.type].text}</span>`);
    }
    if (!parts.length) parts.push(idleHint());
    m = parts.join(' ');
    b += `<button class="bb sig" data-act="signal">合図<small data-dyn="sig">準備OK</small><span class="cd" data-dyn="sigcd"></span></button>`;
    b += `<button class="bb dark" data-act="keeper">灯守<small data-dyn="keep">${KEEPERS[S.keeper.type].name}</small><span class="cd" data-dyn="keepcd"></span></button>`;
    b += `<button class="bb go" data-act="wave" data-dyn="wavebtn">次の波<small data-dyn="wave">▶</small></button>`;
  }
  msg.innerHTML = m; btns.innerHTML = b;
  updateBar();
}

function nextLevelText(t) {
  const d = L.TOWERS[t.type]; const i = t.level;
  if (t.type === 'red') return `毎秒${d.dps[i]}`;
  if (t.type === 'white') return `毎秒${d.dps[i]}`;
  if (t.type === 'blue') return `${d.slow[i]}倍`;
  return `半径${d.r[i]}`;
}

function idleHint() {
  if (S.result) return '';
  if (!S.inWave) {
    if (S.waveIdx === 0) return '台座をタップして塔を置き、《次の波》で開始';
    return `波${S.waveIdx}完了！ 次の予告を見て塔を備えよう`;
  }
  return '台座・塔をタップで操作／金の網目の中は光が1.5倍。影が集まったら《合図》';
}

function updateBar() {
  if (!S) return;
  const btns = $('barBtns');
  for (const el of btns.querySelectorAll('[data-cost]')) {
    const c = Number(el.dataset.cost);
    if (el.dataset.act === 'choose' && !L.towerAvailable(S.night, el.dataset.type)) continue;
    if (el.dataset.act === 'upgrade' && c >= 9999) continue;
    if (el.dataset.act === 'build' && !ui.choice) continue;
    if (el.dataset.act === 'confirmMove' && ui.target == null) continue;
    if (el.dataset.act === 'fire' && !ui.sig) continue;
    el.disabled = S.energy < c && el.dataset.act !== 'choose';
    if (el.dataset.act === 'choose') el.classList.toggle('poor', S.energy < c);
  }
  const sig = btns.querySelector('[data-act="signal"]');
  if (sig) {
    const cd = S.signalCd; const reserved = !!S.reserved.signal;
    sig.querySelector('[data-dyn="sig"]').textContent = reserved ? '予約中' : cd > 0 ? `あと${Math.ceil(cd)}秒` : '準備OK';
    sig.querySelector('[data-dyn="sigcd"]').style.transform = `scaleX(${cd / L.SIGNAL_CD})`;
    sig.disabled = cd > 0 || reserved || !!S.result;
    sig.classList.toggle('ready', !sig.disabled && S.inWave);
  }
  const kp = btns.querySelector('[data-act="keeper"]');
  if (kp) {
    kp.querySelector('[data-dyn="keepcd"]').style.transform = `scaleX(${S.keeper.cd / L.KEEPER_CD})`;
    kp.querySelector('[data-dyn="keep"]').textContent = `${KEEPERS[S.keeper.type].name}${S.keeper.cd > 0 ? ` ${Math.ceil(S.keeper.cd)}秒` : ''}`;
  }
  const wb = btns.querySelector('[data-act="wave"]');
  if (wb) {
    const can = L.canStartWave(S);
    wb.disabled = !can;
    wb.querySelector('[data-dyn="wave"]').textContent = S.inWave ? `波${S.waveIdx}進行中` : S.waveIdx >= S.waves.length ? '—' : `波${S.waveIdx + 1}/${S.waves.length} ▶`;
  }
  // 手引きの光
  for (const el of btns.querySelectorAll('.pulse')) el.classList.remove('pulse');
  if (guide) {
    const want = guide.step === 1 ? 'relocate' : guide.step === 3 && guide.hit ? 'signal' : null;
    if (want) btns.querySelector(`[data-act="${want}"]`)?.classList.add('pulse');
    if (guide.step === 4 && ui.sig) btns.querySelector('[data-act="fire"]')?.classList.add('pulse');
  }
}

$('barBtns').addEventListener('click', onBarClick);
$('barMsg').addEventListener('click', onBarClick);
function onBarClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el || !S) return;
  audio.unlock();
  const act = el.dataset.act;
  const t = ui.tower != null ? S.towers.find((q) => q.id === ui.tower) : null;
  switch (act) {
    case 'choose':
      if (ui.choice === el.dataset.type) doBuild(); else { ui.choice = el.dataset.type; }
      break;
    case 'build': doBuild(); break;
    case 'cancel': resetUi(); break;
    case 'upgrade': if (t) { const r = L.upgrade(S, t.id); if (!r.ok) fail(r.reason); } break;
    case 'relocate': if (t) { if (S.energy < L.RELOCATE_COST) fail('energy'); else { ui.mode = 'relocate'; ui.target = null; if (guide?.step === 1) { guide.step = 2; renderCoach(); } } } break;
    case 'confirmMove': doMove(); break;
    case 'sell': if (t) { L.sell(S, t.id); resetUi(); } break;
    case 'signal': if (S.signalCd <= 0 && S.energy >= L.SIGNAL_COST) { resetUi(); ui.mode = 'signal'; if (guide?.step === 3) { guide.step = 4; renderCoach(); } } else fail(S.signalCd > 0 ? 'cd' : 'energy'); break;
    case 'fire': doSignal(); break;
    case 'keeper': resetUi(); ui.mode = 'keeper'; break;
    case 'wave': if (L.startWave(S)) { resetUi(); if (guide && (guide.step === 'intro' || guide.step === 'light')) { guide.step = 'watch'; $('coach').hidden = true; } } break;
    case 'pickKeeper': {
      const k = el.dataset.k;
      if (S.waveIdx === 0 && !S.inWave) {
        const snapTowers = S.towers.map((q) => ({ ...q }));
        const energy = S.energy;
        const keep = S;
        S = L.createNight(keep.night, { mode: keep.mode, keeper: k, assist: keep.assist });
        S.towers = snapTowers; S.nextTowerId = keep.nextTowerId; S.energy = energy;
        toast(`灯守：${KEEPERS[k].name}（${KEEPERS[k].text}）`, 1600);
        saveSnapshot();
      }
      break;
    }
    case 'unreserveSig': L.cancelReservation(S, 'signal'); break;
    case 'unreserveKeep': L.cancelReservation(S, 'keeper'); break;
    default: break;
  }
  renderBar(true); updateHud();
}

function doBuild() {
  if (ui.ped == null || !ui.choice) return;
  const r = L.build(S, ui.ped, ui.choice);
  if (!r.ok) { fail(r.reason); return; }
  resetUi();
}
function doMove() {
  const t = S.towers.find((q) => q.id === ui.tower);
  if (!t || ui.target == null) return;
  const r = L.relocate(S, t.id, ui.target);
  if (!r.ok) { fail(r.reason); return; }
  resetUi();
  if (guide && typeof guide.step === 'number' && guide.step <= 2) { guide.step = 3; guide.wait = true; L.setPaused(S, false); renderCoach(); }
}
function doSignal() {
  if (!ui.sig) return;
  const r = L.signal(S, ui.sig.x, ui.sig.y);
  if (!r.ok) { fail(r.reason); return; }
  if (r.reserved && !guide) toast('合図を予約した（再開で発動）');
  resetUi();
  if (guide && S.paused) { L.setPaused(S, false); renderCoach(); }
}
function fail(reason) {
  audio.error();
  const msg = { energy: '電池が足りない', cd: '合図は待ち時間中', single: '1色だけの場所には合図できない（金の網目へ）', occupied: 'その台座は使用中', locked: 'まだ使えない塔', reserved: '合図は予約済み' }[reason] || 'できない';
  toast(msg);
}

// ───────── 盤面の入力 ─────────
cv.addEventListener('pointerdown', (e) => {
  if (screen !== 'play' || !S || OG) return;
  audio.unlock();
  const r = cv.getBoundingClientRect();
  const p = toLogic(e.clientX - r.left, e.clientY - r.top);
  onBoardTap(p.x, p.y);
  renderBar(true); updateHud();
});

function nearestPed(x, y, maxD = 0.62) {
  let best = -1; let bd = maxD;
  S.map.peds.forEach((p, i) => { const d = L.dist(p.x, p.y, x, y); if (d < bd) { bd = d; best = i; } });
  return best;
}

function onBoardTap(x, y) {
  if (S.result) return;
  if (ui.mode === 'keeper') {
    let best = -1; let bd = 0.75;
    S.map.keeperPts.forEach((p, i) => { const d = L.dist(p.x, p.y, x, y); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { const r = L.moveKeeper(S, best); if (r.reserved) toast('灯守の移動を予約（再開で出発）'); resetUi(); }
    else resetUi();
    return;
  }
  if (ui.mode === 'signal') {
    if (ui.sig && L.dist(ui.sig.x, ui.sig.y, x, y) <= L.signalRadius(S)) { doSignal(); return; }
    if (L.isOverlap(S, x, y)) { ui.sig = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 }; }
    else { toast('ちがう色の光が重なる金の網目をタップ'); ui.sig = null; }
    return;
  }
  const pi = nearestPed(x, y);
  if (ui.mode === 'relocate') {
    const t = S.towers.find((q) => q.id === ui.tower);
    if (pi >= 0 && !L.towerAt(S, pi)) {
      if (ui.target === pi) { doMove(); return; }
      ui.target = pi;
      if (guide && guide.step === 2 && pi !== 2) toast('真ん中の光る台座だと赤と重なるよ');
      return;
    }
    if (pi >= 0 && t && t.ped === pi) { resetUi(); return; }
    resetUi(); return;
  }
  // 灯守をタップ
  if (L.dist(S.keeper.x, S.keeper.y, x, y) < 0.45 && pi < 0) { resetUi(); ui.mode = 'keeper'; return; }
  if (pi >= 0) {
    const t = L.towerAt(S, pi);
    resetUi();
    if (t) { ui.mode = 'tower'; ui.tower = t.id; if (guide && guide.step === 0 && t.type === 'blue') { guide.step = 1; renderCoach(); } }
    else { ui.mode = 'ped'; ui.ped = pi; }
    return;
  }
  resetUi();
}

// キーボード
window.addEventListener('keydown', (e) => {
  if (screen !== 'play' || !S) return;
  if (!$('menu').hidden || !$('select').hidden || !$('codex').hidden) { if (e.key === 'Escape') closeOverlays(); return; }
  if (e.key === ' ') { e.preventDefault(); togglePause(); }
  else if (e.key === 'Escape') { resetUi(); }
  else if (e.key === 's' || e.key === 'S') { if (S.signalCd <= 0 && S.energy >= L.SIGNAL_COST) { resetUi(); ui.mode = 'signal'; } }
  else if (e.key === 'k' || e.key === 'K') { resetUi(); ui.mode = 'keeper'; }
  else if (e.key === 'n' || e.key === 'N' || e.key === 'Enter') { if (L.startWave(S)) resetUi(); }
  else if (e.key === 'f' || e.key === 'F') toggleSpeed();
  else if (ui.mode === 'ped' && '1234'.includes(e.key)) {
    const type = L.TOWER_TYPES[Number(e.key) - 1];
    if (L.towerAvailable(S.night, type)) { if (ui.choice === type) doBuild(); else ui.choice = type; }
  }
  renderBar(true); updateHud();
});

function togglePause() {
  if (!S || S.result) return;
  L.setPaused(S, !S.paused);
  updateHud(); renderBar(true);
}
function toggleSpeed() {
  speed = speed === 1 ? 2 : 1;
  $('btnSpeed').textContent = `×${speed}`; $('btnSpeed').classList.toggle('on', speed === 2);
}
$('btnPause').addEventListener('click', () => { audio.unlock(); togglePause(); });
$('btnSpeed').addEventListener('click', () => { audio.unlock(); toggleSpeed(); });
$('btnMenu').addEventListener('click', () => openMenu());
document.addEventListener('visibilitychange', () => {
  if (document.hidden && S && screen === 'play' && !S.result) { L.setPaused(S, true); updateHud(); renderBar(true); }
});

// ───────── メニュー・オーバーレイ ─────────
function openMenu() {
  if (!S) return;
  menuWasPaused = S.paused;
  L.setPaused(S, true);
  $('menu').hidden = false; $('help').hidden = true;
  syncToggles(); updateHud();
}
function syncToggles() {
  for (const el of document.querySelectorAll('[data-m="sound"]')) el.textContent = `音：${profile.settings.sound ? 'ON' : 'OFF'}`;
  for (const el of document.querySelectorAll('[data-m="shake"]')) el.textContent = `揺れ：${profile.settings.shake ? 'ON' : 'OFF'}`;
  $('tSound').textContent = `音：${profile.settings.sound ? 'ON' : 'OFF'}`;
}
$('menu').addEventListener('click', (e) => {
  const el = e.target.closest('[data-m]');
  if (!el) { if (e.target === $('menu')) closeMenu(); return; }
  const m = el.dataset.m;
  if (m === 'resume') closeMenu();
  else if (m === 'retry') { $('menu').hidden = true; startNight(S.night, { mode: S.mode, keeper: S.keeper.type, assist: S.assist, fromSelect: true }); }
  else if (m === 'select') { $('menu').hidden = true; openSelect(); }
  else if (m === 'codex') openCodex();
  else if (m === 'help') $('help').hidden = !$('help').hidden;
  else if (m === 'sound') { profile.settings.sound = !profile.settings.sound; audio.setOn(profile.settings.sound); saveProfile(); syncToggles(); }
  else if (m === 'shake') { profile.settings.shake = !profile.settings.shake; saveProfile(); syncToggles(); }
  else if (m === 'title') { $('menu').hidden = true; showTitle(); }
});
function closeMenu() {
  $('menu').hidden = true;
  if (S && !menuWasPaused) L.setPaused(S, false);
  updateHud(); renderBar(true);
}
function closeOverlays() {
  if (!$('codex').hidden) { $('codex').hidden = true; return; }
  if (!$('select').hidden) { $('select').hidden = true; if (screen === 'play' && S) openMenu(); return; }
  if (!$('menu').hidden) closeMenu();
}
for (const el of document.querySelectorAll('[data-close]')) el.addEventListener('click', () => closeOverlays());

// タイトル
$('tStart').addEventListener('click', () => {
  audio.unlock();
  const n = L.unlockedNights(profile, 'normal');
  const firstUncleared = profile.stars.normal.findIndex((v, i) => v === 0 && profile.assistStars.normal[i] === 0);
  const idx = firstUncleared < 0 ? NIGHTS.length - 1 : Math.min(firstUncleared, n - 1);
  startNight(idx, { mode: 'normal' });
});
$('tContinue').addEventListener('click', () => {
  audio.unlock();
  if (profile.save) { try { startNight(profile.save.night, { restore: profile.save }); } catch { profile.save = null; saveProfile(); showTitle(); } }
});
$('tSelect').addEventListener('click', () => { audio.unlock(); openSelect(); });
$('tCodex').addEventListener('click', () => openCodex());
$('tSound').addEventListener('click', () => { profile.settings.sound = !profile.settings.sound; audio.setOn(profile.settings.sound); if (profile.settings.sound) audio.unlock(); saveProfile(); syncToggles(); });

// 夜を選ぶ
let selMode = 'normal';
function openSelect() {
  selMode = mode || 'normal';
  if (selMode === 'tide' && !L.tideUnlocked(profile)) selMode = 'normal';
  $('select').hidden = false; renderSelect();
}
function renderSelect() {
  const tideOk = L.tideUnlocked(profile);
  $('selTabs').innerHTML = `<button data-sm="normal" class="${selMode === 'normal' ? 'on' : ''}">本編</button><button data-sm="tide" class="${selMode === 'tide' ? 'on' : ''}" ${tideOk ? '' : 'disabled'}>潮替わり${tideOk ? '' : '（全夜クリアで解放）'}</button>`;
  $('selStars').textContent = `★ ${L.totalStars(profile, selMode)} / 54`;
  const open = L.unlockedNights(profile, selMode);
  let h = '';
  REGIONS.forEach((reg, ri) => {
    h += `<div class="region"><h3>${reg.name}<small>${reg.sub}</small></h3><div class="nights">`;
    for (let i = ri * 6; i < ri * 6 + 6; i++) {
      const st = profile.stars[selMode][i]; const as = profile.assistStars[selMode][i];
      const locked = i >= open;
      const stars = '★'.repeat(st) + '☆'.repeat(3 - st);
      const boss = NIGHTS[i].boss ? '<span class="boss">◆ボス</span>' : NIGHTS[i].unlockKeeper ? `<span class="boss" style="color:#7fe3ff">＋${KEEPERS[NIGHTS[i].unlockKeeper].name}</span>` : '';
      h += `<button class="nbtn" data-night="${i}" ${locked ? 'disabled' : ''}><small>第${i + 1}夜 ${boss}</small><b>${locked ? '？？？' : NIGHTS[i].name}</b><span class="st">${locked ? '🔒' : stars}${as ? `<i>補助★${as}</i>` : ''}</span></button>`;
    }
    h += '</div></div>';
  });
  $('selBody').innerHTML = h;
}
$('select').addEventListener('click', (e) => {
  const tab = e.target.closest('[data-sm]');
  if (tab && !tab.disabled) { selMode = tab.dataset.sm; renderSelect(); return; }
  const nb = e.target.closest('[data-night]');
  if (nb && !nb.disabled) { $('select').hidden = true; startNight(Number(nb.dataset.night), { mode: selMode, fromSelect: true }); }
});

// 図鑑
function openCodex() {
  mergeSeen();
  const seen = new Set(profile.seen);
  if (S) for (const t of S.seen) seen.add(t);
  const types = Object.keys(CODEX);
  $('codexCount').textContent = `${types.filter((c) => seen.has(TYPE_FROM_CODE(c))).length} / ${types.length}`;
  let h = '';
  for (const c of types) {
    const type = TYPE_FROM_CODE(c); const d = CODEX[c]; const e = L.ENEMIES[type]; const ok = seen.has(type);
    const stats = `HP${e.hp}・速さ${e.speed}${e.armor ? '・鎧' : ''}・抜けると耐久-${e.leak}`;
    h += `<div class="card${ok ? '' : ' unseen'}"><canvas width="144" height="144" data-type="${type}" data-seen="${ok ? 1 : 0}"></canvas><div><h4>${ok ? d.name : '？？？'}${d.boss ? '<small>ボス</small>' : ''}</h4><p>${ok ? d.text : 'まだ出会っていない影。'}</p>${ok ? `<p class="tip">対策：${d.tip}</p><p style="color:#6a5a3a">${stats}</p>` : ''}</div></div>`;
  }
  h += '<table class="towers-tbl"><tr><th>塔</th><th>建設</th><th>Lv1</th><th>Lv2（+30）</th><th>Lv3（+45）</th></tr>';
  for (const type of L.TOWER_TYPES) {
    const d = L.TOWERS[type];
    const lv = (i) => (type === 'red' || type === 'white' ? `毎秒${d.dps[i]}` : type === 'blue' ? `${d.slow[i]}倍` : `半径${d.r[i]}`);
    h += `<tr><td>${towerIcon(type).replace('<svg', '<svg width="16" height="16"')} ${d.name}</td><td>⚡${d.cost}</td><td>${lv(0)}</td><td>${lv(1)}</td><td>${lv(2)}</td></tr>`;
  }
  h += '</table>';
  $('codexBody').innerHTML = h;
  $('codex').hidden = false;
  for (const c of $('codexBody').querySelectorAll('canvas')) {
    const g = c.getContext('2d');
    A.drawEnemyIcon(g, c.dataset.type, 72, 78, 92, 0, c.dataset.seen === '1');
    if (c.dataset.seen !== '1') { g.fillStyle = 'rgba(13,27,61,.55)'; g.fillRect(0, 0, 144, 144); g.fillStyle = '#efe3c8'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.fillText('?', 72, 90); }
  }
}
const TYPE_FROM_CODE = (c) => ({ r: 'rat', b: 'rabbit', t: 'turtle', d: 'deer', m: 'moth', w: 'twin', f: 'fish', o: 'owl', K: 'kingdeer', T: 'kingturtle', L: 'lord' }[c]);

// ───────── 結果 ─────────
function showResult() {
  const win = S.result === 'win';
  const stars = L.recordResult(profile, S);
  mergeSeen();
  profile.save = null;
  saveProfile();
  const n = NIGHTS[S.night];
  let h = '';
  if (win) {
    const st = `${'★'.repeat(stars)}<span class="off">${'★'.repeat(3 - stars)}</span>`;
    h += `<div class="res-head"><h2>夜明け — 第${S.night + 1}夜『${n.name}』</h2><span class="res-stars">${st}</span></div>`;
    const story = S.mode === 'normal' ? STORY[S.night] : null;
    if (story) h += `<div class="story"><canvas width="360" height="220" id="storyCv"></canvas><div><h3>${story.title}</h3>${story.lines.map((l) => `<p>${l}</p>`).join('')}</div></div>`;
  } else {
    h += `<div class="res-head"><h2>灯が消えた… 第${S.night + 1}夜『${n.name}』</h2></div>`;
    const ll = S.lastLeak;
    if (ll) h += `<div class="leak-line"><canvas width="88" height="88" id="leakCv"></canvas><span>最後に<b>${L.ENEMIES[ll.type].name}</b>が<b>${pathName(ll.path)}</b>から抜けた（盤面の赤い道）。そこに光を重ねよう。</span></div>`;
  }
  h += '<div class="res-grid"><dl class="res-stats">';
  h += `<dt>灯台の耐久</dt><dd>${S.hp} / 10（最少 ${S.stats.minHp}）</dd>`;
  h += `<dt>しのいだ波</dt><dd>${win ? S.waves.length : Math.max(0, S.waveIdx - 1)} / ${S.waves.length}</dd>`;
  h += `<dt>撃破</dt><dd>${S.stats.kills}体（最多同時 ${S.stats.maxBurst}体）</dd>`;
  h += `<dt>合図</dt><dd>${S.stats.signals}回（1回で最多 ${S.stats.signalBest}体）</dd>`;
  h += `<dt>灯守</dt><dd>${KEEPERS[S.keeper.type].name}</dd>`;
  h += '</dl><canvas class="res-map" id="resMap" width="312" height="208" aria-label="塔の配置"></canvas></div>';
  const offer = !win && L.shouldOfferAssist(profile, S.night, S.mode) && !S.assist;
  if (offer) h += '<label class="assist"><input type="checkbox" id="assistChk"> 練習補助で挑む（最初の電池+40・成績は別記録）</label>';
  h += '<div class="res-btns">';
  if (win && S.night < NIGHTS.length - 1) h += '<button class="tbtn primary" data-r="next">次の夜へ</button>';
  if (win && S.night === NIGHTS.length - 1 && S.mode === 'normal') h += '<button class="tbtn primary" data-r="tide">潮替わりへ</button>';
  h += `<button class="tbtn ${win ? '' : 'primary'}" data-r="retry">この夜をやり直す</button>`;
  h += '<button class="tbtn small" data-r="select">夜を選ぶ</button>';
  if (win) h += '<button class="tbtn small" data-r="copy">結果をコピー</button>';
  h += '</div>';
  if (win) h += `<p class="res-note">${stars < 3 ? `耐久${stars === 1 ? 8 : 10}で★${stars + 1}。別の台座や灯守でも試せる。` : '満点！ 別の灯守や配置でも守れるか試してみよう。'}</p>`;
  $('resBody').innerHTML = h;
  $('result').hidden = false;
  hideRibbon();
  drawResMap($('resMap'));
  if ($('storyCv')) drawStory($('storyCv'), S.night);
  if ($('leakCv')) { const g = $('leakCv').getContext('2d'); A.drawEnemyIcon(g, S.lastLeak.type, 44, 50, 60, 0, true); }
  leakPathGlow = win ? -1 : (S.lastLeak?.path ?? -1);
  $('bar').hidden = true;
}
function pathName(p) {
  const n = S.map.paths.length;
  return n === 1 ? '道' : ['一の道', '二の道', '三の道'][p] || '道';
}
$('result').addEventListener('click', async (e) => {
  const el = e.target.closest('[data-r]');
  if (!el || !S) return;
  const r = el.dataset.r;
  const assist = $('assistChk')?.checked || false;
  if (r === 'next') startNight(S.night + 1, { mode: S.mode });
  else if (r === 'tide') startNight(0, { mode: 'tide', fromSelect: true });
  else if (r === 'retry') startNight(S.night, { mode: S.mode, keeper: S.keeper.type, assist: assist || S.assist, fromSelect: true });
  else if (r === 'select') { $('result').hidden = true; openSelect(); }
  else if (r === 'copy') {
    const text = `${L.shareText(S, L.starsFor(S.hp))} ${location.href.split('?')[0]}`;
    try { await navigator.clipboard.writeText(text); toast('結果をコピーした'); } catch { window.prompt('コピーしてください', text); }
  }
});

function drawResMap(c) {
  const g = c.getContext('2d'); const W = c.width; const H = c.height; const u = Math.min(W / L.COLS, H / L.ROWS);
  g.fillStyle = '#0d1b3d'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#efe3c8'; g.lineWidth = u * 0.5; g.lineCap = 'round'; g.lineJoin = 'round';
  S.map.paths.forEach((p, i) => { g.strokeStyle = i === leakPathGlowFor() ? '#ff6a5a' : '#cdbf9f'; g.beginPath(); p.pts.forEach((q, k) => (k ? g.lineTo(q.x * u, q.y * u) : g.moveTo(q.x * u, q.y * u))); g.stroke(); });
  for (const t of S.towers) {
    const p = S.map.peds[t.ped];
    g.fillStyle = `rgba(${A.LIGHT[t.type]},.25)`; g.beginPath(); g.arc(p.x * u, p.y * u, L.towerRadius(t) * u, 0, Math.PI * 2); g.fill();
  }
  for (const t of S.towers) {
    const p = S.map.peds[t.ped];
    g.fillStyle = A.COLORS[t.type]; g.strokeStyle = '#0a0c22'; g.lineWidth = 1.5;
    g.beginPath(); A.shapePath(g, L.TOWERS[t.type].shape, p.x * u, p.y * u, u * 0.4); g.fill(); g.stroke();
  }
  g.fillStyle = '#fff'; g.beginPath(); g.arc(S.map.lh.x * u, S.map.lh.y * u, u * 0.35, 0, Math.PI * 2); g.fill();
}
const leakPathGlowFor = () => (S && S.result === 'lose' ? S.lastLeak?.path : -1);

function drawStory(c, night) {
  const g = c.getContext('2d'); const W = c.width; const H = c.height; const t = performance.now() / 1000;
  A.drawSky(g, W, H, t, ['#2a2466', '#ff9f6b']);
  const sun = g.createRadialGradient(W * 0.5, H * 0.72, 0, W * 0.5, H * 0.72, W * 0.5);
  sun.addColorStop(0, 'rgba(255,200,120,.8)'); sun.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = sun; g.fillRect(0, 0, W, H);
  A.drawWaves(g, 0, H * 0.62, W, H * 0.38, t, 3, [40, 52, 110]);
  A.drawLighthouse(g, W * 0.82, H * 0.66, H * 0.55, t, { beam: true, beamLen: 2.5 });
  const boats = night === 5 ? 3 : night === 11 ? 5 : 8;
  for (let i = 0; i < boats; i++) A.drawBoat(g, W * (0.1 + i * 0.09), H * (0.74 + (i % 2) * 0.08), H * 0.06, t, 3, 3);
  if (night === 5) { A.drawShadowBeast(g, 'deer', W * 0.55, H * 0.6, H * 0.18, { t, alpha: 0.9 }); }
  if (night === 17) { g.strokeStyle = 'rgba(255,214,90,.8)'; g.lineWidth = 3; g.beginPath(); g.ellipse(W * 0.5, H * 0.66, W * 0.45, H * 0.08, 0, 0, Math.PI * 2); g.stroke(); }
}

// ───────── 進行と効果 ─────────
function handleFx() {
  for (const f of S.fx) {
    switch (f.kind) {
      case 'kill': {
        const n = f.boss ? 70 : 12;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2; const sp = (f.boss ? 2.5 : 1.2) + Math.random() * 1.5;
          particles.push({ k: 'star', x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.9 + Math.random() * 0.6, t: 0, c: Math.random() < 0.6 ? '#fff4c8' : '#ffcf5a', r: 0.05 + Math.random() * 0.06 });
        }
        if (f.boss && f.type === 'kingdeer') fawns.push({ x: f.x, y: f.y, t: 0 });
        if (f.boss) { shakeIt(10); showRibbon(f.type === 'lord' ? '夜の主の影が剥がれ、星屑になった……' : `${L.ENEMIES[f.type].name}を退けた！`, 3000); }
        audio.pop();
        if (guide && guide.step === 'watch' && !guide.sawKill) { guide.sawKill = true; guide.pauseAt = performance.now() + 900; }
        break;
      }
      case 'leak': shakeIt(f.loss >= 2 ? 9 : 5); lhFlash = 1; audio.leak(); floatText(S.map.lh.x, S.map.lh.y - 0.6, `-${f.loss}`, '#ff8a6a'); break;
      case 'signal':
        particles.push({ k: 'ring', x: f.x, y: f.y, r: f.r, life: 0.7, t: 0 });
        for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; particles.push({ k: 'star', x: f.x, y: f.y, vx: Math.cos(a) * 2.6, vy: Math.sin(a) * 2.6, life: 0.6, t: 0, c: '#ffd36b', r: 0.05 }); }
        audio.signal(f.killed);
        if (f.colors >= 3) floatText(f.x, f.y - 1.1, `${f.colors}色 ${f.dmg}ダメ`, '#fff3c4', 1.2);
        if (f.killed >= 3) { floatText(f.x, f.y - 0.5, `${f.killed}体！`, '#ffe08a', 1.4); shakeIt(4); }
        if (f.bonus) floatText(f.x + 0.6, f.y + 0.1, `+${f.bonus}⚡`, '#ffe08a', 1.2);
        if (guide && typeof guide.step === 'number' && guide.step >= 3) { guide.step = 'boom'; guide.kills = f.killed; guide.doneAt = performance.now() + 1500; $('coach').hidden = true; }
        break;
      case 'stop': particles.push({ k: 'ring2', x: f.x, y: f.y, r: 0.6, life: 0.5, t: 0 }); audio.stop(); break;
      case 'wave': {
        audio.wave();
        const boss = S.waves[S.waveIdx - 1].find((g) => L.ENEMIES[g.type].boss);
        if (boss) { audio.boss(); showRibbon(`${L.ENEMIES[boss.type].name}が来る！`, 3000); }
        break;
      }
      case 'waveClear':
        audio.clear();
        if (!S.result) { floatText(S.map.lh.x, S.map.lh.y - 0.8, '+25⚡', '#ffe08a', 1.2); saveSnapshot(); }
        break;
      case 'win': audio.win(); dawn = 0.001; resultTimer = 1.8; break;
      case 'lose': audio.lose(); resultTimer = 1.0; break;
      case 'bell': particles.push({ k: 'ring2', x: f.x, y: f.y, r: 1, life: 0.6, t: 0, c: '120,255,160' }); audio.bell(); break;
      case 'drain': floatText(f.x, f.y - 0.4, '-2⚡', '#9ff7ff'); break;
      case 'summon': particles.push({ k: 'ring2', x: f.x, y: f.y, r: 1.2, life: 0.8, t: 0, c: '170,120,255' }); break;
      case 'phase': showRibbon('影が剥がれ、古い灯台の輪郭が……速くなる！', 3200); shakeIt(8); break;
      case 'build': audio.build(); particles.push({ k: 'ring2', x: f.x, y: f.y, r: 0.7, life: 0.4, t: 0, c: A.LIGHT[f.type] }); break;
      case 'upgrade': audio.upgrade(); particles.push({ k: 'ring2', x: f.x, y: f.y, r: 0.9, life: 0.5, t: 0, c: A.LIGHT[f.type] }); break;
      case 'move': audio.move(); particles.push({ k: 'trail', x: f.fx0, y: f.fy0, x2: f.x, y2: f.y, life: 0.5, t: 0, c: A.LIGHT[f.type] }); break;
      case 'sell': audio.sell(); break;
      case 'refund': toast('網目が消えたので合図を取りやめた'); break;
      default: break;
    }
  }
  S.fx.length = 0;
}
function floatText(x, y, text, color, life = 1) { particles.push({ k: 'text', x, y, text, color, life, t: 0 }); }
function shakeIt(n) { if (profile.settings.shake) shake = Math.max(shake, n); }

let acc = 0; let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const t = now / 1000;
  if (screen === 'play' && S && !OG) {
    if (!S.result && !S.paused && $('menu').hidden) {
      acc += dt * speed;
      let n = 0;
      while (acc >= L.DT && n < 12) { L.step(S); acc -= L.DT; n += 1; if (S.fx.length) handleFx(); if (S.result) break; }
      if (n >= 12) acc = 0;
    } else acc = 0;
    if (S.fx.length) handleFx();
    guideTick();
    if (resultTimer > 0) { resultTimer -= dt; if (resultTimer <= 0) showResult(); }
    if (dawn > 0 && dawn < 1) dawn = Math.min(1, dawn + dt * 0.6);
    updateHud(); renderBar();
  }
  for (const p of particles) { p.t += dt; if (p.vx != null) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; } }
  particles = particles.filter((p) => p.t < p.life);
  for (const f of fawns) f.t += dt;
  fawns = fawns.filter((f) => f.t < 6);
  shake *= 0.86; lhFlash = Math.max(0, lhFlash - dt * 2);
  render(t);
  requestAnimationFrame(frame);
}

// ───────── 描画 ─────────
function region() { return REGIONS[Math.floor((S ? S.night : 0) / 6)]; }

function render(t) {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  const { w, h } = view;
  if (screen === 'title' || !S) { renderTitle(t); return; }
  const reg = region();
  ctx.save();
  if (shake > 0.3) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  A.drawSky(ctx, w, h, t, dawn > 0 ? mixSea(reg.sea, dawn) : reg.sea);
  if (dawn > 0) { const g = ctx.createLinearGradient(0, h, 0, 0); g.addColorStop(0, `rgba(255,170,100,${0.5 * dawn})`); g.addColorStop(0.6, 'rgba(255,170,100,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  drawMargins(t);
  drawBoard(t);
  ctx.restore();
}
function mixSea(sea, k) {
  const a = [[13, 27, 61], [22, 48, 106]]; const b = [[90, 60, 120], [255, 160, 110]];
  return a.map((c, i) => `rgb(${c.map((v, j) => Math.round(v + (b[i][j] - v) * k)).join(',')})`);
}

function drawMargins(t) {
  const { w, h } = view;
  const bx = view.ox; const by = view.oy; const bw = boardW(); const bh = boardH();
  A.drawMoon(ctx, view.portrait ? w * 0.82 : Math.max(60, bx * 0.5), view.portrait ? Math.max(30, by * 0.5) : 70, view.portrait ? 18 : 30);
  const lit = Math.min(12, Math.floor((S.stats.kills || 0) / 4));
  if (lit > lastLit) boatGlow = 1.6;
  lastLit = lit;
  if (boatGlow > 0) {
    boatGlow = Math.max(0, boatGlow - 1 / 60);
    const gy = view.portrait ? by + bh + (h - by - bh) * 0.5 : h * 0.8;
    for (const gx of view.portrait ? [w * 0.5] : [bx * 0.5, bx + bw + (w - bx - bw) * 0.5]) {
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(80, w * 0.25));
      g.addColorStop(0, `rgba(255,200,110,${0.45 * Math.min(1, boatGlow)})`); g.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  }
  if (view.portrait) {
    const space = h - (by + bh);
    if (space > 40) {
      A.drawWaves(ctx, 0, by + bh + 4, w, space, t, 3);
      const n = 4; const s = Math.min(26, space * 0.28);
      for (let i = 0; i < n; i++) A.drawBoat(ctx, w * (0.14 + i * 0.24), by + bh + space * 0.55, s, t, Math.max(0, Math.min(3, lit - i * 3)), 3);
    }
  } else if (bx > 60) {
    A.drawWaves(ctx, 0, h * 0.62, bx - 6, h * 0.38, t, 3);
    A.drawWaves(ctx, bx + bw + 6, h * 0.62, w - bx - bw - 6, h * 0.38, t, 3);
    const s = Math.min(34, bx * 0.22);
    for (let i = 0; i < 2; i++) A.drawBoat(ctx, bx * (0.35 + i * 0.32), h * (0.74 + i * 0.1), s, t, Math.max(0, Math.min(3, lit - i * 3)), 3);
    for (let i = 0; i < 2; i++) A.drawBoat(ctx, bx + bw + (w - bx - bw) * (0.35 + i * 0.32), h * (0.78 + i * 0.08), s, t, Math.max(0, Math.min(3, lit - 6 - i * 3)), 3);
  }
  // 小さな鹿が船へ歩いていく（第6夜の王のあと）
  for (const f of fawns) {
    const k = f.t / 6;
    const x0 = sx(f.x, f.y); const y0 = sy(f.x, f.y);
    const x1 = view.portrait ? w * 0.5 : bx * 0.5; const y1 = view.portrait ? h - 30 : h * 0.8;
    A.drawShadowBeast(ctx, 'deer', x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, view.cs * 0.6, { t: t * 0.6, face: x1 < x0 ? -1 : 1, alpha: Math.min(1, (1 - k) * 3) });
  }
  void by;
}

function pathScreen(p) { return p.pts.map((q) => [sx(q.x, q.y), sy(q.x, q.y)]); }

function drawBoard(t) {
  const cs = view.cs;
  const bx = view.ox; const by = view.oy; const bw = boardW(); const bh = boardH();
  // 盤面の海（厚紙の台紙）
  A.paper(ctx, (c) => roundRect(c, bx - 4, by - 4, bw + 8, bh + 8, 10), '#13265a', { off: 5, shadow: 'rgba(0,0,0,.5)' });
  ctx.save(); ctx.beginPath(); roundRect(ctx, bx, by, bw, bh, 8); ctx.clip();
  const g = ctx.createLinearGradient(bx, by, bx, by + bh); g.addColorStop(0, '#16306a'); g.addColorStop(1, '#0f2350');
  ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh);
  // 波の模様
  ctx.strokeStyle = 'rgba(160,200,255,.08)'; ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const yy = by + (i + 0.5) * (bh / 14);
    ctx.beginPath();
    for (let x = bx; x <= bx + bw; x += 10) ctx.lineTo(x, yy + Math.sin(x / 26 + t * 0.8 + i) * 3);
    ctx.stroke();
  }
  // 岩（道でも台座でもないマスに少し）
  ctx.fillStyle = 'rgba(40,52,100,.75)';
  for (let y = 0; y < L.ROWS; y++) for (let x = 0; x < L.COLS; x++) {
    if (S.map.cells.has(`${x},${y}`) || ((x * 5 + y * 3 + S.night) % 9) !== 0) continue;
    if (S.map.peds.some((p) => p.cx === x && p.cy === y)) continue;
    const X = sx(x + 0.5, y + 0.5); const Y = sy(x + 0.5, y + 0.5);
    A.paper(ctx, (c) => c.ellipse(X, Y, cs * 0.3, cs * 0.18, 0, 0, Math.PI * 2), '#2b3a74', { off: 3 });
  }
  ctx.restore();
  // 予告の点線
  drawPreview(t);
  // 道（厚紙の桟橋）：盤面の枠の中だけ
  ctx.save(); ctx.beginPath(); ctx.rect(bx - 3, by - 3, bw + 6, bh + 6); ctx.clip();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  S.map.paths.forEach((p) => { const pts = pathScreen(p); strokePoly(pts, cs * 0.78, 'rgba(0,0,0,.4)', 0, cs * 0.08); });
  S.map.paths.forEach((p, i) => {
    const pts = pathScreen(p);
    strokePoly(pts, cs * 0.74, i === leakPathGlow ? '#ff8a76' : '#e9dcc0');
    strokePoly(pts, cs * 0.6, i === leakPathGlow ? '#ffb0a0' : '#f3e8cf');
    ctx.lineCap = 'butt'; ctx.setLineDash([2, cs * 0.28]); strokePoly(pts, cs * 0.5, 'rgba(150,120,80,.3)'); ctx.setLineDash([]); ctx.lineCap = 'round';
  });
  ctx.restore();
  // 光（点灯中の塔）
  ctx.globalCompositeOperation = 'lighter';
  for (const tw of S.towers) {
    if (!L.isLit(tw)) continue;
    const p = S.map.peds[tw.ped]; const X = sx(p.x, p.y); const Y = sy(p.x, p.y); const r = L.towerRadius(tw) * cs;
    const gr = ctx.createRadialGradient(X, Y, r * 0.1, X, Y, r);
    gr.addColorStop(0, `rgba(${A.LIGHT[tw.type]},.28)`); gr.addColorStop(0.85, `rgba(${A.LIGHT[tw.type]},.13)`); gr.addColorStop(1, `rgba(${A.LIGHT[tw.type]},.02)`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const tw of S.towers) {
    if (!L.isLit(tw)) continue;
    const p = S.map.peds[tw.ped];
    ctx.strokeStyle = `rgba(${A.LIGHT[tw.type]},.45)`; ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.arc(sx(p.x, p.y), sy(p.x, p.y), L.towerRadius(tw) * cs, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  // 金の網目（ちがう色の重なり）
  drawMesh(t, S.towers, ui.mode === 'signal' ? 0.95 : 0.6);
  // 灯守の待機点
  S.map.keeperPts.forEach((p, i) => {
    const on = ui.mode === 'keeper';
    ctx.strokeStyle = on ? '#ffd36b' : 'rgba(255,211,107,.35)'; ctx.lineWidth = on ? 2.5 : 1.5;
    ctx.beginPath(); ctx.arc(sx(p.x, p.y), sy(p.x, p.y), cs * (on ? 0.3 + Math.sin(t * 5 + i) * 0.03 : 0.2), 0, Math.PI * 2); ctx.stroke();
    if (S.reserved.keeper === i || S.keeper.target === i) { ctx.fillStyle = 'rgba(255,211,107,.4)'; ctx.fill(); }
  });
  // 台座と塔
  S.map.peds.forEach((p, i) => drawPed(p, i, t));
  // 灯台
  const lx = sx(S.map.lh.x, S.map.lh.y); const ly = sy(S.map.lh.x, S.map.lh.y);
  A.drawLighthouse(ctx, lx, ly + cs * 0.38, cs * 1.45, t, { beam: !S.result || S.result === 'win', flash: lhFlash, beamLen: 5 });
  // 敵
  const list = S.enemies.map((e) => ({ e, q: L.enemyPos(S, e) }));
  list.sort((a, b) => sy(a.q.x, a.q.y) - sy(b.q.x, b.q.y));
  for (const { e, q } of list) drawEnemy(e, q, t);
  // 灯守
  const k = S.keeper; const kc = KEEPERS[k.type];
  if (k.target == null && k.cd <= 0) { ctx.strokeStyle = 'rgba(255,214,120,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx(k.x, k.y), sy(k.x, k.y), L.KEEPER_REACH * cs, 0, Math.PI * 2); ctx.stroke(); }
  A.drawKeeper(ctx, sx(k.x, k.y), sy(k.x, k.y) - cs * 0.05, cs * 0.95, kc.color, t, { moving: k.target != null, ready: k.cd <= 0 });
  if (k.target != null) { const p = S.map.keeperPts[k.target]; ctx.strokeStyle = 'rgba(255,214,120,.6)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(sx(k.x, k.y), sy(k.x, k.y)); ctx.lineTo(sx(p.x, p.y), sy(p.x, p.y)); ctx.stroke(); ctx.setLineDash([]); }
  // 予約中の合図
  if (S.reserved.signal) drawSignalPreview(S.reserved.signal, t, true);
  // 効果
  drawParticles(t);
  // 選択中の表示
  drawSelection(t);
  // 手引き
  drawGuide(t);
  // 入口の予告チップ（盤面の外に少しはみ出してよい）
  drawEntranceChips(t);
}

function roundRect(c, x, y, w, h, r) { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function strokePoly(pts, lw, color, ox = 0, oy = 0) {
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + ox, y + oy) : ctx.moveTo(x + ox, y + oy))); ctx.stroke();
}

function drawMesh(t, towers, alpha) {
  const lit = towers.filter(L.isLit);
  const cs = view.cs;
  ctx.save();
  for (let i = 0; i < lit.length; i++) for (let j = i + 1; j < lit.length; j++) {
    const a = lit[i]; const b = lit[j];
    if (a.type === b.type) continue;
    const pa = S.map.peds[a.ped]; const pb = S.map.peds[b.ped];
    const ra = L.towerRadius(a); const rb = L.towerRadius(b);
    if (L.dist(pa.x, pa.y, pb.x, pb.y) >= ra + rb) continue;
    ctx.save();
    ctx.beginPath(); ctx.arc(sx(pa.x, pa.y), sy(pa.x, pa.y), ra * cs, 0, Math.PI * 2); ctx.clip();
    ctx.beginPath(); ctx.arc(sx(pb.x, pb.y), sy(pb.x, pb.y), rb * cs, 0, Math.PI * 2); ctx.clip();
    ctx.globalAlpha = alpha * (0.75 + 0.25 * Math.sin(t * 3));
    ctx.fillStyle = 'rgba(255,200,80,.12)'; ctx.fillRect(view.ox, view.oy, boardW(), boardH());
    ctx.fillStyle = mesh; ctx.fillRect(view.ox, view.oy, boardW(), boardH());
    ctx.restore();
  }
  ctx.restore();
}

function drawPed(p, i, t) {
  const cs = view.cs; const X = sx(p.x, p.y); const Y = sy(p.x, p.y);
  const tw = L.towerAt(S, i);
  A.paper(ctx, (c) => c.ellipse(X, Y + cs * 0.12, cs * 0.38, cs * 0.24, 0, 0, Math.PI * 2), '#4a5891', { off: 4 });
  A.paper(ctx, (c) => c.ellipse(X, Y + cs * 0.06, cs * 0.34, cs * 0.2, 0, 0, Math.PI * 2), '#6573aa', { off: 0 });
  if (!tw) {
    ctx.strokeStyle = 'rgba(239,227,200,.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X - cs * 0.1, Y + cs * 0.06); ctx.lineTo(X + cs * 0.1, Y + cs * 0.06); ctx.moveTo(X, Y - cs * 0.04); ctx.lineTo(X, Y + cs * 0.16); ctx.stroke();
    return;
  }
  const lit = L.isLit(tw);
  const col = A.COLORS[tw.type];
  // 灯籠の塔
  const hgt = cs * (0.55 + tw.level * 0.08);
  A.paper(ctx, (c) => { c.moveTo(X - cs * 0.17, Y + cs * 0.06); c.lineTo(X - cs * 0.12, Y - hgt); c.lineTo(X + cs * 0.12, Y - hgt); c.lineTo(X + cs * 0.17, Y + cs * 0.06); c.closePath(); }, '#efe3c8', { off: 3 });
  ctx.fillStyle = lit ? col : '#555a78';
  if (lit) { ctx.shadowColor = col; ctx.shadowBlur = cs * 0.35; }
  ctx.fillRect(X - cs * 0.1, Y - hgt + cs * 0.04, cs * 0.2, cs * 0.2);
  ctx.shadowBlur = 0;
  A.paper(ctx, (c) => { c.moveTo(X - cs * 0.2, Y - hgt); c.lineTo(X, Y - hgt - cs * 0.16); c.lineTo(X + cs * 0.2, Y - hgt); c.closePath(); }, '#2b2f4f', { off: 2 });
  // 色覚補助の形
  ctx.fillStyle = lit ? col : '#8088a8'; ctx.strokeStyle = '#0a0c22'; ctx.lineWidth = 1.5;
  ctx.beginPath(); A.shapePath(ctx, L.TOWERS[tw.type].shape, X, Y - hgt * 0.38, cs * 0.14); ctx.fill(); ctx.stroke();
  // 段階
  for (let k = 0; k < tw.level; k++) { ctx.fillStyle = '#ffd36b'; ctx.beginPath(); A.starPath(ctx, X - cs * 0.14 + k * cs * 0.14, Y + cs * 0.22, cs * 0.06, cs * 0.028); ctx.fill(); }
  if (!lit) {
    ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X, Y - hgt * 0.4, cs * 0.3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - tw.off / L.RELOCATE_DARK)); ctx.stroke();
  }
  // 赤の照準
  if (tw.type === 'red' && lit && tw.aim) {
    const e = S.enemies.find((q) => q.id === tw.aim);
    if (e) {
      const q = L.enemyPos(S, e);
      ctx.strokeStyle = 'rgba(255,120,100,.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X, Y - hgt + cs * 0.14); ctx.lineTo(sx(q.x, q.y), sy(q.x, q.y) - cs * 0.15); ctx.stroke();
    }
  }
}

function drawEnemy(e, q, t) {
  const cs = view.cs; const d = L.ENEMIES[e.type];
  const lane = e.lane * cs * 0.12;
  const X = sx(q.x, q.y) + (view.portrait ? lane : 0); const Y = sy(q.x, q.y) + (view.portrait ? 0 : lane);
  const vx = view.portrait ? q.dy : q.dx; const face = vx < -0.01 ? -1 : 1;
  const u = d.boss ? cs * 1.0 : cs * 0.85;
  A.drawShadowBeast(ctx, e.type, X, Y, u, { t: t + e.id, face, hpFrac: e.hp / e.maxHp, stun: e.stun, armorOff: d.armor && e._yellow, shell: L.shellClosed(e), phase: e.phase });
  if (d.boss || d.heavy) {
    const w = d.boss ? cs * 1.2 : cs * 0.6; const yy = Y - u * (d.boss ? 1.5 : 0.6);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(X - w / 2, yy, w, 5);
    ctx.fillStyle = d.boss ? '#ff8a6a' : '#ffd36b'; ctx.fillRect(X - w / 2, yy, w * Math.max(0, e.hp / e.maxHp), 5);
  }
  if (e._mesh) {
    // 網目の中：光が強まる（赤・白が1.5倍）。足元に金の火花
    const k = (t * 3 + e.id * 0.37) % 1;
    ctx.strokeStyle = `rgba(255,214,90,${0.85 * (1 - k)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(X, Y + u * 0.32, u * (0.25 + k * 0.3), u * (0.08 + k * 0.1), 0, 0, Math.PI * 2); ctx.stroke();
  }
  if (d.armor && !e._yellow) { ctx.fillStyle = '#c8d0ff'; ctx.font = `bold ${Math.round(cs * 0.22)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('鎧', X, Y + u * 0.55); }
}

function drawParticles() {
  const cs = view.cs;
  for (const p of particles) {
    const k = p.t / p.life;
    const X = sx(p.x, p.y); const Y = sy(p.x, p.y);
    if (p.k === 'star') {
      ctx.globalAlpha = 1 - k; ctx.fillStyle = p.c; ctx.beginPath(); A.starPath(ctx, X, Y, p.r * cs * (1.4 - k * 0.5), p.r * cs * 0.5, 4, p.t * 6); ctx.fill(); ctx.globalAlpha = 1;
    } else if (p.k === 'ring') {
      ctx.strokeStyle = `rgba(255,214,90,${1 - k})`; ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(X, Y, p.r * cs * (0.3 + k * 0.9), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(255,240,180,${0.35 * (1 - k)})`; ctx.fill();
    } else if (p.k === 'ring2') {
      ctx.strokeStyle = `rgba(${p.c || '255,214,120'},${1 - k})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(X, Y, p.r * cs * (0.4 + k * 0.6), 0, Math.PI * 2); ctx.stroke();
    } else if (p.k === 'trail') {
      ctx.strokeStyle = `rgba(${p.c},${1 - k})`; ctx.lineWidth = 3; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(sx(p.x2, p.y2), sy(p.x2, p.y2)); ctx.stroke(); ctx.setLineDash([]);
    } else if (p.k === 'text') {
      ctx.globalAlpha = 1 - k * k; ctx.fillStyle = p.color; ctx.strokeStyle = '#0a0c22'; ctx.lineWidth = 4;
      ctx.font = `bold ${Math.round(cs * 0.42)}px sans-serif`; ctx.textAlign = 'center';
      ctx.strokeText(p.text, X, Y - k * cs * 0.6); ctx.fillText(p.text, X, Y - k * cs * 0.6); ctx.globalAlpha = 1;
    }
  }
}

function drawSignalPreview(sig, t, reserved = false) {
  const cs = view.cs; const r = L.signalRadius(S) * cs; const X = sx(sig.x, sig.y); const Y = sy(sig.x, sig.y);
  ctx.fillStyle = reserved ? 'rgba(255,214,90,.15)' : 'rgba(255,214,90,.22)';
  ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 2.5; ctx.setLineDash(reserved ? [6, 6] : []);
  ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); A.starPath(ctx, X, Y, cs * 0.2, cs * 0.09, 4, t * 2); ctx.fillStyle = '#ffe9a8'; ctx.fill();
  // 範囲内の影に印
  for (const e of S.enemies) {
    const q = L.enemyPos(S, e);
    if (L.dist(q.x, q.y, sig.x, sig.y) <= L.signalRadius(S)) { ctx.strokeStyle = '#fff2b0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx(q.x, q.y), sy(q.x, q.y), cs * 0.32, 0, Math.PI * 2); ctx.stroke(); }
  }
}

function drawSelection(t) {
  const cs = view.cs;
  const ring = (p, color = '#ffd36b') => { ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx(p.x, p.y), sy(p.x, p.y), cs * (0.45 + Math.sin(t * 6) * 0.04), 0, Math.PI * 2); ctx.stroke(); };
  if (ui.mode === 'ped' && ui.ped != null) {
    const p = S.map.peds[ui.ped]; ring(p);
    if (ui.choice) {
      const fake = { id: -1, ped: ui.ped, type: ui.choice, level: 1, spent: 0, off: 0 };
      previewRange(p, L.towerRadius(fake), ui.choice);
      drawMesh(t, [...S.towers, fake], 0.8);
    }
  }
  const tw = ui.tower != null ? S.towers.find((q) => q.id === ui.tower) : null;
  if ((ui.mode === 'tower' || ui.mode === 'relocate') && tw) {
    const p = S.map.peds[tw.ped]; ring(p);
    previewRange(p, L.towerRadius(tw), tw.type, ui.mode === 'relocate' ? 0.4 : 1);
  }
  if (ui.mode === 'relocate' && tw) {
    S.map.peds.forEach((p, i) => { if (!L.towerAt(S, i)) ring(p, i === ui.target ? '#ffffff' : 'rgba(255,211,107,.55)'); });
    if (ui.target != null) {
      const p = S.map.peds[ui.target];
      const moved = { ...tw, ped: ui.target, off: 0 };
      previewRange(p, L.towerRadius(moved), tw.type);
      drawMesh(t, S.towers.map((q) => (q.id === tw.id ? moved : q)), 0.85);
      const p0 = S.map.peds[tw.ped];
      ctx.strokeStyle = '#fff'; ctx.setLineDash([5, 5]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx(p0.x, p0.y), sy(p0.x, p0.y)); ctx.lineTo(sx(p.x, p.y), sy(p.x, p.y)); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  if (ui.mode === 'signal' && ui.sig) drawSignalPreview(ui.sig, t);
}
function previewRange(p, r, type, alpha = 1) {
  const cs = view.cs;
  ctx.fillStyle = `rgba(${A.LIGHT[type]},${0.18 * alpha})`; ctx.strokeStyle = `rgba(${A.LIGHT[type]},${0.9 * alpha})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(sx(p.x, p.y), sy(p.x, p.y), r * cs, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

// 次の波の予告（点線）
function drawPreview(t) {
  const idx = S.inWave ? S.waveIdx : S.waveIdx;
  const prev = L.wavePreview(S, idx);
  const cs = view.cs;
  for (const p of prev) {
    const path = S.map.paths[p.path];
    const pts = pathScreen(path);
    ctx.save();
    ctx.setLineDash([cs * 0.18, cs * 0.18]); ctx.lineDashOffset = -t * cs * 0.8;
    strokePoly(pts, cs * 0.9, S.inWave ? 'rgba(255,140,110,.18)' : 'rgba(255,140,110,.38)');
    ctx.restore();
  }
}

function drawEntranceChips(t) {
  if (S.result) return;
  const cs = view.cs;
  const idx = S.waveIdx;
  const prev = L.wavePreview(S, idx);
  const prevPaths = idx > 0 ? new Set(L.wavePreview(S, idx - 1).map((p) => p.path)) : new Set();
  for (const p of prev) {
    const path = S.map.paths[p.path];
    const q = L.pointAt(path, 0.9);
    let X = sx(q.x, q.y); let Y = sy(q.x, q.y);
    const chipH = Math.max(22, cs * 0.5);
    const items = p.groups;
    const iw = chipH * 1.55;
    const W = items.length * iw + 8;
    // 盤面内に収める
    X = Math.max(view.ox + W / 2 + 2, Math.min(view.ox + boardW() - W / 2 - 2, X));
    Y = Math.max(view.oy + chipH / 2 + 2, Math.min(view.oy + boardH() - chipH / 2 - 2, Y));
    ctx.globalAlpha = S.inWave ? 0.55 : 1;
    A.paper(ctx, (c) => roundRect(c, X - W / 2, Y - chipH / 2, W, chipH, 6), S.inWave ? '#d9ccb0' : '#efe3c8', { off: 3 });
    items.forEach((g, i) => {
      const cx = X - W / 2 + 4 + i * iw;
      A.drawEnemyIcon(ctx, g.type, cx + chipH * 0.45, Y + chipH * 0.05, chipH * 0.75, t);
      ctx.fillStyle = '#0a0c22'; ctx.font = `bold ${Math.round(chipH * 0.48)}px sans-serif`; ctx.textAlign = 'left';
      ctx.fillText(`${g.count}`, cx + chipH * 0.86, Y + chipH * 0.18);
    });
    if (S.inWave) { ctx.fillStyle = '#0a0c22'; ctx.font = `bold ${Math.round(chipH * 0.36)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('次', X - W / 2 - chipH * 0.3, Y + chipH * 0.12); }
    ctx.globalAlpha = 1;
    if (!S.inWave && idx > 0 && !prevPaths.has(p.path)) {
      const bob = Math.sin(t * 5) * 4;
      ctx.fillStyle = '#ffcf5a'; ctx.strokeStyle = '#0a0c22'; ctx.lineWidth = 3;
      ctx.font = `bold ${Math.round(cs * 0.36)}px sans-serif`; ctx.textAlign = 'center';
      const tw = ctx.measureText('次はこちら').width / 2 + 4;
      const TX = Math.max(view.ox + tw, Math.min(view.ox + boardW() - tw, X));
      ctx.strokeText('次はこちら', TX, Y - chipH * 0.85 + bob); ctx.fillText('次はこちら', TX, Y - chipH * 0.85 + bob);
    }
  }
}

// ───────── 手引き（第1夜の初回だけ）─────────
// 流れ：目的（何を守るか）→ 光で影が消えるのを見る → 光を重ねる（青塔を動かす）→ 網目に入ったら合図 → まとめ
const COACH = {
  intro: { k: '目的', html: '影の群れが<b>道を歩いて灯台へ</b>向かってくる。灯台にたどり着かれると<b>♥耐久</b>が減る。<br>♥が0になる前に、<b>6つの波をしのげば夜明け</b>。<br>上の数字：<b>♥</b>＝耐久／<b>⚡</b>＝電池（塔を建てるお金）／<b>0/6</b>＝波。', btn: 'つぎへ' },
  light: { k: '塔の光', html: '塔のまわりの<b>光の輪</b>に入った影は削られる。<b>赤</b>＝撃って削る／<b>青</b>＝遅くする。<br>最初の群れが来る。見てみよう。', btn: '波を始める' },
  0: { k: '光を重ねる', html: '光で影が消えた！ でも1つの光だけでは、群れは止めきれない。<br>ちがう色の光が<b>重なる所</b>は光が<b>1.5倍</b>になり、まとめて倒せる場所になる。<b>青い塔をタップ</b>しよう。<span class="coach-p">（いまは一時停止中）</span>' },
  1: { k: '光を重ねる', html: '青の光を<b>赤の光に重ねたい</b>。塔は動かせるので<b>《移設》</b>を押そう。<span class="coach-p">（いまは一時停止中）</span>' },
  2: { k: '光を重ねる', html: '<b>光っている真ん中の台座</b>をタップ。赤い光と青い光が重なる。<span class="coach-p">（いまは一時停止中）</span>' },
  3: { k: '金の網目', html: '赤と青が重なって<b>金の網目</b>ができた。<br>影が網目に入るまで待とう……' },
  hit: { k: '合図', html: '<b>今！</b> 網目の中に影がいる。<b>《合図》</b>を押して、<b>網目をタップ</b>しよう。網目の中の影をまとめて吹き飛ばす。<span class="coach-p">（いまは一時停止中）</span>' },
  4: { k: '合図', html: '<b>金の網目をタップ</b>して、もう一度タップ（か《放つ》）で発動。' },
  done: { k: 'できた', html: '', btn: '遊びはじめる' },
};
function renderCoach() {
  const el = $('coach');
  if (!guide || screen !== 'play') { el.hidden = true; return; }
  const key = guide.step === 3 && guide.hit ? 'hit' : guide.step;
  const c = COACH[key]; if (!c) { el.hidden = true; return; }
  let html = c.html;
  if (key === 'done') html = `${guide.kills >= 2 ? `<b>${guide.kills}体</b>まとめて` : '網目の影が'}星屑に！ これがこのゲームの決め技。<ul class="coach-l"><li><b>台座の＋</b>で塔を建てる（⚡を使う。⚡は影を倒すと増える）</li><li>重なる色が多いほど合図は強い（3色・4色）</li><li>塔をタップで<b>強化・移設</b></li><li>波が終わったら<b>《次の波》</b></li></ul>`;
  el.innerHTML = `<span class="coach-k">${c.k}</span><span class="coach-t">${html}</span>${c.btn ? `<button id="coachBtn" class="coach-btn" type="button">${c.btn}</button>` : ''}`;
  el.hidden = false;
  el.classList.toggle('mid', key === 'intro' && view.portrait);
  const b = $('coachBtn'); if (b) b.addEventListener('click', coachNext);
}
function coachNext() {
  audio.unlock();
  if (!guide) return;
  if (guide.step === 'intro') { guide.step = 'light'; renderCoach(); return; }
  if (guide.step === 'light') { guide.step = 'watch'; $('coach').hidden = true; L.startWave(S); showRibbon('光の輪に入った影が削られていく', 0); renderBar(true); return; }
  if (guide.step === 'done') { guide = null; $('coach').hidden = true; hideRibbon(); L.setPaused(S, false); showRibbon('《次の波》で次へ。電池⚡で塔を増やそう', 3600); renderBar(true); updateHud(); }
}
// 毎フレーム：見せたい瞬間で止める
function guideTick() {
  if (!guide || !S) return;
  if (guide.step === 'watch' && guide.pauseAt && performance.now() >= guide.pauseAt) {
    guide.step = 0; guide.pauseAt = 0; hideRibbon(); L.setPaused(S, true); renderCoach(); renderBar(true);
  }
  if (guide.step === 'boom' && performance.now() >= guide.doneAt) { guide.step = 'done'; L.setPaused(S, true); renderCoach(); renderBar(true); }
  if (guide.step === 3 && guide.wait && !S.paused) {
    // 網目に何体か入ったところで止める（1体だけで撃たせない）。残りが少なければその数で
    const inMesh = S.enemies.filter((e) => { const q = L.enemyPos(S, e); return L.isOverlap(S, q.x, q.y); }).length;
    if (inMesh >= Math.min(3, S.enemies.length) && inMesh > 0) { guide.wait = false; guide.hit = true; L.setPaused(S, true); renderCoach(); renderBar(true); }
  }
}

function drawGuide(t) {
  if (!guide) return;
  const cs = view.cs;
  const arrow = (x, y, label) => {
    const X0 = sx(x, y); const Y = sy(x, y) - cs * 0.9 + Math.sin(t * 6) * 5;
    const X = X0;
    const lx = Math.max(view.ox + cs * 1.4, Math.min(view.ox + boardW() - cs * 1.4, X0));
    ctx.fillStyle = '#ffcf5a'; ctx.strokeStyle = '#0a0c22'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(X, Y + cs * 0.35); ctx.lineTo(X - cs * 0.2, Y); ctx.lineTo(X + cs * 0.2, Y); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (label) { ctx.font = `bold ${Math.round(Math.max(14, cs * 0.34))}px sans-serif`; ctx.textAlign = 'center'; ctx.strokeText(label, lx, Y - cs * 0.12); ctx.fillText(label, lx, Y - cs * 0.12); }
  };
  if (guide.step === 'intro') {
    for (const p of S.map.paths) { const q = L.pointAt(p, 0.6); arrow(q.x, q.y, '影はここから'); }
    arrow(S.map.lh.x, S.map.lh.y, '灯台を守る');
  }
  if (guide.step === 'light') { const r = S.towers.find((q) => q.type === 'red'); if (r) { const p = S.map.peds[r.ped]; arrow(p.x, p.y, '光の輪'); } }
  const blue = S.towers.find((q) => q.type === 'blue');
  if (guide.step === 0 && blue && ui.mode !== 'tower') { const p = S.map.peds[blue.ped]; arrow(p.x, p.y, '青塔をタップ'); }
  if (guide.step === 2 && ui.mode === 'relocate') { const p = S.map.peds[2]; if (!L.towerAt(S, 2)) arrow(p.x, p.y, 'ここへ'); }
  if (guide.step >= 3 && guide.step <= 4) {
    const c = overlapCenter();
    if (c && (guide.step === 4 && ui.mode === 'signal' && !ui.sig)) arrow(c.x, c.y, '網目をタップ');
  }
}
function overlapCenter() {
  let sxs = 0; let sys = 0; let n = 0;
  for (const p of S.map.paths) for (let d = 0; d <= p.len; d += 0.25) { const q = L.pointAt(p, d); if (L.isOverlap(S, q.x, q.y)) { sxs += q.x; sys += q.y; n += 1; } }
  return n ? { x: sxs / n, y: sys / n } : null;
}

// ───────── タイトル画面 ─────────
function renderTitle(t) {
  const { w, h } = view;
  A.drawSky(ctx, w, h, t, ['#0d1b3d', '#1d3a7a']);
  const portrait = h > w;
  const m = Math.min(w, h);
  A.drawMoon(ctx, w * (portrait ? 0.18 : 0.46), h * (portrait ? 0.1 : 0.14), m * 0.05);
  // 崖（白い紙）と灯台：右上
  const baseY = h * (portrait ? 0.36 : 0.46);
  const cliffX = w * (portrait ? 0.58 : 0.7);
  A.paper(ctx, (c) => { c.moveTo(cliffX - w * 0.1, h); c.lineTo(cliffX - w * 0.03, baseY + h * 0.03); c.lineTo(cliffX + w * 0.08, baseY - h * 0.01); c.lineTo(w * 1.02, baseY - h * 0.05); c.lineTo(w * 1.02, h); c.closePath(); }, '#e6dcc6', { off: 6, shadow: 'rgba(0,0,0,.4)' });
  A.paper(ctx, (c) => { c.moveTo(cliffX + w * 0.0, h); c.lineTo(cliffX + w * 0.04, baseY + h * 0.1); c.lineTo(w * 1.02, baseY + h * 0.05); c.lineTo(w * 1.02, h); c.closePath(); }, '#cfc3aa', { off: 4 });
  const lhH = Math.min(h * (portrait ? 0.27 : 0.36), w * (portrait ? 0.62 : 0.4));
  const lhX = cliffX + (w - cliffX) * 0.5;
  A.drawLighthouse(ctx, lhX, baseY, lhH, t, { beam: true, beamLen: 5 });
  // 橙の光の筋が手前の小舟を照らす
  const bx = w * (portrait ? 0.4 : 0.56); const by = h * (portrait ? 0.62 : 0.8);
  const g = ctx.createLinearGradient(lhX, baseY - lhH * 0.86, bx, by);
  g.addColorStop(0, 'rgba(255,190,100,.5)'); g.addColorStop(1, 'rgba(255,190,100,.06)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lhX, baseY - lhH * 0.86); ctx.lineTo(bx - m * 0.2, by + m * 0.08); ctx.lineTo(bx + m * 0.2, by + m * 0.08); ctx.closePath(); ctx.fill();
  // 対岸の影鹿と群れ
  const shoreY = h * (portrait ? 0.5 : 0.66);
  const dx = w * (portrait ? 0.2 : 0.36);
  A.paper(ctx, (c) => { c.moveTo(dx - w * 0.32, shoreY + 30); c.quadraticCurveTo(dx, shoreY - 18, dx + w * (portrait ? 0.3 : 0.16), shoreY + 24); c.lineTo(dx + w * 0.3, h); c.lineTo(dx - w * 0.4, h); c.closePath(); }, '#1b2550', { off: 4 });
  for (let i = 0; i < 6; i++) A.drawShadowBeast(ctx, i % 2 ? 'rabbit' : 'rat', dx - m * 0.1 - i * m * 0.06, shoreY + 6 + (i % 2) * 6, m * 0.07, { t: t + i, face: 1 });
  const back = ctx.createRadialGradient(dx, shoreY - m * 0.18, 0, dx, shoreY - m * 0.18, m * 0.36);
  back.addColorStop(0, 'rgba(255,170,90,.55)'); back.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = back; ctx.beginPath(); ctx.arc(dx, shoreY - m * 0.18, m * 0.36, 0, Math.PI * 2); ctx.fill();
  A.drawBigDeer(ctx, dx, shoreY - m * 0.02, m * (portrait ? 0.14 : 0.13), t);
  // 海
  A.drawWaves(ctx, 0, h * (portrait ? 0.56 : 0.72), w, h * (portrait ? 0.46 : 0.3), t, 4);
  // 小舟とミナ
  A.drawBoat(ctx, bx, by + m * 0.04, m * 0.075, t, 3, 3);
  A.drawKeeper(ctx, bx + m * 0.035, by - m * 0.025, m * 0.12, '#ffd23f', t, { ready: true });
  for (let i = 0; i < 3; i++) A.drawBoat(ctx, w * (0.7 + i * 0.1), h * ((portrait ? 0.68 : 0.86) + (i % 2) * 0.05), m * 0.04, t, i + 1, 3);
}

// ───────── 起動 ─────────
window.addEventListener('resize', () => { resize(); });
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { if (!OG) resize(); }).observe($('stage'));
resize();
if (OG) setupOg(); else if (qs.get('play')) setupPlayback(qs.get('play'), Number(qs.get('f') || 0)); else showTitle();

// 確認用：?play=normal:5&f=3000 で攻略記録をその場面まで再生して止める
async function setupPlayback(key, f) {
  const [m, n] = key.split(':');
  let plan = null;
  try { plan = (await (await fetch('solutions.json')).json())[key]; } catch { /* なし */ }
  startNight(Number(n), { mode: m, keeper: plan?.keeper, fromSelect: true });
  if (!plan) return;
  let i = 0;
  while (S.frame < f && !S.result) {
    while (i < plan.actions.length && plan.actions[i].f <= S.frame) { L.applyAction(S, plan.actions[i]); i += 1; }
    L.step(S);
    if (S.frame > f - 90) handleFx(); else S.fx.length = 0;
  }
  if (!qs.has('run')) L.setPaused(S, true);
  updateHud(); renderBar(true);
}
requestAnimationFrame(frame);

// 共有画像：第6夜の攻略記録を再生して、王と群れが重なりに入る場面で止める
async function setupOg() {
  document.body.classList.add('og');
  $('ogBanner').hidden = false;
  let plan = null;
  try { const data = await (await fetch('solutions.json')).json(); plan = data['normal:5']; } catch { /* なければ配置だけ */ }
  S = L.createNight(5, { mode: 'normal', keeper: plan?.keeper || 'mina' });
  screen = 'play';
  $('title').hidden = true;
  if (plan) {
    const acts = plan.actions; let i = 0; let target = null;
    while (!S.result && S.frame < 60 * 60 * 20) {
      while (i < acts.length && acts[i].f <= S.frame) { L.applyAction(S, acts[i]); i += 1; }
      L.step(S);
      const sig = S.fx.find((f) => f.kind === 'signal');
      handleFx();
      const king = S.enemies.find((e) => e.type === 'kingdeer');
      if (king && sig && S.enemies.length >= 4) { target = S.frame; break; }
      if (king && king.s > 7 && S.enemies.length >= 5) { target = S.frame; break; }
    }
    void target;
    particles = particles.filter((p) => p.k !== 'text');
  }
  view.portrait = false;
  // 盤面を右に寄せて、左に題字の余白
  const w = view.w; const h = view.h;
  view.cs = Math.min((w * 0.66) / L.COLS, (h - 30) / L.ROWS);
  view.ox = w - view.cs * L.COLS - 18; view.oy = (h - view.cs * L.ROWS) / 2;
}

// 動作確認用の小さな窓口（自動テストで盤面の座標を知るため）
window.__moonlit = { state: () => S, toScreen: (x, y) => ({ x: sx(x, y), y: sy(x, y) }), ui, guide: () => guide, overlapCenter: () => overlapCenter() };
