import {
  GROUPS, MAX_SLOTS, TOTAL, STORAGE_KEY, RECIPES, recipeById,
  newState, addCard, removeAt, observe, countFound, isComplete, hints, codexEntry, kindCounts,
  serialize, parseSaved, shareText,
} from './logic.js';
import { renderSky, W, H } from './sky.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const OG = params.get('og') === '1';
if (OG) document.body.classList.add('og');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let saveOk = true;
function load() { try { return parseSaved(localStorage.getItem(STORAGE_KEY)); } catch { saveOk = false; return []; } }
function save(s) { try { localStorage.setItem(STORAGE_KEY, serialize(s)); } catch { saveOk = false; } }

let state = newState(load());
let shown = null; // 窓に映っている当たり（null は何も起きていない空）
if (OG) shown = recipeById(params.get('r') || 'cat-big');

// ---- カード ----
const tray = $('tray');
GROUPS.forEach((grp) => {
  const row = document.createElement('div');
  row.className = 'grp';
  row.innerHTML = `<span class="gname">${grp.name}</span>`;
  grp.cards.forEach((c) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'card'; b.textContent = c; b.dataset.card = c;
    b.addEventListener('click', () => { state = { ...state, order: addCard(state.order, c) }; renderOrder(); });
    row.appendChild(b);
  });
  tray.appendChild(row);
});
function renderOrder() {
  const box = $('slots'); box.innerHTML = '';
  for (let i = 0; i < MAX_SLOTS; i++) {
    const c = state.order[i];
    const el = document.createElement(c ? 'button' : 'span');
    el.className = 'oslot' + (c ? ' on' : '');
    if (c) { el.type = 'button'; el.textContent = c; el.setAttribute('aria-label', `${c}（押すと外す）`); el.addEventListener('click', () => { state = { ...state, order: removeAt(state.order, i) }; renderOrder(); }); }
    else el.textContent = i === 0 && !state.order.length ? '言葉を選ぶ' : '＋';
    box.appendChild(el);
  }
  const full = state.order.length >= MAX_SLOTS;
  tray.querySelectorAll('.card').forEach((b) => { b.disabled = full; });
  $('clearBtn').disabled = !state.order.length;
}

// ---- 描画ループ ----
const cv = $('sky');
const g = cv.getContext('2d');
let fadeT = 1, t0 = performance.now(), dirty = true, last = 0;
const snap = document.createElement('canvas'); snap.width = W; snap.height = H;
function frame(now) {
  const tm = reduce ? 0 : (now - t0) / 1000;
  renderSky(g, shown, tm);
  if (fadeT < 1) { g.globalAlpha = 1 - fadeT; g.drawImage(snap, 0, 0); g.globalAlpha = 1; fadeT = Math.min(1, fadeT + (reduce ? 1 : 0.14)); }
}
function loop(now) {
  if (reduce ? fadeT < 1 || dirty : now - last > 66) { last = now; frame(now); dirty = false; }
  requestAnimationFrame(loop);
}

// ---- 表示更新 ----
const kindLabel = { wonder: '不思議な空', more: '重ねがけ', neta: 'まさかの空', secret: '隠し' };
function renderPlate() {
  const L = state.last;
  $('idOut').textContent = `${countFound(state)}/${TOTAL}`;
  $('codexCount').textContent = `${countFound(state)}/${TOTAL}`;
  const ps = $('pState');
  if (!L) {
    $('pName').textContent = '観測待ち';
    $('pLine').textContent = '言葉を組み合わせて、空に観測依頼を出す。';
    ps.textContent = ''; ps.hidden = true;
    $('alert').hidden = true;
  } else if (L.hit) {
    $('pName').textContent = L.recipe.name;
    $('pLine').textContent = L.recipe.line;
    ps.hidden = false; ps.textContent = L.fresh ? `新発見！（${kindLabel[L.recipe.kind]}）` : '記録済み';
    ps.classList.toggle('new', L.fresh);
    $('alert').hidden = !L.fresh; $('alert').textContent = L.recipe.kind === 'neta' ? 'まさかの観測' : '異常現象を検出';
  } else {
    $('pName').textContent = L.near ? '……？' : '変化なし';
    $('pLine').textContent = L.message;
    ps.hidden = false; ps.textContent = L.near ? 'あと少し' : '外れ'; ps.classList.toggle('new', false);
    $('alert').hidden = true;
  }
  $('tape').innerHTML = state.history.length ? '' : '<li>--</li>';
  state.history.forEach((h) => {
    const li = document.createElement('li');
    const words = h.cards.length ? h.cards.join('・') : '（なし）';
    li.textContent = `${words} → ${h.id ? recipeById(h.id).name : '変化なし'}`;
    $('tape').appendChild(li);
  });
}
function note(msg) { $('note').textContent = msg; }

function doObserve() {
  snap.getContext('2d').drawImage(cv, 0, 0);
  fadeT = reduce ? 1 : 0;
  state = observe(state);
  const L = state.last;
  if (L.hit) shown = L.recipe;
  else shown = null;
  dirty = true;
  if (L.fresh) save(state);
  renderPlate();
  note(L.hit ? (L.fresh ? `図鑑に記録した。発見 ${countFound(state)}/${TOTAL}${saveOk ? '' : '（保存できないため、閉じると消えます）'}${isComplete(state) ? '。すべての空を記録した！' : ''}` : 'この空はもう記録してある。')
    : L.near ? '近い。言葉を足すか、入れ替えてみよう。' : 'ほかの組み合わせを試そう。');
}
$('observe').addEventListener('click', doObserve);
$('clearBtn').addEventListener('click', () => { state = { ...state, order: [] }; renderOrder(); });

// ---- 図鑑 ----
function thumb(recipe, w = 80, h = 50) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const k = document.createElement('canvas'); k.width = W; k.height = H;
  renderSky(k.getContext('2d'), recipe, 0.6, false);
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(k, 0, 0, w, h);
  return c;
}
function openCodex() {
  const n = countFound(state);
  $('stats').textContent = `収集率 ${Math.round((n / TOTAL) * 100)}%（${n}/${TOTAL}）`;
  $('rateBar').style.width = `${(n / TOTAL) * 100}%`;
  const kc = kindCounts(state);
  $('kinds').textContent = Object.entries(kindLabel).map(([k, l]) => `${l} ${kc[k] ? kc[k][0] : 0}/${kc[k] ? kc[k][1] : 0}`).join('　');
  const hs = hints(state);
  $('hints').innerHTML = hs.length ? hs.map((h) => `<li>${h}</li>`).join('') : '<li>メモはもう残っていない。</li>';
  const grid = $('grid'); grid.innerHTML = '';
  RECIPES.forEach((_, i) => {
    const e = codexEntry(state, i);
    const d = document.createElement('div');
    d.className = 'cell' + (e.found ? ` found ${e.kind}` : '');
    if (e.found) {
      d.appendChild(thumb(recipeById(e.id)));
      d.insertAdjacentHTML('beforeend', `<span class="cap"><b>${e.name}</b><small>${e.order.length ? e.order.join('・') : '（なし）'}</small></span>`);
      d.title = e.line;
    } else { d.classList.add('k-' + RECIPES[i].kind); d.innerHTML = `<span class="q">${String(e.no).padStart(2, '0')}<small>${kindLabel[RECIPES[i].kind]}</small></span>`; }
    grid.appendChild(d);
  });
  $('report').hidden = !isComplete(state);
  $('codex').showModal();
}
$('codexBtn').addEventListener('click', openCodex);

// ---- 共有 ----
function drawCard() {
  const c = $('card'), x = c.getContext('2d');
  const conceal = state.concealed;
  const L = state.last && state.last.hit ? state.last : null;
  x.imageSmoothingEnabled = false;
  x.fillStyle = '#0B1424'; x.fillRect(0, 0, 600, 315);
  const k = document.createElement('canvas'); k.width = W; k.height = H;
  renderSky(k.getContext('2d'), L ? L.recipe : null, 0.6, true);
  x.drawImage(k, 0, 0, 380, 237);
  if (conceal && L) { x.fillStyle = 'rgba(6,11,20,.92)'; x.fillRect(0, 0, 380, 237); x.fillStyle = '#B98B52'; x.font = '700 28px sans-serif'; x.textAlign = 'center'; x.fillText('？？？', 190, 128); x.textAlign = 'left'; for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(185,139,82,${Math.random() * 0.35})`; x.fillRect(Math.random() * 380, Math.random() * 237, 2, 2); } }
  x.fillStyle = '#B98B52'; x.font = '12px sans-serif'; x.fillText('第七気象観測所　観測依頼', 396, 28);
  const words = L ? (L.cards.length ? L.cards : ['（なし）']) : [];
  x.font = '700 22px sans-serif';
  words.forEach((w, i) => { const s = conceal ? '？' : w; x.fillStyle = '#e8e0cc'; x.fillRect(392 + (i % 2) * 102, 38 + Math.floor(i / 2) * 40, 96, 34); x.fillStyle = '#2a2418'; x.fillText(s, 400 + (i % 2) * 102, 63 + Math.floor(i / 2) * 40, 82); });
  x.fillStyle = '#D7E8E1'; x.font = '700 26px sans-serif';
  x.fillText(L ? (conceal ? '空が変わった' : L.recipe.name) : '観測中', 392, 150, 200);
  x.fillStyle = '#B98B52'; x.font = '16px sans-serif'; x.fillText('発見', 392, 196);
  x.fillStyle = '#E96A55'; x.font = '700 34px sans-serif'; x.fillText(`${countFound(state)}/${TOTAL}`, 440, 200);
  x.fillStyle = '#aebfbd'; x.font = '700 18px sans-serif'; x.fillText('#空が壊れるまで', 16, 266);
  x.font = '18px sans-serif'; x.fillText(L ? (conceal ? '何を頼んだかは、伏せておく。' : L.recipe.line) : '言葉を組み合わせて、空を変えよう。', 16, 296, 568);
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
    const a = document.createElement('a'); a.href = url; a.download = 'broken-sky.png';
    document.body.appendChild(a); a.click(); a.remove();
    $('shareNote').textContent = 'PNGを保存しました。';
  } catch { $('shareNote').textContent = 'PNGを保存できませんでした。'; }
});
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach((dl) => dl.addEventListener('click', (e) => { if (e.target === dl) dl.close(); }));

// 最初の1枚は見本として「雨」を入れておく
if (!OG && !countFound(state)) state = { ...state, order: ['雨'] };
renderOrder(); renderPlate();
if (OG) { $('pName').textContent = shown ? shown.name : ''; $('pLine').textContent = shown ? shown.line : ''; $('pState').hidden = true; }
if (!OG) note(countFound(state) ? '言葉を選んで「観測依頼」。' : 'まずは「観測依頼」を押してみよう。言葉は下から選んで最大4枚。');
requestAnimationFrame(loop);
