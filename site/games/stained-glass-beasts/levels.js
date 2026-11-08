// 3獣×4戦の配置データ。論理座標 640x800、発射台 (320,740)。
const rad = (d) => (d * Math.PI) / 180;
const f1 = (n) => Math.round(n * 10) / 10;

export function quad(cx, cy, w, h, deg = 0) {
  const c = Math.cos(rad(deg)); const s = Math.sin(rad(deg));
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
    .map(([x, y]) => [f1(cx + x * c - y * s), f1(cy + x * s + y * c)]);
}
export function heartPts(cx, cy, h = 30) {
  return [[cx, cy - h], [cx + h * 0.9, cy], [cx, cy + h], [cx - h * 0.9, cy]];
}
export function bellPts(cx, cy, r = 17) {
  return [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]].map(([x, y]) => [f1(x), f1(y)]);
}
function tri(cx, cy, w, h, deg = 0) {
  const c = Math.cos(rad(deg)); const s = Math.sin(rad(deg));
  return [[0, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => [f1(cx + x * c - y * s), f1(cy + x * s + y * c)]);
}

export const TONE = { ruby: '#D94469', peacock: '#36B7C8', gold: '#F5C76A', purple: '#8067CA', lead: '#2B2435', amber: '#E8963A', jade: '#3FBF8F', silver: '#F6F2E7' };

const A = (id, pts, look, extra = {}) => ({ id, kind: 'armor', pts, look, ...extra });
const G = (id, cx, cy, w, h, deg, tone, extra = {}) => ({ id, kind: 'glass', pts: quad(cx, cy, w, h, deg), tone, ...extra });
const M = (id, cx, cy, w, h, deg, extra = {}) => ({ id, kind: 'mirror', pts: quad(cx, cy, w, h, deg), tone: 'gold', ...extra });
const Hh = (id, cx, cy) => ({ id, kind: 'heart', pts: heartPts(cx, cy), tone: 'gold' });
const B = (id, cx, cy, link, mark) => ({ id, kind: 'bell', pts: bellPts(cx, cy), link, mark, tone: 'gold' });

export const BEASTS = [
  { key: 'deer', name: '鹿', full: '紅玉の鹿', tone: 'ruby' },
  { key: 'snake', name: '蛇', full: '孔雀青の蛇', tone: 'peacock' },
  { key: 'owl', name: '梟', full: '紫の梟', tone: 'purple' },
];

export const LEVELS = [
  // ───── 鹿 ─────
  {
    id: 'deer1', beast: 0, name: '鹿1「ひびの胸」', ammo: 4, par: 2,
    tip: '金の心臓は2回当てると割れる。硝子は1回で割れる。',
    pieces: [
      Hh('h1', 320, 310),
      G('g1', 232, 392, 56, 26, 12, 'ruby'), G('g2', 408, 392, 56, 26, -12, 'ruby'),
      A('a1', quad(176, 225, 90, 18, -35), 'antler'), A('a2', quad(464, 225, 90, 18, 35), 'antler'),
    ],
  },
  {
    id: 'deer2', beast: 0, name: '鹿2「枝角の抜け道」', ammo: 4, par: 2,
    tip: '胸の正面は割れない。側面の角から背後へ。',
    pieces: [
      Hh('h1', 320, 250),
      A('chest', quad(320, 345, 150, 40, 0), 'chest'),
      A('vl1', quad(160, 330, 100, 16, -50), 'antler'), A('vl2', quad(215, 330, 100, 16, 50), 'antler'),
      A('vr1', quad(425, 330, 100, 16, -50), 'antler'), A('vr2', quad(480, 330, 100, 16, 50), 'antler'),
      G('g1', 320, 170, 60, 24, 0, 'ruby'),
      G('g2', 120, 430, 50, 22, 0, 'ruby'), G('g3', 520, 430, 50, 22, 0, 'ruby'),
    ],
  },
  {
    id: 'deer3', beast: 0, name: '鹿3「鳴る胸飾り」', ammo: 4, par: 3,
    tip: '鈴に当てると、同じ刻印の胸蓋がその射だけ開く。',
    pieces: [
      Hh('h1', 320, 255),
      A('lid', quad(320, 205, 110, 22, 0), 'lid', { mark: 'Ⅰ' }),
      A('sl', quad(262, 255, 14, 80, 0), 'plate'), A('sr', quad(378, 255, 14, 80, 0), 'plate'),
      A('floor', quad(320, 305, 110, 16, 0), 'plate'),
      B('b1', 150, 400, 'lid', 'Ⅰ'),
      A('rf', quad(500, 330, 110, 16, -30), 'plate'),
      G('g1', 320, 150, 60, 24, 0, 'ruby'), G('g2', 520, 440, 56, 22, 0, 'ruby'),
    ],
  },
  {
    id: 'deer4', beast: 0, name: '鹿4「二本の王冠」', ammo: 4, par: 3,
    tip: '薄金の角は1回で割れる。割ると次の反射を失う。',
    pieces: [
      Hh('h1', 200, 320), Hh('h2', 440, 320),
      A('pillar', quad(320, 330, 28, 180, 0), 'pillar'),
      M('m1', 170, 190, 90, 14, -25), M('m2', 470, 190, 90, 14, 25),
      G('g1', 320, 450, 70, 22, 0, 'ruby'),
    ],
  },
  // ───── 蛇 ─────
  {
    id: 'snake1', beast: 1, name: '蛇1「蛇行回廊」', ammo: 5, par: 2,
    tip: '外側のうろこは割れない。内側の硝子を割ると近道ができる。',
    pieces: [
      Hh('h1', 470, 255),
      A('b1', quad(235, 165, 270, 18, 0), 'scale'),
      A('b2', quad(405, 345, 270, 18, 0), 'scale'),
      A('b3', quad(235, 505, 270, 18, 0), 'scale'),
      G('g1', 150, 255, 60, 24, 0, 'peacock'), G('g2', 300, 255, 60, 24, 0, 'peacock'), G('g3', 520, 425, 60, 24, 0, 'peacock'),
    ],
  },
  {
    id: 'snake2', beast: 1, name: '蛇2「遠くの鈴」', ammo: 5, par: 2,
    tip: '上の鈴で開けた腹蓋を、下からの帰り道で通せ。',
    pieces: [
      Hh('h1', 320, 420),
      A('belly', quad(320, 372, 110, 22, 0), 'lid', { mark: 'Ⅱ' }),
      A('sl', quad(262, 420, 14, 80, 0), 'scale'), A('sr', quad(378, 420, 14, 80, 0), 'scale'),
      A('floor', quad(320, 470, 110, 16, 0), 'scale'),
      B('b1', 560, 150, 'belly', 'Ⅱ'),
      A('d1', quad(150, 330, 120, 16, 30), 'scale'), A('d2', quad(490, 340, 100, 16, -30), 'scale'),
      G('g1', 320, 290, 60, 24, 0, 'peacock'), G('g2', 120, 470, 50, 22, 0, 'peacock'),
    ],
  },
  {
    id: 'snake3', beast: 1, name: '蛇3「琥珀の脱皮」', ammo: 5, par: 2,
    tip: '往路では1枚で跳ね返る列も、帰り道ならまとめて貫ける。',
    pieces: [
      Hh('h1', 540, 210),
      A('back', quad(300, 190, 360, 18, 0), 'plate'),
      G('s1', 320, 300, 70, 20, 0, 'amber'), G('s2', 320, 370, 70, 20, 0, 'amber'), G('s3', 320, 440, 70, 20, 0, 'amber'),
      A('w1', quad(120, 400, 20, 140, 0), 'scale'),
    ],
  },
  {
    id: 'snake4', beast: 1, name: '蛇4「双頭の契り」', ammo: 5, par: 4,
    tip: '鈴と胸蓋は同じ刻印どうし。刻印を読め。',
    pieces: [
      Hh('h1', 150, 260), Hh('h2', 490, 260),
      A('lidL', quad(150, 208, 90, 22, 0), 'lid', { mark: 'Ⅰ' }), A('lidR', quad(490, 208, 90, 22, 0), 'lid', { mark: 'Ⅱ' }),
      A('l1', quad(97, 262, 14, 80, 0), 'scale'), A('l2', quad(203, 262, 14, 80, 0), 'scale'),
      A('r1', quad(437, 262, 14, 80, 0), 'scale'), A('r2', quad(543, 262, 14, 80, 0), 'scale'),
      A('fl', quad(150, 318, 100, 16, 0), 'scale'), A('fr', quad(490, 318, 100, 16, 0), 'scale'),
      B('bL', 490, 440, 'lidL', 'Ⅰ'), B('bR', 150, 440, 'lidR', 'Ⅱ'),
      A('body', quad(320, 330, 24, 200, 0), 'scale'),
      G('g1', 320, 170, 70, 22, 0, 'peacock'), G('g2', 320, 500, 70, 22, 0, 'peacock'),
    ],
  },
  // ───── 梟 ─────
  {
    id: 'owl1', beast: 2, name: '梟1「翼の天井」', ammo: 6, par: 2,
    tip: '翼の傾斜板で折り返せ。',
    pieces: [
      Hh('h1', 320, 190),
      A('wl', quad(150, 250, 220, 16, 22), 'wing'), A('wr', quad(490, 250, 220, 16, -22), 'wing'),
      G('g1', 320, 340, 70, 24, 0, 'purple'),
      A('sl', quad(200, 400, 80, 14, 0), 'plate'), A('sr', quad(440, 400, 80, 14, 0), 'plate'),
    ],
  },
  {
    id: 'owl2', beast: 2, name: '梟2「鉛の仮面」', ammo: 6, par: 2,
    tip: '正面の仮面に呼び戻しは止められる。左右の通路を使え。',
    pieces: [
      Hh('h1', 320, 240),
      A('mask', quad(320, 330, 100, 60, 0), 'mask'),
      A('pl1', quad(190, 330, 16, 120, 0), 'wing'), A('pl2', quad(450, 330, 16, 120, 0), 'wing'),
      G('g1', 250, 160, 50, 22, 0, 'purple'), G('g2', 390, 160, 50, 22, 0, 'purple'),
    ],
  },
  {
    id: 'owl3', beast: 2, name: '梟3「落ちる羽根鏡」', ammo: 6, par: 2,
    tip: '薄金の羽根鏡は割ると消える。先に奥を割るか、鏡を残すか。',
    pieces: [
      Hh('h1', 320, 300),
      M('m1', 190, 260, 100, 12, 25), M('m2', 450, 260, 100, 12, -25),
      G('u1', 250, 150, 50, 22, 0, 'purple'), G('u2', 390, 150, 50, 22, 0, 'purple'),
      G('d1', 250, 440, 50, 22, 0, 'purple'), G('d2', 390, 440, 50, 22, 0, 'purple'),
    ],
  },
  {
    id: 'owl4', beast: 2, name: '梟4「聖堂の夜明け」', ammo: 6, par: 5,
    tip: '開放・反射・帰り道・全破壊。すべて組み合わせろ。',
    pieces: [
      Hh('h1', 320, 165), Hh('h2', 320, 340),
      A('lidB', quad(320, 118, 100, 20, 0), 'lid', { mark: 'Ⅱ' }),
      A('s1', quad(262, 168, 14, 70, 0), 'wing'), A('s2', quad(378, 168, 14, 70, 0), 'wing'),
      A('r2', quad(320, 218, 100, 14, 0), 'wing'),
      A('lidA', quad(320, 290, 100, 20, 0), 'lid', { mark: 'Ⅰ' }),
      A('t1', quad(262, 342, 14, 76, 0), 'wing'), A('t2', quad(378, 342, 14, 76, 0), 'wing'),
      A('r3', quad(320, 395, 100, 14, 0), 'wing'),
      B('bA', 130, 450, 'lidA', 'Ⅰ'), B('bB', 520, 330, 'lidB', 'Ⅱ'),
      M('m1', 190, 300, 80, 12, 60), G('g1', 480, 480, 60, 22, 0, 'purple'),
      A('wl', quad(70, 250, 16, 160, 0), 'wing'),
    ],
  },
];

for (const l of LEVELS) {
  l.beastName = BEASTS[l.beast].name;
  l.chapter = l.beast;
}
