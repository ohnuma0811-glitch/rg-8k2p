// Three.js の場面: 空、地面、光、遠くの山、コース、追いかけるカメラ
import * as THREE from '../../vendor/three.module.min.js?v=4cb225e';
import { buildTrackMesh } from './trackMesh.js?v=4cb225e';

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
    const h = 150 + ((k * 37) % 5) * 40;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(h * 1.4, h, 7), mountain);
    cone.position.set(Math.cos(a) * 700, h / 2 - 2, Math.sin(a) * 700);
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

// マリオカート64 のように、少し遠く低い所から追いかける。車は画面の真ん中より少し下に映る
// カメラは車の「進む向き」に遅れて回るので、カーブやドリフトでは車の横腹が見える
const CAM_BACK = 8; // 車の何m後ろ（カートの約3台分。近いほど、まわりの物が速く流れて見える）
const CAM_HEIGHT = 2.9; // 車から何m上（カートの約1.1台分）
const CAM_AHEAD = 12; // 車の何m先を見るか（車が画面の上から65〜70%に映るように）
const CAM_TURN = 3; // カメラが車の進む向きに追いつく速さ（1/秒。小さいほど遅れる）
const FOV_BASE = 58;
const FOV_FAST = 16; // 最高速のとき、視野をこれだけ広げる（スピード感）
const FOV_BOOST = 8; // 加速中は、さらに広げる
const _pos = new THREE.Vector3();
export function updateChaseCamera(camera, kart, topSpeed, dt) {
  const st = camera.userData;
  if (st.h === undefined) {
    st.h = kart.move;
    st.fov = FOV_BASE;
    st.pos = new THREE.Vector3();
  }
  st.h += Math.atan2(Math.sin(kart.move - st.h), Math.cos(kart.move - st.h)) * Math.min(1, CAM_TURN * dt);
  const fx = Math.cos(st.h);
  const fz = Math.sin(st.h);
  _pos.set(kart.x - fx * CAM_BACK, kart.y + CAM_HEIGHT, kart.z - fz * CAM_BACK);
  if (!st.placed) {
    st.pos.copy(_pos);
    st.placed = true;
  }
  st.pos.lerp(_pos, 1 - Math.exp(-20 * dt)); // 遅れは小さく（速くても遠ざかりすぎない）
  const fast = Math.max(0, Math.min(1, kart.speed / topSpeed));
  const fov = FOV_BASE + fast * fast * FOV_FAST + (kart.boost > 0 ? FOV_BOOST : 0);
  st.fov += (fov - st.fov) * Math.min(1, 4 * dt);
  camera.fov = st.fov;
  camera.updateProjectionMatrix();
  camera.position.copy(st.pos);
  camera.lookAt(kart.x + fx * CAM_AHEAD, kart.y + 1.2, kart.z + fz * CAM_AHEAD);
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
