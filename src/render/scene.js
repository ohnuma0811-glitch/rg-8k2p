// Three.js の場面: 空、地面、光、遠くの山、コース、追いかけるカメラ
import * as THREE from '../../vendor/three.module.min.js?v=2840473';
import { buildTrackMesh } from './trackMesh.js?v=2840473';

const SKY = 0x8fd3ff;

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setClearColor(SKY);
  return renderer;
}

export function createWorld() {
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
  scene.userData.ground = ground;

  // 遠くの山はコースごとにちがうので、コースの形と一緒に作る（src/render/trackMesh.js の mountains）
  const camera = new THREE.PerspectiveCamera(70, 1, 0.5, 2000);
  return { scene, camera };
}

// コースの形を入れかえる（レースごと）。形は一度作ったら、その track に取っておいて使い回す
export function setCourse(scene, track) {
  if (scene.userData.course === track) return;
  if (scene.userData.course) scene.remove(scene.userData.course.mesh);
  if (!track.mesh) track.mesh = buildTrackMesh(track);
  scene.add(track.mesh);
  scene.userData.course = track;
  // 森は地面の形を作るので、平らな地面は川の底より下へ（2026-10-16）
  if (scene.userData.ground) scene.userData.ground.position.y = track.def.theme === 'forest' ? -2.5 : 0;
}

export function resizeRenderer(renderer, camera, w, h, ratio) {
  renderer.setPixelRatio(ratio);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// マリオカート64 のように、少し遠く低い所から追いかける。車は画面の真ん中より少し下に映る
// カメラは車の「進む向き」に遅れて回るので、カーブやドリフトでは車の横腹が見える
export const CAM_BACK = 6.3; // 車の何m後ろ（キャラが画面の下の方に大きく映る。近いほど、まわりの物が速く流れて見える）
export const CAM_HEIGHT = 3.7; // 車から何m上（キャラの頭のてっぺん約3mより上。まっすぐな道で、キャラが地平線より下に映る）
const CAM_AHEAD = 14; // 車の何m先を見るか（遠くを見るほど、キャラは画面の下の方に映り、先の道が広く見える）
const CAM_LOOK_Y = 0.3; // 見る所の高さ（低いほど下を向き、車全体が画面に入る。高いほど、キャラは画面の下の方に映る）
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
  camera.lookAt(kart.x + fx * CAM_AHEAD, kart.y + CAM_LOOK_Y, kart.z + fz * CAM_AHEAD);
}

const FRONT_DIST = 4.5; // 前から見るとき、車の何m前
const FRONT_HEIGHT = 2.2; // 前から見るとき、車から何m上
const FRONT_LOOK_Y = 1.4; // 前から見るとき、見る所の高さ（キャラの顔）
const FRONT_FOV = 50;

// 確かめ用: 車を前から見る（キャラの顔を見るため）
export function updateFrontCamera(camera, kart) {
  const fx = Math.cos(kart.heading);
  const fz = Math.sin(kart.heading);
  camera.fov = FRONT_FOV;
  camera.updateProjectionMatrix();
  camera.position.set(kart.x + fx * FRONT_DIST, kart.y + FRONT_HEIGHT, kart.z + fz * FRONT_DIST);
  camera.lookAt(kart.x, kart.y + FRONT_LOOK_Y, kart.z);
}

// スタートの前（2026-10-14 のユーザー依頼）: カメラはコースの前から、正面を向いた車たちを見て、
// 横へふくらみながら上を通りすぎ、向きを変えて、走るときのカメラの位置で止まる。そのあとカウントが始まる
export const START_FLY_TIME = 4;
const FLY_FROM = 34; // 最初、自分の車の何m前か（前の列の車より15mほど前）
const FLY_SIDE = 10; // 途中で横へふくらむ幅（m。真下を見て向きが急に変わらないように）
const FLY_UP = 6; // 途中で高く上がる分（m）

// t 秒のカメラ。自分の車から見て、d は前へ、lat は右へ、y は上へ（m）。見る所は td（前へ）、ty（上へ）
export function startFly(t) {
  const x = Math.max(0, Math.min(1, t / START_FLY_TIME));
  const e = x * x * (3 - 2 * x);
  const mix = (a, b) => a + (b - a) * e;
  return {
    d: mix(FLY_FROM, -CAM_BACK),
    lat: FLY_SIDE * Math.sin(Math.PI * e),
    y: mix(3, CAM_HEIGHT) + FLY_UP * Math.sin(Math.PI * e),
    td: mix(0, CAM_AHEAD),
    ty: mix(1.5, CAM_LOOK_Y),
  };
}

// スタートの前のカメラ。終わりの位置は走るときのカメラと同じなので、そのまま走るときのカメラにつながる
export function updateStartCamera(camera, kart, t) {
  const f = startFly(t);
  const fx = Math.cos(kart.heading);
  const fz = Math.sin(kart.heading);
  camera.fov = FOV_BASE;
  camera.updateProjectionMatrix();
  camera.position.set(kart.x + fx * f.d - fz * f.lat, kart.y + f.y, kart.z + fz * f.d + fx * f.lat);
  camera.lookAt(kart.x + fx * f.td, kart.y + f.ty, kart.z + fz * f.td);
  // 走るときのカメラが、ここから続けて動くように
  const st = camera.userData;
  st.h = kart.heading;
  st.fov = FOV_BASE;
  st.pos = camera.position.clone();
  st.placed = true;
}

// ゴールのあと: 後ろから横を回って前へ、この秒数でゆっくり回り、前で止まる（2026-10-14 のユーザー依頼）
export const FINISH_ORBIT_TIME = 4;
const FINISH_DIST = 5.5; // 前で止まったとき、車の何m前（頭にぶつからず、車とキャラ全体が入る）
const FINISH_HEIGHT = 2.4; // 前で止まったとき、車から何m上
const FINISH_LOOK_Y = 2.0; // 前で止まったとき、見る所の高さ（キャラの顔）
const FINISH_AIM = 0.35; // 回り始めてから、この割合までに、見る所を車の先から車へ移す（横から見るとき、車が画面の真ん中に来るように）

// ゴールから t 秒のカメラ。angle は真後ろ 0 → 真正面 π。dist・height は車からの距離と高さ、
// ahead は見る所が車の何m先か、lookY は見る所の高さ
export function finishOrbit(t) {
  const x = Math.max(0, Math.min(1, t / FINISH_ORBIT_TIME));
  const u = x * x * (3 - 2 * x); // ゆっくり動き出して、ゆっくり止まる
  const mix = (a, b) => a + (b - a) * u;
  return {
    angle: Math.PI * u,
    dist: mix(CAM_BACK, FINISH_DIST),
    height: mix(CAM_HEIGHT, FINISH_HEIGHT),
    ahead: CAM_AHEAD * Math.max(0, 1 - u / FINISH_AIM),
    lookY: mix(CAM_LOOK_Y, FINISH_LOOK_Y),
    fov: mix(FOV_BASE, FRONT_FOV),
  };
}

// ゴールのあとのカメラ（t はゴールからの秒）。車の向きには、走っているときと同じように少し遅れてついていく
export function updateFinishCamera(camera, kart, t, dt) {
  const st = camera.userData;
  if (st.h === undefined) st.h = kart.move;
  st.h += Math.atan2(Math.sin(kart.move - st.h), Math.cos(kart.move - st.h)) * Math.min(1, CAM_TURN * dt);
  const o = finishOrbit(t);
  const fx = Math.cos(st.h);
  const fz = Math.sin(st.h);
  const a = st.h + Math.PI + o.angle; // 車から見たカメラの方向（真後ろから回る）
  camera.fov = o.fov;
  camera.updateProjectionMatrix();
  camera.position.set(kart.x + Math.cos(a) * o.dist, kart.y + o.height, kart.z + Math.sin(a) * o.dist);
  camera.lookAt(kart.x + fx * o.ahead, kart.y + o.lookY, kart.z + fz * o.ahead);
}
