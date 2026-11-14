// 夜明けを盗んだ魔女の旅 — データ（カード・敵・地点）。DOM を触らない。
export const MAX_HP = 36;
export const ENERGY = 3;
export const DRAW = 5;
export const HAND_MAX = 8;
export const CHAIN_HP = 6; // 檻の鎖1本の強さ。攻撃の札で壊す（火花1枚でちょうど1本）
export const REST_HEAL = 10;
export const CHAPTER_HEAL = 6;
export const MIN_DECK_FOR_REMOVE = 6; // 残りが5枚以下になる除去はできない

// 効果命令：damage / block / draw / weak / cleanse / retrieve / heal / energy（＋ damage の全体版 all）
// target: 'enemy'（敵1体を選ぶ）/ 'all'（敵全体）/ 'self'（自分）
export const CARDS = {
  spark: { no: 1, name: '火花', cost: 1, target: 'enemy', fx: [{ op: 'damage', n: 6 }], text: '6ダメージ' },
  ward: { no: 2, name: '防壁', cost: 1, target: 'self', fx: [{ op: 'block', n: 4 }], text: '4防ぐ' },
  kindle: { no: 3, name: '焚き付け', cost: 0, target: 'self', fx: [{ op: 'draw', n: 1 }], exhaust: true, text: '1枚引く・除外' },
  lance: { no: 4, name: '炎の槍', cost: 2, target: 'enemy', fx: [{ op: 'damage', n: 14 }], text: '14ダメージ' },
  rain: { no: 5, name: '火の雨', cost: 2, target: 'all', fx: [{ op: 'damage', n: 5, all: true }], text: '全ての敵に5' },
  ember: { no: 6, name: '熾火', cost: 1, target: 'enemy', fx: [{ op: 'damage', n: 4 }, { op: 'draw', n: 1 }], text: '4ダメージ・1枚引く' },
  twin: { no: 7, name: '二連火', cost: 1, target: 'enemy', fx: [{ op: 'damage', n: 3, hits: 2 }], text: '3ダメージ×2' },
  chase: { no: 8, name: '追い火', cost: 1, target: 'enemy', fx: [{ op: 'damage', n: 5, low: 9 }], text: '5ダメージ。相手のHPが半分以下なら9' },
  armorfire: { no: 9, name: '鎧火', cost: 2, target: 'enemy', fx: [{ op: 'damage', n: 8 }, { op: 'block', n: 6 }], text: '8ダメージ・6防ぐ' },
  ashshield: { no: 10, name: '灰の盾', cost: 2, target: 'self', fx: [{ op: 'block', n: 11 }], text: '11防ぐ' },
  mist: { no: 11, name: '霧の衣', cost: 0, target: 'self', fx: [{ op: 'block', n: 3 }], exhaust: true, text: '3防ぐ・除外' },
  sleep: { no: 12, name: '眠り粉', cost: 1, target: 'all', fx: [{ op: 'weak', n: 1, all: true }], text: '全ての敵を弱体（次の攻撃が1打ごと2減る）' },
  keeper: { no: 13, name: '火守り', cost: 1, target: 'self', fx: [{ op: 'block', n: 3 }, { op: 'draw', n: 1 }], text: '3防ぐ・1枚引く' },
  sweep: { no: 14, name: '煤払い', cost: 1, target: 'self', fx: [{ op: 'cleanse' }, { op: 'block', n: 4 }], text: '自分の弱体を消す・4防ぐ' },
  afterglow: { no: 15, name: '残り火', cost: 1, target: 'self', fx: [{ op: 'retrieve' }], exhaust: true, text: '捨て札の一番上の攻撃札を手札へ・除外' },
  nightwalk: { no: 16, name: '夜渡り', cost: 1, target: 'self', fx: [{ op: 'draw', n: 2 }], text: '2枚引く' },
  dew: { no: 17, name: '朝露', cost: 1, target: 'self', fx: [{ op: 'heal', n: 4 }], exhaust: true, text: 'HP4回復・除外' },
  sunshard: { no: 18, name: '太陽片', cost: 2, target: 'enemy', fx: [{ op: 'damage', n: 10, perRescued: 2 }], text: '10ダメージ。救った仲間1人につき+2' },
  torch: { no: 19, name: '炬火', cost: 3, target: 'all', fx: [{ op: 'damage', n: 12, all: true }], text: '全ての敵に12' },
  ring: { no: 20, name: '守りの輪', cost: 3, target: 'self', fx: [{ op: 'block', n: 18 }], text: '18防ぐ' },
  seedlight: { no: 21, name: '種の光', cost: 0, target: 'self', fx: [{ op: 'energy', n: 1 }], exhaust: true, text: 'エネルギー+1・除外' },
  tailwind: { no: 22, name: '追い風', cost: 0, target: 'self', fx: [{ op: 'draw', n: 2 }], exhaust: true, ally: 'rine', text: '2枚引く・除外（風読みリネ）' },
  bellguard: { no: 23, name: '鐘の守り', cost: 1, target: 'self', fx: [{ op: 'block', n: 8 }], exhaust: true, ally: 'toma', text: '8防ぐ・除外（鐘守トマ）' },
  littledawn: { no: 24, name: '小さな夜明け', cost: 1, target: 'enemy', fx: [{ op: 'damage', n: 8 }, { op: 'heal', n: 3 }], exhaust: true, ally: 'nagi', text: '8ダメージ・HP3回復・除外（灯し子ナギ）' },
};
export const CARD_IDS = Object.keys(CARDS).sort((a, b) => CARDS[a].no - CARDS[b].no);
export const isAttack = (id) => CARDS[id].fx.some((f) => f.op === 'damage');
// 報酬の抽選範囲：第一章は1〜14、第二章からは1〜21
export const rewardPool = (chapter) => CARD_IDS.filter((id) => CARDS[id].no <= (chapter === 0 ? 14 : 21));

export const STARTER_DECKS = {
  ember: { name: '火の旅', cards: { spark: 3, twin: 1, ember: 1, ward: 3, keeper: 1, kindle: 1 } },
  hearth: { name: '炉辺の旅', cards: { spark: 2, chase: 1, ember: 1, ward: 2, keeper: 2, mist: 1, kindle: 1 } }, // 初クリアで解放
};

export const ALLIES = {
  rine: { name: '風読みリネ', card: 'tailwind', line: '風の向きが変わった。……次は、私が先に読む。' },
  toma: { name: '鐘守トマ', card: 'bellguard', line: '鐘はまだ鳴る。おまえの朝のために、もう一度だけ。' },
  nagi: { name: '灯し子ナギ', card: 'littledawn', line: 'ちいさな火でも、夜はちゃんと明るくなるよ。' },
};

// 行動：a=攻撃（n×hits）、d=防御、w=弱体付与。周期は初手から順に繰り返す
const A = (n, hits = 1) => ({ t: 'a', n, hits });
const D = (n) => ({ t: 'd', n });
const Wk = () => ({ t: 'w', n: 1 });
export const ENEMIES = {
  pup: { name: '枝狼', tutorial: true, cycle: [A(6), A(4)] }, // 練習用
  wolf: { name: '枝狼', cycle: [A(8), A(5)] },
  cagekeeper: { name: '檻番', cycle: [A(6), A(8)] },
  moth: { name: '盾蛾', cycle: [D(6), A(9)] },
  crow: { name: '針烏', cycle: [A(4, 2), A(7)] },
  wax: { name: '蝋兵', cycle: [A(9), D(6)] },
  bear: { name: '影熊', cycle: [A(11), D(6), A(8)] },
  bat: { name: '鐘蝙蝠', cycle: [A(6), Wk()] },
  spider: { name: '鎖蜘蛛', cycle: [A(7), Wk()] },
  owl: { name: '鏡梟', cycle: [A(7), D(8), A(11)] },
  stag: { name: '門番の鹿', boss: true, cycle: [A(10), D(8), A(15)] },
  belleater: { name: '鐘喰い', boss: true, cycle: [A(5, 2), Wk(), A(17)] },
  king: { name: '夜の王', boss: true, cycle: [A(11), D(10), A(17)] },
};

export const CHAPTERS = [
  { name: '墨の森', intro: ['夜の王から朝の種を盗んだ。', '森を抜ければ、地平線が見える。'], boss: '門番の鹿が、森の出口をふさいでいる。', after: '朝の種が、ひとつ咲いた。' },
  { name: '沈んだ鐘の町', intro: ['鐘の鳴らない町。', '影熊が、太陽の鎖を引いて歩いている。'], boss: '鐘喰いが、最後の鐘を飲みこもうとしている。', after: '町に、鐘の音がひとつ戻った。' },
  { name: '夜の城', intro: ['城の上で、太陽が鎖につながれている。', '夜の王が待っている。'], boss: '夜の王が、王冠の下からこちらを見た。', after: '鎖がほどけ、空の墨が朱に変わっていく。' },
];

// 全15地点（章ごとに 通常戦→救出戦→通常戦→休息→ボス）
const E = (id, hp) => ({ id, hp });
export const NODES = [
  { ch: 0, type: 'battle', name: '枝狼の小道', foes: [E('wolf', 12)] },
  { ch: 0, type: 'rescue', name: '風読みの檻', foes: [E('cagekeeper', 18)], ally: 'rine' },
  { ch: 0, type: 'battle', name: '蛾の灯る沢', foes: [E('moth', 12), E('wolf', 10)] },
  { ch: 0, type: 'rest', name: '焚火' },
  { ch: 0, type: 'boss', name: '森の門', foes: [E('stag', 44)] },
  { ch: 1, type: 'battle', name: '錆びた広場', foes: [E('crow', 15), E('wax', 14)] },
  { ch: 1, type: 'rescue', name: '影熊の檻', foes: [E('bear', 28)], ally: 'toma' },
  { ch: 1, type: 'battle', name: '鐘楼の下', foes: [E('bat', 16), E('moth', 16)] },
  { ch: 1, type: 'rest', name: '鐘楼の休息' },
  { ch: 1, type: 'boss', name: '最後の鐘', foes: [E('belleater', 54)] },
  { ch: 2, type: 'battle', name: '鎖の回廊', foes: [E('spider', 18), E('wax', 18)] },
  { ch: 2, type: 'rescue', name: '灯し子の檻', foes: [E('bear', 30), E('crow', 12)], ally: 'nagi' },
  { ch: 2, type: 'battle', name: '鏡の間', foes: [E('owl', 24), E('bat', 18)] },
  { ch: 2, type: 'rest', name: '最後の火' },
  { ch: 2, type: 'boss', name: '玉座', foes: [E('king', 60)] },
];
// 練習：2ターンで「攻撃する→防いで受ける→とどめ」を一度ずつ体験する（手札は決まっている）
export const TUTORIAL_NODE = { ch: 0, type: 'tutorial', name: '森の入口', foes: [E('pup', 12)], script: [['spark', 'ward'], ['spark']] };
// 第一章の最初の報酬は固定（攻撃寄り・防御寄り・引き寄りの差が分かる3枚）
export const FIRST_REWARD = ['lance', 'ashshield', 'ember'];
