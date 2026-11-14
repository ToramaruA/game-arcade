// 夜明けを盗んだ魔女の旅 — ルール（DOM を触らない ES module）
// 状態はすべて JSON にできる素のオブジェクト。乱数はシード付きで、状態の中に持つ（保存・再挑戦で同じ結果になる）。
import {
  CARDS, ENEMIES, NODES, CHAPTERS, ALLIES, STARTER_DECKS, TUTORIAL_NODE, FIRST_REWARD, MAX_HP, ENERGY, DRAW, HAND_MAX,
  CHAIN_COST, REST_HEAL, CHAPTER_HEAL, MIN_DECK_FOR_REMOVE, rewardPool, isAttack, CARD_IDS,
} from './data.js';

export * from './data.js';

// ---------- 乱数 ----------
export function rand(s) {
  // mulberry32
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(s, arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const ev = (s, type, data = {}) => { s.events.push({ type, ...data }); };

// ---------- 旅の開始 ----------
export function newRun({ seed = 1, starter = 'ember', hard = false, tutorial = true } = {}) {
  const s = {
    v: 1, seed: seed >>> 0, rng: seed >>> 0, hard: !!hard, starter,
    hp: MAX_HP, deck: [], nextUid: 1, node: 0, allies: [], usage: {}, firstReward: true,
    phase: 'map', battle: null, reward: null, chapterMsg: null, death: null,
    snapBattle: null, snapChapter: null, events: [], stats: { damage: 0, taken: 0, turns: 0 },
  };
  const deck = STARTER_DECKS[starter] || STARTER_DECKS.ember;
  for (const [id, n] of Object.entries(deck.cards)) for (let i = 0; i < n; i++) s.deck.push({ uid: s.nextUid++, id });
  if (tutorial) { s.phase = 'tutorial'; startBattle(s, TUTORIAL_NODE, true); }
  else enterNode(s);
  return s;
}

export const currentNode = (s) => NODES[s.node];
export const chapterOf = (s) => (NODES[s.node] || NODES[NODES.length - 1]).ch;

// 地点に入る。章の最初の地点では「章の入口」を保存する
export function enterNode(s) {
  const nd = NODES[s.node];
  if (!nd) { s.phase = 'ending'; ev(s, 'ending'); return; }
  if (s.node % 5 === 0) { s.snapChapter = snapshot(s); s.chapterMsg = CHAPTERS[nd.ch]; }
  if (nd.type === 'rest') { s.phase = 'rest'; s.battle = null; ev(s, 'rest'); return; }
  startBattle(s, nd, false);
}

function snapshot(s) { const c = clone({ ...s, snapBattle: null, snapChapter: null, events: [] }); return c; }
function restore(s, snap) {
  const keepB = s.snapBattle; const keepC = s.snapChapter;
  for (const k of Object.keys(s)) delete s[k];
  Object.assign(s, clone(snap));
  s.snapBattle = keepB; s.snapChapter = keepC; s.events = [];
}

function makeFoe(s, f, i, tutorial = false) {
  const def = ENEMIES[f.id];
  const hp = s.hard && !tutorial ? Math.ceil(f.hp * 1.15) : f.hp;
  return { key: i, id: f.id, name: def.name, hp, maxHp: hp, block: 0, weak: 0, ci: 0, dead: false, boss: !!def.boss };
}

function startBattle(s, nd, tutorial) {
  if (!tutorial) s.snapBattle = snapshot(s);
  s.phase = tutorial ? 'tutorial' : 'battle';
  const b = {
    tutorial, type: nd.type, name: nd.name, foes: nd.foes.map((f, i) => makeFoe(s, f, i, tutorial)),
    draw: [], hand: [], discard: [], exhaust: [], energy: ENERGY, block: 0, weak: 0, turn: 0,
    ally: nd.ally || null, chains: nd.ally ? 2 : 0, cage: nd.ally ? 'locked' : 'none', cutThisTurn: false, allyCardPending: false,
    nextTemp: 1, over: false,
  };
  s.battle = b;
  if (tutorial) {
    // 操作導入：火花1枚だけ
    b.hand = [{ uid: 'T1', id: 'spark' }];
    b.turn = 1;
  } else {
    b.draw = shuffle(s, s.deck.map((c) => ({ ...c })));
    startTurn(s);
  }
  ev(s, 'battle', { name: nd.name, type: nd.type });
}

function drawCards(s, n) {
  const b = s.battle; let got = 0;
  for (let i = 0; i < n; i++) {
    if (b.hand.length >= HAND_MAX) break;
    if (!b.draw.length) {
      if (!b.discard.length) break;
      b.draw = shuffle(s, b.discard.splice(0)); ev(s, 'reshuffle');
    }
    b.hand.push(b.draw.pop()); got++;
  }
  return got;
}

export function startTurn(s) {
  const b = s.battle;
  b.turn += 1; b.energy = ENERGY; b.block = 0; b.cutThisTurn = false;
  drawCards(s, DRAW);
  if (b.allyCardPending) {
    b.allyCardPending = false;
    const id = ALLIES[b.ally].card;
    if (b.hand.length < HAND_MAX) { b.hand.push({ uid: `A${b.nextTemp++}`, id, temp: true }); ev(s, 'allyCard', { id }); }
  }
  s.stats.turns += 1;
  ev(s, 'turn', { turn: b.turn });
}

// ---------- 予告 ----------
export function intentOf(s, foe) {
  const act = ENEMIES[foe.id].cycle[foe.ci % ENEMIES[foe.id].cycle.length];
  if (act.t === 'a') {
    const per = Math.max(0, act.n + (s.hard ? 1 : 0) - (foe.weak ? 2 : 0));
    return { t: 'a', n: per, hits: act.hits, total: per * act.hits, weak: !!foe.weak };
  }
  return { ...act };
}

// ---------- カード ----------
const rescuedCount = (s) => s.allies.length + (s.battle && s.battle.cage === 'freed' && !s.allies.includes(s.battle.ally) ? 1 : 0);
export const living = (s) => s.battle.foes.filter((f) => !f.dead);

// このカードの1打あたりのダメージ（予告・プレビュー・実行で共通）
export function hitDamage(s, fx, foe) {
  let n = fx.n;
  if (fx.perRescued) n += fx.perRescued * rescuedCount(s);
  if (fx.low && foe && foe.hp * 2 <= foe.maxHp) n = fx.low;
  if (s.battle.weak) n -= 2;
  return Math.max(0, n);
}

function damageFoe(s, foe, n) {
  const b = s.battle;
  const blocked = Math.min(foe.block, n); foe.block -= blocked; const dmg = n - blocked;
  foe.hp = Math.max(0, foe.hp - dmg); s.stats.damage += dmg;
  ev(s, 'hit', { key: foe.key, dmg, blocked });
  if (foe.hp <= 0 && !foe.dead) {
    foe.dead = true; ev(s, 'kill', { key: foe.key, name: foe.name });
    if (!b.foes.some((f) => !f.dead)) {
      if (b.cage === 'locked') { b.cage = 'lost'; ev(s, 'cageLost', { ally: b.ally }); }
      b.over = true;
    }
  }
}

export function needsTarget(id) { return CARDS[id].target === 'enemy'; }

// 使えるかどうか（理由つき）。使えない場合、状態は一切変えない
export function canPlay(s, uid, targetKey) {
  const b = s.battle; if (!b || b.over || (s.phase !== 'battle' && s.phase !== 'tutorial')) return { ok: false, reason: '戦闘中ではない' };
  const c = b.hand.find((x) => x.uid === uid); if (!c) return { ok: false, reason: '手札にない' };
  const def = CARDS[c.id];
  if (def.cost > b.energy) return { ok: false, reason: 'エネルギーが足りない' };
  if (def.target === 'enemy') {
    const f = b.foes.find((x) => x.key === targetKey);
    if (!f || f.dead) return { ok: false, reason: '対象の敵を選ぶ' };
  }
  return { ok: true };
}

export function playCard(s, uid, targetKey) {
  const chk = canPlay(s, uid, targetKey); if (!chk.ok) return chk;
  const b = s.battle;
  const idx = b.hand.findIndex((x) => x.uid === uid); const c = b.hand.splice(idx, 1)[0]; // 解決が終わるまでどこにも置かない
  const def = CARDS[c.id];
  b.energy -= def.cost;
  s.usage[c.id] = (s.usage[c.id] || 0) + 1;
  ev(s, 'play', { id: c.id, target: targetKey });
  const attack = isAttack(c.id);
  for (const fx of def.fx) {
    if (b.over) break;
    switch (fx.op) {
      case 'damage': {
        const targets = fx.all ? living(s) : [b.foes.find((x) => x.key === targetKey)];
        for (let h = 0; h < (fx.hits || 1); h++) for (const f of targets) if (!f.dead && !b.over) damageFoe(s, f, hitDamage(s, fx, f));
        break;
      }
      case 'block': b.block += fx.n; ev(s, 'block', { n: fx.n }); break;
      case 'draw': drawCards(s, fx.n); break;
      case 'weak': for (const f of living(s)) f.weak = 1; ev(s, 'weak'); break;
      case 'cleanse': b.weak = 0; break;
      case 'heal': { const before = s.hp; s.hp = Math.min(MAX_HP, s.hp + fx.n); ev(s, 'heal', { n: s.hp - before }); break; }
      case 'energy': b.energy += fx.n; break;
      case 'retrieve': {
        for (let i = b.discard.length - 1; i >= 0; i--) {
          if (isAttack(b.discard[i].id)) { if (b.hand.length < HAND_MAX) { const r = b.discard.splice(i, 1)[0]; b.hand.push(r); ev(s, 'retrieve', { id: r.id }); } break; }
        }
        break;
      }
      default: break;
    }
  }
  if (attack) b.weak = 0; // 弱体は攻撃1行動で消える
  if (def.exhaust || c.temp) b.exhaust.push(c); else b.discard.push(c);
  if (b.over) finishBattle(s);
  return { ok: true };
}

// 使った結果の予測（実行と同じ関数を、写しの状態で走らせる）
export function preview(s, uid, targetKey) {
  const t = clone({ ...s, snapBattle: null, snapChapter: null, events: [] });
  const r = playCard(t, uid, targetKey);
  if (!r.ok) return { ok: false, reason: r.reason };
  // 勝って戦闘が閉じても読めるよう、解決直後の戦闘の写しを残す
  const b = t.lastBattle || t.battle || {};
  return {
    ok: true, hp: t.hp, block: b.block ?? 0, energy: b.energy ?? 0,
    foes: (b.foes || []).map((f) => ({ key: f.key, hp: f.hp, block: f.block, dead: f.dead, weak: f.weak })),
    cageLost: t.events.some((e) => e.type === 'cageLost'),
    win: t.events.some((e) => e.type === 'win'),
  };
}

// ---------- 鎖を切る（常設・2エネルギー・1ターン1回） ----------
export function canCut(s) {
  const b = s.battle;
  if (!b || b.over || s.phase !== 'battle') return { ok: false, reason: '' };
  if (b.cage !== 'locked') return { ok: false, reason: '檻はない' };
  if (b.cutThisTurn) return { ok: false, reason: 'このターンはもう切った' };
  if (b.energy < CHAIN_COST) return { ok: false, reason: 'エネルギーが足りない' };
  return { ok: true };
}
export function cutChain(s) {
  const chk = canCut(s); if (!chk.ok) return chk;
  const b = s.battle; b.energy -= CHAIN_COST; b.chains -= 1; b.cutThisTurn = true;
  ev(s, 'cut', { left: b.chains });
  if (b.chains <= 0) { b.cage = 'freed'; b.allyCardPending = true; ev(s, 'rescue', { ally: b.ally }); }
  return { ok: true };
}

// ---------- ターン終了と敵の行動 ----------
export function endTurn(s) {
  const b = s.battle; if (!b || b.over || s.phase !== 'battle') return false;
  b.discard.push(...b.hand.splice(0));
  for (const f of b.foes) {
    if (f.dead) continue;
    f.block = 0; // 敵の防御は、その敵が次に行動する直前に消える
    const act = intentOf(s, f);
    if (act.t === 'a') {
      for (let h = 0; h < act.hits; h++) {
        const blocked = Math.min(b.block, act.n); b.block -= blocked; const dmg = act.n - blocked;
        s.hp = Math.max(0, s.hp - dmg); s.stats.taken += dmg;
        ev(s, 'hurt', { key: f.key, dmg, blocked });
        if (s.hp <= 0) break;
      }
      f.weak = 0;
    } else if (act.t === 'd') { f.block += act.n; ev(s, 'foeBlock', { key: f.key, n: act.n }); } else if (act.t === 'w') { b.weak = 1; ev(s, 'weakened', { key: f.key }); }
    f.ci += 1;
    if (s.hp <= 0) {
      s.phase = 'dead'; s.death = { by: f.name, dmg: act.total ?? 0, node: s.node };
      ev(s, 'dead', s.death); return true;
    }
  }
  startTurn(s);
  return true;
}

// ---------- 戦闘の終わり ----------
function finishBattle(s) {
  const b = s.battle;
  s.lastBattle = { foes: b.foes, block: b.block, energy: b.energy, name: b.name };
  if (b.tutorial) {
    s.phase = 'reward'; s.reward = { options: shuffleRewards(s, 0), from: 'tutorial' };
    ev(s, 'win', { tutorial: true }); return;
  }
  // 仲間：戦闘限定の札はすべての札置き場から消え、恒久デッキへ1枚だけ加わる（重複しない）
  let newAlly = null;
  if (b.cage === 'freed' && b.ally && !s.allies.includes(b.ally)) {
    s.allies.push(b.ally); newAlly = b.ally;
    s.deck.push({ uid: s.nextUid++, id: ALLIES[b.ally].card });
  }
  const nd = NODES[s.node];
  ev(s, 'win', { ally: newAlly, cageLost: b.cage === 'lost', boss: nd.type === 'boss' });
  s.battle = null;
  if (nd.type === 'boss') {
    if (s.node === NODES.length - 1) { s.phase = 'ending'; ev(s, 'ending'); return; }
    s.hp = Math.min(MAX_HP, s.hp + CHAPTER_HEAL);
  }
  s.phase = 'reward';
  s.reward = { options: s.firstReward ? [...FIRST_REWARD] : shuffleRewards(s, nd.ch), ally: newAlly, boss: nd.type === 'boss' };
  s.firstReward = false;
}

function shuffleRewards(s, ch) {
  const pool = shuffle(s, rewardPool(ch).slice());
  return pool.slice(0, 3);
}

export function chooseReward(s, id) {
  if (s.phase !== 'reward' || !s.reward) return false;
  if (id && !s.reward.options.includes(id)) return false;
  if (id) { s.deck.push({ uid: s.nextUid++, id }); ev(s, 'gain', { id }); }
  const fromTutorial = s.reward.from === 'tutorial';
  s.reward = null; s.battle = null;
  if (!fromTutorial) s.node += 1;
  enterNode(s);
  return true;
}

// 休息：HP10回復 か カード1枚除去（両方は不可）
export function canRemove(s) { return s.deck.length >= MIN_DECK_FOR_REMOVE; }
export function rest(s, choice, uid) {
  if (s.phase !== 'rest') return false;
  if (choice === 'heal') { const b = s.hp; s.hp = Math.min(MAX_HP, s.hp + REST_HEAL); ev(s, 'heal', { n: s.hp - b }); }
  else if (choice === 'remove') {
    if (!canRemove(s)) return false;
    const i = s.deck.findIndex((c) => c.uid === uid); if (i < 0) return false;
    const [c] = s.deck.splice(i, 1); ev(s, 'removed', { id: c.id });
  } else return false;
  s.node += 1; enterNode(s);
  return true;
}

// ---------- 再挑戦 ----------
export function retryBattle(s) { if (!s.snapBattle) return false; const snap = s.snapBattle; restore(s, snap); startBattle(s, NODES[s.node], false); return true; }
export function retryChapter(s) { if (!s.snapChapter) return false; const snap = s.snapChapter; restore(s, snap); s.snapBattle = null; enterNode(s); return true; }
export function skipTutorial(s) { if (s.phase !== 'tutorial' && !(s.phase === 'reward' && s.reward?.from === 'tutorial')) return false; s.battle = null; s.reward = null; enterNode(s); return true; }

// ---------- 結果 ----------
export function topCards(s, n = 3) {
  return Object.entries(s.usage).sort((a, b) => b[1] - a[1] || CARDS[a[0]].no - CARDS[b[0]].no).slice(0, n).map(([id, c]) => ({ id, count: c }));
}
export function shareText(s) {
  const names = s.allies.map((a) => ALLIES[a].name).join('・');
  return `夜明けを盗んだ魔女の旅：朝を取り戻した。同行者${s.allies.length}人${names ? `（${names}）` : ''}、残りHP${s.hp}${s.hard ? '・長い夜' : ''}。旅の札は${topCards(s).map((c) => CARDS[c.id].name).join('・')}。`;
}

// ---------- 保存 ----------
export function serialize(s) { return JSON.stringify({ ...s, events: [] }); }
export function deserialize(str) {
  try {
    const o = JSON.parse(str);
    if (!o || o.v !== 1 || !Array.isArray(o.deck) || typeof o.hp !== 'number' || !o.phase) return null;
    if (!o.deck.every((c) => c && CARDS[c.id])) return null;
    o.events = [];
    return o;
  } catch { return null; }
}

// 図鑑・記録（旅とは別に残る）
export function newRecord() { return { seen: [], clears: 0, bestAllies: 0, hardClears: 0, tutorialDone: false }; }
export function parseRecord(str) {
  try { const o = JSON.parse(str); if (!o || !Array.isArray(o.seen)) return newRecord(); return { ...newRecord(), ...o, seen: o.seen.filter((id) => CARDS[id]) }; } catch { return newRecord(); }
}
export function noteSeen(rec, ids) { for (const id of ids) if (CARDS[id] && !rec.seen.includes(id)) rec.seen.push(id); }
export function recordClear(rec, s) {
  rec.clears += 1; if (s.hard) rec.hardClears += 1; rec.bestAllies = Math.max(rec.bestAllies, s.allies.length);
}

// ---------- 自動操縦（テストと攻略確認用） ----------
// policy.rescue: 救出を狙うか。単純な欲張り：予告の攻撃を防ぎつつ、残りで攻撃。救出狙いなら鎖を優先
export function botTurn(s, policy = {}) {
  const b = s.battle;
  const incoming = () => living(s).reduce((a, f) => { const it = intentOf(s, f); return a + (it.t === 'a' ? it.total : 0); }, 0);
  let guard = 0;
  const rescueAlive = () => b.cage === 'locked';
  while (!b.over && guard++ < 30) {
    // 救出：敵を倒し切る前に鎖を切る
    if (policy.rescue && rescueAlive() && canCut(s).ok) { cutChain(s); continue; }
    const hand = b.hand.slice();
    const playable = hand.filter((c) => CARDS[c.id].cost <= b.energy);
    if (!playable.length) break;
    const need = Math.max(0, incoming() - b.block);
    // 0コストの補助を先に
    const free = playable.find((c) => CARDS[c.id].cost === 0 && !isAttack(c.id) && !(c.id === 'mist' && need <= 0));
    if (free) { playCard(s, free.uid); continue; }
    const target = living(s).slice().sort((x, y) => x.hp - y.hp)[0];
    const atks = playable.filter((c) => isAttack(c.id));
    const defs = playable.filter((c) => !isAttack(c.id) && CARDS[c.id].fx.some((f) => f.op === 'block'));
    const others = playable.filter((c) => !isAttack(c.id) && !CARDS[c.id].fx.some((f) => f.op === 'block'));
    // 救出前に倒し切りそうなら攻撃を控える
    const wouldKill = (c) => { const p = preview(s, c.uid, target?.key); return p.ok && p.cageLost; };
    if (need >= 5 && defs.length) { playCard(s, defs.sort((x, y) => CARDS[y.id].fx[0].n - CARDS[x.id].fx[0].n)[0].uid); continue; }
    const okAtk = atks.filter((c) => !(policy.rescue && rescueAlive() && wouldKill(c)));
    if (okAtk.length && target) {
      const best = okAtk.sort((x, y) => (CARDS[y.id].fx[0].n / Math.max(1, CARDS[y.id].cost)) - (CARDS[x.id].fx[0].n / Math.max(1, CARDS[x.id].cost)))[0];
      playCard(s, best.uid, CARDS[best.id].target === 'enemy' ? target.key : undefined); continue;
    }
    if (others.length) { playCard(s, others[0].uid); continue; }
    if (defs.length && need > 0) { playCard(s, defs[0].uid); continue; }
    break;
  }
  if (!b.over && s.phase === 'battle') endTurn(s);
}

// 旅を最後まで自動で進める（テスト用）。返り値：最終状態
export function botRun(s, policy = {}) {
  let guard = 0;
  while (guard++ < 5000) {
    s.events.length = 0;
    if (s.phase === 'tutorial') { const c = s.battle.hand[0]; playCard(s, c.uid, s.battle.foes[0].key); continue; }
    if (s.phase === 'battle') { botTurn(s, policy); continue; }
    if (s.phase === 'reward') { const pick = policy.skipRewards ? null : pickReward(s); chooseReward(s, pick); continue; }
    if (s.phase === 'rest') { if (s.hp <= MAX_HP - 6 || !canRemove(s)) rest(s, 'heal'); else { const w = s.deck.find((c) => c.id === 'kindle') || s.deck.find((c) => c.id === 'spark'); rest(s, 'remove', w.uid); } continue; }
    break;
  }
  return s;
}
function pickReward(s) {
  const pref = ['lance', 'torch', 'armorfire', 'ashshield', 'rain', 'sunshard', 'ring', 'chase', 'ember', 'twin', 'keeper', 'nightwalk', 'seedlight', 'sleep'];
  return pref.find((id) => s.reward.options.includes(id)) || null;
}

export { CARD_IDS as ALL_CARDS };
