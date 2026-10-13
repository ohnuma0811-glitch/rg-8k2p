// 能力の数字（1〜5）を、実際の速さ・曲がり方に直す。キャラの調整はこの表だけを直す
// 配列の番号が能力の数字（0番は使わない）
const TOP_SPEED = [0, 27, 29.5, 32, 34.5, 37]; // 最高速（m/s）
const ACCEL = [0, 8, 10, 12, 14, 16]; // 加速（m/s²）
const TURN_RATE = [0, 1.5, 1.7, 1.9, 2.1, 2.3]; // ハンドルをいっぱいに切ったときの曲がる速さ（rad/s）

function level(n) {
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new RangeError(`能力の数字は1〜5: ${n}`);
  return n;
}

export function kartParams({ accel, top, handling }) {
  return {
    topSpeed: TOP_SPEED[level(top)],
    accel: ACCEL[level(accel)],
    turnRate: TURN_RATE[level(handling)],
  };
}
