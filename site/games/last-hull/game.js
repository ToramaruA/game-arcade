import {
  COMPS, NAMES, PARENT, SCENARIOS, TOTAL, scenarioById, newGame, connected, preview, apply, remaining, hasEngine, hasPod,
  currentIncident, incidentsLeft, projectedReturn, shareText, emptyProgress, sanitizeProgress, isUnlocked, unlockCondition, recordResult, tutorialStep,
} from './logic.js';
import { shipSvg, CENTER } from './ship.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const OG = params.get('og') === '1';
if (OG) document.documentElement.classList.add('og');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const KEY = 'last-hull:v1';
const SEEN = 'last-hull:brief';

let progress = emptyProgress();
try { progress = sanitizeProgress(JSON.parse(localStorage.getItem(KEY))); } catch { /* 保存できなくても遊べる */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); return true; } catch { return false; } };

let state = newGame(1);
const ui = { sel: currentIncident(state).at, pending: null, lock: false, msg: '', bad: false, note: '', recorded: false, saveFailed: false };
let armTimer = null;

$('stage').innerHTML = shipSvg();
const svg = $('ship');

const evacTargets = (s, c) => {
  const conn = connected(s); const out = [];
  if (PARENT[c] && !s.cut[c] && conn.has(PARENT[c])) out.push(PARENT[c]);
  for (const k of Object.keys(PARENT)) if (PARENT[k] === c && !s.cut[k] && conn.has(k)) out.push(k);
  return out;
};
const cutsOf = (s, c) => {
  const out = [];
  if (PARENT[c] && !s.cut[c]) out.push(c);
  for (const k of Object.keys(PARENT)) if (PARENT[k] === c && !s.cut[k]) out.push(k);
  return out.filter((k) => preview(s, { type: 'cut', child: k }).valid);
};

function initialGuide() { return '🔥 居住環が燃えている。人を逃がすか、切り離せ。'; }
const tut = () => (OG ? null : tutorialStep(state, ui.sel));
const TUT_TEXT = {
  pick: '▶ 船の光っている🔥区画をタップ。',
  act: () => `▶ まず「👥 逃がす」で${NAMES[currentIncident(state).at]}から8人を隣へ。`,
  cut: () => `▶ 猶予あと1手。✂ で${NAMES[currentIncident(state).at]}を切り離せ。残る${state.people[currentIncident(state).at]}人は助からない。`,
};

function pendingPreview() {
  if (!ui.pending) return null;
  return { ...preview(state, ui.pending.op), op: ui.pending.op };
}

function renderShip() {
  const conn = connected(state);
  const inc = currentIncident(state);
  const pv = pendingPreview();
  const result = state.result;
  svg.classList.toggle('ok', !!result && result.outcome === 'return' && result.returned > 0);
  svg.classList.toggle('lostship', !!result && (result.outcome === 'lost' || result.returned === 0));
  for (const c of COMPS) {
    const g = $(`part-${c}`);
    const gone = !conn.has(c);
    g.classList.toggle('gone', gone);
    g.classList.toggle(`gone-${c}`, gone);
    g.classList.toggle('sel', ui.sel === c && !gone);
    g.classList.toggle('burn', !!inc && inc.at === c);
    g.classList.toggle('hint', tut() === 'pick' && !!inc && inc.at === c);
    g.classList.toggle('pv', !!pv && pv.valid && pv.severed.includes(c));
    const podBack = c === 'P' && result && result.means === 'pod' && result.returned > 0;
    $(`lab-${c}`).textContent = gone ? '' : `${NAMES[c]} ${podBack ? result.returned : state.people[c]}`;
  }
  svg.classList.toggle('e-hot', !!inc && inc.at === 'E');
  for (const c of Object.keys(PARENT)) {
    const e = $(`edge-${c}`);
    e.classList.toggle('gone', !!state.cut[c]);
    e.classList.toggle('sevd', !conn.has(c) && !state.cut[c]);
    e.classList.toggle('pick', !!pv && pv.op.type === 'cut' && pv.op.child === c);
    e.classList.toggle('hint', tut() === 'cut' && !!inc && c === inc.at && !pv);
  }
  // 脱出艇で帰還：艇だけ母船から離れる
  const pod = $('part-P');
  if (result && result.outcome === 'return' && result.means === 'pod' && result.returned > 0) pod.style.transform = 'translate(-30px,-8px)';
  else pod.style.transform = '';
  const maxT = inc ? inc.turns : 0;
  for (let i = 0; i < 3; i += 1) {
    const l = $(`lamp${i}`);
    l.classList.toggle('off', i >= maxT);
    l.classList.toggle('on', !!inc && i < state.turns);
  }
  $('timer').classList.toggle('last', !!inc && state.turns <= 1);
  $('timer').classList.toggle('idle', !inc);
  $('timerText').textContent = inc ? `あと${state.turns}手` : (result && result.outcome === 'lost' ? '尽きた' : '鎮火');
}

function renderStatus() {
  const sc = scenarioById(state.scenario);
  const inc = currentIncident(state);
  const items = [
    inc ? `<span class="it bad" title="燃えている区画">🔥 ${NAMES[inc.at]}</span>`
      : `<span class="it">${state.result?.outcome === 'lost' ? '船喪失' : '事故解消'}</span>`,
    `<span class="it" title="船内人数">👥 ${remaining(state)}</span>`,
    `<span class="it ${state.coolant ? '' : 'warn'}" title="冷却剤の残り">❄ ${state.coolant}</span>`,
    `<span class="it ${hasEngine(state) ? '' : 'bad'}" title="機関">機関${hasEngine(state) ? 'あり' : 'なし'}</span>`,
    `<span class="it ${hasPod(state) ? '' : 'bad'}" title="脱出艇（定員）">${hasPod(state) ? `艇 定員${sc.pod}` : '艇なし'}</span>`,
  ];
  if (state.phase === 'play') items.push(`<span class="it" title="現在の船体で帰還できる人数（残りの事故しだいで変わる）">帰還見込み <strong>${projectedReturn(state)}</strong>/${TOTAL}</span>`);
  const chain = sc.incidents.map((x, i) => {
    const cls = state.skipped.includes(i) ? 'skip' : state.resolved.includes(i) ? 'done' : (inc && i === state.incident) ? 'now' : '';
    return `<span class="chip ${cls}" title="事故${i + 1}：${NAMES[x.at]}（猶予${x.turns}手）">${'①②③'[i]}${NAMES[x.at]}</span>`;
  }).join('');
  $('status').innerHTML = `<div class="strip">${items.join('')}</div><div class="chain" aria-label="事故の予定">${chain}</div>`;
  $('scenarioTag').textContent = '';
}

const btn = (cls, label, attrs = '') => `<button type="button" class="${cls}" ${attrs}>${label}</button>`;

function scenarioButtons() {
  return SCENARIOS.map((sc) => {
    const open = isUnlocked(progress, sc.id);
    const best = progress.best[sc.id];
    const sub = open ? (best !== undefined ? ` 最高${best}人` : '') : '';
    return btn(`sc small ${state.scenario === sc.id ? 'sel' : ''}`, `${open ? '' : '🔒'}${String(sc.id).padStart(2, '0')} ${sc.name}${sub}`, `data-sc="${sc.id}" title="${open ? sc.name : unlockCondition(sc.id)}" ${open ? '' : 'disabled aria-disabled="true"'}`);
  }).join('');
}

function renderPanel() {
  const p = $('panel');
  if (state.phase === 'done') { p.innerHTML = resultHtml(); p.classList.remove('tutdim'); return; }
  const inc = currentIncident(state);
  const conn = connected(state);
  const t = tut();
  const c = ui.sel && conn.has(ui.sel) ? ui.sel : null;
  const pv = pendingPreview();
  let h = '';
  if (pv) {
    h += pendingHtml(pv);
  } else {
    const burning = c && inc && inc.at === c;
    h += `<div class="selhead"><span class="sh-name ${burning ? 'bad' : ''}">${burning ? '🔥' : '▸'} ${c ? NAMES[c] : '区画を選ぶ'}</span>${c ? `<span class="sh-n">${state.people[c]}人</span>` : ''}<span class="tpill ${state.turns <= 1 ? 'last' : ''}">⏳ 猶予 あと<b>${state.turns}</b>手</span><span class="sh-tip">👆 船の絵の区画を押して切り替え</span></div>`;
    h += '<div class="acts">';
    if (c) {
      for (const to of evacTargets(state, c)) {
        const pr = preview(state, { type: 'evac', from: c, to });
        h += btn(`act evac ${t === 'act' ? 'hint' : ''}`, `👥 ${NAMES[to]}へ逃がす<small>${pr.valid ? pr.moved : 0}人・猶予を1使う</small>`, `data-evac="${c}:${to}" ${!pr.valid || ui.lock ? 'disabled' : ''}`);
      }
      if (cutsOf(state, c).includes(c)) {
        const sv = preview(state, { type: 'cut', child: c });
        const also = sv.severed.filter((x) => x !== c).map((x) => NAMES[x]);
        h += btn(`act cutbtn ${t === 'cut' ? 'hint' : ''}`, `✂ ${NAMES[c]}を切り離す<small>${also.length ? `${also.join('・')}ごと・` : ''}${sv.severedPeople}人を失う・${sv.resolves ? '火も消える' : '猶予を1使う'}</small>`, `data-cut="${c}" ${ui.lock ? 'disabled' : ''}`);
      }
    }
    h += btn('act cool', `❄ ${NAMES[inc.at]}を冷やす<small>残り${state.coolant}回・猶予を使わない</small>`, `data-cool="1" ${state.coolant <= 0 || ui.lock ? 'disabled' : ''}`);
    h += '</div>';
  }
  h += `<div class="menu noog">${scenarioButtons()}${btn('small', '↺ やり直す', 'data-restart="1"')}</div>`;
  p.innerHTML = h;
  p.classList.toggle('tutdim', !!t && !pv);
}

function pendingHtml(pv) {
  const op = pv.op;
  const armed = ui.pending.armed;
  let h = '';
  if (op.type === 'cut') {
    const names = pv.severed.map((c) => NAMES[c]).join('・');
    h += `<div class="warnbox ${pv.fatal ? 'bad' : ''}">✂ <b>${names}</b>を切り離す：<b>${pv.severedPeople}人</b>を失う（戻らない）。${pv.resolves ? '<br>火も一緒に離れる。' : '<br>火は残る（猶予を1つ使う）。'}`;
  } else {
    h += `<div class="warnbox bad">${NAMES[op.from]}から${NAMES[op.to]}へ${pv.moved}人避難：この事故は解消しません。`;
  }
  if (pv.fatal) h += '<br><b>⚠ 実行すると猶予が0になり、船喪失（帰還0人）です。</b>';
  h += '</div><div class="row">';
  const stage2 = ui.pending.stage === 2;
  if (pv.fatal && stage2) h += btn('danger', armed ? '船喪失を了承して実行' : '確認まで少し待つ…', `data-confirm="1" ${armed ? '' : 'disabled'}`);
  else h += btn('go', armed ? (pv.fatal ? '確定（船喪失の最終確認へ）' : '確定して実行') : '確認まで少し待つ…', `data-confirm="1" ${armed ? '' : 'disabled'}`);
  h += btn('', 'やめる', 'data-cancel="1"') + '</div>';
  return h;
}

function resultHtml() {
  const r = state.result; const sc = scenarioById(state.scenario);
  const lost = r.outcome === 'lost';
  const head = lost ? '船喪失　帰還0人' : r.returned === 0 ? '帰還0人　誰も戻れなかった' : r.means === 'engine' ? `帰還${r.returned < 18 ? '（被害大）' : '成功'}　${r.returned}人が機関で帰還` : `帰還${r.returned < 18 ? '（被害大）' : '成功'}　${r.returned}人が脱出艇で帰還`;
  const means = lost ? '帰還手段なし（猶予0で火元が残った）' : r.means === 'engine' ? '機関が残り、接続された船体ごと帰還' : r.means === 'pod' ? `機関なし。脱出艇（定員${sc.pod}人）で帰還` : '機関も脱出艇も失った';
  let h = `<div class="result ${lost || r.returned === 0 ? 'ng' : 'ok'}"><h2>${head}</h2>
    <div class="note">${sc.name}／${means}</div>
    <div class="stats"><div class="cell"><b>帰還</b><span>${r.returned}／${TOTAL}</span></div><div class="cell"><b>切断で失った</b><span>${r.cutLost}人</span></div><div class="cell"><b>${r.means === 'pod' ? '脱出艇に乗れなかった' : '戻れなかった'}</b><span>${r.stranded}人</span></div></div>`;
  if (ui.note) h += `<div class="warnbox">${ui.note}</div>`;
  h += `<textarea id="shareBox" class="share" readonly aria-label="共有文">${shareText(state)}</textarea>`;
  if (ui.msg && ui.msgIsAction) h += `<div class="note">${ui.msg}</div>`;
  h += `<div class="row">${btn('go', '画像(PNG)を保存', 'data-png="1"')}${btn('go', '共有文をコピー', 'data-copy="1"')}${btn('', '同じ事故で再挑戦', 'data-restart="1"')}</div>`;
  h += `<div class="row">${scenarioButtons()}</div>`;
  if (ui.saveFailed) h += '<div class="note">ブラウザに保存できませんでした。このまま遊べますが、記録は残りません。</div>';
  return `${h}</div>`;
}

function render() {
  renderShip(); renderStatus(); renderPanel();
  const g = $('guide');
  if (state.phase === 'done') {
    g.textContent = state.result.outcome === 'lost' ? '船は失われた。' : '事故はすべて解消した。';
    g.className = `guide ${state.result.outcome === 'lost' ? 'bad' : ''}`;
  } else {
    const t = ui.bad ? null : tut();
    g.textContent = t ? (typeof TUT_TEXT[t] === 'function' ? TUT_TEXT[t]() : TUT_TEXT[t]) : (ui.msg || initialGuide());
    g.className = `guide ${ui.bad ? 'bad' : ''} ${t ? 'tut' : ''}`;
  }
}

function setPending(op) {
  clearTimeout(armTimer);
  ui.pending = { op, armed: false, stage: 1 };
  armTimer = setTimeout(() => { if (ui.pending) { ui.pending.armed = true; render(); } }, 600);
}
function cancelPending() { clearTimeout(armTimer); ui.pending = null; }

function runDots(from, to, n) {
  return new Promise((res) => {
    if (reduce) { res(); return; }
    const g = $('dots'); const [x1, y1] = CENTER[from]; const [x2, y2] = CENTER[to];
    const count = Math.min(8, n);
    g.innerHTML = Array.from({ length: count }, () => '<circle class="dot" r="6"/>').join('');
    const els = [...g.children]; const t0 = performance.now(); const D = 650;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / D);
      els.forEach((el, i) => {
        const kk = Math.max(0, Math.min(1, k * 1.3 - i * 0.04));
        el.setAttribute('cx', x1 + (x2 - x1) * kk + ((i % 3) - 1) * 10);
        el.setAttribute('cy', y1 + (y2 - y1) * kk + (Math.floor(i / 3) - 1) * 10);
      });
      if (k < 1) requestAnimationFrame(step); else { g.innerHTML = ''; res(); }
    };
    requestAnimationFrame(step);
  });
}

async function doOp(op) {
  if (ui.lock || state.phase !== 'play') return;
  const before = state; const pv = preview(before, op);
  if (!pv.valid) { ui.msg = pv.reason; ui.bad = true; render(); return; }
  ui.lock = true; cancelPending(); render();
  if (op.type === 'evac') await runDots(op.from, op.to, pv.moved);
  const r = apply(before, op);
  state = r.state;
  ui.bad = false;
  if (op.type === 'cut') {
    const sp = $(`spark-${op.child}`); sp.classList.add('on'); setTimeout(() => sp.classList.remove('on'), 1000);
    ui.msg = `${pv.severed.map((c) => NAMES[c]).join('・')}を切り離した。${pv.severedPeople}人を失った。`;
  } else if (op.type === 'evac') ui.msg = `${NAMES[op.from]}から${NAMES[op.to]}へ${pv.moved}人避難。`;
  else ui.msg = '冷却剤を使った。火は消えた。';
  const inc = currentIncident(state);
  if (state.phase === 'play') {
    const skipped = state.skipped.filter((i) => !before.skipped.includes(i));
    if (skipped.length) ui.msg += ` ${skipped.map((i) => `「${NAMES[scenarioById(state.scenario).incidents[i].at]}」は対象区画切断済み（消費なしでスキップ）`).join('、')}。`;
    ui.msg += pv.resolves ? ` 次は${NAMES[inc.at]}の事故（猶予${state.turns}手）。` : ` 猶予あと${state.turns}手。`;
  }
  if (ui.sel && !connected(state).has(ui.sel)) ui.sel = null;
  if (inc && (pv.resolves || !ui.sel)) ui.sel = inc.at;
  if (state.phase === 'done') finishGame();
  render();
  await new Promise((res) => setTimeout(res, reduce ? 0 : op.type === 'cut' ? 900 : 150));
  ui.lock = false; render();
}

function finishGame() {
  ui.note = '';
  const rr = recordResult(progress, state);
  progress = rr.progress;
  if (rr.newlyUnlocked) ui.note = '🔓 第2事故配置（シナリオ02 背骨の亀裂）を解放しました';
  else if (rr.improved) ui.note = 'ベスト更新！';
  ui.saveFailed = !save();
  if (state.result.outcome === 'lost') ui.note = '猶予が尽きて火元が残った。船は失われた。';
}

function restart(sc) {
  cancelPending();
  state = newGame(sc || state.scenario);
  Object.assign(ui, { sel: currentIncident(state).at, lock: false, msg: '', bad: false, note: '', msgIsAction: false });
  $('dots').innerHTML = '';
  render();
}

function select(c) {
  if (ui.lock || state.phase !== 'play' || !connected(state).has(c)) return;
  cancelPending(); ui.sel = c; ui.bad = false;
  render();
}
function pickCut(child) {
  if (ui.lock || state.phase !== 'play') return;
  const pv = preview(state, { type: 'cut', child });
  if (!pv.valid) { ui.msg = pv.reason; ui.bad = true; render(); return; }
  setPending({ type: 'cut', child }); render();
}

function confirm() {
  const pend = ui.pending; if (!pend || !pend.armed || ui.lock) return;
  const pv = preview(state, pend.op);
  if (pv.valid && pv.fatal && pend.stage === 1) { pend.stage = 2; pend.armed = false; clearTimeout(armTimer); armTimer = setTimeout(() => { if (ui.pending) { ui.pending.armed = true; render(); } }, 900); render(); return; }
  doOp(pend.op);
}

// ---- 結果の書き出し ----
async function savePng() {
  try {
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    await new Promise((ok, ng) => { img.onload = ok; img.onerror = ng; img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`; });
    const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 860;
    const x = cv.getContext('2d');
    x.fillStyle = '#080E1B'; x.fillRect(0, 0, 1200, 860);
    x.drawImage(img, 0, 0, 1200, 700);
    x.fillStyle = '#C6F0F2'; x.font = 'bold 30px sans-serif'; x.fillText('切り離せ、最後の一隻', 30, 745);
    x.fillStyle = '#E3E8EC'; x.font = '24px sans-serif';
    const r = state.result;
    x.fillText(r.outcome === 'lost' ? '船喪失　帰還0人' : `帰還 ${r.returned}／${TOTAL}　切断で失った ${r.cutLost}人　戻れなかった ${r.stranded}人`, 30, 790);
    x.fillStyle = '#93A3B0'; x.font = '20px sans-serif'; x.fillText(shareText(state), 30, 830);
    const blob = await new Promise((ok) => cv.toBlob(ok, 'image/png'));
    if (!blob) throw new Error('png');
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'last-hull.png';
    document.body.appendChild(a); a.click(); a.remove();
    ui.msg = '画像を保存しました。'; ui.msgIsAction = true;
  } catch {
    ui.msg = '画像を保存できませんでした。結果の画面をスクリーンショットしてください。'; ui.msgIsAction = true;
  }
  render();
}
async function copyText() {
  const text = shareText(state);
  try { await navigator.clipboard.writeText(text); ui.msg = '共有文をコピーしました。'; }
  catch {
    try { const b = $('shareBox'); b.select(); document.execCommand('copy'); ui.msg = 'コピーしました（できていなければ上の文章を選んで手動でコピーしてください）。'; }
    catch { ui.msg = 'コピーできませんでした。上の文章を選んで手動でコピーしてください。'; }
  }
  ui.msgIsAction = true; render();
  const b = $('shareBox'); if (b) { try { b.select(); } catch { /* noop */ } }
}

// ---- 入力 ----
$('panel').addEventListener('click', (e) => {
  const t = e.target.closest('button'); if (!t || t.disabled) return;
  const d = t.dataset;
  if (d.comp) select(d.comp);
  else if (d.evac) {
    const [from, to] = d.evac.split(':'); const op = { type: 'evac', from, to };
    const pv = preview(state, op);
    if (pv.fatal) { setPending(op); render(); } else doOp(op);
  } else if (d.cut) pickCut(d.cut);
  else if (d.cool) doOp({ type: 'cool' });
  else if (d.confirm) confirm();
  else if (d.cancel) { cancelPending(); render(); }
  else if (d.sc) { if (isUnlocked(progress, Number(d.sc))) restart(Number(d.sc)); }
  else if (d.restart) restart();
  else if (d.png) savePng();
  else if (d.copy) copyText();
});
svg.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const pt = e.target.closest('[data-comp]'); const ed = e.target.closest('[data-edge]');
  if (!pt && !ed) return;
  e.preventDefault();
  if (ed) pickCut(ed.dataset.edge); else select(pt.dataset.comp);
});
svg.addEventListener('click', (e) => {
  const ed = e.target.closest('[data-edge]');
  if (ed) { pickCut(ed.dataset.edge); return; }
  const pt = e.target.closest('[data-comp]');
  if (pt) select(pt.dataset.comp);
});

// ?og=1：共有画像用に「居住環と温室を切り離して機関が燃える」最高潮の状態から始める
if (OG) {
  const seq = [{ type: 'evac', from: 'L', to: 'H' }, { type: 'cut', child: 'L' }, { type: 'evac', from: 'G', to: 'H' }, { type: 'cut', child: 'G' }];
  for (const op of seq) state = apply(state, op).state;
  ui.msg = '居住環と温室を切り離した。最後の機関が赤熱している。冷却剤は残り1回。';
  const css = document.createElement('style');
  css.textContent = '.drift{transition:none!important}';
  document.head.appendChild(css);
  ui.sel = 'H';
}
render();

// ---- 遊び方（初回は自動で開く）----
const brief = $('brief');
function openBrief() { brief.hidden = false; $('briefGo').focus(); }
function closeBrief() {
  brief.hidden = true;
  try { localStorage.setItem(SEEN, '1'); } catch { /* 保存できなくても遊べる */ }
}
$('helpBtn').addEventListener('click', openBrief);
$('briefGo').addEventListener('click', closeBrief);
brief.addEventListener('click', (e) => { if (e.target === brief) closeBrief(); });
document.addEventListener('keydown', (e) => { if (!brief.hidden && (e.key === 'Escape' || e.key === 'Enter')) { e.preventDefault(); closeBrief(); } });
let seen = false;
try { seen = localStorage.getItem(SEEN) === '1'; } catch { /* noop */ }
if (!OG && !seen) openBrief();
