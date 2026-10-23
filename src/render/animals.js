// 動物のキャラの頭と体の飾り（設計書 docs/superpowers/specs/2026-10-22-characters-design.md の 4章）
// 頭は +x が前、半径 R の丸い頭（src/render/models.js の head と同じ大きさ）。体の飾りは driver のグループに足す
import * as THREE from '../../vendor/three.module.min.js?v=cdf967c';

const mats = new Map();
function M(color) {
  if (!mats.has(color)) mats.set(color, new THREE.MeshLambertMaterial({ color }));
  return mats.get(color);
}
function part(geo, color, x, y, z) {
  const m = new THREE.Mesh(geo, M(color));
  m.position.set(x, y, z);
  return m;
}
const ball = (r, c, x, y, z, s = 10) => part(new THREE.SphereGeometry(r, s, Math.round(s * 0.7)), c, x, y, z);
const box = (w, h, d, c, x, y, z) => part(new THREE.BoxGeometry(w, h, d), c, x, y, z);
const cone = (r, h, c, x, y, z) => part(new THREE.ConeGeometry(r, h, 8), c, x, y, z);

const R = 0.42;
const BLACK = 0x1a1a1a;
const WHITE = 0xffffff;
const PINK = 0xf4a3b8;

// 目: たて長の目と白い光（Kyugo・Soki と同じかわいい目）
function eyes(g, color = BLACK) {
  for (const z of [-0.14, 0.14]) {
    const e = ball(0.065, color, R * 0.88, 0.04, z, 8);
    e.scale.set(0.6, 1.4, 1);
    g.add(e);
    g.add(ball(0.022, WHITE, R * 0.92 + 0.02, 0.08, z + 0.02, 6));
  }
}

// にっこりした口
function smile(g, y = -0.14) {
  const m = part(new THREE.TorusGeometry(0.08, 0.02, 6, 10, Math.PI), 0x7a2a2a, R * 0.93, y, 0);
  m.rotation.set(0, Math.PI / 2, Math.PI);
  g.add(m);
}

// Penguin-man（docs/reference/penguin-man.webp）: 黒い頭に白い顔、黒いサングラス（白い2本線の光）、黄色いくちばし、頭のツンツンの毛
function penguin(g) {
  g.add(ball(R, BLACK, 0, 0, 0, 16));
  const face = ball(R * 0.78, WHITE, R * 0.55, -0.04, 0, 14); // 白い顔は、黒い頭より前に出す（うまって見えなかった。2026-10-22）
  face.scale.set(0.7, 0.9, 1);
  g.add(face);
  for (const z of [-0.13, 0.13]) {
    g.add(box(0.05, 0.13, 0.2, BLACK, R * 1.05, 0.07, z));
    for (const dy of [0.025, -0.025]) {
      const l = box(0.06, 0.018, 0.12, WHITE, R * 1.05 + 0.03, 0.07 + dy, z);
      l.rotation.x = 0.5;
      g.add(l);
    }
  }
  g.add(box(0.05, 0.03, 0.08, BLACK, R * 1.07, 0.09, 0));
  const beak = cone(0.08, 0.2, 0xf5b400, R * 1.18, -0.08, 0);
  beak.rotation.z = -Math.PI / 2;
  g.add(beak);
  for (const [x, z, r] of [[0, 0, 0], [-0.08, 0.09, 0.4], [-0.08, -0.09, -0.4]]) {
    const s = cone(0.05, 0.2, BLACK, x, R + 0.06, z);
    s.rotation.x = r;
    g.add(s);
  }
}

// Rabbit Girl: 白いうさぎ、長い耳（内がわピンク）、赤いリボン
function rabbit(g) {
  const FUR = 0xf7f4f0;
  g.add(ball(R, FUR, 0, 0, 0, 16));
  eyes(g);
  smile(g);
  g.add(ball(0.04, PINK, R * 0.98, -0.05, 0, 6));
  for (const z of [-0.13, 0.13]) {
    const ear = ball(0.12, FUR, -0.05, R + 0.28, z, 10);
    ear.scale.set(0.45, 2.2, 0.8);
    g.add(ear);
    const inner = ball(0.08, PINK, 0, R + 0.28, z, 8);
    inner.scale.set(0.3, 2.0, 0.6);
    g.add(inner);
  }
  for (const s of [-1, 1]) {
    const wing = cone(0.08, 0.16, 0xe0202a, 0, R + 0.06, 0.2 + s * 0.09);
    wing.rotation.x = (s * Math.PI) / 2;
    g.add(wing);
  }
  g.add(ball(0.045, 0xe0202a, 0, R + 0.06, 0.2, 6));
}

// Mouse Boy: 灰色のねずみ、大きな丸い耳（内がわピンク）、ピンクの鼻とひげ
function mouse(g) {
  const FUR = 0x9a9aa6;
  g.add(ball(R, FUR, 0, 0, 0, 16));
  const snout = ball(0.16, 0xc8c8d0, R * 0.8, -0.08, 0, 10);
  snout.scale.set(1, 0.7, 0.9);
  g.add(snout);
  eyes(g);
  g.add(ball(0.05, PINK, R * 0.8 + 0.16, -0.06, 0, 6));
  for (const z of [-1, 1]) {
    const ear = part(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 16), FUR, -0.05, R * 0.75, z * 0.32);
    ear.rotation.z = Math.PI / 2;
    g.add(ear);
    const inner = part(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 14), PINK, -0.01, R * 0.75, z * 0.32);
    inner.rotation.z = Math.PI / 2;
    g.add(inner);
    for (const dy of [-0.02, 0.03]) g.add(box(0.01, 0.01, 0.22, 0x444444, R * 0.8 + 0.1, -0.08 + dy, z * 0.18));
  }
}

// Big Tiger: オレンジの虎、白い口のまわり、丸い耳、黒いしま
function tiger(g) {
  const FUR = 0xf08a24;
  g.add(ball(R, FUR, 0, 0, 0, 16));
  const muzzle = ball(0.18, WHITE, R * 0.78, -0.1, 0, 10);
  muzzle.scale.set(0.8, 0.7, 1.1);
  g.add(muzzle);
  eyes(g);
  g.add(ball(0.045, 0x3a2a2a, R * 0.78 + 0.15, -0.04, 0, 6));
  for (const z of [-0.26, 0.26]) {
    g.add(ball(0.11, FUR, -0.02, R * 0.8, z, 8));
    g.add(ball(0.06, BLACK, 0.03, R * 0.8, z, 6));
  }
  for (const [y, z, r] of [[0.3, 0, 0], [0.24, 0.12, 0.3], [0.24, -0.12, -0.3]]) {
    const s = box(0.03, 0.14, 0.04, BLACK, R * 0.75, y, z);
    s.rotation.x = r;
    g.add(s);
  }
  for (const z of [-1, 1]) for (const y of [0.05, -0.08]) g.add(box(0.14, 0.03, 0.03, BLACK, 0.05, y, z * R * 0.97));
}

// Rampage Elephant: 灰色のぞう、大きな耳（内がわピンク）、長い鼻、白いきば
function elephant(g) {
  const FUR = 0x8c96a0;
  g.add(ball(R, FUR, 0, 0, 0, 16));
  eyes(g);
  for (const z of [-1, 1]) {
    const ear = ball(0.3, FUR, -0.05, 0.02, z * 0.42, 12);
    ear.scale.set(0.25, 1, 1);
    g.add(ear);
    const inner = ball(0.22, PINK, -0.01, 0.02, z * 0.44, 10);
    inner.scale.set(0.15, 0.85, 0.85);
    g.add(inner);
  }
  // 長い鼻: 顔から前へ下がっていく（上が太く、先が細い）。先は少し上を向く
  const trunk = part(new THREE.CylinderGeometry(0.1, 0.06, 0.55, 10), FUR, R * 1.05, -0.24, 0);
  trunk.rotation.z = 0.5;
  g.add(trunk);
  g.add(ball(0.065, FUR, R * 1.05 + 0.14, -0.47, 0, 8));
  for (const z of [-0.12, 0.12]) {
    const tusk = cone(0.03, 0.14, WHITE, R * 0.85, -0.2, z);
    tusk.rotation.z = -2.2;
    g.add(tusk);
  }
}

// Lightning Cat: 黒ねこ、とがった耳（内がわピンク）、黄色い目とたて長のひとみ、白いひげ
function cat(g) {
  const FUR = 0x26262e;
  g.add(ball(R, FUR, 0, 0, 0, 16));
  eyes(g, 0xf5d020);
  for (const z of [-0.14, 0.14]) g.add(box(0.02, 0.09, 0.025, BLACK, R * 0.92 + 0.01, 0.04, z));
  g.add(ball(0.04, PINK, R * 0.99, -0.06, 0, 6));
  for (const z of [-1, 1]) {
    const ear = cone(0.13, 0.26, FUR, -0.02, R * 0.85, z * 0.22);
    ear.rotation.x = z * 0.35;
    g.add(ear);
    const inner = cone(0.07, 0.16, PINK, 0.04, R * 0.82, z * 0.22);
    inner.rotation.x = z * 0.35;
    g.add(inner);
    for (const dy of [-0.02, 0.03]) g.add(box(0.008, 0.008, 0.24, WHITE, R * 0.9, -0.08 + dy, z * 0.2));
  }
}

export const ANIMAL_HEADS = { penguin, rabbit, mouse, tiger, elephant, cat };

// 動物の頭（look.animal の名前で）
export function animalHead(look) {
  const g = new THREE.Group();
  ANIMAL_HEADS[look.animal](g);
  return g;
}

// 体の飾り（driver のグループ g に足す。体は (0, 0.25, 0) の円柱、前は +x）
export function animalBody(g, look) {
  if (look.animal === 'penguin') {
    const belly = ball(0.22, WHITE, 0.2, 0.25, 0, 10);
    belly.scale.set(0.4, 1, 0.9);
    g.add(belly);
    g.add(box(0.18, 0.38, 0.42, 0x7a4a22, -0.33, 0.3, 0)); // 茶色のリュック
  } else if (look.animal === 'mouse') {
    const tail = part(new THREE.TorusGeometry(0.2, 0.025, 6, 12, Math.PI), PINK, -0.42, 0.15, 0); // 細いしっぽ
    tail.rotation.y = Math.PI / 2;
    g.add(tail);
  } else if (look.animal === 'tiger') {
    for (const y of [0.12, 0.25, 0.38]) g.add(box(0.06, 0.05, 0.5, BLACK, -0.27, y, 0)); // 背中のしま
    const tail = part(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8), 0xf08a24, -0.4, 0.2, 0);
    tail.rotation.z = 0.8;
    g.add(tail);
    g.add(ball(0.05, BLACK, -0.55, 0.34, 0, 6));
  } else if (look.animal === 'cat') {
    const scarf = part(new THREE.TorusGeometry(0.27, 0.06, 8, 16), 0xf5c400, 0, 0.52, 0); // 黄色いスカーフ
    scarf.rotation.x = Math.PI / 2;
    g.add(scarf);
    // スカーフの前の、黒い稲妻のもよう（3本のななめの線）
    for (const [y, z, r] of [[0.48, 0.03, 0.6], [0.43, -0.01, -0.6], [0.38, 0.03, 0.6]]) {
      const s = box(0.02, 0.07, 0.025, BLACK, 0.3, y, z);
      s.rotation.x = r;
      g.add(s);
    }
  }
}
