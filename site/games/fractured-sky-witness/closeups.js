// 調べた場所の寄りの絵と、審理の法廷（SVG）。主役の物は左〜中央に置き、右側は話す人物の立ち絵の場所にする。
import { C, defs, plate, f, rng } from './scene.js';

const W = 800; const H = 460;
const sky = (top = C.sky0, mid = C.sky1, bot = C.sky2) => `<linearGradient id="gcs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset=".6" stop-color="${mid}"/><stop offset="1" stop-color="${bot}"/></linearGradient>`;
const glow = (x, y, r, col = '#fff') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" opacity=".7" filter="url(#fGlow)"/>`;
// 窓の外に見える裂け目
const crackStrip = (x, y, w, h) => `<polygon points="${x},${y + h * 0.7} ${x + w * 0.3},${y + h * 0.45} ${x + w * 0.55},${y + h * 0.5} ${x + w},${y + h * 0.15} ${x + w},${y + h * 0.32} ${x + w * 0.58},${y + h * 0.68} ${x + w * 0.32},${y + h * 0.62} ${x},${y + h * 0.88}" fill="url(#gCrack)" stroke="#fff" stroke-width="2"/>`;
const floor = (y, col = '#eafafd', line = C.line) => `<rect x="0" y="${y}" width="${W}" height="${H - y}" fill="${col}"/>${Array.from({ length: 9 }, (_, i) => `<line x1="${i * 100 - 40}" y1="${H}" x2="${400 + (i - 4) * 40}" y2="${y}" stroke="${line}" stroke-width="1" opacity=".6"/>`).join('')}<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#fff" stroke-width="2"/>`;
const dust = (seed, n = 14) => { const R = rng(seed); let s = ''; for (let i = 0; i < n; i++) s += `<circle class="float" style="animation-delay:${f(-R() * 6)}s" cx="${f(R() * W)}" cy="${f(40 + R() * 300)}" r="${f(1.5 + R() * 2.5)}" fill="#fff" opacity=".8"/>`; return s; };
const label = (x, y, t) => `<g><rect x="${x - t.length * 8 - 12}" y="${y - 16}" width="${t.length * 16 + 24}" height="30" rx="15" fill="#fff" fill-opacity=".92" stroke="${C.lemonDeep}" stroke-width="2"/><text x="${x}" y="${y + 5}" text-anchor="middle" style="font-size:16px;font-weight:700" fill="${C.ink}">${t}</text></g>`;

const SCENES = {
  // 広場の空片：石畳に落ちた大きなかけら。中に真上を向いた風見
  plaza() {
    let s = `<rect width="${W}" height="${H}" fill="url(#gcs)"/>`;
    s += `<polygon points="0,90 120,60 260,96 420,58 560,100 800,70 800,0 0,0" fill="url(#gCrack)" opacity=".9"/>`;
    for (let i = 0; i < 8; i++) s += plate(i * 100 - 10, 140 + (i % 3) * 8, 80, 120, '#fff', 0.95) + `<polygon points="${i * 100 - 14},${140 + (i % 3) * 8} ${i * 100 + 30},${116 + (i % 3) * 8} ${i * 100 + 74},${140 + (i % 3) * 8}" fill="${C.lemon}" stroke="#fff"/>`;
    s += floor(250, '#fffbe6', '#f4e3a0');
    s += `<ellipse cx="270" cy="372" rx="190" ry="40" fill="${C.lemon2}" opacity=".7"/>`;
    s += glow(270, 300, 120, C.lemon2) + glow(270, 300, 70);
    s += `<g transform="translate(270 300)"><polygon points="0,-120 92,-30 54,96 -70,86 -100,-34" fill="url(#gShard)" stroke="#fff" stroke-width="4"/><polygon points="0,-120 92,-30 10,-6" fill="#fff" opacity=".55"/><polygon points="-100,-34 -70,86 -30,10" fill="${C.cyan}" opacity=".18"/>
      <line x1="-6" y1="60" x2="-6" y2="-60" stroke="${C.ink}" stroke-width="7"/><polygon points="-6,-88 -26,-52 14,-52" fill="${C.ink}"/><polygon points="-6,56 -26,76 14,76" fill="${C.lemonDeep}"/><circle cx="-6" cy="60" r="9" fill="${C.lemonDeep}" stroke="#fff" stroke-width="2"/></g>`;
    s += `<g fill="#fff" opacity=".9">${[[90, 410], [430, 420], [470, 380], [130, 360]].map(([x, y]) => `<polygon points="${x},${y - 10} ${x + 12},${y} ${x},${y + 8} ${x - 9},${y}" fill="url(#gShard)" stroke="#fff"/>`).join('')}</g>`;
    s += label(270, 150, '真上を向いた風見');
    return s;
  },
  // 観測塔：大きな窓に裂け目、机の上に記録紙と針
  tower() {
    let s = `<rect width="${W}" height="${H}" fill="#e9fbff"/>`;
    s += `<rect x="40" y="30" width="420" height="250" rx="120" fill="url(#gcs)" stroke="#fff" stroke-width="10"/>`;
    s += `<clipPath id="cpw"><rect x="40" y="30" width="420" height="250" rx="120"/></clipPath><g clip-path="url(#cpw)">${crackStrip(40, 30, 420, 250)}</g>`;
    s += `<line x1="250" y1="30" x2="250" y2="280" stroke="#fff" stroke-width="8"/><line x1="40" y1="160" x2="460" y2="160" stroke="#fff" stroke-width="8"/>`;
    s += floor(330);
    s += plate(60, 290, 440, 26, C.lemon2, 1) + `<rect x="80" y="316" width="16" height="120" fill="${C.shade2}"/><rect x="464" y="316" width="16" height="120" fill="${C.shade2}"/>`;
    // 記録紙
    s += `<g transform="translate(110 236) rotate(-4)">${plate(0, 0, 300, 70, '#fff', 1)}<polyline points="10,40 40,38 70,42 100,36 130,40 150,8 160,66 172,20 186,44 220,40 290,41" fill="none" stroke="${C.cyanDeep}" stroke-width="3"/><text x="140" y="-6" style="font-size:15px;font-weight:700" fill="#e5484d">6:12</text><text x="200" y="62" style="font-size:12px" fill="${C.ink}">公表しない　ネム</text></g>`;
    // 記録計
    s += `<g transform="translate(560 200)">${plate(-60, 0, 120, 90, '#fff', 1)}<circle cx="0" cy="45" r="30" fill="#e9fbff" stroke="${C.cyanDeep}" stroke-width="3"/><line x1="0" y1="45" x2="24" y2="22" stroke="#e5484d" stroke-width="3"/></g>`;
    s += dust(3);
    s += label(260, 222, '逆風を記録した紙');
    return s;
  },
  // レモン色の屋根：めくれた金具と、すぐ上の裂け目
  roof() {
    let s = `<rect width="${W}" height="${H}" fill="url(#gcs)"/>`;
    s += `<polygon points="0,40 200,10 360,70 560,30 800,90 800,180 560,110 360,150 200,90 0,120" fill="url(#gCrack)" stroke="#fff" stroke-width="3"/>`;
    s += `<polygon points="0,40 200,10 360,70 560,30 800,90 800,120 560,70 360,110 200,50 0,80" fill="${C.lemon2}" opacity=".6"/>`;
    // 屋根
    for (let r = 0; r < 6; r++) for (let c = 0; c < 10; c++) {
      const x = c * 90 - (r % 2) * 45 - 20; const y = 230 + r * 40;
      s += `<path d="M ${x} ${y} q 45 -26 90 0 v 30 q -45 -26 -90 0 Z" fill="${r % 2 ? C.lemon : '#ffe873'}" stroke="#fff" stroke-width="2"/>`;
    }
    // めくれた金具
    for (const [x, k] of [[170, 1], [330, 0.85]]) {
      s += `<g transform="translate(${x} 250) scale(${k})"><rect x="-40" y="-6" width="80" height="12" rx="3" fill="${C.ink}" opacity=".85"/><path d="M -10 -4 L -10 -50 Q -6 -96 40 -110" fill="none" stroke="${C.ink}" stroke-width="12" stroke-linecap="round"/><path d="M -10 -4 L -10 -50 Q -6 -96 40 -110" fill="none" stroke="#9fdbe7" stroke-width="4" stroke-linecap="round"/><polygon points="44,-128 66,-104 36,-96" fill="${C.cyanDeep}"/></g>`;
    }
    s += label(250, 205, '外へめくれた金具');
    return s;
  },
  // 修復工房：大きな気圧計、壁の工具、子ども用の工具箱
  atelier() {
    let s = `<rect width="${W}" height="${H}" fill="#fff8ec"/>`;
    s += `<rect x="0" y="0" width="${W}" height="250" fill="#fdf2e0"/>`;
    for (let i = 0; i < 9; i++) s += `<rect x="${30 + i * 52}" y="40" width="10" height="${50 + (i % 3) * 20}" rx="4" fill="${[C.cyanDeep, C.ink, C.lemonDeep][i % 3]}" opacity=".7"/>`;
    s += `<circle cx="520" cy="80" r="36" fill="none" stroke="${C.cyanDeep}" stroke-width="10" stroke-dasharray="12 8"/><circle cx="590" cy="130" r="22" fill="none" stroke="${C.lemonDeep}" stroke-width="8" stroke-dasharray="8 6"/>`;
    s += floor(330, '#f6efe2', '#e8d6b8');
    s += plate(30, 280, 520, 30, '#ffe0c8', 1) + `<rect x="60" y="310" width="18" height="130" fill="#e8c7a8"/><rect x="500" y="310" width="18" height="130" fill="#e8c7a8"/>`;
    // 気圧計
    s += glow(250, 200, 90, '#ffd6d6');
    s += `<g transform="translate(250 196)"><circle r="88" fill="#fff" stroke="${C.cyanDeep}" stroke-width="8"/><circle r="74" fill="none" stroke="${C.line}" stroke-width="2"/>${Array.from({ length: 11 }, (_, i) => { const a = (-210 + i * 24) * Math.PI / 180; return `<line x1="${f(Math.cos(a) * 62)}" y1="${f(Math.sin(a) * 62)}" x2="${f(Math.cos(a) * 72)}" y2="${f(Math.sin(a) * 72)}" stroke="${i > 8 ? '#e5484d' : C.ink}" stroke-width="3"/>`; }).join('')}<path d="M -60 30 A 64 64 0 0 1 -44 -46" fill="none" stroke="${C.lemonDeep}" stroke-width="6"/><path d="M 44 -46 A 64 64 0 0 1 62 14" fill="none" stroke="#e5484d" stroke-width="8"/><line x1="0" y1="0" x2="54" y2="-30" stroke="#e5484d" stroke-width="6" stroke-linecap="round"/><circle r="9" fill="${C.ink}"/><text y="44" text-anchor="middle" style="font-size:14px;font-weight:700" fill="${C.ink}">街の内側</text></g>`;
    // 子ども用の工具箱
    s += `<g transform="translate(420 250)">${plate(0, 0, 90, 34, C.cyan, 1)}<rect x="30" y="-12" width="30" height="12" rx="6" fill="none" stroke="${C.cyanDeep}" stroke-width="4"/><text x="45" y="23" text-anchor="middle" style="font-size:12px;font-weight:700" fill="#fff">カイ</text></g>`;
    s += label(250, 82, '内側の気圧が急上昇');
    return s;
  },
  // 弟の作業机：設計図と、橋の歯をもつ透明な鍵
  desk() {
    let s = `<rect width="${W}" height="${H}" fill="#fff8ec"/>`;
    s += `<rect x="0" y="0" width="${W}" height="200" fill="#fdf2e0"/><rect x="60" y="20" width="170" height="130" rx="10" fill="url(#gcs)" stroke="#fff" stroke-width="8"/>${crackStrip(60, 20, 170, 130)}`;
    s += `<rect x="0" y="200" width="${W}" height="260" fill="#f0d9bd"/><line x1="0" y1="200" x2="${W}" y2="200" stroke="#fff" stroke-width="3"/>`;
    // 設計図
    s += `<g transform="translate(70 230) rotate(-6)">${plate(0, 0, 330, 190, '#d6f3fa', 1)}${Array.from({ length: 7 }, (_, i) => `<line x1="0" y1="${i * 28}" x2="330" y2="${i * 28}" stroke="#fff" stroke-width="1"/>`).join('')}<path d="M 30 140 Q 165 40 300 140" fill="none" stroke="${C.cyanDeep}" stroke-width="4"/>${[70, 120, 165, 210, 260].map((x) => `<line x1="${x}" y1="${x < 165 ? 140 - (x - 30) * 0.7 : 140 - (300 - x) * 0.7}" x2="${x}" y2="140" stroke="${C.cyanDeep}" stroke-width="2"/>`).join('')}<text x="20" y="24" style="font-size:14px;font-weight:700" fill="${C.cyanDeep}">はしのかぎ　カイ</text></g>`;
    // 鍵
    s += glow(470, 340, 110, C.lemon2);
    s += `<g transform="translate(480 340) rotate(-14)"><g stroke="${C.cyanDeep}" stroke-width="9" fill="none" opacity=".9"><circle cx="-110" cy="0" r="40"/><rect x="-72" y="-12" width="190" height="24" rx="8"/><path d="M 40 12 L 40 44 Q 70 22 100 44 L 100 12"/></g><circle cx="-110" cy="0" r="40" fill="url(#gShard)" stroke="#fff" stroke-width="4"/><circle cx="-110" cy="0" r="18" fill="#f0d9bd" stroke="#fff" stroke-width="3"/><rect x="-72" y="-12" width="190" height="24" rx="8" fill="url(#gShard)" stroke="#fff" stroke-width="4"/><path d="M 40 12 L 40 44 Q 70 22 100 44 L 100 12" fill="url(#gShard)" stroke="#fff" stroke-width="4"/><path d="M 50 26 L 90 26" stroke="${C.lemonDeep}" stroke-width="3"/></g>`;
    s += `<g transform="translate(560 200)"><rect x="-6" y="-60" width="12" height="60" fill="${C.ink}"/><path d="M -40 -60 L 40 -60 L 22 -100 L -22 -100 Z" fill="${C.lemon}" stroke="#fff" stroke-width="3"/>${glow(0, -40, 50, C.lemon2)}</g>`;
    s += label(470, 250, '刃のない、橋の形の鍵');
    return s;
  },
  // 鐘楼：下から見上げた大きな鐘と、内側の溝
  belfry() {
    let s = `<rect width="${W}" height="${H}" fill="url(#gcs)"/>`;
    s += `<rect x="0" y="0" width="70" height="${H}" fill="#fff"/><rect x="560" y="0" width="${W - 560}" height="${H}" fill="#fff" opacity=".0"/>`;
    s += `<path d="M 70 0 L 70 ${H} M 560 0 L 560 ${H}" stroke="${C.line}" stroke-width="3"/>`;
    s += `<rect x="70" y="0" width="490" height="40" fill="#fff" stroke="${C.line}"/>`;
    s += `<line x1="315" y1="40" x2="315" y2="80" stroke="${C.ink}" stroke-width="10"/>`;
    s += glow(315, 230, 160, C.lemon2);
    s += `<path d="M 165 330 Q 165 90 315 76 Q 465 90 465 330 Z" fill="${C.lemon}" stroke="#fff" stroke-width="5"/><path d="M 195 320 Q 195 120 315 106 Q 435 120 435 320 Z" fill="${C.lemonDeep}" opacity=".35"/>`;
    s += `<rect x="150" y="320" width="330" height="22" rx="10" fill="${C.lemonDeep}" stroke="#fff" stroke-width="4"/>`;
    s += `<path d="M 240 300 L 240 250 Q 270 226 300 250 L 300 220 Q 315 200 330 220 L 330 250 Q 360 226 390 250 L 390 300" fill="none" stroke="${C.ink}" stroke-width="7" stroke-linejoin="round"/>`;
    s += `<path d="M 240 300 L 240 250 Q 270 226 300 250 L 300 220 Q 315 200 330 220 L 330 250 Q 360 226 390 250 L 390 300" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`;
    s += `<line x1="315" y1="342" x2="315" y2="420" stroke="#c99" stroke-width="5"/><circle cx="315" cy="426" r="12" fill="${C.ink}"/>`;
    s += `${[[150, 440], [190, 452], [430, 445], [470, 455]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="9" ry="5" fill="${C.ink}" opacity=".35"/>`).join('')}`;
    s += label(315, 180, '鍵の歯と同じ形の溝');
    return s;
  },
  // 古い裁判所の書庫：棚と、二つの署名のある協定書
  court() {
    let s = `<rect width="${W}" height="${H}" fill="#f3f7f8"/>`;
    for (let c = 0; c < 6; c++) {
      s += `<rect x="${c * 140 - 20}" y="20" width="120" height="300" fill="#fff" stroke="${C.line}" stroke-width="2"/>`;
      for (let r = 0; r < 5; r++) {
        s += `<line x1="${c * 140 - 20}" y1="${80 + r * 56}" x2="${c * 140 + 100}" y2="${80 + r * 56}" stroke="${C.line}" stroke-width="3"/>`;
        for (let b = 0; b < 6; b++) s += `<rect x="${c * 140 - 14 + b * 18}" y="${44 + r * 56}" width="14" height="${30 + ((b + r) % 3) * 4}" fill="${[C.shade2, C.lemon2, '#d9cffb', C.peach][(b + r + c) % 4]}"/>`;
      }
    }
    s += `<polygon points="560,0 640,0 420,460 300,460" fill="#fff" opacity=".45"/>`;
    s += floor(330, '#eef3f4');
    s += `<g transform="translate(270 300) rotate(-4)">${plate(-200, -90, 400, 170, '#fffdf2', 1)}<text x="0" y="-52" text-anchor="middle" style="font-size:19px;font-weight:800" fill="${C.ink}">避難協定</text><text x="0" y="-22" text-anchor="middle" style="font-size:14px" fill="${C.ink}">二つの街は、互いの避難民を受け入れる</text>${Array.from({ length: 2 }, (_, i) => `<line x1="-160" y1="${4 + i * 16}" x2="160" y2="${4 + i * 16}" stroke="${C.line}" stroke-width="2"/>`).join('')}<circle cx="-90" cy="52" r="20" fill="${C.cyan}" stroke="#fff" stroke-width="3"/><circle cx="90" cy="52" r="20" fill="${C.peach}" stroke="${C.lemonDeep}" stroke-width="3"/><text x="-90" y="58" text-anchor="middle" style="font-size:14px;font-weight:700" fill="#fff">此</text><text x="90" y="58" text-anchor="middle" style="font-size:14px;font-weight:700" fill="${C.ink}">彼</text></g>`;
    s += dust(9, 22);
    return s;
  },
  // 境界の橋：裂け目の縁で折れた欄干。両側に同じ紋章
  bridge() {
    let s = `<rect width="${W}" height="${H}" fill="url(#gcs)"/>`;
    s += `<polygon points="330,0 470,0 520,${H} 280,${H}" fill="url(#gOther)" stroke="#fff" stroke-width="3"/>`;
    s += `<polygon points="330,0 470,0 520,${H} 280,${H}" fill="#fff" opacity=".25" filter="url(#fGlow)"/>`;
    s += `<path d="M 0 300 L 300 270 L 300 ${H} L 0 ${H} Z" fill="url(#gGround)" stroke="${C.line}" stroke-width="2"/>`;
    s += `<path d="M 500 270 L ${W} 300 L ${W} ${H} L 500 ${H} Z" fill="#fff6ea" stroke="#ffd9bf" stroke-width="2"/>`;
    for (const [x0, x1, col] of [[0, 300, '#fff'], [500, 800, '#fff9ef']]) {
      s += `<rect x="${x0}" y="200" width="${x1 - x0}" height="16" fill="${col}" stroke="${C.line}" stroke-width="2"/>`;
      for (let x = x0 + 20; x < x1; x += 46) s += `<rect x="${x}" y="216" width="10" height="60" fill="${col}" stroke="${C.line}" stroke-width="1.5"/>`;
    }
    s += `<polygon points="300,200 316,196 308,214 300,216" fill="#fff" stroke="${C.line}"/><polygon points="500,200 486,205 494,216 500,216" fill="#fff9ef" stroke="${C.line}"/>`;
    const emb = (x, col) => `<g transform="translate(${x} 150)">${glow(0, 0, 50, C.lemon2)}<circle r="40" fill="${col}" stroke="${C.ink}" stroke-width="5"/><path d="M -22 0 L 0 -26 L 22 0 L 0 26 Z" fill="${C.lemonDeep}" stroke="#fff" stroke-width="3"/><path d="M -30 12 Q 0 -6 30 12" fill="none" stroke="${C.ink}" stroke-width="3"/></g>`;
    s += emb(200, '#fff') + emb(610, '#fff9ef');
    s += `<path d="M 245 150 Q 405 90 565 150" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="8 8" class="linkfx"/>`;
    s += label(405, 70, '両側に同じ紋章');
    return s;
  },
};

// 審理の法廷：高い窓から裂け目が見える。中央右に証言台、左手前に記録係の机
export function buildCourt(chNo) {
  let s = defs() + `<defs>${sky()}</defs>`;
  s += `<rect width="${W}" height="${H}" fill="#f4fbfc"/>`;
  for (const x of [80, 330, 580]) {
    s += `<g><rect x="${x}" y="30" width="150" height="230" rx="75" fill="url(#gcs)" stroke="#fff" stroke-width="8"/><clipPath id="cw${x}"><rect x="${x}" y="30" width="150" height="230" rx="75"/></clipPath><g clip-path="url(#cw${x})">${crackStrip(x - 60, 40, 280, 200)}${chNo >= 3 ? `<rect x="${x}" y="150" width="150" height="20" fill="${C.peach}" opacity=".5"/>` : ''}</g><line x1="${x + 75}" y1="30" x2="${x + 75}" y2="260" stroke="#fff" stroke-width="6"/></g>`;
  }
  for (const x of [40, 270, 520, 760]) s += `<rect x="${x - 14}" y="20" width="28" height="320" fill="#fff" stroke="${C.line}" stroke-width="2"/><rect x="${x - 20}" y="12" width="40" height="14" fill="${C.lemon2}" stroke="#fff"/>`;
  s += `<polygon points="360,0 440,0 470,340 330,340" fill="#fff" opacity=".35"/>`;
  s += `<rect x="0" y="330" width="${W}" height="130" fill="#e3f6f9"/><line x1="0" y1="330" x2="${W}" y2="330" stroke="#fff" stroke-width="3"/>`;
  // 吊り旗
  for (const x of [190, 430]) s += `<path d="M ${x} 0 L ${x + 50} 0 L ${x + 50} 90 L ${x + 25} 74 L ${x} 90 Z" fill="${C.lemon}" stroke="#fff" stroke-width="3"/><circle cx="${x + 25}" cy="40" r="12" fill="none" stroke="${C.ink}" stroke-width="3"/>`;
  return s;
}

// 証言台（人物の前に重ねる）と、記録係の机
export function courtFront() {
  return `<g>${plate(500, 380, 220, 90, '#ffffff', 0.97, 6)}<rect x="500" y="380" width="220" height="12" fill="${C.lemon}"/><text x="610" y="430" text-anchor="middle" style="font-size:15px;font-weight:700" fill="${C.ink}">証言台</text></g>
    <g>${plate(-20, 400, 300, 70, '#ffffff', 0.97, 6)}<rect x="-20" y="400" width="300" height="10" fill="${C.cyan}"/></g>`;
}

export function buildSite(id) {
  const fn = SCENES[id];
  return defs() + `<defs>${sky()}</defs>` + (fn ? fn() : '');
}
