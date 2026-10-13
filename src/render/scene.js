// Three.js の場面: 空、地面、光、遠くの山、コース、追いかけるカメラ
import * as THREE from '../../vendor/three.module.min.js';
import { buildTrackMesh } from './trackMesh.js';

const SKY = 0x8fd3ff;

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setClearColor(SKY);
  return renderer;
}

export function createWorld(track) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 250, 1100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x557744, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(200, 400, 100);
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: 0x5fae4b }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const mountain = new THREE.MeshLambertMaterial({ color: 0x7c9a6b });
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    const h = 80 + ((k * 37) % 5) * 30;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(h * 1.4, h, 7), mountain);
    cone.position.set(Math.cos(a) * 1000, h / 2 - 2, Math.sin(a) * 1000);
    scene.add(cone);
  }

  scene.add(buildTrackMesh(track));
  const camera = new THREE.PerspectiveCamera(70, 1, 0.5, 2000);
  return { scene, camera };
}

export function resizeRenderer(renderer, camera, w, h, ratio) {
  renderer.setPixelRatio(ratio);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// 車の後ろ上から追いかける。数字は KENTA が別のチャットで作ったレースゲーム（Penguin GP）を参考にする:
// 車の7.8m後ろ・高さ3.3mから、車の5m先を見る。人物は小さめに映るが、先の道がよく見える
// 向きと位置は少しずつ合わせる。視野は速いほど少し広げ、加速中はさらに広げる
const CAM_BACK = 7.8; // 車の何m後ろ
const CAM_HEIGHT = 3.3; // 車から何m上
const CAM_AHEAD = 5; // 車の何m先を見るか
const FOV_BASE = 62;
const _pos = new THREE.Vector3();
export function updateChaseCamera(camera, kart, topSpeed, dt) {
  const st = camera.userData;
  const drift = kart.drift.active ? kart.drift.dir * 0.25 : 0;
  const yaw = kart.heading - drift;
  if (st.h === undefined) {
    st.h = yaw;
    st.fov = FOV_BASE;
    st.pos = new THREE.Vector3();
  }
  st.h += Math.atan2(Math.sin(yaw - st.h), Math.cos(yaw - st.h)) * Math.min(1, 5 * dt);
  const fx = Math.cos(st.h);
  const fz = Math.sin(st.h);
  _pos.set(kart.x - fx * CAM_BACK, kart.y + CAM_HEIGHT, kart.z - fz * CAM_BACK);
  if (!st.placed) {
    st.pos.copy(_pos);
    st.placed = true;
  }
  st.pos.lerp(_pos, 1 - Math.exp(-9 * dt));
  const fov = FOV_BASE + Math.max(0, kart.speed) * 0.08 + (kart.boost > 0 ? 9 : 0);
  st.fov += (fov - st.fov) * Math.min(1, 4 * dt);
  camera.fov = st.fov;
  camera.updateProjectionMatrix();
  camera.position.copy(st.pos);
  camera.lookAt(kart.x + fx * CAM_AHEAD, kart.y + 1.3, kart.z + fz * CAM_AHEAD);
}

// 確かめ用: 車を前から見る（キャラの顔を見るため）
export function updateFrontCamera(camera, kart) {
  const fx = Math.cos(kart.heading);
  const fz = Math.sin(kart.heading);
  camera.fov = 50;
  camera.updateProjectionMatrix();
  camera.position.set(kart.x + fx * 4.5, kart.y + 2.2, kart.z + fz * 4.5);
  camera.lookAt(kart.x, kart.y + 1.4, kart.z);
}
