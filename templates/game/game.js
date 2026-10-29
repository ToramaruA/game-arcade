import { createState, tap } from './logic.js';

let state = createState();
const out = document.getElementById('score');
document.getElementById('play').addEventListener('click', () => {
  state = tap(state);
  out.textContent = String(state.score);
});
