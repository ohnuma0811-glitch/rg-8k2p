// 音の大きさ・高さ・左右の計算（テストできるように、Web Audio とは分けてある）

// エンジン音: 速いほど高く大きく。加速中はさらに少し高く
export function engineParams(speed, topSpeed, boosting) {
  const r = Math.max(0, Math.min(1, speed / topSpeed));
  return { freq: 55 + 125 * r + (boosting ? 15 : 0), gain: 0.03 + 0.05 * r };
}
