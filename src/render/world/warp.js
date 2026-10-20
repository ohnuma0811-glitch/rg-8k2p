// Global City のワープ（2026-10-20）: 3つ目の輪っかを過ぎると、光のトンネル。星が線になって、前から後ろへ速く流れる
// カメラについていく（userData.followCamera）。見えるのはワープの間だけ（userData.stages = ['warp']）
import * as THREE from '../../../vendor/three.module.min.js?v=9c29d4f';
import { landmark } from './kit.js?v=9c29d4f';

const STREAKS = 400;
const DEPTH = 700; // 線が流れてくる奥行き（m）
const RINGS = 8; // 光の輪の数

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
  g.userData.tube = tube;
  // 前から飛んでくる光の輪
  g.userData.rings = [];
  for (let k = 0; k < RINGS; k++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(30, 0.8, 6, 40), new THREE.MeshBasicMaterial({ color: 0x9fd0ff, fog: false, transparent: true, opacity: 0.8 }));
    r.frustumCulled = false;
    r.userData.keep = true;
    g.add(r);
    g.userData.rings.push(r);
  }
  landmark(g, 'warpTunnel', 0, 0, -DEPTH / 2);
  return root;
}

// ワープの見た目（p はワープの進み 0〜1。2026-10-21 のユーザー依頼「10秒くらいかけてもっと壮大に」）:
// だんだん速く、色は青 → むらさき → ピンク、最後に白く光ってクアラルンプールに着く
export function warpLook(p) {
  return { speed: 300 + 2600 * p * p, hue: 0.62 - 0.5 * p, flash: p > 0.88 ? Math.min(1, (p - 0.88) / 0.1) : 0 };
}

// 毎フレーム: カメラの位置と向きについていき、線を前から後ろへ流す。光の輪が前から飛んでくる
export function updateWarp(group, camera, time, p = 0) {
  group.position.copy(camera.position);
  group.quaternion.copy(camera.quaternion);
  const look = warpLook(p);
  const lines = group.userData.lines;
  const pos = lines.geometry.attributes.position;
  const a = pos.array;
  const run = (group.userData.run = (group.userData.run ?? 0) + (time - (group.userData.last ?? time)) * look.speed);
  group.userData.last = time;
  lines.userData.lanes.forEach((l, k) => {
    const z = -DEPTH + ((l.z0 + run) % DEPTH); // 奥（-DEPTH）から手前（0）へ
    const len = l.len * (1 + p * 4); // 速いほど長い線
    const i = k * 6;
    a[i] = l.x; a[i + 1] = l.y; a[i + 2] = z;
    a[i + 3] = l.x; a[i + 4] = l.y; a[i + 5] = z - len;
  });
  pos.needsUpdate = true;
  const tube = group.userData.tube;
  tube.material.color.setHSL(look.hue, 0.85, 0.5 + 0.45 * look.flash);
  tube.material.opacity = 0.28 + 0.6 * look.flash;
  group.userData.rings.forEach((r, k) => {
    r.position.z = -DEPTH + ((k * (DEPTH / RINGS) + run * 0.6) % DEPTH);
    r.material.color.setHSL((look.hue + k * 0.08) % 1, 0.9, 0.6);
  });
}
