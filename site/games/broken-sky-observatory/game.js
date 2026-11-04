import {
  TIMES, WINDS, PRESSURES, TOTAL, STORAGE_KEY, ANOMALIES,
  newState, select, observe, record, canRecord, describe, idLabel, conditionText,
  countFound, countAnomalies, isFound, isComplete, hints, codexEntry, anomalySlots,
  serialize, parseSaved, shareText, idOf,
} from './logic.js';
import { renderSky, W, H } from './sky.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const OG = params.get('og') === '1';
if (OG) document.body.classList.add('og');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let saveOk = true;
function load() {
  try { return parseSaved(localStorage.getItem(STORAGE_KEY)); } catch { saveOk = false; return []; }
}
function save(s) {
  try { localStorage.setItem(STORAGE_KEY, serialize(s)); } catch { saveOk = false; }
}

let state = newState(load());
if (OG) { // 共有画像：最も目を引く特異現象を見せる
  const a = ANOMALIES.find((x) => x.key === (params.get('a') || 'eye'));
  state = { ...state, observed: a.id, sel: { t: a.t, w: a.w, p: a.p } };
}

// ---- ダイヤル ----
const AXES = [['t', '時刻', TIMES], ['w', '風向', WINDS], ['p', '気圧', PRESSURES]];
const dials = $('dials');
AXES.forEach(([ax, label, opts]) => {
  const fs = document.createElement('fieldset');
  fs.className = 'dial';
  fs.innerHTML = `<legend>${label}</legend><div class="gauge" id="g-${ax}"><i></i></div><div class="opts"></div>`;
  const box = fs.querySelector('.opts');
  opts.forEach((name, i) => {
    const l = document.createElement('label');
    l.className = 'opt';
    l.innerHTML = `<input type="radio" name="${ax}" value="${i}"><span>${name}</span>`;
    l.querySelector('input').addEventListener('change', () => { state = select(state, ax, i); syncDials(); });
    box.appendChild(l);
  });
  dials.appendChild(fs);
});
function syncDials() {
  AXES.forEach(([ax]) => {
    const v = state.sel[ax];
    dials.querySelectorAll(`input[name="${ax}"]`).forEach((r) => { r.checked = Number(r.value) === v; });
    $('g-' + ax).style.setProperty('--rot', `${-60 + v * 40}deg`);
  });
}

// ---- 描画ループ ----
const cv = $('sky');
const g = cv.getContext('2d');
let shown = state.observed, prev = null, fadeT = 1, t0 = performance.now(), shake = 0;
const snap = document.createElement('canvas'); snap.width = W; snap.height = H;
function frame(now) {
  const tm = reduce ? 0 : (now - t0) / 1000;
  renderSky(g, shown, tm);
  if (fadeT < 1 && prev) {
    g.globalAlpha = 1 - fadeT; g.drawImage(snap, 0, 0); g.globalAlpha = 1;
    fadeT = Math.min(1, fadeT + (reduce ? 1 : 0.035));
  }
}
let last = 0;
function loop(now) {
  if (reduce ? fadeT < 1 || dirty : now - last > 66) { last = now; frame(now); dirty = false; }
  requestAnimationFrame(loop);
}
let dirty = true;

// ---- 表示更新 ----
function renderPlate() {
  const d = describe(state.observed);
  $('idOut').textContent = idLabel(state.observed);
  $('pName').textContent = d.name;
  $('pLine').textContent = d.line;
  const found = isFound(state, state.observed);
  const ps = $('pState');
  ps.textContent = found ? '記録済み' : '未記録';
  ps.classList.toggle('new', !found);
  $('alert').hidden = !d.anomaly;
  $('lamp').classList.toggle('alarm', d.anomaly);
  $('lampTxt').textContent = d.anomaly ? '警告' : '正常';
  const rb = $('recordBtn');
  rb.disabled = !canRecord(state);
  rb.classList.toggle('rec-ready', canRecord(state));
  rb.textContent = canRecord(state) ? '記録する' : '記録済み';
  $('codexCount').textContent = `${countFound(state)}/${TOTAL}`;
  $('tape').innerHTML = '';
  state.history.forEach((id) => {
    const li = document.createElement('li');
    li.textContent = `${idLabel(id)} ${isFound(state, id) ? describe(id).name : '未記録'}`;
    $('tape').appendChild(li);
  });
  if (!state.history.length) $('tape').innerHTML = '<li>--</li>';
}
function note(msg) { $('note').textContent = msg; }

function doObserve() {
  const snapCtx = snap.getContext('2d'); snapCtx.drawImage(cv, 0, 0);
  prev = true; fadeT = reduce ? 1 : 0;
  state = observe(state);
  shown = state.observed; dirty = true;
  renderPlate();
  const d = describe(state.observed);
  note(d.anomaly ? '異常現象を検出。「記録する」で図鑑に残せます。' : isFound(state, state.observed) ? 'すでに記録した空です。' : '新しい空です。「記録する」で図鑑に残せます。');
}
$('observe').addEventListener('click', doObserve);
$('recordBtn').addEventListener('click', () => {
  if (!canRecord(state)) return;
  state = record(state); save(state);
  renderPlate();
  note(isComplete(state) ? '全64件を記録した。最後の観測報告書が図鑑に届いています。' : `記録した。発見 ${countFound(state)}/${TOTAL}${saveOk ? '' : '（保存できないため、この画面を閉じると消えます）'}`);
});

// ---- 図鑑 ----
const thumbCache = new Map();
function thumb(id, w = 64, h = 40) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const k = document.createElement('canvas'); k.width = W; k.height = H;
  renderSky(k.getContext('2d'), id, 0, false);
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(k, 0, 0, w, h);
  return c;
}
function openCodex() {
  const n = countFound(state);
  $('stats').textContent = `収集率 ${Math.round((n / TOTAL) * 100)}%（${n}/${TOTAL}）`;
  $('rateBar').style.width = `${(n / TOTAL) * 100}%`;
  $('anomCount').textContent = `${countAnomalies(state)}/12`;
  const an = $('anoms'); an.innerHTML = '';
  anomalySlots(state).forEach((s) => {
    const d = document.createElement('div');
    d.className = 'slot' + (s.found ? ' found' : '');
    if (s.found) { d.appendChild(thumb(s.id, 160, 100)); d.insertAdjacentHTML('beforeend', `<span class="cap">${describe(s.id).name}</span>`); }
    else d.innerHTML = '<span class="q">？</span>';
    an.appendChild(d);
  });
  const hs = hints(state);
  $('hints').innerHTML = hs.length ? hs.map((h) => `<li>${h}</li>`).join('') : '<li>未発見の特異現象はありません。</li>';
  const grid = $('grid'); grid.innerHTML = '';
  for (let id = 1; id <= TOTAL; id++) {
    const e = codexEntry(state, id);
    const d = document.createElement('div');
    d.className = 'cell' + (e.found ? ' found' : '') + (e.found && e.anomaly ? ' an' : '');
    if (e.found) { d.title = `${e.name}（${e.cond}）`; d.appendChild(thumb(id)); d.insertAdjacentHTML('beforeend', `<em>${idLabel(id)}</em>`); }
    else d.textContent = idLabel(id);
    grid.appendChild(d);
  }
  $('report').hidden = !isComplete(state);
  $('codex').showModal();
}
$('codexBtn').addEventListener('click', openCodex);

// ---- 共有 ----
function drawCard() {
  const c = $('card'), x = c.getContext('2d');
  const conceal = state.concealed;
  const d = describe(state.observed);
  x.imageSmoothingEnabled = false;
  x.fillStyle = '#0B1424'; x.fillRect(0, 0, 600, 315);
  const k = document.createElement('canvas'); k.width = W; k.height = H;
  renderSky(k.getContext('2d'), conceal ? idOf(3, 3, 1) : state.observed, 0, true);
  x.drawImage(k, 0, 0, 380, 237);
  if (conceal) { x.fillStyle = 'rgba(6,11,20,.9)'; x.fillRect(0, 0, 380, 237); x.fillStyle = '#B98B52'; x.font = '700 28px sans-serif'; x.textAlign = 'center'; x.fillText('？？？', 190, 128); x.textAlign = 'left'; }
  x.fillStyle = '#B98B52'; x.font = '12px sans-serif'; x.fillText('第七気象観測所', 396, 28);
  x.fillStyle = '#D7E8E1'; x.font = '700 22px sans-serif';
  x.fillText(conceal ? (d.anomaly ? '特異現象を発見' : '空を観測') : d.name, 396, 66, 196);
  x.font = '15px sans-serif'; x.fillStyle = '#c4d6d3';
  x.fillText(conceal ? '条件：？／？／？' : `記録 ${idLabel(state.observed)}`, 396, 96);
  if (!conceal) { x.fillText(TIMES[d.t], 396, 120); x.fillText('風向：' + WINDS[d.w], 396, 140); x.fillText('気圧：' + PRESSURES[d.p], 396, 160); }
  x.fillStyle = '#E96A55'; x.font = '700 30px sans-serif'; x.fillText(`${countFound(state)}/${TOTAL}`, 396, 214);
  x.fillStyle = '#B98B52'; x.font = '12px sans-serif'; x.fillText('発見', 396, 236);
  x.fillStyle = '#aebfbd'; x.font = '16px sans-serif'; x.fillText('#空が壊れるまで', 16, 270);
  x.fillText(conceal ? '特異現象は伏せています' : d.line, 16, 296, 560);
  $('shareText').value = shareText(state);
}
$('shareBtn').addEventListener('click', () => { $('conceal').checked = state.concealed; $('shareNote').textContent = ''; drawCard(); $('share').showModal(); });
$('conceal').addEventListener('change', (e) => { state = { ...state, concealed: e.target.checked }; drawCard(); });
$('copyBtn').addEventListener('click', async () => {
  const ta = $('shareText');
  try { await navigator.clipboard.writeText(ta.value); $('shareNote').textContent = 'コピーしました。'; }
  catch { ta.focus(); ta.select(); $('shareNote').textContent = 'コピーできませんでした。選択した文章を手動でコピーしてください。'; }
});
$('pngBtn').addEventListener('click', () => {
  try {
    const url = $('card').toDataURL('image/png');
    const a = document.createElement('a'); a.href = url; a.download = `sky-${idLabel(state.observed)}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    $('shareNote').textContent = 'PNGを保存しました。';
  } catch { $('shareNote').textContent = 'PNGを保存できませんでした。'; }
});
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach((dl) => dl.addEventListener('click', (e) => { if (e.target === dl) dl.close(); }));

syncDials(); renderPlate();
if (!OG) note('ダイヤルを選んで「観測する」。同じ組合せは、いつも同じ空になります。');
requestAnimationFrame(loop);
