// Global City の宇宙と発射台（2026-10-20）: 京都の嵐山から打ち上がって、宇宙（星・地球・月・いん石）を見て、香港に着陸する
// 宇宙の景色はカメラについていく（userData.followCamera）。見えるのは宇宙の自動の区間の間だけ（userData.stages = ['space']）
import * as THREE from '../../../vendor/three.module.min.js';
import { createBuilder } from '../town/builder.js';
import { landmark, sOf, pointAt } from './kit.js';

const ryAlong = (h) => Math.atan2(Math.cos(h), Math.sin(h));

export function buildSpace() {
  const root = new THREE.Group();
  const g = new THREE.Group();
  g.userData.stages = ['space'];
  g.userData.followCamera = true;
  root.add(g);
  // 星（半径 1500m の球の上に 1500個）
  const pos = [];
  for (let k = 0; k < 1500; k++) {
    const u = ((k * 9301 + 49297) % 233280) / 233280;
    const v = ((k * 4271 + 1193) % 9973) / 9973;
    const th = u * Math.PI * 2;
    const ph = Math.acos(2 * v - 1);
    pos.push(1500 * Math.sin(ph) * Math.cos(th), 1500 * Math.cos(ph), 1500 * Math.sin(ph) * Math.sin(th));
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false }));
  stars.userData.keep = true;
  g.add(stars);
  landmark(g, 'stars', 0, 0, 0);
  // 地球（下前方。青い海に、緑の陸と白い雲のまだら）
  const earth = new THREE.Group();
  earth.position.set(0, -900, -1100); // updateSpace でカメラの向きに合わせる
  const ball = new THREE.Mesh(new THREE.SphereGeometry(500, 40, 28), new THREE.MeshLambertMaterial({ color: 0x2f6fd0, fog: false }));
  earth.add(ball);
  const b = createBuilder();
  for (let k = 0; k < 40; k++) {
    const a = k * 2.399963;
    const y = 1 - (2 * (k + 0.5)) / 40;
    const r = Math.sqrt(1 - y * y);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    b.sphere(70 + (k % 4) * 25, k % 3 ? 0x4f9a4a : 0xf4f6f8, x * 470, y * 470, z * 470, 8);
  }
  const land = b.build();
  land.traverse((o) => { if (o.material) o.material = o.material.clone(); if (o.material) o.material.fog = false; });
  earth.add(land);
  earth.userData.spin = 0.02;
  earth.userData.ahead = [0, -900, 1100]; // カメラの前（向き）・上・横の m
  g.add(earth);
  landmark(g, 'earth', 0, -900, -1100);
  // 月（右上）
  const moon = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 16), new THREE.MeshLambertMaterial({ color: 0xc8c8c0, fog: false }));
  const moonG = new THREE.Group();
  moonG.userData.ahead = [700, 500, 1100];
  g.add(moonG);
  moon.position.set(0, 0, 0);
  moonG.add(moon);
  for (let k = 0; k < 8; k++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(18 + (k % 3) * 8, 10, 8), new THREE.MeshLambertMaterial({ color: 0xa8a8a0, fog: false }));
    const a = k * 0.8;
    c.position.set(Math.cos(a) * 95, Math.sin(a) * 70, 85);
    moonG.add(c);
  }
  landmark(g, 'moon', 900, 600, -900);
  // いん石（茶色のごつごつした石。main.js が毎フレーム、カメラの前を横切って流す）
  const meteors = [];
  for (let k = 0; k < 12; k++) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(4 + (k % 4) * 3, 0), new THREE.MeshLambertMaterial({ color: k % 2 ? 0x7a5a3a : 0x8a6a4a, fog: false }));
    m.userData.meteor = { k, speed: 90 + (k % 5) * 35, y: -60 + ((k * 47) % 180), ahead: 260 + ((k * 83) % 420) };
    meteors.push(m);
    g.add(m);
  }
  g.userData.meteors = meteors;
  landmark(g, 'meteors', 0, 0, -400);
  // 光（宇宙は太陽の光が強い）
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(800, 400, 300);
  g.add(sun);
  // 香港の地図（地球にズームしていくと見えてくる。2026-10-21 のユーザー依頼）: 青い海、緑の島、白い道、赤い印と「HONG KONG」
  const map = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  if (typeof document !== 'undefined') {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    const c = cv.getContext('2d');
    c.fillStyle = '#1f5f9a';
    c.fillRect(0, 0, 512, 512);
    c.fillStyle = '#3f8a4a';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(512, 0); c.lineTo(512, 190); c.bezierCurveTo(380, 230, 200, 200, 0, 230); c.fill(); // 九龍（北）
    c.beginPath(); c.moveTo(60, 300); c.bezierCurveTo(150, 260, 330, 270, 450, 300); c.bezierCurveTo(470, 380, 360, 450, 250, 440); c.bezierCurveTo(140, 450, 40, 380, 60, 300); c.fill(); // 香港島
    c.beginPath(); c.arc(40, 470, 40, 0, Math.PI * 2); c.fill(); // 小さな島
    c.strokeStyle = '#ffffff';
    c.lineWidth = 3;
    for (const y of [60, 120, 170]) { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y - 20); c.stroke(); }
    for (const x of [100, 220, 340, 450]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 20, 200); c.stroke(); }
    c.beginPath(); c.moveTo(80, 320); c.bezierCurveTo(200, 300, 330, 300, 440, 320); c.stroke(); // 香港島の道
    c.fillStyle = '#ff3a3a';
    c.beginPath(); c.arc(256, 318, 12, 0, Math.PI * 2); c.fill(); // ここに着く
    c.font = 'bold 44px sans-serif';
    c.textAlign = 'center';
    c.fillStyle = '#ffffff';
    c.fillText('HONG KONG', 256, 380);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    map.material.map = tex;
  }
  map.userData.ahead = [0, -500, 900];
  map.frustumCulled = false;
  g.add(map);
  g.userData.map = map;
  g.userData.earth = earth;
  // 動かす形（地球・月・いん石）は、まとめない（まとめると動かせず、カメラの前に灰色の玉が残った。最後のレビュー）
  g.traverse((o) => { o.userData.keep = true; });
  return root;
}

// 宇宙から香港への見え方（p は宇宙の区間の進み 0〜1。2026-10-21 のユーザー依頼）:
// はじめは宇宙（地球は小さく遠く）→ 地球が大きくなる → 地球へズーム → 香港の地図 → コースに着く
export function spaceLook(p) {
  const zoom = Math.min(1, Math.max(0, (p - 0.25) / 0.5)); // 0.25〜0.75 で地球へ近づく
  return { earth: 0.25 + 3.5 * zoom * zoom, zoom, map: Math.min(1, Math.max(0, (p - 0.68) / 0.12)) };
}

// 宇宙の景色を毎フレーム動かす（カメラについていく。いん石を流す。地球を回す）
const fwd = new THREE.Vector3();
export function updateSpace(group, camera, time, p = 0) {
  const look = spaceLook(p);
  const earth = group.userData.earth;
  if (earth) {
    earth.scale.setScalar(look.earth);
    earth.userData.ahead = [0, -900 + 500 * look.zoom, 1100 + 400 * look.zoom]; // 近づくと、前の少し下に大きく
    earth.visible = look.map < 1;
  }
  const map = group.userData.map;
  if (map) {
    map.material.opacity = look.map;
    map.visible = look.map > 0;
  }
  group.position.copy(camera.position);
  // 地球と月は、カメラの向き（水平の前）に合わせて置く（どちらへ飛んでも前に見える）
  camera.getWorldDirection(fwd);
  fwd.y = 0;
  if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
  fwd.normalize();
  const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
  for (const c of group.children) {
    const a = c.userData.ahead;
    if (!a) continue;
    c.position.set(fwd.x * a[2] + side.x * a[0], a[1], fwd.z * a[2] + side.z * a[0]);
  }
  for (const m of group.userData.meteors ?? []) {
    const d = m.userData.meteor;
    // カメラの前（ahead m）を、横切って流れる
    const x = ((time * d.speed + d.k * 300) % 1600) - 800;
    m.position.set(fwd.x * d.ahead + side.x * x, d.y, fwd.z * d.ahead + side.z * x);
    m.rotation.set(time * 0.7 + d.k, time * 0.5, 0);
  }
  for (const c of group.children) if (c.userData.spin) c.rotation.y = time * c.userData.spin;
  if (map) map.lookAt(camera.position); // 地図はカメラの方を向く
}

// 発射台のレール（加速板の巨大版。LP から 約60m、青白い2本のレールと、オレンジの光の矢印、両わきの炎のような光）
export function buildLaunchRail(track) {
  const root = new THREE.Group();
  const g = new THREE.Group();
  g.userData.stages = [2, 'space']; // 打ち上がって宇宙にいる間も見える
  root.add(g);
  const b = createBuilder();
  const glow = createBuilder({ glow: true });
  const s0 = sOf(track, 'LP');
  for (let s = s0 - 40; s <= s0 + 66; s += 2) {
    const p = pointAt(track, s);
    const q = pointAt(track, s + 2);
    const up = s > s0;
    // 道の下の土台（レールの下は鉄の骨組み）
    if (up && p.y > 1) b.box(2 * p.half, Math.max(0.5, p.y - 0.5), 1.2, 0x5a6168, p.x, 0, p.z);
    for (const side of [-1, 1]) {
      const lx = -Math.sin(p.h) * side * (p.half - 2);
      const lz = Math.cos(p.h) * side * (p.half - 2);
      glow.rod(p.x + lx, p.y + 0.3, p.z + lz, q.x + lx, q.y + 0.3, q.z + lz, 0.45, 0x9fe8ff, 6); // 光るレール
      if (Math.round(s) % 6 === 0) {
        const fx = -Math.sin(p.h) * side * (p.half + 2);
        const fz = Math.cos(p.h) * side * (p.half + 2);
        glow.cyl(0, 1.4, 4, 6, Math.round(s) % 12 ? 0xff7a1a : 0xffd23a, p.x + fx, p.y, p.z + fz, true); // 炎のような光
      }
    }
    if (Math.round(s) % 4 === 0) {
      glow.push(p.x, p.y + 0.1, p.z, ryAlong(p.h));
      for (const side of [-1, 1]) glow.box(7, 0.08, 1.4, 0xff9a00, side * 2.6, 0, 0, side * 0.7); // オレンジの矢印
      glow.pop();
    }
  }
  // 雲（打ち上がると、雲を突きぬける）: 空の道すじの高さ 150〜320m のまわりに、白いかたまり
  const clouds = createBuilder({ glow: true });
  for (let s = s0 + 60, k = 0; s <= s0 + 900; s += 45, k++) {
    const q = pointAt(track, s);
    if (q.y < 150 || q.y > 330) continue;
    for (const side of [-1, 1]) {
      const off = 45 + ((k * 7) % 5) * 15;
      const x = q.x - Math.sin(q.h) * side * off;
      const z = q.z + Math.cos(q.h) * side * off;
      for (let j = 0; j < 3; j++) clouds.sphere(10 + j * 3, 0xf4f8fc, x + j * 9, q.y + ((k * 13) % 9) - 4 + j * 2, z + j * 5, 8);
    }
  }
  g.add(clouds.build());
  const p = pointAt(track, s0 + 30);
  landmark(g, 'launchRail', p.x, p.y, p.z);
  g.add(b.build(), glow.build());
  return root;
}
