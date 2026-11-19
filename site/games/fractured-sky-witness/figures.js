// 人物の立ち絵（SVG）。透明アクリル板を重ねた画風。顔は目と口だけの簡単な形で、表情（pose）を変える。
// 原点 = 足もとの中央（舞台の下端）。高さはおよそ 300。
import { C } from './scene.js';

// 板（白いふち＋ずらした透明板）
const P = (d, fill, op = 1) => `<path d="${d}" fill="#fff" opacity=".35" transform="translate(4 -4)"/><path d="${d}" fill="${fill}" fill-opacity="${op}" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/>`;

// 顔（頭の中心 0,0、半径 r）。pose: neutral | down | away | firm | smile | shock
function face(pose, r, ink = C.ink) {
  const ex = r * 0.36; const ey = r * 0.05;
  const dx = pose === 'away' ? -r * 0.28 : 0;
  let eyes; let mouth; let brow = '';
  switch (pose) {
    case 'down':
      eyes = `<path d="M ${-ex - 5 + dx} ${ey + 4} q 5 4 10 0 M ${ex - 5 + dx} ${ey + 4} q 5 4 10 0" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
      mouth = `<path d="M ${-5 + dx} ${r * 0.5} h 10" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`;
      brow = `<path d="M ${-ex - 7 + dx} ${-r * 0.2} l 12 3 M ${ex + 7 + dx} ${-r * 0.2} l -12 3" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`;
      break;
    case 'smile':
      eyes = `<path d="M ${-ex - 5 + dx} ${ey + 2} q 5 -6 10 0 M ${ex - 5 + dx} ${ey + 2} q 5 -6 10 0" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
      mouth = `<path d="M ${-7 + dx} ${r * 0.42} q 7 7 14 0" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
      break;
    case 'firm':
      eyes = `<ellipse cx="${-ex + dx}" cy="${ey + 2}" rx="3.2" ry="3.6" fill="${ink}"/><ellipse cx="${ex + dx}" cy="${ey + 2}" rx="3.2" ry="3.6" fill="${ink}"/>`;
      brow = `<path d="M ${-ex - 8 + dx} ${-r * 0.24} l 13 5 M ${ex + 8 + dx} ${-r * 0.24} l -13 5" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`;
      mouth = `<path d="M ${-7 + dx} ${r * 0.5} h 14" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`;
      break;
    case 'shock':
      eyes = `<circle cx="${-ex + dx}" cy="${ey}" r="4.6" fill="#fff" stroke="${ink}" stroke-width="2"/><circle cx="${ex + dx}" cy="${ey}" r="4.6" fill="#fff" stroke="${ink}" stroke-width="2"/><circle cx="${-ex + dx}" cy="${ey}" r="1.8" fill="${ink}"/><circle cx="${ex + dx}" cy="${ey}" r="1.8" fill="${ink}"/>`;
      mouth = `<ellipse cx="${dx}" cy="${r * 0.52}" rx="4" ry="5" fill="${ink}"/>`;
      break;
    default:
      eyes = `<ellipse cx="${-ex + dx}" cy="${ey}" rx="3.2" ry="4" fill="${ink}"/><ellipse cx="${ex + dx}" cy="${ey}" rx="3.2" ry="4" fill="${ink}"/>`;
      mouth = `<path d="M ${-5 + dx} ${r * 0.48} q 5 3 10 0" stroke="${ink}" stroke-width="2.3" fill="none" stroke-linecap="round"/>`;
  }
  const blush = pose === 'smile' || pose === 'down' ? `<ellipse cx="${-ex - 4 + dx}" cy="${r * 0.3}" rx="6" ry="3" fill="#ff9fb3" opacity=".5"/><ellipse cx="${ex + 4 + dx}" cy="${r * 0.3}" rx="6" ry="3" fill="#ff9fb3" opacity=".5"/>` : '';
  return blush + brow + eyes + mouth;
}

const headTilt = (pose) => (pose === 'down' ? 9 : pose === 'away' ? -8 : pose === 'firm' ? -2 : 0);

// 気象官ネム：シアンの長いコート、白いスカーフ、風見の付いたベレー帽、手に風速計
function nem(pose) {
  const r = 38;
  let s = '';
  s += P('M -78 0 L -66 -150 Q -60 -196 0 -204 Q 60 -196 66 -150 L 78 0 Z', C.cyan, 0.95);
  s += P('M -30 -200 Q 0 -178 30 -200 L 20 -150 Q 0 -140 -20 -150 Z', '#ffffff');
  s += `<path d="M 0 -150 L 0 0" stroke="#fff" stroke-width="2" opacity=".7"/>`;
  for (const y of [-120, -86, -52]) s += `<circle cx="10" cy="${y}" r="4.5" fill="${C.lemon}" stroke="#fff" stroke-width="1.5"/>`;
  // 腕と風速計
  s += P('M 58 -170 Q 92 -120 84 -86 L 66 -84 Q 66 -118 48 -150 Z', C.cyanDeep, 0.9);
  s += `<g transform="translate(78 -90)"><line x1="0" y1="0" x2="0" y2="-46" stroke="${C.ink}" stroke-width="3"/><g class="spinf"><line x1="-18" y1="-46" x2="18" y2="-46" stroke="${C.ink}" stroke-width="2.5"/><circle cx="-18" cy="-46" r="5" fill="${C.lemon}" stroke="#fff"/><circle cx="18" cy="-46" r="5" fill="${C.lemon}" stroke="#fff"/></g></g>`;
  // 頭
  s += `<g transform="translate(0 -248) rotate(${headTilt(pose)})">`;
  s += P(`M ${-r - 6} 12 Q ${-r - 8} ${-r - 8} 0 ${-r - 10} Q ${r + 8} ${-r - 8} ${r + 6} 12 L ${r + 2} 30 L ${-r - 2} 30 Z`, C.ink);
  s += `<circle r="${r}" fill="#fff4ea" stroke="#fff" stroke-width="2.4"/>`;
  s += `<path d="M ${-r} -6 Q -10 -30 ${r} -12 Q ${r} ${-r - 4} 0 ${-r - 4} Q ${-r} ${-r - 4} ${-r} -6 Z" fill="${C.ink}"/>`;
  s += `<g transform="translate(-6 ${-r - 6})"><ellipse rx="${r + 4}" ry="12" fill="#fff" stroke="${C.line}" stroke-width="1.5"/><line x1="10" y1="-10" x2="10" y2="-30" stroke="${C.ink}" stroke-width="2"/><polygon points="10,-34 24,-30 10,-26" fill="${C.lemonDeep}"/></g>`;
  s += face(pose, r);
  s += '</g>';
  return s;
}

// 裁判長オル：白とうす紫の法衣、レモン色の帯、高い襟、銀髪と丸めがね、巻物
function ol(pose) {
  const r = 37;
  let s = '';
  s += P('M -92 0 L -78 -150 Q -66 -198 0 -206 Q 66 -198 78 -150 L 92 0 Z', '#ffffff', 0.97);
  s += P('M -60 -186 L -34 0 L 34 0 L 60 -186 Q 0 -168 -60 -186 Z', '#d9cffb', 0.85);
  s += P('M -14 -196 L 14 -196 L 10 0 L -10 0 Z', C.lemon);
  s += P('M -44 -206 L -30 -232 L 0 -214 L 30 -232 L 44 -206 Q 0 -190 -44 -206 Z', '#ffffff');
  // 巻物
  s += P('M -100 -112 L -40 -120 L -38 -96 L -98 -88 Z', '#fffbe8');
  s += `<circle cx="-100" cy="-100" r="8" fill="${C.lemonDeep}" stroke="#fff" stroke-width="1.5"/>`;
  s += `<g transform="translate(0 -262) rotate(${headTilt(pose)})">`;
  s += `<circle r="${r}" fill="#fbefe4" stroke="#fff" stroke-width="2.4"/>`;
  s += `<path d="M ${-r - 2} 4 Q ${-r - 6} ${-r - 8} 0 ${-r - 6} Q ${r + 6} ${-r - 8} ${r + 2} 4 Q ${r - 6} -22 0 -26 Q ${-r + 6} -22 ${-r - 2} 4 Z" fill="#e6eef2" stroke="#fff" stroke-width="2"/>`;
  s += `<path d="M -16 ${r * 0.66} Q 0 ${r + 10} 16 ${r * 0.66}" fill="#e6eef2" stroke="#fff" stroke-width="1.5"/>`;
  s += face(pose, r);
  const dx = pose === 'away' ? -r * 0.28 : 0;
  s += `<g fill="none" stroke="${C.ink}" stroke-width="2"><circle cx="${-r * 0.36 + dx}" cy="2" r="9"/><circle cx="${r * 0.36 + dx}" cy="2" r="9"/><line x1="${-r * 0.36 + 9 + dx}" y1="2" x2="${r * 0.36 - 9 + dx}" y2="2"/></g>`;
  s += '</g>';
  return s;
}

// 修復師リト：桃色のエプロン、白いシャツ、頭にゴーグル、手にレンチ
function rito(pose) {
  const r = 37;
  let s = '';
  s += P('M -80 0 L -70 -150 Q -62 -196 0 -202 Q 62 -196 70 -150 L 80 0 Z', '#ffffff', 0.97);
  s += P('M -50 -170 L 50 -170 L 58 0 L -58 0 Z', '#ffb995', 0.92);
  s += `<path d="M -50 -170 L -30 -200 M 50 -170 L 30 -200" stroke="#ffb995" stroke-width="7"/>`;
  s += P('M -30 -110 L 30 -110 L 30 -70 L -30 -70 Z', '#ffd8c2');
  s += `<rect x="-50" y="-60" width="100" height="10" fill="${C.ink}" opacity=".7"/>`;
  s += P('M -62 -168 Q -98 -120 -92 -80 L -74 -80 Q -76 -116 -50 -148 Z', '#ffe9dc');
  s += `<g transform="translate(-86 -84) rotate(-20)"><rect x="-4" y="-50" width="8" height="50" rx="3" fill="${C.cyanDeep}"/><path d="M -12 -58 a 12 12 0 1 1 24 0 l -6 4 l -6 -6 l -6 6 Z" fill="${C.cyanDeep}" stroke="#fff" stroke-width="1.5"/></g>`;
  s += `<g transform="translate(0 -250) rotate(${headTilt(pose)})">`;
  s += `<circle r="${r}" fill="#fbe9dc" stroke="#fff" stroke-width="2.4"/>`;
  s += `<path d="M ${-r - 2} -6 Q ${-r - 2} ${-r - 6} 0 ${-r - 8} Q ${r + 2} ${-r - 6} ${r + 2} -6 Q 14 -26 -6 -22 Q -24 -20 ${-r - 2} -6 Z" fill="#8a5a3c" stroke="#fff" stroke-width="1.5"/>`;
  s += `<path d="M ${-r - 4} -2 L ${-r + 4} -28 L -18 ${-r - 10} L 0 ${-r - 2} L 14 ${-r - 12} L 28 -30 L ${r + 6} -4 Q ${r} ${-r - 2} 0 ${-r - 6} Q ${-r} ${-r - 2} ${-r - 4} -2 Z" fill="#8a5a3c" stroke="#fff" stroke-width="1.5"/>`;
  s += `<g transform="translate(0 ${-r * 0.62})"><rect x="${-r - 2}" y="-4" width="${2 * r + 4}" height="8" fill="${C.ink}"/><circle cx="-14" cy="0" r="11" fill="#c7f4fb" stroke="${C.ink}" stroke-width="3"/><circle cx="14" cy="0" r="11" fill="#c7f4fb" stroke="${C.ink}" stroke-width="3"/></g>`;
  s += face(pose, r);
  s += '</g>';
  return s;
}

// 市民：小さな人の集まり（旗を持つ子も）
function city(pose) {
  const people = [[-90, 0.8, C.rose], [-30, 1, C.lemonDeep], [40, 0.9, C.cyan], [100, 0.75, C.peach]];
  let s = '';
  for (const [x, k, col] of people) {
    s += `<g transform="translate(${x} 0) scale(${k})">`;
    s += P('M -36 0 L -30 -96 Q -26 -120 0 -124 Q 26 -120 30 -96 L 36 0 Z', col, 0.92);
    s += `<g transform="translate(0 -152)"><circle r="26" fill="#fbefe4" stroke="#fff" stroke-width="2"/><path d="M -27 -2 Q -26 -30 0 -30 Q 26 -30 27 -2 Q 12 -18 -27 -2 Z" fill="${C.ink}"/>${face(pose === 'down' ? 'down' : pose, 26)}</g>`;
    s += '</g>';
  }
  s += `<g transform="translate(-30 -130)"><line x1="40" y1="0" x2="40" y2="-90" stroke="${C.ink}" stroke-width="3"/><polygon points="40,-90 84,-78 40,-64" fill="${C.lemon}" stroke="#fff" stroke-width="2"/></g>`;
  return s;
}

const DRAW = { nem, ol, rito, city };

// 立ち絵。x は舞台上の中心、scale は大きさ
export function figure(who, pose = 'neutral', { x = 610, scale = 1, cls = '' } = {}) {
  const fn = DRAW[who];
  if (!fn) return '';
  return `<g transform="translate(${x} 470) scale(${scale})"><g class="fig ${cls} pose-${pose}"><ellipse cx="0" cy="-4" rx="${who === 'city' ? 160 : 90}" ry="10" fill="${C.ink}" opacity=".12"/>${fn(pose)}</g></g>`;
}

export const HAS_FIGURE = (who) => !!DRAW[who];
