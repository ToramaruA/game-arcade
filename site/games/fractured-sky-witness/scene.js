// 舞台の絵（SVG）。朝のシアン・レモン黄・白、透明アクリル板を重ねたコラージュ。
// 背景（空・街・裂け目）は章ごとに1回だけ作り、調査地点や旗・鍵などは毎回描き直す。
const W = 800; const H = 460;
const C = {
  sky0: '#43c6dd', sky1: '#8fe3ef', sky2: '#e6fbff',
  white: '#ffffff', shade: '#d3f1f7', shade2: '#b5e6ef', line: '#9fdbe7',
  lemon: '#ffe14d', lemon2: '#fff3a3', lemonDeep: '#f5c400',
  cyan: '#1fb6d1', cyanDeep: '#0b8fab', ink: '#1d5c6c',
  peach: '#ffd2b8', rose: '#ffb7c9',
};

function rng(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
const f = (n) => Math.round(n * 10) / 10;

// 裂け目の折れ線（左上から右下へ）
const CRACK = [[30, 8], [120, 40], [175, 34], [250, 78], [330, 70], [395, 112], [470, 104], [540, 150], [610, 142], [668, 186], [720, 196], [760, 232]];
function crackPoly(wTop, wBot, jitter = 0, seed = 3) {
  const R = rng(seed);
  const up = CRACK.map(([x, y], i) => [x + (R() - 0.5) * jitter, y - (wTop * (0.35 + 0.65 * Math.sin((i / (CRACK.length - 1)) * Math.PI)))]);
  const dn = CRACK.map(([x, y], i) => [x + (R() - 0.5) * jitter, y + (wBot * (0.3 + 0.7 * Math.sin((i / (CRACK.length - 1)) * Math.PI)))]).reverse();
  return [...up, ...dn].map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
}

function defs() {
  return `<defs>
    <linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.sky0}"/><stop offset=".55" stop-color="${C.sky1}"/><stop offset="1" stop-color="${C.sky2}"/>
    </linearGradient>
    <radialGradient id="gSun" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#fffef0"/><stop offset=".35" stop-color="${C.lemon2}" stop-opacity=".9"/><stop offset="1" stop-color="${C.lemon2}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gCrack" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#f3feff"/><stop offset="1" stop-color="#fffbe0"/>
    </linearGradient>
    <linearGradient id="gOther" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff6c9"/><stop offset="1" stop-color="#ffe0d0"/>
    </linearGradient>
    <linearGradient id="gGround" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f7feff"/><stop offset="1" stop-color="#dff6fa"/>
    </linearGradient>
    <linearGradient id="gShard" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".6" stop-color="#bff3fb" stop-opacity=".75"/><stop offset="1" stop-color="${C.lemon2}" stop-opacity=".85"/>
    </linearGradient>
    <filter id="fGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="fSoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>
    <clipPath id="clipCrack"><polygon points="${crackPoly(26, 30)}"/></clipPath>
  </defs>`;
}

// アクリル板（色面＋白いふち＋ずらした透明板）
function plate(x, y, w, h, fill, op = 0.9, r = 3) {
  return `<rect x="${f(x + 3)}" y="${f(y - 3)}" width="${f(w)}" height="${f(h)}" rx="${r}" fill="#ffffff" opacity=".35"/>
    <rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${r}" fill="${fill}" fill-opacity="${op}" stroke="#ffffff" stroke-width="1.4"/>`;
}

function sky(other) {
  const R = rng(11);
  let s = `<rect width="${W}" height="${H}" fill="url(#gSky)"/>`;
  s += `<circle cx="660" cy="64" r="120" fill="url(#gSun)"/>`;
  // 透明の雲板
  for (let i = 0; i < 7; i++) {
    const x = R() * 760; const y = 20 + R() * 120; const w = 70 + R() * 120;
    s += `<g opacity="${f(0.45 + R() * 0.3)}"><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="16" rx="8" fill="#ffffff"/><rect x="${f(x + 18)}" y="${f(y - 9)}" width="${f(w * 0.5)}" height="14" rx="7" fill="#ffffff"/></g>`;
  }
  // 斜めの光の帯
  s += `<g opacity=".18"><polygon points="520,0 600,0 300,460 220,460" fill="#ffffff"/><polygon points="660,0 690,0 430,460 400,460" fill="#ffffff"/></g>`;
  // 裂け目
  s += `<polygon points="${crackPoly(34, 38, 4, 5)}" fill="#ffffff" opacity=".55" filter="url(#fGlow)"/>`;
  s += `<polygon points="${crackPoly(30, 34, 10, 4)}" fill="none" stroke="${C.cyanDeep}" stroke-opacity=".55" stroke-width="2.2"/>`;
  s += `<polygon points="${crackPoly(26, 30)}" fill="url(#gCrack)" stroke="#ffffff" stroke-width="2"/>`;
  s += `<polygon points="${crackPoly(9, 10, 3, 6)}" fill="${C.lemon2}" opacity=".75"/>`;
  if (other) s += otherCity();
  s += `<polygon points="${crackPoly(14, 16, 6, 9)}" fill="none" stroke="${C.cyan}" stroke-opacity=".35" stroke-width="1.2"/>`;
  s += `<polyline points="${CRACK.map(([x, y]) => `${x},${y}`).join(' ')}" fill="none" stroke="#ffffff" stroke-width="2.5" opacity=".9"/>`;
  // ひびの枝
  const R2 = rng(21);
  for (const [x, y] of CRACK.slice(1, -1)) {
    const a = R2() * Math.PI * 2; const l = 14 + R2() * 26;
    s += `<polyline points="${x},${y} ${f(x + Math.cos(a) * l * 0.5)},${f(y + Math.sin(a) * l * 0.5 + 4)} ${f(x + Math.cos(a) * l)},${f(y + Math.sin(a) * l)}" fill="none" stroke="#ffffff" stroke-width="1.3" opacity=".8"/>`;
  }
  return s;
}

// 裂け目の向こうの街（第2章以降）
function otherCity() {
  const R = rng(77);
  let s = '<g clip-path="url(#clipCrack)">';
  s += `<rect width="${W}" height="${H}" fill="url(#gOther)"/>`;
  for (let x = 20; x < 780; x += 18 + R() * 16) {
    const y = 40 + (x / 800) * 200;
    const h = 14 + R() * 26;
    s += `<rect x="${f(x)}" y="${f(y - h + 24)}" width="${f(10 + R() * 10)}" height="${f(h)}" fill="${R() < 0.5 ? C.peach : '#fff'}" opacity=".85"/>`;
    s += `<rect x="${f(x)}" y="${f(y - h + 20)}" width="${f(12 + R() * 8)}" height="5" fill="${C.lemonDeep}" opacity=".7"/>`;
  }
  // 手を振る小さな人
  s += `<g transform="translate(500 128)"><circle cx="0" cy="-8" r="3" fill="${C.ink}"/><rect x="-2.5" y="-5" width="5" height="9" rx="2" fill="${C.rose}"/><line x1="2" y1="-4" x2="7" y2="-11" stroke="${C.ink}" stroke-width="1.6" class="wave"/></g>`;
  s += '</g>';
  return s;
}

// 白い階段都市
function city(seed) {
  const R = rng(seed);
  let s = '';
  // 丘の段（テラス）
  const terr = [250, 282, 318, 356, 398];
  terr.forEach((y, i) => {
    const off = (i % 2 ? 30 : -10);
    s += `<path d="M -10 ${y} Q 200 ${y - 14 + off * 0.2} 400 ${y - 4} T 810 ${y - 18 + i * 3} L 810 ${H} L -10 ${H} Z" fill="url(#gGround)" stroke="${C.line}" stroke-width="1" opacity="${0.75 + i * 0.05}"/>`;
  });
  // 建物（奥から手前へ）
  terr.forEach((base, row) => {
    const scale = 0.7 + row * 0.12;
    for (let x = -10 + R() * 30; x < 810; x += (30 + R() * 34) * scale) {
      if (R() < 0.18) continue;
      const w = (22 + R() * 26) * scale; const h = (20 + R() * 34) * scale;
      const y = base - h + 6;
      const roof = R();
      s += `<g>`;
      s += `<polygon points="${f(x + w)},${f(y)} ${f(x + w + 6 * scale)},${f(y - 4 * scale)} ${f(x + w + 6 * scale)},${f(y + h - 4)} ${f(x + w)},${f(y + h)}" fill="${C.shade}"/>`;
      s += plate(x, y, w, h, '#ffffff', 0.96, 1.5);
      if (roof < 0.55) s += `<polygon points="${f(x - 2)},${f(y)} ${f(x + w / 2)},${f(y - 10 * scale)} ${f(x + w + 2)},${f(y)}" fill="${C.lemon}" stroke="#fff" stroke-width="1"/>`;
      else if (roof < 0.8) s += `<rect x="${f(x - 2)}" y="${f(y - 4 * scale)}" width="${f(w + 4)}" height="${f(5 * scale)}" fill="${C.lemon2}" stroke="#fff" stroke-width="1"/>`;
      else s += `<path d="M ${f(x + 2)} ${f(y)} A ${f(w / 2 - 2)} ${f(w / 2 - 2)} 0 0 1 ${f(x + w - 2)} ${f(y)} Z" fill="#c7f3fa" stroke="#fff"/>`;
      // 窓
      const cols = Math.max(1, Math.floor(w / (9 * scale)));
      for (let c = 0; c < cols; c++) {
        const wx = x + 4 * scale + c * ((w - 8 * scale) / cols);
        if (R() < 0.7) s += `<rect x="${f(wx)}" y="${f(y + h * 0.3)}" width="${f(4 * scale)}" height="${f(7 * scale)}" rx="${f(2 * scale)}" fill="${C.cyan}" opacity=".55"/>`;
      }
      s += `</g>`;
    }
    // 階段
    if (row < terr.length - 1) {
      const sx = 60 + R() * 680; const n = 6;
      let d = `M ${f(sx)} ${base + 4}`;
      for (let k = 0; k < n; k++) d += ` l 6 0 l 0 ${f((terr[row + 1] - base) / n)}`;
      s += `<path d="${d}" fill="none" stroke="${C.shade2}" stroke-width="2"/>`;
    }
  });
  return s;
}

// 目印になる建物
function landmarks(chNo) {
  let s = '';
  // 観測塔（第1章）／ 第3章は同じ塔に旗
  s += `<g transform="translate(612 0)">
    <rect x="-13" y="168" width="26" height="110" fill="#fff" stroke="${C.line}"/>
    <rect x="-10" y="176" width="20" height="96" fill="${C.shade}" opacity=".5"/>
    <path d="M -18 168 A 18 18 0 0 1 18 168 Z" fill="${C.lemon}" stroke="#fff" stroke-width="1.5"/>
    <line x1="0" y1="150" x2="0" y2="131" stroke="${C.ink}" stroke-width="1.6"/>
    <g class="vane"><polygon points="-10,134 10,134 6,130 10,134 6,138" fill="${C.ink}"/></g>
    <rect x="-6" y="196" width="12" height="16" rx="6" fill="${C.cyan}" opacity=".6"/>
  </g>`;
  // 修復工房（歯車の看板）
  s += `<g transform="translate(178 0)">
    ${plate(-34, 288, 68, 44, '#ffffff', 0.97)}
    <polygon points="-38,288 0,266 38,288" fill="${C.lemon}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="0" cy="306" r="9" fill="none" stroke="${C.cyanDeep}" stroke-width="3" stroke-dasharray="3 2.4"/>
    <rect x="-24" y="312" width="12" height="20" rx="6" fill="${C.cyan}" opacity=".55"/>
  </g>`;
  // 広場（噴水）
  s += `<g transform="translate(330 0)">
    <ellipse cx="0" cy="388" rx="78" ry="16" fill="${C.lemon2}" opacity=".7" stroke="#fff"/>
    <ellipse cx="0" cy="384" rx="22" ry="6" fill="#c9f4fb" stroke="#fff"/>
  </g>`;
  if (chNo >= 3) {
    // 鐘楼
    s += `<g transform="translate(392 0)">
      <rect x="-11" y="198" width="22" height="70" fill="#fff" stroke="${C.line}"/>
      <polygon points="-15,198 0,176 15,198" fill="${C.lemon}" stroke="#fff" stroke-width="1.5"/>
      <path d="M -6 214 Q 0 202 6 214 L 7 222 L -7 222 Z" fill="${C.lemonDeep}"/>
    </g>`;
    // 古い裁判所（柱）
    s += `<g transform="translate(262 0)">
      ${plate(-36, 232, 72, 34, '#ffffff', 0.97)}
      <polygon points="-40,232 0,214 40,232" fill="${C.lemon2}" stroke="#fff" stroke-width="1.5"/>
      ${[-26, -13, 0, 13, 26].map((x) => `<rect x="${x - 2.5}" y="238" width="5" height="26" fill="${C.shade}"/>`).join('')}
    </g>`;
    // 境界の橋（折れた欄干）
    s += `<g transform="translate(690 0)">
      <path d="M -60 246 Q -20 226 14 222" fill="none" stroke="#fff" stroke-width="6"/>
      <path d="M -60 246 Q -20 226 14 222" fill="none" stroke="${C.lemonDeep}" stroke-width="1.6" stroke-dasharray="4 4"/>
      <circle cx="-30" cy="236" r="5" fill="${C.cyan}" opacity=".7" stroke="#fff"/>
    </g>`;
  }
  return s;
}

// 浮く建物の断片
function fragments(seed) {
  const R = rng(seed);
  let s = '';
  for (let i = 0; i < 9; i++) {
    const [cx, cy] = CRACK[1 + Math.floor(R() * (CRACK.length - 2))];
    const x = cx + (R() - 0.5) * 80; const y = cy + 24 + R() * 60;
    const w = 10 + R() * 22; const h = 8 + R() * 16;
    const rot = (R() - 0.5) * 40;
    s += `<g class="float" style="animation-delay:${f(-R() * 6)}s"><g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})">
      <rect x="2" y="-2" width="${f(w)}" height="${f(h)}" fill="#fff" opacity=".4"/>
      <rect width="${f(w)}" height="${f(h)}" fill="${R() < 0.4 ? C.lemon2 : '#ffffff'}" fill-opacity=".85" stroke="#fff"/>
      ${R() < 0.5 ? `<rect x="${f(w * 0.3)}" y="${f(h * 0.3)}" width="${f(w * 0.25)}" height="${f(h * 0.4)}" fill="${C.cyan}" opacity=".5"/>` : ''}
    </g></g>`;
  }
  return s;
}

// 降ってくる空のかけら
function fallingShards(seed) {
  const R = rng(seed);
  let s = '';
  for (let i = 0; i < 10; i++) {
    const [cx, cy] = CRACK[1 + Math.floor(R() * (CRACK.length - 2))];
    const sz = 4 + R() * 7;
    s += `<g class="fall" style="animation-delay:${f(-R() * 8)}s;animation-duration:${f(6 + R() * 5)}s"><polygon transform="translate(${f(cx)} ${f(cy)})" points="0,${f(-sz)} ${f(sz * 0.7)},0 0,${f(sz)} ${f(-sz * 0.5)},${f(sz * 0.2)}" fill="url(#gShard)" stroke="#fff" stroke-width=".8"/></g>`;
  }
  return s;
}

// 記録係ユイの後ろ姿（顔は描かない）
function yui(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})" class="yui">
    <ellipse cx="0" cy="40" rx="20" ry="4" fill="${C.ink}" opacity=".15"/>
    <path d="M -13 38 L -10 6 Q 0 -2 10 6 L 13 38 Z" fill="${C.cyan}" stroke="#fff" stroke-width="1.5"/>
    <path d="M -10 6 Q 0 14 10 6" fill="none" stroke="#fff" stroke-width="3"/>
    <rect x="9" y="14" width="10" height="13" rx="1.5" fill="${C.lemon}" stroke="#fff" transform="rotate(12 14 20)"/>
    <circle cx="0" cy="-4" r="9.5" fill="${C.ink}"/>
    <circle cx="0" cy="-13" r="4.5" fill="${C.ink}"/>
    <rect x="-6" y="-8" width="12" height="2.4" rx="1.2" fill="${C.lemon}"/>
  </g>`;
}

// 手前の風見の柱
function foreVane() {
  return `<g transform="translate(46 0)">
    <rect x="-2" y="330" width="4" height="140" fill="#fff" stroke="${C.line}"/>
    <circle cx="0" cy="328" r="5" fill="${C.lemon}" stroke="#fff"/>
    <g class="vane2"><polygon points="-24,322 22,322 14,314 22,322 14,330" fill="${C.ink}" opacity=".85"/><polygon points="-24,322 -30,316 -30,328" fill="${C.lemonDeep}"/></g>
  </g>`;
}

export function buildBackground(chNo) {
  const other = chNo >= 2;
  return `${defs()}<g id="bg">${sky(other)}${fragments(chNo * 13 + 2)}${city(chNo >= 3 ? 41 : 7)}${landmarks(chNo)}${foreVane()}</g>`;
}

// 最後の見通し（試作の終わり）：裂け目の両側に二つの街、中央に未完成の橋
export function buildVista(view = {}) {
  const R = rng(5);
  let s = defs();
  s += `<rect width="${W}" height="${H}" fill="url(#gSky)"/><circle cx="400" cy="60" r="150" fill="url(#gSun)"/>`;
  // 中央の裂け目（向こうの空が見える）
  s += `<polygon points="350,0 450,0 470,460 330,460" fill="#ffffff" opacity=".6" filter="url(#fGlow)"/>`;
  s += `<polygon points="366,0 434,0 448,460 352,460" fill="url(#gOther)" stroke="#fff" stroke-width="2"/>`;
  s += `<polyline points="366,0 372,60 362,120 376,200 360,280 372,360 352,460" fill="none" stroke="#fff" stroke-width="2"/>`;
  s += `<polyline points="434,0 426,70 440,140 428,220 444,300 432,380 448,460" fill="none" stroke="#fff" stroke-width="2"/>`;
  // 両側の丘
  s += `<path d="M -10 300 Q 160 250 350 270 L 352 460 L -10 460 Z" fill="url(#gGround)" stroke="${C.line}"/>`;
  s += `<path d="M 448 270 Q 640 250 810 300 L 810 460 L 448 460 Z" fill="#fff6ea" stroke="#ffd9bf"/>`;
  for (const side of [0, 1]) {
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 7; i++) {
        const x = side ? 470 + i * 46 + R() * 12 : 0 + i * 46 + R() * 12; const base = 282 + row * 40 + R() * 6;
        const h = (22 + R() * 30) * (1 + row * 0.15); const w = (24 + R() * 14) * (1 + row * 0.1);
        if (R() < 0.15) continue;
        s += `<polygon points="${f(x + w)},${f(base - h)} ${f(x + w + 5)},${f(base - h - 4)} ${f(x + w + 5)},${f(base - 4)} ${f(x + w)},${f(base)}" fill="${side ? '#ffe2cf' : C.shade}"/>`;
        s += plate(x, base - h, w, h, side ? '#fffaf2' : '#ffffff', 0.97, 1.5);
        s += `<polygon points="${f(x - 2)},${f(base - h)} ${f(x + w / 2)},${f(base - h - 10)} ${f(x + w + 2)},${f(base - h)}" fill="${side ? C.peach : C.lemon}" stroke="#fff"/>`;
        s += `<rect x="${f(x + w * 0.35)}" y="${f(base - h * 0.6)}" width="${f(w * 0.25)}" height="${f(h * 0.3)}" rx="2" fill="${side ? '#f2a07b' : C.cyan}" opacity=".5"/>`;
      }
    }
  }
  // 未完成の細い橋（両端から伸びて、中央が切れている）
  s += `<path d="M 300 278 Q 350 252 388 246" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/>`;
  s += `<path d="M 500 278 Q 450 252 414 246" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/>`;
  s += `<path d="M 300 278 Q 350 252 388 246 M 500 278 Q 450 252 414 246" fill="none" stroke="${C.lemonDeep}" stroke-width="2.5" stroke-dasharray="6 5"/>`;
  s += `<line x1="388" y1="246" x2="414" y2="246" stroke="#fff" stroke-width="2" stroke-dasharray="3 4" opacity=".9"/>`;
  // 両側で待つ人々
  for (let i = 0; i < 4; i++) s += `<g transform="translate(${292 - i * 14} ${284 + i * 3}) scale(1.4)">${PERSON(0, 0, [C.cyan, C.rose, C.lemonDeep, C.cyanDeep][i])}</g>`;
  for (let i = 0; i < 4; i++) s += `<g transform="translate(${508 + i * 14} ${284 + i * 3}) scale(1.4)">${PERSON(0, 0, [C.peach, C.lemonDeep, C.rose, '#f2a07b'][i])}</g>`;
  s += `<g transform="translate(560 248) scale(1.4)"><line x1="0" y1="0" x2="0" y2="-26" stroke="${C.ink}" stroke-width="1.6"/><polygon points="0,-26 18,-21 0,-15" fill="${C.peach}" stroke="#fff"/></g>`;
  // 支持旗（こちら側）
  for (let i = 0; i < (view.support || 0); i++) s += `<g transform="translate(${230 - i * 60} 300) scale(1.6)">${FLAG(0, 0, i)}</g>`;
  s += fallingShards(8);
  s += yui(150, 392, 1.3);
  for (let i = 0; i < (view.coop || 0); i++) s += `<g transform="translate(${185 + i * 22} 372)"><circle cx="0" cy="-3" r="5" fill="none" stroke="${C.cyanDeep}" stroke-width="2.4"/><line x1="0" y1="2" x2="0" y2="13" stroke="${C.cyanDeep}" stroke-width="2.4"/></g>`;
  if (view.broken) s += `<g transform="translate(110 360)"><path d="M -20 0 Q -12 -10 -4 -2" fill="none" stroke="#e5484d" stroke-width="2.4"/><path d="M 4 2 Q 12 10 20 0" fill="none" stroke="#e5484d" stroke-width="2.4"/></g>`;
  return s;
}

const FLAG = (x, y, i) => `<g class="flag" style="animation-delay:${i * 0.15}s" transform="translate(${x} ${y})"><line x1="0" y1="0" x2="0" y2="-26" stroke="${C.ink}" stroke-width="1.6"/><polygon points="0,-26 18,-21 0,-15" fill="${C.lemon}" stroke="#fff"/></g>`;
const PERSON = (x, y, col) => `<g transform="translate(${x} ${y})"><circle cx="0" cy="-10" r="3" fill="${C.ink}"/><rect x="-3" y="-7" width="6" height="9" rx="2" fill="${col}"/></g>`;

// 調査地点・旗・鍵など、状態で変わる層
export function buildOverlay(view) {
  let s = '';
  if (view.falling) s += fallingShards(view.ch * 3 + 1);
  // 支持旗（広場の市民）
  for (let i = 0; i < view.support; i++) {
    const bx = 290 + i * 90;
    s += `<g transform="translate(${bx} 396) scale(1.6)">${FLAG(0, 0, i)}${PERSON(-12, 4, C.rose)}${PERSON(10, 5, C.cyan)}${PERSON(20, 2, C.lemonDeep)}${PERSON(-22, 3, C.cyanDeep)}</g>`;
  }
  // 調査地点
  for (const site of view.sites) {
    const cls = ['spot', site.visited ? 'done' : '', site.locked ? 'locked' : '', site.hint ? 'hint' : '', site.big ? 'big' : ''].join(' ');
    const k = view.k || 1;
    const fs = 13 * k;
    const lw = (site.name.length + (site.visited ? 1.2 : 0)) * fs + 16 * k;
    const lh = fs + 9 * k;
    const ly = site.y - (site.big ? 76 : 20 + lh * 0.7);
    const lx = Math.max(lw / 2 + (view.padX ?? 4), Math.min(800 - lw / 2 - (view.padX ?? 4), site.x));
    s += `<g class="${cls}" data-site="${site.id}" role="button" tabindex="${site.visited || site.locked ? -1 : 0}" aria-label="${site.name}を調べる${site.visited ? '（調査済み）' : ''}">`;
    if (site.big) {
      s += `<circle cx="${site.x}" cy="${site.y - 8}" r="62" fill="${C.lemon2}" opacity=".7" filter="url(#fGlow)" class="halo"/>`;
      s += `<circle cx="${site.x}" cy="${site.y - 8}" r="40" fill="#fff" opacity=".8" filter="url(#fGlow)" class="halo"/>`;
      s += `<g transform="translate(${site.x} ${site.y - 8}) scale(1.45)"><g class="bigShard"><polygon points="0,-34 22,-6 10,30 -18,22 -24,-10" fill="url(#gShard)" stroke="#fff" stroke-width="2.5"/><polygon points="0,-34 22,-6 2,0" fill="#fff" opacity=".6"/><line x1="-6" y1="14" x2="-6" y2="-14" stroke="${C.ink}" stroke-width="2"/><polygon points="-6,-20 -11,-11 -1,-11" fill="${C.ink}"/></g></g>`;
      s += `<circle cx="${site.x}" cy="${site.y - 8}" r="52" fill="transparent"/>`;
    } else {
      s += `<circle cx="${site.x}" cy="${site.y}" r="22" fill="transparent"/>`;
      s += `<circle cx="${site.x}" cy="${site.y}" r="13" class="ring" fill="#fff" fill-opacity=".35" stroke="#fff" stroke-width="2.5"/>`;
      s += `<circle cx="${site.x}" cy="${site.y}" r="6" class="dot" fill="${site.visited ? C.shade2 : C.lemon}" stroke="#fff" stroke-width="1.5"/>`;
    }
    s += `<g class="lbl"><rect x="${f(lx - lw / 2)}" y="${f(ly - lh / 2)}" width="${f(lw)}" height="${f(lh)}" rx="${f(lh / 2)}" fill="#ffffff" fill-opacity=".92" stroke="${site.hint ? C.lemonDeep : C.line}" stroke-width="${site.hint ? 2.5 : 1}"/><text x="${f(lx)}" y="${f(ly + fs * 0.36)}" text-anchor="middle" style="font-size:${f(fs)}px">${site.visited ? '✓ ' : ''}${site.name}</text></g>`;
    s += `</g>`;
  }
  // ユイ と 協力鍵
  s += yui(view.yuiX ?? 96, 392, 1.05 * Math.min(1.4, view.k || 1));
  for (let i = 0; i < view.coop; i++) {
    s += `<g class="keyfx" transform="translate(${(view.yuiX ?? 96) + 26 + i * 18} 372)"><circle r="7" fill="#fff" opacity=".7" filter="url(#fSoft)"/><circle cx="0" cy="-3" r="4" fill="none" stroke="${C.cyanDeep}" stroke-width="2"/><line x1="0" y1="1" x2="0" y2="10" stroke="${C.cyanDeep}" stroke-width="2"/><line x1="0" y1="7" x2="3" y2="7" stroke="${C.cyanDeep}" stroke-width="2"/></g>`;
  }
  if (view.broken) s += `<g transform="translate(${(view.yuiX ?? 96) - 34} 380)"><path d="M -16 0 Q -10 -9 -3 -2" fill="none" stroke="#e5484d" stroke-width="2.6"/><path d="M 3 2 Q 10 9 16 0" fill="none" stroke="#e5484d" stroke-width="2.6"/></g>`;
  if (view.stamp) s += `<g class="stampfx" transform="translate(150 360) rotate(-12)"><rect x="-26" y="-14" width="52" height="28" rx="4" fill="none" stroke="${C.cyanDeep}" stroke-width="2.5"/><text x="0" y="6" text-anchor="middle" fill="${C.cyanDeep}" font-size="15" font-weight="700">保留</text></g>`;
  return s;
}

// 証拠の絵（棚・拡大用）
export function evIcon(id) {
  const box = (inner) => `<svg viewBox="0 0 64 64" aria-hidden="true"><polygon points="8,6 54,4 60,40 46,60 6,52 2,20" fill="url(#iShard)" stroke="#fff" stroke-width="2"/><polygon points="8,6 54,4 30,24" fill="#fff" opacity=".45"/>${inner}<defs><linearGradient id="iShard" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#c7f4fb"/><stop offset="1" stop-color="#fff3a3"/></linearGradient></defs></svg>`;
  const ink = C.ink;
  switch (id) {
    case 'e1': return box(`<line x1="32" y1="48" x2="32" y2="18" stroke="${ink}" stroke-width="3"/><polygon points="32,10 24,22 40,22" fill="${ink}"/><circle cx="32" cy="48" r="4" fill="${C.lemonDeep}"/>`);
    case 'e2': return box(`<rect x="12" y="16" width="40" height="30" fill="#fff" stroke="${C.line}"/><polyline points="14,34 20,33 24,35 28,32 31,20 33,44 36,30 40,33 50,32" fill="none" stroke="${C.cyanDeep}" stroke-width="2"/><text x="14" y="25" font-size="6" fill="${ink}">6:12</text>`);
    case 'e3': return box(`<rect x="10" y="40" width="44" height="6" fill="${C.lemon}" stroke="#fff"/><path d="M 24 40 L 24 30 Q 26 18 40 16" fill="none" stroke="${ink}" stroke-width="3.5"/><polygon points="40,10 48,16 40,22" fill="${C.cyanDeep}"/>`);
    case 'e4': return box(`<circle cx="32" cy="32" r="16" fill="#fff" stroke="${C.cyanDeep}" stroke-width="2.5"/><line x1="32" y1="32" x2="43" y2="22" stroke="#e5484d" stroke-width="2.5"/><path d="M 20 40 A 14 14 0 0 1 22 22" fill="none" stroke="${C.lemonDeep}" stroke-width="3"/>`);
    case 'e9': return box(`<circle cx="18" cy="32" r="8" fill="none" stroke="${ink}" stroke-width="3"/><line x1="26" y1="32" x2="52" y2="32" stroke="${ink}" stroke-width="3"/><path d="M 36 32 L 36 40 Q 42 34 48 40 L 48 32" fill="none" stroke="${C.lemonDeep}" stroke-width="3"/>`);
    case 'e10': return box(`<path d="M 18 46 Q 18 16 32 14 Q 46 16 46 46 Z" fill="${C.lemon}" stroke="#fff" stroke-width="2"/><path d="M 24 40 L 24 34 Q 32 28 40 34 L 40 40" fill="none" stroke="${ink}" stroke-width="2.5"/><line x1="14" y1="48" x2="50" y2="48" stroke="${ink}" stroke-width="2.5"/>`);
    case 'e11': return box(`<rect x="14" y="12" width="36" height="40" fill="#fffdf2" stroke="${C.line}"/><line x1="20" y1="22" x2="44" y2="22" stroke="${C.line}" stroke-width="2"/><line x1="20" y1="28" x2="44" y2="28" stroke="${C.line}" stroke-width="2"/><circle cx="24" cy="42" r="5" fill="${C.cyan}"/><circle cx="40" cy="42" r="5" fill="${C.peach}" stroke="${C.lemonDeep}"/>`);
    case 'e12': return box(`<path d="M 6 44 L 26 44" stroke="#fff" stroke-width="5"/><path d="M 38 44 L 58 44" stroke="#fff" stroke-width="5"/><circle cx="16" cy="32" r="7" fill="none" stroke="${ink}" stroke-width="2.5"/><path d="M 12 32 L 16 27 L 20 32 L 16 37 Z" fill="${C.lemonDeep}"/><circle cx="48" cy="32" r="7" fill="none" stroke="${ink}" stroke-width="2.5"/><path d="M 44 32 L 48 27 L 52 32 L 48 37 Z" fill="${C.lemonDeep}"/>`);
    default: return box('');
  }
}

export const VIEW = { W, H };
