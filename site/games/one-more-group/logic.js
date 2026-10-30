// 画面に依存しないゲームのルール。Node のテストからも import できるよう DOM を触らない。
export const CAPACITY = 10;
export const TRIPS = 5;
export const VISIBLE = 3;
export const GROUP_SIZES = [1, 2, 3, 4, 5, 6];
export const COPIES = 3;

export function baseGroups() {
  return GROUP_SIZES.flatMap((n) => Array.from({ length: COPIES }, () => n));
}

export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 初期列 initial を保持し、同じ並びでの再現に使う。
export function createState(initial = shuffle(baseGroups())) {
  return { initial: [...initial], queue: [...initial], riding: [], trip: 1, delivered: 0, finished: false };
}

export const newGame = (rng) => createState(shuffle(baseGroups(), rng));
export const replay = (state) => createState(state.initial);

export const load = (state) => state.riding.reduce((a, b) => a + b, 0);
export const remaining = (state) => CAPACITY - load(state);
export const visible = (state) => state.queue.slice(0, VISIBLE);

// 先頭 VISIBLE 組のうち index 番目を乗せられるか。理由も返す。
export function canBoard(state, index) {
  if (state.finished) return { ok: false, reason: '終了しました' };
  if (index < 0 || index >= Math.min(VISIBLE, state.queue.length)) return { ok: false, reason: '選べません' };
  if (state.queue[index] > remaining(state)) return { ok: false, reason: `あと${remaining(state)}人分しか空いていません` };
  return { ok: true, reason: '' };
}

export function board(state, index) {
  if (!canBoard(state, index).ok) return state;
  const size = state.queue[index];
  const queue = state.queue.filter((_, i) => i !== index);
  return { ...state, queue, riding: [...state.riding, size] };
}

export const canDepart = (state) => !state.finished && state.riding.length > 0;

export function depart(state) {
  if (!canDepart(state)) return state;
  const delivered = state.delivered + load(state);
  const finished = state.trip >= TRIPS;
  return { ...state, delivered, riding: [], trip: finished ? state.trip : state.trip + 1, finished };
}

// どの組も乗せられない（出発を促す）状態か
export function mustDepart(state) {
  if (state.finished) return false;
  return !visible(state).some((_, i) => canBoard(state, i).ok);
}

export const MAX_SCORE = 50;
