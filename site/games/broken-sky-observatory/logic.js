// 画面に依存しないルール。
// 言葉カードを最大4枚（同じカードの重ねがけも可）並べて「観測依頼」を出す。
// 並べた順番は関係ない。仕込まれた組み合わせ（当たり）だけが空を変える。
export const MAX_SLOTS = 4;
export const STORAGE_KEY = 'broken-sky-observatory:v2';
export const HISTORY_MAX = 6;

export const GROUPS = [
  { name: '天気', cards: ['雨', '雪', '雷', '虹', '霧'] },
  { name: '空', cards: ['月', '太陽', '星', '雲'] },
  { name: 'いきもの・もの', cards: ['海', '街', '魚', '鯨', 'ねこ', 'きつね', 'うさぎ'] },
  { name: 'ほか', cards: ['団子', '布団', '槍', 'カエル', '目', '手'] },
  { name: 'ようす', cards: ['逆さ', '二つ', '落ちる', '燃える', '巨大', '黒い'] },
];
export const CARDS = GROUPS.flatMap((g) => g.cards);
const ORDER = new Map(CARDS.map((c, i) => [c, i]));
export const isCard = (c) => ORDER.has(c);

/** 並び順に関係なく同じ依頼を同じ文字列にする */
export function keyOf(cards) {
  return cards.filter(isCard).slice().sort((a, b) => ORDER.get(a) - ORDER.get(b)).join('+');
}
const split = (k) => (k ? k.split('+') : []);

// ---- 当たり ----
// keys：この現象が出る依頼（言い換えで同じ現象になるものは複数）。
// sky：背景の空。art：描く部品。kind：wonder（不思議な空）/ more（重ねがけ）/ neta（ネタ・慣用句）/ secret（隠し）
const R = (id, kind, name, line, hint, keys, sky, art) => ({ id, kind, name, line, hint, keys: keys.map((k) => keyOf(k.split(' '))), sky, art });
export const RECIPES = [
  R('empty', 'secret', '空は、空', '何も頼まずに観測した。空は、空だった。記録：異常なし。', '何も頼まないという頼み方', [''], 'dusk', []),
  // 天気
  R('rain1', 'more', '小雨', '細い雨。観測員は傘を探しはじめた。', '雨の降り始め', ['雨'], 'rain', ['rain:1']),
  R('rain2', 'more', '本降り', '雨が本気を出してきた。', '雨を重ねる', ['雨 雨'], 'rain', ['rain:2']),
  R('rain3', 'more', '豪雨', '窓の外が見えない。記録用紙が湿っている。', '雨をもっと重ねる', ['雨 雨 雨'], 'storm', ['rain:3']),
  R('rain4', 'more', '街が沈んだ', '雨を4回頼んだ結果、街は海の底になった。頼みすぎである。', '雨を限界まで', ['雨 雨 雨 雨'], 'storm', ['flood', 'rain:2']),
  R('snow1', 'more', '初雪', '今年最初の雪。観測員は少しうれしい。', '白いものが降る', ['雪'], 'snow', ['snow:1']),
  R('snow3', 'more', '大雪', '観測所の入口が埋まった。今日はここに泊まる。', '白いものを重ねる', ['雪 雪 雪'], 'snow', ['snow:3', 'snowpile']),
  R('thunder1', 'more', '遠雷', '遠くで空が鳴っている。', '空がゴロゴロ', ['雷'], 'storm', ['bolt:1']),
  R('thunder3', 'more', '雷の檻', '街が稲妻に囲まれた。避雷針が足りない。', '空のゴロゴロを重ねる', ['雷 雷 雷'], 'storm', ['bolt:5']),
  R('bolt-up', 'wonder', '昇る雷', '雷が地面から空へ落ちていく。', '雷をひっくり返す', ['雷 逆さ'], 'storm', ['bolt:3:up']),
  R('rainbow1', 'more', '虹', '雨上がり。誰かが写真を撮っている。', '七色の橋', ['虹'], 'day', ['rainbow:1']),
  R('rainbow2', 'more', '二重の虹', '虹がもう一本。幸運らしい。', '七色を重ねる', ['虹 虹', '虹 二つ'], 'day', ['rainbow:2']),
  R('rainbow4', 'more', '虹の渋滞', '虹を頼みすぎて、空が混雑している。', '七色を限界まで', ['虹 虹 虹 虹'], 'day', ['rainbow:6']),
  R('black-rainbow', 'wonder', '黒い虹', '光を吸う七色が、空に橋をかけた。', '暗い色の橋', ['虹 黒い'], 'grey', ['blackRainbow']),
  R('fog', 'wonder', '濃霧', '霧で街が消えた。観測所も少し消えている。', '白くて見えない', ['霧'], 'grey', ['fog']),
  // 空
  R('moon', 'wonder', '満月', '雲ひとつない満月。', '夜の主役', ['月'], 'night', ['moon']),
  R('moon2', 'wonder', '二つの月', '月が二つある。どちらが本物かは記録しない。', '夜の主役を増やす', ['月 二つ'], 'night', ['moon:2']),
  R('moon-big', 'wonder', '近すぎる月', '月がやけに近い。クレーターの数を数えられる。', '夜の主役を大きく', ['月 巨大'], 'night', ['moon:big']),
  R('moon-black', 'wonder', '月食', '月が黒く欠けた。縁だけが赤く光っている。', '夜の主役を暗く', ['月 黒い'], 'night', ['moon:black']),
  R('moon-eye', 'wonder', '見てはいけない月', '月の表面が、こちらの顔をしている。', '夜の主役と目が合う', ['月 目'], 'night', ['forbiddenMoon']),
  R('moon-fall', 'wonder', '落ちてくる月', '月が少しずつ大きくなっている。気のせいではない。', '夜の主役が近づいてくる', ['月 落ちる'], 'red', ['moon:fall']),
  R('sun', 'wonder', '夕日', 'よくある夕日。何も壊れていない。', '昼の主役', ['太陽'], 'dusk', ['sun']),
  R('sun2', 'wonder', '二重の太陽', '昼の空に、同じ大きさの太陽がもう一つ。', '昼の主役を増やす', ['太陽 二つ'], 'day', ['doubleSun']),
  R('sun-big', 'wonder', '近すぎる太陽', 'まぶしすぎて観測不能。日焼け止めを塗った。', '昼の主役を大きく', ['太陽 巨大'], 'white', ['sun:big']),
  R('sun-black', 'wonder', '黒い太陽', '皆既日食。昼なのに星が見える。', '昼の主役を暗く', ['太陽 黒い'], 'eclipse', ['sun:black', 'stars:1']),
  R('sun-fall', 'wonder', '沈みすぎた太陽', '太陽が地平線を突き抜けて、まだ沈んでいく。', '昼の主役が落ちる', ['太陽 落ちる'], 'red', ['sun:fall', 'sunSink']),
  R('sun-rain', 'wonder', '天気雨', '晴れているのに雨が降っている。', '晴れと雨', ['太陽 雨'], 'day', ['sun', 'rain:1:dark']),
  R('stars', 'wonder', '星空', '街の灯りが消えて、星がよく見える。', '夜の小さな光', ['星'], 'night', ['stars:2']),
  R('milkyway', 'more', '天の川', '星を重ねたら川になった。', '小さな光を重ねる', ['星 星 星'], 'night', ['stars:3', 'milky']),
  R('meteor', 'wonder', '流星群', '願い事が間に合わない速さで星が落ちる。', '小さな光が落ちる', ['星 落ちる'], 'night', ['stars:2', 'meteor']),
  R('star-sea', 'wonder', '星の海', '海に星が映って、空と海の境目がない。', '小さな光と水', ['星 海'], 'night', ['stars:3', 'starSea']),
  R('cloud', 'wonder', 'くもり', 'ふつうのくもり。観測員はほっとした。', '空のわた', ['雲'], 'grey', ['cloud:2']),
  R('cloud-big', 'wonder', '入道雲', '山のような雲。夏が来た。', '空のわたを大きく', ['雲 巨大'], 'day', ['bigCloud']),
  R('cloud-fire', 'wonder', '燃える雲', '雲が燃えている。夕焼けではない。', '空のわたに火', ['雲 燃える'], 'red', ['fireCloud']),
  R('snow-fire', 'wonder', '燃える雪', '降ってくる雪が、地面に着く前に燃え尽きる。', '白いものに火', ['雪 燃える'], 'red', ['snow:2:fire']),
  // 海・街・生き物
  R('sea-up', 'wonder', '逆さの海', '空の上を波が流れ、船が逆さに吊られている。', '水をひっくり返す', ['海 逆さ'], 'night', ['invertedSea']),
  R('city-fall', 'wonder', '落ちてくる街', '空の岩盤ごと、知らない街が降りてくる。', '建物が上から', ['街 落ちる'], 'dusk', ['fallingCity']),
  R('city-up', 'wonder', '逆さの街', '空からもう一つの街がぶら下がっている。向こうにも観測所がある。', '建物をひっくり返す', ['街 逆さ'], 'dusk', ['invertedCity']),
  R('fish-cloud', 'wonder', '魚群の雲', '雲に見えたものは、すべて魚の群れだった。', '泳ぐものと空のわた', ['魚 雲'], 'day', ['fishCloud']),
  R('fish-rain', 'wonder', '魚の雨', '空から魚が降ってきた。今夜は焼き魚だ。', '泳ぐものが降る', ['魚 雨', '魚 落ちる'], 'rain', ['fishRain']),
  R('whale', 'wonder', '空を泳ぐ鯨', '鯨がゆっくり街の上を泳いでいく。', '大きな泳ぐもの', ['鯨'], 'dusk', ['whale']),
  R('whale2', 'wonder', '鯨の親子', '大きい鯨と小さい鯨。小さいほうが少し遅れている。', '大きな泳ぐものを増やす', ['鯨 二つ'], 'dusk', ['whale:2']),
  R('whale-fire', 'wonder', '燃える鯨', '空を泳ぐ鯨の背が、夕焼けごと燃えている。', '大きな泳ぐものに火', ['鯨 燃える'], 'dusk', ['burningWhale']),
  R('whale-cloud', 'wonder', '雲の鯨', '雲だと思ったら、鯨の形のまま泳ぎだした。', '大きな泳ぐものと空のわた', ['鯨 雲'], 'day', ['whale:cloud']),
  R('eye', 'wonder', '地平線の巨大な瞳', '地平線が裂け、こちらを見ている。', '大きな目', ['目 巨大'], 'red', ['eye']),
  R('eye-rain', 'wonder', '泣いている空', '空の目から雨が降っている。観測員はハンカチを貸せない。', '目から雨', ['目 雨'], 'grey', ['eye', 'rain:1']),
  R('hand', 'wonder', '降りてくる手', '雲の上から、ゆっくり指が降りてくる。', '大きな手', ['手 巨大', '手 落ちる'], 'day', ['hand']),
  // ネタ・慣用句
  R('fox-wedding', 'neta', '狐の嫁入り', '晴れているのに雨。提灯の行列が空を渡っていく。招待状は届いていない。', 'あの動物と雨', ['きつね 雨', 'きつね 雨 太陽'], 'day', ['sun', 'rain:1:dark', 'foxWedding']),
  R('cat-rain', 'neta', '猫が降る', '空から猫が降ってきた。観測員の膝に3匹着地。異常なし（猫が多い）。', 'にゃーと雨', ['ねこ 雨', 'ねこ 落ちる'], 'rain', ['rain:1', 'catRain']),
  R('cat-eye', 'neta', '猫の目のような空', '空の色が数秒ごとに変わる。まさに猫の目である。', 'にゃーの目', ['ねこ 目'], 'cycle', ['catEye', 'catRoof']),
  R('cat-big', 'neta', '空いっぱいの猫', '巨大な猫が街をのぞきこんでいる。観測の邪魔である。', 'にゃーを大きく', ['ねこ 巨大'], 'dusk', ['catGiant']),
  R('cat-moon', 'neta', '月で遊ぶ猫', '猫が月を毛糸玉のように転がしている。', 'にゃーと夜の主役', ['ねこ 月'], 'night', ['catMoon']),
  R('cat-fish', 'neta', '猫と魚の追いかけっこ', '空を泳ぐ魚を、猫が全力で追いかけている。', 'にゃーと泳ぐもの', ['ねこ 魚'], 'day', ['catChase']),
  R('maneki', 'neta', '招き猫', '雲の間から、大きな手が手招きしている。何か良いことがあるらしい。', 'にゃーの手', ['ねこ 手'], 'day', ['maneki']),
  R('rabbit-mochi', 'neta', '月で餅つき', '月でうさぎが餅をついている。本当だった。', 'ぴょんと夜の主役', ['うさぎ 月'], 'night', ['moon:big', 'rabbitMochi']),
  R('tsukimi', 'neta', 'お月見', '月とうさぎと団子がそろった。観測所に団子が届いた。おいしい。', 'ぴょんと夜の主役と、おやつ', ['うさぎ 月 団子', '月 団子'], 'night', ['moon', 'rabbitMochi', 'dango']),
  R('futon-sun', 'neta', '布団日和', '空いっぱいに布団が干されている。ふかふかである。', '寝具と昼の主役', ['布団 太陽'], 'day', ['sun', 'futonHung']),
  R('futon-fly', 'neta', '布団が吹っ飛んだ', '布団が、吹っ飛んだ。……観測所としては、記録せざるを得ない。', '寝具が……どうなる？', ['布団 落ちる', '布団 逆さ'], 'day', ['futonFly']),
  R('yari', 'neta', '槍が降る', '「槍が降っても」と言った人がいた。本当に降った。', '物騒なものが降る', ['槍 雨', '槍 落ちる'], 'storm', ['spears']),
  R('frog', 'neta', 'カエルの合唱', '雨雲の上でカエルが歌っている。観測不能なほどうるさい。', 'ケロケロと雨', ['カエル 雨'], 'rain', ['rain:1', 'frogs']),
  R('frog-up', 'neta', 'ひっくり返ったカエル', 'カエルがひっくり返って空に浮いている。理由は不明。', 'ケロケロをひっくり返す', ['カエル 逆さ'], 'day', ['frogUp']),
  // 隠し
  R('flip', 'secret', '上下逆さの観測所', '逆さを4回頼んだら、観測所ごとひっくり返った。', 'ひっくり返すことを限界まで', ['逆さ 逆さ 逆さ 逆さ'], 'dusk', ['sun', 'flip']),
  R('blackout', 'secret', '停電', '黒いを4回頼んだら、何も見えなくなった。記録：真っ暗。', '暗さを限界まで', ['黒い 黒い 黒い 黒い'], 'black', ['blackout', 'candle']),
  R('huge4', 'secret', 'すべてが巨大', 'すべてが巨大になったので、相対的に何も変わらなかった。', '大きさを限界まで', ['巨大 巨大 巨大 巨大'], 'dusk', ['sun', 'zoom']),
  R('double4', 'secret', 'すべてが二つ', '何もかもが二つに見える。観測員も二人になった。', '数を限界まで', ['二つ 二つ 二つ 二つ'], 'dusk', ['sun', 'double']),
];
export const TOTAL = RECIPES.length;
const byKey = new Map();
for (const r of RECIPES) for (const k of r.keys) byKey.set(k, r);
export const recipeById = (id) => RECIPES.find((r) => r.id === id) || null;

// ---- 外れのときの返事（ツッコミ） ----
const QUIPS = {
  雨: '雨が足りないのか、何かが足りないのか。', 団子: '空に団子は浮かばない。月見の準備にしては、何かが足りない。',
  布団: 'よく晴れている。布団を干すには最高だ。異常なし。', ねこ: '観測所の屋根で猫が寝ている。空は異常なし。',
  きつね: 'きつねは雨を待っているらしい。', うさぎ: 'うさぎは夜空を見上げている。', 槍: '物騒な依頼は受け付けていない……と言いたいところだ。',
  カエル: 'カエルは何かを待っている。たぶん、水っぽいもの。', 目: '空と目が合った気がする。気のせいだ。', 手: '誰かが手を振った気がする。',
  魚: '魚は空を泳げない。普通は。', 鯨: '遠くで低い声がした。', 海: '空と海を間違えたかもしれない。', 街: '街はいつもどおりそこにある。',
  逆さ: '観測員が逆立ちした。空は変わらない。', 二つ: '何が二つなのか、空は聞き返している。', 落ちる: '何が落ちるのか分からない。観測員のペンが落ちた。',
  燃える: '燃えるものが見当たらない。', 巨大: '何を大きくすればいいのか。', 黒い: '少し暗くなった。気のせいだ。',
};
const GENERIC = ['空は沈黙している。', '何も起きない。記録：異常なし。', '観測員はあくびをした。', '計器は眠っている。', 'その組み合わせに、空は興味がないようだ。'];
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

/** 依頼の結果。hit=当たり、near=当たりの一部だけ入っている、それ以外は外れ */
export function evaluate(cards) {
  const key = keyOf(cards);
  const hit = byKey.get(key);
  if (hit) return { key, hit: true, recipe: hit };
  const parts = split(key);
  const quipCard = parts.find((c) => QUIPS[c]);
  // 1枚だけの外れはツッコミを優先。2枚以上で当たりの一部なら「あと少し」と知らせる
  const near = parts.length >= 2 && isNear(key);
  const message = near ? '計器がわずかに揺れた。何かが、あと少しで起きそうだ。'
    : parts.length === 1 && quipCard ? QUIPS[quipCard]
      : quipCard && hash(key) % 2 ? QUIPS[quipCard] : GENERIC[hash(key) % GENERIC.length];
  return { key, hit: false, near, message };
}
/** 依頼が、どこかの当たりの「一部」になっているか（同じ枚数以上の重ねがけも含めて判定） */
export function isNear(key) {
  if (!key) return false;
  const need = count(split(key));
  for (const k of byKey.keys()) {
    if (!k || k === key) continue;
    const have = count(split(k));
    if ([...need].every(([c, n]) => (have.get(c) || 0) >= n)) return true;
  }
  return false;
}
function count(list) { const m = new Map(); for (const c of list) m.set(c, (m.get(c) || 0) + 1); return m; }

// ---- 依頼の組み立て ----
export function addCard(order, card) {
  if (!isCard(card) || order.length >= MAX_SLOTS) return order;
  return [...order, card];
}
export const removeAt = (order, i) => order.filter((_, j) => j !== i);

// ---- 状態 ----
export function newState(found = []) {
  const ids = new Set(found.filter((id) => recipeById(id)));
  return { found: ids, order: [], last: null, history: [], concealed: false };
}
export const countFound = (s) => s.found.size;
export const isFound = (s, id) => s.found.has(id);
export const isComplete = (s) => countFound(s) === TOTAL;

/** 観測：当たりなら自動で図鑑に記録。結果と、初発見かどうかを返す */
export function observe(s, order = s.order) {
  const res = evaluate(order);
  const found = new Set(s.found);
  let fresh = false;
  if (res.hit && !found.has(res.recipe.id)) { found.add(res.recipe.id); fresh = true; }
  const entry = { cards: [...order], key: res.key, id: res.hit ? res.recipe.id : null };
  const history = [entry, ...s.history.filter((h) => h.key !== res.key)].slice(0, HISTORY_MAX);
  return { ...s, found, last: { ...res, cards: [...order], fresh }, history };
}

/** 未発見のヒント（最大3件）。ネタ・隠しを含め、まだ見つけていないものから選ぶ */
export function hints(s) {
  // 雨ばかりにならないよう、決まった順に混ぜてから3件（遊ぶたびに同じ順で安定）
  return RECIPES.filter((r) => !isFound(s, r.id) && r.kind !== 'secret')
    .sort((a, b) => hash(a.id) - hash(b.id)).slice(0, 3).map((r) => r.hint);
}
/** 図鑑の1枠：未発見は番号以外の情報を返さない */
export function codexEntry(s, i) {
  const r = RECIPES[i];
  if (!isFound(s, r.id)) return { no: i + 1, found: false };
  return { no: i + 1, found: true, id: r.id, name: r.name, line: r.line, kind: r.kind, order: split(r.keys[0]) };
}
export function kindCounts(s) {
  const out = {};
  for (const r of RECIPES) { out[r.kind] = out[r.kind] || [0, 0]; out[r.kind][1] += 1; if (isFound(s, r.id)) out[r.kind][0] += 1; }
  return out;
}

// ---- 保存 ----
export const serialize = (s) => JSON.stringify([...s.found]);
export function parseSaved(raw) {
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a.filter((id) => typeof id === 'string' && recipeById(id)) : []; } catch { return []; }
}

// ---- 共有 ----
export function shareText(s, concealed = s.concealed) {
  const n = countFound(s);
  const tag = '#空が壊れるまで';
  const L = s.last;
  if (!L || !L.hit) return `異常気象観測所で空を観測中。発見 ${n}/${TOTAL}。${tag}`;
  const cards = L.cards.length ? L.cards.map((c) => `「${c}」`).join('') : '（何も頼まない）';
  if (concealed) return `${'「？」'.repeat(Math.max(1, L.cards.length))}を観測依頼したら、空が変わった。発見 ${n}/${TOTAL}。${tag}`;
  return `${cards}を観測依頼したら『${L.recipe.name}』。発見 ${n}/${TOTAL}。${tag}`;
}
