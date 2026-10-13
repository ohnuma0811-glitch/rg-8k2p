// Three.js の場面: 空、地面、光、遠くの山、コース、追いかけるカメラ
import * as THREE from '../../vendor/three.module.min.js?v=655abab';
import { buildTrackMesh } from './trackMesh.js?v=655abab';

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
// 車との距離はいつも同じにして（速くても遠ざからない）、向きだけを少しずつ合わせる
const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();
export function updateChaseCamera(camera, kart, topSpeed, dt) {
  const st = camera.userData;
  if (st.h === undefined) {
    st.h = kart.heading;
    st.y = kart.y;
    st.fov = camera.fov;
  }
  const k = 1 - Math.exp(-dt * 6);
  st.h += Math.atan2(Math.sin(kart.heading - st.h), Math.cos(kart.heading - st.h)) * k;
  st.y += (kart.y - st.y) * (1 - Math.exp(-dt * 8));
  const fx = Math.cos(st.h);
  const fz = Math.sin(st.h);
  _pos.set(kart.x - fx * 4.2, st.y + 2, kart.z - fz * 4.2);
  _look.set(kart.x + fx * 5, st.y + 1, kart.z + fz * 5);
  const fast = Math.max(0, Math.min(1, (kart.speed - topSpeed * 0.5) / (topSpeed * 0.5)));
  const fov = 66 + fast * 6 + (kart.boost > 0 ? 6 : 0);
  st.fov += (fov - st.fov) * (1 - Math.exp(-dt * 4));
  camera.fov = st.fov;
  camera.updateProjectionMatrix();
  camera.position.copy(_pos);
  camera.lookAt(_look);
}
