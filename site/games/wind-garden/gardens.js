// 5つの庭のデータ（9x9）。描画やDOMには依存しない。
// 記号: . 虚空 / # 地面 / T 通れない物（木・岩・風車） / V 風見鶏 / F 綿毛の的（花壇・台座・蓮・星の台座）
//       G 次の庭への門 / S 開始位置 / B 鈴の下（地面）
// 風向き: 0=北 1=東 2=南 3=西（風見鶏を回すと 北→東→南→西 の順）
// 雲の出現条件 reveal:
//   visible … 最初から見える / bloom … 綿毛が的に入ると出る
//   step … 指定のマス（に風 wind のとき）に立つと出る / seq … 風をその順に回すと出る / final … 他14個を集めると出る
export const GARDENS = [
  {
    id: 'dew', name: '朝露の丘', theme: 'dawn', obstacle: 'bush',
    rows: [
      '.........',
      '.........',
      '#####..##',
      '###V#..##',
      '#S###..#G',
      '.TTTTT...',
      '.##F##...',
      '.T####...',
      '.........',
    ],
    bridges: [{ x: 5, y: 3, winds: [1] }, { x: 6, y: 3, winds: [1] }],
    fluff: [[1, 6]],
    clouds: [
      { name: 'あくび雲', say: 'ふあぁ……', x: 1, y: 2, reveal: { type: 'visible' }, hue: 48 },
      { name: 'くるくる雲', say: 'くるくる！', x: 8, y: 2, reveal: { type: 'visible' }, hue: 330 },
      { name: '花粉雲', say: 'ぽふっ', x: 0, y: 2, reveal: { type: 'bloom', bed: 0 }, hue: 95 },
    ],
    hints: ['歩いてすぐの雲', '東風で架かる橋の先', '綿毛を東へ運び、花壇に入れる'],
  },
  {
    id: 'bell', name: '鈴の回廊', theme: 'cream', obstacle: 'rock',
    rows: [
      '.....####',
      '.....####',
      '####.#V##',
      '####.####',
      '#SFV.....',
      '####.####',
      '##T#.####',
      '####.#V#G',
      '.........',
    ],
    bridges: [{ x: 4, y: 3, winds: [0, 1] }, { x: 4, y: 6, winds: [2, 3] }],
    fluff: [[1, 5]],
    clouds: [
      { name: 'りんりん雲', say: 'りん、りん', x: 0, y: 2, reveal: { type: 'step', x: 1, y: 3, wind: 2 }, hue: 45 },
      { name: 'おひるね雲', say: 'すやすや', x: 7, y: 1, reveal: { type: 'visible' }, hue: 260 },
      { name: 'かくれんぼ雲', say: 'みーつけた', x: 0, y: 7, reveal: { type: 'bloom', bed: 0 }, hue: 175 },
    ],
    bells: [{ x: 1, y: 3 }],
    hints: ['南風のとき鈴の下に立つ', '北〜東風で伸びる橋の先', '綿毛を鈴の台座に当てる'],
  },
  {
    id: 'mirror', name: '青い水鏡', theme: 'aqua', obstacle: 'rock',
    rows: [
      '.........',
      '###...###',
      '#V#...#V#',
      '###...###',
      '#SF...###',
      '###...###',
      '###...#G#',
      '###...###',
      '.........',
    ],
    bridges: [
      { x: 3, y: 4, winds: [3] }, { x: 4, y: 4, winds: [3] }, { x: 5, y: 4, winds: [3] },
      { x: 3, y: 2, winds: [1] }, { x: 4, y: 2, winds: [1] }, { x: 5, y: 2, winds: [1] },
    ],
    fluff: [[2, 2]],
    clouds: [
      { name: 'しずく雲', say: 'ぽちゃん', x: 2, y: 7, reveal: { type: 'step', x: 2, y: 5, wind: 1 }, hue: 195 },
      { name: 'さかさま雲', say: 'さかさま！', x: 8, y: 1, reveal: { type: 'visible' }, hue: 205 },
      { name: 'あめあがり雲', say: 'にじ、にじ', x: 0, y: 3, reveal: { type: 'bloom', bed: 0 }, hue: 310 },
    ],
    hints: ['東風のとき、水面の影の上に立つ', '西風か東風で池の向こう岸へ橋が伸びる', '綿毛を蓮の花に運ぶ'],
  },
  {
    id: 'mill', name: '夕焼けの風車', theme: 'sunset', obstacle: 'rock',
    rows: [
      '.........',
      '......###',
      '......#V#',
      '......###',
      '.........',
      '#####.###',
      '#V#T#.#V#',
      '#####.###',
      '#S###.##G',
    ],
    bridges: [{ x: 5, y: 6, winds: [2] }, { x: 7, y: 4, winds: [0] }],
    fluff: [],
    clouds: [
      { name: 'むぎわら雲', say: 'かさかさ', x: 2, y: 7, reveal: { type: 'visible' }, hue: 38 },
      { name: 'おいかぜ雲', say: 'びゅーん', x: 8, y: 1, reveal: { type: 'visible' }, hue: 15 },
      { name: 'ひみつ雲', say: 'ごろごろ', x: 3, y: 5, reveal: { type: 'seq', seq: [0, 1, 2] }, hue: 280 },
    ],
    pedestal: { x: 4, y: 7 },
    hints: ['風車の裏の小径', '南風の橋と北風の橋を乗り継ぐ', '台座の矢印の順（北→東→南）に風を回す'],
  },
  {
    id: 'night', name: '夜空の花畑', theme: 'night', obstacle: 'rock',
    rows: [
      '.........',
      '.........',
      '##.###.##',
      '#V.#V#.V#',
      '#S.###.##',
      '##.###.##',
      '##.###.##',
      '.........',
      '.........',
    ],
    bridges: [{ x: 2, y: 4, winds: [1] }, { x: 6, y: 4, winds: [3] }],
    fluff: [],
    clouds: [
      { name: 'ほしのこ雲', say: 'きらきら', x: 0, y: 2, reveal: { type: 'visible' }, hue: 55 },
      { name: 'よぞら雲', say: 'しゃらん', x: 8, y: 2, reveal: { type: 'visible' }, hue: 230 },
      { name: 'おかえり雲', say: 'おかえり！', x: 4, y: 4, reveal: { type: 'final' }, hue: 340 },
    ],
    centerFlower: { x: 4, y: 4 },
    hints: ['光る道の先で待っている', '東風と西風で交互に伸びる橋', '14個集めると花が咲く'],
  },
];
