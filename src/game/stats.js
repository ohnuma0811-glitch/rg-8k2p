// 能力の数字（1〜5）を、実際の速さ・曲がり方に直す。キャラの調整はこの表だけを直す
// 配列の番号が能力の数字（0番は使わない）
const TOP_SPEED = [0, 31, 33.5, 36, 38.5, 41]; // 最高速（m/s）。3 で時速約130km
const ACCEL = [0, 9, 11, 13, 15, 17]; // 加速（m/s²）
const TURN_RATE = [0, 2.4, 2.6, 2.8, 3.0, 3.2]; // ハンドルをいっぱいに切ったときの曲がる速さ（rad/s）。マリオカート64 くらいに鋭く

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
