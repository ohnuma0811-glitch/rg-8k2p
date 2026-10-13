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

// 車のすぐ後ろの低い所から追いかける（キャラが大きく見えるように）。速いほど視野を広げ、加速中はさらに広げる（スピード感）
// 急に動かないよう、少しずつ近づける
export function updateChaseCamera(camera, kart, topSpeed, dt) {
  const fx = Math.cos(kart.heading);
  const fz = Math.sin(kart.heading);
  const want = new THREE.Vector3(kart.x - fx * 4.2, kart.y + 2, kart.z - fz * 4.2);
  const look = new THREE.Vector3(kart.x + fx * 5, kart.y + 1, kart.z + fz * 5);
  const st = camera.userData;
  if (!st.pos) {
    st.pos = want.clone();
    st.look = look.clone();
    st.fov = camera.fov;
  }
  const k = 1 - Math.exp(-dt * 8);
  st.pos.lerp(want, k);
  st.look.lerp(look, k);
  const fast = Math.max(0, Math.min(1, (kart.speed - topSpeed * 0.5) / (topSpeed * 0.5)));
  const fov = 68 + fast * 12 + (kart.boost > 0 ? 8 : 0);
  st.fov += (fov - st.fov) * (1 - Math.exp(-dt * 4));
  camera.fov = st.fov;
  camera.updateProjectionMatrix();
  camera.position.copy(st.pos);
  camera.lookAt(st.look);
}
