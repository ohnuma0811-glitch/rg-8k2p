// カートと運転するキャラの形。キャラは丸い大きな頭の「ちびキャラ」を、形の部品を組み合わせて作る
// （M1 は Kyugo と Soki。M3 で8キャラにする。髪型・色・耳などを変えれば同じ作りで足せる）
import * as THREE from '../../vendor/three.module.min.js?v=66c0a46';
import { PHYS } from '../game/kart.js?v=66c0a46';

const mats = new Map();
// 同じ色の材質は使い回す（8台になっても軽く）
function mat(color) {
  if (!mats.has(color)) mats.set(color, new THREE.MeshLambertMaterial({ color }));
  return mats.get(color);
}

function mesh(geo, color, x, y, z) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  return m;
}

function box(w, h, d, color, x, y, z) {
  return mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z);
}

function ball(r, color, x, y, z, segs = 12) {
  return mesh(new THREE.SphereGeometry(r, segs, Math.round(segs * 0.7)), color, x, y, z);
}

const SKIN = 0xf2c9a0;
const HAIR = 0x1a1a1a;
const EYE = 0x1a1a1a;
const MOUTH = 0x7a2a2a;
const WHITE = 0xffffff;
const DARK = 0x1d2430;

// キャラの見た目。前は +x 向き。座席に座った形で、原点は座面
export const CHARACTERS = {
  kyugo: { hair: 'spiky', shirt: 0xc11f0a, face: 'human' }, // 顔は人間らしく（2026-10-14 のユーザー依頼）
  soki: { hair: 'bowl', shirt: 0x1c3c88 },
};

// 頭（顔は +x 向き）。半径 R の丸い頭に、目・口・耳・髪
const MOUTH_MAT = new THREE.MeshLambertMaterial({ color: MOUTH, side: THREE.DoubleSide }); // 口は裏からも見える（使い回す）

// 人間らしい顔（タイトルの絵のように）: 白目と黒目と光、太いまゆ、小さな鼻、歯の見える笑った口
function humanFace(g, R) {
  const BROW = 0x1d1d24;
  for (const side of [-1, 1]) {
    const z = side * 0.14;
    const white = ball(0.075, WHITE, R * 0.8, 0.04, z, 10); // 横から見て、顔から飛び出さないように少し奥に
    white.scale.set(0.55, 1.2, 1);
    g.add(white);
    const iris = ball(0.05, 0x3a2412, R * 0.8 + 0.03, 0.03, z * 0.97, 10);
    iris.scale.set(0.5, 1.15, 1);
    g.add(iris);
    const pupil = ball(0.028, EYE, R * 0.8 + 0.05, 0.03, z * 0.97, 8);
    pupil.scale.set(0.5, 1.1, 1);
    g.add(pupil);
    g.add(ball(0.016, WHITE, R * 0.8 + 0.065, 0.07, z * 0.97 + 0.015, 6));
    // まゆ（外側が少し上がった、きりっとしたまゆ）
    const brow = box(0.03, 0.04, 0.13, BROW, R * 0.84, 0.165, z);
    brow.rotation.x = side * 0.25;
    g.add(brow);
  }
  // 鼻（小さなふくらみ）
  const nose = ball(0.045, 0xe9b98e, R * 0.98, -0.04, 0, 8);
  nose.scale.set(0.8, 0.9, 1);
  g.add(nose);
  // 歯の見える、笑った口（下半分の円）
  const mouthGeo = new THREE.CircleGeometry(0.11, 14, Math.PI, Math.PI);
  const mouth = new THREE.Mesh(mouthGeo, MOUTH_MAT);
  mouth.position.set(R * 0.9, -0.13, 0);
  mouth.rotation.y = Math.PI / 2;
  g.add(mouth);
  g.add(box(0.012, 0.035, 0.17, WHITE, R * 0.9 + 0.006, -0.145, 0)); // 上の歯
  // ほっぺ（うすい赤）
  for (const z of [-0.22, 0.22]) {
    const cheek = ball(0.05, 0xf3a0a0, R * 0.78, -0.08, z, 8);
    cheek.scale.set(0.4, 0.7, 1);
    g.add(cheek);
  }
}

// 簡単な顔: たて長の黒い目と白い光、にっこりした口（半分の輪）
function simpleFace(g, R) {
  for (const z of [-0.14, 0.14]) {
    const eye = ball(0.065, EYE, R * 0.88, 0.04, z, 8);
    eye.scale.set(0.6, 1.4, 1);
    g.add(eye);
    g.add(ball(0.022, WHITE, R * 0.92 + 0.02, 0.08, z + 0.02, 6));
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 12, Math.PI), mat(MOUTH));
  smile.position.set(R * 0.93, -0.12, 0);
  smile.rotation.set(0, Math.PI / 2, Math.PI);
  g.add(smile);
}

function head(look) {
  const g = new THREE.Group();
  const R = 0.42;
  const skull = ball(R, SKIN, 0, 0, 0, 16);
  if (look.face === 'human') skull.scale.set(0.97, 1.05, 0.95); // 少したまご形に
  g.add(skull);
  if (look.face === 'human') humanFace(g, R);
  else simpleFace(g, R);
  // 耳
  for (const z of [-R, R]) g.add(ball(0.09, SKIN, 0, 0, z, 8));
  if (look.hair === 'spiky') {
    // ツンツン頭: 頭の上と後ろをおおう髪に、とがった房をいくつも
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(HAIR));
    cap.position.set(-0.03, 0.02, 0);
    // 人間らしい顔のときは、前の髪を上げて、おでこと目が見えるように
    if (look.face === 'human') cap.rotation.z = 0.62;
    g.add(cap);
    const spike = new THREE.ConeGeometry(0.11, 0.32, 6);
    const spikes = [
      [0.12, 0.42, 0, -0.5, 0], [-0.08, 0.45, 0.14, -0.1, 0.4], [-0.08, 0.45, -0.14, -0.1, -0.4],
      [-0.28, 0.32, 0, 0.9, 0], [-0.25, 0.3, 0.22, 0.7, 0.7], [-0.25, 0.3, -0.22, 0.7, -0.7], [0.05, 0.4, 0.25, 0, 0.6], [0.05, 0.4, -0.25, 0, -0.6],
    ];
    for (const [x, y, z, rz, rx] of spikes) {
      const s = new THREE.Mesh(spike, mat(HAIR));
      s.position.set(x, y, z);
      s.rotation.set(rx, 0, rz);
      g.add(s);
    }
  } else {
    // おわん形: 頭の上半分をすっぽりおおい、前髪は横一直線
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(R * 1.1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(HAIR));
    bowl.position.set(-0.02, 0.06, 0);
    g.add(bowl);
    g.add(box(0.12, 0.12, R * 1.9, HAIR, R * 0.82, 0.14, 0));
  }
  return g;
}

// 座った体（シャツと胸の白いマーク）、腕、ハンドル
function driver(look) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.5, 10), mat(look.shirt));
  body.position.set(0, 0.25, 0);
  g.add(body);
  g.add(box(0.02, 0.12, 0.12, WHITE, 0.28, 0.32, 0)); // 胸のマーク
  // 腕（そで → 手）を前に出して、ハンドルを握る
  for (const z of [-0.28, 0.28]) {
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.32, 8), mat(look.shirt));
    sleeve.position.set(0.12, 0.38, z);
    sleeve.rotation.z = -Math.PI / 2.6;
    g.add(sleeve);
    g.add(ball(0.08, SKIN, 0.42, 0.3, z * 0.85, 8));
  }
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.04, 6, 16), mat(DARK));
  wheel.position.set(0.48, 0.3, 0);
  wheel.rotation.y = Math.PI / 2;
  wheel.rotation.x = 0;
  wheel.rotation.z = 0.5;
  g.add(wheel);
  g.add(box(0.3, 0.05, 0.05, DARK, 0.62, 0.18, 0)); // ハンドルの軸
  const h = head(look);
  h.position.set(0.02, 0.92, 0);
  g.add(h);
  g.userData.head = h;
  return g;
}

// 前は +x 向き。kart.heading に合わせて rotation.y = -heading にする
// マリオカート64 のような、低くて細いゴーカート。太いタイヤが目立ち、キャラは車に対して大きい（頭が車の幅くらい）
const DRIVER_SCALE = 1.6;
// shirt を渡すと、シャツの色だけ変える（CPU の見分けに使う）
export function createKartModel({ body = 0xc11f0a, character = 'kyugo', shirt } = {}) {
  const g = new THREE.Group();
  g.add(box(2.1, 0.18, 1.1, DARK, 0, 0.32, 0)); // 骨組み（低くて細い）
  g.add(box(0.7, 0.32, 1.2, body, 1.0, 0.45, 0)); // 前のカバー
  g.add(box(0.25, 0.2, 1.7, body, 1.35, 0.35, 0)); // 前のバンパー
  for (const z of [-0.62, 0.62]) g.add(box(1.0, 0.28, 0.22, body, -0.25, 0.42, z)); // 横のカバー
  g.add(box(0.25, 0.22, 1.6, DARK, -1.15, 0.45, 0)); // 後ろのバンパー
  g.add(box(0.7, 0.1, 0.9, DARK, -0.4, 0.5, 0)); // 座席
  const wheels = [];
  const front = new THREE.CylinderGeometry(0.38, 0.38, 0.38, 12);
  front.rotateX(Math.PI / 2);
  const rear = new THREE.CylinderGeometry(0.45, 0.45, 0.5, 12);
  rear.rotateX(Math.PI / 2);
  for (const [x, z, geo] of [[0.85, 0.85, front], [0.85, -0.85, front], [-0.85, 0.9, rear], [-0.85, -0.9, rear]]) {
    const w = new THREE.Mesh(geo, mat(DARK));
    w.position.set(x, geo === rear ? 0.45 : 0.38, z);
    g.add(w);
    // ホイールの色（タイヤの外側の丸）
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 10), mat(0xf1c453));
    hub.rotation.x = Math.PI / 2;
    hub.position.set(x, geo === rear ? 0.45 : 0.38, z + Math.sign(z) * (geo === rear ? 0.26 : 0.2));
    g.add(hub);
    wheels.push(w);
  }
  const d = driver(shirt === undefined ? CHARACTERS[character] : { ...CHARACTERS[character], shirt });
  d.scale.setScalar(DRIVER_SCALE);
  d.position.set(-0.45, 0.5, 0);
  g.add(d);
  g.userData.wheels = wheels;
  g.userData.head = d.userData.head;
  return g;
}

export function syncKartModel(model, kart) {
  // ドリフトボタンで小さく跳ねる
  const hop = kart.hop > 0 ? Math.sin((1 - kart.hop / PHYS.HOP_TIME) * Math.PI) * PHYS.HOP_HEIGHT : 0;
  model.position.set(kart.x, kart.y + hop, kart.z);
  model.rotation.y = -kart.heading;
  // ドリフト中は内側を向き、進む向きと車の向きのずれが見える
  model.visible = kart.respawn <= 0 || Math.floor(kart.respawn * 8) % 2 === 0;
  for (const w of model.userData.wheels) w.rotation.z -= kart.speed * 0.05;
  // ハンドルを切る向きに、頭を少しかたむける
  model.userData.head.rotation.x = kart.drift.active ? kart.drift.dir * 0.25 : 0;
}

// 名前の札（キャラの頭の上）。画面の上での大きさは、遠くても近くても同じ（遠くの車もだれか分かるように）
const TAG_SCREEN = 0.07; // 札の高さ（画面の高さに対する割合 × 視野の広さ。だいたい画面の6%）
export function createNameTag(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 40px system-ui, sans-serif';
  const w = Math.min(248, ctx.measureText(text).width + 36);
  const x = (256 - w) / 2;
  ctx.fillStyle = 'rgba(10, 20, 30, 0.7)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  // 角の丸い四角（roundRect は iOS 15 にないので、円弧でかく）
  ctx.beginPath();
  ctx.arc(x + 26, 32, 26, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.arc(x + w - 26, 32, 26, -Math.PI / 2, Math.PI / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34, 220);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, sizeAttenuation: false, depthWrite: false }));
  sprite.scale.set(TAG_SCREEN * 4, TAG_SCREEN, 1);
  sprite.position.set(-0.45, 4.3, 0); // 頭のてっぺん（約3m）の上
  return sprite;
}
