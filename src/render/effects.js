// ドリフトの煙（白 → 黄 → 赤。マリオカート64 のように）と、ダートの砂ぼこり
import * as THREE from '../../vendor/three.module.min.js?v=0776430';
import { driftLevel } from '../game/kart.js?v=0776430';

const MAX = 200;
const SMOKE = [new THREE.Color(0xf4f4f4), new THREE.Color(0xffd84a), new THREE.Color(0xff3b2f)];
const DUST = new THREE.Color(0xd9b98a);
const MUD_SMOKE = new THREE.Color(0x9a8a78); // ぬかるみで出る、灰色がかった茶色の煙

export function createEffects(scene) {
  const pos = new Float32Array(MAX * 3);
  const col = new Float32Array(MAX * 3);
  const parts = Array.from({ length: MAX }, () => ({ life: 0, x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, c: DUST }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.45, vertexColors: true }));
  points.frustumCulled = false;
  scene.add(points);
  let next = 0;

  function emit(x, y, z, vx, vy, vz, c, life) {
    const p = parts[next];
    next = (next + 1) % MAX;
    Object.assign(p, { x, y, z, vx, vy, vz, c, life });
  }

  const WHITE = new THREE.Color(0xf4f4f4);
  const SPARK = new THREE.Color(0xffa22a);
  return {
    // バンプで転がったときの小さな爆発: 白い煙が飛び散り、オレンジの火花（2026-10-15 のユーザー依頼）
    burst(x, y, z) {
      for (let k = 0; k < 24; k++) {
        const a = Math.random() * Math.PI * 2;
        const v = 3 + Math.random() * 3;
        emit(x, y, z, Math.cos(a) * v, 2 + Math.random() * 3, Math.sin(a) * v, WHITE, 0.8);
      }
      for (let k = 0; k < 16; k++) {
        const a = Math.random() * Math.PI * 2;
        const v = 6 + Math.random() * 4;
        emit(x, y, z, Math.cos(a) * v, 3 + Math.random() * 3, Math.sin(a) * v, SPARK, 0.4);
      }
    },
    update(kart, dt) {
      const fx = Math.cos(kart.heading);
      const fz = Math.sin(kart.heading);
      const rx = -fz;
      const rz = fx;
      if (kart.drift.active && !kart.airborne) {
        const c = SMOKE[driftLevel(kart)];
        for (const side of [-1, 1]) {
          emit(kart.x - fx * 1 + rx * side * 0.9, kart.y + 0.3, kart.z - fz * 1 + rz * side * 0.9,
            (Math.random() - 0.5) * 2, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 2, c, 0.35);
        }
      }
      // ぬかるみ（Soki Forest）: ハンドルが逆の間、車からもくもく煙
      if (kart.muddy > 0) {
        for (let k = 0; k < 2; k++) {
          emit(kart.x + (Math.random() - 0.5) * 2, kart.y + 0.8, kart.z + (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 1.5, 2 + Math.random() * 2, (Math.random() - 0.5) * 1.5, MUD_SMOKE, 0.9);
        }
      }
      if (kart.surface === 'dirt' && !kart.airborne && Math.abs(kart.speed) > 5) {
        emit(kart.x - fx * 2 + rx * (Math.random() - 0.5) * 1.6, kart.y + 0.3, kart.z - fz * 2 + rz * (Math.random() - 0.5) * 1.6,
          -fx * 2 + (Math.random() - 0.5) * 2, 1 + Math.random() * 2, -fz * 2 + (Math.random() - 0.5) * 2, DUST, 0.6);
      }
      for (let i = 0; i < MAX; i++) {
        const p = parts[i];
        if (p.life > 0) {
          p.life -= dt;
          p.vy -= 6 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
        }
        pos[i * 3] = p.x;
        pos[i * 3 + 1] = p.life > 0 ? p.y : -100;
        pos[i * 3 + 2] = p.z;
        col[i * 3] = p.c.r;
        col[i * 3 + 1] = p.c.g;
        col[i * 3 + 2] = p.c.b;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}
