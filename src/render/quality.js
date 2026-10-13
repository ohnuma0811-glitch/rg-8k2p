// 画面の細かさ（0.5〜1）を、なめらかさ（fps）に合わせて自動で上げ下げする
export const QUALITY_MIN = 0.5;
export const QUALITY_MAX = 1;

export function nextQuality(q, fps) {
  if (fps < 45) return Math.max(QUALITY_MIN, Math.round((q - 0.15) * 100) / 100);
  if (fps > 57) return Math.min(QUALITY_MAX, Math.round((q + 0.05) * 100) / 100);
  return q;
}

// 実際に描く細かさ（端末の画素の細かさ。上限2）
export function pixelRatio(devicePixelRatio, q) {
  return Math.min(devicePixelRatio || 1, 2) * q;
}
