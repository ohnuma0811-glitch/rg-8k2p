// Global City の宇宙と発射台（2026-10-20）: 京都の嵐山から打ち上がって、宇宙（星・地球・月・いん石）を見て、香港に着陸する
// 宇宙の景色はカメラについていく（userData.followCamera）。見えるのは宇宙の自動の区間の間だけ（userData.stages = ['space']）
import * as THREE from '../../../vendor/three.module.min.js?v=bdab420';
import { createBuilder } from '../town/builder.js?v=bdab420';
import { landmark, sOf, pointAt, beside, roadBanner } from './kit.js?v=bdab420';

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
  // 地球（2026-10-21 のユーザー依頼「本物ぽくない。凹凸がありすぎる」）: なめらかな球に、陸と海の絵（緑・茶色の大陸、白い北極と南極）。
  // その上に、白い雲の層と、青くうっすら光る大気
  const earth = new THREE.Group();
  earth.position.set(0, -900, -1100); // updateSpace でカメラの向きに合わせる
  const surface = new THREE.MeshLambertMaterial({ color: 0x2f6fd0, fog: false });
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const maps = earthMaps();
  if (maps) {
    surface.color.setHex(0xffffff);
    surface.map = maps.ground;
    cloudMat.alphaMap = maps.clouds;
    cloudMat.opacity = 0.9;
  }
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(500, 64, 48), surface));
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(507, 64, 48), cloudMat));
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(530, 64, 48), new THREE.MeshBasicMaterial({ color: 0x6fb6ff, transparent: true, opacity: 0.18, side: THREE.BackSide, fog: false, depthWrite: false })));
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
  g.userData.earth = earth;
  // 動かす形（地球・月・いん石）は、まとめない（まとめると動かせず、カメラの前に灰色の玉が残った。最後のレビュー）
  g.traverse((o) => { o.userData.keep = true; });
  return root;
}

// 宇宙から香港への見え方（p は宇宙の区間の進み 0〜1。2026-10-21 のユーザー依頼「宇宙に飛び出す→地球が見える→地球に突っ込む→画面を切り替えて香港に着地」）:
// はじめは宇宙（地球は小さく遠く）→ 地球がどんどん大きくなり、画面いっぱいに → 白く光って画面を切りかえ、香港に着く。地図はなし
export function spaceLook(p) {
  const zoom = Math.min(1, Math.max(0, (p - 0.2) / 0.65)); // 0.2〜0.85 で地球へ突っこむ
  return { earth: earthPlace(p).scale, zoom, flash: Math.min(1, Math.max(0, (p - 0.76) / 0.12)) };
}

// 地球の大きさと、カメラから見た場所（前・上・横の m）。いちばん近づいても、地球（大気の半径 530m × 大きさ）の中には入らない
// （大きくしすぎて、カメラが地球の中に入り、突きぬけて見えた。2026-10-21 のユーザー依頼）
export function earthPlace(p) {
  const zoom = Math.min(1, Math.max(0, (p - 0.2) / 0.65));
  const ahead = [0, -900 + 900 * zoom, 1100 + 900 * zoom];
  const dist = Math.hypot(ahead[1], ahead[2]);
  const scale = Math.min(0.25 + 3.4 * zoom * zoom * zoom, (dist * 0.95) / 530);
  return { scale, ahead };
}

// 宇宙の景色を毎フレーム動かす（カメラについていく。いん石を流す。地球を回す）
const fwd = new THREE.Vector3();
export function updateSpace(group, camera, time, p = 0) {
  const look = spaceLook(p);
  const earth = group.userData.earth;
  if (earth) {
    const e = earthPlace(p);
    earth.scale.setScalar(e.scale);
    earth.userData.ahead = e.ahead; // 突っこむほど、正面に大きく（地球の中には入らない）
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
  // 急に上る路面（2026-10-21 のユーザー依頼「コンクリートだけでなく、超加速するようなサインを急上昇する路面に」）:
  // 坂の面（紺色の金属の板）と、その上に、上へ向かう光る「＞」の矢印をずらっと
  {
    const pos = [];
    const step = 1.5;
    for (let s = s0; s < s0 + 66; s += step) {
      const p = pointAt(track, s);
      const q = pointAt(track, s + step);
      const l1 = beside(p, -(p.half + 1));
      const r1 = beside(p, p.half + 1);
      const l2 = beside(q, -(q.half + 1));
      const r2 = beside(q, q.half + 1);
      pos.push(l1.x, p.y + 0.05, l1.z, r1.x, p.y + 0.05, r1.z, l2.x, q.y + 0.05, l2.z, r1.x, p.y + 0.05, r1.z, r2.x, q.y + 0.05, r2.z, l2.x, q.y + 0.05, l2.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x1a2a4a, side: THREE.DoubleSide })));
    for (let s = s0 + 2, k = 0; s < s0 + 62; s += 4, k++) {
      const p = pointAt(track, s);
      const q = pointAt(track, s + 3);
      const tip = { x: q.x, z: q.z };
      const color = k % 2 ? 0x2de0ff : 0xffe12d;
      for (const side of [-1, 1]) {
        const back = beside(p, side * 6);
        glow.rod(back.x, p.y + 0.25, back.z, tip.x, q.y + 0.25, tip.z, 0.35, color, 4);
      }
      landmark(g, 'launchChevron', q.x, q.y, q.z);
    }
  }
  // 手前のアーチと「LAUNCH PAD」（2026-10-21 のユーザー依頼「直前にアーチと『発射台』という英語表記」）
  {
    const sa = s0 - 25;
    const p = pointAt(track, sa);
    const w = p.wall + 1.5;
    landmark(g, 'launchArch', p.x, p.y, p.z);
    glow.push(p.x, p.y, p.z, ryAlong(p.h));
    for (const side of [-1, 1]) glow.box(1.2, 11, 1.2, 0x2de0ff, side * w, 0, 0); // 光る柱
    for (let k = 0; k < 12; k++) { // 上のアーチ（半円）
      const a0 = (Math.PI * k) / 12;
      const a1 = (Math.PI * (k + 1)) / 12;
      glow.rod(-Math.cos(a0) * w, 11 + Math.sin(a0) * 5, 0, -Math.cos(a1) * w, 11 + Math.sin(a1) * 5, 0, 0.5, 0xff7a1a, 4);
    }
    glow.pop();
    roadBanner(g, b, track, sa + 1, 'LAUNCH PAD', 'launchPadBanner', { bg: '#0a1a3a', fg: '#7fe8ff' });
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

// 地球の絵（緯度・経度の長方形の絵）: なめらかなまだらの値（いくつかの大きさの波を重ねる）で、陸と海、雲を描く。node のテストでは作らない
function earthMaps() {
  if (typeof document === 'undefined') return null;
  const W = 512;
  const H = 256;
  // 決まった種からの、なめらかなまだら
  const field = (seed) => {
    const waves = Array.from({ length: 7 }, (_, k) => ({ fx: (k + 1) * 1.7 + seed, fy: (k + 2) * 1.3 + seed * 0.7, ph: k * 2.1 + seed * 3, a: 1 / (k + 1) }));
    return (u, v) => {
      let n = 0;
      for (const w of waves) n += w.a * Math.sin(u * w.fx * Math.PI * 2 + Math.sin(v * w.fy * 3 + w.ph)) * Math.cos(v * w.fy * Math.PI + w.ph);
      return n;
    };
  };
  const landN = field(1.3);
  const cloudN = field(4.7);
  const make = (paint) => {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) paint(x / W, y / H, img.data, (y * W + x) * 4);
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const ground = make((u, v, d, o) => {
    const lat = Math.abs(v - 0.5) * 2; // 0 赤道、1 極
    const n = landN(u, v);
    let c;
    if (lat > 0.86) c = [240, 244, 248]; // 極の氷
    else if (n > 0.35) c = lat < 0.3 && n < 0.6 ? [196, 170, 110] : n > 0.9 ? [120, 110, 90] : [70, 130, 60]; // 砂漠・山・森
    else c = [20 + n * 20, 60 + n * 30, 140 + n * 40]; // 海（深いほど暗い）
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  });
  const clouds = make((u, v, d, o) => {
    const n = cloudN(u * 1.3, v);
    const a = n > 0.45 ? Math.min(255, (n - 0.45) * 500) : 0;
    d[o] = d[o + 1] = d[o + 2] = a; d[o + 3] = 255;
  });
  return { ground, clouds };
}
