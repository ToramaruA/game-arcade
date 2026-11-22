// 雲海温泉と渡り鳥の宿 — ルール（DOM を触らない）。
// 1秒＝1tick。温度・静けさ・眺望・鳥の行動・採点・図鑑はすべてここで決める。
// 状態は JSON で丸ごと複製できる（自動プレイ・保存・予告のため）。乱数は使わない（全日が決まった需要表）。

// ---- 調整できる値（ここにまとめる） ----
export const TUNE = {
  bathTicks: 12, // 入浴の長さ（秒）
  waitLimit: 20, // 待てる長さ（秒）
  chairBonus: 10, // 休憩椅子に座ると待てる長さが延びる
  waitPenalty: 0.5, // 待ち1秒あたりの減点
  waitPenaltyMax: 10,
  passLine: 70, // 満足とみなす点
  greatLine: 90, // 図鑑の第三話に要る点
  clearRate: 0.6, // 日クリアに必要な満足客の割合
  dayLimit: 120, // 営業の最大秒数
  windShiftAt: 60, // 風が変わる時刻
  windWarn: 10, // 風の予告（秒前）
  windChill: 5, // 強風にさらされた湯が冷える度数
  fee: 8, tip: 4, teaFee: 2,
  teaTicks: 6, teaRange: 6,
  qMax: 4,
  refuseTempScore: 0, // 温度評価がこれ以下の湯には入らない（熱すぎ／冷たすぎ）
  supportMoney: 40,
  stageBonus: 10, // お祭り台の隣で、にぎやかな鳥が喜ぶ
  signBonus: 2, // 案内板：選ぶときの道のりが短く感じる
  pipeCost: 2,
};
export const PIPE_COST = TUNE.pipeCost;

export const SEASONS = {
  spring: { name: '春', base: 25 }, summer: { name: '夏', base: 30 },
  autumn: { name: '秋', base: 20 }, winter: { name: '冬', base: 15 },
};

// 方角。x は東へ、y は南へ増える。
export const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
export const DIR_NAMES = { N: '北', E: '東', S: '南', W: '西' };
export const DIR_LIST = ['N', 'E', 'S', 'W'];

// 客の種類（全12種）。range=好きな温度、w=[温度, 静けさ, 景色] の比重（合計100）、day=初めて来る日
export const SPECIES = {
  swan: { name: '白鳥', range: [40, 50], w: [60, 25, 15], day: 1 },
  kingfisher: { name: 'カワセミ', range: [25, 35], w: [25, 15, 60], day: 1 },
  swallow: { name: 'ツバメ', range: [30, 40], w: [40, 30, 30], noisy: true, day: 2 },
  heron: { name: 'サギ', range: [35, 45], w: [25, 60, 15], day: 8 },
  duck: { name: 'アヒル', range: [30, 40], w: [60, 25, 15], day: 9 },
  parakeet: { name: 'インコ', range: [30, 40], w: [40, 30, 30], noisy: true, day: 10 },
  owl: { name: 'フクロウ', range: [35, 45], w: [25, 60, 15], day: 15 },
  crane: { name: 'ツル', range: [40, 50], w: [25, 15, 60], day: 16 },
  whiteeye: { name: 'メジロ', range: [30, 40], w: [40, 30, 30], day: 17 },
  penguin: { name: 'ペンギン', range: [20, 30], w: [60, 25, 15], day: 22 },
  tit: { name: 'ヤマガラ', range: [35, 45], w: [25, 60, 15], day: 23 },
  rainbow: { name: '虹羽鳥', range: [35, 45], w: [40, 30, 30], day: 28 },
};
export const SPECIES_LIST = Object.keys(SPECIES);

// 設備。bath=浴槽、seats=席数、heat=温度補正、noise=隣の浴槽への騒音、desc=一覧の説明
export const FACILITIES = {
  source: { name: '源泉', cost: 0, fixed: true, desc: 'ここから床下の管でお湯が届く' },
  bath: { name: '普通の湯', cost: 20, bath: true, seats: 2, heat: 0, desc: '2席' },
  hot: { name: '保温の湯', cost: 30, bath: true, seats: 2, heat: 5, desc: '2席・+5度' },
  shallow: { name: '浅湯', cost: 20, bath: true, seats: 1, heat: -5, desc: '1席・−5度' },
  view: { name: '展望湯', cost: 30, bath: true, seats: 1, heat: 0, seeThrough: true, desc: '1席・風よけごしでも景色が見える' },
  group: { name: '団体湯', cost: 35, bath: true, seats: 3, heat: 0, desc: '3席' },
  windbreak: { name: '風よけ', cost: 8, desc: '向けた方角の強風を止める' },
  fence: { name: '吸音垣', cost: 10, desc: '隣の湯に届く声を−1' },
  teahouse: { name: '茶店', cost: 15, noise: 1, seats: 2, desc: '湯上がりに寄ると+2・隣はにぎやか' },
  chair: { name: '休憩椅子', cost: 6, seats: 2, desc: '座ると10秒長く待てる' },
  sign: { name: '案内板', cost: 8, desc: '隣の湯へ客を呼び込む' },
  flower: { name: '花壇', cost: 6, desc: '景色が見えない隣の湯を半分に' },
  stage: { name: 'お祭り台', cost: 12, noise: 1, desc: 'ツバメ・インコが+10点・隣はにぎやか' },
  tower: { name: '見晴らし塔', cost: 12, desc: '隣の展望湯の景色+0.25' },
  ornament: { name: '屋根飾り台', cost: 4, desc: '集めた屋根飾りを飾る（性能なし）' },
};

// 何日目から建てられるか
export const UNLOCKS = [
  [1, ['bath', 'windbreak']], [3, ['fence', 'teahouse']], [5, ['chair', 'sign']], [8, ['shallow', 'group']],
  [11, ['flower', 'stage']], [15, ['hot', 'view']], [18, ['tower', 'ornament']],
];
export function buildable(day) {
  const out = [];
  for (const [d, list] of UNLOCKS) if (day >= d) out.push(...list);
  return out;
}
export function newUnlocks(day) { return UNLOCKS.find(([d]) => d === day)?.[1] || []; }

export function seasonOf(day) { return day <= 7 ? 'spring' : day <= 14 ? 'summer' : day <= 21 ? 'autumn' : 'winter'; }
export function sizeOf(day) { return day <= 7 ? [4, 4] : day <= 14 ? [4, 5] : day <= 21 ? [5, 5] : [6, 6]; }
export const capOf = (day) => (day >= 15 ? 8 : 6);

// ---- 28日の需要表 ----
// wind: [開店時, 60秒以降]、strong=強風（風上が開いた湯は5度冷える）、g: [種類, 到着秒]
const g = (str) => str.split(' ').map((x) => { const [sp, at] = x.split(':'); return [sp, Number(at)]; });
export const DAYS = [
  { id: 1, name: '二つの湯', wind: ['N', 'E'], intro: '鳥の好みに合わせて、お湯を分けよう',
    guests: g('swan:0 kingfisher:8 swan:16 kingfisher:24 swan:32 swan:40') },
  { id: 2, name: 'ツバメの合唱', wind: ['E', 'S'], intro: 'ツバメはにぎやか。同じ湯や隣の湯の客は「うるさい」と感じる',
    guests: g('swallow:0 swallow:0 swallow:1 swan:4 kingfisher:6 swan:16') },
  { id: 3, name: '静かな囲い', wind: ['S', 'W'], intro: '吸音垣と茶店が建てられるようになった。静けさを守ろう',
    guests: g('swan:0 swallow:0 swallow:2 swan:3 kingfisher:14 swallow:16') },
  { id: 4, name: '北風転換', wind: ['N', 'E'], strong: true, intro: 'はじめての強風。風上が開いた湯は冷える',
    guests: g('swan:0 swan:0 swan:2 kingfisher:2 swan:56 swan:58') },
  { id: 5, name: '列の長い午後', wind: ['W', 'N'], intro: '客が続けて来る。休憩椅子があれば長く待ってくれる',
    guests: g('swan:0 swan:0 kingfisher:0 swallow:1 swan:2 swan:2') },
  { id: 6, name: '熱好きと景色好き', wind: ['E', 'W'], intro: '熱い湯の湯気は、風下の湯の景色をかくす',
    guests: g('swan:0 kingfisher:0 kingfisher:2 swan:3 kingfisher:16 swan:18') },
  { id: 7, name: '春の渡り', wind: ['W', 'S'], strong: true, intro: '春の最後は強い西風。60秒で南風に変わる',
    guests: g('swan:0 swan:0 swallow:1 kingfisher:2 swan:56 kingfisher:58') },
  { id: 8, name: 'サギの静養', wind: ['S', 'E'], intro: '夏。島が広がった。サギは静けさを何より大事にする',
    guests: g('heron:0 heron:0 heron:1 swallow:1 swallow:2 swallow:2 heron:20 swan:20') },
  { id: 9, name: '水遊びアヒル', wind: ['E', 'N'], intro: 'アヒルはちょうどいい温度が大事',
    guests: g('duck:0 duck:0 duck:1 heron:2 swallow:2 duck:18 kingfisher:18 heron:20') },
  { id: 10, name: '声の大きな客', wind: ['N', 'W'], intro: 'インコもツバメと同じくにぎやか',
    guests: g('parakeet:0 parakeet:0 parakeet:1 heron:1 heron:2 heron:2 duck:20 kingfisher:20') },
  { id: 11, name: '花の湯道', wind: ['W', 'S'], intro: '花壇とお祭り台が建てられるようになった',
    guests: g('kingfisher:0 kingfisher:0 kingfisher:1 swan:2 heron:3 duck:18 parakeet:18 kingfisher:20') },
  { id: 12, name: '夏の団体便', wind: ['S', 'N'], intro: '同じ鳥がまとめて来る。団体湯が役に立つ',
    guests: g('duck:0 duck:0 duck:0 duck:1 swallow:2 swallow:2 parakeet:3 heron:4') },
  { id: 13, name: '南風と湯気', wind: ['S', 'W'], strong: true, intro: '夏の強い南風。湯気も北へ流れる',
    guests: g('swan:0 swan:0 kingfisher:1 kingfisher:1 heron:3 duck:20 swan:20 kingfisher:22') },
  { id: 14, name: '夏の見晴らし', wind: ['E', 'S'], intro: '景色好きが多い日',
    guests: g('kingfisher:0 kingfisher:0 kingfisher:1 swallow:2 parakeet:2 kingfisher:18 swan:18 heron:20') },
  { id: 15, name: '落葉の冷え込み', wind: ['W', 'N'], strong: true, intro: '秋。冷え込んで基温20度。源泉が8つ分に増え、保温の湯と展望湯が建てられる',
    guests: g('swan:0 swan:0 owl:1 owl:1 heron:3 duck:16 owl:18 swallow:18 swan:20 heron:20') },
  { id: 16, name: 'ツルの展望', wind: ['N', 'E'], intro: 'ツルは景色がいちばん。展望湯なら風よけごしでも見える',
    guests: g('crane:0 crane:0 owl:1 swan:2 kingfisher:2 crane:18 heron:18 parakeet:20 crane:20 duck:22') },
  { id: 17, name: '小鳥の混浴', wind: ['E', 'S'], intro: '小鳥がたくさん。にぎやかな客と静かな客を分けよう',
    guests: g('whiteeye:0 whiteeye:0 swallow:1 parakeet:1 owl:2 owl:2 whiteeye:18 heron:18 swallow:20 crane:20') },
  { id: 18, name: '塔の上の風', wind: ['S', 'W'], intro: '見晴らし塔と屋根飾り台が建てられるようになった',
    guests: g('crane:0 kingfisher:0 crane:1 owl:2 swan:2 crane:18 whiteeye:18 heron:20 kingfisher:20 crane:22') },
  { id: 19, name: '東西の入替', wind: ['E', 'W'], strong: true, intro: '東の強風が、60秒で西へ入れ替わる',
    guests: g('swan:0 swan:0 owl:1 crane:1 swan:3 swan:56 swan:56 whiteeye:58 duck:58 owl:60') },
  { id: 20, name: '静養団と合唱団', wind: ['N', 'S'], intro: '静かに過ごしたい団体と、歌いたい団体が続けて来る',
    guests: g('heron:0 owl:0 heron:1 owl:1 swallow:2 parakeet:2 swallow:3 parakeet:3 heron:20 whiteeye:20') },
  { id: 21, name: '秋の渡り', wind: ['W', 'E'], strong: true, intro: '秋の最後。いろいろな鳥が強風の中やって来る',
    guests: g('swan:0 swan:0 swan:1 crane:1 owl:3 swan:56 swan:56 heron:58 crane:58 owl:60') },
  { id: 22, name: '冷湯ペンギン', wind: ['N', 'W'], intro: '冬。基温15度。ペンギンは冷たい湯（20〜30度）が好き',
    guests: g('penguin:0 penguin:0 swan:1 owl:1 penguin:3 whiteeye:3 crane:20 penguin:20 heron:22 swallow:22 penguin:24 duck:24') },
  { id: 23, name: '冬の静けさ', wind: ['E', 'N'], intro: 'ヤマガラは静かな湯が好き',
    guests: g('tit:0 tit:0 owl:1 heron:1 penguin:3 tit:3 swallow:20 parakeet:20 owl:22 tit:22 crane:24 swan:24') },
  { id: 24, name: '温泉の二極化', wind: ['W', 'S'], strong: true, intro: '熱い湯好きと冷たい湯好きが交互に来る',
    guests: g('swan:0 penguin:0 swan:1 penguin:1 crane:3 duck:3 penguin:20 swan:20 tit:22 penguin:22 owl:24 swan:24') },
  { id: 25, name: '北風に背を向けて', wind: ['N', 'W'], strong: true, intro: '冬の北風。風上を向いた湯は守れない',
    guests: g('crane:0 owl:0 penguin:1 swan:1 tit:3 crane:3 whiteeye:56 penguin:56 heron:58 crane:58 duck:60 swan:60') },
  { id: 26, name: '白鳥と氷の客', wind: ['N', 'E'], strong: true, intro: '冬の強風。熱い湯・冷たい湯・景色を、限られたお湯で両立しよう',
    guests: g('swan:0 penguin:0 crane:2 swallow:2 penguin:4 owl:4 swan:56 crane:56 swallow:58 penguin:58 owl:60 swan:60') },
  { id: 27, name: '四季の常連', wind: ['S', 'E'], intro: 'これまでの常連が次々に顔を出す',
    guests: g('kingfisher:0 swan:0 swan:1 heron:1 penguin:2 owl:3 crane:20 swan:20 swan:22 tit:22 penguin:24 parakeet:24') },
  { id: 28, name: '虹羽の到着', wind: ['N', 'E'], strong: true, intro: 'うわさの虹羽鳥がやって来る。最後の日',
    guests: g('rainbow:0 swan:0 penguin:1 crane:1 rainbow:3 owl:3 tit:56 swallow:56 rainbow:58 penguin:58 crane:60 swan:60') },
];
for (const d of DAYS) {
  d.season = seasonOf(d.id); d.size = sizeOf(d.id); d.cap = capOf(d.id); d.strong = !!d.strong;
}
export const dayIndex = (id) => DAYS.findIndex((d) => d.id === id);
export const dayOf = (id) => DAYS[dayIndex(id)];

// ---- 図鑑（12種×3話）と屋根飾り ----
export const STORIES = {
  swan: ['凍えた湖から渡ってきた白鳥。熱い湯に首までつかり、羽がふわりと開いた。', '湯道を覚えた白鳥は、今年も迷わず門をくぐる。首をかしげて会釈した。', '子どもたちを連れて帰ってきた。湯気の中で、小さな羽が並んでふくらむ。'],
  kingfisher: ['雲海を見下ろす湯で、カワセミは青い背をきらりと光らせた。', '景色のいい席を見つけるのが得意。いつも同じ角の湯へ一直線。', '雲海に映る自分の青に見とれて、くちばしで水面をつついた。'],
  swallow: ['ツバメの合唱団。湯に入ると、つい声がそろってしまう。', '静かな隅を見つけたツバメ。小声で歌う練習を始めた。', '皆で空へ。宿の上を三回まわって、南へ渡っていった。'],
  heron: ['サギは片足で湯に立ち、目を閉じたまま動かない。', '静かな湯の音だけを聞きに、遠くの湿地からやって来る。', 'ある朝、湯面に映る雲を見て、一度だけ羽を大きく広げた。'],
  duck: ['アヒルは湯に浮かんで、くるくる回るのが好き。', 'ちょうどいい温度を見つけると、尾羽を小刻みに振る。', '友だちを連れてきて、湯船いっぱいに並んで浮かんだ。'],
  parakeet: ['インコはおしゃべり好き。湯の温度を何度も実況する。', 'お祭り台の太鼓に合わせて、首を左右に振って踊った。', 'ココの口ぐせを覚えて「いらっしゃい！」と出迎えた。'],
  owl: ['昼の湯に来たフクロウ。まぶしそうに片目だけ開けている。', '静かな湯では、首をくるりと回して雲海を眺める。', '夜の森の話をひとつだけ。羽音もなく帰っていった。'],
  crane: ['ツルは雲海の見える湯で、長い首をすっと伸ばした。', '風よけの向こうの景色まで、背伸びしてのぞきこむ。', '番いで来て、湯上がりに雲の上で舞いを見せてくれた。'],
  whiteeye: ['メジロは目のまわりの白い輪が自慢。湯でも輪はくっきり。', '花壇の花をつついてから湯に入るのが決まりらしい。', '仲間とぎゅうぎゅうに並んで、目白押しで湯につかった。'],
  penguin: ['南の氷から来たペンギン。ぬるい湯で、ぺたぺた足踏み。', '熱い湯の前では立ち止まり、冷たい湯を自分で探す。', '帰りぎわ、ココに小さな氷のかけらをくれた。'],
  tit: ['ヤマガラは静かな湯で、木の実を一粒ずつ数えている。', '吸音垣のかげが気に入って、毎朝そこへ通う。', '数えた木の実を一粒、宿の屋根に置いていった。'],
  rainbow: ['虹羽の鳥のうわさ。雲海のどこかに、七色の羽が見えたという。', '湯気に羽が映って、宿の上に小さな虹がかかった。', '四季の手紙を落としていった。春夏秋冬の羽が一枚ずつ。'],
};
export const ORNAMENTS = [
  { id: 'leaf', name: '若葉' }, { id: 'cloud', name: '雲' }, { id: 'flower', name: '花' }, { id: 'drop', name: '雨粒' },
  { id: 'shell', name: '貝' }, { id: 'mill', name: '風車' }, { id: 'maple', name: '紅葉' }, { id: 'snow', name: '雪片' },
  { id: 'feather', name: '鳥羽' }, { id: 'rainbow', name: '虹' },
];

export function emptyDex() {
  const d = {};
  for (const sp of SPECIES_LIST) d[sp] = { n: 0, s: [false, false, false] };
  return d;
}
// 日をクリアしたときだけ図鑑に足す。戻り値 { dex, news:[{sp, k}] }
export function dexApply(dex0, s) {
  const dex = JSON.parse(JSON.stringify(dex0 || emptyDex()));
  for (const sp of SPECIES_LIST) dex[sp] ||= { n: 0, s: [false, false, false] };
  const news = [];
  const c70 = {}; const c90 = {};
  for (const x of s.guests) {
    if ((x.sat ?? 0) >= TUNE.passLine) c70[x.sp] = (c70[x.sp] || 0) + 1;
    if ((x.sat ?? 0) >= TUNE.greatLine) c90[x.sp] = (c90[x.sp] || 0) + 1;
  }
  for (const sp of SPECIES_LIST) {
    const e = dex[sp];
    e.n += c70[sp] || 0;
    const want = [e.n >= 1, e.n >= 3, (c90[sp] || 0) >= 2];
    want.forEach((w, k) => { if (w && !e.s[k]) { e.s[k] = true; news.push({ sp, k }); } });
  }
  return { dex, news };
}
export const ornamentCount = (dex) => Math.min(ORNAMENTS.length, SPECIES_LIST.filter((sp) => dex?.[sp]?.s?.[1]).length);
export const storyCount = (dex) => SPECIES_LIST.reduce((a, sp) => a + (dex?.[sp]?.s || []).filter(Boolean).length, 0);

// ---- 宿（日をまたいで引き継ぐもの） ----
export function initialInn() {
  const W = 4; const H = 4;
  const pipes = Array.from({ length: H }, () => Array(W).fill(false));
  for (const [x, y] of [[3, 1], [2, 1], [1, 1]]) pipes[y][x] = true;
  return {
    W, H, money: 60, nid: 4, pipes,
    items: [
      { id: 1, type: 'source', x: 3, y: 0, q: 0, dir: 'N' },
      { id: 2, type: 'bath', x: 1, y: 2, q: 1, dir: 'N', name: '左の湯' },
      { id: 3, type: 'bath', x: 3, y: 2, q: 1, dir: 'N', name: '右の湯' },
    ],
  };
}

// 終わった日の状態から、次の日に引き継ぐ宿を取り出す
export function innOf(s) {
  return { W: s.W, H: s.H, money: s.money, nid: s.nid, pipes: s.pipes.map((r) => r.slice()), items: s.items.map((it) => ({ ...it })) };
}

// ---- 状態 ----
export function createState(dayId, opts = {}) {
  const d = dayOf(dayId);
  if (!d) throw new Error(`no day ${dayId}`);
  const inn = JSON.parse(JSON.stringify(opts.inn || initialInn()));
  const [W, H] = [Math.max(inn.W, d.size[0]), Math.max(inn.H, d.size[1])];
  const pipes = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => !!inn.pipes[y]?.[x]));
  const guests = d.guests.map(([sp, at], i) => ({
    id: i + 1, sp, at, st: 'pending', x: 0, y: 0, path: [], target: 0,
    waited: 0, limit: TUNE.waitLimit, bathT: 0, acc: [0, 0, 0, 0], sat: null, why: '', chair: 0, chairUsed: false, teaT: 0,
  }));
  const s = {
    day: d.id, W, H, base: SEASONS[d.season].base, cap: d.cap, strong: d.strong,
    wind0: d.wind[0], wind1: d.wind[1], t: 0, phase: 'prep',
    items: inn.items, pipes, guests, nid: inn.nid,
    money: Math.max(inn.money, TUNE.supportMoney), earned: 0, teaMoney: 0,
  };
  // 毎朝、湯は抜いてある（弁は閉じた状態から。第1日の手引きだけは最初から少し張ってある）
  if (d.id !== 1) for (const b of baths(s)) b.q = 0;
  let over = heatUsed(s) - s.cap;
  for (const b of [...baths(s)].reverse()) { if (over <= 0) break; const k = Math.min(b.q, over); b.q -= k; over -= k; }
  syncSupply(s);
  return s;
}

export const cloneState = (s) => JSON.parse(JSON.stringify(s));

export const windAt = (s, t = s.t) => (t >= TUNE.windShiftAt ? s.wind1 : s.wind0);
export const isBath = (it) => !!FACILITIES[it?.type]?.bath;
export const baths = (s) => s.items.filter(isBath);
export const itemAt = (s, x, y) => s.items.find((it) => it.x === x && it.y === y);
export const itemById = (s, id) => s.items.find((it) => it.id === id);
export const inside = (s, x, y) => x >= 0 && y >= 0 && x < s.W && y < s.H;
export const isEntrance = (x, y) => x === 0 && y === 0;
export const seatsOf = (it) => FACILITIES[it.type]?.seats ?? 0;
export const heatUsed = (s) => baths(s).reduce((a, b) => a + b.q, 0);
const near4 = (s, x, y) => Object.values(DIRS).map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => inside(s, a, b));
const adjItems = (s, it, type) => near4(s, it.x, it.y).map(([x, y]) => itemAt(s, x, y)).filter((o) => o && (!type || o.type === type));

// 源泉と管がつながっている範囲（上下左右）。浴槽はその範囲の上か隣にあれば給湯される。
export function network(s) {
  const src = s.items.find((it) => it.type === 'source');
  const seen = new Set();
  if (!src) return seen;
  const st = [[src.x, src.y]];
  seen.add(`${src.x},${src.y}`);
  while (st.length) {
    const [x, y] = st.pop();
    for (const [nx, ny] of near4(s, x, y)) {
      const k = `${nx},${ny}`;
      if (s.pipes[ny][nx] && !seen.has(k)) { seen.add(k); st.push([nx, ny]); }
    }
  }
  return seen;
}
const touchesNet = (s, net, x, y) => net.has(`${x},${y}`) || near4(s, x, y).some(([a, b]) => net.has(`${a},${b}`));

export function suppliedSet(s) {
  const net = network(s);
  const out = new Set();
  for (const b of baths(s)) if (touchesNet(s, net, b.x, b.y)) out.add(b.id);
  return out;
}

// (x,y) に浴槽を置いたとき、つなぐのに要る新しい管（最短）。床下なので建物の下も通せる
export function pipeRoute(s, x, y) {
  const net = network(s);
  if (touchesNet(s, net, x, y)) return [];
  const prev = new Map();
  const q = [];
  for (const k of net) { prev.set(k, null); q.push(k.split(',').map(Number)); }
  while (q.length) {
    const [cx, cy] = q.shift();
    for (const [nx, ny] of near4(s, cx, cy)) {
      const k = `${nx},${ny}`;
      if (prev.has(k)) continue;
      prev.set(k, `${cx},${cy}`);
      if (Math.abs(nx - x) + Math.abs(ny - y) <= 1) {
        const out = []; let cur = k;
        while (cur && !net.has(cur)) { out.unshift(cur.split(',').map(Number)); cur = prev.get(cur); }
        return out;
      }
      q.push([nx, ny]);
    }
  }
  return null;
}

// 管が切れた浴槽は弁を閉じる（合計の数字と見た目を一致させる）
function syncSupply(s) {
  const sup = suppliedSet(s);
  for (const b of baths(s)) if (!sup.has(b.id)) b.q = 0;
  return sup;
}

const reservedCount = (s, b) => s.guests.filter((x) => (x.st === 'walk' || x.st === 'bath') && x.target === b.id).length;
export const usersOf = (s, b) => s.guests.filter((x) => (x.st === 'walk' || x.st === 'bath') && x.target === b.id);

// 浴槽 b を守る風よけ（風上の隣で、風へ向いたもの）
export function shieldOf(s, b, wind) {
  const [wx, wy] = DIRS[wind];
  const wb = itemAt(s, b.x + wx, b.y + wy);
  return wb && wb.type === 'windbreak' && wb.dir === wind ? wb : null;
}

// 各浴槽の温度・風・眺望・騒音をまとめて出す（予告と実際で同じ関数を使う）
export function metrics(s, t = s.t) {
  const wind = windAt(s, t);
  const [wx, wy] = DIRS[wind];
  const sup = suppliedSet(s);
  const out = {};
  const bs = baths(s);
  for (const b of bs) {
    const F = FACILITIES[b.type];
    // 強風：風上の隣に、風へ向けた風よけがなければ冷える（島の端で風上が外なら守れない）
    let exposed = false; let shield = null; let edge = false;
    if (s.strong) {
      shield = shieldOf(s, b, wind);
      exposed = !shield;
      edge = !inside(s, b.x + wx, b.y + wy);
    }
    const on = sup.has(b.id) && b.q > 0;
    const T = s.base + 5 * b.q + F.heat - (exposed ? TUNE.windChill : 0);
    // 眺望：四方のどれかに、島の外まで建物のない直線
    const rays = {};
    let view = 0;
    for (const [dn, [dx, dy]] of Object.entries(DIRS)) {
      let x = b.x + dx; let y = b.y + dy; let blocker = null;
      while (inside(s, x, y)) {
        const it = itemAt(s, x, y);
        if (it && !(F.seeThrough && it.type === 'windbreak')) { blocker = it; break; }
        x += dx; y += dy;
      }
      rays[dn] = blocker ? blocker.id : null;
      if (!blocker) view = 1;
    }
    out[b.id] = {
      id: b.id, T, on, exposed, shield: shield?.id || null, edge, view, rays, steamBy: null, flower: false, tower: false,
      noise: 0, noiseBy: [], staticNoise: [], fenced: false, stage: false, sign: false, supplied: sup.has(b.id),
    };
  }
  // 湯気：弁3以上の湯の風下1マスの浴槽は眺望0
  for (const b of bs) {
    if (b.q >= 3 && sup.has(b.id)) {
      const down = itemAt(s, b.x - wx, b.y - wy);
      if (down && out[down.id]) { out[down.id].view = 0; out[down.id].steamBy = b.id; }
    }
  }
  for (const b of bs) {
    const m = out[b.id];
    const adj = adjItems(s, b);
    // 花壇：景色が建物でふさがれた湯を半分に（湯気のときは効かない）
    if (m.view === 0 && !m.steamBy && adj.some((o) => o.type === 'flower')) { m.view = 0.5; m.flower = true; }
    // 見晴らし塔：隣の展望湯の景色 +0.25
    if (b.type === 'view' && adj.some((o) => o.type === 'tower') && !m.steamBy) { m.view = Math.min(1, m.view + 0.25); m.tower = true; }
    // 騒音：隣（と同じ浴槽）で入浴中のツバメ・インコ、隣の茶店・お祭り台。吸音垣が隣にあれば −1
    for (const x of s.guests) {
      if (x.st !== 'bath' || !SPECIES[x.sp].noisy) continue;
      const tb = itemById(s, x.target);
      if (tb && Math.abs(tb.x - b.x) + Math.abs(tb.y - b.y) <= 1) { m.noise += 1; m.noiseBy.push(x.id); }
    }
    for (const o of adj) if (FACILITIES[o.type].noise) { m.noise += FACILITIES[o.type].noise; m.staticNoise.push(o.id); }
    m.fenced = adj.some((o) => o.type === 'fence');
    m.stage = adj.some((o) => o.type === 'stage');
    m.sign = adj.some((o) => o.type === 'sign');
  }
  return out;
}

export const quietScore = (noise) => (noise <= 0 ? 1 : noise === 1 ? 0.5 : 0);
export function tempScore(sp, T) {
  const [lo, hi] = SPECIES[sp].range;
  if (T >= lo && T <= hi) return 1;
  const d = T < lo ? lo - T : T - hi;
  return Math.max(0, 1 - 0.1 * d);
}

// ある客が、ある浴槽に入ったときの今の点数（0〜100）と内訳
export function evaluate(s, x, b, m) {
  const sp = SPECIES[x.sp];
  const mm = m[b.id];
  let noise = mm.noise;
  if (sp.noisy && mm.noiseBy.includes(x.id)) noise -= 1; // 自分の声は数えない
  if (mm.fenced) noise -= 1;
  noise = Math.max(0, noise);
  const t = mm.on ? tempScore(x.sp, mm.T) : 0;
  const q = quietScore(noise);
  const v = mm.view;
  const bonus = sp.noisy && mm.stage ? TUNE.stageBonus : 0;
  const total = Math.min(100, sp.w[0] * t + sp.w[1] * q + sp.w[2] * v + bonus);
  return { total, t, q, v, bonus, noise, T: mm.T, on: mm.on };
}

// ---- 経路 ----
export function walkable(s, x, y) { return inside(s, x, y) && !itemAt(s, x, y); }

export function bfs(s, fx, fy) {
  const dist = Array.from({ length: s.H }, () => Array(s.W).fill(-1));
  const prev = Array.from({ length: s.H }, () => Array(s.W).fill(null));
  if (!inside(s, fx, fy)) return { dist, prev };
  dist[fy][fx] = 0;
  const q = [[fx, fy]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [nx, ny] of near4(s, x, y)) {
      if (walkable(s, nx, ny) && dist[ny][nx] < 0) { dist[ny][nx] = dist[y][x] + 1; prev[ny][nx] = [x, y]; q.push([nx, ny]); }
    }
  }
  return { dist, prev };
}

// 設備の入口（隣の歩けるマス）のうち、いちばん近いもの
export function nearestDoor(s, it, field) {
  let best = null;
  for (const [x, y] of near4(s, it.x, it.y)) {
    const d = field.dist[y][x];
    if (d >= 0 && (!best || d < best.d)) best = { x, y, d };
  }
  return best;
}

function pathTo(field, x, y) {
  const out = [];
  let cur = [x, y];
  while (cur && field.dist[cur[1]][cur[0]] > 0) { out.unshift(cur); cur = field.prev[cur[1]][cur[0]]; }
  return out;
}

// 客の浴槽選び：到達でき、席が空き、湯が出ている浴槽から「今の点数 − 道のり」が最大のもの
export function chooseBath(s, x, m = metrics(s)) {
  const field = bfs(s, x.x, x.y);
  let best = null; const reasons = [];
  for (const b of baths(s)) {
    const mm = m[b.id];
    if (!mm.on) { reasons.push('closed'); continue; }
    if (reservedCount(s, b) >= seatsOf(b)) { reasons.push('full'); continue; }
    const door = nearestDoor(s, b, field);
    if (!door) { reasons.push('noroute'); continue; }
    const ev = evaluate(s, x, b, m);
    if (ev.t <= TUNE.refuseTempScore) { reasons.push(ev.T > SPECIES[x.sp].range[1] ? 'hot' : 'cold'); continue; }
    const d = Math.max(0, door.d - (mm.sign ? TUNE.signBonus : 0));
    const score = ev.total - (d + 1);
    const cand = { b, door, score, d };
    if (!best || score > best.score || (score === best.score && (cand.d < best.d || (cand.d === best.d && b.id < best.b.id)))) best = cand;
  }
  return { best, reasons, field };
}

const WHY_WAIT = {
  full: '空いている湯がない', hot: 'どの湯も熱すぎる', cold: 'どの湯もぬるすぎる',
  closed: '湯が出ていない', noroute: '湯までの道がない',
};
function waitReason(reasons) {
  for (const k of ['hot', 'cold', 'full', 'noroute', 'closed']) if (reasons.includes(k)) return WHY_WAIT[k];
  return '湯がない';
}

// 空いている休憩椅子（入口から行けるもの）
function freeChair(s, x) {
  const field = bfs(s, x.x, x.y);
  let best = null;
  for (const c of s.items) {
    if (c.type !== 'chair') continue;
    if (s.guests.filter((o) => o.st === 'wait' && o.chair === c.id).length >= seatsOf(c)) continue;
    const door = nearestDoor(s, c, field);
    if (door && (!best || door.d < best.door.d)) best = { c, door };
  }
  return best;
}

// 湯上がりに寄る茶店（道のり TUNE.teaRange 以内で、席が空いているもの）
function freeTea(s, x) {
  const field = bfs(s, x.x, x.y);
  let best = null;
  for (const c of s.items) {
    if (c.type !== 'teahouse') continue;
    if (s.guests.filter((o) => (o.st === 'walk2' || o.st === 'tea') && o.target === c.id).length >= seatsOf(c)) continue;
    const door = nearestDoor(s, c, field);
    if (door && door.d <= TUNE.teaRange && (!best || door.d < best.door.d)) best = { c, door, field };
  }
  return best;
}

// ---- 1秒すすめる ----
export function tick(s) {
  const ev = [];
  if (s.phase === 'prep') s.phase = 'open';
  if (s.phase !== 'open') return ev;
  const t = s.t;
  if (t === TUNE.windShiftAt && s.wind0 !== s.wind1) ev.push({ type: 'wind', dir: s.wind1 });
  let m = metrics(s, t);
  // 到着
  for (const x of s.guests) if (x.st === 'pending' && x.at === t) { x.st = 'wait'; x.x = 0; x.y = 0; ev.push({ type: 'arrive', g: x.id }); }
  // 予約中に弁が閉じた → 待ちへ戻す
  for (const x of s.guests) {
    if (x.st !== 'walk') continue;
    const b = itemById(s, x.target);
    if (!b || !m[b.id]?.on) { x.st = 'wait'; x.target = 0; x.path = []; x.why = '向かっていた湯が止まった'; }
  }
  // 待っている客が湯を選ぶ（到着順）。選べなければ空いた椅子に座る
  for (const x of s.guests) {
    if (x.st !== 'wait') continue;
    const { best, reasons, field } = chooseBath(s, x, m);
    if (best) {
      x.st = 'walk'; x.target = best.b.id; x.path = pathTo(field, best.door.x, best.door.y); x.why = ''; x.chair = 0;
      ev.push({ type: 'reserve', g: x.id, b: best.b.id });
    } else {
      x.why = waitReason(reasons);
      if (!x.chairUsed) {
        const fc = freeChair(s, x);
        if (fc) { x.chair = fc.c.id; x.chairUsed = true; x.limit += TUNE.chairBonus; x.x = fc.door.x; x.y = fc.door.y; ev.push({ type: 'sit', g: x.id, c: fc.c.id }); }
      }
    }
  }
  // 移動（1マス/秒）。入口に着いていれば湯に入る
  for (const x of s.guests) {
    if (x.st === 'walk') {
      if (x.path.length) { const [nx, ny] = x.path.shift(); x.x = nx; x.y = ny; }
      else { x.st = 'bath'; x.bathT = 0; x.entered = t; ev.push({ type: 'enter', g: x.id, b: x.target }); }
    } else if (x.st === 'walk2') {
      if (x.path.length) { const [nx, ny] = x.path.shift(); x.x = nx; x.y = ny; }
      else { x.st = 'tea'; x.teaT = 0; }
    } else if (x.st === 'tea') {
      x.teaT += 1;
      if (x.teaT >= TUNE.teaTicks) {
        x.st = 'gone'; s.money += TUNE.teaFee; s.earned += TUNE.teaFee; s.teaMoney += TUNE.teaFee;
        ev.push({ type: 'teaDone', g: x.id, pay: TUNE.teaFee });
      }
    }
  }
  m = metrics(s, t);
  // 入浴の採点
  for (const x of s.guests) {
    if (x.st !== 'bath' || x.entered === t) continue; // 入った秒は数えない
    const b = itemById(s, x.target);
    const e = evaluate(s, x, b, m);
    x.acc[0] += e.t; x.acc[1] += e.q; x.acc[2] += e.v; x.acc[3] += e.bonus; x.bathT += 1;
    if (x.bathT >= TUNE.bathTicks) finishGuest(s, x, ev, true);
  }
  // 待ち時間
  for (const x of s.guests) {
    if (x.st === 'wait' || x.st === 'walk') {
      x.waited += 1;
      if (x.st === 'wait' && x.waited >= x.limit) {
        x.st = 'gone'; x.sat = 0; x.left = 'wait'; x.chair = 0;
        ev.push({ type: 'leave', g: x.id, why: x.why || '待ちくたびれた' });
      }
    }
  }
  s.t += 1;
  if (dayOver(s)) closeDay(s, ev);
  return ev;
}

export function satOf(s, x) {
  if (!x.bathT) return 0;
  const w = SPECIES[x.sp].w;
  const avg = Math.min(100, (w[0] * x.acc[0] + w[1] * x.acc[1] + w[2] * x.acc[2] + x.acc[3]) / x.bathT);
  const pen = Math.min(TUNE.waitPenaltyMax, x.waited * TUNE.waitPenalty);
  return Math.max(0, Math.round(avg - pen));
}

function finishGuest(s, x, ev, canTea) {
  x.sat = satOf(s, x);
  const pay = TUNE.fee + (x.sat >= TUNE.passLine ? TUNE.tip : 0);
  s.money += pay; s.earned += pay;
  const tea = canTea ? freeTea(s, x) : null;
  x.bathOf = x.target;
  if (tea) { x.st = 'walk2'; x.target = tea.c.id; x.path = pathTo(tea.field, tea.door.x, tea.door.y); }
  else x.st = 'gone';
  ev.push({ type: 'done', g: x.id, sat: x.sat, pay, tea: !!tea });
}

export function dayOver(s) {
  return s.t >= TUNE.dayLimit || s.guests.every((x) => x.st === 'gone');
}

function closeDay(s, ev) {
  for (const x of s.guests) {
    if (x.st === 'gone') continue;
    if (x.st === 'bath' && x.bathT > 0) finishGuest(s, x, ev, false);
    else if (x.st === 'walk2' || x.st === 'tea') x.st = 'gone';
    else { x.st = 'gone'; x.sat = 0; x.left = 'time'; }
  }
  // 維持費（浴槽2、ほかの建物1、源泉・管は無料）
  let upkeep = 0;
  for (const it of s.items) if (it.type !== 'source') upkeep += isBath(it) ? 2 : 1;
  s.upkeep = upkeep;
  s.money = Math.max(0, s.money - upkeep);
  s.phase = 'done';
  ev.push({ type: 'close' });
}

export function summary(s) {
  const n = s.guests.length;
  const good = s.guests.filter((x) => (x.sat ?? 0) >= TUNE.passLine).length;
  const need = Math.ceil(n * TUNE.clearRate);
  const avg = s.guests.reduce((a, x) => a + (x.sat ?? 0), 0) / n;
  return { n, good, need, rate: good / n, cleared: good >= need, earned: s.earned, upkeep: s.upkeep ?? 0, tea: s.teaMoney || 0, avg };
}

// ---- 操作（弁・回転・建設・移動・撤去・管） ----
// edit: {op:'valve', id, q} | {op:'rotate', id, dir} | {op:'build', type, x, y, dir?} | {op:'move', id, x, y}
//       | {op:'remove', id} | {op:'pipe', x, y} | {op:'unpipe', x, y}
// building=true のときだけ建設系を許す（準備中か一時停止中）。
// 浴槽を置く・動かすときは、源泉につながる管を自動で引く（1本 TUNE.pipeCost）。
export function checkEdit(s, e, { building = s.phase === 'prep', day = s.day } = {}) {
  const it = e.id ? itemById(s, e.id) : null;
  if (s.phase === 'done') return no('この日は終わった');
  switch (e.op) {
    case 'valve': {
      if (!it || !isBath(it)) return no('浴槽ではない');
      if (e.q < 0 || e.q > TUNE.qMax) return no(`弁は0〜${TUNE.qMax}`);
      if (e.q > 0 && !suppliedSet(s).has(it.id)) return no('管が源泉につながっていない');
      const rest = heatUsed(s) - it.q + e.q;
      if (rest > s.cap) return no(`お湯が足りない（残り${s.cap - heatUsed(s)}）。ほかの湯の弁を閉めると回せる`);
      return ok();
    }
    case 'rotate':
      if (!it || it.type !== 'windbreak') return no('風よけではない');
      if (!DIRS[e.dir]) return no('向きが変');
      return ok();
    case 'build': case 'move': case 'pipe': case 'unpipe': case 'remove':
      if (!building) return no('建てる・動かすのは一時停止中だけ');
      break;
    default: return no('不明な操作');
  }
  if (e.op === 'pipe' || e.op === 'unpipe') {
    if (!inside(s, e.x, e.y)) return no('島の外');
    const has = s.pipes[e.y][e.x];
    if (e.op === 'pipe' && has) return no('もう管がある');
    if (e.op === 'unpipe' && !has) return no('管がない');
    if (e.op === 'pipe' && s.money < PIPE_COST) return no('お金が足りない');
    return ok(e.op === 'pipe' ? -PIPE_COST : 0);
  }
  if (e.op === 'remove') {
    if (!it || FACILITIES[it.type].fixed) return no('動かせない');
    if (isBath(it) && reservedCount(s, it) > 0) return no('お客さんが使っている');
    if (s.guests.some((x) => (x.st === 'walk2' || x.st === 'tea') && x.target === it.id)) return no('お客さんが使っている');
    if (s.guests.some((x) => x.st === 'wait' && x.chair === it.id)) return no('お客さんが座っている');
    return ok(Math.floor(FACILITIES[it.type].cost / 2));
  }
  const x = e.x; const y = e.y;
  if (!inside(s, x, y)) return no('島の外');
  if (isEntrance(x, y)) return no('入口には置けない');
  const there = itemAt(s, x, y);
  if (there && there !== it) return no('ほかの設備がある');
  if (s.guests.some((o) => ['wait', 'walk', 'walk2'].includes(o.st) && o.x === x && o.y === y)) return no('お客さんが立っている');
  let cost = 0;
  const type = e.op === 'build' ? e.type : it?.type;
  if (e.op === 'build') {
    const F = FACILITIES[e.type];
    if (!F || F.fixed) return no('建てられない');
    if (!buildable(day).includes(e.type)) return no('まだ建てられない');
    cost = -F.cost;
  } else {
    if (!it || FACILITIES[it.type].fixed) return no('動かせない');
    if (isBath(it) && reservedCount(s, it) > 0) return no('お客さんが使っている');
    if (s.guests.some((o) => (o.st === 'walk2' || o.st === 'tea') && o.target === it.id)) return no('お客さんが使っている');
    if (s.guests.some((o) => o.st === 'wait' && o.chair === it.id)) return no('お客さんが座っている');
  }
  let pipes = [];
  if (FACILITIES[type].bath) {
    pipes = pipeRoute(s, x, y) || [];
    cost -= pipes.length * PIPE_COST;
  }
  if (s.money + cost < 0) return no(`お金が足りない（${-cost}要る）`);
  // 置いた後に、向かっている客の道がふさがらないか
  // 歩けるかどうかは設備の位置だけで決まるので、設備だけ写した軽い試し盤で調べる
  let titems;
  if (e.op === 'build') titems = [...s.items, { id: -1, type: e.type, x, y }];
  else titems = s.items.map((i) => (i === it ? { ...i, x, y } : i));
  const trial = { ...s, items: titems };
  for (const o of trial.guests) {
    if (o.st !== 'walk' && o.st !== 'walk2') continue;
    const b = itemById(trial, o.target);
    const f = bfs(trial, o.x, o.y);
    if (!b || !nearestDoor(trial, b, f)) return no('お客さんの通り道がふさがる');
  }
  // 入口から、どの浴槽にも行けなくなる置き方は拒否
  const f0 = bfs(trial, 0, 0);
  for (const b of baths(trial)) if (!nearestDoor(trial, b, f0)) return no(`${labelOf(b)}へ行く道がふさがる`);
  return ok(cost, pipes);
}

const ok = (money = 0, pipes = []) => ({ ok: true, money, pipes });
const no = (reason) => ({ ok: false, reason });
export const labelOf = (it) => it.name || FACILITIES[it.type].name;

function applyRaw(s, e, pipes = []) {
  const it = e.id ? itemById(s, e.id) : null;
  switch (e.op) {
    case 'valve': it.q = e.q; break;
    case 'rotate': it.dir = e.dir; break;
    case 'build': s.items.push({ id: s.nid++, type: e.type, x: e.x, y: e.y, q: 0, dir: e.dir || windAt(s) }); break;
    case 'move': it.x = e.x; it.y = e.y; break;
    case 'remove': s.items = s.items.filter((i) => i !== it); break;
    case 'pipe': s.pipes[e.y][e.x] = true; break;
    case 'unpipe': s.pipes[e.y][e.x] = false; break;
    default: break;
  }
  for (const [px, py] of pipes) s.pipes[py][px] = true;
}

export function applyEdit(s, e, opts) {
  const c = checkEdit(s, e, opts);
  if (!c.ok) return c;
  applyRaw(s, e, c.pipes);
  s.money += c.money;
  syncSupply(s);
  return c;
}

// 予告：操作した後の各浴槽の様子（操作前と同じ関数で出す）
export function preview(s, e, opts) {
  const c = checkEdit(s, e, opts);
  if (!c.ok) return c;
  const t = cloneState(s);
  applyRaw(t, e, c.pipes); t.money += c.money; syncSupply(t);
  return { ...c, state: t, metrics: metrics(t) };
}

// 客をタップしたときの説明
export function explain(s, x) {
  const sp = SPECIES[x.sp];
  const [lo, hi] = sp.range;
  if (x.st === 'gone') return x.left ? `${sp.name}：${x.left === 'wait' ? '待ちくたびれて帰った' : '入れずに閉店'}（0点）` : `${sp.name}：満足 ${x.sat}点`;
  if (x.st === 'pending') return `${sp.name}：${x.at}秒に来る（${lo}〜${hi}度）`;
  if (x.st === 'walk2' || x.st === 'tea') return `${sp.name}：湯上がりに茶店でひと休み（${x.sat}点）`;
  if (x.st === 'wait') return `${sp.name}：${x.why || '湯を選んでいる'}（好み${lo}〜${hi}度・あと${Math.max(0, x.limit - x.waited)}秒待てる${x.chair ? '・椅子で休憩中' : ''}）`;
  const b = itemById(s, x.target);
  const m = metrics(s);
  const e = evaluate(s, x, b, m);
  const mark = (v) => (v >= 1 ? '○' : v > 0 ? '△' : '×');
  const mm = m[b.id];
  const tWhy = !e.on ? '湯が止まっている' : `${e.T}度${mm.exposed ? '（風で−5）' : ''}${e.T < lo ? 'でぬるい' : e.T > hi ? 'で熱い' : 'でちょうどいい'}`;
  const qWhy = e.noise <= 0 ? '静か' : e.noise === 1 ? '少しにぎやか' : 'うるさい';
  const vWhy = e.v >= 1 ? '景色が見える' : mm.steamBy ? '湯気で見えない' : e.v > 0 ? '少し見える' : '建物で見えない';
  const head = x.st === 'walk' ? `${labelOf(b)}へ向かう` : `${labelOf(b)}に入浴中`;
  return `${sp.name}：${head}　お湯${mark(e.t)}（${tWhy}）／声${mark(e.q)}（${qWhy}）／景色${mark(e.v)}（${vWhy}）${e.bonus ? '／お祭り台で上機嫌' : ''}`;
}

// 好みの一番大事なもの（一覧の表示用）
export function mainNeed(sp) {
  const w = SPECIES[sp].w;
  const i = w.indexOf(Math.max(...w));
  return ['temp', 'quiet', 'view'][i];
}
