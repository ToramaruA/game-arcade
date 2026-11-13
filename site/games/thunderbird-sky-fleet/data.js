// 6海域×3波＋6ボス、敵8種、強化3種のデータ定義（DOM を触らない）。
// 弾幕はすべて logic.js の共通の弾生成関数 emit() に、ここで決めた
// 位置・角度・周期パラメータを渡して作る（ボスごとに個別のエンジンは作らない）。
export const W = 960;
export const H = 540;
export const ZONE = { x0: 34, x1: 470, y0: 34, y1: 506 }; // 自機が動ける左半分

// 敵8種。fire の pat は共通弾幕（aimed/spread/ring/stream/line/missile/thread …）
export const ENEMY_TYPES = {
  scout: { name: '偵察鳥', hp: 1, r: 15, speed: 115, move: 'drift', score: 100,
    fire: { pat: 'aimed', period: 2.6, speed: 150, colors: 'b' } },
  sparrow: { name: '速射鳥（雀）', hp: 2, r: 14, speed: 140, move: 'sine', amp: 46, freq: 2.2, score: 150,
    fire: { pat: 'stream', n: 3, gap: 0.12, period: 1.9, speed: 230, colors: 'r' } },
  gunship: { name: '砲台船', hp: 3, r: 24, speed: 95, move: 'hover', stay: 15, score: 300,
    fire: { pat: 'spread', n: 3, arc: 0.6, period: 2.3, speed: 150, colors: 'b' } },
  cruiser: { name: '装甲巡洋艦', hp: 4, r: 34, speed: 62, move: 'hover', stay: 19, score: 600,
    fire: { pat: 'line', n: 4, gap: 0.2, period: 2.5, speed: 165, colors: 'b', offs: [-15, 15] } },
  drone: { name: '修復ドローン', hp: 2, r: 13, speed: 90, move: 'hover', stay: 19, score: 250,
    heal: { period: 2.2, radius: 170 }, fire: null },
  mirror: { name: '鏡鳥', hp: 3, r: 18, speed: 100, move: 'hover', stay: 13, score: 400,
    mirror: { closed: 2.2, open: 1.4 }, fire: { pat: 'ring', n: 8, period: 2.7, speed: 115, colors: 'b' } },
  missile: { name: '赤弾ミサイル艇', hp: 2, r: 20, speed: 80, move: 'hover', stay: 14, score: 350,
    fire: { pat: 'missile', period: 2.9, speed: 165, turn: 1.5, colors: 'r' } },
  weaver: { name: '糸射手', hp: 3, r: 18, speed: 90, move: 'hover', stay: 14, score: 400,
    fire: { pat: 'thread', n: 8, gap: 0.09, period: 2.7, speed: 165, amp: 42, freq: 5, colors: 'bbbr' } },
};
export const ENEMY_ORDER = ['scout', 'sparrow', 'gunship', 'cruiser', 'drone', 'mirror', 'missile', 'weaver'];

// 出現データを短く書くための補助
const S = (t, type, y, o = {}) => ({ t, type, y, ...o });
const row = (t, type, ys, dt = 0.5, o = {}) => ys.map((y, i) => S(t + i * dt, type, y, o));

// よく使う弾の上書き
const SPARROW_FAST = { pat: 'stream', n: 4, gap: 0.1, period: 1.7, speed: 290, colors: 'r' };
const SPARROW_SPRAY = { pat: 'spread', n: 5, arc: 0.9, period: 2.1, speed: 250, colors: 'r' };
const BELL = { pat: 'ring', n: 10, period: 2.6, speed: 120, colors: 'brbbr', spin: 0.6 };
const BOUNCE = { pat: 'spread', n: 4, arc: 1.3, period: 2.6, speed: 160, colors: 'bbr', bounce: 2 };
const BOUNCE_R = { pat: 'spread', n: 3, arc: 1.1, period: 2.6, speed: 170, colors: 'r', bounce: 2 };
const WALL = { pat: 'wall', step: 34, gapH: 110, period: 3.4, speed: 120, colors: 'br' };

export const TUTORIAL = [
  { at: 0, text: '動かす：WASD／矢印キー（スマホは画面をドラッグ）' },
  { at: 8, text: '撃つ：J／Space を押し続ける' },
  { at: 15, text: '青い丸は吸える：K／Shift を押し続けて充電（1発20）' },
  { at: -1, text: '離して雷槍！ 一直線に並んだ砲台を貫け（40以上で発射）' },
];

// ボス6体。attacks は3つの固定攻撃パターン（共通の emit / 予告線で組み立てる）
export const BOSSES = [
  { id: 'anchor', name: '錨船ドレッドアンカー', hx: 780, r: 74, amp: 70, freq: 0.45,
    muzzles: [[-60, -46], [-70, -14], [-70, 18], [-60, 50], [-96, 0]],
    attacks: [
      { name: '横撃ち', warn: 0.9, dur: 3.4, period: 0.75, muzzle: [0, 1, 2, 3],
        spec: { pat: 'line', n: 1, speed: 190, colors: 'bbrb' } },
      { name: '扇の大砲', warn: 0.8, dur: 3.2, period: 0.9, muzzle: [4],
        spec: { pat: 'spread', n: 5, arc: 0.9, speed: 165, colors: 'b' } },
      { name: '錨の渦', warn: 0.9, dur: 3.0, period: 1.0, muzzle: [4],
        spec: { pat: 'ring', n: 14, speed: 130, colors: 'br', spin: 0.9 } },
    ] },
  { id: 'windmill', name: '焔の風車', hx: 790, r: 70, amp: 80, freq: 0.5,
    muzzles: [[0, 0], [-40, -60], [-40, 60]],
    attacks: [
      { name: '回転赤弾', warn: 0.9, dur: 4.0, period: 0.16, muzzle: [0],
        spec: { pat: 'spiral', arms: 3, speed: 175, colors: 'rrb', spin: 2.1 } },
      { name: '火の粉', warn: 0.7, dur: 3.0, period: 0.8, muzzle: [1, 2],
        spec: { pat: 'stream', n: 4, gap: 0.08, speed: 300, colors: 'r' } },
      { name: '青い風輪', warn: 0.8, dur: 3.2, period: 1.1, muzzle: [0],
        spec: { pat: 'ring', n: 12, speed: 115, colors: 'b', spin: 0.4 } },
    ] },
  { id: 'twin', name: '双塔船カリヨン', hx: 790, r: 72, amp: 40, freq: 0.4,
    muzzles: [[-30, -110], [-30, 110], [-80, 0]],
    adds: { period: 16, type: 'drone', hx: 880, ys: [150, 390] },
    attacks: [
      { name: '上の塔：青い鐘', warn: 0.9, dur: 3.4, period: 0.9, muzzle: [0],
        spec: { pat: 'spread', n: 5, arc: 1.0, speed: 160, colors: 'b' } },
      { name: '下の塔：赤い薙ぎ', warn: 0.9, dur: 3.2, period: 0.12, muzzle: [1],
        spec: { pat: 'sweep', speed: 220, colors: 'r', a0: Math.PI * 0.75, a1: Math.PI * 1.15, sweepT: 1.6 } },
      { name: '鐘の壁', warn: 0.9, dur: 3.4, period: 1.6, muzzle: [2],
        spec: { pat: 'wall', step: 30, gapH: 120, speed: 130, colors: 'rb' } },
    ] },
  { id: 'eagle', name: '鏡の鷲', hx: 790, r: 68, amp: 90, freq: 0.55, reflect: true,
    muzzles: [[-70, 0], [-20, -70], [-20, 70]],
    attacks: [
      { name: '反射する青', warn: 0.8, dur: 3.4, period: 0.9, muzzle: [1, 2],
        spec: { pat: 'spread', n: 3, arc: 0.9, speed: 175, colors: 'b', bounce: 3 } },
      { name: '硝子の矢', warn: 0.7, dur: 3.0, period: 0.6, muzzle: [0],
        spec: { pat: 'stream', n: 3, gap: 0.09, speed: 290, colors: 'r' } },
      { name: '氷輪', warn: 0.9, dur: 3.2, period: 1.0, muzzle: [0],
        spec: { pat: 'ring', n: 16, speed: 125, colors: 'bbr', spin: -0.7 } },
    ] },
  { id: 'carrier', name: '雷雲母艦', hx: 800, r: 80, amp: 50, freq: 0.35,
    muzzles: [[-80, 0], [-30, -80], [-30, 80]],
    attacks: [
      { name: '雷予告', warn: 1.1, dur: 3.0, period: 1.6, muzzle: [0],
        spec: { pat: 'lightning', lanes: 6, strike: 3, live: 0.45 } },
      { name: '赤い雷魚', warn: 0.8, dur: 3.2, period: 1.1, muzzle: [1, 2],
        spec: { pat: 'missile', speed: 175, turn: 1.6, colors: 'r' } },
      { name: '青い驟雨', warn: 0.7, dur: 3.6, period: 0.35, muzzle: [0],
        spec: { pat: 'rain', n: 2, speed: 150, colors: 'bbbr' } },
    ] },
  { id: 'engine', name: '天の主機', hx: 800, r: 92, amp: 30, freq: 0.3, final: true,
    muzzles: [[-60, -95], [-100, 0], [-60, 95]],
    attacks: [
      { name: '開閉する翼', warn: 0.9, dur: 4.0, period: 0.55, muzzle: [1],
        spec: { pat: 'safering', n: 26, gapN: 5, speed: 150, colors: 'r', sway: 0.75 } },
      { name: '青の列', warn: 0.7, dur: 3.2, period: 0.5, muzzle: [0, 2],
        spec: { pat: 'line', n: 1, speed: 185, colors: 'b' } },
      { name: '三砲口', warn: 1.0, dur: 2.4, period: 1.2, muzzle: [0, 1, 2],
        spec: { pat: 'beam', w: 30, live: 0.55, offs: [-0.32, 0, 0.32] } },
    ] },
];

// 6海域×3波。各海域の最初の波が「安全な練習波」、2波目で本番、3波目で混成、そのあとボス
export const SEAS = [
  { name: '眠る港', sky: ['#0b1530', '#1d2c55', '#3b3f6c'], accent: '#f1c26b',
    intro: '港の灯が消えた夜、セナは雷鳥の封を解いた。',
    log: '錨船を沈めた。港に灯がともる。艦隊は東の空へ逃げた。',
    par: 270,
    waves: [
      { name: '偵察鳥と青い弾', tutorial: true, minT: 6, spawns: [
        ...row(4, 'scout', [140, 400, 270], 1.2),
        ...row(10, 'scout', [180, 360], 0.8),
        ...row(15, 'scout', [120, 220, 320, 420], 0.6) ] },
      { name: '速射鳥', minT: 40, hint: '赤い三角は吸えない。吸うのをやめて避けよう', spawns: [
        S(1, 'scout', 150), S(1.6, 'scout', 390), S(3, 'sparrow', 270),
        ...row(6, 'scout', [120, 220], 0.4), S(8, 'sparrow', 400),
        ...row(11, 'scout', [200, 270, 340], 0.3), S(14, 'sparrow', 150), S(15, 'sparrow', 420),
        S(18, 'gunship', 270, { hx: 800, fire: { pat: 'aimed', period: 1.6, speed: 140, colors: 'b' } }),
        ...row(20, 'scout', [100, 180, 360, 440], 0.4), ...row(24, 'sparrow', [220, 320], 0.8),
        ...row(29, 'scout', [140, 270, 400], 0.5), S(32, 'sparrow', 270),
        ...row(35, 'scout', [180, 360], 0.4) ] },
      { name: '砲台', minT: 45, hint: '装甲巡洋艦は通常弾4発。80まで溜めた雷槍なら1撃', spawns: [
        S(1, 'gunship', 150, { hx: 760 }), S(2, 'gunship', 390, { hx: 800 }),
        ...row(5, 'scout', [270, 200], 0.6), S(9, 'sparrow', 100), S(10, 'sparrow', 440),
        S(13, 'cruiser', 270, { hx: 800 }), ...row(16, 'scout', [130, 410], 0.4),
        S(20, 'gunship', 120, { hx: 720 }), S(21, 'gunship', 420, { hx: 720 }), S(23, 'sparrow', 270),
        ...row(28, 'sparrow', [170, 370], 1), S(31, 'cruiser', 180, { hx: 820 }), S(32, 'gunship', 380, { hx: 760 }),
        ...row(37, 'scout', [110, 230, 310, 430], 0.4) ] },
    ], boss: 0 },
  { name: '銅の嵐', sky: ['#1a0e08', '#4a2612', '#8a4a1e'], accent: '#ffb35a',
    intro: '銅粉の嵐。工場船の煙が空を赤く染めている。',
    log: '風車が止まり、嵐がほどけた。銅の雨の向こうで鐘が鳴る。',
    par: 290,
    waves: [
      { name: '砲台船', minT: 35, hint: '速い赤弾が来る。青を吸う時は、赤の通り道を空けておく', spawns: [
        S(1, 'gunship', 180, { hx: 780 }), S(1.5, 'gunship', 360, { hx: 820 }),
        ...row(5, 'scout', [120, 420], 0.5), S(8, 'sparrow', 270, { fire: SPARROW_FAST }),
        S(13, 'gunship', 270, { hx: 740 }), ...row(16, 'scout', [150, 390], 0.4),
        S(20, 'sparrow', 130, { fire: SPARROW_FAST }), S(21, 'sparrow', 410, { fire: SPARROW_FAST }),
        S(25, 'gunship', 140, { hx: 800 }), S(25.5, 'gunship', 400, { hx: 800 }),
        ...row(30, 'scout', [200, 270, 340], 0.3) ] },
      { name: '赤弾を撒く雀', minT: 42, spawns: [
        ...row(1, 'sparrow', [140, 400], 0.6, { fire: SPARROW_SPRAY }), S(4, 'gunship', 270, { hx: 800 }),
        ...row(8, 'sparrow', [200, 340], 0.4, { fire: SPARROW_FAST }), ...row(11, 'scout', [110, 430], 0.3),
        S(14, 'cruiser', 270, { hx: 820 }), ...row(16, 'sparrow', [120, 420], 0.8, { fire: SPARROW_SPRAY }),
        ...row(22, 'sparrow', [180, 270, 360], 0.5, { fire: SPARROW_FAST }), S(26, 'gunship', 150, { hx: 760 }),
        S(26.5, 'gunship', 390, { hx: 760 }), ...row(31, 'sparrow', [130, 410], 0.6, { fire: SPARROW_SPRAY }),
        ...row(36, 'scout', [200, 340], 0.4) ] },
      { name: '装甲巡洋艦', minT: 48, hint: '巡洋艦と後ろの修理ドローンを、一本の雷槍で貫け', spawns: [
        S(1, 'cruiser', 200, { hx: 760 }), S(2.5, 'drone', 200, { hx: 880 }),
        ...row(3, 'sparrow', [380, 440], 0.6, { fire: SPARROW_FAST }),
        S(9, 'cruiser', 380, { hx: 780 }), S(10.5, 'drone', 380, { hx: 890 }),
        ...row(12, 'sparrow', [120, 260], 0.7, { fire: SPARROW_SPRAY }),
        S(20, 'gunship', 120, { hx: 720 }), ...row(22, 'sparrow', [300, 440], 0.5, { fire: SPARROW_FAST }),
        S(27, 'cruiser', 270, { hx: 790 }), S(28.5, 'drone', 270, { hx: 890 }), S(29, 'drone', 160, { hx: 880 }),
        ...row(31, 'sparrow', [110, 430], 0.6, { fire: SPARROW_SPRAY }), ...row(38, 'scout', [180, 270, 360], 0.4) ] },
    ], boss: 1 },
  { name: '鐘楼の影', sky: ['#120f22', '#2c2547', '#4d4268'], accent: '#e8c98a',
    intro: '鳴らない鐘楼が空に浮かぶ。修理ドローンが艦を直し続けている。',
    log: '双塔が崩れ、鐘がひとつ鳴った。囚われた帆船が旗を振っている。',
    par: 300,
    waves: [
      { name: '修復ドローン', minT: 38, hint: '緑の光は修理の合図。ドローンを先に落とすと艦が脆くなる', spawns: [
        S(1, 'gunship', 200, { hx: 760 }), S(2, 'drone', 260, { hx: 860 }), S(3, 'gunship', 340, { hx: 780 }),
        ...row(8, 'scout', [120, 420], 0.5), S(12, 'cruiser', 270, { hx: 800 }), S(13, 'drone', 180, { hx: 880 }),
        S(13.5, 'drone', 360, { hx: 880 }), ...row(18, 'sparrow', [120, 420], 0.8),
        S(24, 'gunship', 140, { hx: 760 }), S(24.5, 'gunship', 400, { hx: 760 }), S(26, 'drone', 270, { hx: 870 }),
        ...row(31, 'scout', [200, 340], 0.4) ] },
      { name: '鐘射手', minT: 44, spawns: [
        S(1, 'gunship', 270, { hx: 780, fire: BELL }), ...row(4, 'scout', [130, 410], 0.4),
        S(8, 'gunship', 150, { hx: 820, fire: BELL }), S(9, 'gunship', 390, { hx: 820, fire: BELL }),
        S(10, 'drone', 270, { hx: 900 }), ...row(15, 'sparrow', [200, 340], 0.6),
        S(21, 'cruiser', 270, { hx: 780 }), S(23, 'gunship', 120, { hx: 860, fire: BELL }),
        S(24, 'gunship', 420, { hx: 860, fire: BELL }), ...row(29, 'sparrow', [110, 430], 0.5),
        S(33, 'drone', 200, { hx: 890 }), S(33.5, 'drone', 340, { hx: 890 }), ...row(37, 'scout', [160, 380], 0.4) ] },
      { name: '糸状弾', minT: 46, hint: '糸射手の弾は波打つ。青い糸だけを吸い、赤い結び目は避ける', spawns: [
        S(1, 'weaver', 180, { hx: 780 }), S(2, 'weaver', 360, { hx: 800 }),
        ...row(6, 'scout', [110, 430], 0.4), S(10, 'drone', 270, { hx: 890 }),
        S(14, 'cruiser', 270, { hx: 760 }), ...row(17, 'sparrow', [130, 410], 0.7),
        S(22, 'weaver', 120, { hx: 820 }), S(22.5, 'weaver', 420, { hx: 820 }), S(24, 'gunship', 270, { hx: 860, fire: BELL }),
        ...row(30, 'sparrow', [200, 340], 0.5), S(34, 'weaver', 270, { hx: 780 }), S(35, 'drone', 270, { hx: 900 }),
        ...row(39, 'scout', [150, 390], 0.4) ] },
    ], boss: 2 },
  { name: '氷硝子の空', sky: ['#061a26', '#0f3a4c', '#2b6a7a'], accent: '#bfefff',
    intro: '空が凍った。硝子の鳥が、撃った弾を赤く跳ね返す。',
    log: '鏡の鷲が砕けた。氷の欠片に、巨大な主機の影が映っていた。',
    par: 300,
    waves: [
      { name: '鏡鳥', minT: 38, hint: '鏡鳥は閉じている間、通常弾を赤弾にして返す。開いた瞬間か雷槍で', spawns: [
        S(1, 'mirror', 270, { hx: 760 }), ...row(5, 'scout', [130, 410], 0.5),
        S(9, 'mirror', 160, { hx: 800 }), S(10, 'mirror', 380, { hx: 800 }),
        ...row(15, 'scout', [200, 270, 340], 0.3), S(19, 'gunship', 270, { hx: 840 }),
        S(23, 'mirror', 130, { hx: 760 }), S(23.5, 'mirror', 410, { hx: 760 }),
        ...row(29, 'sparrow', [200, 340], 0.6), S(32, 'mirror', 270, { hx: 820 }) ] },
      { name: '反射弾', minT: 44, hint: '反射弾は天井と床で跳ね返る。跳ね返った後の角度を読む', spawns: [
        S(1, 'gunship', 200, { hx: 780, fire: BOUNCE }), S(2, 'gunship', 340, { hx: 800, fire: BOUNCE }),
        ...row(6, 'scout', [110, 430], 0.4), S(10, 'mirror', 270, { hx: 880 }),
        S(14, 'sparrow', 140, { fire: BOUNCE_R }), S(15, 'sparrow', 400, { fire: BOUNCE_R }),
        S(19, 'cruiser', 270, { hx: 780 }), S(21, 'gunship', 120, { hx: 860, fire: BOUNCE }),
        S(22, 'gunship', 420, { hx: 860, fire: BOUNCE }), ...row(28, 'sparrow', [200, 340], 0.6, { fire: BOUNCE_R }),
        S(32, 'mirror', 160, { hx: 800 }), S(32.5, 'mirror', 380, { hx: 800 }), ...row(37, 'scout', [180, 360], 0.4) ] },
      { name: '装甲船', minT: 48, spawns: [
        S(1, 'cruiser', 180, { hx: 760 }), S(2, 'mirror', 180, { hx: 880 }), S(4, 'cruiser', 380, { hx: 800 }),
        ...row(8, 'sparrow', [110, 430], 0.6, { fire: BOUNCE_R }), S(13, 'drone', 270, { hx: 890 }),
        S(17, 'gunship', 270, { hx: 760, fire: BOUNCE }), ...row(20, 'scout', [130, 410], 0.4),
        S(24, 'cruiser', 140, { hx: 820 }), S(24.5, 'cruiser', 400, { hx: 820 }), S(26, 'mirror', 270, { hx: 880 }),
        ...row(31, 'sparrow', [200, 340], 0.6, { fire: SPARROW_FAST }), S(36, 'mirror', 150, { hx: 760 }),
        S(36.5, 'mirror', 390, { hx: 760 }) ] },
    ], boss: 3 },
  { name: '赤い低気圧', sky: ['#1c0508', '#4b0f17', '#86222a'], accent: '#ff8a6a',
    intro: '赤い雲が渦を巻く。雷雲母艦が、空の雷を盗んでいる。',
    log: '盗まれた雷が空へ帰った。雷鳥の翼が、ひときわ明るく光る。',
    par: 310,
    waves: [
      { name: '赤弾ミサイル', minT: 38, hint: 'ミサイルは追ってくる赤。吸えないが、通常弾で撃ち落とせる', spawns: [
        S(1, 'missile', 270, { hx: 800 }), ...row(5, 'scout', [130, 410], 0.5),
        S(9, 'missile', 150, { hx: 840 }), S(10, 'missile', 390, { hx: 840 }), S(13, 'gunship', 270, { hx: 760 }),
        ...row(17, 'scout', [200, 340], 0.4), S(21, 'missile', 120, { hx: 780 }), S(21.5, 'missile', 420, { hx: 780 }),
        S(25, 'cruiser', 270, { hx: 820 }), ...row(30, 'scout', [150, 390], 0.4) ] },
      { name: '修復隊', minT: 44, spawns: [
        S(1, 'cruiser', 200, { hx: 760 }), S(1.5, 'cruiser', 360, { hx: 780 }),
        S(3, 'drone', 200, { hx: 880 }), S(3.5, 'drone', 360, { hx: 880 }), S(4, 'drone', 280, { hx: 900 }),
        S(8, 'missile', 120, { hx: 840 }), S(8.5, 'missile', 430, { hx: 840 }),
        ...row(13, 'sparrow', [200, 340], 0.6, { fire: SPARROW_FAST }), S(18, 'weaver', 270, { hx: 800 }),
        S(22, 'cruiser', 140, { hx: 800 }), S(23, 'drone', 140, { hx: 900 }), S(24, 'cruiser', 400, { hx: 800 }),
        S(25, 'drone', 400, { hx: 900 }), ...row(29, 'sparrow', [130, 410], 0.6, { fire: SPARROW_SPRAY }),
        S(34, 'missile', 270, { hx: 860 }) ] },
      { name: '強襲艦', minT: 48, hint: '強襲艦は速い。赤い弾幕の中で青の列だけを拾い、雷槍で返す', spawns: [
        S(1, 'cruiser', 270, { hx: 720, speed: 120, fire: { pat: 'line', n: 5, gap: 0.16, period: 2.0, speed: 190, colors: 'bbbrb', offs: [-15, 15] } }),
        ...row(3, 'sparrow', [110, 430], 0.4, { fire: SPARROW_FAST }), S(7, 'missile', 160, { hx: 860 }),
        S(7.5, 'missile', 380, { hx: 860 }), S(12, 'weaver', 140, { hx: 800 }), S(12.5, 'weaver', 400, { hx: 800 }),
        S(17, 'cruiser', 180, { hx: 760, speed: 120 }), S(18, 'cruiser', 360, { hx: 780, speed: 120 }),
        ...row(22, 'sparrow', [270, 200, 340], 0.4, { fire: SPARROW_SPRAY }), S(27, 'drone', 270, { hx: 900 }),
        S(30, 'missile', 120, { hx: 820 }), S(30.5, 'missile', 420, { hx: 820 }), S(34, 'gunship', 270, { hx: 760, fire: WALL }),
        ...row(38, 'scout', [150, 270, 390], 0.4) ] },
    ], boss: 4 },
  { name: '主機の上', sky: ['#06040e', '#1b1530', '#3a2c1a'], accent: '#ffd88a',
    intro: '雲の天井の上。空を回し続けてきた「天の主機」が目を開く。',
    log: '主機が止まった。雲海が晴れ、助けた帆船たちが港へ帆を向ける。',
    par: 330,
    waves: [
      { name: '混成艦隊・一', minT: 44, spawns: [
        S(1, 'cruiser', 270, { hx: 760 }), S(2, 'drone', 270, { hx: 880 }), ...row(3, 'sparrow', [110, 430], 0.4, { fire: SPARROW_FAST }),
        S(8, 'mirror', 160, { hx: 820 }), S(8.5, 'mirror', 380, { hx: 820 }), S(13, 'missile', 270, { hx: 860 }),
        ...row(17, 'scout', [130, 410], 0.4), S(20, 'weaver', 200, { hx: 780 }), S(20.5, 'weaver', 340, { hx: 780 }),
        S(26, 'gunship', 120, { hx: 760, fire: BELL }), S(26.5, 'gunship', 420, { hx: 760, fire: BOUNCE }),
        ...row(32, 'sparrow', [200, 340], 0.5, { fire: SPARROW_SPRAY }), S(36, 'cruiser', 270, { hx: 800 }) ] },
      { name: '混成艦隊・二', minT: 46, spawns: [
        S(1, 'gunship', 270, { hx: 760, fire: WALL }), S(3, 'missile', 140, { hx: 840 }), S(3.5, 'missile', 400, { hx: 840 }),
        ...row(7, 'sparrow', [200, 340], 0.4, { fire: BOUNCE_R }), S(11, 'cruiser', 180, { hx: 780 }), S(12, 'drone', 180, { hx: 890 }),
        S(13, 'cruiser', 380, { hx: 800 }), S(14, 'drone', 380, { hx: 890 }), S(19, 'mirror', 270, { hx: 860 }),
        ...row(23, 'scout', [110, 200, 340, 430], 0.3), S(27, 'weaver', 270, { hx: 760 }),
        ...row(31, 'sparrow', [130, 410], 0.6, { fire: SPARROW_FAST }), S(35, 'missile', 270, { hx: 860 }),
        S(38, 'gunship', 150, { hx: 800, fire: BELL }), S(38.5, 'gunship', 390, { hx: 800, fire: BOUNCE }) ] },
      { name: '混成艦隊・三', minT: 50, hint: '全部の技で。吸う・避ける・撃つ・貫くを切り替えろ', spawns: [
        S(1, 'cruiser', 140, { hx: 780 }), S(1.5, 'cruiser', 400, { hx: 780 }), S(3, 'drone', 140, { hx: 890 }),
        S(3.5, 'drone', 400, { hx: 890 }), S(5, 'weaver', 270, { hx: 840 }),
        ...row(9, 'sparrow', [110, 430], 0.5, { fire: SPARROW_SPRAY }), S(14, 'mirror', 200, { hx: 860 }),
        S(14.5, 'mirror', 340, { hx: 860 }), S(18, 'missile', 120, { hx: 800 }), S(18.5, 'missile', 420, { hx: 800 }),
        S(24, 'gunship', 270, { hx: 740, fire: WALL }), ...row(27, 'scout', [130, 410], 0.4),
        S(31, 'cruiser', 270, { hx: 800, speed: 120 }), S(32, 'drone', 270, { hx: 900 }),
        ...row(36, 'sparrow', [200, 340], 0.5, { fire: SPARROW_FAST }), S(40, 'weaver', 160, { hx: 800 }), S(40.5, 'weaver', 380, { hx: 800 }) ] },
    ], boss: 5 },
];

// 自機改修3種。各海域のクリアで2択。
export const UPGRADES = {
  wing: { name: '大翼', desc: '翼幅が広がり、吸収の半径が +14px', icon: 'wing' },
  eff: { name: '蓄雷管', desc: '青弾1発の充電が +5（20→25→30）', icon: 'coil' },
  rate: { name: '連装銃', desc: '通常射撃の間隔が 0.8倍（連射が速い）', icon: 'gun' },
};
export const UPGRADE_PAIRS = [['wing', 'rate'], ['eff', 'wing'], ['rate', 'eff'], ['wing', 'rate'], ['eff', 'wing']];

// 第3海域の前の航路分岐
export const ROUTES = {
  blue: { name: '雲上の難路', desc: '青弾が多く、充電しやすい。そのかわり敵が硬い（HP+1）' },
  red: { name: '雷雲の速攻路', desc: '敵の出現が速く早く抜けられる。そのかわり赤弾が増える' },
};

export const MEDALS = [
  { id: 'nohit', name: '無被弾', desc: '海域を1度も被弾せずに抜ける' },
  { id: 'lance2', name: '雷槍貫通', desc: '雷槍1本で2機以上を同時に撃破' },
  { id: 'time', name: '快速航海', desc: '規定時間以内に海域を抜ける' },
];
