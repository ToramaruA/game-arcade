// 各夜の「別の構成」での攻略を探して solutions.json に alt: として保存する
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NIGHTS } from '../levels.js';
import { keepersAvailable, replay } from '../logic.js';
import { solve } from './solve.mjs';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'solutions.json');
const data = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const layout = (plan, n) => { const r = replay(n, 'normal', plan).state; return r.towers.map((t) => `${t.type}@${t.ped}`).sort().join(' '); };
for (let n = 0; n < NIGHTS.length; n++) {
  const main = data[`normal:${n}`];
  const mainLayout = layout(main, n);
  const ks = keepersAvailable(n);
  let found = null;
  for (const [k, start] of [[ks.find((x) => x !== main.keeper) || main.keeper, 300], [main.keeper, 600], [ks[0], 900]]) {
    const best = solve(n, 'normal', { tries: 120, keeper: k, start });
    if (best && layout(best, n) !== mainLayout) { found = best; break; }
  }
  if (found) { data[`alt:normal:${n}`] = { keeper: found.keeper, hp: found.hp, actions: found.actions }; console.log(n + 1, 'alt', found.keeper, found.hp, layout(found, n), '| main', mainLayout); }
  else console.log(n + 1, 'NO ALT');
}
fs.writeFileSync(OUT, JSON.stringify(data));
