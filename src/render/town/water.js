// コースの内側の左半分は水（Westlake の湖。2026-10-15 のユーザー依頼）。道と建物のまわりはあけて、岸を残す
import * as THREE from '../../../vendor/three.module.min.js?v=cdf967c';
import { insideLoop } from './jungle.js?v=cdf967c';

export const WATER_CELL = 6; // 水のマスの大きさ（m）
const SHORE = 4; // 道のふち（柵）から、岸としてあける幅（m）

// 水のマスの真ん中の場所。avoid（景色の建物など {x, z, radius}）のまわりはあける
export function waterCells(track, avoid) {
  const { samples } = track;
  const xs = samples.map((p) => p.x);
  const zs = samples.map((p) => p.z);
  const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
  const half = WATER_CELL / 2;
  const out = [];
  for (let x = Math.min(...xs) + half; x + half <= mid; x += WATER_CELL) {
    for (let z = Math.min(...zs) + half; z <= Math.max(...zs); z += WATER_CELL) {
      if (!insideLoop(samples, x, z)) continue;
      // マスの角まで道にかからないように（マスの半分の対角線の分も離す）
      if (samples.some((q) => Math.hypot(q.x - x, q.z - z) < q.wall + SHORE + half * 1.42)) continue;
      if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < a.radius + half * 1.42)) continue;
      out.push({ x, z });
    }
  }
  return out;
}

export function buildWater(track, avoid) {
  const cells = waterCells(track, avoid);
  const pos = new Float32Array(cells.length * 18);
  const h = WATER_CELL / 2;
  cells.forEach((c, k) => {
    const y = 0.04;
    const q = [c.x - h, y, c.z - h, c.x - h, y, c.z + h, c.x + h, y, c.z + h, c.x - h, y, c.z - h, c.x + h, y, c.z + h, c.x + h, y, c.z - h];
    pos.set(q, k * 18);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x5f9fc8, side: THREE.DoubleSide }));
  mesh.userData = { cells: cells.length };
  return mesh;
}
