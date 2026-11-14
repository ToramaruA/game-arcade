import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../site/games/dawn-thief-witch/logic.js';

const count = (s) => { const b = s.battle; return b.draw.length + b.hand.length + b.discard.length + b.exhaust.length; };
// 導入を飛ばして、指定の地点の戦闘から始める
const at = (node, opt = {}) => { const s = L.newRun({ seed: 7, tutorial: false, ...opt }); while (s.node < node) { s.node += 1; } s.battle = null; L.enterNode(s); return s; };
const handOf = (s, ids) => { const b = s.battle; b.draw.push(...b.hand.splice(0)); b.hand = ids.map((id, i) => ({ uid: `H${i}`, id })); };

test('データ：カード24種（報酬21＋仲間3）、通常敵9種＋ボス3、3章15地点', () => {
  assert.equal(L.CARD_IDS.length, 24);
  assert.equal(L.CARD_IDS.filter((id) => L.CARDS[id].ally).length, 3);
  assert.equal(L.rewardPool(0).length, 14); assert.equal(L.rewardPool(1).length, 21);
  assert.equal(Object.values(L.ENEMIES).filter((e) => !e.boss).length, 9);
  assert.equal(Object.values(L.ENEMIES).filter((e) => e.boss).length, 3);
  assert.equal(L.NODES.length, 15);
  for (let c = 0; c < 3; c++) assert.deepEqual(L.NODES.filter((n) => n.ch === c).map((n) => n.type), ['battle', 'rescue', 'battle', 'rest', 'boss']);
  const ops = new Set(L.CARD_IDS.flatMap((id) => L.CARDS[id].fx.map((f) => f.op)));
  for (const op of ops) assert.ok(['damage', 'block', 'draw', 'weak', 'cleanse', 'retrieve', 'heal', 'energy'].includes(op));
});

test('練習：火花で攻撃→防壁→敵の攻撃を受ける→火花でとどめ、の2ターン。傷は戻り、報酬3枚から選ぶ', () => {
  const s = L.newRun({ seed: 3 });
  const b = s.battle;
  assert.equal(s.phase, 'tutorial'); assert.deepEqual(b.hand.map((c) => c.id), ['spark', 'ward']);
  assert.deepEqual(L.intentOf(s, b.foes[0]), { t: 'a', n: 6, hits: 1, total: 6, weak: false });
  L.playCard(s, b.hand[0].uid, 0); assert.equal(b.foes[0].hp, 6);
  L.playCard(s, b.hand[0].uid); assert.equal(b.block, 4);
  L.endTurn(s); assert.equal(s.hp, L.MAX_HP - 2, '6のうち4を防いで2受ける');
  assert.deepEqual(b.hand.map((c) => c.id), ['spark']);
  L.playCard(s, b.hand[0].uid, 0);
  assert.equal(s.phase, 'reward'); assert.equal(s.reward.options.length, 3); assert.equal(s.hp, L.MAX_HP, '練習の傷は戻る');
  L.chooseReward(s, null);
  assert.equal(s.phase, 'battle'); assert.equal(s.node, 0, '練習は地点数に含めない');
  assert.ok(!s.deck.some((c) => String(c.uid).startsWith('T')), '練習の札はデッキに入らない');
});

test('ターン：エネルギー3・5枚引く・防御は次のターンに持ち越さない。手札・山札・捨て札・除外の合計は変わらない', () => {
  const s = at(0); const b = s.battle;
  assert.equal(b.energy, 3); assert.equal(b.hand.length, 5); const n = count(s);
  const ward = b.hand.find((c) => c.id === 'ward') || (handOf(s, ['ward', 'spark', 'spark', 'ward', 'kindle']), b.hand[0]);
  L.playCard(s, ward.uid); assert.equal(b.block, 4); assert.equal(count(s), n);
  L.endTurn(s); assert.equal(b.block, 0, '敵の攻撃で減ったあと、次のターン開始で0'); assert.equal(count(s), n); assert.equal(b.energy, 3);
});

test('シャッフルは同じシードで同じ順番になる', () => {
  const a = at(0); const c = at(0);
  assert.deepEqual(a.battle.hand.map((x) => x.id + x.uid), c.battle.hand.map((x) => x.id + x.uid));
});

test('予告どおりに行動する：敵は左から順に、予告の数値で攻撃する', () => {
  const s = at(2); const b = s.battle; // 盾蛾(防御6)・枝狼(攻撃6)
  const it = b.foes.map((f) => L.intentOf(s, f));
  assert.deepEqual(it.map((x) => x.t), ['d', 'a']);
  handOf(s, ['kindle']); const hp = s.hp;
  L.endTurn(s);
  assert.equal(hp - s.hp, it[1].total, '予告の6がそのまま入る');
  assert.equal(b.foes[0].block, 6, '盾蛾は防御した');
  L.endTurn(s);
  assert.equal(b.foes[0].block, 0, '敵の防御は、その敵が次に行動する直前に消える');
});

test('弱体：敵の次の攻撃1行動の各打を2減らし、攻撃したら消える。重ねても一段階', () => {
  const s = at(5); const b = s.battle; // 針烏(3×2)・蝋兵(7)
  handOf(s, ['sleep']); L.playCard(s, 'H0');
  assert.deepEqual(b.foes.map((f) => f.weak), [1, 1]);
  const it = L.intentOf(s, b.foes[0]); assert.equal(it.n, 1); assert.equal(it.hits, 2);
  const hp = s.hp; L.endTurn(s);
  assert.equal(hp - s.hp, 1 * 2 + 5, '針烏 1×2、蝋兵 5');
  assert.deepEqual(b.foes.map((f) => f.weak), [0, 0]);
});

test('救出：常設の鎖切り（2エネルギー・1ターン1回）を2回で救出、次のターンに仲間の札が手札へ。勝つと恒久デッキに1枚だけ', () => {
  const s = at(1); const b = s.battle; // 檻番 HP18 + 風読みリネ
  assert.equal(b.chains, 2);
  assert.ok(L.cutChain(s).ok); assert.equal(b.chains, 1); assert.equal(b.energy, 1);
  assert.equal(L.cutChain(s).ok, false, '1ターン1回');
  L.endTurn(s);
  L.cutChain(s); assert.equal(b.cage, 'freed');
  assert.ok(!b.hand.some((c) => c.id === 'tailwind'), '救ったターンにはまだ来ない');
  L.endTurn(s);
  assert.ok(b.hand.some((c) => c.id === 'tailwind' && c.temp), '次のターン開始時に追い風が手札へ');
  // 勝つ
  const deck0 = s.deck.length;
  b.foes[0].hp = 1; handOf(s, ['spark']); L.playCard(s, 'H0', 0);
  assert.equal(s.phase, 'reward'); assert.deepEqual(s.allies, ['rine']);
  assert.equal(s.deck.length, deck0 + 1); assert.equal(s.deck.filter((c) => c.id === 'tailwind').length, 1, '恒久デッキに1枚だけ');
});

test('救出前に敵を全滅させると檻は運び去られる。使う前の予測で分かる（警告用）', () => {
  const s = at(1); const b = s.battle;
  b.foes[0].hp = 5; handOf(s, ['spark']);
  const p = L.preview(s, 'H0', 0);
  assert.ok(p.ok && p.cageLost, '予測で「倒すと救出できない」と分かる');
  assert.equal(b.foes[0].hp, 5, '予測は状態を変えない');
  L.playCard(s, 'H0', 0);
  assert.deepEqual(s.allies, []); assert.equal(s.phase, 'reward', '救出なしでも進める');
});

test('予測と実際の結果は同じ（同じ関数）', () => {
  const s = at(6); handOf(s, ['lance', 'spark', 'ward']);
  const p = L.preview(s, 'H0', 0); L.playCard(s, 'H0', 0);
  assert.equal(s.battle.foes[0].hp, p.foes[0].hp); assert.equal(s.battle.energy, p.energy);
});

test('カードを使っている間に引いても、その札自身は引き直されない。除外札は戻らない', () => {
  const s = at(0); const b = s.battle;
  b.draw = []; b.discard = []; handOf(s, ['kindle']); b.draw = [];
  L.playCard(s, 'H0');
  assert.equal(b.hand.length, 0, '山札も捨て札も空なら引けない（焚き付け自身は解決中で、まだ捨て札にない）');
  assert.equal(b.exhaust.length, 1);
});

test('回復は上限36。使えない操作は何も変えない（エネルギー・乱数・ターン）', () => {
  const s = at(0); const b = s.battle;
  s.hp = 34; handOf(s, ['dew', 'lance', 'lance', 'lance']);
  L.playCard(s, 'H0'); assert.equal(s.hp, 36);
  b.energy = 1; const before = JSON.stringify(s.battle) + s.rng;
  assert.equal(L.playCard(s, 'H1', 0).ok, false);
  assert.equal(L.playCard(s, 'H2', 99).ok, false);
  assert.equal(JSON.stringify(s.battle) + s.rng, before);
});

test('二連火・追い火・種の光・残り火・太陽片の効果', () => {
  const s = at(5); const b = s.battle; const f = b.foes[1]; // 蝋兵 HP14
  handOf(s, ['twin', 'chase', 'seedlight', 'afterglow', 'sunshard']);
  L.playCard(s, 'H0', 1); assert.equal(f.hp, 8, '二連火 3×2');
  L.playCard(s, 'H1', 1); assert.equal(f.hp, 3, '追い火：半分より多いので5');
  L.playCard(s, 'H2'); assert.equal(b.energy, 2, '種の光でエネルギー+1');
  L.playCard(s, 'H3'); assert.ok(b.hand.some((c) => c.uid === 'H1'), '残り火で捨て札の追い火が戻る');
  L.playCard(s, 'H1', 1); assert.ok(f.dead, '追い火：半分以下なら9');
  s.allies = ['rine', 'toma']; b.energy = 2; b.foes[0].hp = 99; b.foes[0].maxHp = 99;
  L.playCard(s, 'H4', 0); assert.equal(b.foes[0].hp, 99 - 14, '太陽片 10＋救った2人×2');
});

test('休息：HP10回復か、カード1枚除去のどちらか（残り5枚以下になる除去は不可）', () => {
  const s = at(3); assert.equal(s.phase, 'rest');
  s.hp = 20; L.rest(s, 'heal'); assert.equal(s.hp, 30); assert.equal(s.node, 4);
  const t = at(3); const n = t.deck.length; L.rest(t, 'remove', t.deck[0].uid); assert.equal(t.deck.length, n - 1);
  const u = at(3); u.deck = u.deck.slice(0, 5); assert.equal(L.rest(u, 'remove', u.deck[0].uid), false);
});

test('負けたら：この戦闘をやり直す（戦闘入口に完全に戻る）／章の入口へ', () => {
  const s = at(4); const snapHp = s.hp; const hand0 = s.battle.hand.map((c) => c.uid).join();
  s.hp = 1; L.endTurn(s);
  assert.equal(s.phase, 'dead'); assert.equal(s.death.by, '門番の鹿');
  L.retryBattle(s);
  assert.equal(s.phase, 'battle'); assert.equal(s.hp, snapHp); assert.equal(s.battle.hand.map((c) => c.uid).join(), hand0, '同じ手札（乱数も戻る）');
  s.hp = 1; L.endTurn(s); L.retryChapter(s);
  assert.equal(s.node, 0); assert.equal(s.phase, 'battle');
});

test('保存と読み込み：往復でき、壊れたデータでも落ちない', () => {
  const s = at(6); L.cutChain(s);
  const t = L.deserialize(L.serialize(s));
  assert.equal(t.battle.chains, 1); assert.equal(t.node, 6);
  assert.equal(L.deserialize('{oops'), null); assert.equal(L.deserialize('{"v":2}'), null);
  assert.deepEqual(L.parseRecord('x'), L.newRecord());
});

test('全15地点：救出なし・全員救出・報酬を取らない旅、どれでも最後まで行ける（自動操縦で確認）', () => {
  const clear = (opt, pol) => { for (let seed = 1; seed <= 60; seed++) { const s = L.newRun({ seed, ...opt }); L.botRun(s, pol); if (s.phase === 'ending') return s; } return null; };
  const none = clear({}, { rescue: false }); assert.ok(none && none.allies.length === 0, '仲間0人でクリアできる');
  const all = clear({}, { rescue: true }); assert.ok(all && all.allies.length === 3, '3人救出でクリアできる');
  assert.ok(clear({}, { rescue: false, skipRewards: true }), 'カードを取らなくてもクリアできる道がある');
  assert.ok(clear({ hard: true }, { rescue: true }), '長い夜もクリアできる');
  assert.match(L.shareText(all), /朝を取り戻した。同行者3人/);
  assert.equal(L.topCards(all).length, 3);
});

test('長い夜：敵HPは1.15倍（切り上げ）、攻撃+1', () => {
  const s = at(0, { hard: true });
  assert.equal(s.battle.foes[0].maxHp, Math.ceil(12 * 1.15));
  assert.equal(L.intentOf(s, s.battle.foes[0]).n, 7);
});
