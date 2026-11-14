// 描画・操作・画面遷移。ルールは logic.js、絵は art.js。
import * as L from './logic.js';
import { CARDS, ALLIES, NODES, CHAPTERS, MAX_HP } from './logic.js';
import * as art from './art.js';

const $ = (id) => document.getElementById(id);
const KEY = 'dawn-thief-witch:run'; const RKEY = 'dawn-thief-witch:rec'; const SKEY = 'dawn-thief-witch:set';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* 保存できなくても遊べる */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* 無視 */ } },
};
let rec = L.parseRecord(store.get(RKEY));
let settings = { sound: true, vol: 0.7, low: false, fast: false };
try { Object.assign(settings, JSON.parse(store.get(SKEY) || '{}')); } catch { /* 既定 */ }
const saveRec = () => store.set(RKEY, JSON.stringify(rec));
const saveSet = () => store.set(SKEY, JSON.stringify(settings));
const params = new URLSearchParams(location.search);
const OG = params.has('og');

let s = null; // 旅の状態
const ui = { sel: null, target: null, endWarned: false, lock: 0, hitT: {}, allyFlash: null, dawn: 0, seenStage: '' };
let t = 0;

// ---------- 音（WebAudio。最初の操作で解禁） ----------
const audio = (() => {
  let ac = null; let master = null;
  const ensure = () => {
    if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return false; try { ac = new A(); master = ac.createGain(); master.connect(ac.destination); } catch { return false; } }
    master.gain.value = settings.sound ? settings.vol * 0.6 : 0;
    if (ac.state !== 'running') { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); }
    return true;
  };
  const tone = (f, d = 0.3, type = 'triangle', g = 0.2, when = 0, slide = 0) => {
    if (!ac || !settings.sound) return; const o = ac.createOscillator(); const v = ac.createGain(); const t0 = ac.currentTime + when;
    o.type = type; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t0 + d);
    v.gain.setValueAtTime(0.0001, t0); v.gain.exponentialRampToValueAtTime(g, t0 + 0.01); v.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(v); v.connect(master); o.start(t0); o.stop(t0 + d + 0.05);
  };
  const noise = (d = 0.2, f = 2000, g = 0.2) => {
    if (!ac || !settings.sound) return; const b = ac.createBuffer(1, ac.sampleRate * d, ac.sampleRate); const ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    const src = ac.createBufferSource(); src.buffer = b; const fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; const v = ac.createGain(); v.gain.value = g; src.connect(fl); fl.connect(v); v.connect(master); src.start();
  };
  return {
    ensure,
    pluck(n = 0) { tone(330 * 2 ** (n / 12), 0.35, 'triangle', 0.12); tone(660 * 2 ** (n / 12), 0.2, 'sine', 0.05); },
    fire() { noise(0.25, 2400, 0.35); tone(180, 0.2, 'sawtooth', 0.06, 0, 0.5); },
    block() { tone(520, 0.15, 'square', 0.05); tone(780, 0.25, 'triangle', 0.07, 0.03); },
    bell() { [880, 1320, 1760].forEach((f, i) => tone(f, 1.2 - i * 0.3, 'sine', 0.08 / (i + 1))); },
    chain() { noise(0.12, 4000, 0.3); tone(1200, 0.08, 'square', 0.04); tone(900, 0.1, 'square', 0.04, 0.06); },
    hurt() { noise(0.3, 600, 0.4); tone(110, 0.3, 'sawtooth', 0.08, 0, 0.6); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.6, 'triangle', 0.1, i * 0.09)); },
    lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.7, 'triangle', 0.1, i * 0.18)); },
    ui() { tone(700, 0.06, 'triangle', 0.05); },
  };
})();
const unlockAudio = () => audio.ensure();
window.addEventListener('pointerdown', unlockAudio, { capture: true });
window.addEventListener('keydown', unlockAudio, { capture: true });

// ---------- カードの絵（id ごとに一度だけ作る） ----------
const artCache = {};
function cardArt(id) {
  if (artCache[id]) return artCache[id];
  const c = document.createElement('canvas'); c.width = 212; c.height = 128;
  art.drawCardArt(c.getContext('2d'), id, 212, 128);
  artCache[id] = c.toDataURL();
  return artCache[id];
}
function cardEl(id, o = {}) {
  const d = CARDS[id]; const el = document.createElement(o.button === false ? 'div' : 'button');
  if (el.tagName === 'BUTTON') el.type = 'button';
  el.className = `card${d.ally ? ' ally' : ''}${o.mini ? ' mini' : ''}${o.unknown ? ' unknown' : ''}`;
  el.innerHTML = `<span class="cost">${o.unknown ? '?' : d.cost}</span><span class="nm">${o.unknown ? '？？？' : d.name}</span><img alt="" src="${cardArt(id)}"><span class="tx">${o.unknown ? `No.${d.no}` : d.text}</span>${d.exhaust && !o.unknown ? '<span class="tag">除外</span>' : ''}`;
  el.setAttribute('aria-label', o.unknown ? '未発見のカード' : `${d.name}、コスト${d.cost}、${d.text}`);
  return el;
}

// ---------- 画面 ----------
const screens = ['title', 'battle'];
function show(id) { for (const k of screens) $(k).hidden = k !== id; }
function modal(html) { $('panel').innerHTML = html; $('modal').hidden = false; $('panel').scrollTop = 0; }
function closeModal() { $('modal').hidden = true; $('panel').innerHTML = ''; }
function toast(msg) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 1600); }

// ---------- 保存 ----------
function save() { if (!s) return; if (s.phase === 'ending') store.del(KEY); else store.set(KEY, L.serialize(s)); }
function loadRun() { const r = L.deserialize(store.get(KEY)); return r && r.phase !== 'ending' ? r : null; }

// ---------- タイトル ----------
function refreshTitle() {
  const r = loadRun();
  $('contBtn').hidden = !r;
  if (r) $('contBtn').textContent = `続きから（${CHAPTERS[L.chapterOf(r)].name}・HP${r.hp}）`;
  $('unlockRow').hidden = rec.clears <= 0;
}
function startRun() {
  const starter = rec.clears > 0 ? $('starterSel').value : 'ember';
  const hard = rec.clears > 0 && $('hardChk').checked;
  const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  s = L.newRun({ seed, starter, hard, tutorial: true });
  if (rec.tutorialDone) { /* 既プレイは導入を飛ばせる（画面にボタンを出す） */ }
  enterBattleScreen();
}
$('startBtn').addEventListener('click', () => { audio.ui(); const r = loadRun(); if (r && !confirmNew()) return; startRun(); });
function confirmNew() { return window.confirm('保存してある旅は消えます。新しい旅を始めますか？'); }
$('contBtn').addEventListener('click', () => { audio.ui(); s = loadRun(); if (!s) return; enterBattleScreen(); });
$('codexBtn').addEventListener('click', () => { audio.ui(); openCodex(); });
$('setBtn').addEventListener('click', () => { audio.ui(); openSettings(); });

function enterBattleScreen() { show('battle'); ui.sel = null; ui.target = null; resize(); route(); }

// 状態に合わせて画面を出し分ける
function route() {
  if (!s) { show('title'); refreshTitle(); return; }
  handleEvents();
  if (s.chapterMsg && (s.phase === 'battle')) { const c = s.chapterMsg; s.chapterMsg = null; save(); return showChapter(c); }
  switch (s.phase) {
    case 'tutorial': closeModal(); renderBattle(); banner('火花を、狼へ', '下の「火花」を選び、狼を選んで「使う」。狼の上の⚔6は「次に6ダメージ」の予告'); break;
    case 'battle': closeModal(); renderBattle(); break;
    case 'reward': renderBattle(); showReward(); break;
    case 'rest': showRest(); break;
    case 'dead': renderBattle(); showDead(); break;
    case 'ending': showEnding(); break;
    default: break;
  }
  save();
}

// ---------- 戦闘の描画 ----------
const cv = $('scene'); const ctx = cv.getContext('2d');
const view = { w: 0, h: 0, dpr: 1, s: 1, foes: [], witch: { x: 0, y: 0 }, cage: null, fire: null };
function resize() {
  const r = $('sceneWrap').getBoundingClientRect();
  view.dpr = Math.min(2, window.devicePixelRatio || 1); view.w = r.width; view.h = r.height;
  cv.width = Math.round(r.width * view.dpr); cv.height = Math.round(r.height * view.dpr);
  const tc = $('titleCv'); tc.width = Math.round(window.innerWidth * view.dpr); tc.height = Math.round(window.innerHeight * view.dpr);
  layoutScene();
}
window.addEventListener('resize', () => { resize(); if (s && !$('battle').hidden) renderBattle(); });

function layoutScene() {
  const w = view.w; const h = view.h; const narrow = w < 560;
  const ground = h * 0.86;
  const sc = Math.min(h / 300, w / (narrow ? 330 : 520));
  view.s = sc;
  view.witch = { x: w * (narrow ? 0.15 : 0.16), y: ground };
  view.fire = { x: w * (narrow ? 0.06 : 0.07), y: ground - 2 };
  const b = s && (s.battle || s.lastBattle);
  const foes = b ? b.foes : [];
  const hasCage = s && s.battle && s.battle.ally;
  const x0 = hasCage ? (narrow ? 0.66 : 0.64) : (narrow ? 0.58 : 0.6);
  const x1 = narrow ? 0.86 : 0.86;
  view.foes = foes.map((f, i) => {
    const x = foes.length === 1 ? w * (hasCage ? 0.72 : 0.7) : w * (x0 + (x1 - x0) * (i / (foes.length - 1)));
    const fs = sc * (f.boss ? 1.05 : narrow ? 0.8 : 0.95);
    return { key: f.key, x, y: ground, s: fs, top: ground - art.FOE_HEIGHT[f.id] * fs };
  });
  view.cage = hasCage ? { x: w * (narrow ? 0.43 : 0.42), y: ground, s: sc * (narrow ? 0.85 : 1) } : null;
}

function renderBattle() {
  if (!s) return;
  layoutScene();
  const b = s.battle; const fb = s.battle || s.lastBattle;
  $('where').textContent = s.phase === 'tutorial' ? '森の入口（練習）' : `${CHAPTERS[L.chapterOf(s)].name}・${NODES[s.node]?.name || ''}${s.hard ? '・長い夜' : ''}`;
  $('drawN').textContent = b ? b.draw.length : 0; $('discN').textContent = b ? b.discard.length : 0;
  // 自分
  $('hpFill').style.width = `${(s.hp / MAX_HP) * 100}%`; $('hpTxt').textContent = `HP ${s.hp}/${MAX_HP}`;
  $('blockBadge').hidden = !(b && b.block); if (b) $('blockN').textContent = b.block;
  $('weakBadge').hidden = !(b && b.weak);
  // 敵
  const pv = ui.sel ? previewNow() : null;
  const box = $('foes'); box.innerHTML = '';
  if (fb) {
    for (const f of fb.foes) {
      const pos = view.foes.find((p) => p.key === f.key); if (!pos) continue;
      const el = document.createElement('button'); el.type = 'button'; el.className = 'foe'; el.dataset.key = f.key;
      if (f.dead) el.classList.add('dead');
      const it = L.intentOf(s, f);
      const ic = it.t === 'a' ? `<span class="ic">⚔</span>${it.n}${it.hits > 1 ? `×${it.hits}` : ''}` : it.t === 'd' ? `<span class="ic">🛡</span>${it.n}` : '<span class="ic">☾</span>弱体';
      const pf = pv && pv.ok ? pv.foes.find((x) => x.key === f.key) : null;
      const hpAfter = pf ? pf.hp : f.hp;
      el.innerHTML = `<span class="intent ${it.t}" title="次の行動">${ic}</span>
        <span class="fhp"><i style="width:${(f.hp / f.maxHp) * 100}%"></i>${pf && pf.hp !== f.hp ? `<i class="pv" style="left:${(hpAfter / f.maxHp) * 100}%;width:${((f.hp - hpAfter) / f.maxHp) * 100}%"></i>` : ''}<span>${pf && pf.hp !== f.hp ? `${f.hp}→${hpAfter}` : `${f.hp}/${f.maxHp}`}</span></span>
        <span class="fbadges">${f.block ? `<span class="badge block">🛡${f.block}</span>` : ''}${f.weak ? '<span class="badge weak">弱体</span>' : ''}</span>
        <span class="nm">${f.name}</span>`;
      el.setAttribute('aria-label', `${f.name} HP${f.hp}/${f.maxHp}。次の行動：${it.t === 'a' ? `攻撃${it.total}` : it.t === 'd' ? `防御${it.n}` : '弱体'}`);
      el.style.left = `${pos.x}px`;
      el.style.top = `${Math.max(36, pos.top - 92)}px`;
      const sel = ui.sel && b && b.hand.find((c) => c.uid === ui.sel);
      if (sel && CARDS[sel.id].target === 'enemy' && !f.dead) el.classList.add(ui.target === f.key ? 'targeted' : 'targetable');
      el.addEventListener('click', () => onFoe(f.key));
      box.appendChild(el);
    }
  }
  // 檻の名札：中にいる仲間と、救うと得られる札
  if (b && b.ally && view.cage && b.cage !== 'lost') {
    const tag = document.createElement('div'); tag.className = 'cagetag';
    tag.innerHTML = b.cage === 'freed' ? `<b>${ALLIES[b.ally].name}</b>を救った` : `檻の中：<b>${ALLIES[b.ally].name}</b><br>鎖${b.chains}本を切れば救える<br><small>救うと「${CARDS[ALLIES[b.ally].card].name}」</small>`;
    tag.style.left = `${view.cage.x}px`; tag.style.top = `${Math.max(36, view.cage.y - 150 * view.cage.s)}px`;
    box.appendChild(tag);
  }
  // エネルギー
  const en = b ? b.energy : 0;
  $('enN').textContent = en; $('enOrbs').innerHTML = Array.from({ length: Math.max(3, en) }, (_, i) => `<i class="orb${i < en ? '' : ' off'}"></i>`).join('');
  // 鎖
  const cut = b && b.cage === 'locked';
  $('cutBtn').hidden = !cut;
  if (cut) { const ok = L.canCut(s).ok; $('cutBtn').disabled = !ok; $('cutBtn').innerHTML = `鎖を切る <small>2</small><span class="wide"> 残り${b.chains}本</span>`; }
  $('endBtn').hidden = s.phase === 'tutorial';
  $('endBtn').classList.toggle('warn', ui.endWarned);
  $('endBtn').textContent = ui.endWarned ? 'まだ使える。終える？' : 'ターン終了';
  // 手札
  renderHand();
  renderConfirm();
}

function renderHand() {
  const b = s.battle; const hand = $('hand'); hand.innerHTML = '';
  if (!b) return;
  const unseen = b.hand.map((c) => c.id).filter((id) => !rec.seen.includes(id)); if (unseen.length) noteSeen(unseen);
  b.hand.forEach((c, i) => {
    const el = cardEl(c.id); el.dataset.uid = c.uid; el.setAttribute('role', 'listitem');
    if (CARDS[c.id].cost > b.energy) el.classList.add('cant');
    if (ui.sel === c.uid) el.classList.add('sel');
    if (i < 8) el.title = `${i + 1}キーでも選べる`;
    bindCard(el, c);
    hand.appendChild(el);
  });
}

// ---------- 選ぶ→対象→使う ----------
function previewNow() {
  const b = s.battle; if (!b || !ui.sel) return null;
  const c = b.hand.find((x) => x.uid === ui.sel); if (!c) return null;
  const need = CARDS[c.id].target === 'enemy';
  if (need && ui.target == null) return null;
  return L.preview(s, ui.sel, ui.target);
}
function selectCard(uid) {
  if (ui.lock > 0 || !s.battle || s.battle.over) return;
  const c = s.battle.hand.find((x) => x.uid === uid); if (!c) return;
  if (ui.sel === uid) { cancelSel(); return; }
  audio.pluck(CARDS[c.id].no % 7);
  ui.sel = uid; ui.target = null;
  if (CARDS[c.id].target === 'enemy') { const alive = L.living(s); if (alive.length === 1) ui.target = alive[0].key; }
  renderBattle();
}
function onFoe(key) {
  if (!ui.sel) return;
  const c = s.battle.hand.find((x) => x.uid === ui.sel); if (!c || CARDS[c.id].target !== 'enemy') return;
  ui.target = key; audio.ui(); renderBattle();
}
function cancelSel() { ui.sel = null; ui.target = null; renderBattle(); }

function renderConfirm() {
  const box = $('confirm'); const b = s.battle;
  const c = ui.sel && b ? b.hand.find((x) => x.uid === ui.sel) : null;
  if (!c) { box.hidden = true; return; }
  const d = CARDS[c.id]; box.hidden = false;
  $('cCard').innerHTML = ''; $('cCard').appendChild(cardEl(c.id, { button: false }));
  const pv = previewNow();
  const chk = L.canPlay(s, c.uid, ui.target);
  if (d.target === 'enemy' && ui.target == null) { $('cPrompt').textContent = `${d.name}：敵を選ぶ`; $('cPreview').textContent = d.text; $('useBtn').disabled = true; $('cWarn').hidden = true; return; }
  $('cPrompt').textContent = d.target === 'all' ? `${d.name}：敵すべてに` : d.target === 'self' ? `${d.name}：自分に` : `${d.name}：${b.foes.find((f) => f.key === ui.target).name}へ`;
  if (!chk.ok) { $('cPreview').textContent = chk.reason; $('useBtn').disabled = true; $('cWarn').hidden = true; return; }
  const parts = [];
  for (const f of b.foes) { const p = pv.foes.find((x) => x.key === f.key); if (p && (p.hp !== f.hp || p.block !== f.block)) parts.push(`${f.name} HP ${f.hp}→<b>${p.hp}</b>${p.dead ? '（倒れる）' : ''}`); }
  if (pv.block !== b.block) parts.push(`防御 ${b.block}→<b>${pv.block}</b>`);
  if (pv.hp !== s.hp) parts.push(`HP ${s.hp}→<b>${pv.hp}</b>`);
  parts.push(`エネルギー ${b.energy}→<b>${pv.energy}</b>`);
  $('cPreview').innerHTML = parts.join('　');
  $('useBtn').disabled = false;
  const warn = pv.cageLost;
  $('cWarn').hidden = !warn;
  if (warn) $('cWarn').textContent = `倒すと${ALLIES[b.ally].name}を救えない（檻が運び去られる）。それでも使う？`;
  $('useBtn').textContent = warn ? '救わずに使う' : '使う';
}
$('useBtn').addEventListener('click', () => useSelected());
$('cancelBtn').addEventListener('click', () => { audio.ui(); cancelSel(); });
function useSelected() {
  if (!ui.sel || ui.lock > 0) return;
  const c = s.battle.hand.find((x) => x.uid === ui.sel); if (!c) return;
  const r = L.playCard(s, ui.sel, ui.target);
  if (!r.ok) { toast(r.reason); return; }
  rec.tutorialDone = rec.tutorialDone || s.phase !== 'tutorial';
  ui.sel = null; ui.target = null; ui.endWarned = false;
  route();
}

// ---------- ドラッグ（対象へ落とすと確認へ） ----------
function bindCard(el, c) {
  let start = null; let ghost = null; let moved = false;
  el.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; start = { x: e.clientX, y: e.clientY, id: e.pointerId }; moved = false; });
  el.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dy = start.y - e.clientY; const dx = Math.abs(e.clientX - start.x);
    if (!moved && dy > 24 && dy > dx) { moved = true; try { el.setPointerCapture(e.pointerId); } catch { /* 無視 */ } ghost = el.cloneNode(true); Object.assign(ghost.style, { position: 'fixed', pointerEvents: 'none', zIndex: 50, opacity: 0.85, transform: 'rotate(-4deg) scale(.9)' }); document.body.appendChild(ghost); }
    if (moved && ghost) { ghost.style.left = `${e.clientX - 55}px`; ghost.style.top = `${e.clientY - 80}px`; }
  });
  const end = (e) => {
    if (!start) return;
    if (moved) {
      if (ghost) ghost.remove(); ghost = null;
      const hit = document.elementsFromPoint(e.clientX, e.clientY);
      const foe = hit.find((x) => x.classList && x.classList.contains('foe'));
      const inScene = hit.includes($('sceneWrap'));
      if (inScene) {
        ui.sel = c.uid; ui.target = null;
        if (CARDS[c.id].target === 'enemy') { if (foe) ui.target = Number(foe.dataset.key); else { const alive = L.living(s); if (alive.length === 1) ui.target = alive[0].key; } }
        audio.pluck(2); renderBattle();
      } else cancelSel();
    } else if (e.type === 'pointerup') selectCard(c.uid);
    start = null; moved = false;
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('click', (e) => { if (e.detail === 0) selectCard(c.uid); }); // キーボードの Enter/Space
}

// ---------- 鎖とターン終了 ----------
$('cutBtn').addEventListener('click', () => {
  if (ui.lock > 0) return;
  const r = L.cutChain(s); if (!r.ok) { toast(r.reason); return; }
  ui.sel = null; route();
});
$('endBtn').addEventListener('click', () => endTurn());
function endTurn() {
  if (ui.lock > 0 || !s.battle || s.phase !== 'battle') return;
  const b = s.battle;
  const usable = b.hand.some((c) => CARDS[c.id].cost <= b.energy) || L.canCut(s).ok;
  if (b.energy > 0 && usable && !ui.endWarned) { ui.endWarned = true; renderBattle(); return; }
  ui.endWarned = false; ui.sel = null; ui.target = null;
  L.endTurn(s);
  route();
}

// ---------- 出来事 → 演出 ----------
function floatAt(x, y, text, cls = '') {
  if (OG) return;
  const d = document.createElement('div'); d.className = `float ${cls}`; d.textContent = text; d.style.left = `${x}px`; d.style.top = `${y}px`;
  $('floats').appendChild(d); setTimeout(() => d.remove(), 950);
}
let bannerT = 0;
function banner(main, sub = '', dur = 2.2) { $('banner').innerHTML = `${main}${sub ? `<small>${sub}</small>` : ''}`; $('banner').classList.add('on'); bannerT = dur; }
function foePos(key) { const p = view.foes.find((x) => x.key === key); return p ? { x: p.x, y: (p.y + p.top) / 2 } : { x: view.w * 0.7, y: view.h * 0.5 }; }
const sparks = [];
function burst(x, y, col, n = 14) { if (settings.low) return; for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2; const v = 60 + Math.random() * 160; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.5 + Math.random() * 0.4, t: 0, col }); } }
function handleEvents() {
  if (!s || !s.events.length) return;
  let delay = 0; const step = settings.fast ? 110 : 220;
  for (const e of s.events) {
    switch (e.type) {
      case 'play': noteSeen([e.id]); audio.fire(); if (CARDS[e.id].ally) ui.allyFlash = { id: CARDS[e.id].ally, t: 0.9 }; break;
      case 'hit': { const p = foePos(e.key); if (e.dmg) floatAt(p.x, p.y, `-${e.dmg}`, 'dmg'); if (e.blocked) floatAt(p.x + 30, p.y - 20, `🛡${e.blocked}`, 'blk small'); ui.hitT[e.key] = 0.3; burst(p.x, p.y, '#ffb35a'); break; }
      case 'kill': { const p = foePos(e.key); burst(p.x, p.y, '#ffd77a', 30); break; }
      case 'block': audio.block(); floatAt(view.witch.x + 20, view.witch.y - 120 * view.s, `🛡+${e.n}`, 'blk'); break;
      case 'heal': if (e.n) floatAt(view.witch.x, view.witch.y - 140 * view.s, `+${e.n}`, 'small'); break;
      case 'cut': audio.chain(); burst(view.cage?.x || view.w / 2, (view.cage?.y || view.h) - 70 * view.s, '#f6ecd0', 16); banner(e.left ? '鎖を1本切った' : '', e.left ? 'あと1本。次のターンにもう一度' : ''); break;
      case 'rescue': audio.bell(); banner(`${ALLIES[e.ally].name}を救った`, `次のターン、${CARDS[ALLIES[e.ally].card].name}が手札に来る`, 2.6); break;
      case 'allyCard': banner(`${CARDS[e.id].name}が手札に`, '', 1.4); break;
      case 'cageLost': banner('檻が運び去られた', `${ALLIES[e.ally].name}は救えなかった`, 2.4); break;
      case 'hurt': {
        const d = delay; delay += step; ui.lock += 1;
        setTimeout(() => { ui.lock -= 1; const p = foePos(e.key); ui.hitT[`atk${e.key}`] = 0.25; if (e.dmg) { floatAt(view.witch.x, view.witch.y - 110 * view.s, `-${e.dmg}`, 'hurt'); audio.hurt(); } if (e.blocked) floatAt(view.witch.x + 40, view.witch.y - 150 * view.s, `🛡${e.blocked}`, 'blk small'); void p; }, d);
        break;
      }
      case 'foeBlock': { const p = foePos(e.key); floatAt(p.x, p.y - 30, `🛡+${e.n}`, 'blk'); break; }
      case 'weakened': floatAt(view.witch.x, view.witch.y - 160 * view.s, '弱体', 'small'); break;
      case 'weak': for (const f of view.foes) floatAt(f.x, f.top, '弱体', 'small'); break;
      case 'turn': if (e.turn > 1) { const d = delay; setTimeout(() => banner(`ターン ${e.turn}`, '', 0.8), d); } break;
      case 'battle': if (e.type !== 'tutorial') { const nd = NODES[s.node]; if (nd && s.phase === 'battle') banner(nd.name, s.node === 0 ? '敵の上は次の行動：⚔攻撃・🛡防御・☾弱体。⚔は防壁で防げる' : nd.type === 'rescue' ? `檻の中に${ALLIES[nd.ally].name}。鎖2本を切れば救える（1本2エネルギー）` : nd.type === 'boss' ? CHAPTERS[nd.ch].boss : '', 2.6); } break;
      case 'win': audio.win(); break;
      case 'dead': audio.lose(); break;
      case 'retrieve': banner(`${CARDS[e.id].name}が手札に戻った`, '', 1.2); break;
      default: break;
    }
  }
  s.events.length = 0;
}

// ---------- 章の入口 ----------
function showChapter(c) {
  const ch = CHAPTERS.indexOf(c);
  const stops = NODES.map((n, i) => ({ n, i })).filter((x) => x.n.ch === ch);
  modal(`<p class="kick">第${'一二三'[ch]}章</p><h2>${c.name}</h2>
    ${c.intro.map((l) => `<p>${l}</p>`).join('')}
    <div class="path">${stops.map(({ n, i }, k) => `${k ? '<span class="line"></span>' : ''}<span class="stop ${i < s.node ? 'done' : i === s.node ? 'now' : ''} ${n.type === 'boss' ? 'boss' : ''}"><i>${{ battle: '戦', rescue: '檻', rest: '火', boss: '主' }[n.type]}</i>${n.name}</span>`).join('')}</div>
    <p class="sub">HP ${s.hp}/${MAX_HP}　デッキ ${s.deck.length}枚　同行者 ${s.allies.length ? s.allies.map((a) => ALLIES[a].name).join('・') : 'なし'}</p>
    <div class="row"><button id="goBtn" class="btn big" type="button">進む</button></div>`);
  $('goBtn').addEventListener('click', () => { audio.ui(); closeModal(); route(); });
}

// ---------- 報酬 ----------
function showReward() {
  const r = s.reward; noteSeen(r.options);
  const ally = r.ally ? `<p><b>${ALLIES[r.ally].name}</b>が旅に加わった。「${ALLIES[r.ally].line}」<br><span class="sub">${CARDS[ALLIES[r.ally].card].name}がデッキに1枚入った</span></p>` : '';
  const boss = r.boss ? `<p>${CHAPTERS[NODES[s.node].ch].after}<br><span class="sub">章を越えて、HPが${L.CHAPTER_HEAL}回復した</span></p>` : '';
  modal(`<p class="kick">${r.from === 'tutorial' ? '練習のあと' : '勝利'}</p><h2>カードを1枚選ぶ</h2>${boss}${ally}
    <p class="sub">取らずに進むと、デッキが薄いまま（よく使う札が回りやすい）</p>
    <div class="cards3" id="rw"></div>
    <div class="row"><button id="skipBtn" class="btn ghost" type="button" style="color:var(--ink);border-color:var(--ink)">取らずに進む</button>
    ${r.from === 'tutorial' ? '' : `<button id="deckBtn" class="link" type="button" style="color:var(--ink)">今のデッキ（${s.deck.length}枚）</button>`}</div>`);
  for (const id of r.options) {
    const el = cardEl(id); el.addEventListener('click', () => { audio.pluck(4); L.chooseReward(s, id); noteSeen([id]); afterAdvance(); });
    $('rw').appendChild(el);
  }
  $('skipBtn').addEventListener('click', () => { audio.ui(); L.chooseReward(s, null); afterAdvance(); });
  if ($('deckBtn')) $('deckBtn').addEventListener('click', () => showDeck(() => showReward()));
}
function afterAdvance() { closeModal(); ui.sel = null; resize(); route(); }
function noteSeen(ids) { L.noteSeen(rec, ids); saveRec(); }

function showDeck(back) {
  modal(`<h2>今のデッキ</h2><p class="sub">${s.deck.length}枚</p><div class="deckgrid" id="dg"></div><div class="row"><button id="bk" class="btn" type="button">戻る</button></div>`);
  const sorted = s.deck.slice().sort((a, b) => CARDS[a.id].no - CARDS[b.id].no);
  for (const c of sorted) $('dg').appendChild(cardEl(c.id, { mini: true, button: false }));
  $('bk').addEventListener('click', back);
}

// ---------- 休息 ----------
function showRest() {
  show('battle'); renderBattle();
  const nd = NODES[s.node];
  modal(`<p class="kick">休息</p><h2>${nd.name}</h2><p>火のそばで、ひと息つく。どちらか一つだけ。</p>
    <p class="sub">HP ${s.hp}/${MAX_HP}　デッキ ${s.deck.length}枚</p>
    <div class="choice2"><button id="healBtn" class="btn" type="button">HPを${L.REST_HEAL}回復<br><small>${s.hp >= MAX_HP ? 'HPは満タン（回復しても増えない）' : `→ ${Math.min(MAX_HP, s.hp + L.REST_HEAL)}`}</small></button>
    <button id="rmBtn" class="btn" type="button" ${L.canRemove(s) ? '' : 'disabled'}>カードを1枚手放す<br><small>${L.canRemove(s) ? '引きたい札が回りやすくなる' : 'デッキが少なすぎる'}</small></button></div>`);
  $('healBtn').addEventListener('click', () => { audio.bell(); L.rest(s, 'heal'); afterAdvance(); });
  $('rmBtn').addEventListener('click', () => {
    modal(`<h2>手放すカードを選ぶ</h2><div class="deckgrid" id="dg"></div><div class="row"><button id="bk" class="btn" type="button">戻る</button></div>`);
    for (const c of s.deck.slice().sort((a, b) => CARDS[a.id].no - CARDS[b.id].no)) { const el = cardEl(c.id, { mini: true }); el.addEventListener('click', () => { audio.ui(); L.rest(s, 'remove', c.uid); afterAdvance(); }); $('dg').appendChild(el); }
    $('bk').addEventListener('click', showRest);
  });
}

// ---------- 敗北 ----------
function showDead() {
  const d = s.death;
  modal(`<p class="kick">倒れた</p><h2>朝は、まだ遠い</h2><p>${d.by}の攻撃（${d.dmg}）で倒れた。<br><span class="sub">${NODES[d.node].name}・HP 0</span></p>
    <div class="row" style="flex-direction:column;align-items:center">
      <button id="rtB" class="btn big" type="button">この戦闘をやり直す</button>
      <button id="rtC" class="btn" type="button">章の入口へ（${CHAPTERS[NODES[d.node].ch].name}）</button>
      <button id="rtN" class="btn ghost" type="button" style="color:var(--ink);border-color:var(--ink)">新しい旅</button></div>`);
  $('rtB').addEventListener('click', () => { L.retryBattle(s); afterAdvance(); });
  $('rtC').addEventListener('click', () => { L.retryChapter(s); afterAdvance(); });
  $('rtN').addEventListener('click', () => { closeModal(); store.del(KEY); s = null; show('title'); refreshTitle(); });
}

// ---------- 結末 ----------
function drawEnding(c, st) {
  const g = c.getContext('2d'); const w = c.width; const h = c.height;
  art.drawBackdrop(g, w, h, 2, 3, 1);
  // 夜の王の崩れた王冠
  g.save(); g.globalAlpha = 0.5; art.drawFoe(g, 'king', w * 0.72, h * 0.88, h / 300, 0); g.restore();
  art.drawCampfire(g, w * 0.12, h * 0.86, h / 260, 2);
  st.allies.forEach((a, i) => art.drawAlly(g, a, w * (0.2 + i * 0.07), h * 0.86, h / 200, 1));
  art.drawWitch(g, w * 0.42, h * 0.88, h / 220, 1);
  g.fillStyle = 'rgba(21,16,12,.75)'; g.fillRect(0, 0, w, 54);
  g.fillStyle = art.C.moon; g.font = `900 ${Math.round(h * 0.07)}px serif`; g.textAlign = 'left';
  g.fillText('朝を取り戻した', 18, 40);
  g.font = `700 ${Math.round(h * 0.045)}px serif`; g.textAlign = 'right';
  g.fillText(`同行者${st.allies.length}人・残りHP${st.hp}${st.hard ? '・長い夜' : ''}`, w - 18, 38);
  // 旅の札3枚
  const tops = L.topCards(st);
  tops.forEach((tc, i) => {
    const x = w - 18 - (3 - i) * 92; const y = h - 128;
    g.fillStyle = art.C.paper; g.fillRect(x, y, 84, 110); g.strokeStyle = art.C.ink; g.lineWidth = 2; g.strokeRect(x, y, 84, 110);
    const cc = document.createElement('canvas'); cc.width = 76; cc.height = 52; art.drawCardArt(cc.getContext('2d'), tc.id, 76, 52); g.drawImage(cc, x + 4, y + 22);
    g.fillStyle = art.C.ink; g.textAlign = 'center'; g.font = '900 14px serif'; g.fillText(CARDS[tc.id].name, x + 42, y + 17);
    g.font = '700 12px sans-serif'; g.fillText(`${tc.count}回`, x + 42, y + 96);
  });
  g.fillStyle = 'rgba(246,236,208,.7)'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText(`旅の番号 ${st.seed}`, 12, h - 10);
}
function showEnding() {
  if (!s.cleared) { s.cleared = true; L.recordClear(rec, s); saveRec(); }
  show('battle'); renderBattle();
  const names = s.allies.map((a) => ALLIES[a].name);
  modal(`<p class="kick">夜明け</p><h2>朝を取り戻した</h2>
    <p>${names.length ? `${names.join('、')}が、朝焼けの旅団に並んでいる。` : '魔女はひとりで、地平線に朝の種を植えた。'}</p>
    <canvas id="endCv" class="end-cv" width="720" height="380" aria-label="夜明けの結果の絵"></canvas>
    <p class="sub" id="shareTxt"></p>
    <div class="row"><button id="saveImg" class="btn" type="button">画像を保存</button><button id="copyTxt" class="btn" type="button">共有文をコピー</button><button id="toTitle" class="btn big" type="button">タイトルへ</button></div>
    ${rec.clears === 1 ? '<p class="sub">「炉辺の旅」の初期デッキと、難しい「長い夜」が選べるようになった。</p>' : ''}`);
  drawEnding($('endCv'), s);
  $('shareTxt').textContent = L.shareText(s);
  $('saveImg').addEventListener('click', () => { const a = document.createElement('a'); a.download = 'dawn-thief-witch.png'; a.href = $('endCv').toDataURL('image/png'); a.click(); });
  $('copyTxt').addEventListener('click', async () => { try { await navigator.clipboard.writeText(`${L.shareText(s)} ${location.href.split('?')[0]}`); toast('コピーした'); } catch { toast('コピーできなかった'); } });
  $('toTitle').addEventListener('click', () => { closeModal(); store.del(KEY); s = null; show('title'); refreshTitle(); });
  store.del(KEY);
}

// ---------- 図鑑・設定・メニュー ----------
function openCodex() {
  modal(`<h2>カード図鑑</h2><p class="sub">${rec.seen.length}/24枚　見つけた札は絵と効果が開く</p><div class="codex" id="cx"></div><div class="row"><button id="bk" class="btn" type="button">閉じる</button></div>`);
  for (const id of L.CARD_IDS) $('cx').appendChild(cardEl(id, { mini: true, button: false, unknown: !rec.seen.includes(id) }));
  $('bk').addEventListener('click', closeModal);
}
function openSettings(back = closeModal) {
  modal(`<h2>設定</h2>
    <label class="setrow"><span>音</span><input id="sSnd" type="checkbox" ${settings.sound ? 'checked' : ''}></label>
    <label class="setrow"><span>音量</span><input id="sVol" type="range" min="0" max="1" step="0.05" value="${settings.vol}"></label>
    <label class="setrow"><span>動きを控えめに</span><input id="sLow" type="checkbox" ${settings.low ? 'checked' : ''}></label>
    <label class="setrow"><span>敵の行動を2倍速</span><input id="sFast" type="checkbox" ${settings.fast ? 'checked' : ''}></label>
    <div class="row"><button id="bk" class="btn" type="button">戻る</button></div>`);
  const upd = () => { settings.sound = $('sSnd').checked; settings.vol = Number($('sVol').value); settings.low = $('sLow').checked; settings.fast = $('sFast').checked; document.body.classList.toggle('low', settings.low); saveSet(); audio.ensure(); };
  for (const id of ['sSnd', 'sVol', 'sLow', 'sFast']) $(id).addEventListener('input', upd);
  $('bk').addEventListener('click', back);
}
$('menuBtn').addEventListener('click', () => {
  audio.ui();
  const inTut = s && s.phase === 'tutorial';
  modal(`<h2>旅の手帳</h2><p class="sub">${s ? `HP ${s.hp}/${MAX_HP}・デッキ ${s.deck.length}枚・同行者 ${s.allies.length}人` : ''}</p>
    <div class="row" style="flex-direction:column;align-items:center">
      <button id="mBack" class="btn big" type="button">戦闘に戻る</button>
      ${inTut ? '<button id="mSkip" class="btn" type="button">練習をとばす</button>' : ''}
      <button id="mDeck" class="btn" type="button">今のデッキ</button>
      <button id="mHelp" class="btn" type="button">遊び方</button>
      <button id="mSet" class="btn" type="button">設定</button>
      <button id="mTitle" class="btn ghost" type="button" style="color:var(--ink);border-color:var(--ink)">タイトルへ（自動で保存）</button></div>`);
  $('mBack').addEventListener('click', () => { closeModal(); route(); });
  if ($('mSkip')) $('mSkip').addEventListener('click', () => { L.skipTutorial(s); afterAdvance(); });
  $('mDeck').addEventListener('click', () => showDeck(() => $('menuBtn').click()));
  $('mHelp').addEventListener('click', () => modal(`<h2>遊び方</h2><p style="text-align:left">毎ターン、エネルギー3で手札5枚を使う。<br>敵の頭の上に<b>次の行動</b>が出ている（⚔攻撃・🛡防御・☾弱体）。攻撃は🛡防御で減らせる。<br>カードは<b>選ぶ→敵を選ぶ→使う</b>。カードを上へドラッグして敵に落としてもよい。<br><b>檻</b>のある戦いでは「鎖を切る」（2エネルギー・1ターン1回）を2回で仲間を救える。救う前に敵を全滅させると檻は運び去られる。<br>勝ったらカードを1枚選んでデッキを組み替える。3章のボスを倒せば夜明け。</p><p class="sub">キー：1〜8 カード／Tab 敵の切替／Enter 使う／Esc 取消／E ターン終了／C 鎖を切る</p><div class="row"><button id="bk" class="btn" type="button">戻る</button></div>`) || $('bk').addEventListener('click', () => $('menuBtn').click()));
  $('mSet').addEventListener('click', () => openSettings(() => $('menuBtn').click()));
  $('mTitle').addEventListener('click', () => { save(); closeModal(); s = null; show('title'); refreshTitle(); });
});

// ---------- キーボード ----------
window.addEventListener('keydown', (e) => {
  if (!$('modal').hidden || !s || $('battle').hidden || !s.battle) return;
  const b = s.battle;
  if (/^[1-8]$/.test(e.key)) { const c = b.hand[Number(e.key) - 1]; if (c) selectCard(c.uid); e.preventDefault(); }
  else if (e.key === 'Escape') cancelSel();
  else if (e.key === 'Enter') { if (ui.sel && !$('useBtn').disabled) { useSelected(); e.preventDefault(); } }
  else if (e.key === 'Tab' && ui.sel) { const alive = L.living(s); if (alive.length) { const i = alive.findIndex((f) => f.key === ui.target); ui.target = alive[(i + 1) % alive.length].key; renderBattle(); } e.preventDefault(); }
  else if (e.key === 'e' || e.key === 'E') endTurn();
  else if (e.key === 'c' || e.key === 'C') $('cutBtn').click();
});
$('sceneWrap').addEventListener('click', (e) => { if (e.target === cv && ui.sel) { const c = s.battle?.hand.find((x) => x.uid === ui.sel); if (c && CARDS[c.id].target === 'enemy' && ui.target == null) return; } });

// ---------- 毎フレームの絵 ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('on'); }
  for (const k of Object.keys(ui.hitT)) { ui.hitT[k] -= dt; if (ui.hitT[k] <= 0) delete ui.hitT[k]; }
  if (ui.allyFlash) { ui.allyFlash.t -= dt; if (ui.allyFlash.t <= 0) ui.allyFlash = null; }
  for (const p of sparks) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; }
  for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].t > sparks[i].life) sparks.splice(i, 1);
  if (!$('battle').hidden && s) drawScene();
  else if (!$('title').hidden) drawTitle();
  requestAnimationFrame(frame);
}
function drawScene() {
  const d = view.dpr; ctx.setTransform(d, 0, 0, d, 0, 0);
  const w = view.w; const h = view.h; const ch = L.chapterOf(s);
  const tt = settings.low ? 0 : t;
  art.drawBackdrop(ctx, w, h, s.phase === 'tutorial' ? 0 : ch, tt, s.phase === 'ending' ? 1 : 0);
  // 焚火と仲間
  art.drawCampfire(ctx, view.fire.x, view.fire.y, view.s * 0.9, tt);
  s.allies.forEach((a, i) => art.drawAlly(ctx, a, view.fire.x + (i - 1) * 16 * view.s + 4, view.fire.y, view.s * 0.7, tt));
  // 魔女
  art.drawWitch(ctx, view.witch.x, view.witch.y, view.s * 0.95, tt);
  if (ui.allyFlash) { ctx.save(); ctx.globalAlpha = Math.min(1, ui.allyFlash.t * 1.5) * 0.85; art.drawAlly(ctx, ui.allyFlash.id, view.witch.x + 34 * view.s, view.witch.y, view.s * 2.2, tt); ctx.restore(); }
  // 檻
  const b = s.battle;
  if (view.cage && b) art.drawCage(ctx, view.cage.x, view.cage.y, view.cage.s, b.chains, tt, b.ally, b.cage);
  // 敵
  const fb = s.battle || s.lastBattle;
  if (fb) for (const f of fb.foes) {
    if (f.dead) continue;
    const p = view.foes.find((x) => x.key === f.key); if (!p) continue;
    const lunge = ui.hitT[`atk${f.key}`] ? -18 * view.s : 0;
    art.drawFoe(ctx, f.id, p.x + lunge, p.y, p.s, tt, { hit: !!ui.hitT[f.key], k: f.key });
  }
  for (const p of sparks) { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.col; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); }
  ctx.globalAlpha = 1;
}

// ---------- タイトルの絵 ----------
const tctx = $('titleCv').getContext('2d');
function drawTitle() {
  const c = $('titleCv'); const d = view.dpr; const w = c.width / d; const h = c.height / d;
  tctx.setTransform(d, 0, 0, d, 0, 0);
  const tt = settings.low ? 0 : t;
  art.drawBackdrop(tctx, w, h, 0, tt, 0);
  const narrow = w < 560;
  // 右奥：太陽の鎖を引く影熊の輪郭
  tctx.save(); tctx.globalAlpha = 0.85; art.drawFoe(tctx, 'bear', w * (narrow ? 0.78 : 0.7), h * 0.9, h / (narrow ? 320 : 260), tt); tctx.restore();
  // 左1/3：朝の種を抱く魔女
  art.drawWitch(tctx, w * (narrow ? 0.36 : 0.22), h * (narrow ? 0.62 : 0.9), h / (narrow ? 300 : 220), tt);
  const g = tctx.createLinearGradient(0, 0, narrow ? 0 : w, narrow ? h : 0);
  g.addColorStop(narrow ? 0.45 : 0.5, 'rgba(21,16,12,0)'); g.addColorStop(1, 'rgba(21,16,12,.75)');
  tctx.fillStyle = g; tctx.fillRect(0, 0, w, h);
}

// ---------- 共有画像用（?og=1）：影熊の檻で、鎖を1本切った場面 ----------
function setupOg() {
  document.body.classList.add('og');
  s = L.newRun({ seed: 2026, tutorial: false });
  s.node = 6; s.allies = ['rine']; s.hp = 27; s.battle = null; L.enterNode(s);
  s.battle.chains = 1; s.battle.foes[0].hp = 22; s.events.length = 0;
  s.battle.hand = [{ uid: 'o1', id: 'spark' }, { uid: 'o2', id: 'lance' }, { uid: 'o3', id: 'ward' }, { uid: 'o4', id: 'tailwind', temp: true }, { uid: 'o5', id: 'sunshard' }];
  s.battle.energy = 3; ui.sel = null; ui.target = null;
  show('battle'); resize(); renderBattle(); banner('夜明けを盗んだ魔女の旅', '影熊の檻 ― 鎖はあと1本。倒すか、救うか', 99);
}

// ---------- 起動 ----------
document.body.classList.toggle('low', settings.low);
resize();
if (OG) setupOg(); else { show('title'); refreshTitle(); }
requestAnimationFrame(frame);
window.__dtw = { get s() { return s; }, set s(v) { s = v; }, L, route: () => { resize(); route(); }, ui, renderBattle };
