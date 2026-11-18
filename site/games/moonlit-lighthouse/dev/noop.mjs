import { NIGHTS } from '../levels.js';
import { createNight, step, startWave } from '../logic.js';
for (const mode of ['normal', 'tide']) {
  const out = [];
  for (let n = 0; n < NIGHTS.length; n++) {
    const s = createNight(n, { mode });
    while (!s.result && s.frame < 60 * 60 * 30) { if (!s.inWave) startWave(s); step(s); s.fx.length = 0; }
    out.push(`${n + 1}:${s.result}@w${s.waveIdx}`);
  }
  console.log(mode, out.join(' '));
}
