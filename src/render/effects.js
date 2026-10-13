// ドリフトの火花（青・オレンジ）と、ダートの砂ぼこり
import * as THREE from '../../vendor/three.module.min.js';
import { driftLevel } from '../game/kart.js';

const MAX = 200;
const SPARK = [null, new THREE.Color(0x3fa9ff), new THREE.Color(0xff8a00)];
const DUST = new THREE.Color(0xd9b98a);

export function createEffects(scene) {
  const pos = new Float32Array(MAX * 3);
  const col = new Float32Array(MAX * 3);
  const parts = Array.from({ length: MAX }, () => ({ life: 0, x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, c: DUST }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.3, vertexColors: true }));
  points.frustumCulled = false;
  scene.add(points);
  let next = 0;

  function emit(x, y, z, vx, vy, vz, c, life) {
    const p = parts[next];
    next = (next + 1) % MAX;
    Object.assign(p, { x, y, z, vx, vy, vz, c, life });
  }

  return {
    update(kart, dt) {
      const fx = Math.cos(kart.heading);
      const fz = Math.sin(kart.heading);
      const rx = -fz;
      const rz = fx;
      const lv = driftLevel(kart);
      if (lv > 0) {
        for (const side of [-1, 1]) {
          emit(kart.x - fx * 1 + rx * side * 0.8, kart.y + 0.2, kart.z - fz * 1 + rz * side * 0.8,
            (Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3, SPARK[lv], 0.25);
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
