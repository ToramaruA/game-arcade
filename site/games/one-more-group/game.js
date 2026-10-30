import { CAPACITY, VISIBLE, canBoard, board, canDepart, depart, load, remaining, visible, mustDepart, newGame, replay, createState } from './logic.js';

const KEY = 'one-more-group-best';
const $ = (id) => document.getElementById(id);
const OG = new URLSearchParams(location.search).get('og') === '1';

function loadBest() { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } }
function saveBest(v) { try { localStorage.setItem(KEY, String(v)); } catch { /* 保存できなくても遊べる */ } }
let best = loadBest();
let state = newGame();
let busy = false; // 出発演出中は入力を受けない
let msg = '乗せたい組を選ぼう';

const slots = $('slots');
for (let i = 0; i < CAPACITY; i++) { const d = document.createElement('div'); d.className = 'slot'; slots.append(d); }
const groupsEl = $('groups');
for (let i = 0; i < VISIBLE; i++) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'group';
  b.addEventListener('click', () => onBoard(i));
  groupsEl.append(b);
}

function render() {
  $('trip').textContent = state.trip;
  $('delivered').textContent = state.delivered;
  $('waiting').textContent = state.queue.length;
  $('best').textContent = best ? `${best}人` : '-';
  $('load').textContent = load(state);
  $('left').textContent = remaining(state) === 0 ? '満員！' : `あと${remaining(state)}人`;
  [...slots.children].forEach((s, i) => s.classList.toggle('on', i < load(state)));
  const vis = visible(state);
  [...groupsEl.children].forEach((b, i) => {
    const size = vis[i];
    b.classList.toggle('empty', size === undefined);
    if (size === undefined) { b.innerHTML = ''; b.disabled = true; return; }
    const c = canBoard(state, i);
    b.innerHTML = `<span class="n">${size}</span><span class="u">人組</span><span class="dots" aria-hidden="true">${'●'.repeat(size)}</span>`;
    b.disabled = busy || !c.ok;
    b.setAttribute('aria-label', `${size}人組${c.ok ? 'を乗せる' : `（${c.reason}）`}`);
  });
  const go = $('go');
  go.disabled = busy || !canDepart(state);
  go.classList.toggle('hint', !state.finished && mustDepart(state) && canDepart(state));
  go.textContent = state.finished ? '終了' : `第${state.trip}便を出発`;
  let m = msg;
  if (state.finished) m = '全便が出発しました';
  else if (mustDepart(state)) m = canDepart(state) ? 'この便は出発しよう' : '';
  else if (load(state) === 0 && !busy) m = '乗せたい組を選ぼう（灰色は定員オーバー）';
  $('msg').textContent = m;
  $('result').hidden = !state.finished;
}

function onBoard(i) {
  if (busy) return;
  const c = canBoard(state, i);
  if (!c.ok) { msg = c.reason; render(); return; }
  state = board(state, i);
  msg = remaining(state) === 0 ? '満員！出発しよう' : `あと${remaining(state)}人乗れます`;
  render();
}

function onDepart() {
  if (busy || !canDepart(state)) return;
  busy = true;
  const car = $('car');
  car.classList.add('leaving');
  render();
  setTimeout(() => {
    const n = load(state);
    state = depart(state);
    msg = `${n}人を運びました`;
    car.classList.remove('leaving');
    busy = false;
    if (state.finished) {
      const isBest = state.delivered > best;
      if (isBest) { best = state.delivered; saveBest(best); }
      $('final').textContent = state.delivered;
      $('newbest').hidden = !isBest;
    }
    render();
    if (state.finished) $('again').focus({ preventScroll: true });
  }, OG ? 0 : 450);
}

function restart(next) { if (busy) return; state = next; msg = '乗せたい組を選ぼう'; render(); }

$('go').addEventListener('click', onDepart);
$('again').addEventListener('click', () => restart(replay(state)));
$('fresh').addEventListener('click', () => restart(newGame()));

if (OG) {
  document.body.classList.add('og');
  state = createState([4, 6, 3, 5, 2, 1, 6, 4, 3, 5, 2, 1, 6, 4, 3, 5, 2, 1]);
  state = board(board(state, 1), 0); // 6 + 4
  msg = '満員！出発しよう';
}
render();
