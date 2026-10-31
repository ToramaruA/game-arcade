import {
  ROUTES, SPECIES, MAX_HULL, MAX_STIMULI, DIST_LABEL, STIMULUS_LABEL, CUE_LABEL, maxQualityOf,
  newGame, preview, stimulate, shoot, advance, summarize, shareText, updateBest, cueOf, encounterOf, encountersOf,
  isLastEncounter, snapshot, routeById, canStimulate,
  routeCleared, sanitizeUnlocked, isUnlocked, unlockCondition, applyClear,
} from './logic.js';
import { SW, SH, CARD_W, CARD_H, drawScene, drawSonar, drawCard } from './art.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const OG = params.get('og') === '1';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (OG) document.body.classList.add('og');

const winC = $('win').getContext('2d');
const sonarC = $('sonar').getContext('2d');
const sampleC = $('sample').getContext('2d');

let unlocked = loadUnlocked(); // 保存できなくてもこの変数でセッション中は進行できる
let state = newGame(readLast());
let busy = false;
let fx = null; // { type, t0, dur }
const anim = { dist: 0, focus: 0, demo: 0 };
let logItems = [];
let confirmKind = null;
let confirmTimer = null;
let frameSel = 0;
let frames = [];

function readLast() {
  try { const r = localStorage.getItem('abyssal-signal:route'); if (ROUTES.some((x) => x.id === r) && isUnlocked(unlocked, r)) return r; } catch (e) { /* 保存不可でも遊べる */ }
  return 'standard';
}
function saveRoute(id) { try { localStorage.setItem('abyssal-signal:route', id); } catch (e) { /* noop */ } }
function loadUnlocked() {
  try { const v = localStorage.getItem('abyssal-signal:unlocked'); return v == null ? 1 : sanitizeUnlocked(Number(v)); } catch (e) { return 1; }
}
function saveUnlocked(n) { try { localStorage.setItem('abyssal-signal:unlocked', String(n)); } catch (e) { /* noop */ } }
function loadBest(route) {
  try { const v = localStorage.getItem(`abyssal-signal:best:${route}`); return v == null ? null : Number(v); } catch (e) { return null; }
}
function saveBest(route, v) { try { localStorage.setItem(`abyssal-signal:best:${route}`, String(v)); } catch (e) { /* noop */ } }

const now = () => performance.now();
const say = (t) => { $('msg').textContent = t; };

function addLog(text, cls = '') {
  logItems.push({ text, cls });
  const ol = $('log');
  const li = document.createElement('li');
  li.textContent = text; if (cls) li.className = cls;
  ol.appendChild(li);
  ol.scrollTop = ol.scrollHeight;
}

function setFx(type, dur) { fx = reduce ? null : { type, t0: now(), dur }; }
function lock(ms, then) {
  busy = true;
  const done = () => { busy = false; if (then) then(); render(); };
  if (ms <= 0) done(); else setTimeout(done, ms);
}

// ---------- 表示 ----------
function buildRoutes() {
  const box = $('routes'); box.textContent = '';
  for (const r of ROUTES) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.id = r.id;
    b.addEventListener('click', () => {
      if (b.getAttribute('aria-disabled') === 'true' || !isUnlocked(unlocked, r.id)) return;
      saveRoute(r.id); restart(r.id);
    });
    box.appendChild(b);
  }
}
function renderRoutes() {
  const fresh = state.index === 0 && state.used === 0 && !state.shotTaken && !state.over;
  for (const b of $('routes').children) {
    const open = isUnlocked(unlocked, b.dataset.id);
    const r = routeById(b.dataset.id);
    b.textContent = `${open ? '' : '🔒 '}${'★'.repeat(r.level)} ${r.name}`;
    b.title = open ? '' : `未解放：${unlockCondition(r.id)}で解放`;
    b.classList.toggle('locked', !open);
    b.setAttribute('aria-pressed', String(b.dataset.id === state.route));
    b.setAttribute('aria-disabled', String(!fresh || !open));
  }
  const route = routeById(state.route);
  $('routeInfo').innerHTML = `<b>難しさ：${'★'.repeat(route.level)}${'☆'.repeat(3 - route.level)} ${route.levelText}${route.level === 1 ? '（最初はここ）' : ''}</b>　${route.adds}<br>${route.learn}`;
  const next = ROUTES.find((r) => !isUnlocked(unlocked, r.id));
  if (next) $('routeInfo').innerHTML += `<br><span class="lock">🔒 ${next.name}：${unlockCondition(next.id)}で解放</span>`;
  const ol = $('alerts'); ol.textContent = '';
  route.encounters.forEach((e, i) => {
    const li = document.createElement('li');
    li.className = (i === state.index && $('result').hidden ? 'on ' : '') + (e.alert ? 'warn' : '');
    li.innerHTML = `${e.depth}m<br><b>警戒+${e.alert}</b>`;
    ol.appendChild(li);
  });
}

function render() {
  const enc = encounterOf(state);
  $('hudDepth').textContent = enc.depth;
  $('rDepth').textContent = enc.depth;
  $('rTarget').textContent = enc.target;
  [...$('rDist').children].forEach((li, i) => li.classList.toggle('on', i === state.dist));
  $('rDist').setAttribute('aria-label', `距離 ${DIST_LABEL[state.dist]}`);
  const hb = $('hullBar'); hb.textContent = '';
  for (let i = 0; i < MAX_HULL; i++) { const e = document.createElement('i'); if (i < state.hull) e.className = 'f'; hb.appendChild(e); }
  const tone = state.hull <= 2 ? 'red' : state.hull <= 4 ? 'amber' : '';
  hb.className = `hull ${tone}`; $('rHull').className = tone; $('rHull').textContent = state.hull;
  $('hullState').textContent = tone === 'red' ? '危険' : tone === 'amber' ? '警戒' : '良好';
  const left = MAX_STIMULI - state.used;
  $('rLeft').textContent = left;
  const pips = $('pips'); pips.textContent = '';
  for (let i = 0; i < MAX_STIMULI; i++) { const e = document.createElement('i'); if (i < left) e.className = 'f'; pips.appendChild(e); }
  const goal = enc.target === '全身' ? '全身をフレームに収めよう' : `「${enc.target}」が写る距離を探そう`;
  const first = state.route === 'standard' && state.index === 0 && !state.over;
  const nStim = routeById(state.route).stimuli.length;
  let coach = '';
  if (first && !state.shotTaken && !busy) {
    if (state.used === 0) coach = '① まず光か音を押して、生物の反応を見よう（刺激は3回まで）';
    else coach = `② 距離は「${DIST_LABEL[state.dist]}」。「見本」欄の絵に近い見え方なら 📷 で撮影。別の刺激でさらに探ってもOK（残り${MAX_STIMULI - state.used}回）`;
  }
  $('hint').textContent = coach || goal;
  $('hint').classList.toggle('coach', !!coach);
  $('mission').hidden = !first || state.used > 0 || state.shotTaken;
  $('missionN').textContent = nStim === 2 ? '2つ' : `${nStim}つ`;
  const nudgeStim = first && state.used === 0 && !busy;
  const nudgeShot = first && state.used > 0 && !state.shotTaken && !busy;
  for (const b of document.querySelectorAll('.stim')) b.classList.toggle('nudge', nudgeStim);
  $('shootNext').classList.toggle('nudge', nudgeShot);
  $('sampleText').textContent = `${SPECIES[enc.species].name}／${enc.target}`;
  drawSample(enc);

  const can = canStimulate(state) && !busy;
  for (const b of document.querySelectorAll('.stim')) {
    const k = b.dataset.k; const p = preview(state, k);
    const pv = b.querySelector('.pv');
    b.hidden = !routeById(state.route).stimuli.includes(k);
    b.setAttribute('aria-disabled', String(!can || !!confirmKind));
    pv.className = 'pv';
    if (!canStimulate(state)) pv.textContent = state.shotTaken ? '撮影済み' : '使い切り';
    else if (p.lethal) { pv.textContent = '⚠ 耐久0・帰還不能'; pv.className = 'pv lethal'; }
    else if (p.damage) { pv.textContent = `⚠ 損傷-${p.damage} 耐久${p.hullAfter}`; pv.className = 'pv hurt'; }
    else pv.textContent = `損傷なし 耐久${p.hullAfter}`;
  }
  const shootOk = !state.over && !state.shotTaken && !busy && !confirmKind;
  $('shootNext').hidden = isLastEncounter(state);
  $('shootNext').setAttribute('aria-disabled', String(!shootOk));
  $('shootReturn').setAttribute('aria-disabled', String(!shootOk));
  renderRoutes();
}

function drawSample(enc) {
  const best = enc.base.indexOf(Math.max(...enc.base));
  sampleC.save(); sampleC.clearRect(0, 0, 120, 88); sampleC.scale(120 / SW, 88 / SH);
  drawScene(sampleC, { species: enc.species, target: enc.target, depth: enc.depth, dist: best, focus: 1, t: 2, still: 1 });
  sampleC.restore();
}

// ---------- 進行 ----------
function introEncounter() {
  const enc = encounterOf(state);
  const sp = SPECIES[enc.species];
  const cue = cueOf(sp.react.light);
  addLog(`${enc.depth}m 試験光（弱）→ ${CUE_LABEL[cue]}（回数・耐久は減らない）`, 'demo');
  if (enc.species === 'C') addLog('ソナーに窓幅を超える反応', 'demo');
  const route = routeById(state.route);
  if (state.index === 0 && route.level === 2) addLog('新操作「静かに待つ」：動かず見守る。リボンレイは動かないのでピントが合う。鎧クラゲは離れる', 'demo');
  if (state.index === 0 && route.level === 3) addLog('新操作「艇を止める」：どの生物でも距離を保ってピントを合わせる（近距離だと損傷は出る）', 'demo');
  if (enc.species === 'B' && route.level === 1 && state.index === 2) addLog('鎧クラゲ：リボンレイとは反応が違う。試験光の反応をよく見よう', 'demo');
  anim.demo = sp.react.light;
  setFx('demo', 1100);
  say('');
}

function restart(routeId) {
  clearTimeout(confirmTimer);
  state = newGame(routeId); anim.dist = 0; anim.focus = 0; fx = null; busy = false; confirmKind = null;
  logItems = []; $('log').textContent = '';
  $('confirm').hidden = true;
  $('result').hidden = true; $('play').hidden = false; document.body.classList.remove('dev');
  introEncounter(); render();
}

function doStimulus(kind, confirmed = false) {
  if (busy || !canStimulate(state)) return;
  const p = preview(state, kind);
  if (p.lethal && !confirmed) return openConfirm(kind, p);
  const r = stimulate(state, kind, true);
  if (!r.ok) return;
  state = r.state;
  const label = STIMULUS_LABEL[kind];
  addLog(`${encounterOf(state).depth}m ${label} → ${CUE_LABEL[r.cue]}（距離：${DIST_LABEL[state.dist]}）${r.damage ? ` 損傷-${r.damage}` : ''}`, r.damage ? 'dmg' : 'act');
  say(r.damage ? `損傷 -${r.damage}。耐久 ${state.hull}` : `${CUE_LABEL[r.cue]}`);
  setFx(kind, 900);
  lock(reduce ? 0 : 950, () => { if (state.over === 'lost') showResult(); });
  render();
}

function doShoot(mode) {
  if (busy || state.over || state.shotTaken) return;
  const r = shoot(state, mode);
  if (!r.ok) return;
  state = r.state;
  const ph = state.photos[state.photos.length - 1];
  addLog(`${ph.depth}m 撮影：観測品質 ${ph.quality}（${SPECIES[ph.species].name}／${ph.target}）`, 'shot');
  say(`撮影しました。観測品質 ${ph.quality}${state.photos.length === 1 ? '（見本に近いほど高品質）。次の生物は反応が違うかも。まず試験光の反応を見よう' : ''}`);
  $('shutter').classList.remove('fire'); void $('shutter').offsetWidth; $('shutter').classList.add('fire');
  fx = reduce ? null : { type: 'shutter', t0: now(), dur: 600 };
  render();
  lock(reduce ? 0 : 650, () => {
    if (mode === 'return') showResult();
    else { state = advance(state).state; anim.focus = 0; introEncounter(); }
  });
}

function openConfirm(kind, p) {
  confirmKind = kind;
  $('confirmD').textContent = `「${STIMULUS_LABEL[kind]}」で損傷-${p.damage}、耐久 ${state.hull} → 0。探査艇をロストし、ここまでの写真は未回収になります。`;
  $('confirm').hidden = false;
  const yes = $('confirmYes'); yes.setAttribute('aria-disabled', 'true');
  clearTimeout(confirmTimer);
  confirmTimer = setTimeout(() => yes.setAttribute('aria-disabled', 'false'), 900);
  render(); $('confirmNo').focus();
}
function closeConfirm() { confirmKind = null; clearTimeout(confirmTimer); $('confirm').hidden = true; render(); }

// ---------- 結果 ----------
function makeFrames() {
  frames = encountersOf(state).map((enc, i) => {
    const p = state.photos.find((x) => x.index === i);
    if (p) return { photo: p, kind: 'photo' };
    if (state.over === 'lost' && i === state.index) return { photo: { ...snapshot(state), index: i }, kind: 'window' };
    return null;
  });
}
const metaOf = (f, sum) => ({
  speciesName: SPECIES[f.photo.species].name, target: f.photo.target, hull: sum.hull,
  returned: sum.returned, qualityText: f.kind === 'window' ? '最後の窓' : `観測品質 ${f.photo.quality}/6`,
});

function showResult() {
  const sum = summarize(state);
  let note = '';
  let unlockMsg = '';
  if (routeCleared(state)) {
    const u = applyClear(unlocked, state.route);
    if (u.newRoute) {
      unlocked = u.unlocked; saveUnlocked(unlocked);
      unlockMsg = `🔓 新しい航路「${routeById(u.newRoute).name}」が解放されました。下のボタンから挑めます`;
    } else if (unlocked < ROUTES.length) unlockMsg = '航路クリア。（まだ先の航路は、いまの最先端の航路をクリアすると解放されます）';
  } else if (sum.returned && unlocked < ROUTES.length) {
    const front = ROUTES[unlocked - 1];
    unlockMsg = `途中帰還は成功ですが航路クリアではありません。「${front.name}」を最終深度まで撮影して帰還すると次の航路が解放されます`;
  }
  $('unlockNote').textContent = unlockMsg; $('unlockNote').hidden = !unlockMsg;
  if (sum.returned) {
    const u = updateBest(loadBest(state.route), sum);
    if (u.isNew) { saveBest(state.route, u.best); note = u.best === sum.total ? '（この航路のベスト更新）' : ''; }
    sum.best = u.best;
  }
  $('play').hidden = true; $('result').hidden = false; document.body.classList.add('dev');
  $('resTitle').textContent = sum.lost ? '探査艇ロスト　記録未回収' : '帰還　写真を持ち帰った';
  const best = loadBest(state.route);
  $('stats').innerHTML = sum.lost
    ? `最後の窓：<b>${sum.depth}</b> m　撮影履歴 ${sum.photos.length} 枚（未回収・成功記録には入りません）`
    : `観測品質の合計 <b>${sum.total}</b> / ${maxQualityOf(state.route)}（この航路の理論上の尺度）${note}<br>写真 <b>${sum.count}</b> 枚　到達 <b>${sum.depth}</b> m　残耐久 <b>${sum.hull}</b>${best != null ? `　この航路のベスト ${best}` : ''}`;
  makeFrames();
  frameSel = frames.map((f, i) => (f ? i : -1)).filter((i) => i >= 0).slice(-1)[0] ?? 0;
  // 帰還時は最高品質の写真を初期選択
  if (sum.returned) {
    let bq = -1; frames.forEach((f, i) => { if (f && f.photo.quality >= bq) { bq = f.photo.quality; frameSel = i; } });
  }
  renderSheet(sum); renderCard(sum);
  const retry = $('retry'); retry.textContent = '';
  for (const r of ROUTES) {
    const open = isUnlocked(unlocked, r.id);
    const b = document.createElement('button');
    if (!open) {
      b.type = 'button'; b.className = 'shot locked'; b.setAttribute('aria-disabled', 'true');
      b.textContent = `🔒 ${'★'.repeat(r.level)} ${r.name}`; b.title = `${unlockCondition(r.id)}で解放`;
      retry.appendChild(b); continue;
    }
    b.type = 'button'; b.className = 'shot';
    b.textContent = r.id === state.route ? `同じ航路で（${'★'.repeat(r.level)} ${r.name}）` : `${'★'.repeat(r.level)} ${r.name}の航路へ`;
    b.title = `${r.levelText}：${r.adds}`;
    b.addEventListener('click', () => { saveRoute(r.id); restart(r.id); window.scrollTo(0, 0); });
    retry.appendChild(b);
  }
  renderRoutes();
  $('resMsg').textContent = '';
  $('resTitle').focus({ preventScroll: true });
}

function renderSheet(sum) {
  const box = $('sheet'); box.textContent = '';
  frames.forEach((f, i) => {
    const b = document.createElement('button'); b.type = 'button';
    if (!f) {
      b.disabled = true; b.innerHTML = `<span class="none">未観測</span>${encountersOf(state)[i].depth}m`;
    } else {
      const cv = document.createElement('canvas'); cv.width = 150; cv.height = 110;
      const c = cv.getContext('2d'); c.scale(150 / SW, 110 / SH);
      drawScene(c, { species: f.photo.species, target: f.photo.target, depth: f.photo.depth, dist: f.photo.dist, focus: f.photo.focus, t: 2.4 + i, still: 1, light: .35 });
      b.appendChild(cv);
      const tag = document.createElement('span');
      tag.textContent = `${f.photo.depth}m ${f.kind === 'window' ? '最後の窓' : sum.returned ? `品質${f.photo.quality}` : '未回収'}`;
      if (!sum.returned) tag.className = 'lost';
      b.appendChild(tag);
      b.setAttribute('aria-label', `${f.photo.depth}m ${SPECIES[f.photo.species].name} ${f.photo.target}`);
      b.setAttribute('aria-pressed', String(i === frameSel));
      b.addEventListener('click', () => { frameSel = i; renderSheet(sum); renderCard(sum); });
    }
    box.appendChild(b);
  });
}

function renderCard(sum) {
  const f = frames[frameSel]; if (!f) return;
  const c = $('card').getContext('2d');
  drawCard(c, f.photo, metaOf(f, sum));
  $('card').setAttribute('aria-label', `${f.photo.depth}mの写真：${SPECIES[f.photo.species].name}、${f.photo.target}${sum.returned ? '' : '（未回収）'}`);
  $('share').textContent = sum.lost ? shareText(state, f.photo) : shareText(state, f.photo);
}

function savePng() {
  const sum = summarize(state); const f = frames[frameSel]; if (!f) return;
  try {
    const cv = document.createElement('canvas'); cv.width = CARD_W; cv.height = CARD_H;
    drawCard(cv.getContext('2d'), f.photo, metaOf(f, sum));
    cv.toBlob((blob) => {
      if (!blob) { $('resMsg').textContent = '保存できませんでした。表示中のカードをスクリーンショットで保存してください。'; return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `abyssal-signal-${f.photo.depth}m.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      $('resMsg').textContent = '画像を保存しました。保存されない場合は、表示中のカードをスクリーンショットで残せます。';
    }, 'image/png');
  } catch (e) {
    $('resMsg').textContent = '保存できませんでした。表示中のカードをスクリーンショットで保存してください。';
  }
}

async function copyShare() {
  const text = $('share').textContent;
  try {
    await navigator.clipboard.writeText(text);
    $('resMsg').textContent = '共有文をコピーしました。';
  } catch (e) {
    try {
      const range = document.createRange(); range.selectNodeContents($('share'));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
      $('resMsg').textContent = document.execCommand && document.execCommand('copy')
        ? '共有文をコピーしました。' : '共有文を選択しました。手動でコピーしてください。';
    } catch (e2) { $('resMsg').textContent = '共有文を選択してコピーしてください。'; }
  }
}

// ---------- 入力 ----------
for (const b of document.querySelectorAll('.stim')) {
  b.addEventListener('click', () => { if (b.getAttribute('aria-disabled') === 'true') return; doStimulus(b.dataset.k); });
}
$('shootNext').addEventListener('click', (e) => { if (e.currentTarget.getAttribute('aria-disabled') === 'true') return; doShoot('next'); });
$('shootReturn').addEventListener('click', (e) => { if (e.currentTarget.getAttribute('aria-disabled') === 'true') return; doShoot('return'); });
$('confirmNo').addEventListener('click', closeConfirm);
$('confirmYes').addEventListener('keydown', (e) => { if (e.repeat) e.preventDefault(); });
$('confirmYes').addEventListener('click', () => {
  if ($('confirmYes').getAttribute('aria-disabled') === 'true' || !confirmKind) return;
  const k = confirmKind; closeConfirm(); doStimulus(k, true);
});
$('savePng').addEventListener('click', savePng);
$('copyText').addEventListener('click', copyShare);

// ---------- 描画ループ ----------
let last = now();
function frame() {
  const t1 = now(); const dt = Math.min(.1, (t1 - last) / 1000); last = t1;
  const k = reduce ? 1 : 1 - Math.exp(-dt * 6);
  let td = state.dist;
  if (fx && fx.type === 'demo') {
    const p = (t1 - fx.t0) / fx.dur;
    if (p < 1) td = state.dist + anim.demo * .3 * Math.sin(Math.PI * Math.min(1, p));
  }
  anim.dist += (td - anim.dist) * k;
  anim.focus += (state.focus - anim.focus) * k;
  const enc = encounterOf(state);
  const o = { species: enc.species, target: enc.target, depth: enc.depth, dist: anim.dist, focus: anim.focus, t: reduce ? 2 : t1 / 1000 };
  if (fx) {
    const p = (t1 - fx.t0) / fx.dur;
    if (p >= 1) fx = null;
    else if (fx.type === 'light' || (fx.type === 'demo' && anim.demo !== 0)) o.light = fx.type === 'demo' ? .3 + .2 * Math.sin(Math.PI * p) : .12 + .88 * Math.sin(Math.PI * p);
    else if (fx.type === 'sound') o.sound = p;
    else if (fx.type === 'wait') o.still = Math.min(1, Math.sin(Math.PI * p) * 1.6);
  }
  if (OG) o.light = .5;
  drawScene(winC, o);
  drawSonar(sonarC, 200, { species: enc.species, dist: anim.dist, t: reduce ? 1 : t1 / 1000 });
  requestAnimationFrame(frame);
}

// ---------- 開始 ----------
buildRoutes();
if (OG) {
  state = { ...newGame('glow'), index: 4, dist: 1, focus: 0, used: 1, hull: 5 };
  anim.dist = 1;
  addLog('600m 照らす → 近づいた（距離：中）', 'act');
  addLog('2400m 音を鳴らす → 近づいた（距離：近）損傷-2', 'dmg');
  addLog('3000m 試験光（弱）→ 離れた', 'demo');
  addLog('ソナーに窓幅を超える反応', 'demo');
} else {
  introEncounter();
}
render();
requestAnimationFrame(frame);
