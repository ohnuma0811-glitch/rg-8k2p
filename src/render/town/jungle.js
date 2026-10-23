// コースの外側の、何もない所をジャングルにする（2026-10-15 のユーザー依頼。コースの内側は今のまま）
import * as THREE from '../../../vendor/three.module.min.js?v=b50c581';
import { createBuilder } from './builder.js?v=b50c581';
import { broccoliTree } from '../forest/kit.js?v=b50c581';

const GRID = 20; // 木のかたまりを置く間（m）
const NEAR = 8; // 道のふち（柵）からこれだけ離す
const FAR = 170; // 道からこれより遠くには置かない（見えない所に作らない）
const CELL = 20; // 点を探すます目（m）

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
// inside: true のときは、コース（本線の輪）に囲まれた所だけ（森の中。Soki Forest 2026-10-16）。false は外だけ
export function jungleSpots(track, avoid, { inside = false } = {}) {
  const { samples } = track;
  const loop = samples.slice(0, track.length); // 分かれ道は輪に入れない
  const grid = new Map();
  for (const q of samples) {
    const key = `${Math.floor(q.x / CELL)},${Math.floor(q.z / CELL)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(q);
  }
  const reach = Math.max(...samples.map((q) => q.wall)) + NEAR;
  // (x, z) から r 以内の点で、test(点, 距離) が true になるものがあるか
  const near = (x, z, r, test) => {
    const span = Math.ceil(r / CELL);
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    for (let gx = cx - span; gx <= cx + span; gx++) {
      for (let gz = cz - span; gz <= cz + span; gz++) {
        for (const q of grid.get(`${gx},${gz}`) ?? []) if (test(q, Math.hypot(q.x - x, q.z - z))) return true;
      }
    }
    return false;
  };
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
      // 道のすぐ近く（柵から NEAR m）は置かない。道から FAR m より遠い所にも置かない（近くのます目の点だけ見る）
      if (near(jx, jz, reach, (q, d) => d < q.wall + NEAR)) continue;
      if (!near(jx, jz, FAR, (q, d) => d <= FAR)) continue;
      if (avoid.some((a) => Math.hypot(a.x - jx, a.z - jz) < a.radius)) continue;
      if (insideLoop(loop, jx, jz) !== inside) continue;
      out.push({ x: jx, z: jz, k });
    }
  }
  return out;
}

// ジャングルの形（濃い緑の高い木のかたまりと、ときどきヤシ）
const LEAVES = [0x1f5a2a, 0x2a6b2e, 0x245f32, 0x337a35];
// groundY(x, z): 地面の高さ（森の坂。省けば 0）。inside: 森の中のブロッコリーの木（Soki Forest）
// 木は CHUNK m の区画ごとに別の形にする（画面に映らない区画は描かないので、タブレットで軽い。2026-10-16 のユーザー依頼「カクつく」）
export const CHUNK = 220;
function chunked() {
  const builders = new Map();
  return {
    at(x, z) {
      const key = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
      if (!builders.has(key)) builders.set(key, createBuilder());
      return builders.get(key);
    },
    build() {
      const group = new THREE.Group();
      for (const b of builders.values()) group.add(b.build());
      return group;
    },
  };
}

export function buildJungle(track, avoid, { groundY = () => 0, inside = false } = {}) {
  const chunks = chunked();
  if (inside) {
    // 1か所に1本（三角の数を減らす。2026-10-16 のブラウザ確認で 28万 → 少なく）
    for (const p of jungleSpots(track, avoid, { inside: true })) {
      const b = chunks.at(p.x, p.z);
      b.push(p.x, groundY(p.x, p.z), p.z, p.k);
      broccoliTree(b, { size: 1.3 + (p.k % 4) * 0.25, k: p.k });
      b.pop();
    }
    return chunks.build();
  }
  for (const p of jungleSpots(track, avoid)) {
    const b = chunks.at(p.x, p.z);
    const n = 2 + (p.k % 2);
    for (let i = 0; i < n; i++) {
      const ox = ((p.k * (i + 3) * 7) % 13) - 6;
      const oz = ((p.k * (i + 5) * 11) % 13) - 6;
      const h = 10 + ((p.k * (i + 1)) % 9);
      const color = LEAVES[(p.k + i) % LEAVES.length];
      const y = groundY(p.x + ox, p.z + oz);
      // ふたは見えないので、なし（タブレットで軽く。2026-10-16）
      b.cyl(0.4, 0.6, h * 0.4, 5, 0x5a4030, p.x + ox, y, p.z + oz, true);
      b.cyl(0, 5 + (i % 2) * 2, h * 0.75, 6, color, p.x + ox, y + h * 0.3, p.z + oz, true);
    }
  }
  return chunks.build();
}
