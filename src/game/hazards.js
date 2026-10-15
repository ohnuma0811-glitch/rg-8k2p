// Kampar Town の仕掛け: バンプ（道のでっぱり）と牛（2026-10-15 のユーザー依頼）
import { SPEED_SHOW } from '../hud.js';
import { span } from './track.js';

export const BUMP_LIMIT_KMH = 100; // スピードメーターの数字。これを超えてバンプに乗ると転がる
export const TUMBLE_TIME = 3; // 転がって走れない秒数
export const HUMP_TIME = 0.35; // 乗り越える動きの秒数

// スピードメーターの数字（実際の速さの1.5倍。src/hud.js と同じ）
export function meterKmh(mps) {
  return Math.abs(mps) * 3.6 * SPEED_SHOW;
}

// from から to へ前に進んだとき、at を越えたか（at ちょうどに着いただけでは越えていない。1周の切れ目もまたげる）
export function crossed(track, from, to, at) {
  const moved = span(track, from, to);
  if (moved === 0 || moved > track.length / 2) return false;
  const reach = span(track, from, at);
  return reach > 0 && reach <= moved;
}
