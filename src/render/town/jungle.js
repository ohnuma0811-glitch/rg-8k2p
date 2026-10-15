// コースの外側の、何もない所をジャングルにする（2026-10-15 のユーザー依頼。コースの内側は今のまま）
import { createBuilder } from './builder.js?v=8258d44';

const GRID = 20; // 木のかたまりを置く間（m）
const NEAR = 8; // 道のふち（柵）からこれだけ離す
const FAR = 170; // 道からこれより遠くには置かない（見えない所に作らない）

// 点 (x, z) がコースの線で囲まれた内側にあるか（線を横切る回数が奇数なら内側）
export function insideLoop(samples, x, z) {
  let inside = false;
  for (let i = 0, j = samples.length - 1; i < samples.length; j = i++) {
    const a = samples[i];
    const b = samples[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

// ジャングルの木のかたまりを置く場所。avoid（景色の建物など {x, z, radius}）のまわりはあける
export function jungleSpots(track, avoid) {
  const { samples } = track;
  const xs = samples.map((p) => p.x);
  const zs = samples.map((p) => p.z);
  const out = [];
  let k = 0;
  for (let x = Math.min(...xs) - FAR; x <= Math.max(...xs) + FAR; x += GRID) {
    for (let z = Math.min(...zs) - FAR; z <= Math.max(...zs) + FAR; z += GRID) {
      k++;
      // 少しずらして、並びが格子に見えないように（決まった数で）
      const jx = x + (((k * 73) % 11) - 5);
      const jz = z + (((k * 37) % 11) - 5);
      let nearest = Infinity;
      let ok = true;
      for (const q of samples) {
        const d = Math.hypot(q.x - jx, q.z - jz);
        if (d < q.wall + NEAR) {
          ok = false;
          break;
        }
        nearest = Math.min(nearest, d);
      }
      if (!ok || nearest > FAR) continue;
      if (avoid.some((a) => Math.hypot(a.x - jx, a.z - jz) < a.radius)) continue;
      if (insideLoop(samples, jx, jz)) continue;
      out.push({ x: jx, z: jz, k });
    }
  }
  return out;
}

// ジャングルの形（濃い緑の高い木のかたまりと、ときどきヤシ）
const LEAVES = [0x1f5a2a, 0x2a6b2e, 0x245f32, 0x337a35];
export function buildJungle(track, avoid) {
  const b = createBuilder();
  for (const p of jungleSpots(track, avoid)) {
    const n = 2 + (p.k % 2);
    for (let i = 0; i < n; i++) {
      const ox = ((p.k * (i + 3) * 7) % 13) - 6;
      const oz = ((p.k * (i + 5) * 11) % 13) - 6;
      const h = 10 + ((p.k * (i + 1)) % 9);
      const color = LEAVES[(p.k + i) % LEAVES.length];
      b.cyl(0.4, 0.6, h * 0.4, 5, 0x5a4030, p.x + ox, 0, p.z + oz);
      b.cyl(0, 5 + (i % 2) * 2, h * 0.75, 6, color, p.x + ox, h * 0.3, p.z + oz);
    }
  }
  return b.build();
}
