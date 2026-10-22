// Global City のワープ（2026-10-20）: 3つ目の輪っかを過ぎると、光のトンネル。星が線になって、前から後ろへ速く流れる
// カメラについていく（userData.followCamera）。見えるのはワープの間だけ（userData.stages = ['warp']）
import * as THREE from '../../../vendor/three.module.min.js?v=522d1bc';
import { landmark } from './kit.js?v=522d1bc';

const STREAKS = 400;
const DEPTH = 700; // 線が流れてくる奥行き（m）
const RINGS = 8; // 光の輪の数
// ワープの最後（2026-10-22 のユーザー依頼「最後は正面の円の中心にカートが小さくなりつつ勢いよく吸い込まれてフェードアウト」）:
// 正面に光の円が出て、車がその真ん中へ吸いこまれ、そのあと白く消える。SUCK はワープの進み（0〜1）の、吸いこむ間
export const SUCK = { from: 0.8, to: 0.9 };
export const PORTAL_Z = 90; // 光の円の、カメラからの奥行き（m）
const PORTAL_R = 14;

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
  // 正面の光の円（まぶしい輪と、うすく光る中）
  const portal = new THREE.Group();
  portal.position.set(0, 0, -PORTAL_Z);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(PORTAL_R, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(PORTAL_R, 1.4, 8, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0 }));
  for (const m of [glow, rim]) {
    m.frustumCulled = false;
    m.userData.keep = true;
    portal.add(m);
  }
  portal.userData = { glow, rim };
  g.add(portal);
  g.userData.portal = portal;
  landmark(g, 'warpTunnel', 0, 0, -DEPTH / 2);
  return root;
}

// ワープの見た目（p はワープの進み 0〜1。2026-10-21 のユーザー依頼「10秒くらいかけてもっと壮大に」）:
// だんだん速く、色は青 → むらさき → ピンク、最後に白く光ってクアラルンプールに着く
// portal は正面の光の円の濃さ（吸いこむ前に出てくる）、suck は吸いこみの進み（0〜1）
const clamp01 = (x) => Math.max(0, Math.min(1, x));
export function warpLook(p) {
  return {
    speed: 300 + 2600 * p * p,
    hue: 0.62 - 0.5 * p,
    flash: clamp01((p - 0.88) / 0.07),
    portal: clamp01((p - 0.62) / 0.15),
    suck: clamp01((p - SUCK.from) / (SUCK.to - SUCK.from)),
  };
}

// 吸いこまれる車の、カメラから見た位置と大きさ。start は吸いこみはじめの位置。k は吸いこみの進み（0〜1）。
// はじめはゆっくり、最後に速く（勢いよく）円の真ん中へ
export function suckPose(start, k) {
  const e = k * k * k;
  return {
    x: start.x * (1 - e),
    y: start.y * (1 - e),
    z: start.z + (-PORTAL_Z - start.z) * e,
    scale: 1 - 0.95 * k,
  };
}

// 毎フレーム: カメラの位置と向きについていき、線を前から後ろへ流す。光の輪が前から飛んでくる
export function updateWarp(group, camera, time, p = 0) {
  group.position.copy(camera.position);
  group.quaternion.copy(camera.quaternion);
  const look = warpLook(p);
  const lines = group.userData.lines;
  const pos = lines.geometry.attributes.position;
  const a = pos.array;
  // 前のフレームからの秒。時刻が戻ったとき（同じコースの次のレース）や、とんだときは進めない
  // （コースの形は次のレースでも使い回すので、前のレースの時刻が残り、線と輪が遠くへ消えていた。2026-10-22 のユーザー依頼）
  const step = time - (group.userData.last ?? time);
  const run = (group.userData.run = ((group.userData.run ?? 0) + (step > 0 && step < 0.5 ? step : 0) * look.speed) % (DEPTH * 1000));
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
  const { glow, rim } = group.userData.portal.userData;
  group.userData.portal.visible = look.portal > 0;
  glow.material.opacity = look.portal * (0.55 + 0.15 * Math.sin(time * 12)); // ちらちら光る
  rim.material.opacity = look.portal;
  rim.material.color.setHSL(look.hue, 0.6, 0.85);
  group.userData.portal.scale.setScalar(1 + 0.25 * look.suck); // 吸いこむ間、少し大きく
}
