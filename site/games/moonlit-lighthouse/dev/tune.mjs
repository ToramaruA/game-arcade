import { NIGHTS } from '../levels.js';
import { keepersAvailable, ENEMIES, TOWERS, RULES } from '../logic.js';
import { attemptExport, setVariant } from './solve.mjs';
const cfg = JSON.parse(process.argv[2] || '{}');
for (const [k, v] of Object.entries(cfg.hp || {})) ENEMIES[k].hp = v;
if (cfg.hpMul) for (const k of Object.keys(ENEMIES)) if (!ENEMIES[k].boss) ENEMIES[k].hp = Math.round(ENEMIES[k].hp * cfg.hpMul);
if (cfg.red) TOWERS.red.dps = cfg.red;
if (cfg.redCost) TOWERS.red.cost = cfg.redCost;
if (cfg.white) TOWERS.white.dps = cfg.white;
if (cfg.armor) RULES.armor = cfg.armor;
if (cfg.sig) RULES.signalDmg = cfg.sig;
for (const k of ['mesh','sigCost','sigStep','combo']) if (cfg[k] != null) RULES[k] = cfg[k];
for (const k of ['red','blue','yellow','white']) if (cfg[k+'T']) Object.assign(TOWERS[k], cfg[k+'T']);
const N = cfg.tries || 16;
const nights = cfg.nights || NIGHTS.map((_, i) => i);
for (const v of ['redOnly', 'noSignal', null]) {
  setVariant(v);
  const out = []; let tot = 0;
  for (const n of nights) {
    let wins = 0;
    for (let seed = 1; seed <= N; seed++) for (const k of [keepersAvailable(n).at(-1)]) { const { s } = attemptExport(n, 'normal', seed, k); if (s.result === 'win') wins++; }
    out.push(`${n + 1}:${wins}`); tot += wins;
  }
  console.log((v || 'full').padEnd(9), String(tot).padStart(4), out.join(' '));
}
