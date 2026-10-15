// Kampar Town の仕掛け: バンプ（道のでっぱり）と牛（2026-10-15 のユーザー依頼）
import { SPEED_SHOW } from '../hud.js';
import { span, locate } from './track.js';

export const BUMP_LIMIT_KMH = 150; // スピードメーターの数字。これを超えてバンプに乗ると転がる（牛のスピンも。2026-10-15 に100から変更）
export const TUMBLE_TIME = 1; // 転がって走れない秒数（2026-10-15 のユーザー依頼で3秒から1秒に）
export const HUMP_TIME = 0.35; // 乗り越える動きの秒数
export const BUMP_STRIPE_M = 26; // バンプの手前のしま模様の長さ（m）
export const BUMP_WARN_EARLY = 2; // しまに入るこの秒数前（今の速さで）から、警告を出す（2026-10-15 のユーザー依頼）

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

// バンプの警告を出すか: バンプの手前のしま模様の上か、今の速さで BUMP_WARN_EARLY 秒以内にしまに入る（転がっている・飛んでいる・止まりかけは出さない）
export function bumpWarning(track, kart) {
  if (kart.tumble > 0 || kart.airborne || !(kart.speed > 2)) return false;
  const s = track.samples[kart.seg].s;
  return (track.bumps ?? []).some((b) => {
    const ahead = span(track, s, b);
    return ahead > 0 && ahead < track.length / 2 && ahead - BUMP_STRIPE_M <= BUMP_WARN_EARLY * kart.speed;
  });
}

// スクールバス（BAS SEKOLAH。2026-10-16 のユーザー依頼）: レースの進む向きの右側の車線を、いつも逆向きに走ってくる。
// 牛とはぶつからずに通り過ぎる。カートが触れると、速さに関係なくスピンする
export const BUS_SPEED = 13; // バスの速さ（m/s。メーター約70）
export const BUS_LANE = 6; // 道の真ん中から右へ（m）。ロータリーでは、道が広がった分だけ外（島の右側）を回る
export const BUS_LENGTH = 7.5; // バスの長さ（m）
export const BUS_WIDTH = 2.6; // バスの幅（m）
export const BUS_NEAR = 20; // すれちがいの音を鳴らす近さ（m）

// 時刻 time のバスの場所: s はコースの上の場所（逆に進む）、lateral は右へ
export function busPose(track, bus, time) {
  const L = track.length;
  const n = track.samples.length;
  const s = ((((bus.s0 - BUS_SPEED * time) % L) + L) % L);
  const i = Math.floor(s) % n;
  const p = track.samples[i];
  const q = track.samples[(i + 1) % n];
  const f = s - Math.floor(s);
  const lateral = BUS_LANE + (p.half - track.roadHalf);
  const px = p.x + (q.x - p.x) * f;
  const pz = p.z + (q.z - p.z) * f;
  return {
    s,
    x: px - Math.sin(p.h) * lateral,
    z: pz + Math.cos(p.h) * lateral,
    lateral,
    heading: p.h + Math.PI, // コースと逆向き
  };
}

// 車とバスの当たり（バスは長い四角）。触れた最初だけ 'spin' を返し、横へ押し出す
export function busContact(kart, track, time, phys) {
  let hit = null;
  let touching = false;
  for (const bus of track.buses ?? []) {
    const b = busPose(track, bus, time);
    const fx = Math.cos(b.heading);
    const fz = Math.sin(b.heading);
    const dx = kart.x - b.x;
    const dz = kart.z - b.z;
    const along = dx * fx + dz * fz;
    const side = dx * -fz + dz * fx;
    const halfL = BUS_LENGTH / 2 + COW_PAD;
    const halfW = BUS_WIDTH / 2 + COW_PAD;
    if (Math.abs(along) >= halfL || Math.abs(side) >= halfW || kart.airborne) continue;
    touching = true;
    // 横（近い側）へ押し出す
    const out = (Math.sign(side) || -1) * halfW - side;
    kart.x += -fz * out;
    kart.z += fx * out;
    if (kart.onBus || kart.spin > 0) continue;
    kart.busHits = (kart.busHits || 0) + 1;
    kart.spin = phys.SPIN_TIME;
    kart.spinTo = track.samples[kart.seg].h;
    kart.speed *= 0.5;
    hit = 'spin';
  }
  if (touching) {
    const loc = locate(track, kart.x, kart.z, kart.seg);
    const excess = Math.abs(loc.lateral) - loc.wall;
    if (excess > 0) {
      const sd = Math.sign(loc.lateral);
      kart.x -= -Math.sin(loc.heading) * sd * excess;
      kart.z -= Math.cos(loc.heading) * sd * excess;
    }
  }
  kart.onBus = touching;
  return hit;
}

// 近くにバスがいるか（すれちがいの音）
export function busNear(track, pos, time) {
  return (track.buses ?? []).some((bus) => {
    const b = busPose(track, bus, time);
    return Math.hypot(b.x - pos.x, b.z - pos.z) < BUS_NEAR;
  });
}
