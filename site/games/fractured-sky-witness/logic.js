// 空が割れた日の証人 — ルール（DOM を触らない）。状態はすべて JSON にできる（複製・保存・章頭への復元が簡単）。
import { CHAPTERS, PLAYABLE, EVIDENCE, TAG_MEANING, SECRETS, PEOPLE, PROOFS, ENDINGS } from './story.js';

// 調整できる値はここに集める
export const CONFIG = {
  actions: 3,   // 1章あたりの調査行動
  attempts: 2,  // 1章あたりの提示の試行
};

export const chapterData = (no) => CHAPTERS.find((c) => c.no === no);
export const ch = (s) => chapterData(s.ch);
export const personName = (id) => PEOPLE[id]?.name ?? '';

function snapshot(s) {
  const { start, ...rest } = s; // eslint-disable-line no-unused-vars
  return JSON.stringify(rest);
}

function beginChapter(s, no) {
  s.ch = no;
  s.phase = 'intro';
  s.actionsLeft = CONFIG.actions;
  s.attemptsLeft = CONFIG.attempts;
  s.visited = [];
  s.siteId = null;
  s.pairId = null;
  s.feedback = null;
  s.start = null;
  s.start = snapshot(s);
}

export function newGame() {
  const s = {
    v: 1, ch: 1, phase: 'intro', actionsLeft: 0, attemptsLeft: 0, visited: [], siteId: null, pairId: null, feedback: null,
    evidence: [],   // 今回の周で得た証拠（順番どおり）
    proofs: {},     // 章番号 -> 'S' | 'T' | 'B' ...
    proven: {},     // 章番号 -> 立証した組の id
    secrets: [],    // 知った秘密
    support: [],    // 市民の支持旗 { ch, about }
    coop: [],       // 協力鍵 { ch, from }
    promises: [],   // 約束 { ch, to, broken }
    holds: [],      // 保留印 { ch, proven }
    broken: false,  // 約束破り（取り消せない）
    choices: {},    // 章番号 -> 'P' | 'Q' | 'H'
    log: [],
    start: null,
  };
  beginChapter(s, 1);
  return s;
}

// 章のはじめに戻る（証拠・試行・支持・協力・約束をすべてその時点に戻す）
export function restoreChapter(s) {
  const back = JSON.parse(s.start);
  back.start = s.start;
  return back;
}

const addLog = (s, text) => { s.log.push({ ch: s.ch, text }); };

// ----- 調査 -----
export function siteList(s) {
  const c = ch(s);
  return (c.sites || []).map((site) => ({ ...site, visited: s.visited.includes(site.id), locked: !canVisit(s, site.id).ok && !s.visited.includes(site.id) }));
}

export function canVisit(s, siteId) {
  const c = ch(s);
  const site = c.sites?.find((x) => x.id === siteId);
  if (!site) return { ok: false, why: 'その場所はない' };
  if (s.phase !== 'investigate' && s.phase !== 'intro') return { ok: false, why: '今は調査できない' };
  if (s.visited.includes(siteId)) return { ok: false, why: 'もう調べた' };
  if (s.actionsLeft <= 0) return { ok: false, why: '調査の残りがない' };
  // 第1章の最初は、光る空のかけら（e1）から
  if (s.ch === 1 && s.visited.length === 0 && siteId !== 'plaza') return { ok: false, why: 'まずは光るかけらに触れてみよう' };
  return { ok: true };
}

export function visit(s, siteId) {
  const v = canVisit(s, siteId);
  if (!v.ok) return v;
  const site = ch(s).sites.find((x) => x.id === siteId);
  s.visited.push(siteId);
  s.actionsLeft -= 1;
  if (!s.evidence.includes(site.ev)) s.evidence.push(site.ev);
  s.siteId = siteId;
  s.phase = 'site';
  addLog(s, `${site.name}を調べ、「${EVIDENCE[site.ev].name}」を得た。`);
  return { ok: true, ev: site.ev };
}

// ----- 審理 -----
export const testimonies = (s) => ch(s).testimonies || [];
export const chapterEvidence = (s) => s.evidence.filter((e) => (ch(s).sites || []).some((x) => x.ev === e));

export function present(s, testimonyId, a, b) {
  if (s.phase !== 'trial') return { ok: false, why: '今は審理中ではない' };
  if (s.attemptsLeft <= 0) return { ok: false, why: '提示の残りがない' };
  const t = testimonies(s).find((x) => x.id === testimonyId);
  if (!t) return { ok: false, why: '証言を選んでいない' };
  if (!a || !b) return { ok: false, why: '証拠を2つ並べよう' };
  if (a === b) return { ok: false, why: '同じ証拠を2回は使えない' };
  if (!s.evidence.includes(a) || !s.evidence.includes(b)) return { ok: false, why: 'まだ手に入れていない証拠' };
  const pair = ch(s).pairs.find((p) => p.refutes === testimonyId && p.evs.includes(a) && p.evs.includes(b));
  if (pair) {
    s.phase = 'proven';
    s.pairId = pair.id;
    s.proofs[s.ch] = ch(s).proof;
    s.proven[s.ch] = pair.id;
    if (!s.secrets.includes(pair.secret)) s.secrets.push(pair.secret);
    s.feedback = null;
    addLog(s, `${personName(t.who)}の「${t.mark}」に矛盾を示した。${PROOFS[ch(s).proof].name}を得た。`);
    return { ok: true, correct: true, pair: pair.id };
  }
  s.attemptsLeft -= 1;
  const ea = EVIDENCE[a]; const eb = EVIDENCE[b];
  let why;
  if (ea.tag !== eb.tag) why = `「${ea.name}」と「${eb.name}」は、別々のことを示している。線がつながらない。`;
  else why = `2つの証拠は「${TAG_MEANING[ea.tag]}」ことを示す。でも${personName(t.who)}の「${t.mark}」とは食い違わない。`;
  s.feedback = why;
  addLog(s, `提示は届かなかった：${why}`);
  if (s.attemptsLeft <= 0) { s.phase = 'unproven'; s.pairId = null; }
  return { ok: true, correct: false, why, attemptsLeft: s.attemptsLeft };
}

// 立証せずに進む
export function giveUp(s) {
  if (s.phase !== 'trial') return { ok: false, why: '今は審理中ではない' };
  s.phase = 'unproven';
  s.pairId = null;
  addLog(s, '立証せずに進んだ。');
  return { ok: true };
}

// ----- 公開 / 約束 / 保留 -----
export function secretOwner(s) {
  const pair = ch(s).pairs?.find((p) => p.id === s.pairId);
  return pair ? SECRETS[pair.secret].who : null;
}

export function choiceOptions(s) {
  const proven = s.phase === 'choice' && !!s.pairId;
  const owner = secretOwner(s);
  const live = s.promises.filter((p) => !p.broken);
  const ownerName = personName(owner);
  return [
    {
      id: 'P', name: '公開する', sub: '広場で、みんなに知らせる',
      allowed: proven, why: proven ? '' : '証明がないので、公開も約束もできない',
      effects: [
        `市民の支持旗 ${s.support.length}→${s.support.length + 1}`,
        ...(s.coop.length ? [`協力鍵 ${s.coop.length}→0`] : []),
        ...live.map((p) => `${personName(p.to)}との約束を破る（取り消せない）`),
        ...(live.length || s.coop.length ? ['橋の結末に影響'] : []),
      ],
      warn: live.length > 0 || s.coop.length > 0,
    },
    {
      id: 'Q', name: '本人にだけ伝える', sub: owner ? `${ownerName}の秘密を守ると約束する` : '',
      allowed: proven, why: proven ? '' : '証明がないので、公開も約束もできない',
      effects: [`協力鍵 ${s.coop.length}→${s.coop.length + 1}（${ownerName}から）`, `${ownerName}と約束する`, '市民の支持は増えない'],
      warn: false,
    },
    {
      id: 'H', name: '保留する', sub: '記録に残し、まだ誰にも渡さない',
      allowed: s.phase === 'choice',
      why: '',
      effects: [`保留印 ${s.holds.length}→${s.holds.length + 1}`, '誰の支持も増えない', '空を縫い直す案が残る'],
      warn: false,
    },
  ];
}

export function choose(s, id) {
  if (s.phase !== 'choice') return { ok: false, why: '今は選べない' };
  const opt = choiceOptions(s).find((o) => o.id === id);
  if (!opt || !opt.allowed) return { ok: false, why: opt?.why || 'その選択はない' };
  const owner = secretOwner(s);
  s.lastBroke = [];
  if (id === 'P') {
    s.support.push({ ch: s.ch, about: owner });
    for (const p of s.promises) if (!p.broken) { p.broken = true; s.lastBroke.push(p.to); }
    if (s.lastBroke.length) s.broken = true;
    s.coop = [];
    addLog(s, `秘密を公開した。市民の支持旗 ${s.support.length}。${s.lastBroke.length ? '約束を破った。' : ''}`);
  } else if (id === 'Q') {
    s.coop.push({ ch: s.ch, from: owner });
    s.promises.push({ ch: s.ch, to: owner, broken: false });
    addLog(s, `${personName(owner)}にだけ伝え、秘密を守ると約束した。協力鍵 ${s.coop.length}。`);
  } else {
    s.holds.push({ ch: s.ch, proven: !!s.pairId });
    addLog(s, `判断を保留した。保留印 ${s.holds.length}。`);
  }
  s.choices[s.ch] = id;
  s.phase = 'after';
  return { ok: true };
}

// ----- 場面を進める -----
export function advance(s) {
  switch (s.phase) {
    case 'intro': s.phase = 'investigate'; break;
    case 'site': s.siteId = null; s.phase = s.actionsLeft > 0 ? 'investigate' : 'trial'; break;
    case 'proven': case 'unproven': s.phase = 'choice'; break;
    case 'after': {
      const next = PLAYABLE[PLAYABLE.indexOf(s.ch) + 1];
      if (next == null) { s.phase = 'end'; break; }
      if (next !== s.ch + 1) { s.ch = s.ch + 1; s.phase = 'bridge'; break; }
      beginChapter(s, next); break;
    }
    case 'bridge': beginChapter(s, PLAYABLE.find((n) => n > s.ch)); break;
    default: return { ok: false };
  }
  return { ok: true };
}

// 調査を早めに終えて審理へ（残りがあっても、本人が選んだときだけ）
export function toTrial(s) {
  if (s.phase !== 'investigate') return { ok: false };
  s.phase = 'trial';
  return { ok: true };
}

// ----- いま表示する文 -----
function guideKey(s) {
  if (s.coop.some((c) => c.from === 'nem')) return 'nem';
  if (s.coop.some((c) => c.from === 'ol')) return 'ol';
  if (s.support.length) return 'city';
  if (s.holds.length) return 'hold';
  return 'none';
}

export function sceneLines(s) {
  const c = ch(s);
  switch (s.phase) {
    case 'intro': return c.introGuide ? [...c.intro, c.introGuide[guideKey(s)]] : c.intro;
    case 'site': return c.sites.find((x) => x.id === s.siteId)?.lines ?? [];
    case 'proven': return c.pairs.find((p) => p.id === s.pairId).proven;
    case 'unproven': return c.unproven;
    case 'after': {
      const id = s.choices[s.ch];
      if (!s.pairId) return c.after.none;
      if (id === 'H') return c.after.H;
      const lines = [...c.after[id][secretOwner(s)]];
      if (id === 'P' && s.lastBroke?.length && c.after.broke) lines.push(c.after.broke);
      return lines;
    }
    case 'bridge': return c.bridge;
    default: return [];
  }
}

// 場面ごとの id（既読の記録用）
export function sceneKey(s) {
  return `${s.ch}:${s.phase}:${s.siteId || s.pairId || ''}:${s.phase === 'after' ? s.choices[s.ch] : ''}`;
}

// 最初の面の手引き（ヒント ON のとき画面が使う）
export function guide(s) {
  if (s.ch !== 1) return null;
  if (s.phase === 'investigate' || s.phase === 'intro') {
    if (!s.visited.length) return { site: 'plaza' };
    if (!s.visited.includes('tower')) return { site: 'tower' };
  }
  if (s.phase === 'trial' && s.evidence.includes('e1') && s.evidence.includes('e2')) return { testimony: 't1a', evs: ['e1', 'e2'] };
  return null;
}

// ----- 結末の見通し（試作は第3章まで。第4章の選択でどこへ行けるか） -----
export function endingOutlook(s) {
  const hasS = s.proofs[1] === 'S';
  const hasB = s.proofs[3] === 'B';
  const coop = s.coop.length;
  const sup = s.support.length;
  return ENDINGS.map((e) => {
    let status; let why;
    if (e.id === 'sew') {
      if (!hasS) { status = 'closed'; why = '第1章で安全の証明(S)を得ていない'; }
      else if (s.holds.length) { status = 'open'; why = 'S と保留印がそろっている'; }
      else { status = 'near'; why = '第4章で保留すれば届く'; }
    } else if (e.id === 'bridge') {
      if (s.broken) { status = 'closed'; why = '約束を破ったので、橋は渡れない'; }
      else if (!hasB) { status = 'closed'; why = '第3章で橋の証明(B)を得ていない'; }
      else if (coop >= 2) { status = 'near'; why = `協力鍵${coop}つ。第4章で橋の承認(J)を立証すれば届く`; }
      else if (coop === 1) { status = 'near'; why = '協力鍵1つ。第4章でJを立証し、もう1人と約束すれば届く'; }
      else { status = 'closed'; why = '協力鍵が足りない'; }
    } else if (e.id === 'record') {
      if (sup >= 2) { status = 'near'; why = `支持旗${sup}つ。第2章のT と第4章の記録の承認(R)で届く`; }
      else if (sup === 1) { status = 'near'; why = '支持旗1つ。第4章でもう一度公開すれば届く（T と R も必要）'; }
      else { status = 'far'; why = '支持旗0。第2章と第4章で公開すれば届く（試作では第2章を省略）'; }
    } else { status = 'open'; why = 'いつでも選べる'; }
    return { ...e, status, why };
  });
}

// 共有用のひとこと（結末名は伏せる）
export function shareText(s) {
  const kept = s.promises.filter((p) => !p.broken).length;
  return `空が割れた日の証人（試作）｜公開 ${s.support.length}回・守った約束 ${kept}・保留 ${s.holds.length}`;
}
