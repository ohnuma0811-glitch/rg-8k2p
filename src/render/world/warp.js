// Global City のワープ（2026-10-20）: 3つ目の輪っかを過ぎると、光のトンネル。星が線になって、前から後ろへ速く流れる
// カメラについていく（userData.followCamera）。見えるのはワープの間だけ（userData.stages = ['warp']）
import * as THREE from '../../../vendor/three.module.min.js?v=0e5d133';
import { landmark } from './kit.js?v=0e5d133';

const STREAKS = 400;
const DEPTH = 700; // 線が流れてくる奥行き（m）

export function buildWarp() {
  const root = new THREE.Group();
  const g = new THREE.Group();
  g.userData.stages = ['warp'];
  g.userData.followCamera = true;
  g.userData.warp = true; // main.js が updateWarp で動かす
  root.add(g);
  // 星の線（白〜青。カメラから見て、まわりの筒の上に）
  const pos = new Float32Array(STREAKS * 6);
  const col = new Float32Array(STREAKS * 6);
  const c = new THREE.Color();
  const lanes = [];
  for (let k = 0; k < STREAKS; k++) {
    const a = k * 2.399963;
    const r = 8 + ((k * 37) % 30);
    lanes.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, z0: ((k * 9301) % DEPTH), len: 10 + (k % 5) * 6 });
    c.setHex(k % 3 ? 0x9fd0ff : 0xffffff);
    col.set([c.r, c.g, c.b, c.r * 0.3, c.g * 0.3, c.b * 0.6], k * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, fog: false }));
  lines.frustumCulled = false;
  lines.userData.keep = true;
  lines.userData.lanes = lanes;
  g.add(lines);
  g.userData.lines = lines;
  // 青白い光の筒（内がわから見る、半透明）
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(42, 42, DEPTH + 200, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x3a6aff, transparent: true, opacity: 0.28, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  tube.rotation.x = Math.PI / 2;
  tube.position.z = -DEPTH / 2;
  tube.frustumCulled = false;
  tube.userData.keep = true;
  g.add(tube);
  landmark(g, 'warpTunnel', 0, 0, -DEPTH / 2);
  return root;
}

// 毎フレーム: カメラの位置と向きについていき、線を前から後ろへ流す
export function updateWarp(group, camera, time) {
  group.position.copy(camera.position);
  group.quaternion.copy(camera.quaternion);
  const lines = group.userData.lines;
  const pos = lines.geometry.attributes.position;
  lines.userData.lanes.forEach((l, k) => {
    const z = -DEPTH + ((l.z0 + time * 900) % DEPTH); // 奥（-DEPTH）から手前（0）へ
    pos.array.set([l.x, l.y, z, l.x, l.y, z - l.len], k * 6);
  });
  pos.needsUpdate = true;
}
