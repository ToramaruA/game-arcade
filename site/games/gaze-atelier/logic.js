// まなざしのアトリエ：ルール本体（DOM を触らない）。
// お題と答え合わせ、線データの圧縮と共有、お手本なぞりの採点、顔の向きの調整（回帰）、交代モードの点数。

// ---------- お題100種（最初が表示名、残りは受け付ける言い方） ----------
const RAW = {
  どうぶつ: [
    'ねこ/猫/ネコ/にゃんこ', 'いぬ/犬/イヌ/わんこ', 'うさぎ/兎/ウサギ', 'さかな/魚/サカナ', 'へび/蛇/ヘビ', 'かたつむり/カタツムリ/でんでんむし',
    'ぞう/象/ゾウ', 'きりん/キリン', 'ぶた/豚/ブタ', 'とり/鳥/トリ/ことり', 'ふくろう/フクロウ', 'くじら/鯨/クジラ', 'かめ/亀/カメ',
    'ちょうちょ/ちょう/蝶/チョウ/チョウチョ', 'くわがた/クワガタ/かぶとむし/カブトムシ', 'たこ/蛸/タコ', 'かに/蟹/カニ', 'ひよこ/ヒヨコ', 'くま/熊/クマ', 'ねずみ/鼠/ネズミ',
  ],
  たべもの: [
    'りんご/林檎/リンゴ', 'バナナ/ばなな', 'いちご/苺/イチゴ', 'さくらんぼ/サクランボ/チェリー', 'ぶどう/葡萄/ブドウ', 'すいか/西瓜/スイカ',
    'おにぎり/おむすび/オニギリ', 'ドーナツ/どーなつ/ドーナッツ', 'アイス/アイスクリーム/そふとくりーむ/ソフトクリーム', 'ケーキ/けーき',
    'ピザ/ぴざ', 'たまご/卵/玉子/タマゴ', 'にんじん/人参/ニンジン', 'きのこ/茸/キノコ', 'パン/ぱん', 'だんご/団子/ダンゴ', 'えだまめ/枝豆/エダマメ',
    'ラーメン/らーめん', 'すし/寿司/スシ/おすし', 'プリン/ぷりん',
  ],
  もの: [
    'いえ/家/イエ/おうち', 'くるま/車/クルマ/じどうしゃ', 'でんしゃ/電車/デンシャ', 'ふね/船/フネ', 'ひこうき/飛行機/ヒコウキ', 'じてんしゃ/自転車/ジテンシャ',
    'かさ/傘/カサ', 'めがね/眼鏡/メガネ', 'とけい/時計/トケイ', 'かぎ/鍵/カギ', 'でんきゅう/電球/デンキュウ', 'はさみ/鋏/ハサミ', 'ハート/はーと',
    'ほし/星/スター', 'えんぴつ/鉛筆/エンピツ', 'コップ/こっぷ/グラス', 'ぼうし/帽子/ボウシ', 'くつ/靴/クツ', 'テレビ/てれび', 'ふうせん/風船/フウセン',
  ],
  しぜん: [
    'たいよう/太陽/タイヨウ/おひさま', 'つき/月/ツキ/みかづき/三日月', 'くも/雲/クモ', 'あめ/雨/アメ', 'かみなり/雷/カミナリ', 'にじ/虹/ニジ',
    'やま/山/ヤマ', 'き/木/キ', 'はな/花/ハナ', 'ゆきだるま/雪だるま/ユキダルマ', 'なみ/波/ナミ', 'かざん/火山/カザン', 'しま/島/シマ',
    'ゆき/雪/ユキ/ゆきのけっしょう/雪の結晶', 'ひまわり/向日葵/ヒマワリ', 'さぼてん/サボテン', 'はっぱ/葉っぱ/は/葉', 'きのみ/木の実/どんぐり/ドングリ',
    'ながれぼし/流れ星/ナガレボシ', 'たき/滝/タキ',
  ],
  ふしぎ: [
    'おばけ/お化け/オバケ/ゆうれい/幽霊', 'ロボット/ろぼっと', 'うちゅうじん/宇宙人/ウチュウジン/エイリアン', 'ドラゴン/どらごん/りゅう/竜/龍',
    'まほうつかい/魔法使い/マホウツカイ/まじょ/魔女', 'おうかん/王冠/オウカン/かんむり/冠', 'ロケット/ろけっと', 'ユーフォー/UFO/ゆーふぉー',
    'にんじゃ/忍者/ニンジャ', 'てんし/天使/テンシ', 'あくま/悪魔/アクマ', 'ゆにこーん/ユニコーン', 'にんぎょ/人魚/ニンギョ', 'がいこつ/骸骨/ガイコツ/ほね/骨',
    'たからばこ/宝箱/タカラバコ', 'まほうのつえ/魔法の杖/つえ/杖', 'かいじゅう/怪獣/カイジュウ', 'ようせい/妖精/ヨウセイ', 'ピラミッド/ぴらみっど', 'おしろ/お城/しろ/城',
  ],
};
export const CATEGORIES = Object.keys(RAW);
export const PROMPTS = [];
for (const cat of CATEGORIES) for (const s of RAW[cat]) { const [name, ...alias] = s.split('/'); PROMPTS.push({ id: PROMPTS.length, cat, name, alias: [name, ...alias] }); }

// ひらがな化・空白除去・小文字化
export function normalize(s) {
  return String(s ?? '').trim().toLowerCase()
    .replace(/[\s　・、。!！?？~〜ー\-]/g, '')
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}
// 自由入力の答え合わせ
export function isCorrect(promptId, answer) {
  const p = PROMPTS[promptId]; if (!p) return false;
  const a = normalize(answer); if (!a) return false;
  return p.alias.some((x) => normalize(x) === a);
}

// ---------- 乱数（種つき） ----------
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1000000) / 1000000; }; }
export function pickPromptChoices(seed, n = 3, exclude = []) {
  const r = rng(seed), ids = [];
  while (ids.length < n) { const id = Math.floor(r() * PROMPTS.length); if (!ids.includes(id) && !exclude.includes(id)) ids.push(id); }
  return ids;
}
// 当てる側の4択：正解＋同じ分類から2つ＋別の分類から1つ。並びは種で決まる
export function guessChoices(promptId, seed) {
  const r = rng(seed * 7 + promptId), p = PROMPTS[promptId];
  const same = PROMPTS.filter((q) => q.cat === p.cat && q.id !== p.id && normalize(q.name) !== normalize(p.name));
  const other = PROMPTS.filter((q) => q.cat !== p.cat);
  const pick = (arr) => arr.splice(Math.floor(r() * arr.length), 1)[0].id;
  const out = [promptId, pick(same), pick(same), pick(other)];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

// ---------- 線データ ----------
// strokes: [[{x,y,t}, ...], ...]  x,y は 0..1、t は描き始めからの秒
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function toB64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 3) { const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0); s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '') + (i + 2 < bytes.length ? B64[n & 63] : ''); } return s; }
function fromB64(s) { const out = []; for (let i = 0; i < s.length; i += 4) { const a = [0, 1, 2, 3].map((k) => (i + k < s.length ? B64.indexOf(s[i + k]) : -1)); if (a.slice(0, 2).some((v) => v < 0)) throw new Error('bad'); const n = (a[0] << 18) | (a[1] << 12) | (Math.max(0, a[2]) << 6) | Math.max(0, a[3]); out.push((n >> 16) & 255); if (a[2] >= 0) out.push((n >> 8) & 255); if (a[3] >= 0) out.push(n & 255); } return out; }
const q = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
// 点を間引く（近すぎる点を落とす）
export function simplify(stroke, minDist = 0.006) {
  const out = []; for (const p of stroke) { const l = out[out.length - 1]; if (!l || Math.hypot(p.x - l.x, p.y - l.y) >= minDist) out.push(p); }
  if (stroke.length && out[out.length - 1] !== stroke[stroke.length - 1]) out.push(stroke[stroke.length - 1]);
  return out;
}
// 形式：[ver=1][promptId][seed lo][seed hi][線の数] 各線 [点の数 hi][lo][t開始 1/10秒] 各点 [x][y][dt 1/50秒]
export function encodeDrawing({ promptId, seed = 0, strokes }) {
  const b = [1, promptId & 255, seed & 255, (seed >> 8) & 255];
  const ss = strokes.filter((s) => s.length).slice(0, 255).map((s) => simplify(s));
  b.push(ss.length);
  for (const s of ss) {
    const pts = s.slice(0, 65535);
    b.push((pts.length >> 8) & 255, pts.length & 255, Math.min(255, Math.round((pts[0].t || 0) * 10)));
    let lt = pts[0].t || 0;
    for (const p of pts) { b.push(q(p.x), q(p.y), Math.min(255, Math.round(Math.max(0, (p.t || 0) - lt) * 50))); lt = p.t || 0; }
  }
  return toB64(b);
}
export function decodeDrawing(code) {
  const b = fromB64(String(code));
  let i = 0; const ver = b[i++]; if (ver !== 1) throw new Error('version');
  const promptId = b[i++]; const seed = b[i++] | (b[i++] << 8); const n = b[i++];
  if (!PROMPTS[promptId]) throw new Error('prompt');
  const strokes = [];
  for (let k = 0; k < n; k++) {
    const len = (b[i++] << 8) | b[i++]; let t = b[i++] / 10; const s = [];
    for (let j = 0; j < len; j++) { const x = b[i++] / 255, y = b[i++] / 255; t += b[i++] / 50; if (j === 0) t = Math.max(t, 0); s.push({ x, y, t }); }
    if (i > b.length) throw new Error('short');
    strokes.push(s);
  }
  return { promptId, seed, strokes };
}
export function drawingDuration(strokes) { let m = 0; for (const s of strokes) for (const p of s) m = Math.max(m, p.t || 0); return m; }

// ネタバレなしの共有文
export function shareText({ correct, seconds, tries }) {
  return correct ? `🎨 まなざしのアトリエ\n顔で描かれた「？？？」を ${seconds.toFixed(1)} 秒で当てた！（${tries}回目）` : '🎨 まなざしのアトリエ\n顔で描かれた「？？？」…当てられなかった。きみは分かる？';
}

// ---------- 顔の向き・目線の調整：特徴量 → 画面座標（リッジ回帰） ----------
// 特徴量を標準化し、黒目の位置の2乗・積（目の端での曲がり）も足して回帰する。
// samples: [{f:[...特徴], x, y}]  戻り値 predict(f) → {x,y}
export function expand(f) {
  const n = Math.min(4, f.length), out = f.slice();
  // 先頭の目の特徴（左右の目の u,v）の平均について 2乗と積を足す
  const u = n >= 4 ? (f[0] + f[2]) / 2 : f[0], v = n >= 4 ? (f[1] + f[3]) / 2 : f[1];
  out.push(u * u, v * v, u * v);
  return out;
}
export function fitGaze(samples, lambda = 1e-3) {
  if (samples.length < 3) return null;
  const X = samples.map((s0) => expand(s0.f));
  const k = X[0].length, n = X.length;
  const mean = new Array(k).fill(0), sd = new Array(k).fill(0);
  for (const v of X) for (let i = 0; i < k; i++) mean[i] += v[i] / n;
  for (const v of X) for (let i = 0; i < k; i++) sd[i] += (v[i] - mean[i]) ** 2 / n;
  for (let i = 0; i < k; i++) sd[i] = Math.sqrt(sd[i]) || 1;
  const z = (v) => [...v.map((x, i) => (x - mean[i]) / sd[i]), 1];
  const d = k + 1;
  const A = Array.from({ length: d }, () => new Array(d).fill(0)), bx = new Array(d).fill(0), by = new Array(d).fill(0);
  samples.forEach((s0, si) => { const v = z(X[si]); for (let i = 0; i < d; i++) { for (let j = 0; j < d; j++) A[i][j] += v[i] * v[j]; bx[i] += v[i] * s0.x; by[i] += v[i] * s0.y; } });
  for (let i = 0; i < d - 1; i++) A[i][i] += lambda * n;
  const wx = solve(A.map((r) => r.slice()), bx.slice()), wy = solve(A.map((r) => r.slice()), by.slice());
  if (!wx || !wy) return null;
  const predict = (f) => { const v = z(expand(f)); let x = 0, y = 0; for (let i = 0; i < d; i++) { x += wx[i] * v[i]; y += wy[i] * v[i]; } return { x: x + predict.bias.x, y: y + predict.bias.y }; };
  predict.bias = { x: 0, y: 0 };
  // 当てはまりの悪さ（平均の誤差、画面に対する割合）
  let err = 0; samples.forEach((s0) => { const q = predict(s0.f); err += Math.hypot(q.x - s0.x, q.y - s0.y); }); predict.error = err / n;
  return predict;
}
// 遊びながらのずれ直し：狙いの点（target）を見ているはずのときに、ずれの一部を補正に足す
export function nudgeBias(predict, raw, target, rate = 0.08, max = 0.25) {
  if (!predict) return;
  const b = predict.bias;
  b.x = Math.max(-max, Math.min(max, b.x + (target.x - raw.x) * rate));
  b.y = Math.max(-max, Math.min(max, b.y + (target.y - raw.y) * rate));
}
function solve(A, b) {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) return null;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const k = A[r][c] / A[c][c]; for (let j = c; j < n; j++) A[r][j] -= k * A[c][j]; b[r] -= k * b[c]; }
  }
  return b.map((v, i) => v / A[i][i]);
}
// なめらかにする：One Euro フィルター（止まっているときは強くならし、速く動くときは素直に追う）
// さらに、ほぼ止まっている間は筆先を固定する（見つめているときの震えを消す）
export function smoother(minCutoff = 1.2, beta = 6, dCutoff = 1.0, hold = 0.012) {
  let px = null, py = null, dx = 0, dy = 0, hx = null, hy = null;
  const alpha = (cut, dt) => { const r = 2 * Math.PI * cut * dt; return r / (r + 1); };
  return (x, y, dt = 1 / 30) => {
    if (px === null) { px = hx = x; py = hy = y; return { x, y }; }
    const ad = alpha(dCutoff, dt);
    dx += ((x - px) / dt - dx) * ad; dy += ((y - py) / dt - dy) * ad;
    const cut = minCutoff + beta * Math.hypot(dx, dy);
    const a = alpha(cut, dt);
    px += (x - px) * a; py += (y - py) * a;
    if (Math.hypot(px - hx, py - hy) > hold) { hx = px; hy = py; }
    return { x: hx, y: hy };
  };
}
// まばたき：目を閉じた時間が minClosed 秒を超えたら「筆を上げる」
export function blinkGate(minClosed = 0.18) {
  let closedFor = 0;
  return (closed, dt) => { closedFor = closed ? closedFor + dt : 0; return closedFor >= minClosed; };
}

// ---------- ひとり：お手本なぞり（うすいお手本の上に、自分の線で絵を描く） ----------
// 形は 0..1 の座標の線（点の列）で表す。描いた線がお手本をどれだけ覆ったか・どれだけ近いかで星が決まる
const P = (n, f) => Array.from({ length: n + 1 }, (_, i) => f(i / n));
const circle = (cx, cy, r, a0 = 0, a1 = Math.PI * 2, ry = r) => P(Math.max(12, Math.round(48 * (a1 - a0) / (Math.PI * 2))), (u) => [cx + Math.cos(a0 + (a1 - a0) * u) * r, cy + Math.sin(a0 + (a1 - a0) * u) * ry]);
const line = (...pts) => pts;
const heart = () => P(60, (u) => { const t = u * Math.PI * 2; const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); return [0.5 + x / 40, 0.47 - y / 40]; });
const star5 = (cx, cy, R, r) => P(10, (u) => { const k = Math.round(u * 10), a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r : R; return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; });
const spiral = () => P(80, (u) => { const a = u * Math.PI * 5, r = 0.03 + u * 0.3; return [0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r]; });
const PAGE = (name, levels) => ({ name, levels });
export const SKIES = [
  PAGE('はじめのページ', [
    { name: 'まる', strokes: [circle(0.5, 0.5, 0.28)], par: 10 },
    { name: 'おやま', strokes: [line([0.12, 0.75], [0.35, 0.3], [0.5, 0.52], [0.66, 0.25], [0.88, 0.75])], par: 10 },
    { name: 'なみなみ', strokes: [P(40, (u) => [0.12 + u * 0.76, 0.5 + Math.sin(u * Math.PI * 4) * 0.14])], par: 12 },
    { name: 'ハート', strokes: [heart()], par: 14 },
    { name: 'おほしさま', strokes: [star5(0.5, 0.53, 0.34, 0.14)], par: 16 },
  ]),
  PAGE('なかよしのページ', [
    { name: 'さかな', strokes: [circle(0.45, 0.5, 0.25, -2.5, 2.5, 0.16), line([0.25, 0.42], [0.12, 0.3], [0.12, 0.7], [0.25, 0.58]), circle(0.58, 0.46, 0.025)], par: 18 },
    { name: 'おうち', strokes: [line([0.2, 0.45], [0.5, 0.18], [0.8, 0.45]), line([0.27, 0.42], [0.27, 0.82], [0.73, 0.82], [0.73, 0.42]), line([0.43, 0.82], [0.43, 0.6], [0.57, 0.6], [0.57, 0.82])], par: 20 },
    { name: 'かさ', strokes: [circle(0.5, 0.5, 0.32, Math.PI, Math.PI * 2, 0.26), line([0.18, 0.5], [0.82, 0.5]), line([0.5, 0.5], [0.5, 0.8]), circle(0.45, 0.8, 0.05, 0, Math.PI)], par: 18 },
    { name: 'うずまき', strokes: [spiral()], par: 18 },
    { name: 'はな', strokes: [...[0, 1, 2, 3, 4].map((k) => circle(0.5 + Math.cos(k * 1.2566 - 1.57) * 0.17, 0.42 + Math.sin(k * 1.2566 - 1.57) * 0.17, 0.09)), circle(0.5, 0.42, 0.07), line([0.5, 0.6], [0.5, 0.88])], par: 26 },
  ]),
  PAGE('いきもののページ', [
    { name: 'ねこ', strokes: [circle(0.5, 0.56, 0.27), line([0.3, 0.38], [0.3, 0.16], [0.44, 0.31]), line([0.56, 0.31], [0.7, 0.16], [0.7, 0.38]), circle(0.4, 0.53, 0.025), circle(0.6, 0.53, 0.025), line([0.45, 0.66], [0.5, 0.7], [0.55, 0.66])], par: 26 },
    { name: 'かたつむり', strokes: [P(60, (u) => { const a = u * Math.PI * 4, r = 0.03 + u * 0.2; return [0.55 + Math.cos(a) * r, 0.48 + Math.sin(a) * r]; }), line([0.15, 0.72], [0.85, 0.72]), line([0.2, 0.72], [0.2, 0.55], [0.15, 0.42]), line([0.22, 0.56], [0.27, 0.43])], par: 24 },
    { name: 'ことり', strokes: [circle(0.48, 0.55, 0.22, 0, Math.PI * 2, 0.17), circle(0.66, 0.36, 0.1), line([0.75, 0.35], [0.85, 0.38], [0.75, 0.41]), circle(0.68, 0.34, 0.015), line([0.4, 0.5], [0.52, 0.62], [0.32, 0.6])], par: 24 },
    { name: 'ちょうちょ', strokes: [circle(0.33, 0.38, 0.15), circle(0.67, 0.38, 0.15), circle(0.36, 0.66, 0.1), circle(0.64, 0.66, 0.1), line([0.5, 0.25], [0.5, 0.78]), line([0.5, 0.25], [0.42, 0.12]), line([0.5, 0.25], [0.58, 0.12])], par: 28 },
    { name: 'くじら', strokes: [circle(0.45, 0.55, 0.3, Math.PI * 0.95, Math.PI * 2.05, 0.2), line([0.16, 0.6], [0.75, 0.6]), line([0.75, 0.55], [0.88, 0.4], [0.8, 0.55], [0.92, 0.6]), line([0.42, 0.32], [0.38, 0.2]), line([0.42, 0.32], [0.48, 0.2]), circle(0.27, 0.5, 0.02)], par: 28 },
  ]),
];
export const LIMIT = 40; // 1枚の制限時間（秒）
export const NEAR = 0.05; // お手本に「重なった」とみなす距離
// お手本の線を、細かい点の列にする（覆った割合を数えるため）
export function sampleTemplate(level, step = 0.01) {
  const out = [];
  for (const s of level.strokes) for (let i = 1; i < s.length; i++) {
    const [ax, ay] = s[i - 1], [bx, by] = s[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 0; k < n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
  }
  return out;
}
export function createTrace(level) { return { level, t: 0, strokes: [], cur: null, done: false, samples: sampleTemplate(level), hit: null }; }
// 1コマ進める。筆が下りているときだけ線を足す
export function stepTrace(tr, p, dt) {
  if (tr.done) return null;
  tr.t += dt;
  if (p.down) { if (!tr.cur) { tr.cur = []; tr.strokes.push(tr.cur); } const l = tr.cur[tr.cur.length - 1]; if (!l || Math.hypot(p.x - l.x, p.y - l.y) > 0.004) tr.cur.push({ x: p.x, y: p.y, t: tr.t }); }
  else tr.cur = null;
  if (tr.t >= LIMIT) { tr.done = true; return 'done'; }
  return null;
}
// 覆った割合（お手本の点のうち、近くに自分の線があるもの）と、自分の線のずれ（お手本からの平均の距離）
export function scoreTrace(tr) {
  const pts = tr.strokes.flat();
  const T = tr.samples;
  if (!pts.length) return { coverage: 0, dev: 1, stars: 0, hit: T.map(() => false) };
  const hit = T.map(([x, y]) => pts.some((q) => Math.abs(q.x - x) < NEAR && Math.abs(q.y - y) < NEAR && Math.hypot(q.x - x, q.y - y) < NEAR));
  const coverage = hit.filter(Boolean).length / T.length;
  let dev = 0; for (const q of pts) { let m = 9; for (const [x, y] of T) { const d = Math.hypot(q.x - x, q.y - y); if (d < m) m = d; } dev += m; } dev /= pts.length;
  const stars = coverage >= 0.85 && dev < 0.035 ? 3 : coverage >= 0.7 && dev < 0.06 ? 2 : coverage >= 0.45 ? 1 : 0;
  return { coverage, dev, stars, hit };
}

// ---------- 交代モード ----------
export function createParty(names) { return { players: names.map((n) => ({ name: n, score: 0 })), round: 0, turn: 0, rounds: 3, log: [] }; }
export function partyDrawer(p) { return p.players[p.turn % p.players.length]; }
// guesser: 当てた人の番号（だれも当てなければ -1）
export function partyResolve(p, guesser, promptId) {
  const d = p.turn % p.players.length;
  if (guesser >= 0 && guesser !== d) { p.players[guesser].score++; p.players[d].score++; }
  p.log.push({ drawer: d, guesser, promptId });
  p.turn++; if (p.turn % p.players.length === 0) p.round++;
  return p.round >= p.rounds;
}
export function partyRanking(p) { return [...p.players].map((x, i) => ({ ...x, i })).sort((a, b) => b.score - a.score || a.i - b.i); }

// ---------- 保存 ----------
export const SAVE_KEY = 'gaze-atelier-v1';
export function emptySave() { return { v: 1, stars: {}, gallery: [], drawn: [], mode: 'pointer', opt: { volume: 0.6, reduceMotion: false } }; }
export function loadSave(storage) {
  try { const s = JSON.parse(storage.getItem(SAVE_KEY)); if (s && s.v === 1) return { ...emptySave(), ...s }; } catch { /* 壊れていたら新しく */ }
  return emptySave();
}
export function saveSave(storage, s) { try { storage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* 保存できなくても遊べる */ } }
export function addToGallery(save, entry, max = 100) {
  const g = [{ ...entry }, ...save.gallery].slice(0, max);
  const drawn = save.drawn.includes(entry.promptId) ? save.drawn : [...save.drawn, entry.promptId];
  return { ...save, gallery: g, drawn };
}
export function recordStars(save, sky, lv, stars) {
  const k = `${sky}-${lv}`; const prev = save.stars[k] || 0;
  return { ...save, stars: { ...save.stars, [k]: Math.max(prev, stars) } };
}
export function skyUnlocked(save, sky) { if (sky === 0) return true; return SKIES[sky - 1].levels.every((_, i) => (save.stars[`${sky - 1}-${i}`] || 0) > 0); }
export function levelUnlocked(save, sky, lv) { if (!skyUnlocked(save, sky)) return false; return lv === 0 || (save.stars[`${sky}-${lv - 1}`] || 0) > 0; }
