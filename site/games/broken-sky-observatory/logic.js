// 画面に依存しないルール。3軸（時刻・風向・気圧）→ 観測記録ID（1〜64）→ 現象。
export const TIMES = ['夜明け', '昼', '夕暮れ', '深夜'];
export const WINDS = ['東', '西', '上昇', '停止'];
export const PRESSURES = ['低', '標準', '高', '不明'];
export const TOTAL = 64;
export const HISTORY_MAX = 6;
export const STORAGE_KEY = 'broken-sky-observatory:v1';

export function idOf(t, w, p) { return 1 + t * 16 + w * 4 + p; }
export function decode(id) {
  const n = id - 1;
  return { t: Math.floor(n / 16), w: Math.floor(n / 4) % 4, p: n % 4 };
}
export const isValidSel = (s) => !!s && [s.t, s.w, s.p].every((v) => Number.isInteger(v) && v >= 0 && v < 4);

// ヒント用の言い回し（条件を直接は書かず、観測所の記録メモ風にする）
export const TIME_CLUE = ['夜がまだ明けきらず', '太陽が真上にあり', '日が傾く頃', '真夜中に'];
export const WIND_CLUE = ['風は東から吹き', '風は西へ流れ', '風が空へ昇り', '風が止まり'];
export const PRESS_CLUE = ['針が沈む', '針は真ん中で眠り', '針が振り切れる', '針が読めない'];

// 12件の特異現象（ID固定・重複なし）
const A = (key, name, line, t, w, p) => ({ key, name, line, t, w, p, id: idOf(t, w, p) });
export const ANOMALIES = [
  A('inverted-sea', '逆さの海', '空の上を波が流れ、船が逆さに吊られている。', 3, 2, 3),
  A('double-sun', '二重の太陽', '昼の空に、同じ大きさの太陽がもう一つ。', 1, 3, 2),
  A('eye', '地平線の巨大な瞳', '地平線が裂け、こちらを見ている。', 3, 3, 3),
  A('falling-city', '落ちてくる街', '空の岩盤ごと、知らない街が降りてくる。', 2, 2, 0),
  A('fish-cloud', '魚群の雲', '雲に見えたものは、すべて魚の群れだった。', 1, 0, 0),
  A('black-rainbow', '黒い虹', '光を吸う七色が、空に橋をかけた。', 1, 1, 1),
  A('forbidden-moon', '見てはいけない月', '月の表面が、こちらの顔をしている。', 3, 0, 2),
  A('sky-crack', '裂ける空', '空に走った亀裂の奥は、まだ朝だった。', 0, 3, 1),
  A('giant-hand', '降りてくる手', '雲の上から、ゆっくり指が降りてくる。', 0, 2, 3),
  A('burning-whale', '燃える鯨', '空を泳ぐ鯨の背が、夕焼けごと燃えている。', 2, 1, 2),
  A('clock-moon', '時計の月', '月の針が、猛烈な速さで進んでいる。', 3, 1, 0),
  A('sky-door', '空の扉', '何もない空に、階段のついた扉が立っている。', 0, 0, 2),
];
export const anomalyOf = (id) => ANOMALIES.find((a) => a.id === id) || null;
export const hintOf = (a) => `${TIME_CLUE[a.t]}、${WIND_CLUE[a.w]}、${PRESS_CLUE[a.p]}`;

// 通常52件：時刻×風向の基本名 + 気圧の形容で、64通りすべて別名にする
const BASE = [
  ['薄明の東風', '薄明の西風', '薄明の昇り霧', '薄明の凪'],
  ['白昼の東風', '白昼の西風', '白昼の上昇気流', '白昼の凪'],
  ['夕映えの東風', '夕映えの西風', '夕映えの上昇気流', '夕映えの凪'],
  ['夜半の東風', '夜半の西風', '夜半の昇り星', '夜半の凪'],
];
const ADJ = ['重い', '澄んだ', '張りつめた', '針の読めない'];
const T_LINE = ['空の端が薄く染まっている。', '雲の影が地面を這っている。', '遠い街が赤く沈んでいく。', '星の数が合っていない。'];
const W_LINE = ['東から塵が流れてくる。', '西へ雲が引かれていく。', '地上から灰が昇っていく。', '空気が固まって動かない。'];
const P_LINE = ['気圧計の針は底に沈んでいる。', '計器は静かに眠っている。', '針が限界まで振れている。', '針が読めない。'];

export function describe(id) {
  const { t, w, p } = decode(id);
  const an = anomalyOf(id);
  if (an) return { id, t, w, p, anomaly: true, key: an.key, name: an.name, line: an.line };
  return {
    id, t, w, p, anomaly: false, key: `n${id}`,
    name: ADJ[p] + BASE[t][w],
    line: `${T_LINE[t]}${W_LINE[w]}${P_LINE[p]}`,
  };
}
export const conditionText = (id) => { const d = decode(id); return `${TIMES[d.t]}／${WINDS[d.w]}／${PRESSURES[d.p]}`; };
export const idLabel = (id) => String(id).padStart(2, '0');

// ---- 状態 ----
export const INITIAL_SEL = { t: 2, w: 2, p: 2 }; // 夕暮れ／上昇／高：二重の太陽・燃える鯨のすぐ近く
export function newState(found = []) {
  const codex = Array(TOTAL).fill(false);
  for (const id of found) if (id >= 1 && id <= TOTAL) codex[id - 1] = true;
  const sel = { ...INITIAL_SEL };
  return { codex, sel, observed: idOf(sel.t, sel.w, sel.p), history: [], recordedNow: false, concealed: false };
}
export const countFound = (s) => s.codex.filter(Boolean).length;
export const countAnomalies = (s) => ANOMALIES.filter((a) => s.codex[a.id - 1]).length;
export const isFound = (s, id) => !!s.codex[id - 1];
export const isComplete = (s) => countFound(s) === TOTAL;

export function select(s, axis, value) {
  if (!['t', 'w', 'p'].includes(axis) || !Number.isInteger(value) || value < 0 || value > 3) return s;
  return { ...s, sel: { ...s.sel, [axis]: value } };
}
// 観測：同じ入力は常に同じ現象。履歴は直近6件。
export function observe(s) {
  const id = idOf(s.sel.t, s.sel.w, s.sel.p);
  const history = [id, ...s.history].slice(0, HISTORY_MAX);
  return { ...s, observed: id, history };
}
export const canRecord = (s) => !isFound(s, s.observed);
// 記録：図鑑を更新する唯一の操作。登録済みなら何も変わらない。
export function record(s) {
  if (!canRecord(s)) return s;
  const codex = s.codex.slice();
  codex[s.observed - 1] = true;
  return { ...s, codex };
}

// 未発見の特異現象のヒント（最大3件）
export function hints(s) {
  return ANOMALIES.filter((a) => !isFound(s, a.id)).slice(0, 3).map(hintOf);
}

// 図鑑の1枠：未発見は番号以外の情報を返さない
export function codexEntry(s, id) {
  if (!isFound(s, id)) return { id, found: false };
  const d = describe(id);
  return { id, found: true, name: d.name, line: d.line, anomaly: d.anomaly, cond: conditionText(id) };
}
export function anomalySlots(s) {
  return ANOMALIES.map((a, i) => (isFound(s, a.id)
    ? { slot: i + 1, found: true, id: a.id, name: a.name }
    : { slot: i + 1, found: false }));
}

// ---- 保存 ----
export const serialize = (s) => s.codex.map((b) => (b ? '1' : '0')).join('');
export function parseSaved(raw) {
  if (typeof raw !== 'string' || !/^[01]{64}$/.test(raw)) return [];
  return [...raw].map((c, i) => (c === '1' ? i + 1 : 0)).filter(Boolean);
}

// ---- 共有 ----
export function shareText(s, concealed = s.concealed) {
  const n = countFound(s);
  const d = describe(s.observed);
  if (concealed) {
    return d.anomaly
      ? `異常気象観測所で特異現象を1件発見。発見 ${n}/${TOTAL}。#空が壊れるまで`
      : `異常気象観測所で空を観測。発見 ${n}/${TOTAL}。#空が壊れるまで`;
  }
  return `異常気象観測所で『${d.name}』を記録。条件：${conditionText(s.observed)}。発見 ${n}/${TOTAL}。#空が壊れるまで`;
}
