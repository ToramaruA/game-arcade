// 船体の SVG（外部素材なし）。見た目の状態はクラスで切り替える。<style> を SVG 内に持つので PNG 書き出しにも使える。
import { COMPS, NAMES, PARENT } from './logic.js';

export const CENTER = { C: [155, 280], H: [445, 280], E: [770, 280], L: [445, 135], G: [445, 420], P: [120, 440] };
const OUTLINE = {
  C: 'M58 280 Q66 226 150 220 L250 228 L250 332 L150 340 Q66 334 58 280 Z',
  H: 'M250 262 H640 V298 H250 Z',
  E: 'M650 205 H895 V355 H650 Z',
  L: 'M295 135 a150 78 0 1 0 300 0 a150 78 0 1 0 -300 0 Z',
  G: 'M345 352 L545 352 A100 100 0 0 1 345 352 Z',
  P: 'M62 440 a58 28 0 1 0 116 0 a58 28 0 1 0 -116 0 Z',
};
const EDGE = { H: [238, 264, 26, 32], L: [428, 211, 34, 54], G: [428, 298, 34, 56], E: [636, 266, 28, 28], P: [104, 334, 32, 78] };
const LABEL = { C: [155, 292], H: [445, 288], E: [720, 292], L: [445, 148], G: [445, 438], P: [120, 494] };
const CRACK = {
  L: 'M380 90 L420 125 L400 140 L452 175 L440 200 M520 80 L500 118 L535 140', H: 'M330 262 L360 280 L345 298 M520 262 L500 282 L525 298',
  G: 'M400 365 L430 395 L415 410 L450 440', E: 'M690 230 L720 262 L705 285 L735 320', C: 'M120 250 L150 280 L135 310', P: 'M90 430 L120 445',
};
const DRIFT = { L: '-40px,-80px', G: '30px,110px', E: '150px,70px', H: '70px,-30px', P: '-50px,90px', C: '-60px,0px' };
const ROT = { L: '-18deg', G: '14deg', E: '24deg', H: '9deg', P: '-20deg', C: '-6deg' };

const css = `
.sp text{font-family:ui-monospace,Menlo,Consolas,"Hiragino Sans","Noto Sans JP",monospace}
.hull{fill:#6D8190;stroke:#B6C6D2;stroke-width:3}
.hull2{fill:#51606D;stroke:#2f3b46;stroke-width:2}
.pipe{fill:none;stroke:#3a4752;stroke-width:5}
.win{fill:#C6F0F2}.amberwin{fill:#FFC35A}
.drift{transition:transform 1.6s ease-in,opacity 1.6s;transform-box:fill-box;transform-origin:center}
.gone .drift{opacity:.3}
.gone .hull,.gone .hull2{stroke-dasharray:6 5}
.gone-L .drift{transform:translate(${DRIFT.L}) rotate(${ROT.L})}.gone-G .drift{transform:translate(${DRIFT.G}) rotate(${ROT.G})}
.gone-E .drift{transform:translate(${DRIFT.E}) rotate(${ROT.E})}.gone-H .drift{transform:translate(${DRIFT.H}) rotate(${ROT.H})}
.gone-P .drift{transform:translate(${DRIFT.P}) rotate(${ROT.P})}.gone-C .drift{transform:translate(${DRIFT.C}) rotate(${ROT.C})}
.part{cursor:pointer}
.part.sel .hull{stroke:#74DFAC;stroke-width:5}
.part.gone{cursor:default;pointer-events:none}
.edge{cursor:pointer}.band{fill:#FFC35A;stroke:#7a5a14;stroke-width:2}
.edge.gone,.edge.sevd{display:none}
.edge.pick .band{fill:#fff2b8;stroke:#FFC35A;stroke-width:4}
.prev{display:none;fill:url(#hatch);stroke:#FFC35A;stroke-width:4;stroke-dasharray:10 6;pointer-events:none}
.part.pv .prev{display:block}
.fire{display:none;pointer-events:none}
.part.burn .fire{display:block}
.fglow{fill:#F16B50;opacity:.35;animation:pulse 2.4s ease-in-out infinite}
.flame{fill:#FFC35A;animation:pulse 1.8s ease-in-out infinite}.flame.b{fill:#F16B50;animation-delay:.6s}
.crack{fill:none;stroke:#F16B50;stroke-width:5;stroke-linecap:round;stroke-linejoin:round}
@keyframes pulse{0%,100%{opacity:.25}50%{opacity:.6}}
.flame{animation-name:flick}@keyframes flick{0%,100%{opacity:.7}50%{opacity:1}}
.noz{fill:#3a2a2a;stroke:#B6C6D2;stroke-width:3}.hot{fill:#FFC35A;opacity:.55}
.part.burn .hot,.hot.red{fill:#F16B50;opacity:.9}
.lbl{fill:#E3E8EC;font-size:26px;text-anchor:middle;paint-order:stroke;stroke:#080E1B;stroke-width:6px}
.lblbg{fill:#080E1B;opacity:.75}
.gone .lbl,.gone .lblbg{display:none}
.glass{fill:rgba(126,170,107,.18);stroke:#B6C6D2;stroke-width:3}
.shelf{stroke:#7EAA6B;stroke-width:5}.grow{fill:#7EAA6B}
.lamp{fill:#C6F0F2}
.wake{display:none;fill:#7fd6ff}.ok .wake{display:block;opacity:.5}
.lostship .hull,.lostship .hull2{fill:#3b444c}
.spark circle{fill:#FFC35A}
.spark{display:none}.spark.on{display:block}
.spark.on circle{animation:sp .9s ease-out forwards}@keyframes sp{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(4)}}
.debris{fill:#3d4a57;animation:drf 30s linear infinite}@keyframes drf{from{transform:translate(0,0)}to{transform:translate(-60px,30px)}}
.dot{fill:#C6F0F2;stroke:#080E1B;stroke-width:2}
.needle{transform-origin:880px 520px;transition:transform .5s}
`;

function stars() {
  let s = ''; let x = 7;
  for (let i = 0; i < 34; i += 1) {
    x = (x * 9301 + 49297) % 233280; const a = x / 233280;
    x = (x * 9301 + 49297) % 233280; const b = x / 233280;
    s += `<circle cx="${Math.round(a * 960)}" cy="${Math.round(b * 560)}" r="${i % 7 === 0 ? 2 : 1.2}" fill="#C6F0F2" opacity="${0.35 + (i % 4) * 0.12}"/>`;
  }
  return s;
}

function partShape(c) {
  const dr = (inner) => `<g class="drift">${inner}</g>`;
  if (c === 'C') {
    return dr(`<path class="hull" d="${OUTLINE.C}"/><path class="hull2" d="M85 275 Q95 245 150 240 L215 246 L215 316 L150 320 Q95 315 85 275Z"/>
      <path class="win" d="M92 268 Q100 252 140 248 L140 266Z"/><rect class="win" x="150" y="246" width="40" height="14"/><rect class="win" x="150" y="300" width="40" height="12"/>
      <path class="pipe" d="M215 262 H250 M215 298 H250"/><circle class="lamp" cx="90" cy="292" r="4"/>`);
  }
  if (c === 'H') {
    let t = '';
    for (let x = 262; x < 640; x += 30) t += `<path class="pipe" d="M${x} 264 L${x + 30} 296 M${x + 30} 264 L${x} 296" style="stroke-width:2"/>`;
    return dr(`<path class="hull" d="${OUTLINE.H}"/>${t}<rect class="hull2" x="395" y="252" width="100" height="56"/><rect class="amberwin" x="410" y="262" width="12" height="8"/><rect class="amberwin" x="430" y="262" width="12" height="8"/><rect class="amberwin" x="450" y="262" width="12" height="8"/><rect class="amberwin" x="410" y="290" width="12" height="8"/>`);
  }
  if (c === 'E') {
    return dr(`<path class="hull" d="M650 222 H765 V338 H650 Z"/><path class="pipe" d="M660 245 H760 M660 280 H760 M660 315 H760"/><rect class="hull2" x="668" y="236" width="20" height="108"/>
      <polygon class="noz" points="765,230 815,230 892,198 892,272 815,262 765,262"/><polygon class="noz" points="765,298 815,298 892,288 892,362 815,330 765,330"/>
      <ellipse class="hot" cx="880" cy="235" rx="14" ry="30"/><ellipse class="hot" cx="880" cy="325" rx="14" ry="30"/>`);
  }
  if (c === 'L') {
    let w = '';
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2; const x = 445 + Math.cos(a) * 128; const y = 135 + Math.sin(a) * 64;
      w += `<rect class="${i % 3 ? 'amberwin' : 'win'}" x="${x - 7}" y="${y - 5}" width="14" height="10"/>`;
    }
    return dr(`<ellipse class="hull" cx="445" cy="135" rx="150" ry="78"/><ellipse class="hull2" cx="445" cy="135" rx="104" ry="48"/>${w}
      <path class="pipe" d="M345 135 H545 M445 87 V183"/><rect class="amberwin" x="400" y="118" width="24" height="14"/><rect class="amberwin" x="466" y="140" width="24" height="14"/>`);
  }
  if (c === 'G') {
    return dr(`<path class="glass" d="${OUTLINE.G}"/><path class="shelf" d="M368 380 H522 M378 408 H512 M398 436 H492"/>
      <rect class="grow" x="380" y="366" width="14" height="14"/><rect class="grow" x="430" y="364" width="14" height="16"/><rect class="grow" x="490" y="366" width="14" height="14"/>
      <rect class="grow" x="400" y="394" width="14" height="14"/><rect class="grow" x="460" y="392" width="14" height="16"/><circle class="lamp" cx="445" cy="358" r="6" style="fill:#aef08a"/>
      <path class="hull" d="M345 352 H545" style="fill:none"/>`);
  }
  return dr(`<ellipse class="hull" style="fill:#e8eef2" cx="120" cy="440" rx="58" ry="28"/><ellipse class="win" cx="105" cy="436" rx="14" ry="8"/><path class="pipe" d="M178 440 h14" style="stroke:#9fb0bc"/>`);
}

export function shipSvg() {
  const parts = COMPS.map((c) => {
    const [lx, ly] = LABEL[c];
    const [cx, cy] = CENTER[c];
    return `<g id="part-${c}" class="part" data-comp="${c}">${partShape(c)}
      <path class="prev" d="${OUTLINE[c]}"/>
      <g class="fire"><path class="fglow" d="${OUTLINE[c]}"/><path class="crack" d="${CRACK[c]}"/>
        <polygon class="flame" points="${cx - 18},${cy + 14} ${cx - 8},${cy - 18} ${cx},${cy + 6} ${cx + 10},${cy - 24} ${cx + 20},${cy + 14}"/>
        <polygon class="flame b" points="${cx + 30},${cy + 14} ${cx + 38},${cy - 8} ${cx + 48},${cy + 14}"/></g>
      <rect class="lblbg" x="${lx - 66}" y="${ly - 25}" width="132" height="34" rx="3"/><text id="lab-${c}" class="lbl" x="${lx}" y="${ly}"></text></g>`;
  }).join('');
  const edges = Object.keys(PARENT).map((c) => {
    const [x, y, w, h] = EDGE[c];
    return `<g id="edge-${c}" class="edge" data-edge="${c}"><rect x="${x - 6}" y="${y - 6}" width="${w + 12}" height="${h + 12}" fill="transparent"/><rect class="band" x="${x}" y="${y}" width="${w}" height="${h}"/>
      <path d="M${x + 2} ${y + h} L${x + w - 2} ${y}" stroke="#7a5a14" stroke-width="3"/><g class="spark" id="spark-${c}"><circle cx="${x + w / 2}" cy="${y + h / 2}" r="6"/><circle cx="${x + w / 2 + 12}" cy="${y + h / 2 - 10}" r="4"/></g></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="sp" id="ship" viewBox="0 0 960 560" width="960" height="560" role="img" aria-label="燃える宇宙船の断面図">
  <style>${css}</style>
  <defs>
    <pattern id="hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="rgba(241,107,80,.18)"/><rect width="6" height="14" fill="#FFC35A" opacity=".75"/></pattern>
    <radialGradient id="planet" cx="50%" cy="85%" r="70%"><stop offset="0" stop-color="#d9684c"/><stop offset=".6" stop-color="#8b2f2a"/><stop offset="1" stop-color="#3a1220"/></radialGradient>
  </defs>
  <rect width="960" height="560" fill="#080E1B"/>
  ${stars()}
  <circle cx="620" cy="-250" r="430" fill="url(#planet)"/>
  <path d="M440 176 Q640 160 900 190" fill="none" stroke="#e98a6b" stroke-width="3" opacity=".5"/>
  <path d="M120 60 L190 110 L170 140 L240 200" fill="none" stroke="#C6F0F2" stroke-width="2" opacity=".5"/><path d="M820 40 L780 90 L800 130" fill="none" stroke="#C6F0F2" stroke-width="2" opacity=".4"/>
  <polygon class="debris" points="60,500 90,490 100,515 70,525"/><polygon class="debris" points="780,470 810,465 815,490 790,495"/><polygon class="debris" points="880,100 900,95 905,112 885,118"/>
  <g id="shipbody"><g class="wake"><polygon points="900,205 960,215 900,235"/><polygon points="900,325 960,335 900,355"/></g>
  ${edges}${parts}</g>
  <g id="dots"></g>
  <g transform="translate(0,0)"><path d="M820 520 A60 60 0 0 1 940 520" fill="none" stroke="#2A3A50" stroke-width="8"/><path d="M820 520 A60 60 0 0 1 880 460" fill="none" stroke="#FFC35A" stroke-width="4" opacity=".6"/><text x="880" y="552" fill="#93A3B0" font-size="22" text-anchor="middle">猶予</text><line id="needle" class="needle" x1="880" y1="520" x2="880" y2="470" stroke="#74DFAC" stroke-width="4"/><circle cx="880" cy="520" r="6" fill="#74DFAC"/></g>
</svg>`;
}
export { OUTLINE, EDGE, NAMES };
