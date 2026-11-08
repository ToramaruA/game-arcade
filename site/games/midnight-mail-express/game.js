import {
  STATIONS, KINDS, LINES, RUNS, RUN_COUNT, KIND_COUNT, REGRET_MAX, WINDOW_BEFORE, WINDOW_AFTER, LOCK_BEFORE,
  createRun, withHidden, pairAt, stationAt, aboard, setSwitch, lockSwitch, reserve, arrive, dropPassenger, closeWindow,
  loadSave, writeSave, isUnlocked, hiddenUnlocked, recordRun, shareText, failText,
} from './logic.js';
import * as A from './art.js';
import { createSound } from './audio.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const OG = params.has('og');
if (OG) document.documentElement.classList.add('og'), document.getElementById('game').classList.add('og');
const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const cv = $('cv'), ctx = cv.getContext('2d');
const DPR = Math.min(1.5, window.devicePixelRatio || 1);
cv.width = A.W * DPR; cv.height = A.H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
const sound = createSound();

function store() { try { return window.localStorage; } catch { return null; } }
let save = loadSave(store());
sound.setMuted(!!save.mute);

// ---- 状態 ----
let mode = 'menu';
let run = null, segT = 0, paused = false, pauseKind = '';
let selected = -1, scroll = 0, time = 0, menuLine = 0, resultAt = 0, currentId = 0;
let anims = [], prevStation = null, boardFx = [];
let toastTimer = null, lastSig = '';

const fmtStars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
function showToast(text, bad = false) {
  const el = $('toast'); el.textContent = text; el.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.className = ''; }, 2300);
}
function persist() { save.mute = sound.isMuted(); writeSave(store(), save); }

// ---- メニュー ----
function renderMenu() {
  const tabs = $('lineTabs'); tabs.innerHTML = '';
  LINES.forEach((l, i) => {
    const open = isUnlocked(save, i * 5);
    const n = [0, 1, 2, 3, 4].filter((k) => save.clear[i * 5 + k]).length;
    const b = document.createElement('button'); b.type = 'button'; b.disabled = !open; b.className = i === menuLine ? 'on' : '';
    b.innerHTML = `${l.name}<small>${open ? `${n}/5 運行` : '前の路線を3便クリア'}</small>`;
    b.onclick = () => { menuLine = i; sound.click(); renderMenu(); };
    tabs.appendChild(b);
  });
  const grid = $('runGrid'); grid.innerHTML = '';
  for (let k = 0; k < 5; k++) {
    const id = menuLine * 5 + k, open = isUnlocked(save, id), c = save.clear[id];
    const b = document.createElement('button'); b.type = 'button'; b.className = 'run'; b.disabled = !open;
    b.innerHTML = `<span class="n">${k + 1}</span><span>${LINES[menuLine].runs[k]}</span><span class="st">${open ? fmtStars(c ? c.stars : 0) : '🔒'}</span>${c?.perfect ? '<span class="tag">完全運行</span>' : ''}`;
    b.onclick = () => startRun(id);
    grid.appendChild(b);
  }
  $('albumCount').textContent = `${Object.keys(save.album).length}/${KIND_COUNT}`;
}

// ---- 運行の開始 ----
function startRun(id) {
  sound.click(); sound.startBgm();
  currentId = id;
  let tpl = RUNS[id];
  if (tpl.idx === 4 && hiddenUnlocked(save)) tpl = withHidden(tpl);
  run = createRun(tpl); segT = 0; selected = -1; anims = []; prevStation = null; boardFx = []; resultAt = 0; lastSig = '';
  mode = 'run';
  $('menu').hidden = true; $('controls').hidden = false; $('hud').hidden = false; $('titleCard').hidden = true;
  $('ovResult').hidden = true;
  run.passengers.filter((p) => p.status === 'aboard').forEach((p) => boardFx.push({ id: p.id, t0: time }));
  autoSelect();
  buildBranch(); buildTickets(); updateUI();
  if (!save.seenTutorial && id === 0) { $('ovTutorial').hidden = false; setPaused(true, 'tutorial'); }
  else showToast(`${LINES[tpl.line].name} ${tpl.idx + 1}/5「${tpl.name}」発車`);
}
function toMenu() {
  mode = 'menu'; run = null; setPaused(false); anims = []; prevStation = null;
  $('menu').hidden = false; $('controls').hidden = true; $('hud').hidden = true; $('titleCard').hidden = false;
  for (const o of ['ovResult', 'ovPause', 'ovTutorial', 'ovAlbum']) $(o).hidden = true;
  renderMenu();
}
function setPaused(v, kind = '') {
  paused = v; pauseKind = v ? kind : '';
  $('ovPause').hidden = !(v && kind === 'manual' || v && kind === 'auto');
}

// ---- 操作 ----
function autoSelect() {
  const list = aboard(run);
  if (!list.length) { selected = -1; return; }
  if (selected >= 0 && run.passengers[selected]?.status === 'aboard') return;
  selected = list[0].id;
}
function selectSlot(slot) {
  if (!run || run.finished) return;
  const p = aboard(run).find((q) => q.slot === slot);
  if (!p) return;
  selected = p.id; sound.paper(); buildTickets(); updateUI();
}
function doSwitch(side) {
  if (!run || paused || mode !== 'run') return;
  if (setSwitch(run, side)) { sound.lever(); buildBranch(); updateUI(); }
  else if (run.stop < 3 && run.locked) showToast('もう分岐を過ぎた！', true);
}
function doDrop() {
  if (!run || paused || mode !== 'run' || run.finished || selected < 0) return;
  const p = run.passengers[selected]; if (!p || p.status !== 'aboard') return;
  if (run.phase === 'window') { const ev = dropPassenger(run, selected); if (ev) handleDrop(ev); }
  else if (run.phase === 'run') { if (reserve(run, selected)) { sound.click(); showToast(run.reserved === selected ? `${KINDS[p.kind].name}：次の駅で降ろす予約` : '予約を取り消した'); } }
  autoSelect(); buildTickets(); updateUI();
}
function handleDrop(ev) {
  const p = ev.passenger, r = ev.result, good = r.stars > 0;
  anims.push({ kind: p.kind, slot: p.slot, t0: time, type: r.type, bye: KINDS[p.kind].bye });
  if (good) { r.type === 'first' ? sound.good() : sound.ok(); showToast(`${KINDS[p.kind].name} → ${STATIONS[ev.station].name}　${r.type === 'first' ? '第1希望！ ★★' : '許容駅 ★'}`); }
  else { sound.bad(); showToast(`${KINDS[p.kind].name}を${STATIONS[ev.station].name}で降ろした…${r.type === 'ng' ? '（行ってはいけない駅！）' : ''}`, true); }
  if (run.finished) resultAt = time + 1.6;
}

// ---- UI 構築 ----
function destText(p) { return p.mystery ? `「${STATIONS[p.first].riddle}」` : `行き先 ${STATIONS[p.first].name}`; }
function buildTickets() {
  const box = $('tickets'); box.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const p = aboard(run).find((q) => q.slot === i);
    const b = document.createElement('button'); b.type = 'button';
    if (!p) { b.className = 'ticket empty'; b.innerHTML = `<span>空席</span><span class="no">${i + 1}</span>`; b.disabled = true; box.appendChild(b); continue; }
    b.className = 'ticket' + (p.id === selected ? ' sel' : ''); b.style.setProperty('--c', STATIONS[p.first].hue);
    const chip = run.tpl.line === 0 && p.mystery ? `<span class="chip"></span>` : '';
    b.innerHTML = `<div class="top"><canvas width="76" height="76"></canvas><div><div class="nm">${KINDS[p.kind].name}</div><div class="no">切符 ${i + 1}</div></div></div><div class="dest ${p.mystery ? 'mys' : ''}">${chip}${destText(p)}</div>${run.reserved === p.id ? '<span class="rsv">予約</span>' : ''}`;
    b.onclick = () => selectSlot(i);
    box.appendChild(b);
    const c = b.querySelector('canvas').getContext('2d'); A.drawPassenger(c, p.kind, 38, 70, 0.78, 0);
  }
  const sel = run.passengers[selected];
  const d = $('detail');
  if (sel && sel.status === 'aboard') {
    d.innerHTML = `<span><b>${KINDS[sel.kind].name}</b>：${sel.mystery ? `<b>${destText(sel)}</b>` : `<b>${STATIONS[sel.first].name}</b>`}が第1希望。ほかに <b>${sel.ok.map((s) => STATIONS[s].name).join('・')}</b> でもよい。<span class="ng"> 行ってはいけない駅：${sel.ng.map((s) => STATIONS[s].name).join('・')}</span></span>`;
  } else d.textContent = run.passengers.some((p) => p.status === 'waiting') ? '次の駅で新しい客が乗ってくる。' : '車内は空。最後まで運ぼう。';
  lastSig = sigOf();
}
const sigOf = () => `${selected}|${run.reserved}|${aboard(run).map((p) => p.id).join(',')}`;
function buildBranch() {
  const L = $('brL'), R = $('brR');
  const mk = (btn, sIdx, lab, locked, on) => {
    if (sIdx === undefined) { btn.hidden = true; return; }
    btn.hidden = false; btn.style.setProperty('--c', STATIONS[sIdx].hue);
    btn.innerHTML = `<small>${lab}</small><span class="chip"></span>${STATIONS[sIdx].name}`;
    btn.className = 'branch' + (on ? ' on' : '') + (locked ? ' locked' : '');
    btn.disabled = false;
  };
  if (run.stop >= 3) {
    mk(L, run.tpl.terminal, '終点', true, true); R.hidden = true; $('knob').className = ''; return;
  }
  const [a, b] = pairAt(run, run.stop);
  mk(L, a, '◀ 左', run.locked, run.side[run.stop] === 0); mk(R, b, '右 ▶', run.locked, run.side[run.stop] === 1);
  $('knob').className = run.side[run.stop] ? 's1' : '';
  // 選んだ切符に合う駅を光らせる（切符に書いてある名前のぶんだけ）
  const sel = run.passengers[selected];
  if (sel && sel.status === 'aboard') {
    [[L, a], [R, b]].forEach(([btn, s]) => {
      if (!sel.mystery && s === sel.first) btn.classList.add('hint1');
      else if (sel.ok.includes(s)) btn.classList.add('hint2');
    });
  }
}
function updateUI() {
  if (!run) return;
  const T = run.tpl.T, tpl = run.tpl;
  $('hudLine').textContent = `${LINES[tpl.line].name} ${tpl.idx + 1}/5 ${tpl.name}`;
  $('hudStars').textContent = `★ ${run.stars}　${run.correct}/${tpl.need}人`;
  const ls = $('lanterns').children;
  if (!ls.length) for (let i = 0; i < REGRET_MAX; i++) $('lanterns').appendChild(document.createElement('i'));
  [...$('lanterns').children].forEach((el, i) => el.classList.toggle('on', i < run.regret));
  const c = $('count'), wb = $('winbar').firstElementChild;
  if (run.phase === 'window') {
    c.textContent = `停車 ${Math.max(0, T + WINDOW_AFTER - segT).toFixed(1)}`; c.classList.add('win');
    wb.style.width = `${Math.max(0, ((T + WINDOW_AFTER - segT) / (WINDOW_BEFORE + WINDOW_AFTER)) * 100)}%`;
  } else {
    const rem = Math.max(0, T - segT); c.textContent = `00:${String(Math.ceil(rem)).padStart(2, '0')}`; c.classList.remove('win'); wb.style.width = '0';
  }
  const d = $('btnDrop'), sel = run.passengers[selected], has = sel && sel.status === 'aboard';
  d.disabled = !has || run.finished;
  const win = run.phase === 'window';
  d.textContent = win ? 'この駅で降ろす' : (run.reserved !== null ? '予約中（次の駅）' : '次の駅で降ろす');
  d.classList.toggle('ready', win && has);
  document.title = '終電、あの世ゆき';
}

// ---- 時間の進行 ----
function step(dt) {
  time += dt;
  if (mode === 'run' && run && !run.finished) {
    segT += dt;
    const T = run.tpl.T;
    if (run.phase === 'run') {
      if (!run.locked && run.stop < 3 && segT >= T - LOCK_BEFORE) { lockSwitch(run); sound.lock(); buildBranch(); }
      if (segT >= T - WINDOW_BEFORE) {
        const evs = arrive(run); sound.arrive(); evs.forEach(handleDrop); autoSelect(); buildBranch(); buildTickets();
      }
    } else if (run.phase === 'window' && segT >= T + WINDOW_AFTER) {
      prevStation = { id: stationAt(run, run.stop), t0: time };
      const r = closeWindow(run);
      if (r.finished) resultAt = time + 0.8;
      else {
        segT = 0; r.boarded.forEach((p) => { boardFx.push({ id: p.id, t0: time }); sound.board(); });
        autoSelect(); buildBranch(); buildTickets();
        if (r.boarded.length) showToast(`${r.boarded.map((p) => KINDS[p.kind].name).join('・')}が乗車`);
      }
    }
    if (sigOf() !== lastSig) buildTickets();
    updateUI();
  }
  if (mode === 'run' && run?.finished && resultAt && time >= resultAt) { resultAt = 0; showResult(); }
  scroll += speedNow() * dt;
}
function speedNow() {
  const V0 = reduce ? 90 : 260;
  if (mode !== 'run' || !run) return V0;
  const T = run.tpl.T, ramp = Math.min(1, segT / 1.6);
  if (run.finished) return 0;
  if (segT >= T) return 0;
  const k = Math.max(0, Math.min(1, (T - segT) / 3.5)); return V0 * ramp * (k * k * (3 - 2 * k));
}

// ---- 描画 ----
const ease = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const FINAL = { x: 520, gy: 322, s: 1 };
function stationViews() {
  const out = [];
  if (mode !== 'run' || !run) {
    out.push({ id: 1, x: 790, gy: 196, s: 0.5, badge: '左' }, { id: 3, x: 790, gy: 352, s: 0.5, badge: '右' });
    return out;
  }
  const T = run.tpl.T, tl = T - LOCK_BEFORE;
  if (run.stop >= 3) {
    const p = clamp01(segT / (T * 0.7)), e = 1 - (1 - p) * (1 - p);
    out.push({ id: run.tpl.terminal, x: 1300 + (FINAL.x - 1300) * e, gy: FINAL.gy, s: 1, badge: null });
  } else {
    const cands = pairAt(run, run.stop);
    const enter = clamp01(segT / (0.24 * T)), en = 1 - (1 - enter) * (1 - enter);
    cands.forEach((id, i) => {
      const pre = { x: 800 + (1 - en) * 420, gy: i === 0 ? 196 : 352, s: 0.5 };
      const chosen = run.side[run.stop] === i;
      if (segT < tl) { out.push({ id, ...pre, badge: i === 0 ? '左' : '右' }); return; }
      const q = clamp01((segT - tl) / LOCK_BEFORE);
      if (chosen) { const e = ease(q); out.push({ id, x: pre.x + (FINAL.x - pre.x) * e, gy: pre.gy + (FINAL.gy - pre.gy) * e, s: pre.s + (1 - pre.s) * e, badge: q < 0.5 ? (i === 0 ? '左' : '右') : null }); }
      else { const d = segT - tl; out.push({ id, x: pre.x - d * 260, gy: pre.gy, s: pre.s, alpha: clamp01(1 - d / 1.2) }); }
    });
  }
  if (prevStation) {
    const d = time - prevStation.t0, x = FINAL.x - 280 * d - 90 * d * d;
    if (x > -300) out.push({ id: prevStation.id, x, gy: FINAL.gy, s: 1 });
    else prevStation = null;
  }
  return out;
}
function render() {
  const line = run ? run.tpl.line : 0;
  A.drawBackground(ctx, time, scroll, line, reduce);
  const views = stationViews();
  for (const v of views) A.drawStation(ctx, v.id, v.x, v.gy, v.s, time, { alpha: v.alpha, badge: v.badge });
  const hasFork = mode !== 'run' || (run && run.stop < 3 && run.phase === 'run');
  const side = run ? run.side[Math.min(2, run.stop)] : 0;
  A.drawRails(ctx, scroll, side, run ? run.locked : false, 0, hasFork);
  let pass, selSlot = -1;
  if (mode === 'run' && run) {
    pass = run.passengers;
    const sp = run.passengers[selected];
    if (sp && sp.status === 'aboard') selSlot = sp.slot;
  } else {
    const kinds = [0, 3, 9];
    pass = kinds.map((k, i) => ({ slot: i, kind: k, status: 'aboard' }));
  }
  const slotAlpha = [1, 1, 1];
  for (const f of boardFx) { const p = run?.passengers[f.id]; if (p && p.status === 'aboard') slotAlpha[p.slot] = clamp01((time - f.t0) / 0.7); }
  A.drawTrain(ctx, time, scroll, pass, { speed: speedNow() / 260, reduce, selSlot, slotAlpha });
  A.drawSmoke(ctx, time, speedNow() / 260, reduce);
  if (mode === 'run' && run) {
    // 未練（赤い火の玉が車内に漂う）
    for (let i = 0; i < run.regret; i++) {
      const x = 60 + ((i * 97) % 520) + Math.sin(time * 1.3 + i) * 12, y = A.RAIL_Y - 150 + Math.cos(time * 1.7 + i * 2) * 8;
      A.glow(ctx, x, y, 26, A.COL.red, 0.7); ctx.fillStyle = '#ffb0b6'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.3); ctx.fill();
    }
    drawAnims();
  }
}
function drawAnims() {
  anims = anims.filter((a) => time - a.t0 < 3.4);
  for (const a of anims) {
    const e = time - a.t0, win = A.windowCenter(a.slot), tx = 540 + a.slot * 40 - 40, ty = 330, good = a.type === 'first' || a.type === 'ok';
    if (e < 0.8) {
      const p = ease(e / 0.8), x = win.x + (tx - win.x) * p, y = A.RAIL_Y - 38 + (ty - (A.RAIL_Y - 38)) * p - Math.sin(p * Math.PI) * 60;
      A.drawPassenger(ctx, a.kind, x, y, 1 - 0.15 * p, time);
    } else {
      const p = clamp01((e - 0.8) / 2.4);
      if (good) {
        A.drawFarewell(ctx, a.kind, tx, ty, p, time); if (a.kind !== 5 && a.kind !== 7) A.drawPassenger(ctx, a.kind, tx, ty, 0.85, time, { alpha: p < 0.8 ? 1 : 1 - (p - 0.8) * 5 });
        if (p < 0.6) A.drawBubble(ctx, tx, ty - 100, a.bye);
        if (e > 0.9 && e < 1.9) { const q = (e - 0.9) / 1.0; A.drawStarFly(ctx, tx + (60 - tx) * ease(q), ty - 30 + (28 - ty + 30) * ease(q)); }
      } else {
        const sx = tx + (e - 0.8) * 50; A.drawPassenger(ctx, a.kind, sx, ty, 0.85, time, { alpha: clamp01(1 - p), dim: true });
        if (p < 0.7) A.drawBubble(ctx, sx, ty - 100, 'ここじゃない…', '#ffb3b8');
      }
    }
  }
}

// ---- 結果 ----
function showResult() {
  const o = run.outcome; recordRun(save, run); persist();
  setPaused(false); anims = [];
  const card = $('ovResult').firstElementChild;
  const newAlbum = Object.keys(save.album).length;
  const items = run.log.map((e) => `<figure><canvas width="112" height="112" data-k="${e.passenger.kind}"></canvas><span class="${e.result.stars > 0 ? 'good' : 'bad'}">${e.result.stars > 0 ? '★'.repeat(e.result.stars) : '✕'} ${e.station === null ? '終点まで' : STATIONS[e.station].name}</span></figure>`).join('');
  const nextId = currentId + 1;
  const canNext = o.cleared && nextId < RUN_COUNT && isUnlocked(save, nextId);
  card.innerHTML = `<h2>${o.cleared ? '運行完了' : '運行失敗'}${o.perfect ? ' ✦完全運行' : ''}</h2>
    <div class="big">${LINES[run.tpl.line].name} ${run.tpl.idx + 1}/5「${run.tpl.name}」<br><b>${o.correct}/${o.total}人</b> 届けた（必要${o.need}人）　星 ${o.stars}　未練 ${o.regret}</div>
    ${o.cleared ? `<div class="stars-big">${fmtStars(o.starCount)}</div>` : ''}
    <div class="res-pass">${items || '<p>誰も降ろせなかった。</p>'}</div>
    ${o.cleared ? '' : `<p class="fail">${failText(run)}</p>`}
    <p class="sub">別れのアルバム ${newAlbum}/${KIND_COUNT}${hiddenUnlocked(save) && newAlbum < KIND_COUNT ? '　— どこかの便に、切符を持たない誰かが現れるらしい。' : ''}</p>
    <div class="row"><button class="primary" id="rRetry" type="button">もう一度</button>${canNext ? '<button class="primary" id="rNext" type="button">次の便へ</button>' : ''}<button class="ghost" id="rMenu" type="button">便を選ぶ</button></div>
    <div class="row"><button class="ghost" id="rCopy" type="button">共有文をコピー</button><button class="ghost" id="rPng" type="button">結果カードを保存</button><label class="check"><input type="checkbox" id="rHide" checked>駅名を伏せる</label></div>`;
  card.querySelectorAll('canvas[data-k]').forEach((c, i) => { const g = c.getContext('2d'); const e = run.log[i]; A.drawPassenger(g, +c.dataset.k, 56, 100, 1.25, 0, { dim: e.result.stars === 0 }); });
  $('ovResult').hidden = false;
  $('rRetry').onclick = () => startRun(currentId);
  if ($('rNext')) $('rNext').onclick = () => startRun(nextId);
  $('rMenu').onclick = () => { menuLine = run.tpl.line; toMenu(); };
  $('rCopy').onclick = async () => {
    const text = shareText(run, $('rHide').checked);
    try { await navigator.clipboard.writeText(text); $('rCopy').textContent = 'コピーした'; } catch { window.prompt('共有文', text); }
  };
  $('rPng').onclick = () => saveCard($('rHide').checked);
}
function saveCard(hide) {
  const c = document.createElement('canvas'); c.width = 640; c.height = 336; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 336); gr.addColorStop(0, '#101632'); gr.addColorStop(1, '#563A76'); g.fillStyle = gr; g.fillRect(0, 0, 640, 336);
  g.fillStyle = '#F7C96C'; g.font = 'bold 26px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('終電、あの世ゆき', 320, 44);
  g.fillStyle = '#F4E8CC'; g.font = '16px system-ui, sans-serif'; g.fillText(`${LINES[run.tpl.line].name} ${run.tpl.idx + 1}/5「${run.tpl.name}」`, 320, 72);
  const o = run.outcome; g.font = 'bold 22px system-ui, sans-serif'; g.fillText(`運行${o.cleared ? '完了' : '失敗'}　${o.correct}/${o.total}人　星${o.stars}　未練${o.regret}`, 320, 108);
  const n = run.log.length, gap = Math.min(76, 600 / Math.max(1, n));
  run.log.forEach((e, i) => {
    const x = 320 + (i - (n - 1) / 2) * gap; A.drawPassenger(g, e.passenger.kind, x, 220, 0.9, 0, { dim: e.result.stars === 0 });
    g.font = 'bold 15px system-ui, sans-serif'; g.fillStyle = e.result.stars ? '#F7C96C' : '#ff9aa2'; g.fillText(e.result.stars ? '★'.repeat(e.result.stars) : '✕', x, 244);
    if (!hide) { g.font = '11px system-ui, sans-serif'; g.fillStyle = '#F4E8CC'; g.fillText(e.station === null ? '終点' : STATIONS[e.station].short, x, 262); }
  });
  g.fillStyle = 'rgba(244,232,204,.6)'; g.font = '13px system-ui, sans-serif'; g.fillText('game-arcade-bdt.pages.dev/games/midnight-mail-express/', 320, 314);
  c.toBlob((b) => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'owarinoden-result.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
}

// ---- アルバム ----
function showAlbum() {
  const grid = $('albumGrid'); grid.innerHTML = '';
  const got = Object.keys(save.album).length; $('albumSub').textContent = `${got}/${KIND_COUNT}`;
  KINDS.forEach((k, i) => {
    const a = save.album[i], d = document.createElement('div'); d.className = 'alb' + (a ? '' : ' locked');
    const hint = i === 11 ? '3路線のアルバムを1件ずつ埋めた後の総合便に現れる。' : '正しい駅で降ろすと記録される。';
    d.innerHTML = `<canvas width="192" height="192"></canvas><b>${a ? k.name : '？？？'}</b>${a ? `${STATIONS[a.station]?.name ?? ''}<br>${k.line}` : hint}`;
    grid.appendChild(d);
    const g = d.querySelector('canvas').getContext('2d'); A.drawPassenger(g, i, 96, 168, 2, 0, { dim: !a, alpha: a ? 1 : 0.5 });
    if (a) A.drawFarewell(g, i, 96, 160, 0.4, 0.5);
  });
  $('ovAlbum').hidden = false;
}

// ---- 入力 ----
$('brL').onclick = () => doSwitch(0);
$('brR').onclick = () => doSwitch(1);
$('btnDrop').onclick = doDrop;
$('btnPause').onclick = () => { setPaused(true, 'manual'); };
$('btnResume').onclick = () => setPaused(false);
$('btnQuit').onclick = toMenu;
$('btnStart').onclick = () => { $('ovTutorial').hidden = true; save.seenTutorial = true; persist(); setPaused(false); showToast('発車！ 切符をタップすると許容駅も読める'); };
$('btnAlbum').onclick = () => { sound.click(); showAlbum(); };
$('btnAlbumClose').onclick = () => { $('ovAlbum').hidden = true; };
$('btnSound').onclick = () => { sound.setMuted(!sound.isMuted()); if (!sound.isMuted()) { sound.click(); if (mode === 'run') sound.startBgm(); } $('btnSound').classList.toggle('off', sound.isMuted()); persist(); };
$('btnSound').classList.toggle('off', sound.isMuted());
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'run' && run && !run.finished && !paused) setPaused(true, 'auto'); });
window.addEventListener('keydown', (e) => {
  if (mode !== 'run') return;
  if (e.key === 'p' || e.key === 'P') { setPaused(!paused, 'manual'); return; }
  if (e.key === 'm' || e.key === 'M') { $('btnSound').click(); return; }
  if (paused) return;
  if (e.key >= '1' && e.key <= '3') selectSlot(+e.key - 1);
  else if (e.key === 'ArrowLeft') { e.preventDefault(); doSwitch(0); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); doSwitch(1); }
  else if (e.key === ' ' || e.key === 'Enter') { if (document.activeElement?.tagName === 'BUTTON' && e.key === 'Enter') return; e.preventDefault(); doDrop(); }
});

// ---- ループ ----
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!paused) step(dt);
  render();
  requestAnimationFrame(frame);
}
renderMenu();
if (OG) { $('menu').hidden = true; }
requestAnimationFrame(frame);

// テスト・撮影用の窓口
window.__mme = {
  get run() { return run; }, get save() { return save; }, get segT() { return segT; },
  startRun, toMenu, showAlbum, setSegT(v) { segT = v; }, setSave(s) { save = s; renderMenu(); },
  get paused() { return paused; }, get selected() { return selected; }, select: (id) => { selected = id; buildTickets(); buildBranch(); updateUI(); },
};
