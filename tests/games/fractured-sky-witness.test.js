// 空が割れた日の証人（試作：第1章・第3章）のルールのテスト
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG, newGame, visit, advance, present, giveUp, choose, choiceOptions, siteList, sceneLines, restoreChapter,
  endingOutlook, canVisit, chapterData, toTrial,
} from '../../site/games/fractured-sky-witness/logic.js';
import { CHAPTERS, PLAYABLE, EVIDENCE } from '../../site/games/fractured-sky-witness/story.js';
import { run } from '../autoplay/fractured-sky-witness.mjs';

const clone = (s) => structuredClone(s);

// 章のはじめから、指定の場所を調べて審理に入る
function investigate(s, sites) {
  for (const id of sites) {
    if (s.phase === 'intro' && !(s.ch === 1 && !s.visited.length)) advance(s);
    const r = visit(s, id);
    assert.ok(r.ok, `${id}: ${r.why}`);
    advance(s);
  }
  assert.equal(s.phase, 'trial');
}
const toCh3 = (s) => { advance(s); assert.equal(s.phase, 'bridge'); advance(s); assert.equal(s.ch, 3); assert.equal(s.phase, 'intro'); };

function ch1(s, choice, { prove = 'p1a' } = {}) {
  investigate(s, prove === 'p1a' ? ['plaza', 'tower', 'roof'] : ['plaza', 'roof', 'atelier']);
  if (prove === 'p1a') assert.ok(present(s, 't1a', 'e1', 'e2').correct);
  else if (prove === 'p1b') assert.ok(present(s, 't1b', 'e3', 'e4').correct);
  else giveUp(s);
  advance(s);
  assert.equal(choose(s, choice).ok, true);
  toCh3(s);
}
function ch3(s, choice, { prove = 'p3a' } = {}) {
  investigate(s, prove === 'p3b' ? ['court', 'bridge', 'desk'] : ['desk', 'belfry', 'court']);
  if (prove === 'p3a') assert.ok(present(s, 't3a', 'e9', 'e10').correct);
  else if (prove === 'p3b') assert.ok(present(s, 't3b', 'e11', 'e12').correct);
  else giveUp(s);
  advance(s);
  assert.equal(choose(s, choice).ok, true);
  advance(s);
  assert.equal(s.phase, 'end');
}
const outlook = (s) => Object.fromEntries(endingOutlook(s).map((e) => [e.id, e.status]));

test('文章：1場面4表示まで、1表示80字以内', () => {
  const scenes = [];
  for (const c of CHAPTERS) {
    if (c.intro) scenes.push([...c.intro, c.introGuide ? Object.values(c.introGuide)[0] : null].filter(Boolean));
    if (c.introGuide) for (const g of Object.values(c.introGuide)) assert.ok(g.text.length <= 80);
    if (c.bridge) scenes.push(c.bridge);
    for (const site of c.sites || []) scenes.push(site.lines);
    for (const p of c.pairs || []) scenes.push(p.proven);
    if (c.unproven) scenes.push(c.unproven);
    if (c.after) {
      for (const [k, v] of Object.entries(c.after)) {
        if (k === 'broke') continue;
        const groups = Array.isArray(v) ? [v] : Object.values(v);
        for (const g of groups) scenes.push(k === 'P' && c.after.broke ? [...g, c.after.broke] : g);
      }
    }
  }
  for (const sc of scenes) {
    assert.ok(sc.length >= 1 && sc.length <= 4, `場面の表示数 ${sc.length}: ${sc[0]?.text}`);
    for (const l of sc) assert.ok(l.text.length <= 80, `80字を超える: ${l.text}`);
  }
});

test('各章：4か所のうちどの3か所を選んでも、正しい組が必ず1つだけ揃う', () => {
  for (const no of PLAYABLE) {
    const c = chapterData(no);
    assert.equal(c.sites.length, 4);
    assert.equal(c.pairs.length, 2);
    const all = c.sites.map((x) => x.ev);
    const used = c.pairs.flatMap((p) => p.evs);
    assert.deepEqual([...used].sort(), [...all].sort(), '4証拠が2組に分かれている');
    for (let skip = 0; skip < 4; skip++) {
      const have = all.filter((_, i) => i !== skip);
      const full = c.pairs.filter((p) => p.evs.every((e) => have.includes(e)));
      assert.equal(full.length, 1, `第${no}章 ${have.join(',')}`);
    }
  }
});

test('何もしないと進まない', () => {
  const s = newGame();
  assert.equal(s.phase, 'intro');
  assert.equal(s.actionsLeft, CONFIG.actions);
  assert.deepEqual(s.evidence, []);
});

test('第1章の最初は光るかけら(e1)から。調査は3回、同じ場所には戻れない', () => {
  const s = newGame();
  assert.equal(visit(s, 'tower').ok, false);
  assert.equal(visit(s, 'plaza').ev, 'e1');
  assert.equal(s.actionsLeft, 2);
  advance(s);
  assert.equal(visit(s, 'plaza').ok, false);
  visit(s, 'tower'); advance(s);
  visit(s, 'roof'); advance(s);
  assert.equal(s.phase, 'trial');
  assert.equal(canVisit(s, 'atelier').ok, false);
  assert.equal(toTrial(s).ok, false);
});

test('審理：入手前の証拠・同じ証拠の二重使用は拒否し、試行を減らさない', () => {
  const s = newGame();
  investigate(s, ['plaza', 'tower', 'roof']);
  assert.equal(present(s, 't1b', 'e3', 'e4').ok, false); // e4 は持っていない
  assert.equal(present(s, 't1a', 'e1', 'e1').ok, false);
  assert.equal(present(s, 't1a', 'e1', null).ok, false);
  assert.equal(s.attemptsLeft, CONFIG.attempts);
});

test('審理：誤りは理由を返して試行を1減らす。2回誤ると未立証で進み、保留しか選べない', () => {
  const s = newGame();
  investigate(s, ['plaza', 'tower', 'roof']);
  const r1 = present(s, 't1b', 'e1', 'e2');
  assert.equal(r1.correct, false);
  assert.match(r1.why, /食い違わない/);
  const r2 = present(s, 't1a', 'e1', 'e3');
  assert.match(r2.why, /別々/);
  assert.equal(s.phase, 'unproven');
  advance(s);
  const opts = choiceOptions(s);
  assert.deepEqual(opts.filter((o) => o.allowed).map((o) => o.id), ['H']);
  assert.equal(choose(s, 'P').ok, false);
  assert.equal(choose(s, 'H').ok, true);
  assert.equal(s.proofs[1], undefined);
  assert.deepEqual(sceneLines(s), chapterData(1).after.none);
});

test('調査と提示は別に数える（誤っても調査は減らない）', () => {
  const s = newGame();
  investigate(s, ['plaza', 'tower', 'atelier']);
  present(s, 't1b', 'e1', 'e4');
  assert.equal(s.actionsLeft, 0);
  assert.equal(s.attemptsLeft, 1);
  assert.ok(present(s, 't1a', 'e1', 'e2').correct);
});

test('どちらの正しい組でも、その章の証明が得られ、別の秘密が分かる', () => {
  const a = newGame(); investigate(a, ['plaza', 'tower', 'roof']); present(a, 't1a', 'e2', 'e1');
  const b = newGame(); investigate(b, ['plaza', 'roof', 'atelier']); present(b, 't1b', 'e4', 'e3');
  assert.equal(a.proofs[1], 'S'); assert.equal(b.proofs[1], 'S');
  assert.deepEqual(a.secrets, ['nem1']); assert.deepEqual(b.secrets, ['ol1']);
});

test('公開/約束/保留：画面の予告と実際の判定が一致する（協力鍵の消失・約束破り）', () => {
  const s = newGame();
  ch1(s, 'Q');
  assert.equal(s.coop.length, 1);
  assert.deepEqual(s.promises.map((p) => p.to), ['nem']);
  investigate(s, ['desk', 'belfry', 'court']);
  present(s, 't3a', 'e9', 'e10'); advance(s);
  const p = choiceOptions(s).find((o) => o.id === 'P');
  assert.ok(p.effects.includes('協力鍵 1→0'));
  assert.ok(p.effects.some((e) => e.includes('ネムとの約束を破る')));
  assert.ok(p.effects.includes('市民の支持旗 0→1'));
  const q = choiceOptions(s).find((o) => o.id === 'Q');
  assert.ok(q.effects[0].startsWith('協力鍵 1→2（リトから）'));
  const t = clone(s);
  choose(t, 'Q');
  assert.equal(t.coop.length, 2); assert.equal(t.broken, false);
  choose(s, 'P');
  assert.equal(s.coop.length, 0); assert.equal(s.support.length, 1); assert.equal(s.broken, true);
  assert.ok(s.promises.every((x) => x.broken));
  assert.equal(sceneLines(s).at(-1), chapterData(3).after.broke);
  // 約束がなければ、公開しても約束破りにならない
  const u = newGame(); ch1(u, 'P');
  assert.equal(u.broken, false);
  assert.equal(choiceOptions(u).length, 3);
});

test('前章の選択で、第3章の案内人（最後の1行）が変わる', () => {
  const last = (choice, opt) => { const s = newGame(); ch1(s, choice, opt); return sceneLines(s).at(-1).who ?? 'narr'; };
  assert.equal(last('Q'), 'nem');
  assert.equal(last('Q', { prove: 'p1b' }), 'ol');
  assert.equal(last('P'), 'city');
  assert.equal(last('H'), 'narr');
});

test('章のはじめに戻ると、その時点の全状態（証拠・試行・支持・協力・約束）に戻る', () => {
  const s = newGame();
  ch1(s, 'Q');
  const atStart = clone(s);
  delete atStart.start;
  investigate(s, ['desk', 'belfry', 'court']);
  present(s, 't3b', 'e9', 'e11');
  present(s, 't3a', 'e9', 'e10'); advance(s); choose(s, 'P');
  const back = restoreChapter(s);
  const cmp = clone(back); delete cmp.start;
  assert.deepEqual(cmp, atStart);
  assert.equal(back.coop.length, 1);
  assert.equal(back.broken, false);
  // 第1章のはじめに戻ると、まっさら
  const n = newGame(); visit(n, 'plaza');
  const b1 = restoreChapter(n); delete b1.start;
  const fresh = newGame(); delete fresh.start;
  assert.deepEqual(b1, fresh);
});

test('結末の具体的な経路：①S+保留 ②B+約束2回 ③公開2回 ④未立証', () => {
  const a = newGame(); ch1(a, 'H'); ch3(a, 'Q');
  assert.equal(outlook(a).sew, 'open');
  const b = newGame(); ch1(b, 'Q'); ch3(b, 'Q');
  assert.equal(b.coop.length, 2);
  assert.equal(outlook(b).bridge, 'near');
  const c = newGame(); ch1(c, 'P'); ch3(c, 'P');
  assert.equal(c.support.length, 2);
  assert.equal(outlook(c).record, 'near');
  assert.equal(outlook(c).bridge, 'closed');
  const d = newGame(); ch1(d, 'H', { prove: 'none' }); ch3(d, 'H', { prove: 'none' });
  assert.equal(outlook(d).closed, 'open');
  assert.equal(outlook(d).sew, 'closed');
  assert.equal(outlook(d).bridge, 'closed');
});

test('一律に公開/約束/保留だけでは、全部の結末に手が届かない', () => {
  for (const c of ['P', 'Q', 'H']) {
    const s = newGame(); ch1(s, c); ch3(s, c);
    const st = Object.values(outlook(s));
    assert.ok(st.some((x) => x === 'closed' || x === 'far'), `一律${c}`);
  }
});

test('全部の調査の組み合わせ×提示の成否×選択で、必ず試作の終わりに着く', () => {
  let count = 0;
  const combos = (no) => { const ids = chapterData(no).sites.map((x) => x.id); return ids.map((_, k) => ids.filter((__, i) => i !== k)); };
  for (const c1 of combos(1)) {
    if (c1[0] !== 'plaza' && !c1.includes('plaza')) continue; // 第1章は e1 固定
    const order1 = ['plaza', ...c1.filter((x) => x !== 'plaza')];
    for (const ok1 of [true, false]) {
      for (const ch1c of ['P', 'Q', 'H']) {
        for (const c3 of combos(3)) {
          for (const ok3 of [true, false]) {
            for (const ch3c of ['P', 'Q', 'H']) {
              const s = newGame();
              const solve = (okk) => {
                const cd = chapterData(s.ch);
                const pair = cd.pairs.find((p) => p.evs.every((e) => s.evidence.includes(e)));
                if (okk) { assert.ok(present(s, pair.refutes, ...pair.evs).correct); return true; }
                const other = cd.testimonies.find((t) => t.id !== pair.refutes).id;
                present(s, other, ...pair.evs); present(s, other, ...pair.evs);
                assert.equal(s.phase, 'unproven');
                return false;
              };
              investigate(s, order1);
              const p1 = solve(ok1); advance(s);
              if (!choose(s, ch1c).ok) { assert.ok(!p1 && ch1c !== 'H'); choose(s, 'H'); }
              toCh3(s);
              investigate(s, c3);
              const p3 = solve(ok3); advance(s);
              if (!choose(s, ch3c).ok) { assert.ok(!p3 && ch3c !== 'H'); choose(s, 'H'); }
              advance(s);
              assert.equal(s.phase, 'end');
              assert.equal(endingOutlook(s).find((e) => e.id === 'closed').status, 'open');
              count += 1;
            }
          }
        }
      }
    }
  }
  assert.ok(count >= 3 * 2 * 3 * 4 * 2 * 3);
});

test('無作為の有効操作でも詰まらず終わる（1000周）', () => {
  for (let i = 1; i <= 1000; i++) {
    const { s } = run('random', i);
    assert.equal(s.phase, 'end');
    for (const e of s.evidence) assert.ok(EVIDENCE[e]);
    assert.equal(new Set(s.evidence).size, s.evidence.length);
  }
});

test('状態は JSON にでき、複製しても同じ続きになる', () => {
  const s = newGame(); visit(s, 'plaza');
  const t = JSON.parse(JSON.stringify(s));
  advance(s); advance(t);
  visit(s, 'tower'); visit(t, 'tower');
  assert.deepEqual(s, t);
  assert.ok(siteList(s).every((x) => typeof x.visited === 'boolean'));
});
