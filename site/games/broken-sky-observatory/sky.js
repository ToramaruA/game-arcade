// 空の描画（Canvas のみ）。解像度 320x200 のドット絵として描き、CSS で拡大する。
import { decode, anomalyOf } from './logic.js';

export const W = 320;
export const H = 200;
const HZ = 150; // 地平線

const PAL = [
  ['#2b2a4a', '#6b4a6a', '#d98a6a', '#f2c58b'], // 夜明け
  ['#2a7c9a', '#5fb0c0', '#a8dcd2', '#e0f0d8'], // 昼
  ['#1a1030', '#7a2f5a', '#e0644a', '#f4a65a'], // 夕暮れ
  ['#050a18', '#0b1424', '#16304a', '#2a6971'], // 深夜
];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, f) => a.map((v, i) => Math.round(v + (b[i] - v) * f));
const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const canvasOf = () => {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  return c;
};

// ---- 背景グラデーション（ディザ）。時刻×気圧ごとにキャッシュ ----
const skyCache = new Map();
function skyBase(t, p) {
  const key = `${t}-${p}`;
  if (skyCache.has(key)) return skyCache.get(key);
  const c = canvasOf();
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  let stops = PAL[t].map(hex);
  if (p === 0) stops = stops.map((s) => mix(s, hex('#3a3f46'), 0.5));
  if (p === 2) stops = stops.map((s) => mix(s, hex('#ffffff'), 0.08));
  if (p === 3) stops = stops.map((s) => mix(s, hex('#7a3a7a'), 0.3));
  const step = 14;
  for (let y = 0; y < H; y++) {
    const f = Math.min(1, y / HZ) * 3;
    const i = Math.min(2, Math.floor(f));
    const col = mix(stops[i], stops[i + 1], f - i);
    for (let x = 0; x < W; x++) {
      const th = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * step;
      const o = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) img.data[o + k] = Math.max(0, Math.min(255, Math.round((col[k] + th) / step) * step));
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  if (p === 3) { // 不明：走査線の帯
    g.fillStyle = 'rgba(255,60,200,.07)';
    for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2);
  }
  skyCache.set(key, c);
  return c;
}

// ---- 星・天体・雲・街（IDごとに固定） ----
const layerCache = new Map();
function staticLayers(id) {
  if (layerCache.has(id)) return layerCache.get(id);
  const { t, w, p } = decode(id);
  const R = rng(id * 97 + 13);
  const c = canvasOf();
  const g = c.getContext('2d');
  // 星
  const stars = t === 3 ? (p === 2 ? 110 : p === 0 ? 14 : 60) : t === 0 ? 14 : 0;
  for (let i = 0; i < stars; i++) {
    g.fillStyle = R() > 0.85 ? '#d7e8e1' : '#7fa3a6';
    g.fillRect(Math.floor(R() * W), Math.floor(R() * 100), 1, 1);
  }
  // 天体
  const body = [[60, 118, 12, '#f2c58b'], [230, 40, 10, '#fffbe8'], [250, 128, 24, '#e9553f'], [90, 50, 15, '#d7e8e1']][t];
  const [bx, by, br, bc] = body;
  const glow = g.createRadialGradient(bx, by, br * 0.6, bx, by, br * (p === 2 ? 4 : 2.6));
  glow.addColorStop(0, p === 0 ? 'rgba(200,200,200,.12)' : 'rgba(255,230,190,.45)');
  glow.addColorStop(1, 'rgba(255,230,190,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  g.fillStyle = p === 0 ? 'rgba(120,125,130,.8)' : bc;
  g.beginPath(); g.arc(bx, by, br, 0, 7); g.fill();
  if (t === 3) { g.fillStyle = 'rgba(30,60,70,.35)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(bx - 6 + R() * 12, by - 6 + R() * 12, 2 + R() * 3, 0, 7); g.fill(); } }
  if (p === 3) { g.strokeStyle = '#E96A55'; g.lineWidth = 1; g.beginPath(); g.arc(bx, by, br + 4, 0, 7); g.stroke(); g.fillStyle = 'rgba(11,20,36,.55)'; g.fillRect(bx - 1, by - br - 6, 2, br * 2 + 12); }
  // 雲（風向で形が変わる）
  const nCloud = [10, 5, 2, 6][p];
  const cloudCol = t === 3 ? [26, 44, 66] : t === 2 ? [150, 60, 80] : t === 0 ? [150, 100, 120] : [220, 240, 235];
  const dark = p === 0 ? 0.55 : p === 3 ? 0.25 : 0.1;
  for (let i = 0; i < nCloud; i++) {
    const cy = 20 + R() * 100;
    const cx = R() * W;
    const len = w === 3 ? 90 + R() * 80 : 40 + R() * 50;
    const hgt = w === 2 ? 22 + R() * 20 : w === 3 ? 4 + R() * 4 : 8 + R() * 6;
    const base = p === 3 ? mix(cloudCol, hex('#b040b0'), 0.4) : mix(cloudCol, hex('#202830'), dark);
    for (let k = 0; k < 4; k++) {
      const col = mix(base, k < 2 ? hex('#101820') : hex('#ffffff'), k < 2 ? 0.25 : 0.15);
      g.fillStyle = css(col);
      const skew = w === 0 ? 6 : w === 1 ? -6 : 0;
      for (let row = 0; row < hgt; row += 2) {
        const u = row / hgt * 2 - 1;
        const f = Math.sqrt(Math.max(0.05, 1 - u * u)) * (0.8 + 0.2 * Math.sin(row * 1.7 + cx));
        const l = len * f * (1 - k * 0.12);
        const x0 = cx - l / 2 + skew * (row / hgt) + (w === 2 ? (R() - 0.5) * 3 : 0);
        g.fillRect(Math.round(x0), Math.round(cy - k * 2 + row), Math.max(1, Math.round(l)), 2);
      }
    }
  }
  // 低気圧：地平線に厚い雲の帯
  if (p === 0) { g.fillStyle = 'rgba(40,45,52,.55)'; g.fillRect(0, 118, W, 32); }
  // 遠景の街
  const sk = canvasOf().getContext('2d');
  let x = -4;
  const blt = t === 3 ? '#0B1424' : '#1a1520';
  while (x < W) {
    const bw = 8 + Math.floor(R() * 18);
    const bh = 14 + Math.floor(R() * 44) * (R() > 0.82 ? 1.4 : 1);
    sk.fillStyle = blt;
    sk.fillRect(x, HZ - bh, bw, bh + 60);
    if (R() > 0.7) sk.fillRect(x + 3, HZ - bh - 8, 2, 8); // アンテナ
    if (R() > 0.75) { sk.fillStyle = '#05080f'; sk.fillRect(x + bw - 3, HZ - bh - 3, 3, 3); } // 崩れ
    for (let wy = HZ - bh + 4; wy < HZ - 2; wy += 6) {
      for (let wx = x + 2; wx < x + bw - 2; wx += 4) {
        if (R() > 0.92) { sk.fillStyle = R() > 0.5 ? '#B98B52' : '#2A6971'; sk.fillRect(wx, wy, 2, 2); }
      }
    }
    x += bw + (R() > 0.7 ? 3 + Math.floor(R() * 6) : 0);
  }
  // 送電塔
  const tx = 40 + Math.floor(R() * 240);
  sk.strokeStyle = '#0B1424'; sk.lineWidth = 1.5;
  sk.beginPath(); sk.moveTo(tx - 9, HZ + 8); sk.lineTo(tx - 2, HZ - 40); sk.lineTo(tx + 2, HZ - 40); sk.lineTo(tx + 9, HZ + 8);
  sk.moveTo(tx - 14, HZ - 32); sk.lineTo(tx + 14, HZ - 32); sk.moveTo(tx - 8, HZ - 18); sk.lineTo(tx + 8, HZ - 18); sk.stroke();
  // 地面
  sk.fillStyle = '#05080f'; sk.fillRect(0, HZ + 6, W, H);
  const out = { sky: c, city: sk.canvas };
  layerCache.set(id, out);
  return out;
}

// ---- 描画の小道具 ----
const px = (g, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function ell(g, x, y, rx, ry, col, rot = 0) { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, 7); g.fill(); }
function poly(g, pts, col) { g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); }
function fish(g, x, y, s, col, dir) {
  ell(g, x, y, 5 * s, 2.2 * s, col);
  poly(g, [[x - dir * 4 * s, y], [x - dir * 8 * s, y - 3 * s], [x - dir * 8 * s, y + 3 * s]], col);
  px(g, x + dir * 2.5 * s, y - 0.8 * s, 1, 1, '#0b1424');
}

// ---- 12 の特異現象（窓の中央に大きな主役） ----
const ANOM = {
  'inverted-sea'(g, tm) {
    for (let r = 0; r < 12; r++) {
      const y = 4 + r * 8;
      g.fillStyle = r % 2 ? '#2A6971' : '#1d4d57';
      g.beginPath(); g.moveTo(0, 0);
      for (let x = 0; x <= W; x += 4) g.lineTo(x, y + Math.sin(x / 14 + tm * 1.2 + r) * 3);
      g.lineTo(W, 0); g.fill();
    }
    g.fillStyle = '#9fd0c8';
    for (let r = 0; r < 8; r++) for (let x = (r * 23) % 40; x < W; x += 40) px(g, x + Math.sin(tm + r) * 2, 8 + r * 10, 8, 1, '#9fd0c8');
    // 逆さの船（上から吊られている）
    const sx = 150 + Math.sin(tm * 0.6) * 4, sy = 70;
    poly(g, [[sx - 30, sy - 10], [sx + 30, sy - 10], [sx + 20, sy + 6], [sx - 20, sy + 6]], '#0b1424');
    px(g, sx - 1, sy + 6, 2, 38, '#0b1424');
    poly(g, [[sx + 2, sy + 10], [sx + 24, sy + 34], [sx + 2, sy + 34]], '#B98B52');
    poly(g, [[sx - 2, sy + 14], [sx - 18, sy + 30], [sx - 2, sy + 30]], '#7B493C');
    for (let i = 0; i < 6; i++) px(g, 40 + i * 48, ((tm * 30 + i * 37) % 70) + 40, 1, 4, '#9fd0c8'); // 落ちる雫
    g.fillStyle = 'rgba(10,20,36,.35)'; g.fillRect(0, 100, W, 50);
  },
  'double-sun'(g, tm) {
    const suns = [[108, 74, 30], [212, 64, 24 + Math.sin(tm * 2) * 1.5]];
    suns.forEach(([x, y, r], i) => {
      const gr = g.createRadialGradient(x, y, r * 0.4, x, y, r * 3.4);
      gr.addColorStop(0, 'rgba(255,240,190,.75)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      ell(g, x, y, r + 4, r + 4, '#f7d58a'); ell(g, x, y, r, r, i ? '#fffbe8' : '#fff1b8');
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1;
      for (let k = 0; k < 14; k++) { const a = k * 0.45 + tm * 0.1 * (i ? -1 : 1); g.beginPath(); g.moveTo(x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 6)); g.lineTo(x + Math.cos(a) * (r + 22), y + Math.sin(a) * (r + 22)); g.stroke(); }
    });
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, 0, W, 4);
  },
  eye(g, tm) {
    const open = 0.55 + 0.45 * Math.max(0, Math.min(1, 1.6 - Math.abs(((tm * 0.35) % 3) - 1.5) * 3));
    const ry = 50 * open;
    g.fillStyle = 'rgba(233,106,85,.18)'; g.fillRect(0, 60, W, 90);
    ell(g, 160, 112, 118, ry + 6, '#3a1a22');
    ell(g, 160, 112, 108, ry, '#e8e2d0');
    g.save(); g.beginPath(); g.ellipse(160, 112, 108, Math.max(0.1, ry), 0, 0, 7); g.clip();
    g.strokeStyle = 'rgba(200,60,50,.55)'; g.lineWidth = 1;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.28; g.beginPath(); g.moveTo(160 + Math.cos(a) * 108, 112 + Math.sin(a) * 52); g.quadraticCurveTo(160 + Math.cos(a) * 72, 112 + Math.sin(a) * 30, 160 + Math.cos(a) * 46, 112 + Math.sin(a) * 22); g.stroke(); }
    const ix = 160 + Math.sin(tm * 0.5) * 10;
    ell(g, ix, 112, 40, 40, '#2A6971'); ell(g, ix, 112, 33, 33, '#3d9a91');
    g.strokeStyle = '#B98B52'; for (let k = 0; k < 24; k++) { const a = k / 24 * 6.28; g.beginPath(); g.moveTo(ix + Math.cos(a) * 14, 112 + Math.sin(a) * 14); g.lineTo(ix + Math.cos(a) * 33, 112 + Math.sin(a) * 33); g.stroke(); }
    ell(g, ix, 112, 13, 28, '#05080f'); ell(g, ix - 5, 104, 4, 4, 'rgba(255,255,255,.8)');
    g.restore();
    poly(g, [[40, 112], [160, 112 - ry - 14], [280, 112], [160, 112 - ry - 4]], '#1a0f16');
    poly(g, [[40, 112], [160, 112 + ry + 14], [280, 112], [160, 112 + ry + 4]], '#1a0f16');
  },
  'falling-city'(g, tm) {
    const dy = Math.sin(tm * 0.8) * 3;
    poly(g, [[70, -4], [250, -4], [236, 20 + dy], [210, 40 + dy], [180, 58 + dy], [160, 70 + dy], [136, 52 + dy], [110, 38 + dy], [84, 22 + dy]], '#3b2a2a');
    for (let i = 0; i < 20; i++) px(g, 80 + i * 8, 4 + (i * 7) % 20 + dy, 4, 2, '#5a3d36');
    const R = rng(5);
    for (let i = 0; i < 9; i++) {
      const x = 96 + i * 16, h = 20 + R() * 36, top = 40 + dy + Math.abs(i - 4) * 4;
      px(g, x, top, 12, h, i % 2 ? '#0b1424' : '#16243a');
      px(g, x + 4, top + h, 4, 6, '#0b1424');
      for (let k = 0; k < 6; k++) if (R() > 0.4) px(g, x + 2 + (k % 2) * 5, top + 6 + Math.floor(k / 2) * 9, 2, 2, '#e8b968');
    }
    g.strokeStyle = 'rgba(255,200,150,.35)'; g.lineWidth = 1;
    for (let i = 0; i < 16; i++) { const x = 82 + i * 10; const y = 70 + ((tm * 40 + i * 13) % 60); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); }
    ell(g, 160, 150, 70, 5, 'rgba(0,0,0,.4)');
  },
  'fish-cloud'(g, tm) {
    const R = rng(11);
    for (let i = 0; i < 70; i++) {
      const a = R() * 6.28, d = Math.pow(R(), 0.6);
      const bx = 160 + Math.cos(a) * d * 130, by = 66 + Math.sin(a) * d * 44;
      const x = bx + Math.sin(tm * 0.8 + i) * 6, y = by + Math.cos(tm * 0.6 + i * 2) * 3;
      const v = 200 + Math.floor(R() * 40);
      fish(g, x, y, 1.1 + (1 - d) * 0.9, `rgb(${v - 40},${v},${v - 10})`, Math.cos(a) > 0 ? -1 : 1);
    }
    for (let i = 0; i < 12; i++) { const y = 100 + i * 4; const x = (tm * 40 + i * 70) % 360 - 20; fish(g, x, y, 0.8, '#9fd0c8', 1); }
    g.fillStyle = 'rgba(160,220,210,.12)'; g.fillRect(0, 0, W, 140);
  },
  'black-rainbow'(g, tm) {
    g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(0, 0, W, HZ);
    const cols = ['#000000', '#12081a', '#1b0f2e', '#0a1a22', '#0f2a22', '#1d1a0a', '#2a0f12'];
    cols.forEach((c, i) => { const r = 142 - i * 9; g.strokeStyle = c; g.lineWidth = 9; g.beginPath(); g.arc(160, 168, r, Math.PI, 0); g.stroke(); });
    g.strokeStyle = `rgba(255,255,255,${0.35 + 0.15 * Math.sin(tm * 2)})`; g.lineWidth = 1;
    g.beginPath(); g.arc(160, 168, 147, Math.PI, 0); g.stroke(); g.beginPath(); g.arc(160, 168, 78, Math.PI, 0); g.stroke();
    for (let i = 0; i < 20; i++) px(g, 20 + i * 15, 30 + ((i * 29) % 60), 2, 2, 'rgba(0,0,0,.5)');
  },
  'forbidden-moon'(g, tm) {
    const x = 160, y = 76;
    const gr = g.createRadialGradient(x, y, 40, x, y, 130);
    gr.addColorStop(0, `rgba(233,106,85,${0.4 + 0.1 * Math.sin(tm * 2)})`); gr.addColorStop(1, 'rgba(233,106,85,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    ell(g, x, y, 62, 62, '#d7e8e1'); ell(g, x + 8, y + 4, 58, 58, '#bfd3cd');
    ell(g, x - 22, y - 10, 12, 18, '#0b1424'); ell(g, x + 22, y - 10, 12, 18, '#0b1424');
    ell(g, x - 22, y - 6, 3, 3, '#E96A55'); ell(g, x + 22, y - 6, 3, 3, '#E96A55');
    g.fillStyle = '#0b1424'; g.beginPath(); g.ellipse(x, y + 28, 16, 7 + Math.sin(tm * 1.5) * 3, 0, 0, 7); g.fill();
    g.strokeStyle = '#E96A55'; g.lineWidth = 1.5;
    [[x - 52, y - 20, x - 36, y - 6], [x + 50, y + 4, x + 34, y + 12], [x + 6, y - 60, x + 2, y - 44]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo((a + c) / 2 + 3, (b + d) / 2 - 3); g.lineTo(c, d); g.stroke(); });
  },
  'sky-crack'(g, tm) {
    const pts = []; const R = rng(8);
    for (let y = -4; y <= 150; y += 10) pts.push([160 + Math.sin(y / 17) * 26 + (R() - 0.5) * 14, y]);
    const w = 11 + Math.sin(tm * 1.2) * 2;
    g.save(); g.shadowColor = '#ffd89a'; g.shadowBlur = 18;
    poly(g, [...pts.map(([x, y]) => [x - w * (1 - y / 190), y]), ...pts.slice().reverse().map(([x, y]) => [x + w * (1 - y / 190), y])], '#fff1c8');
    g.restore();
    poly(g, [...pts.map(([x, y]) => [x - w * 0.55 * (1 - y / 190), y]), ...pts.slice().reverse().map(([x, y]) => [x + w * 0.55 * (1 - y / 190), y])], '#ffffff');
    g.strokeStyle = '#05080f'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const [x, y] = pts[2 + i * 3]; g.beginPath(); g.moveTo(x + 6, y); g.lineTo(x + 30 + i * 6, y + 12); g.lineTo(x + 40 + i * 8, y + 10); g.stroke(); g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x - 28 - i * 5, y + 8); g.stroke(); }
  },
  'giant-hand'(g, tm) {
    const dy = Math.sin(tm * 0.7) * 4;
    const skin = '#d9d0c4', sh = '#a79d93';
    px(g, 130, -4, 60, 40 + dy, skin);
    poly(g, [[116, 36 + dy], [204, 36 + dy], [212, 70 + dy], [108, 70 + dy]], skin);
    [[-46, 90, 12], [-24, 112, 12], [0, 118, 13], [24, 108, 12], [46, 82, 10]].forEach(([ox, len, wd], i) => {
      const wig = Math.sin(tm * 1.1 + i) * 3;
      const x = 160 + ox + (i === 0 ? -6 : i === 4 ? 6 : 0);
      px(g, x - wd / 2, 66 + dy, wd, len - 26 + wig, skin);
      ell(g, x, 66 + dy + len - 26 + wig, wd / 2, wd / 2, skin);
      px(g, x - wd / 2, 66 + dy, 2, len - 26 + wig, sh);
      px(g, x - 3, 66 + dy + len - 30 + wig, 6, 3, '#f0e6da');
    });
    g.strokeStyle = sh; g.lineWidth = 1;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(130 + i * 20, 46 + dy); g.lineTo(134 + i * 20, 62 + dy); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 6; i++) g.fillRect(60 + i * 32, 4 + (i % 2) * 6, 26, 4);
  },
  'burning-whale'(g, tm) {
    const y = 80 + Math.sin(tm * 0.9) * 5;
    ell(g, 160, y, 100, 30, '#1a1228');
    poly(g, [[250, y - 8], [290, y - 40 + Math.sin(tm * 1.5) * 4], [284, y - 4], [296, y + 20], [250, y + 8]], '#1a1228');
    poly(g, [[140, y + 20], [120, y + 52], [170, y + 24]], '#1a1228');
    ell(g, 94, y - 4, 2, 2, '#e8d9b8');
    ell(g, 150, y + 14, 70, 12, '#3a2a48');
    for (let i = 0; i < 34; i++) {
      const x = 80 + i * 5.2, f = (Math.sin(tm * 6 + i * 1.7) + 1) / 2;
      const top = y - 28 + Math.abs(i - 17) * 0.45;
      const h = 8 + f * 16 + (i % 3) * 3;
      poly(g, [[x - 3, top + 2], [x, top - h], [x + 3, top + 2]], i % 2 ? '#E96A55' : '#f4a65a');
      poly(g, [[x - 1.5, top + 2], [x, top - h * 0.5], [x + 1.5, top + 2]], '#fff1b8');
    }
    for (let i = 0; i < 18; i++) px(g, 70 + ((i * 41 + tm * 14) % 190), 20 + ((i * 17) % 50) - ((tm * 8 + i * 5) % 20), 1, 1, '#ffd89a');
  },
  'clock-moon'(g, tm) {
    const x = 160, y = 80;
    const gr = g.createRadialGradient(x, y, 40, x, y, 120);
    gr.addColorStop(0, 'rgba(215,232,225,.35)'); gr.addColorStop(1, 'rgba(215,232,225,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 24; k++) { const a = k / 24 * 6.28 + tm * 0.2; poly(g, [[x + Math.cos(a - 0.08) * 62, y + Math.sin(a - 0.08) * 62], [x + Math.cos(a) * 72, y + Math.sin(a) * 72], [x + Math.cos(a + 0.08) * 62, y + Math.sin(a + 0.08) * 62]], '#B98B52'); }
    ell(g, x, y, 63, 63, '#B98B52'); ell(g, x, y, 58, 58, '#d7e8e1');
    ell(g, x - 20, y + 14, 9, 9, 'rgba(120,150,150,.35)'); ell(g, x + 24, y - 20, 7, 7, 'rgba(120,150,150,.35)');
    g.strokeStyle = '#0b1424'; g.lineWidth = 2;
    for (let k = 0; k < 12; k++) { const a = k / 12 * 6.28; g.beginPath(); g.moveTo(x + Math.cos(a) * 50, y + Math.sin(a) * 50); g.lineTo(x + Math.cos(a) * (k % 3 ? 55 : 46), y + Math.sin(a) * (k % 3 ? 55 : 46)); g.stroke(); }
    const hand = (a, l, wd, c) => { g.strokeStyle = c; g.lineWidth = wd; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); g.stroke(); };
    hand(tm * 1.2, 42, 3, '#0b1424'); hand(tm * 14.4, 52, 1.5, '#E96A55');
    ell(g, x, y, 4, 4, '#E96A55');
  },
  'sky-door'(g, tm) {
    const x = 160, top = 24;
    for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(255,236,170,${0.06})`; poly(g, [[x - 20 + i * 5, top + 20], [x + 20 - i * 5, top + 20], [x + 60 - i * 15, HZ], [x - 60 + i * 15, HZ]], g.fillStyle); }
    px(g, x - 34, top + 14, 68, 106, '#7B493C'); poly(g, [[x - 34, top + 16], [x, top - 6], [x + 34, top + 16]], '#7B493C');
    const lg = g.createLinearGradient(0, top, 0, top + 110);
    lg.addColorStop(0, '#fff6d0'); lg.addColorStop(1, '#f2c58b');
    px(g, x - 26, top + 20, 52, 100, '#fff6d0'); g.fillStyle = lg; g.fillRect(x - 26, top + 20, 52, 100);
    g.beginPath(); g.arc(x, top + 20, 26, Math.PI, 0); g.fillStyle = lg; g.fill();
    for (let i = 0; i < 9; i++) {
      const sy = top + 118 + i * 5 + Math.sin(tm * 1.5 + i) * 1.5, sx = x - 26 - i * 9 + (i % 2) * 2;
      px(g, sx, sy, 34 - i, 4, '#2a1c22'); px(g, sx, sy, 34 - i, 1, '#B98B52');
    }
    px(g, x - 38, top + 118, 76, 4, '#2a1c22');
    px(g, x + 14, top + 66, 3, 3, '#B98B52');
  },
};

// ---- 天候の粒子（風向で動きが変わる） ----
function weather(g, w, p, tm, id) {
  const n = [90, 50, 28, 40][p] || 40;
  const R = rng(id + 500);
  for (let i = 0; i < n; i++) {
    const sx = R() * W, sy = R() * 150, sp = 20 + R() * 40;
    if (w === 0) { const y = (sy + tm * sp) % 160, x = (sx + tm * sp * 0.5) % W; px(g, x, y, 1, 4, 'rgba(180,220,230,.45)'); }
    else if (w === 1) { const x = ((sx - tm * sp * 1.5) % W + W) % W; px(g, x, sy, 6, 1, 'rgba(215,190,150,.4)'); }
    else if (w === 2) { const y = (((sy - tm * sp * 0.6) % 160) + 160) % 160; px(g, sx + Math.sin(tm + i) * 3, y, 2, 2, 'rgba(120,110,100,.55)'); }
    else if (i % 2 === 0) { px(g, sx + Math.sin(tm * 0.4 + i) * 2, sy + Math.cos(tm * 0.3 + i) * 2, 1, 1, 'rgba(215,232,225,.55)'); }
  }
}

// ---- 窓枠（鋼鉄の骨組み・割れたガラス・ケーブル） ----
function frame(g, tm) {
  const rust = '#7B493C', steel = '#1b2430', brass = '#B98B52';
  poly(g, [[0, 0], [18, 0], [11, H], [0, H]], steel); poly(g, [[W, 0], [W - 18, 0], [W - 11, H], [W, H]], steel);
  px(g, 0, 0, W, 9, steel); px(g, 0, H - 14, W, 14, steel);
  px(g, 0, 9, W, 1, rust); px(g, 0, H - 15, W, 1, brass);
  px(g, 0, H - 4, W, 4, '#0b1018');
  for (let x = 12; x < W - 8; x += 8) px(g, x, H - 11, 1, x % 32 === 12 ? 5 : 3, brass);
  [[5, 14], [5, 100], [W - 6, 14], [W - 6, 100], [60, 4], [260, 4]].forEach(([x, y]) => { px(g, x - 1, y - 1, 3, 3, brass); px(g, x, y, 1, 1, '#f2d9a8'); });
  px(g, 3, 40, 3, 30, rust); px(g, W - 6, 60, 3, 36, rust);
  g.strokeStyle = 'rgba(220,240,235,.4)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(W - 16, 12); g.lineTo(W - 56, 38); g.lineTo(W - 70, 36); g.moveTo(W - 56, 38); g.lineTo(W - 64, 74); g.moveTo(W - 56, 38); g.lineTo(W - 36, 62);
  g.moveTo(14, H - 18); g.lineTo(40, H - 44); g.lineTo(46, H - 70); g.moveTo(40, H - 44); g.lineTo(72, H - 48); g.stroke();
  g.strokeStyle = '#05080f'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(40, 9); g.quadraticCurveTo(80, 26 + Math.sin(tm) * 1, 130, 9); g.moveTo(190, 9); g.quadraticCurveTo(240, 30, 290, 9); g.stroke();
  const vg = g.createRadialGradient(W / 2, H / 2, 90, W / 2, H / 2, 210);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
}

// 1枚の絵を描く。tm は秒、withFrame=false で窓枠なし。
export function renderSky(g, id, tm = 0, withFrame = true) {
  const { t, w, p } = decode(id);
  g.imageSmoothingEnabled = false;
  g.drawImage(skyBase(t, p), 0, 0);
  const layers = staticLayers(id);
  const an = anomalyOf(id);
  if (an) {
    g.drawImage(layers.sky, 0, 0); // 星・雲は残すが、主役が上から覆う
    g.save(); ANOM[an.key](g, tm); g.restore();
  } else {
    g.drawImage(layers.sky, 0, 0);
  }
  if (an) g.drawImage(layers.city, 0, 36); else g.drawImage(layers.city, 0, 0); // 特異現象のときは街を低く沈めて主役を見せる
  weather(g, w, p, tm, id);
  if (an) { g.fillStyle = 'rgba(233,106,85,.07)'; g.fillRect(0, 0, W, H); }
  if (withFrame) frame(g, tm);
}
