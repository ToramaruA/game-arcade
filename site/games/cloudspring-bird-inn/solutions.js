// 各日に勝てる手順（テストで再生して、全日に達成の道があることを確かめる）。
// t<0 は準備中の操作、t>=0 はその秒の頭で行う操作。
export const SOLUTIONS = {
  1: [[0, { op: 'valve', id: 2, q: 3 }]],
  26: [
    [-1, { op: 'move', id: 2, x: 2, y: 1 }],
    [-1, { op: 'move', id: 5, x: 2, y: 0 }],
    [-1, { op: 'rotate', id: 5, dir: 'N' }],
    [-1, { op: 'build', type: 'windbreak', x: 3, y: 1, dir: 'E' }],
    [60, { op: 'valve', id: 3, q: 3 }],
  ],
};
