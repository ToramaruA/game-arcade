// Canvas の絵。生物・海・ソナー・写真カードをパスと重ね描きだけで描く（外部素材なし）。
// 窓の座標は SW×SH 固定。写真・見本・カードも同じ関数を拡大縮小して使う。
export const SW = 600;
export const SH = 440;
const TAU = Math.PI * 2;

const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const mod = (a, n) => ((a % n) + n) % n;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
// 遠・中・近の3値を連続距離 d(0〜2) で補間する
const l3 = (arr, d) => {
  const i = Math.min(1, Math.floor(d));
  return arr[i] + (arr[i + 1] - arr[i]) * (d - i);
};

let layer = null;
function getLayer() {
  if (!layer) { layer = document.createElement('canvas'); layer.width = SW; layer.height = SH; }
  return layer;
}

function centerOf(species, target, d) {
  if (species === 'A') return target === '発光器官' ? [l3([.55, .5, .45], d), l3([.38, .5, .55], d)] : [l3([.58, .5, .5], d), l3([.36, .5, .6], d)];
  if (species === 'B') return [.5, target === '殻の模様' ? l3([.38, .42, .55], d) : l3([.36, .4, .5], d)];
  if (species === 'D') return [l3([.56, .5, .5], d), l3([.42, .48, .5], d)];
  if (species === 'F') return [.5, l3([.42, .5, .5], d)];
  if (species === 'E') return [l3([.66, .86, .62], d), l3([.5, .5, .55], d)];
  if (species === 'G') return [.5, l3([.45, .5, .5], d)];
  return [l3([.66, .55, .5], d), .5];
}

function drawSea(c, o) {
  const f = clamp01(o.depth / 3800);
  const g = c.createLinearGradient(0, 0, 0, SH);
  const mix = (a, b) => Math.round(a + (b - a) * f);
  g.addColorStop(0, `rgb(${mix(10, 4)},${mix(52, 14)},${mix(78, 26)})`);
  g.addColorStop(1, `rgb(${mix(4, 3)},${mix(22, 9)},${mix(36, 18)})`);
  c.fillStyle = g; c.fillRect(0, 0, SW, SH);
  // 遠景の岩壁
  c.fillStyle = 'rgba(2,9,16,.78)';
  for (const side of [0, 1]) {
    c.beginPath();
    const x0 = side ? SW : 0; const dir = side ? -1 : 1;
    c.moveTo(x0, SH * .15);
    for (let i = 0; i <= 8; i++) c.lineTo(x0 + dir * (SW * (.1 + rnd(i + side * 9) * .1) + (i % 2) * 14), SH * (.15 + i * .11));
    c.lineTo(x0, SH); c.closePath(); c.fill();
  }
  c.fillStyle = 'rgba(40,110,140,.07)';
  c.fillRect(0, SH * .5, SW, SH * .2);
}

function drawParticles(c, o, layers) {
  const sp = [3, 7, 14]; const n = [34, 22, 12]; const sz = [1.4, 2.2, 3.4]; const al = [.28, .4, .55];
  for (const l of layers) {
    c.fillStyle = `rgba(170,235,245,${al[l]})`;
    for (let i = 0; i < n[l]; i++) {
      const x = mod(rnd(i + l * 100) * SW + o.t * sp[l] * (1 - o.still) + Math.sin(o.t + i) * 4 * (1 - o.still), SW);
      const y = mod(rnd(i + l * 100 + 50) * SH - o.t * sp[l] * .6 * (1 - o.still), SH);
      c.fillRect(Math.round(x), Math.round(y), sz[l], sz[l]);
    }
  }
}

function drawBeam(c, o, d) {
  const [tx, ty] = centerOf(o.species, o.target, d);
  const a = .07 + o.light * .3;
  const lx = SW * .5; const ly = SH * 1.04;
  const g = c.createLinearGradient(lx, ly, tx * SW, ty * SH);
  g.addColorStop(0, `rgba(200,244,255,${a})`);
  g.addColorStop(1, `rgba(200,244,255,${a * .25})`);
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(lx - 22, ly); c.lineTo(lx + 22, ly);
  c.lineTo(tx * SW + SW * .2, ty * SH - SH * .1); c.lineTo(tx * SW - SW * .2, ty * SH - SH * .1);
  c.closePath(); c.fill();
}

function drawRibbon(c, o, d) {
  const organ = o.target === '発光器官';
  const k = l3(organ ? [.85, 1.15, 3.0] : [.82, 1.0, 2.4], d);
  const [fx, fy] = centerOf('A', o.target, d);
  const cx = fx * SW; const cy = fy * SH;
  const a = -0.32; const ca = Math.cos(a); const sa = Math.sin(a);
  const len = SW * 1.05 * k; const amp = SH * .07 * k * (1 - o.still * .6);
  const N = 26; const pts = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const w = SH * .085 * k * (.3 + .7 * Math.pow(Math.sin(Math.PI * (.06 + .88 * u)), .6));
    pts.push({ x: cx + (u - .5) * len * ca, y: cy + (u - .5) * len * sa + Math.sin(u * 6.5 - o.t * 1.6 * (1 - o.still * .9)) * amp, w });
  }
  const nrm = pts.map((p, i) => {
    const q = pts[Math.min(N, i + 1)]; const r = pts[Math.max(0, i - 1)];
    const tx = q.x - r.x; const ty = q.y - r.y; const l = Math.hypot(tx, ty) || 1;
    return { nx: -ty / l, ny: tx / l, tx: tx / l, ty: ty / l };
  });
  // ひれ
  c.fillStyle = 'rgba(130,205,230,.3)';
  for (let i = 1; i < N; i += 2) {
    const p = pts[i]; const n = nrm[i];
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(p.x + s * n.nx * p.w * 1.9 - n.tx * p.w * .9, p.y + s * n.ny * p.w * 1.9 - n.ty * p.w * .9);
      c.lineTo(p.x + n.tx * p.w * 1.2 + s * n.nx * p.w * .7, p.y + n.ty * p.w * 1.2 + s * n.ny * p.w * .7);
      c.closePath(); c.fill();
    }
  }
  // 体節
  c.lineJoin = 'round';
  for (let i = 0; i < N; i++) {
    const p = pts[i]; const q = pts[i + 1]; const n = nrm[i]; const m = nrm[i + 1];
    c.fillStyle = `hsl(${196 + i * .9},55%,${27 + (i % 2) * 5}%)`;
    c.strokeStyle = '#06202e'; c.lineWidth = Math.max(1.5, 2.2 * Math.min(k, 2));
    c.beginPath();
    c.moveTo(p.x + n.nx * p.w, p.y + n.ny * p.w); c.lineTo(q.x + m.nx * q.w, q.y + m.ny * q.w);
    c.lineTo(q.x - m.nx * q.w, q.y - m.ny * q.w); c.lineTo(p.x - n.nx * p.w, p.y - n.ny * p.w);
    c.closePath(); c.fill(); c.stroke();
    if (o.detail) { // 背の薄い筋
      c.strokeStyle = 'rgba(160,225,240,.28)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(p.x + n.nx * p.w * .55, p.y + n.ny * p.w * .55); c.lineTo(q.x + m.nx * q.w * .55, q.y + m.ny * q.w * .55); c.stroke();
    }
  }
  // 発光点（節ごと）
  for (let i = 1; i < N; i++) {
    const p = pts[i];
    const r = Math.max(3, p.w * (o.detail ? (organ ? .3 : .24) : .16));
    {
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * (o.detail ? 3 : 5));
      g.addColorStop(0, o.detail ? 'rgba(92,221,231,.75)' : 'rgba(92,221,231,.55)'); g.addColorStop(1, 'rgba(92,221,231,0)');
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r * (o.detail ? 3 : 5), 0, TAU); c.fill();
    }
    c.fillStyle = '#5CDDE7'; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
    if (o.detail && organ) { c.fillStyle = '#e8ffff'; c.beginPath(); c.arc(p.x - r * .25, p.y - r * .25, r * .35, 0, TAU); c.fill(); }
  }
  // 頭
  const h = pts[N];
  c.fillStyle = '#0f3a4c'; c.strokeStyle = '#06202e'; c.lineWidth = 2.5;
  c.beginPath(); c.ellipse(h.x, h.y, h.w * 2.4 + 6, h.w * 1.6 + 5, a, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#F2B84B'; c.beginPath(); c.arc(h.x + h.w * .5, h.y - h.w * .3, Math.max(2, h.w * .45), 0, TAU); c.fill();
}

function drawJelly(c, o, d) {
  const shell = o.target === '殻の模様';
  const k = l3(shell ? [.5, 1.1, 2.3] : [.5, 1.0, 2.1], d);
  const [fx, fy] = centerOf('B', o.target, d);
  const cx = fx * SW; const R = SH * .3 * k;
  const bob = Math.sin(o.t * 1.4) * SH * .015 * (1 - o.still);
  const cy = fy * SH + bob;
  const sw = Math.max(2, 3.2 * Math.pow(k, .6));
  // 触腕
  const n = 9;
  c.lineCap = 'round';
  for (let j = 0; j < n; j++) {
    const f = j / (n - 1);
    const x0 = cx - R * .88 + f * R * 1.76; const y0 = cy + R * .08;
    c.strokeStyle = 'rgba(150,215,232,.6)'; c.lineWidth = sw;
    c.beginPath(); c.moveTo(x0, y0);
    let ex; let ey;
    if (!shell) { // 捕食姿勢：触腕が外へ広がり、先端が輪になる
      const ang = Math.PI * (.08 + .84 * f);
      ex = cx + Math.cos(ang) * R * 2.0; ey = cy + R * .45 + Math.sin(ang) * R * 1.35;
      c.quadraticCurveTo((x0 + ex) / 2 + Math.sin(o.t * 2 + j) * 8 * (1 - o.still), y0 + R * .5, ex, ey);
    } else {
      ex = x0 + Math.sin(o.t * 1.6 + j) * R * .12 * (1 - o.still); ey = y0 + R * 1.5;
      c.bezierCurveTo(x0 - R * .15, y0 + R * .5, ex + R * .18, y0 + R * 1.0, ex, ey);
    }
    c.stroke();
    c.fillStyle = '#5CDDE7'; c.beginPath(); c.arc(ex, ey, sw * 1.1, 0, TAU); c.fill();
  }
  if (!shell) {
    c.setLineDash([sw * 1.6, sw * 2]); c.strokeStyle = 'rgba(92,221,231,.5)'; c.lineWidth = sw * .6;
    c.beginPath(); c.ellipse(cx, cy + R * .45, R * 2.0, R * 1.35, 0, .12 * Math.PI, .88 * Math.PI); c.stroke(); c.setLineDash([]);
  }
  // 傘
  const bell = () => {
    c.beginPath(); c.moveTo(cx - R, cy);
    c.bezierCurveTo(cx - R, cy - R * 1.25, cx + R, cy - R * 1.25, cx + R, cy);
    c.quadraticCurveTo(cx + R * .5, cy + R * .22, cx, cy + R * .12);
    c.quadraticCurveTo(cx - R * .5, cy + R * .22, cx - R, cy); c.closePath();
  };
  const g = c.createLinearGradient(0, cy - R, 0, cy + R * .2);
  g.addColorStop(0, 'rgba(135,190,212,.8)'); g.addColorStop(1, 'rgba(38,78,108,.78)');
  c.fillStyle = g; bell(); c.fill();
  c.save(); bell(); c.clip();
  if (o.detail) {
    c.strokeStyle = 'rgba(92,221,231,.65)'; c.lineWidth = (shell ? 2.4 : 1.4) * Math.pow(k, .6);
    for (let i = 1; i <= 6; i++) {
      c.beginPath(); c.moveTo(cx, cy - R * 1.0); c.quadraticCurveTo(cx + (i - 3.5) * R * .62, cy - R * .5, cx + (i - 3.5) * R * .3, cy + R * .15); c.stroke();
    }
    for (let i = 1; i <= 4; i++) {
      const yy = cy - R * (1.0 - i * .2);
      c.beginPath(); c.ellipse(cx, yy + R * .25, R * Math.sin((i * .2 + .12) * Math.PI * .9) * 1.05, R * .16, 0, .05 * Math.PI, .95 * Math.PI); c.stroke();
    }
    if (shell) { // 発光する細線
      c.strokeStyle = 'rgba(92,221,231,.18)'; c.lineWidth = 8 * Math.pow(k, .6);
      for (let i = 2; i <= 5; i++) {
        c.beginPath(); c.moveTo(cx, cy - R); c.quadraticCurveTo(cx + (i - 3.5) * R * .62, cy - R * .5, cx + (i - 3.5) * R * .3, cy + R * .15); c.stroke();
      }
    }
  } else {
    c.fillStyle = 'rgba(92,221,231,.12)'; c.fillRect(cx - R, cy - R * 1.2, R * 2, R * 1.3);
  }
  const gl = c.createRadialGradient(cx, cy - R * .45, 0, cx, cy - R * .45, R * .7);
  gl.addColorStop(0, 'rgba(120,240,250,.45)'); gl.addColorStop(1, 'rgba(120,240,250,0)');
  c.fillStyle = gl; c.fillRect(cx - R, cy - R * 1.2, R * 2, R * 1.4);
  c.restore();
  c.strokeStyle = '#082432'; c.lineWidth = sw * 1.2; bell(); c.stroke();
  // 縁の装甲板
  c.fillStyle = '#4a5f6c'; c.strokeStyle = '#082432'; c.lineWidth = Math.max(1.5, sw * .6);
  for (let i = 0; i < 7; i++) {
    const f = (i + .5) / 7; const px = cx - R * .94 + f * R * 1.88;
    c.beginPath(); c.ellipse(px, cy + R * (.04 + .1 * Math.sin(f * Math.PI)), R * .14, R * .07, 0, 0, TAU); c.fill(); c.stroke();
  }
}

function drawKing(c, o, d) {
  const cx = SW * l3([.66, .55, .5], d); const cy = SH * .5;
  const ringR = SH * l3([.62, .6, 1.0], d);
  const eyeR = SH * l3([.17, .3, .5], d);
  const open = l3([.08, 1, 1], d);
  const wob = Math.sin(o.t * .9) * 2 * (1 - o.still);
  // 体の塊
  const mg = c.createRadialGradient(cx, cy, ringR * .4, cx, cy, ringR * 1.6);
  mg.addColorStop(0, 'rgba(10,30,40,.96)'); mg.addColorStop(.7, 'rgba(6,18,26,.9)'); mg.addColorStop(1, 'rgba(6,18,26,0)');
  c.fillStyle = mg; c.beginPath(); c.arc(cx, cy, ringR * 1.6, 0, TAU); c.fill();
  if (o.detail) {
    c.strokeStyle = 'rgba(60,110,120,.35)'; c.lineWidth = 2;
    for (let q = 1; q <= 5; q++) { c.beginPath(); c.arc(cx, cy, ringR * (1.22 + q * .07), 0, TAU); c.stroke(); }
  }
  // 骨質の弧
  const bw = SH * l3([.07, .075, .1], d);
  c.lineCap = 'butt';
  c.strokeStyle = '#6d6350'; c.lineWidth = bw; c.beginPath(); c.arc(cx, cy, ringR, 0, TAU); c.stroke();
  c.strokeStyle = 'rgba(190,175,140,.65)'; c.lineWidth = bw * .35; c.beginPath(); c.arc(cx, cy, ringR - bw * .15, 0, TAU); c.stroke();
  c.strokeStyle = '#3d3629'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, ringR + bw * .5, 0, TAU); c.stroke();
  // 発光孔
  const pores = 30;
  for (let i = 0; i < pores; i++) {
    const ang = i * TAU / pores + .1;
    for (const [rr, col, sc] of [[1.0 + bw / ringR * .9, '#5CDDE7', 1], [1.26, i % 2 ? '#F2B84B' : '#5CDDE7', .7]]) {
      const px = cx + Math.cos(ang + (rr > 1.2 ? .05 : 0)) * ringR * rr; const py = cy + Math.sin(ang + (rr > 1.2 ? .05 : 0)) * ringR * rr;
      if (px < -30 || px > SW + 30 || py < -30 || py > SH + 30) continue;
      const r = SH * .014 * sc * (1 + d * .5);
      if (o.detail) {
        const g = c.createRadialGradient(px, py, 0, px, py, r * 3.2);
        g.addColorStop(0, col === '#5CDDE7' ? 'rgba(92,221,231,.7)' : 'rgba(242,184,75,.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.beginPath(); c.arc(px, py, r * 3.2, 0, TAU); c.fill();
      }
      c.fillStyle = col; c.beginPath(); c.arc(px, py, r, 0, TAU); c.fill();
    }
  }
  // 眼
  const ex = cx + wob; const ey = cy;
  const eg = c.createRadialGradient(ex - eyeR * .2, ey - eyeR * .2, eyeR * .1, ex, ey, eyeR);
  eg.addColorStop(0, '#F2B84B'); eg.addColorStop(.55, '#a8601c'); eg.addColorStop(1, '#2b1408');
  c.fillStyle = eg; c.beginPath(); c.arc(ex, ey, eyeR, 0, TAU); c.fill();
  c.strokeStyle = '#1a0e06'; c.lineWidth = Math.max(3, eyeR * .08); c.stroke();
  if (o.detail) {
    c.strokeStyle = 'rgba(40,10,0,.35)'; c.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) {
      const ang = i * TAU / 18; c.beginPath();
      c.moveTo(ex + Math.cos(ang) * eyeR * .45, ey + Math.sin(ang) * eyeR * .45); c.lineTo(ex + Math.cos(ang) * eyeR * .97, ey + Math.sin(ang) * eyeR * .97); c.stroke();
    }
  }
  c.fillStyle = '#050505'; c.beginPath(); c.ellipse(ex, ey, eyeR * .13, eyeR * .62 * Math.max(.2, open), 0, 0, TAU); c.fill();
  // まぶた
  const cover = (1 - open) * eyeR;
  c.save(); c.beginPath(); c.arc(ex, ey, eyeR + 1, 0, TAU); c.clip();
  c.fillStyle = '#0a1b24';
  c.fillRect(ex - eyeR - 2, ey - eyeR - 2, eyeR * 2 + 4, cover + 2);
  c.fillRect(ex - eyeR - 2, ey + eyeR - cover, eyeR * 2 + 4, cover + 2);
  c.restore();
  c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(ex - eyeR * .35, ey - eyeR * .4 * open, eyeR * .12, eyeR * .07, -.6, 0, TAU); c.fill();
}

// 灯籠イカ：細長い外套の中に暖色の灯りを抱えたイカ
function drawSquid(c, o, d) {
  const lamp = o.target === '灯り';
  const k = l3(lamp ? [.55, 1.1, 2.7] : [.55, 1.0, 1.9], d);
  const [fx, fy] = centerOf('D', o.target, d);
  const sway = Math.sin(o.t * 1.2) * 6 * (1 - o.still);
  const cx = fx * SW + sway; const cy = fy * SH + (lamp ? SH * .1 * Math.min(1, d) : 0);
  const L = SH * .52 * k; const W = SH * .13 * k;
  const ang = -0.5; const ca = Math.cos(ang); const sa = Math.sin(ang);
  const P = (u, v) => [cx + u * ca - v * sa, cy + u * sa + v * ca]; // u: 頭→尾（-:腕側 +:ひれ側）
  // 腕と触腕
  c.lineCap = 'round';
  for (let j = 0; j < 8; j++) {
    const v = (j - 3.5) / 3.5 * W * .7;
    const [x0, y0] = P(-L * .42, v);
    const len = L * (.42 + (j % 3) * .06);
    const [x1, y1] = P(-L * .42 - len * .5, v * 1.4 + Math.sin(o.t * 2 + j) * W * .2 * (1 - o.still));
    const [x2, y2] = P(-L * .42 - len, v * 1.9 + Math.sin(o.t * 1.6 + j) * W * .35 * (1 - o.still));
    c.strokeStyle = 'rgba(200,120,110,.55)'; c.lineWidth = Math.max(2, W * .16);
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x1, y1, x2, y2); c.stroke();
  }
  for (const sgn of [-1, 1]) { // 長い触腕2本
    const [x0, y0] = P(-L * .42, sgn * W * .2);
    const [x1, y1] = P(-L * 1.0, sgn * W * 1.2 + Math.sin(o.t * 1.3) * W * .4 * (1 - o.still));
    const [x2, y2] = P(-L * 1.45, sgn * W * .6);
    c.strokeStyle = 'rgba(220,140,120,.45)'; c.lineWidth = Math.max(1.5, W * .08);
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x1, y1, x2, y2); c.stroke();
    c.fillStyle = 'rgba(242,184,75,.8)'; c.beginPath(); c.arc(x2, y2, Math.max(2, W * .12), 0, TAU); c.fill();
  }
  // 外套（半透明の胴）
  const mantle = () => {
    c.beginPath();
    const [hx, hy] = P(-L * .42, 0);
    c.moveTo(...P(-L * .42, -W));
    c.bezierCurveTo(...P(-L * .05, -W * 1.15), ...P(L * .35, -W * .7), ...P(L * .58, 0));
    c.bezierCurveTo(...P(L * .35, W * .7), ...P(-L * .05, W * 1.15), ...P(-L * .42, W));
    c.quadraticCurveTo(...P(-L * .5, 0), ...P(-L * .42, -W)); c.closePath();
    return [hx, hy];
  };
  // ひれ
  c.fillStyle = 'rgba(210,130,120,.35)';
  for (const sgn of [-1, 1]) {
    c.beginPath(); c.moveTo(...P(L * .2, sgn * W * .8)); c.quadraticCurveTo(...P(L * .45, sgn * W * 2.0), ...P(L * .62, sgn * W * .2)); c.closePath(); c.fill();
  }
  const g = c.createLinearGradient(...P(-L * .4, 0), ...P(L * .6, 0));
  g.addColorStop(0, 'rgba(150,70,70,.85)'); g.addColorStop(1, 'rgba(90,40,50,.8)');
  c.fillStyle = g; mantle(); c.fill();
  // 内側の灯り
  const [lx, ly] = P(L * .02, 0);
  const lr = W * (lamp ? 1.1 : .9) * (o.detail ? 1 : 1.3);
  const pulse = .85 + .15 * Math.sin(o.t * 2.2) * (1 - o.still);
  c.save(); mantle(); c.clip();
  const lg = c.createRadialGradient(lx, ly, 0, lx, ly, lr * 2.2);
  lg.addColorStop(0, `rgba(255,215,140,${.95 * pulse})`); lg.addColorStop(.35, `rgba(242,160,75,${.6 * pulse})`); lg.addColorStop(1, 'rgba(242,120,75,0)');
  c.fillStyle = lg; c.fillRect(lx - lr * 3, ly - lr * 3, lr * 6, lr * 6);
  if (o.detail) { // 外套の色素斑と灯りの芯
    c.fillStyle = 'rgba(60,20,30,.35)';
    for (let i = 0; i < 26; i++) { const [px, py] = P((rnd(i) - .45) * L, (rnd(i + 40) - .5) * W * 1.6); c.beginPath(); c.arc(px, py, Math.max(1.5, W * .07), 0, TAU); c.fill(); }
    c.strokeStyle = `rgba(255,236,190,${.8 * pulse})`; c.lineWidth = Math.max(1.5, W * .05);
    for (let i = 0; i < 6; i++) { const a2 = i * TAU / 6 + o.t * .2 * (1 - o.still); c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx + Math.cos(a2) * lr * .7, ly + Math.sin(a2) * lr * .7); c.stroke(); }
    c.fillStyle = '#fff2d0'; c.beginPath(); c.arc(lx, ly, lr * .22, 0, TAU); c.fill();
  }
  c.restore();
  c.strokeStyle = '#2a0c12'; c.lineWidth = Math.max(2, W * .08); mantle(); c.stroke();
  // 眼
  for (const sgn of [-1, 1]) {
    const [ex, ey] = P(-L * .34, sgn * W * .55);
    c.fillStyle = '#10161a'; c.beginPath(); c.arc(ex, ey, W * .26, 0, TAU); c.fill();
    c.fillStyle = '#5CDDE7'; c.beginPath(); c.arc(ex - W * .06, ey - W * .06, W * .08, 0, TAU); c.fill();
  }
}

// 群れ光魚：小さな光る魚が渦を巻く群れ
function drawSchool(c, o, d) {
  const k = l3([.5, 1.0, 2.1], d);
  const [fx, fy] = centerOf('F', o.target, d);
  const cx = fx * SW; const cy = fy * SH;
  const R = SH * .34 * k;
  const N = 90;
  const sp = o.t * .5 * (1 - o.still * .9);
  for (let i = 0; i < N; i++) {
    const ring = .35 + .65 * rnd(i);
    const a = rnd(i + 200) * TAU + sp * (1.4 - ring);
    const x = cx + Math.cos(a) * R * ring * 1.35;
    const y = cy + Math.sin(a) * R * ring * .75 + Math.sin(a * 3 + i) * R * .05;
    const dir = a + Math.PI / 2;
    const fl = SH * .028 * k * (.8 + rnd(i + 7) * .5);
    c.save(); c.translate(x, y); c.rotate(dir);
    c.fillStyle = 'rgba(150,215,235,.85)';
    c.beginPath(); c.ellipse(0, 0, fl, fl * .38, 0, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-fl * .9, 0); c.lineTo(-fl * 1.6, -fl * .45); c.lineTo(-fl * 1.6, fl * .45); c.closePath(); c.fill();
    const gr = fl * (o.detail ? 1.6 : 2.4);
    const g = c.createRadialGradient(fl * .3, 0, 0, fl * .3, 0, gr);
    g.addColorStop(0, i % 5 ? 'rgba(92,221,231,.7)' : 'rgba(242,184,75,.75)'); g.addColorStop(1, 'rgba(92,221,231,0)');
    c.fillStyle = g; c.beginPath(); c.arc(fl * .3, 0, gr, 0, TAU); c.fill();
    if (o.detail) { c.fillStyle = '#071820'; c.beginPath(); c.arc(fl * .55, -fl * .08, fl * .12, 0, TAU); c.fill(); }
    c.restore();
  }
}

// 深淵の鯨骨：白骨化した巨大な鯨。骨の隙間に発光群が住みつく
function drawWhale(c, o, d) {
  const k = l3([.85, 1.15, 2.0], d);
  const [fx, fy] = centerOf('E', o.target, d);
  const cx = fx * SW; const cy = fy * SH;
  const L = SW * 1.1 * k; const H = SH * .42 * k;
  const bone = '#c9bfa6'; const boneDark = '#6e6550';
  // 背骨
  c.lineCap = 'round';
  const spineY = (u) => cy - H * .55 + Math.sin(u * 3.2) * H * .06;
  c.strokeStyle = boneDark; c.lineWidth = Math.max(4, H * .09);
  c.beginPath(); for (let i = 0; i <= 30; i++) { const u = i / 30; const x = cx - L * .5 + u * L; i ? c.lineTo(x, spineY(u)) : c.moveTo(x, spineY(u)); } c.stroke();
  for (let i = 0; i <= 22; i++) { // 椎骨
    const u = i / 22; const x = cx - L * .5 + u * L; const y = spineY(u);
    c.fillStyle = bone; c.strokeStyle = boneDark; c.lineWidth = Math.max(1.5, H * .015);
    c.beginPath(); c.ellipse(x, y, H * .05, H * .07, 0, 0, TAU); c.fill(); c.stroke();
  }
  // 肋骨
  for (let i = 0; i < 11; i++) {
    const u = .18 + i * .065; const x = cx - L * .5 + u * L; const y = spineY(u);
    const h = H * (1.05 - Math.abs(u - .5) * .9);
    c.strokeStyle = boneDark; c.lineWidth = Math.max(5, H * .07);
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + H * .25, y + h * .7, x - H * .05, y + h * 1.25); c.stroke();
    c.strokeStyle = bone; c.lineWidth = Math.max(3, H * .04);
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + H * .25, y + h * .7, x - H * .05, y + h * 1.25); c.stroke();
  }
  // 頭骨（左端）
  const sx = cx - L * .5; const sy = spineY(0) + H * .2; const S = H * .62;
  c.fillStyle = bone; c.strokeStyle = boneDark; c.lineWidth = Math.max(2, H * .03);
  // 上あご（長いくちばし状）と下あご
  c.beginPath(); c.moveTo(sx + S * .15, sy - S * .45); c.quadraticCurveTo(sx - S * 1.0, sy - S * .35, sx - S * 1.75, sy + S * .05);
  c.lineTo(sx - S * 1.7, sy + S * .18); c.quadraticCurveTo(sx - S * .8, sy + S * .05, sx + S * .2, sy + S * .2); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(sx + S * .1, sy + S * .35); c.quadraticCurveTo(sx - S * .8, sy + S * .45, sx - S * 1.6, sy + S * .35);
  c.lineTo(sx - S * 1.55, sy + S * .48); c.quadraticCurveTo(sx - S * .7, sy + S * .62, sx + S * .15, sy + S * .5); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#0a1418'; c.beginPath(); c.ellipse(sx - S * .15, sy - S * .1, S * .17, S * .13, -.3, 0, TAU); c.fill();
  // ひれの骨
  c.strokeStyle = bone; c.lineWidth = Math.max(2, H * .03);
  for (let j = 0; j < 4; j++) { const bx = sx + L * .12; const by = spineY(.12) + H * .55; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - H * (.3 + j * .08), by + H * (.35 + j * .1)); c.stroke(); }
  // 発光群（骨に住みつく光の粒）
  const pulse = (i) => .7 + .3 * Math.sin(o.t * 2 + i) * (1 - o.still);
  for (let i = 0; i < 84; i++) {
    const cl = i % 7; // 7つの群体（塊）
    const u = .2 + cl * .1 + (rnd(i) - .5) * .06; const x = cx - L * .5 + u * L + (rnd(i + 3) - .5) * H * .25;
    const y = spineY(u) + H * (.35 + rnd(cl + 30) * .5) + (rnd(i + 9) - .5) * H * .3;
    const r = Math.max(2, H * (.02 + rnd(i + 5) * .025)) * (o.detail ? 1 : 1.3);
    const col = i % 3 ? [118, 230, 173] : [92, 221, 231];
    const g = c.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, `rgba(${col},${.8 * pulse(i)})`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 4, 0, TAU); c.fill();
    c.fillStyle = `rgba(230,255,240,${pulse(i)})`; c.beginPath(); c.arc(x, y, r * .6, 0, TAU); c.fill();
  }
}

// 海溝の母：海溝の壁一面に広がる、脈打つ発光体
function drawMother(c, o, d) {
  const k = l3([.55, 1.0, 1.9], d);
  const [fx, fy] = centerOf('G', o.target, d);
  const cx = fx * SW; const cy = fy * SH;
  const R = SH * .55 * k;
  const beat = .5 + .5 * Math.sin(o.t * 1.8) * (1 - o.still);
  // 体の膜
  // 海溝の壁そのものが生き物：遠くでも窓の幅いっぱいに広がる
  const wall = c.createLinearGradient(0, 0, 0, SH);
  wall.addColorStop(0, 'rgba(40,12,44,.85)'); wall.addColorStop(.5, 'rgba(58,18,58,.92)'); wall.addColorStop(1, 'rgba(30,10,36,.85)');
  c.fillStyle = wall;
  c.beginPath(); c.moveTo(0, cy - R * 1.1);
  for (let i = 0; i <= 12; i++) c.lineTo(SW * i / 12, cy - R * (1.0 + .15 * Math.sin(i * 1.7 + o.t * .5 * (1 - o.still))));
  c.lineTo(SW, cy + R * 1.2); for (let i = 12; i >= 0; i--) c.lineTo(SW * i / 12, cy + R * (1.05 + .15 * Math.sin(i * 2.1)));
  c.closePath(); c.fill();
  const mg = c.createRadialGradient(cx, cy, R * .1, cx, cy, R * 1.7);
  mg.addColorStop(0, 'rgba(90,28,76,.95)'); mg.addColorStop(.6, 'rgba(52,16,52,.7)'); mg.addColorStop(1, 'rgba(20,8,26,0)');
  c.fillStyle = mg; c.beginPath(); c.ellipse(cx, cy, R * 1.8, R * 1.3, 0, 0, TAU); c.fill();
  // 壁全体を走る横の脈
  c.lineCap = 'round';
  for (let j = 0; j < 7; j++) {
    const yy = cy + (j - 3) * R * .3;
    c.strokeStyle = `rgba(232,120,200,${.18 + .3 * beat})`; c.lineWidth = Math.max(1.5, R * .02);
    c.beginPath(); c.moveTo(0, yy); for (let i = 1; i <= 10; i++) c.lineTo(SW * i / 10, yy + Math.sin(i * 1.3 + j) * R * .08); c.stroke();
  }
  // 脈（枝分かれする光の筋）
  const vein = (x, y, ang, len, w, depth, seed) => {
    if (depth > 3 || len < 6) return;
    const x2 = x + Math.cos(ang) * len; const y2 = y + Math.sin(ang) * len;
    c.strokeStyle = `rgba(232,120,200,${.35 + .45 * beat})`; c.lineWidth = w;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo((x + x2) / 2 + Math.sin(seed) * len * .2, (y + y2) / 2, x2, y2); c.stroke();
    vein(x2, y2, ang - .45 - rnd(seed) * .3, len * .66, w * .65, depth + 1, seed + 1.7);
    vein(x2, y2, ang + .45 + rnd(seed + 1) * .3, len * .66, w * .65, depth + 1, seed + 3.1);
  };
  c.lineCap = 'round';
  for (let i = 0; i < 10; i++) vein(cx, cy, i * TAU / 10 + .2, R * .45, Math.max(2, R * .035), 0, i * 5.3);
  // 脈の結節（壁全体に散らばる）
  for (let i = 0; i < 40; i++) {
    const a = rnd(i) * TAU; const r = R * (.3 + rnd(i + 11) * 1.4);
    const x = cx + Math.cos(a) * r * 1.8; const y = cy + Math.sin(a) * r * .8;
    const nr = Math.max(2.5, R * .03) * (o.detail ? 1 : 1.4);
    const g = c.createRadialGradient(x, y, 0, x, y, nr * 4);
    g.addColorStop(0, `rgba(255,170,230,${.5 + .4 * beat})`); g.addColorStop(1, 'rgba(255,170,230,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, nr * 4, 0, TAU); c.fill();
  }
  // 中心の口（脈動する虹彩）
  const mr = R * (.24 + .04 * beat);
  const og = c.createRadialGradient(cx, cy, 0, cx, cy, mr);
  og.addColorStop(0, '#05010a'); og.addColorStop(.7, '#2a0a2e'); og.addColorStop(1, `rgba(240,140,220,${.6 + .3 * beat})`);
  c.fillStyle = og; c.beginPath(); c.arc(cx, cy, mr, 0, TAU); c.fill();
  if (o.detail) {
    c.strokeStyle = 'rgba(255,200,240,.55)'; c.lineWidth = Math.max(1.5, R * .012);
    for (let i = 0; i < 16; i++) { const a = i * TAU / 16; c.beginPath(); c.moveTo(cx + Math.cos(a) * mr * .55, cy + Math.sin(a) * mr * .55); c.lineTo(cx + Math.cos(a) * mr * .98, cy + Math.sin(a) * mr * .98); c.stroke(); }
  }
}

function drawCreature(c, o, d) {
  c.clearRect(0, 0, SW, SH);
  if (o.species === 'A') drawRibbon(c, o, d);
  else if (o.species === 'B') drawJelly(c, o, d);
  else if (o.species === 'D') drawSquid(c, o, d);
  else if (o.species === 'F') drawSchool(c, o, d);
  else if (o.species === 'E') drawWhale(c, o, d);
  else if (o.species === 'G') drawMother(c, o, d);
  else drawKing(c, o, d);
}

// 窓の中身すべて。o: {species,target,depth,dist,focus(0..1),t,still,light,sound}
export function drawScene(c, o) {
  const d = Math.max(0, Math.min(2, o.dist));
  const O = { t: 0, still: 0, light: .12, sound: -1, focus: 1, ...o };
  O.detail = O.focus >= .5;
  c.save();
  c.beginPath(); c.rect(0, 0, SW, SH); c.clip();
  drawSea(c, O);
  drawParticles(c, O, [0, 1]);
  drawBeam(c, O, d);
  const L = getLayer(); const lc = L.getContext('2d');
  lc.setTransform(1, 0, 0, 1, 0, 0);
  drawCreature(lc, O, d);
  c.globalAlpha = .88 + O.light * .12;
  if (O.detail) c.drawImage(L, 0, 0);
  else { // ピントが合っていない：輪郭がにじむ
    c.globalAlpha *= .5; c.drawImage(L, 0, 0);
    c.globalAlpha *= .6;
    for (const [dx, dy] of [[-5, 0], [5, 0], [0, -4], [0, 4]]) c.drawImage(L, dx, dy);
  }
  c.globalAlpha = 1;
  // 遠いほど霧がかかる
  const fog = .26 * (1 - Math.min(d, 1));
  if (fog > 0) { c.fillStyle = `rgba(8,44,66,${fog})`; c.fillRect(0, 0, SW, SH); }
  drawParticles(c, O, [2]);
  if (O.sound >= 0) {
    for (let i = 0; i < 3; i++) {
      const p = O.sound - i * .16; if (p <= 0 || p >= 1) continue;
      c.strokeStyle = `rgba(118,230,173,${(1 - p) * .6})`; c.lineWidth = 3;
      c.beginPath(); c.ellipse(SW * .5, SH * 1.04, p * SW * .9, p * SH * .85, 0, Math.PI, TAU); c.stroke();
    }
  }
  if (O.still > 0) { c.fillStyle = `rgba(2,9,18,${O.still * .25})`; c.fillRect(0, 0, SW, SH); }
  const vg = c.createRadialGradient(SW / 2, SH / 2, SH * .35, SW / 2, SH / 2, SW * .7);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
  c.fillStyle = vg; c.fillRect(0, 0, SW, SH);
  c.restore();
}

// ソナー（円形スコープ）。size 四方。
export function drawSonar(c, size, o) {
  const R = size / 2 - 4; const cx = size / 2; const cy = size / 2;
  c.clearRect(0, 0, size, size);
  c.fillStyle = '#04120e'; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(118,230,173,.35)'; c.lineWidth = 1;
  for (let i = 1; i <= 3; i++) { c.beginPath(); c.arc(cx, cy, R * i / 3, 0, TAU); c.stroke(); }
  c.beginPath(); c.moveTo(cx - R, cy); c.lineTo(cx + R, cy); c.moveTo(cx, cy - R); c.lineTo(cx, cy + R); c.stroke();
  const sweep = (o.t * 1.3) % TAU;
  const g = c.createConicGradient ? c.createConicGradient(sweep - 1.2, cx, cy) : null;
  if (g) { g.addColorStop(0, 'rgba(118,230,173,0)'); g.addColorStop(.19, 'rgba(118,230,173,.28)'); g.addColorStop(.2, 'rgba(118,230,173,0)'); g.addColorStop(1, 'rgba(118,230,173,0)'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill(); }
  c.strokeStyle = 'rgba(118,230,173,.8)'; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R); c.stroke();
  // 反応：距離で中心へ寄る
  const r = R * l3([.78, .5, .2], Math.max(0, Math.min(2, o.dist)));
  c.fillStyle = '#76E6AD'; c.strokeStyle = '#76E6AD'; c.lineWidth = 3;
  const ang = -0.6;
  const px = cx + Math.cos(ang) * r; const py = cy + Math.sin(ang) * r;
  if (o.species === 'A') {
    for (let i = -4; i <= 4; i++) { c.beginPath(); c.arc(px + i * R * .05, py + i * R * .02, 2.4, 0, TAU); c.fill(); }
  } else if (o.species === 'B') {
    c.beginPath(); c.arc(px, py, R * .1, Math.PI, TAU); c.stroke();
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(px + i * R * .06, py); c.lineTo(px + i * R * .06, py + R * .12); c.stroke(); }
  } else if (o.species === 'D') {
    c.beginPath(); c.ellipse(px, py, R * .05, R * .1, -.5, 0, TAU); c.stroke();
    c.beginPath(); c.arc(px, py, 3, 0, TAU); c.fill();
  } else if (o.species === 'F') {
    for (let i = 0; i < 14; i++) { const a = i * TAU / 14; c.beginPath(); c.arc(px + Math.cos(a) * R * .09, py + Math.sin(a) * R * .06, 1.8, 0, TAU); c.fill(); }
  } else { // 窓幅を超える巨大な反応
    c.lineWidth = 5; c.globalAlpha = .9;
    c.beginPath(); c.arc(cx, cy, Math.max(R * .18, r), Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    c.globalAlpha = .45; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, Math.max(R * .18, r) + 7, Math.PI * .95, Math.PI * 2.05); c.stroke(); c.globalAlpha = 1;
  }
  c.strokeStyle = '#2b4a3c'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke();
}

const rr = (c, x, y, w, h, r) => {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
};

export const CARD_W = 720;
export const CARD_H = 900;

// 写真カード（結果表示と PNG 書き出しで共通）。meta: {speciesName,target,depth,hull,returned,qualityText}
export function drawCard(c, photo, meta) {
  const bg = c.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, '#4a2a14'); bg.addColorStop(1, '#170d06');
  c.fillStyle = bg; c.fillRect(0, 0, CARD_W, CARD_H);
  const lamp = c.createRadialGradient(CARD_W / 2, 0, 20, CARD_W / 2, 0, 640);
  lamp.addColorStop(0, 'rgba(255,190,100,.5)'); lamp.addColorStop(1, 'rgba(255,190,100,0)');
  c.fillStyle = lamp; c.fillRect(0, 0, CARD_W, CARD_H);
  // フィルムの白縁
  c.fillStyle = '#efe6d2'; rr(c, 40, 36, 640, 560, 8); c.fill();
  c.save(); c.translate(60, 56); c.beginPath(); c.rect(0, 0, SW, SH); c.clip();
  drawScene(c, { species: photo.species, target: photo.target, depth: photo.depth, dist: photo.dist, focus: photo.focus, t: 2.4 + photo.index, still: 1, light: .35 });
  c.restore();
  c.strokeStyle = '#1b130a'; c.lineWidth = 3; c.strokeRect(60, 56, SW, SH);
  c.fillStyle = '#3b2a18'; c.textBaseline = 'middle';
  c.font = '700 30px ui-monospace, Menlo, Consolas, monospace'; c.textAlign = 'left';
  c.fillText(`−${photo.depth} m`, 62, 562);
  c.font = '600 22px system-ui, "Hiragino Sans", "Noto Sans JP", sans-serif'; c.textAlign = 'right';
  c.fillText(meta.qualityText, 658, 562);
  if (!meta.returned) {
    c.save(); c.translate(CARD_W / 2, 56 + SH / 2); c.rotate(-.14);
    c.strokeStyle = '#E56755'; c.fillStyle = 'rgba(30,6,4,.55)'; c.lineWidth = 8;
    rr(c, -170, -52, 340, 104, 10); c.fill(); c.stroke();
    c.fillStyle = '#E56755'; c.font = '800 64px system-ui, "Hiragino Sans", "Noto Sans JP", sans-serif'; c.textAlign = 'center';
    c.fillText('未回収', 0, 4);
    c.restore();
  }
  c.textAlign = 'left'; c.fillStyle = '#ffe3b8';
  c.font = '800 54px system-ui, "Hiragino Sans", "Noto Sans JP", sans-serif';
  c.fillText(meta.speciesName, 50, 664);
  c.font = '500 28px system-ui, "Hiragino Sans", "Noto Sans JP", sans-serif'; c.fillStyle = '#e9cfa6';
  c.fillText(`観測対象：${meta.target}`, 50, 718);
  c.fillText(`深度：${photo.depth} m`, 50, 760);
  c.fillStyle = meta.returned ? '#e9cfa6' : '#E56755';
  c.fillText(meta.returned ? `帰還時の耐久：${meta.hull} / 7` : '記録未回収（探査艇ロスト）', 50, 802);
  c.fillStyle = '#F2B84B'; c.font = '700 30px system-ui, "Hiragino Sans", "Noto Sans JP", sans-serif';
  c.fillText('深海、未確認反応', 50, 864);
}
