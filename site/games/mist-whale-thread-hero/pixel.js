// ドット絵の道具：にじみのない図形、色をパレットに寄せる、1ドットの縁取り。
export const PALETTE = [
  // 共通
  '#120c1c', '#2a2238', '#4a4060', '#f4f1e8', '#ffffff',
  // 主人公
  '#1f6f78', '#124550', '#3fb5a8', '#8fe0d0', '#d8283c', '#8e1426', '#ff6b6b', '#f0b030', '#ffe27a', '#a8641c',
  '#ffd2b0', '#e09a7a', '#e8eef6', '#9aa8c0', '#2b3a6a', '#1c264a', '#6a4630', '#3a2a2a',
  // 第一章：夜明けの雲海と鯨の背
  '#163a5a', '#1f5a78', '#2f8296', '#5fb0b0', '#f0c8a0', '#f49a7a', '#ffd890', '#ffb070', '#e0b8b0',
  '#9fc0d4', '#7896b4', '#d6e8f0', '#56708e', '#e8e0cc', '#b0a890', '#4fb08a', '#2f7a68', '#c86848',
  // 第二章：鯨の腹の下の光る森
  '#06120e', '#0a1f18', '#103026', '#184a38', '#2fa06a', '#1b6a4a', '#5ff0d0', '#3fd8d0', '#c8ff9a', '#0c2a20', '#0e1c2a', '#7a5ad0',
  // 第三章：夢の底（深紅と骨と金の縫い目）
  '#0a0408', '#1e0610', '#3a0a18', '#6a1424', '#a82038', '#e8dcc8', '#b8a890', '#7a6a5a', '#ff4a5a', '#ffd0c0',
  // 敵など
  '#e8503a', '#ff8a3a', '#ffd36a', '#c9963a', '#bfe4ff', '#4f8ac4', '#ff2a1a', '#a06ad6', '#2a1440', '#ff5a8a', '#7fc8e8', '#1a3a5a',
];
const RGB = PALETTE.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
let LUT = null;
function buildLut() {
  LUT = new Uint32Array(32768);
  for (let i = 0; i < 32768; i++) {
    const r = ((i >> 10) & 31) * 8 + 4; const g = ((i >> 5) & 31) * 8 + 4; const b = (i & 31) * 8 + 4;
    let best = 0; let bd = Infinity;
    for (let k = 0; k < RGB.length; k++) {
      const [pr, pg, pb] = RGB[k]; const rm = (r + pr) / 2;
      const d = (2 + rm / 256) * (r - pr) ** 2 + 4 * (g - pg) ** 2 + (2 + (255 - rm) / 256) * (b - pb) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    const [pr, pg, pb] = RGB[best];
    LUT[i] = (255 << 24) | (pb << 16) | (pg << 8) | pr;
  }
}
const hexToInt = (h) => { const r = parseInt(h.slice(1, 3), 16); const g = parseInt(h.slice(3, 5), 16); const b = parseInt(h.slice(5, 7), 16); return (255 << 24) | (b << 16) | (g << 8) | r; };

// にじみを消し、色をパレットに寄せ、縁取りする
export function crisp(g, w, h, { outline = '#120c1c', inner = null } = {}) {
  if (!LUT) buildLut();
  const img = g.getImageData(0, 0, w, h);
  const d = img.data; const px = new Uint32Array(d.buffer);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (d[o + 3] < 128) { px[i] = 0; continue; }
    px[i] = LUT[((d[o] >> 3) << 10) | ((d[o + 1] >> 3) << 5) | (d[o + 2] >> 3)];
  }
  if (outline) {
    const oc = hexToInt(outline); const src = px.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (src[i]) continue;
        if ((x > 0 && src[i - 1]) || (x < w - 1 && src[i + 1]) || (y > 0 && src[i - w]) || (y < h - 1 && src[i + w])) px[i] = oc;
      }
    }
  }
  g.putImageData(img, 0, 0);
  if (inner) inner(g);
}

export function makeSprite(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  draw(g);
  crisp(g, w, h, opts);
  return c;
}

// にじみのない図形
export function pxRect(ctx, x, y, w, h) { ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
export function pxEllipse(ctx, cx, cy, rx, ry) {
  cx = Math.round(cx); cy = Math.round(cy);
  const R = Math.max(1, Math.round(ry));
  for (let y = -R; y <= R; y++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / (ry + 0.5)) ** 2)));
    if (hw > 0) ctx.fillRect(cx - hw, cy + y, hw * 2, 1);
  }
}
// 上半分だけ（雲や丘）
export function pxDome(ctx, cx, base, rx, ry) {
  cx = Math.round(cx); base = Math.round(base);
  for (let y = 0; y <= ry; y++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / (ry + 0.5)) ** 2)));
    if (hw > 0) ctx.fillRect(cx - hw, base - y, hw * 2, 1);
  }
}
export function pxLine(ctx, x0, y0, x1, y1, wd = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0); const dy = Math.abs(y1 - y0); const sx = x0 < x1 ? 1 : -1; const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy; let n = 0;
  const o = Math.floor(wd / 2);
  while (n++ < 2000) {
    ctx.fillRect(x0 - o, y0 - o, wd, wd);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}
// 2色の市松（ディザ）帯
export function pxDither(ctx, x, y, w, h, color, phase = 0) {
  ctx.fillStyle = color;
  for (let yy = 0; yy < h; yy++) for (let xx = (yy + phase) & 1; xx < w; xx += 2) ctx.fillRect(x + xx, y + yy, 1, 1);
}

// 小さなキャンバスに描いてドットにする（星座ノートや結果画面）
export function pixelCanvas(canvas, draw) {
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, canvas.width, canvas.height);
  draw(g);
}
