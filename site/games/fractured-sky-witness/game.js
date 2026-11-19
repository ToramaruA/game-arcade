// 描画と操作。ルールは logic.js、文章は story.js、絵は scene.js。
import * as L from './logic.js';
import { EVIDENCE, PEOPLE, PROOFS, SECRETS } from './story.js';
import { buildBackground, buildVista, buildOverlay, evIcon } from './scene.js';
import { sfx, startBgm, setMuted } from './audio.js';

const SAVE_KEY = 'fractured-sky-witness:proto1';
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const OG = new URLSearchParams(location.search).has('og');

let S = L.newGame();
let settings = { mute: false, reduce: false, hint: true };
let shown = 0;           // 会話で表示済みの行数
let shownKey = '';       // どの場面の行か
let revealTimer = null;
let pendingSite = null;  // 確認中の調査先
let sel = { t: null, slots: [null, null] };
let pick = null;         // 選んだ P/Q/H
let busy = false;        // 演出中の二重入力を防ぐ
let bgKey = '';
let newEv = null;
let toastTimer = null;
let canSave = true;

// ---------- 保存 ----------
function save() {
  if (OG || !canSave) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ S, settings })); } catch { canSave = false; toast('この端末では保存できません。このまま遊べます。'); }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d?.S?.v === 1) S = d.S;
    if (d?.settings) settings = { ...settings, ...d.settings };
  } catch { /* 保存なしで続ける */ }
}

// ---------- 小物 ----------
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}
const ICON = {
  flag: '<svg viewBox="0 0 24 24"><line x1="5" y1="3" x2="5" y2="22" stroke="#17505e" stroke-width="2"/><polygon points="5,3 21,7 5,12" fill="#ffe14d" stroke="#e9b800"/></svg>',
  key: '<svg viewBox="0 0 24 24"><circle cx="8" cy="9" r="5" fill="none" stroke="#0b8fab" stroke-width="2.4"/><line x1="12" y1="12" x2="21" y2="21" stroke="#0b8fab" stroke-width="2.4"/><line x1="17" y1="17" x2="14" y2="20" stroke="#0b8fab" stroke-width="2.4"/></svg>',
  stamp: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="#0b8fab" stroke-width="2"/><text x="12" y="15.5" text-anchor="middle" font-size="8" font-weight="700" fill="#0b8fab">保</text></svg>',
  thread: '<svg viewBox="0 0 24 24"><path d="M2 14 Q6 6 10 12" fill="none" stroke="#e5484d" stroke-width="2"/><path d="M14 12 Q18 18 22 10" fill="none" stroke="#e5484d" stroke-width="2"/></svg>',
  promise: '<svg viewBox="0 0 24 24"><path d="M2 12 Q7 4 12 12 T22 12" fill="none" stroke="#0b8fab" stroke-width="2"/></svg>',
  proof: '<svg viewBox="0 0 24 24"><polygon points="12,2 20,8 17,21 7,21 4,8" fill="#c7f4fb" stroke="#0b8fab" stroke-width="1.6"/></svg>',
};

// ---------- 描画 ----------
function padX() {
  const el = $('scene'); const w = el.clientWidth || 800; const h = el.clientHeight || 460;
  return Math.max(4, (800 - 460 * (w / h)) / 2 + 6);
}
function stageK() {
  const w = $('scene').clientWidth || 800;
  return Math.max(1, Math.min(1.7, 720 / w));
}

function drawScene() {
  const key = S.phase === 'end' ? `vista${S.support.length}${S.coop.length}${S.broken}` : `ch${Math.min(S.ch, 3)}`;
  if (key !== bgKey) {
    $('bgLayer').innerHTML = S.phase === 'end' ? buildVista({ support: S.support.length, coop: S.coop.length, broken: S.broken }) : buildBackground(S.ch);
    bgKey = key;
  }
  if (S.phase === 'end') { $('ovLayer').innerHTML = ''; return; }
  const g = settings.hint ? L.guide(S) : null;
  const canAct = S.phase === 'investigate' || S.phase === 'intro';
  const sites = S.phase === 'bridge' ? [] : L.siteList(S).map((x) => ({
    ...x,
    locked: !x.visited && (!canAct || x.locked),
    hint: canAct && g?.site === x.id,
    big: S.ch === 1 && x.id === 'plaza' && !x.visited,
  }));
  $('ovLayer').innerHTML = buildOverlay({
    ch: S.ch, k: stageK(), padX: padX(), sites,
    falling: S.ch === 1, support: S.support.length, coop: S.coop.length,
    stamp: S.phase === 'after' && S.choices[S.ch] === 'H',
    yuiX: 128,
  });
  for (const el of $('ovLayer').querySelectorAll('[data-site]')) {
    const id = el.dataset.site;
    const site = sites.find((x) => x.id === id);
    if (!site.visited && !site.locked) el.setAttribute('role', 'button'); else el.removeAttribute('role');
    el.addEventListener('click', () => onSite(id));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSite(id); } });
  }
}

function drawHud() {
  const c = L.ch(S);
  $('chDay').textContent = S.phase === 'end' ? '四日目へ' : c.day;
  $('chTitle').textContent = S.phase === 'end' ? '試作の終わり' : `第${c.no}章　${c.title}`;
  const act = $('actCnt'); const tr = $('tryCnt');
  const inCh = !['bridge', 'end'].includes(S.phase);
  act.hidden = !inCh;
  $('actDots').innerHTML = Array.from({ length: L.CONFIG.actions }, (_, i) => `<i class="dot ${i < S.actionsLeft ? '' : 'used'}"></i>`).join('') + `<b> ${S.actionsLeft}</b>`;
  tr.hidden = S.phase !== 'trial';
  $('tryDots').innerHTML = Array.from({ length: L.CONFIG.attempts }, (_, i) => `<i class="dot try ${i < S.attemptsLeft ? '' : 'used'}"></i>`).join('') + `<b> ${S.attemptsLeft}</b>`;

  const chips = [];
  const proofs = Object.values(S.proofs);
  if (proofs.length) chips.push(`<span class="chip">${ICON.proof}証明 ${proofs.join('・')}</span>`);
  if (S.support.length) chips.push(`<span class="chip">${ICON.flag}支持旗 ${S.support.length}</span>`);
  if (S.coop.length) chips.push(`<span class="chip">${ICON.key}協力鍵 ${S.coop.length}（${S.coop.map((k) => L.personName(k.from)).join('・')}）</span>`);
  const live = S.promises.filter((p) => !p.broken);
  if (live.length) chips.push(`<span class="chip">${ICON.promise}約束 ${live.map((p) => L.personName(p.to)).join('・')}</span>`);
  if (S.broken) chips.push(`<span class="chip broken">${ICON.thread}約束破り</span>`);
  if (S.holds.length) chips.push(`<span class="chip">${ICON.stamp}保留印 ${S.holds.length}</span>`);
  const st = $('status');
  const html = chips.join('');
  if (st.dataset.html !== html) { st.innerHTML = html; st.dataset.html = html; for (const c2 of st.children) c2.classList.add('pop'); }
  st.hidden = !chips.length;
}

function drawShelf() {
  const cards = $('cards');
  const cur = L.chapterEvidence(S);
  const inTrial = S.phase === 'trial';
  const g = settings.hint ? L.guide(S) : null;
  if (!S.evidence.length) { cards.innerHTML = '<p class="empty">まだ何もない。空のかけらに触れてみよう。</p>'; $('shelfHint').textContent = '調べた場所の証拠がここに並ぶ'; return; }
  $('shelfHint').textContent = inTrial ? 'タップで証拠の枠へ入れる／外す' : 'タップで全文を読む';
  const list = [...S.evidence].reverse();
  cards.innerHTML = list.map((id) => {
    const e = EVIDENCE[id];
    const old = !cur.includes(id);
    const cls = ['card', old ? 'old' : '', sel.slots.includes(id) ? 'inslot' : '', id === newEv ? 'new' : '', inTrial && g?.evs?.includes(id) && !sel.slots.includes(id) ? 'hinted' : ''].join(' ');
    return `<div class="${cls}"><button type="button" class="cardMain" data-ev="${id}" ${inTrial && old ? 'disabled' : ''} aria-label="${esc(e.name)}${inTrial ? 'を枠に入れる' : 'を読む'}">${evIcon(id)}<b>${esc(e.name)}</b><small>${esc(e.short)}</small></button>${inTrial ? `<button type="button" class="cardInfo" data-info="${id}" aria-label="${esc(e.name)}の全文">全文</button>` : ''}</div>`;
  }).join('');
  newEv = null;
}

const TALK = ['intro', 'site', 'proven', 'unproven', 'after', 'bridge'];

function nextLabel() {
  switch (S.phase) {
    case 'intro': return S.ch === 1 ? null : '調査をはじめる ▸';
    case 'site': return S.actionsLeft > 0 ? `次の場所へ（調査 残り${S.actionsLeft}）▸` : '審理へ ▸';
    case 'proven': return 'この真実を、どうする？ ▸';
    case 'unproven': return '先へ進む ▸';
    case 'after': return S.ch === 3 ? '四日目の見通しへ ▸' : '次の章へ ▸';
    case 'bridge': return '第3章へ ▸';
    default: return '次へ ▸';
  }
}

function lineHtml(l) {
  if (!l.who) return `<li class="narr">${esc(l.text)}</li>`;
  const p = PEOPLE[l.who];
  return `<li class="say"><span class="who ${l.who}">${esc(p.name)}${p.role && l.who !== 'city' ? `・${esc(p.role)}` : ''}</span>${esc(l.text)}</li>`;
}

function drawTalk() {
  const lines = L.sceneLines(S);
  const key = L.sceneKey(S);
  const box = $('lines');
  if (key !== shownKey) { shownKey = key; shown = settings.reduce ? lines.length : 1; box.innerHTML = ''; scheduleReveal(lines.length); }
  box.querySelector('.tip')?.remove();
  const have = box.children.length;
  if (have > shown) box.innerHTML = '';
  box.insertAdjacentHTML('beforeend', lines.slice(box.children.length, shown).map(lineHtml).join(''));
  const done = shown >= lines.length;
  const lbl = nextLabel();
  const nb = $('nextBtn');
  nb.hidden = done && !lbl;
  nb.textContent = done ? (lbl || '') : '続きを読む ▸';
  if (S.phase === 'intro' && S.ch === 1 && done) {
    box.insertAdjacentHTML('beforeend', '<li class="narr tip"><b>▲ 上の絵の、光る空のかけらをタップ</b></li>');
  }
}

function scheduleReveal(total) {
  clearTimeout(revealTimer);
  if (shown >= total) return;
  revealTimer = setTimeout(() => { shown += 1; drawTalk(); scheduleReveal(total); }, 650);
}

function testiHtml(t, { button, selected, hinted }) {
  const p = PEOPLE[t.who];
  const claim = esc(t.claim).replace(esc(t.mark), `<u>${esc(t.mark)}</u>`);
  const inner = `<span class="who">${esc(p.name)}（${esc(p.role)}）の証言</span>「${claim}」<span class="hint">${esc(t.hint)}</span>`;
  if (!button) return `<div class="testi">${inner}</div>`;
  return `<button type="button" class="testi ${selected ? 'sel' : ''} ${hinted ? 'hinted' : ''}" data-t="${t.id}" aria-pressed="${selected}">${inner}</button>`;
}

function drawInv() {
  $('invAsk').innerHTML = S.ch === 1 && !S.visited.length
    ? '空を調べ、誰に知らせるか決めよう。<b>光る空のかけら</b>から。'
    : `どこを調べる？　<b>調査 残り${S.actionsLeft}</b>（4か所のうち3か所だけ）`;
  $('invTestis').innerHTML = L.testimonies(S).map((t) => testiHtml(t, { button: false })).join('');
  const g = settings.hint ? L.guide(S) : null;
  $('sites').innerHTML = L.siteList(S).map((x) => `<button type="button" class="site ${g?.site === x.id ? 'hinted' : ''}" data-site-btn="${x.id}" ${x.visited || x.locked ? 'disabled' : ''}>${x.visited ? '✓ ' : ''}${esc(x.name)}<small>${x.visited ? `${esc(EVIDENCE[x.ev].name)}を得た` : x.locked ? 'まずは光るかけらから' : '調べる'}</small></button>`).join('');
  const cf = $('visitConfirm');
  if (pendingSite) {
    const site = L.siteList(S).find((x) => x.id === pendingSite);
    $('visitText').innerHTML = `<b>${esc(site.name)}</b>を調べる？<br>調査 残り ${S.actionsLeft} → ${S.actionsLeft - 1}。調べた場所には戻れない。`;
    cf.hidden = false;
  } else cf.hidden = true;
}

function drawTrial() {
  const g = settings.hint ? L.guide(S) : null;
  $('testis').innerHTML = L.testimonies(S).map((t) => testiHtml(t, { button: true, selected: sel.t === t.id, hinted: g?.testimony === t.id && sel.t !== t.id })).join('');
  const slots = document.querySelectorAll('.slot');
  slots.forEach((b, i) => {
    const id = sel.slots[i];
    b.classList.toggle('full', !!id);
    b.innerHTML = id ? `${evIcon(id)}<span>${esc(EVIDENCE[id].name)}</span>` : `証拠 ${i + 1}<br><small>棚からタップ</small>`;
    b.setAttribute('aria-label', id ? `${EVIDENCE[id].name}（タップで外す）` : `証拠の枠${i + 1}`);
  });
  $('presentBtn').disabled = !(sel.t && sel.slots[0] && sel.slots[1]);
  $('presentBtn').textContent = `提示する（残り${S.attemptsLeft}回）`;
  const fb = $('feedback');
  fb.hidden = !S.feedback; fb.textContent = S.feedback || '';
}

const OPT_ICON = { P: ICON.flag, Q: ICON.key, H: ICON.stamp };
function drawChoice() {
  const opts = L.choiceOptions(S);
  const owner = L.secretOwner(S);
  $('choiceAsk').innerHTML = S.pairId
    ? `<b>${esc(L.personName(owner))}の秘密</b>を知った。この真実を、誰に伝える？`
    : '証明できなかった。記録を保留して先へ進もう。';
  $('opts').innerHTML = opts.map((o) => `<button type="button" class="opt ${pick === o.id ? 'sel' : ''}" data-opt="${o.id}" ${o.allowed ? '' : 'disabled'} aria-pressed="${pick === o.id}">
    <span class="ic" style="background:${o.id === 'P' ? '#fff3a3' : o.id === 'Q' ? '#c6f1f8' : '#eef6f8'}">${OPT_ICON[o.id]}</span>
    <b>${esc(o.name)}</b><span class="s">${esc(o.sub)}</span>
    ${o.allowed ? `<ul>${o.effects.map((e) => `<li class="${/破る|0$|影響/.test(e) ? 'bad' : ''}">${esc(e)}</li>`).join('')}</ul>` : `<span class="why">${esc(o.why)}</span>`}
  </button>`).join('');
  const b = $('chooseBtn');
  b.disabled = !pick;
  b.textContent = pick ? `「${opts.find((o) => o.id === pick).name}」で決める` : '選んでから決める';
}

function drawEnd() {
  $('outlook').innerHTML = L.endingOutlook(S).map((e) => {
    const lab = { open: '選べる', near: 'あと一歩', far: '遠い', closed: '閉じた' }[e.status];
    return `<li class="${e.status}"><span class="st">${lab}</span><b>${esc(e.name)}</b><small>${esc(e.why)}</small><small>代償：${esc(e.cost)}</small></li>`;
  }).join('');
  const found = S.secrets.map((k) => `「${SECRETS[k].title}」`).join('');
  $('shareText').textContent = `${L.shareText(S)}　知った秘密：${found || 'なし'}`;
}

function render() {
  document.body.classList.toggle('reduce', settings.reduce);
  drawScene();
  drawHud();
  const ph = S.phase;
  $('talk').hidden = !TALK.includes(ph);
  $('inv').hidden = ph !== 'investigate';
  $('trial').hidden = ph !== 'trial';
  $('choice').hidden = ph !== 'choice';
  $('end').hidden = ph !== 'end';
  if (TALK.includes(ph)) drawTalk();
  if (ph === 'investigate') drawInv();
  if (ph === 'trial') drawTrial();
  if (ph === 'choice') drawChoice();
  if (ph === 'end') drawEnd();
  drawShelf();
  $('muteBtn').textContent = `音：${settings.mute ? 'なし' : 'あり'}`;
  $('motionBtn').textContent = `動き：${settings.reduce ? '減らす' : 'ふつう'}`;
  $('hintBtn').textContent = `最初の手引き：${settings.hint ? 'あり' : 'なし'}`;
  save();
}

// ---------- 操作 ----------
function firstGesture() { sfx.unlock(); if (!settings.mute) startBgm(); }

function onSite(id) {
  if (busy) return;
  firstGesture();
  const v = L.canVisit(S, id);
  if (!v.ok) { toast(v.why); return; }
  // 最初のかけらだけは、触れたらすぐ手に入る
  if (S.ch === 1 && S.visited.length === 0) { doVisit(id); return; }
  if (S.phase === 'intro') L.advance(S);
  pendingSite = id;
  render();
  $('visitYes').focus({ preventScroll: true });
}

function doVisit(id) {
  const r = L.visit(S, id);
  if (!r.ok) { toast(r.why); return; }
  pendingSite = null;
  newEv = r.ev;
  sfx.pick();
  render();
  if (matchMedia('(max-width: 860px)').matches) $('panel').scrollIntoView({ behavior: settings.reduce ? 'auto' : 'smooth', block: 'nearest' });
}

function onNext() {
  if (busy) return;
  firstGesture();
  const lines = L.sceneLines(S);
  if (shown < lines.length) { shown = lines.length; clearTimeout(revealTimer); drawTalk(); return; }
  if (S.phase === 'intro' && S.ch === 1) return;
  const wasAfter = S.phase === 'after';
  L.advance(S);
  sfx.tap();
  if (S.phase === 'trial') sel = { t: null, slots: [null, null] };
  if (S.phase === 'choice') pick = null;
  render();
  if (wasAfter || S.phase === 'intro') window.scrollTo({ top: 0, behavior: settings.reduce ? 'auto' : 'smooth' });
}

function onEvCard(id) {
  if (busy) return;
  if (S.phase !== 'trial') { openEv(id); return; }
  const i = sel.slots.indexOf(id);
  if (i >= 0) sel.slots[i] = null;
  else {
    const free = sel.slots.indexOf(null);
    if (free < 0) sel.slots[1] = id; else sel.slots[free] = id;
  }
  sfx.tap();
  S.feedback = null;
  $('slots').classList.remove('ng', 'ok');
  render();
}

function openEv(id) {
  const e = EVIDENCE[id];
  $('evBig').innerHTML = evIcon(id);
  $('evName').textContent = e.name;
  $('evText').textContent = e.text;
  $('evDlg').showModal();
}

function onPresent() {
  if (busy) return;
  const [a, b] = sel.slots;
  const r = L.present(S, sel.t, a, b);
  if (!r.ok) { toast(r.why); return; }
  const slotsEl = $('slots');
  if (r.correct) {
    busy = true;
    slotsEl.classList.remove('ng'); slotsEl.classList.add('ok');
    sfx.connect();
    setTimeout(() => { busy = false; slotsEl.classList.remove('ok'); render(); }, settings.reduce ? 50 : 750);
  } else {
    slotsEl.classList.remove('ok'); void slotsEl.offsetWidth; slotsEl.classList.add('ng');
    sfx.miss();
    sel.slots = [null, null];
    render();
  }
}

function onChoose() {
  if (busy || !pick) return;
  const r = L.choose(S, pick);
  if (!r.ok) { toast(r.why); return; }
  if (pick === 'P') { sfx.flag(); if (S.lastBroke?.length) setTimeout(() => sfx.snap(), 500); }
  else if (pick === 'Q') sfx.key(); else sfx.stamp();
  pick = null;
  render();
}

function restart(chapterOnly) {
  clearTimeout(revealTimer);
  S = chapterOnly ? L.restoreChapter(S) : L.newGame();
  sel = { t: null, slots: [null, null] }; pick = null; pendingSite = null; shownKey = '';
  bgKey = '';
  render();
  window.scrollTo({ top: 0 });
}

function bind() {
  $('nextBtn').addEventListener('click', onNext);
  $('visitYes').addEventListener('click', () => pendingSite && doVisit(pendingSite));
  $('visitNo').addEventListener('click', () => { pendingSite = null; render(); });
  $('sites').addEventListener('click', (e) => { const b = e.target.closest('[data-site-btn]'); if (b) onSite(b.dataset.siteBtn); });
  $('cards').addEventListener('click', (e) => {
    const info = e.target.closest('[data-info]'); if (info) { openEv(info.dataset.info); return; }
    const b = e.target.closest('[data-ev]'); if (b) onEvCard(b.dataset.ev);
  });
  $('testis').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; sel.t = sel.t === b.dataset.t ? null : b.dataset.t; sfx.tap(); render(); });
  $('slots').addEventListener('click', (e) => { const b = e.target.closest('.slot'); if (!b) return; const i = Number(b.dataset.slot); if (sel.slots[i]) { sel.slots[i] = null; render(); } else toast('下の「証拠の棚」から、証拠をタップして入れよう'); });
  $('presentBtn').addEventListener('click', onPresent);
  $('giveUpBtn').addEventListener('click', () => { if (busy) return; L.giveUp(S); render(); });
  $('opts').addEventListener('click', (e) => { const b = e.target.closest('[data-opt]'); if (!b || b.disabled) return; pick = b.dataset.opt; sfx.tap(); render(); });
  $('chooseBtn').addEventListener('click', onChoose);
  $('replayCh').addEventListener('click', () => restart(true));
  $('replayAll').addEventListener('click', () => restart(false));
  $('logBtn').addEventListener('click', () => {
    $('logList').innerHTML = S.log.length ? S.log.map((l) => `<li>第${l.ch}章：${esc(l.text)}</li>`).join('') : '<li>まだ記録はない。</li>';
    $('logDlg').showModal();
  });
  $('setBtn').addEventListener('click', () => $('setDlg').showModal());
  $('muteBtn').addEventListener('click', () => { settings.mute = !settings.mute; setMuted(settings.mute); if (!settings.mute) { sfx.unlock(); startBgm(); } render(); });
  $('motionBtn').addEventListener('click', () => { settings.reduce = !settings.reduce; render(); });
  $('hintBtn').addEventListener('click', () => { settings.hint = !settings.hint; render(); });
  $('restartCh').addEventListener('click', () => { $('setDlg').close(); restart(true); });
  $('restartAll').addEventListener('click', () => { $('setDlg').close(); restart(false); });
  let rz = null;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(drawScene, 150); });
}

// ---------- はじめ ----------
if (OG) {
  document.body.classList.add('og');
  // 共有画像：第3章、裂け目の向こうに街が見え、旗と鍵がある場面
  S = L.newGame();
  L.visit(S, 'plaza'); L.advance(S); L.visit(S, 'tower'); L.advance(S); L.visit(S, 'roof'); L.advance(S);
  L.present(S, 't1a', 'e1', 'e2'); L.advance(S); L.choose(S, 'Q'); L.advance(S); L.advance(S);
  S.phase = 'investigate';
  settings.reduce = true;
} else {
  load();
}
setMuted(settings.mute);
bind();
render();
