// 空の描画（Canvas のみ）。解像度 320x200 のドット絵として描き、CSS で拡大する。
// 当たりごとに「背景の空」＋「部品（art）」を重ねて1枚にする。
export const W = 320;
export const H = 200;
const HZ = 150; // 地平線

// 背景の空（上→地平線の4色）
const SKIES = {
  dusk: ['#1a1030', '#7a2f5a', '#e0644a', '#f4a65a'],
  day: ['#2a7c9a', '#5fb0c0', '#a8dcd2', '#e0f0d8'],
  night: ['#050a18', '#0b1424', '#16304a', '#2a6971'],
  rain: ['#1d2633', '#33414f', '#4f5f68', '#77838a'],
  storm: ['#0c0f18', '#1f2433', '#353a4e', '#4c4a5c'],
  snow: ['#45526a', '#7d8aa0', '#b7c2cf', '#e3e8ee'],
  grey: ['#3e4652', '#68727c', '#9aa2a8', '#c4c8c8'],
  red: ['#1a0508', '#5a0f14', '#b8321e', '#f08a3a'],
  white: ['#fff3c8', '#fff8e0', '#ffffff', '#ffffff'],
  eclipse: ['#05060c', '#141a2a', '#27324a', '#4a3a3a'],
  black: ['#000000', '#000000', '#020203', '#040406'],
  cycle: ['#1a1030', '#7a2f5a', '#e0644a', '#f4a65a'],
};
const CYCLE = ['dusk', 'day', 'night', 'red', 'snow'];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, f) => a.map((v, i) => Math.round(v + (b[i] - v) * f));
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
const canvasOf = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };

const skyCache = new Map();
function skyBase(name) {
  if (skyCache.has(name)) return skyCache.get(name);
  const c = canvasOf();
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const stops = (SKIES[name] || SKIES.dusk).map(hex);
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
  skyCache.set(name, c);
  return c;
}

// 遠景の街（固定）
const cityCache = new Map();
function city(dark = '#1a1520') {
  if (cityCache.has(dark)) return cityCache.get(dark);
  const R = rng(42);
  const sk = canvasOf().getContext('2d');
  let x = -4;
  while (x < W) {
    const bw = 8 + Math.floor(R() * 18);
    const bh = 14 + Math.floor(R() * 44) * (R() > 0.82 ? 1.4 : 1);
    sk.fillStyle = dark;
    sk.fillRect(x, HZ - bh, bw, bh + 60);
    if (R() > 0.7) sk.fillRect(x + 3, HZ - bh - 8, 2, 8);
    if (R() > 0.75) { sk.fillStyle = '#05080f'; sk.fillRect(x + bw - 3, HZ - bh - 3, 3, 3); }
    for (let wy = HZ - bh + 4; wy < HZ - 2; wy += 6) {
      for (let wx = x + 2; wx < x + bw - 2; wx += 4) {
        if (R() > 0.9) { sk.fillStyle = R() > 0.5 ? '#B98B52' : '#2A6971'; sk.fillRect(wx, wy, 2, 2); }
      }
    }
    x += bw + (R() > 0.7 ? 3 + Math.floor(R() * 6) : 0);
  }
  const tx = 236;
  sk.strokeStyle = dark; sk.lineWidth = 1.5;
  sk.beginPath(); sk.moveTo(tx - 9, HZ + 8); sk.lineTo(tx - 2, HZ - 40); sk.lineTo(tx + 2, HZ - 40); sk.lineTo(tx + 9, HZ + 8);
  sk.moveTo(tx - 14, HZ - 32); sk.lineTo(tx + 14, HZ - 32); sk.moveTo(tx - 8, HZ - 18); sk.lineTo(tx + 8, HZ - 18); sk.stroke();
  sk.fillStyle = '#05080f'; sk.fillRect(0, HZ + 6, W, H);
  cityCache.set(dark, sk.canvas);
  return sk.canvas;
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


// ---- 部品（art） ----
const glowAt = (g, x, y, r0, r1, rgba) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); gr.addColorStop(0, rgba); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
function cloudBlob(g, cx, cy, len, hgt, col) {
  for (let row = 0; row < hgt; row += 2) {
    const u = row / hgt * 2 - 1;
    const f = Math.sqrt(Math.max(0.05, 1 - u * u)) * (0.85 + 0.15 * Math.sin(row * 1.7 + cx));
    const l = len * f;
    px(g, cx - l / 2, cy + row, l, 2, col);
  }
}
function catHead(g, x, y, r, col, eye = '#f2d06a') {
  ell(g, x, y, r, r * 0.85, col);
  poly(g, [[x - r * 0.95, y - r * 0.2], [x - r * 0.75, y - r * 1.25], [x - r * 0.25, y - r * 0.75]], col);
  poly(g, [[x + r * 0.95, y - r * 0.2], [x + r * 0.75, y - r * 1.25], [x + r * 0.25, y - r * 0.75]], col);
  ell(g, x - r * 0.38, y - r * 0.05, r * 0.16, r * 0.2, eye); ell(g, x + r * 0.38, y - r * 0.05, r * 0.16, r * 0.2, eye);
  px(g, x - r * 0.4, y - r * 0.2, Math.max(1, r * 0.05), r * 0.32, '#0b1424'); px(g, x + r * 0.36, y - r * 0.2, Math.max(1, r * 0.05), r * 0.32, '#0b1424');
  poly(g, [[x - r * 0.08, y + r * 0.2], [x + r * 0.08, y + r * 0.2], [x, y + r * 0.3]], '#e48a8a');
}
function catBody(g, x, y, s, col, tm = 0) {
  ell(g, x, y, 9 * s, 6 * s, col); catHead(g, x + 9 * s, y - 5 * s, 5 * s, col);
  g.strokeStyle = col; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(x - 8 * s, y); g.quadraticCurveTo(x - 16 * s, y - 8 * s + Math.sin(tm * 3) * 2, x - 13 * s, y - 14 * s); g.stroke();
}
function frog(g, x, y, s, up = false) {
  const c = '#5fae4a';
  ell(g, x, y, 7 * s, 5 * s, c); ell(g, x - 4 * s, y - 4 * s * (up ? -1 : 1), 2.4 * s, 2.4 * s, c); ell(g, x + 4 * s, y - 4 * s * (up ? -1 : 1), 2.4 * s, 2.4 * s, c);
  ell(g, x - 4 * s, y - 4 * s * (up ? -1 : 1), 1.2 * s, 1.2 * s, '#0b1424'); ell(g, x + 4 * s, y - 4 * s * (up ? -1 : 1), 1.2 * s, 1.2 * s, '#0b1424');
  ell(g, x, y + (up ? -1 : 1) * 1.5 * s, 4 * s, 2.5 * s, '#cfe8a8');
  if (up) { px(g, x - 7 * s, y - 7 * s, 2 * s, 4 * s, c); px(g, x + 5 * s, y - 7 * s, 2 * s, 4 * s, c); }
}
function rabbit(g, x, y, s, col = '#f4f1ea') {
  ell(g, x, y, 5 * s, 6 * s, col); ell(g, x + 3 * s, y - 7 * s, 3.5 * s, 3 * s, col);
  ell(g, x + 2 * s, y - 13 * s, 1.2 * s, 4 * s, col, -0.2); ell(g, x + 5 * s, y - 13 * s, 1.2 * s, 4 * s, col, 0.25);
  px(g, x + 4.5 * s, y - 8 * s, 1, 1, '#c03040');
}
function futon(g, x, y, w, h, rot, col, pat) {
  g.save(); g.translate(x, y); g.rotate(rot);
  px(g, -w / 2, -h / 2, w, h, col);
  for (let i = -w / 2 + 3; i < w / 2 - 2; i += 6) for (let j = -h / 2 + 3; j < h / 2 - 2; j += 6) px(g, i, j, 2, 2, pat);
  px(g, -w / 2, -h / 2, w, 2, 'rgba(255,255,255,.35)');
  g.restore();
}

const ART = {
  rain(g, tm, lv = 1, tone) {
    const n = [0, 60, 130, 260][lv] || 60; const R = rng(9 + lv); const col = tone === 'dark' ? 'rgba(60,90,130,.7)' : 'rgba(190,215,230,.55)';
    for (let i = 0; i < n * (tone === 'dark' ? 1.5 : 1); i++) { const sx = R() * W, sp = 60 + R() * 80; const y = (R() * 200 + tm * sp) % 170 - 10; px(g, sx + y * 0.15, y, 1, 3 + lv * 2, col); }
  },
  snow(g, tm, lv = 1, fire) {
    const n = [0, 70, 120, 220][lv] || 70; const R = rng(33 + lv);
    for (let i = 0; i < n; i++) {
      const sx = R() * W, sp = 8 + R() * 14; const y = (R() * 200 + tm * sp) % 160 - 5; const x = sx + Math.sin(tm + i) * 4;
      if (fire) { const f = y / 150; px(g, x, y, 2, 2, f > 0.7 ? 'rgba(255,120,60,.9)' : 'rgba(255,255,255,.9)'); if (f > 0.7) px(g, x, y - 3, 1, 3, 'rgba(255,200,80,.6)'); }
      else px(g, x, y, R() > 0.7 ? 2 : 1, R() > 0.7 ? 2 : 1, 'rgba(255,255,255,.9)');
    }
  },
  snowpile(g) {
    g.fillStyle = '#f0f4f8'; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 8) g.lineTo(x, 150 - Math.sin(x / 23) * 6 - Math.sin(x / 7) * 2); g.lineTo(W, H); g.fill();
    px(g, 0, 160, W, 40, '#e3e8ee');
  },
  bolt(g, tm, n = 1, up) {
    const R = rng(77 + n); const flash = (Math.floor(tm * 3) % 4) === 0;
    if (flash) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, 0, W, H); }
    for (let i = 0; i < n; i++) {
      let x = 30 + R() * 260, y = up ? HZ : 0; const pts = [[x, y]];
      while (up ? y > 0 : y < HZ) { y += (up ? -1 : 1) * (10 + R() * 14); x += (R() - 0.5) * 22; pts.push([x, y]); }
      g.strokeStyle = 'rgba(200,220,255,.5)'; g.lineWidth = 4; g.beginPath(); pts.forEach(([a, b], k) => (k ? g.lineTo(a, b) : g.moveTo(a, b))); g.stroke();
      g.strokeStyle = '#fffbe8'; g.lineWidth = 1.5; g.stroke();
    }
  },
  rainbow(g, tm, n = 1) {
    const cols = ['#e2453c', '#f08a3a', '#f4d34a', '#5fbf5a', '#3a8fd0', '#4a5ac0', '#8a4ab0'];
    const R = rng(5 + n);
    for (let k = 0; k < n; k++) {
      const cx = n === 1 ? 160 : 40 + R() * 240, cy = 168 + (k === 1 && n === 2 ? 0 : 0), base = n === 2 ? 150 - k * 34 : n === 1 ? 140 : 60 + R() * 70;
      cols.forEach((c, i) => { g.strokeStyle = c; g.globalAlpha = 0.75; g.lineWidth = n > 2 ? 3 : 5; g.beginPath(); g.arc(cx, cy, base - i * (n > 2 ? 3 : 5), Math.PI, 0); g.stroke(); });
      g.globalAlpha = 1;
    }
  },
  fog(g, tm) {
    for (let i = 0; i < 9; i++) { const y = 60 + i * 14; g.fillStyle = `rgba(220,226,230,${0.18 + i * 0.05})`; g.fillRect(((tm * (6 + i)) % 40) - 40, y, W + 80, 18); }
  },
  moon(g, tm, v) {
    if (v === 'fall') { const r = 54 + Math.sin(tm) * 2; glowAt(g, 160, 70, r, r * 2.2, 'rgba(255,120,80,.4)'); ell(g, 160, 70, r, r, '#e7d8c4'); [[-20, -14, 10], [18, 8, 14], [-6, 26, 7], [26, -24, 6]].forEach(([a, b, c]) => ell(g, 160 + a, 70 + b, c, c, '#c9b8a4')); return; }
    if (v === 'big') { glowAt(g, 160, 74, 50, 120, 'rgba(215,232,225,.35)'); ell(g, 160, 74, 58, 58, '#e3ece6'); [[-22, -16, 11], [20, 10, 15], [-4, 28, 8], [28, -26, 6], [-34, 14, 5]].forEach(([a, b, c]) => ell(g, 160 + a, 74 + b, c, c, '#c2d0ca')); return; }
    if (v === 'black') { glowAt(g, 160, 64, 26, 70, 'rgba(200,60,40,.45)'); ell(g, 160, 64, 30, 30, '#8a2a20'); ell(g, 160, 64, 28, 28, '#1a0a0c'); return; }
    const list = v === 2 ? [[110, 58, 22], [212, 44, 16]] : [[160, 56, 24]];
    list.forEach(([x, y, r]) => { glowAt(g, x, y, r, r * 3, 'rgba(215,232,225,.35)'); ell(g, x, y, r, r, '#e3ece6'); ell(g, x - r * 0.3, y - r * 0.2, r * 0.22, r * 0.22, '#c2d0ca'); ell(g, x + r * 0.35, y + r * 0.3, r * 0.3, r * 0.3, '#c2d0ca'); });
  },
  sun(g, tm, v) {
    if (v === 'big') { glowAt(g, 160, 90, 60, 200, 'rgba(255,240,180,.9)'); ell(g, 160, 90, 90, 90, '#fffbe8'); return; }
    if (v === 'black') { glowAt(g, 160, 60, 26, 80, 'rgba(255,240,220,.6)'); g.strokeStyle = 'rgba(255,250,230,.8)'; for (let k = 0; k < 24; k++) { const a = k / 24 * 6.28 + tm * 0.05; g.beginPath(); g.moveTo(160 + Math.cos(a) * 28, 60 + Math.sin(a) * 28); g.lineTo(160 + Math.cos(a) * (40 + (k % 3) * 8), 60 + Math.sin(a) * (40 + (k % 3) * 8)); g.stroke(); } ell(g, 160, 60, 27, 27, '#05060c'); return; }
    if (v === 'fall') { glowAt(g, 160, 120, 30, 170, 'rgba(255,90,40,.55)'); return; }
    glowAt(g, 230, 96, 14, 70, 'rgba(255,220,160,.5)'); ell(g, 230, 96, 18, 18, '#ffd27a');
  },
  stars(g, tm, lv = 1) {
    const R = rng(21); const n = [0, 50, 110, 220][lv];
    for (let i = 0; i < n; i++) { const tw = Math.sin(tm * 2 + i) > 0.6; px(g, R() * W, R() * 130, tw ? 2 : 1, tw ? 2 : 1, R() > 0.8 ? '#fff6d0' : '#a9c4c4'); }
  },
  milky(g) { const R = rng(4); for (let i = 0; i < 500; i++) { const t = R(); const x = t * W, y = 120 - t * 100 + (R() - 0.5) * 30 * (1 - Math.abs(t - 0.5)); px(g, x, y, 1, 1, R() > 0.5 ? 'rgba(230,220,255,.8)' : 'rgba(170,200,230,.6)'); } glowAt(g, 160, 70, 10, 120, 'rgba(180,170,230,.18)'); },
  meteor(g, tm) { const R = rng(12); for (let i = 0; i < 9; i++) { const p = ((tm * 0.6 + R()) % 1); const x = 330 - p * 260 - R() * 80, y = -10 + p * 120 + R() * 30; g.strokeStyle = 'rgba(255,250,220,.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 26, y - 12); g.stroke(); px(g, x - 1, y - 1, 2, 2, '#fff'); } },
  starSea(g, tm) { px(g, 0, 120, W, 80, '#0b1830'); const R = rng(13); for (let i = 0; i < 120; i++) px(g, R() * W + Math.sin(tm + i) * 2, 122 + R() * 70, 1, 1, R() > 0.7 ? '#fff6d0' : '#7fa3c6'); px(g, 0, 120, W, 1, 'rgba(255,255,255,.4)'); },
  cloud(g, tm, lv = 2) { const R = rng(3); for (let i = 0; i < 4 + lv * 3; i++) cloudBlob(g, ((R() * W + tm * 4) % (W + 80)) - 40, 15 + R() * 90, 60 + R() * 70, 10 + R() * 10, R() > 0.5 ? 'rgba(210,214,220,.85)' : 'rgba(160,166,176,.85)'); },
  bigCloud(g, tm) { const c = '#f4f6f6', s = '#cfd8dc'; [[160, 100, 70], [110, 112, 46], [212, 112, 50], [150, 60, 46], [178, 36, 34], [132, 84, 40]].forEach(([x, y, r]) => { ell(g, x, y + 4, r, r * 0.8, s); ell(g, x, y, r, r * 0.8, c); }); },
  fireCloud(g, tm) { const R = rng(17); for (let i = 0; i < 9; i++) { const x = 20 + i * 36, y = 40 + R() * 50; cloudBlob(g, x, y, 70, 18, '#5a2020'); for (let k = 0; k < 10; k++) { const fx = x - 30 + k * 6, f = (Math.sin(tm * 6 + k + i) + 1) / 2; poly(g, [[fx - 3, y + 2], [fx, y - 8 - f * 10], [fx + 3, y + 2]], k % 2 ? '#E96A55' : '#f4a65a'); } } },
  flood(g, tm) { const lv = 108; g.fillStyle = 'rgba(30,70,90,.82)'; g.fillRect(0, lv, W, H); for (let x = 0; x < W; x += 6) px(g, x, lv + Math.sin(x / 10 + tm * 2) * 1.5, 4, 1, 'rgba(200,230,240,.7)'); const R = rng(8); for (let i = 0; i < 6; i++) fish(g, ((R() * W + tm * 10) % W), lv + 20 + R() * 40, 1, 'rgba(160,210,210,.7)', 1); },
  invertedCity(g, tm) {
    g.save(); g.translate(0, 152 + Math.sin(tm) * 2); g.scale(1, -1); g.drawImage(city('#2a1a2a'), 0, 0); g.restore();
    for (let i = 0; i < 20; i++) px(g, 10 + i * 16, 60 + ((i * 7) % 20), 1, 1, '#f2d06a');
  },
  fishRain(g, tm) { const R = rng(19); for (let i = 0; i < 46; i++) { const sx = R() * W, sp = 30 + R() * 40; const y = (R() * 200 + tm * sp) % 170 - 10; g.save(); g.translate(sx, y); g.rotate(1.3); fish(g, 0, 0, 1 + R() * 0.6, R() > 0.5 ? '#c8d8d4' : '#9fc0c8', 1); g.restore(); } },
  whale(g, tm, v) {
    const draw = (x, y, s, col, belly) => {
      ell(g, x, y, 60 * s, 18 * s, col);
      poly(g, [[x + 52 * s, y - 4 * s], [x + 80 * s, y - 24 * s + Math.sin(tm * 1.5) * 3], [x + 74 * s, y], [x + 84 * s, y + 14 * s], [x + 52 * s, y + 6 * s]], col);
      poly(g, [[x - 6 * s, y + 12 * s], [x - 20 * s, y + 30 * s], [x + 12 * s, y + 14 * s]], col);
      ell(g, x - 10 * s, y + 8 * s, 44 * s, 7 * s, belly); ell(g, x - 42 * s, y - 3 * s, 1.6 * s, 1.6 * s, '#e8d9b8');
    };
    const y = 70 + Math.sin(tm * 0.9) * 5;
    if (v === 'cloud') { draw(150, y, 1.4, 'rgba(240,244,246,.95)', 'rgba(200,210,220,.9)'); for (let i = 0; i < 8; i++) ell(g, 90 + i * 22, y - 22 + (i % 2) * 4, 12, 8, 'rgba(240,244,246,.95)'); return; }
    draw(140, y, 1.3, '#26203a', '#4a3a5a');
    if (v === 2) draw(250 - Math.sin(tm) * 4, y + 40, 0.75, '#2e2846', '#5a4a6a');
  },
  catRain(g, tm) { const R = rng(23); for (let i = 0; i < 22; i++) { const sx = 20 + R() * 280, sp = 20 + R() * 20; const y = (R() * 200 + tm * sp) % 180 - 20; g.save(); g.translate(sx, y); g.rotate(Math.sin(tm * 2 + i) * 0.4); catBody(g, 0, 0, 1.1 + R() * 0.5, ['#e8a24a', '#2a2a2a', '#f2efe8', '#8a8a8a'][i % 4], tm + i); g.restore(); } },
  catEye(g, tm) {
    const open = 0.5 + 0.5 * Math.abs(Math.sin(tm * 0.8)); const pw = 3 + 10 * (1 - open);
    glowAt(g, 160, 66, 30, 120, 'rgba(242,208,106,.35)');
    ell(g, 160, 66, 70, 36, '#1a1012'); ell(g, 160, 66, 64, 31, '#e8b23a'); ell(g, 160, 66, 46, 26, '#f2d06a');
    ell(g, 160, 66, pw, 30, '#0b0a0a'); ell(g, 144, 54, 6, 4, 'rgba(255,255,255,.8)');
  },
  catRoof(g, tm) { catBody(g, 60, 146, 1, '#1a1520', tm); },
  catGiant(g, tm) {
    const y = 104 + Math.sin(tm * 0.8) * 3; const c = '#2a2a33';
    catHead(g, 160, y, 82, c, '#f2d06a');
    const blink = (Math.floor(tm * 0.5) % 6) === 0; if (blink) { px(g, 112, y - 22, 34, 18, c); px(g, 174, y - 22, 34, 18, c); }
    g.strokeStyle = 'rgba(230,230,230,.7)'; g.lineWidth = 1; [[-1, 1], [1, 1]].forEach(([d]) => { for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(160 + d * 30, y + 20 + k * 6); g.lineTo(160 + d * 110, y + 10 + k * 14); g.stroke(); } });
  },
  catMoon(g, tm) {
    const mx = 170 + Math.sin(tm * 0.8) * 30, my = 70;
    ell(g, mx, my, 26, 26, '#e3ece6'); g.strokeStyle = 'rgba(230,200,200,.8)'; g.lineWidth = 1;
    for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(mx, my, 26, k * 0.9 + tm, k * 0.9 + tm + 1.6); g.stroke(); }
    g.strokeStyle = '#e3ece6'; g.beginPath(); g.moveTo(mx - 20, my + 18); g.quadraticCurveTo(mx - 60, my + 60, 60, 130); g.stroke();
    catBody(g, 70, 120, 2.2, '#16121c', tm);
    poly(g, [[100, 100], [mx - 30 + Math.sin(tm * 3) * 6, my + 10], [mx - 24, my + 20], [104, 110]], '#16121c');
  },
  catChase(g, tm) {
    const R = rng(29); for (let i = 0; i < 14; i++) fish(g, ((R() * 140 + tm * 40) % (W + 60)) - 30 + 100, 50 + R() * 40, 1.4, '#c8e0dc', 1);
    const x = ((tm * 40) % (W + 60)) - 40; cloudBlob(g, x + 10, 104, 80, 12, 'rgba(240,244,246,.9)');
    catBody(g, x, 96 + Math.abs(Math.sin(tm * 6)) * -6, 1.6, '#e8a24a', tm);
  },
  maneki(g, tm) {
    cloudBlob(g, 150, 18, 220, 26, 'rgba(240,244,246,.95)');
    g.save(); g.translate(170, 30); g.rotate(Math.sin(tm * 3) * 0.35);
    px(g, -18, 0, 36, 70, '#f6f2ea'); ell(g, 0, 74, 22, 20, '#f6f2ea');
    ell(g, 0, 78, 9, 8, '#f0a0a8'); [-14, -5, 5, 14].forEach((d) => ell(g, d, 60, 4, 4, '#f0a0a8'));
    px(g, -18, 0, 3, 70, '#d8d0c4'); g.restore();
    ell(g, 60, 40, 10, 10, '#f2c94a'); px(g, 56, 38, 8, 2, '#c9a030');
  },
  rabbitMochi(g, tm) {
    const up = Math.sin(tm * 4) > 0;
    px(g, 148, 90, 22, 12, '#8a5a3a'); ell(g, 159, 90, 11, 3, '#f6f2ea');
    rabbit(g, 136, 84, 1.3); rabbit(g, 186, 84, 1.3);
    g.strokeStyle = '#6a4a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(180, 74); g.lineTo(up ? 166 : 162, up ? 60 : 82); g.stroke(); px(g, up ? 160 : 156, up ? 54 : 80, 12, 6, '#6a4a2a');
  },
  dango(g) {
    poly(g, [[240, 150], [290, 150], [284, 140], [246, 140]], '#c9a06a'); px(g, 246, 136, 38, 4, '#e0c090');
    [[252, 130], [264, 130], [276, 130], [258, 120], [270, 120], [264, 110]].forEach(([x, y]) => { ell(g, x, y, 6, 6, '#f6f2ea'); px(g, x - 2, y - 3, 2, 2, '#ffffff'); });
  },
  futonHung(g, tm) {
    g.strokeStyle = '#3a3a3a'; g.lineWidth = 1; [40, 90].forEach((y) => { g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(160, y + 14, W, y); g.stroke(); });
    const cols = [['#e8a0a8', '#fff'], ['#7ab0e0', '#fff'], ['#f2d06a', '#c08030'], ['#9ad08a', '#fff']];
    for (let i = 0; i < 6; i++) { const x = 30 + i * 52, y = 40 + 6 * Math.sin((i / 5) * Math.PI); const [c, p] = cols[i % 4]; futon(g, x, y + 14, 40, 26, Math.sin(tm * 2 + i) * 0.05, c, p); }
    for (let i = 0; i < 5; i++) { const x = 55 + i * 52, y = 90 + 6 * Math.sin((i / 4) * Math.PI); const [c, p] = cols[(i + 2) % 4]; futon(g, x, y + 14, 40, 26, Math.sin(tm * 2 + i + 1) * 0.05, c, p); }
  },
  futonFly(g, tm) {
    const R = rng(31); const cols = [['#e8a0a8', '#fff'], ['#7ab0e0', '#fff'], ['#f2d06a', '#c08030'], ['#9ad08a', '#fff']];
    for (let i = 0; i < 9; i++) { const p = (tm * (0.2 + R() * 0.15) + R()) % 1; const x = -40 + p * 400, y = 130 - p * 110 + Math.sin(p * 9 + i) * 10; const [c, pt] = cols[i % 4]; futon(g, x, y, 36, 22, p * 8 + i, c, pt); }
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1; for (let i = 0; i < 12; i++) { const y = 20 + i * 10; g.beginPath(); g.moveTo(((tm * 120 + i * 50) % 360) - 40, y); g.lineTo(((tm * 120 + i * 50) % 360) - 10, y - 4); g.stroke(); }
  },
  spears(g, tm) { const R = rng(37); for (let i = 0; i < 40; i++) { const sx = R() * W, sp = 50 + R() * 50; const y = (R() * 200 + tm * sp) % 190 - 30; g.strokeStyle = '#6a5040'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(sx, y); g.lineTo(sx - 6, y - 28); g.stroke(); poly(g, [[sx - 2, y - 2], [sx + 2, y - 1], [sx + 2, y + 8]], '#d8e0e6'); } for (let i = 0; i < 10; i++) { const x = 15 + i * 31; g.strokeStyle = '#6a5040'; g.beginPath(); g.moveTo(x, 156); g.lineTo(x - 3, 140); g.stroke(); } },
  frogs(g, tm) { cloudBlob(g, 160, 40, 240, 22, 'rgba(110,118,130,.95)'); for (let i = 0; i < 7; i++) frog(g, 70 + i * 30, 40 + Math.abs(Math.sin(tm * 4 + i)) * -3, 1.1); for (let i = 0; i < 6; i++) { const x = 60 + i * 40 + Math.sin(tm + i) * 6, y = 24 - ((tm * 12 + i * 8) % 22); px(g, x, y, 1, 6, '#e8f0e0'); ell(g, x - 1, y + 6, 2, 1.6, '#e8f0e0'); } },
  frogUp(g, tm) { frog(g, 160, 70 + Math.sin(tm) * 6, 4, true); for (let i = 0; i < 5; i++) ell(g, 120 + i * 20, 40 - ((tm * 10 + i * 7) % 20), 2, 2, 'rgba(255,255,255,.6)'); },
  foxWedding(g, tm) {
    const R = rng(41);
    for (let i = 0; i < 14; i++) { const p = ((tm * 0.05 + i / 14) % 1); const x = 20 + p * 280, y = 100 - Math.sin(p * Math.PI) * 60; ell(g, x, y, 3, 4, '#f6f2ea'); poly(g, [[x - 3, y - 3], [x - 2, y - 8], [x, y - 4]], '#f6f2ea'); poly(g, [[x + 3, y - 3], [x + 2, y - 8], [x, y - 4]], '#f6f2ea'); glowAt(g, x + 6, y - 2, 1, 10, 'rgba(255,140,60,.35)'); ell(g, x + 6, y - 2, 2.5, 3, '#ff8a3a'); }
  },
  sunSink(g, tm) {
    const y = 132 + Math.sin(tm * 0.7) * 2;
    ell(g, 160, y, 40, 40, '#ff7a3a'); ell(g, 160, y, 31, 31, '#ffd27a');
    px(g, 0, 156, W, 44, '#05080f');
    g.save(); g.beginPath(); g.rect(0, 156, W, 44); g.clip(); ell(g, 160, y + 6, 40, 40, 'rgba(255,90,40,.35)'); g.restore();
    g.strokeStyle = '#ff9a4a'; g.lineWidth = 1.5; [[120, 160, 90, 190], [200, 160, 236, 196], [160, 172, 162, 200]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo((a + c) / 2 + 4, (b + d) / 2); g.lineTo(c, d); g.stroke(); });
  },
  blackout(g) { g.fillStyle = 'rgba(0,0,0,.94)'; g.fillRect(0, 0, W, H); },
  candle(g, tm) {
    const f = Math.sin(tm * 9) * 0.6; glowAt(g, 160, 150, 4, 70, 'rgba(255,190,90,.35)');
    px(g, 155, 156, 10, 26, '#e8dcc0'); px(g, 159, 152, 2, 4, '#2a2418');
    ell(g, 160 + f, 146, 3, 6, '#ffb84a'); ell(g, 160 + f, 147, 1.5, 3, '#fff2c0');
  },
  // 互換：前の版の特異現象の絵
  invertedSea: (g, tm) => ANOM['inverted-sea'](g, tm), doubleSun: (g, tm) => ANOM['double-sun'](g, tm), eye: (g, tm) => ANOM.eye(g, tm),
  fallingCity: (g, tm) => ANOM['falling-city'](g, tm), fishCloud: (g, tm) => ANOM['fish-cloud'](g, tm), blackRainbow: (g, tm) => ANOM['black-rainbow'](g, tm),
  forbiddenMoon: (g, tm) => ANOM['forbidden-moon'](g, tm), hand: (g, tm) => ANOM['giant-hand'](g, tm), burningWhale: (g, tm) => ANOM['burning-whale'](g, tm),
};
// 街より手前に描く部品（降るもの・水・雪など）
const FRONT = new Set(['candle', 'rain', 'snow', 'snowpile', 'flood', 'fishRain', 'catRain', 'spears', 'fog', 'catRoof', 'dango', 'blackout', 'starSea', 'sunSink']);
// 大きな主役が地平線近くにあるときは、街を低く沈めて主役を見せる
const LOWCITY = new Set(['eye', 'hand', 'catGiant', 'invertedSea', 'fallingCity', 'sunSink']);
const POST = new Set(['flip', 'double', 'zoom']);
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


// 1枚の絵を描く。recipe=null は「何も起きていない空」。tm は秒、withFrame=false で窓枠なし。
export function renderSky(g, recipe, tm = 0, withFrame = true) {
  g.imageSmoothingEnabled = false;
  let skyName = recipe ? recipe.sky : 'dusk';
  if (skyName === 'cycle') skyName = CYCLE[Math.floor(tm / 1.2) % CYCLE.length];
  g.drawImage(skyBase(skyName), 0, 0);
  const arts = (recipe ? recipe.art : ['sun']).map((a) => { const [name, ...args] = a.split(':'); return { name, args: args.map((v) => (/^\d+$/.test(v) ? Number(v) : v)) }; });
  const run = (front) => arts.forEach(({ name, args }) => { if (POST.has(name) || FRONT.has(name) !== front || !ART[name]) return; g.save(); ART[name](g, tm, ...args); g.restore(); });
  run(false);
  const low = arts.some((a) => LOWCITY.has(a.name));
  g.drawImage(city(skyName === 'night' || skyName === 'eclipse' ? '#0B1424' : '#1a1520'), 0, low ? 36 : 0);
  run(true);
  if (arts.some((a) => a.name === 'double')) { const c = canvasOf(); c.getContext('2d').drawImage(g.canvas, 0, 0, W, H, 0, 0, W, H); g.globalAlpha = 0.5; g.drawImage(c, -26, -10); g.drawImage(c, 26, 6); g.globalAlpha = 1; }
  if (arts.some((a) => a.name === 'zoom')) { const c = canvasOf(); c.getContext('2d').drawImage(g.canvas, 0, 0, W, H, 0, 0, W, H); g.drawImage(c, 170, 60, 110, 70, 0, 0, W, H); }
  if (arts.some((a) => a.name === 'flip')) { const c = canvasOf(); c.getContext('2d').drawImage(g.canvas, 0, 0, W, H, 0, 0, W, H); g.save(); g.translate(0, H); g.scale(1, -1); g.drawImage(c, 0, 0); g.restore(); }
  if (recipe && recipe.kind !== 'more') { g.fillStyle = 'rgba(233,106,85,.05)'; g.fillRect(0, 0, W, H); }
  if (withFrame) frame(g, tm);
}
