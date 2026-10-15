// Kampar Town の仕掛け: バンプ（道のでっぱり）と牛（2026-10-15 のユーザー依頼）
import { SPEED_SHOW } from '../hud.js';
import { span, locate } from './track.js';

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

export const COW_RADIUS = 1.6; // 牛の大きさ（半径 m）
const COW_PAD = 1.1; // 車の大きさ（src/game/collide.js の KART_RADIUS と同じ）

// 時刻 time の牛の場所。道の中を、ゆっくり左右に行ったり来たりする（端で少しゆっくり）
export function cowPose(track, cow, time) {
  const p = track.samples[Math.round(cow.s) % track.samples.length];
  const w = (2 * Math.PI) / cow.period;
  const a = w * time + cow.phase;
  const b = a + 0.35 * Math.sin(a);
  const lateral = (track.roadHalf - 2) * Math.sin(b);
  const dir = Math.cos(b) >= 0 ? 1 : -1; // 右へ動いているか左へか
  return {
    x: p.x - Math.sin(p.h) * lateral,
    z: p.z + Math.cos(p.h) * lateral,
    lateral,
    heading: p.h + (dir * Math.PI) / 2, // 動いている向き（道を横切る向き）
  };
}

// 車と牛の当たり。最初に当たったときだけ 'spin'（メーター100以上）か 'bounce'（それより遅い。壁と同じ）を返す
// phys は src/game/kart.js の PHYS（kart.js がこのファイルを読むので、ここからは読まない）
export function cowContact(kart, track, time, phys) {
  let hit = null;
  let touching = false;
  for (const cow of track.cows ?? []) {
    const c = cowPose(track, cow, time);
    const dx = kart.x - c.x;
    const dz = kart.z - c.z;
    const d = Math.hypot(dx, dz);
    const min = COW_RADIUS + COW_PAD;
    if (d >= min || d === 0 || kart.airborne || kart.tumble > 0) continue;
    touching = true;
    kart.x = c.x + (dx / d) * min;
    kart.z = c.z + (dz / d) * min;
    if (kart.onCow) continue;
    kart.cowHits = (kart.cowHits || 0) + 1;
    if (meterKmh(kart.speed) >= BUMP_LIMIT_KMH) {
      kart.spin = phys.SPIN_TIME;
      kart.spinTo = track.samples[kart.seg].h;
      kart.speed *= 0.5;
      hit = 'spin';
    } else {
      kart.speed *= phys.WALL_KEEP;
      hit = 'bounce';
    }
  }
  // 押し出したあと、柵の外に出ないように戻す
  if (touching) {
    const loc = locate(track, kart.x, kart.z, kart.seg);
    const excess = Math.abs(loc.lateral) - loc.wall;
    if (excess > 0) {
      const side = Math.sign(loc.lateral);
      kart.x -= -Math.sin(loc.heading) * side * excess;
      kart.z -= Math.cos(loc.heading) * side * excess;
    }
  }
  kart.onCow = touching;
  return hit;
}
