// カメラで顔を読み取り、顔の向き（鼻の先の向き）・口の開き・目の特徴量を返す（MediaPipe Face Landmarker）。
// 映像はこのブラウザの中だけで使い、どこにも送らず保存もしない。部品は vendor/ に同梱（Apache-2.0）。
const V = (p) => new URL(`vendor/${p}`, import.meta.url).href;

export async function createGaze(video) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocamera');
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  video.srcObject = stream; video.muted = true; video.playsInline = true;
  await video.play();
  const { FaceLandmarker } = await import('./vendor/vision_bundle.js');
  const fileset = { wasmLoaderPath: V('vision_wasm_internal.js'), wasmBinaryPath: V('vision_wasm_internal.wasm') };
  const opts = (delegate) => ({ baseOptions: { modelAssetPath: V('face_landmarker.task'), delegate }, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true });
  let lm;
  try { lm = await FaceLandmarker.createFromOptions(fileset, opts('GPU')); } catch { lm = await FaceLandmarker.createFromOptions(fileset, opts('CPU')); }

  const state = { ok: false, f: null, head: null, blink: false, mouth: false, pts: null, lastT: 0 };
  let running = true, lastVideoT = -1;
  const loop = () => {
    if (!running) return;
    if (video.readyState >= 2 && video.currentTime !== lastVideoT) {
      lastVideoT = video.currentTime;
      try {
        const r = lm.detectForVideo(video, performance.now());
        const L = r.faceLandmarks?.[0];
        if (L && L.length >= 478) {
          state.f = features(L, r.facialTransformationMatrixes?.[0]?.data); state.ok = true; state.pts = [L[468], L[473], L[1]];
          const bs = r.faceBlendshapes?.[0]?.categories || [];
          const sc = (n) => bs.find((c) => c.categoryName === n)?.score ?? 0;
          state.blink = (sc('eyeBlinkLeft') + sc('eyeBlinkRight')) / 2 > 0.5;
          state.mouth = sc('jawOpen') > 0.35;
          state.head = [state.f[4], state.f[5], L[1].x, L[1].y];
        } else state.ok = false;
        state.lastT = performance.now();
      } catch { state.ok = false; }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return {
    state,
    stop() { running = false; try { lm.close(); } catch { /* */ } stream.getTracks().forEach((t) => t.stop()); video.srcObject = null; },
  };
}

// 特徴量：左右それぞれの目の中の黒目の位置（横・縦）と、頭の向き（左右・上下の回転）と位置
function features(L, M) {
  const eye = (iris, c1, c2, top, bot) => {
    const w = Math.hypot(L[c2].x - L[c1].x, L[c2].y - L[c1].y) || 1e-6;
    const cx = (L[c1].x + L[c2].x) / 2, cy = (L[top].y + L[bot].y) / 2, h = Math.abs(L[bot].y - L[top].y) || 1e-6;
    return [(L[iris].x - cx) / w, (L[iris].y - cy) / Math.max(h, w * 0.2)];
  };
  const a = eye(468, 33, 133, 159, 145), b = eye(473, 362, 263, 386, 374);
  let yaw, pitch, tx, ty;
  if (M && M.length >= 16) { yaw = Math.atan2(M[8], M[10]); pitch = Math.asin(Math.max(-1, Math.min(1, -M[9]))); tx = M[12] / 20; ty = M[13] / 20; }
  else {
    const fw = L[454].x - L[234].x || 1e-6, fh = L[152].y - L[10].y || 1e-6;
    yaw = (L[1].x - (L[234].x + L[454].x) / 2) / fw; pitch = (L[1].y - (L[10].y + L[152].y) / 2) / fh;
    tx = (L[234].x + L[454].x) / 2 - 0.5; ty = (L[10].y + L[152].y) / 2 - 0.5;
  }
  return [a[0], a[1], b[0], b[1], yaw, pitch, tx, ty];
}
