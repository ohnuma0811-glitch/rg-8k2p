// 音の大きさ・高さ・左右の計算（テストできるように、Web Audio とは分けてある）

// 効果音の音量（2026-10-15 のユーザー依頼で大きくした）
export const DRIFT_VOLUME = 0.22; // ドリフトのキュルキュル（最高速のとき。0.12 から）
export const WALL_VOLUME = 1.6; // 壁にぶつかった音の大きさの倍率

// エンジン音: 速いほど高く大きく。加速中はさらに少し高く
export function engineParams(speed, topSpeed, boosting) {
  const r = Math.max(0, Math.min(1, speed / topSpeed));
  return { freq: 55 + 125 * r + (boosting ? 15 : 0), gain: 0.03 + 0.05 * r };
}

export const CROWD_MAX = 0.35; // 歓声のいちばん大きい音量
const CROWD_NEAR = 25; // ここまで近いと、いちばん大きい（m）
const CROWD_FAR = 200; // ここより遠いと、聞こえない（m）

// 歓声: 観客席（spot）との距離で大きさ、車の右か左かで左右（-1 左 〜 1 右）
export function crowdMix(kart, spot) {
  const dx = spot.x - kart.x;
  const dz = spot.z - kart.z;
  const d = Math.hypot(dx, dz);
  const near = Math.max(0, Math.min(1, 1 - (d - CROWD_NEAR) / (CROWD_FAR - CROWD_NEAR)));
  // 右向き（コースの横の向きと同じ決め方。heading は x から z へ回る角度）
  const rx = -Math.sin(kart.heading);
  const rz = Math.cos(kart.heading);
  const pan = d < 1e-6 ? 0 : Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d));
  return { gain: CROWD_MAX * near * near, pan };
}
