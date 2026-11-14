import { NIGHTS, wavesFor } from '../levels.js';
import { buildMap, COLS, ROWS } from '../logic.js';
for (let i = 0; i < NIGHTS.length; i++) {
  const m = buildMap(i);
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill('.'));
  for (const c of m.cells) { const [x, y] = c.split(',').map(Number); g[y][x] = '#'; }
  m.peds.forEach((p, k) => { g[p.cy][p.cx] = k < 10 ? String(k) : 'P'; });
  for (const k of m.keeperPts) g[Math.floor(k.y)][Math.floor(k.x)] = 'k';
  g[Math.floor(m.lh.y)][Math.floor(m.lh.x)] = 'L';
  const lens = m.paths.map((p) => p.len.toFixed(1)).join('/');
  const counts = wavesFor(i).map((w) => w.reduce((a, b) => a + b.count, 0)).join(',');
  console.log(`N${i + 1} ${NIGHTS[i].name} lens ${lens} peds ${m.peds.length} waves ${counts}`);
  console.log(g.map((r) => r.join('')).join('\n'));
}
