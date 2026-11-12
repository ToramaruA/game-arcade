// レトロなドット絵の仕上げ：限られた色数のパレットへ寄せ、4×4のディザをかける。
export const PALETTE = [
  '#0b0716', '#1a0f2e', '#2a1748', '#3d2263', '#57327f', '#7a4a9e', '#a070c0', '#c9a4e0', '#ecdcf7', '#ffffff',
  '#0f1a3d', '#1d3263', '#2f5a96', '#4f8ac4', '#8cc4ea', '#d0eefa',
  '#123d3a', '#1e6b5e', '#3fa07c', '#7fd07a', '#c4ec8e',
  '#3b2010', '#6b3e18', '#a0661e', '#d89a2c', '#f2c552', '#ffe68a', '#fff6c8',
  '#3a0a1e', '#6e1428', '#b0202e', '#e0313f', '#ff6a6a', '#ffa8b8',
  '#ffe0c8', '#f2b896', '#c47f62',
  '#8a2a6a', '#c24a8a', '#6c6286', '#9d94b8', '#d4cee6', '#ff8a3a',
  '#efe8f3', '#c7b6dc', '#8d73b4', '#2d2142', '#272052', '#4f9a69', '#8fd17e', '#e8dff4', '#b9a6d6',
];
const RGB = PALETTE.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
let LUT = null; // 15bit の色 → パレットの RGB を詰めた 32bit
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
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v / 16 - 0.47) * 11);

export function pixelPost(ctx, w, h) {
  if (!LUT) buildLut();
  if (w < 1 || h < 1) return;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data; const out = new Uint32Array(d.buffer);
  for (let y = 0; y < h; y++) {
    const row = (y & 3) * 4;
    for (let x = 0; x < w; x++) {
      const i = y * w + x; const o = i * 4;
      if (d[o + 3] < 100) { out[i] = 0; continue; }
      const dz = BAYER[row + (x & 3)];
      const r = Math.max(0, Math.min(255, d[o] + dz)); const g = Math.max(0, Math.min(255, d[o + 1] + dz)); const b = Math.max(0, Math.min(255, d[o + 2] + dz));
      out[i] = LUT[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
    }
  }
  ctx.putImageData(img, 0, 0);
}

// 小さなキャンバスに低い解像度で描いてドットにする
export function pixelCanvas(canvas, draw) {
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.clearRect(0, 0, canvas.width, canvas.height);
  draw(g);
  pixelPost(g, canvas.width, canvas.height);
}
