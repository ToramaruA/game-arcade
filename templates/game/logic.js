// 画面に依存しないゲームのルール。Node のテストからも import できるよう DOM を触らない。
export function createState() {
  return { score: 0 };
}

export function tap(state) {
  return { ...state, score: state.score + 1 };
}
