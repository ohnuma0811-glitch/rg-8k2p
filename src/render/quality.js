// 画面の細かさ（0.5〜1）を、なめらかさ（fps）に合わせて自動で上げ下げする（50fps 未満で下げる。2026-10-19 に 45 から）
export const QUALITY_MIN = 0.375; // 画素の細かさ 2 の端末で 0.75（タブレット。2026-10-22 に 0.5 から）
export const QUALITY_MAX = 1;

export function nextQuality(q, fps) {
  if (fps < 50) return Math.max(QUALITY_MIN, Math.round((q - 0.15) * 100) / 100);
  if (fps > 57) return Math.min(QUALITY_MAX, Math.round((q + 0.05) * 100) / 100);
  return q;
}

// 実際に描く細かさ（端末の画素の細かさ。上限2）
// floor: いちばん粗くてここまで。PC は 1（画面の画素より粗くしない。ぼやけないように）、タブレット・スマホは 0.75（重いときだけ。2026-10-22）
export function pixelRatio(devicePixelRatio, q, floor = 1) {
  return Math.max(floor, Math.min(devicePixelRatio || 1, 2) * q);
}
