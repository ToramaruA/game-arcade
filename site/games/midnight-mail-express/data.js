// 駅・乗客・路線の単一データ定義。券面・判定・描画はすべてここから作る。
export const STATIONS = [
  { id: 'hoshi', name: '星屑停留所', short: '星', hue: '#F7C96C', riddle: '流れ星が落ちた駅' },
  { id: 'ame', name: '雨音駅', short: '雨', hue: '#6FA8E8', riddle: '雨が降っていない雨宿り駅' },
  { id: 'tokei', name: '逆時計駅', short: '時', hue: '#B58CE0', riddle: '針が逆さに進む駅' },
  { id: 'neko', name: '猫灯駅', short: '猫', hue: '#EA6D75', riddle: '猫が先に降りる駅' },
  { id: 'tegami', name: '未配達駅', short: '手', hue: '#E9D9A6', riddle: '届かなかった手紙が眠る駅' },
  { id: 'oji', name: '王冠市場', short: '冠', hue: '#F29A4B', riddle: '冠を置いていける駅' },
  { id: 'gekijo', name: '無人劇場', short: '劇', hue: '#C0464F', riddle: '誰もいない舞台の駅' },
  { id: 'yoru', name: '永夜岬', short: '夜', hue: '#7A86D6', riddle: '夜が明けない駅' },
  { id: 'fuyu', name: '冬庭駅', short: '冬', hue: '#CFE6F5', riddle: '春が来ない駅' },
  { id: 'shinkai', name: '深海改札', short: '海', hue: '#3FB6B2', riddle: '海の底の駅' },
  { id: 'shuten', name: '終端駅', short: '終', hue: '#9BD28A', riddle: 'レールの終わりの駅' },
  { id: 'nowhere', name: 'どこでもない駅', short: '無', hue: '#FFFFFF', riddle: 'どこでもない駅' },
];
export const NOWHERE = 11;

// home=本来の第1希望駅、ok=許容駅、ng=禁止駅。便ごとに第1希望は home+ok の中から入れ替わる。
export const KINDS = [
  { name: '星を拾う少女', home: 0, ok: [3, 8, 9], ng: [6], line: '星屑停留所で「おかえり」と手を振る。', bye: 'おかえり' },
  { name: '透明な傘の紳士', home: 1, ok: [0, 7, 4], ng: [8], line: '雨音駅で、見えない傘が一輪の花に変わる。', bye: 'ありがとう' },
  { name: '時計のない時計職人', home: 2, ok: [4, 6, 10], ng: [5], line: '逆時計駅で、時間が一瞬だけ戻った。', bye: 'まにあった' },
  { name: '猫を抱いた幽霊', home: 3, ok: [1, 5, 0], ng: [9], line: '猫灯駅で、猫だけが先に影になって駆けていく。', bye: 'にゃあ' },
  { name: '手紙だらけの郵便屋', home: 4, ok: [2, 8, 5], ng: [7], line: '未配達駅で、封筒が鳥になって飛び立った。', bye: 'とどけた' },
  { name: '紙でできた王様', home: 5, ok: [6, 3, 10], ng: [1], line: '王冠市場で、王様は紙飛行機になって空へ。', bye: 'さらば' },
  { name: '鏡に映らない歌手', home: 6, ok: [5, 0, 9], ng: [10], line: '無人劇場の客席に、ひとつずつ灯がともる。', bye: 'ひとうた' },
  { name: '小さな月を抱く老人', home: 7, ok: [1, 0, 8], ng: [2], line: '永夜岬で、月がそっと空へ戻っていった。', bye: 'よい夜を' },
  { name: '雪だるまの郵便配達員', home: 8, ok: [4, 7, 0], ng: [3], line: '冬庭駅で、溶けない雪の上に花が咲く。', bye: 'はるだ' },
  { name: '金魚鉢の宇宙飛行士', home: 9, ok: [7, 1, 6], ng: [8], line: '深海改札で、金魚が星座になって泳いでいく。', bye: 'ぷくぷく' },
  { name: '車輪をなくした機関士', home: 10, ok: [2, 4, 7], ng: [5], line: '終端駅で、線路が夜空へ伸びていく。', bye: 'ゆくぞ' },
  { name: '切符を持たない車掌', home: 11, ok: [], ng: [], line: 'どこでもない駅で、この列車こそ乗客だったと分かる。', bye: 'ご乗車' },
];

export const LINES = [
  { name: '薄明線', runs: ['はじめての夜行', '許容駅の取引', '混み合う車内', '相反する望み', '薄明の総合便'] },
  { name: '雨音線', runs: ['雨音のはしご', '言い換えの切符', '逆さまの時計', '猫が先に降りる', '雨音の総合便'] },
  { name: '星屑線', runs: ['星屑の乗り換え', '三人の分かれ道', 'ひみつの乗客', '紙の王様の行方', '終電、あの世ゆき'] },
];

// 便ごとの難しさ。n=客数、need=クリアに必要な人数、T=駅間の秒数、mystery=不思議券の割合、cap=車内の定員
export const RUN_PARAMS = [
  { n: 5, need: 3, T: 14, mystery: 0, cap: 2, dilemma: false },
  { n: 6, need: 4, T: 14, mystery: 0.2, cap: 3, dilemma: true },
  { n: 6, need: 4, T: 13, mystery: 0.3, cap: 3, dilemma: true },
  { n: 7, need: 4, T: 13, mystery: 0.4, cap: 3, dilemma: true },
  { n: 7, need: 4, T: 12, mystery: 0.5, cap: 3, dilemma: true },
  { n: 6, need: 4, T: 12, mystery: 0.5, cap: 3, dilemma: true },
  { n: 7, need: 4, T: 12, mystery: 0.6, cap: 3, dilemma: true },
  { n: 7, need: 4, T: 11, mystery: 0.6, cap: 3, dilemma: true },
  { n: 8, need: 4, T: 11, mystery: 0.7, cap: 3, dilemma: true },
  { n: 8, need: 5, T: 11, mystery: 0.8, cap: 3, dilemma: true },
  { n: 7, need: 4, T: 10, mystery: 0.7, cap: 3, dilemma: true },
  { n: 8, need: 5, T: 10, mystery: 0.7, cap: 3, dilemma: true },
  { n: 8, need: 5, T: 10, mystery: 0.8, cap: 3, dilemma: true },
  { n: 8, need: 5, T: 9, mystery: 0.8, cap: 3, dilemma: true },
  { n: 8, need: 5, T: 9, mystery: 0.9, cap: 3, dilemma: true },
];
