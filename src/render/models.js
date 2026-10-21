// カートと運転するキャラの形。キャラは丸い大きな頭の「ちびキャラ」を、形の部品を組み合わせて作る
// （M1 は Kyugo と Soki。M3 で8キャラにする。髪型・色・耳などを変えれば同じ作りで足せる）
import * as THREE from '../../vendor/three.module.min.js?v=fd408eb';
import { PHYS } from '../game/kart.js?v=fd408eb';
import { HUMP_TIME, TUMBLE_TIME } from '../game/hazards.js?v=fd408eb';

// バンプで転がる見た目（2026-10-15 のユーザー依頼）: はじめの TUMBLE_FLY 秒で大きく跳ねて2回転がり、そのあと目が回る（全部で TUMBLE_TIME 秒。2026-10-17 に2秒）
const TUMBLE_FLY = 0.55;
const TUMBLE_HEIGHT = 2; // 跳ねる高さ（m）

// 頭の上を回る黄色い星（バンプで転がっている間。目が回っているように）
// いつもこちらを向く板（Sprite）にする（横から見ても、後ろから見ても星の形に見える）
let starTexture = null;
function starMap() {
  if (starTexture || typeof document === 'undefined') return starTexture;
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const c = cv.getContext('2d');
  c.fillStyle = '#ffffff';
  c.strokeStyle = '#8a5a00';
  c.lineWidth = 4;
  c.beginPath();
  for (let k = 0; k < 10; k++) {
    const r = k % 2 ? 12 : 28;
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
    c.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  c.closePath();
  c.fill();
  c.stroke();
  starTexture = new THREE.CanvasTexture(cv);
  return starTexture;
}
function dizzyStars() {
  const g = new THREE.Group();
  const material = new THREE.SpriteMaterial({ color: 0xffd400, map: starMap() });
  for (let k = 0; k < 5; k++) {
    const star = new THREE.Sprite(material);
    star.scale.set(0.6, 0.6, 1);
    const a = (k / 5) * Math.PI * 2;
    star.position.set(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9);
    g.add(star);
  }
  g.position.set(-0.45, 3.4, 0); // キャラの頭の上
  g.visible = false;
  return g;
}

const mats = new Map();
// 同じ色の材質は使い回す（8台になっても軽く）
function mat(color) {
  if (!mats.has(color)) mats.set(color, new THREE.MeshLambertMaterial({ color }));
  return mats.get(color);
}

// 形の中の、動かない部品（色だけの箱や玉）を、グループごとに1つの形にまとめる（描く回数を減らす。2026-10-16 のユーザー依頼「タブレットでカクつく」）
// 動く部品（userData に入れたもの: タイヤなど）と、子のグループ（頭・足・あごなど）はそのまま。子のグループの中も、同じようにまとめる
const VERTEX_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
export function mergeStatic(root) {
  const keep = new Set();
  for (const v of Object.values(root.userData)) {
    for (const o of Array.isArray(v) ? v : [v]) if (o && o.isObject3D) keep.add(o);
  }
  const visit = (g) => {
    for (const c of g.children) if (!c.isMesh && c.children.length) visit(c);
    const parts = g.children.filter((c) => c.isMesh && !keep.has(c) && !c.children.length && c.material?.isMeshLambertMaterial && !c.material.map && !c.material.transparent && !c.material.vertexColors);
    if (parts.length < 2) return;
    const pos = [];
    const nor = [];
    const col = [];
    for (const p of parts) {
      p.updateMatrix();
      const geo = (p.geometry.index ? p.geometry.toNonIndexed() : p.geometry.clone()).applyMatrix4(p.matrix);
      const a = geo.attributes.position.array;
      const n = geo.attributes.normal.array;
      const { r, g: gg, b } = p.material.color;
      for (let i = 0; i < a.length; i += 3) {
        pos.push(a[i], a[i + 1], a[i + 2]);
        nor.push(n[i], n[i + 1], n[i + 2]);
        col.push(r, gg, b);
      }
      g.remove(p);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.add(new THREE.Mesh(geo, VERTEX_MAT));
  };
  visit(root);
  return root;
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
  // 赤い野球帽をかぶる。帽子の下から、こげ茶の髪が少しのぞく（2026-10-15 のユーザー依頼）
  soki: { hair: 'cap', shirt: 0x1c3c88, hairColor: 0x2b1d16, capColor: 0xd7261b },
};

// 頭（顔は +x 向き）。半径 R の丸い頭に、目・口・耳・髪
const MOUTH_MAT = new THREE.MeshLambertMaterial({ color: MOUTH, side: THREE.DoubleSide }); // 口は裏からも見える（使い回す）

// 人間らしい顔（タイトルの絵のように）: きりっとしたまゆ、かわいい丸い目、小さな鼻、歯の見える笑った口（ほっぺのピンクはなし）
function humanFace(g, R) {
  const BROW = 0x1d1d24;
  for (const side of [-1, 1]) {
    const z = side * 0.14;
    // 目: Soki と同じ、たて長の黒い丸い目と白い光（かわいい目。2026-10-14 のユーザー依頼）
    const eye = ball(0.065, EYE, R * 0.86, 0.04, z, 8);
    eye.scale.set(0.6, 1.4, 1);
    eye.userData.eye = true;
    g.add(eye);
    g.add(ball(0.022, WHITE, R * 0.9 + 0.02, 0.08, z + 0.02, 6));
    // まゆ: 太く、内側が下がって外側が上がった、きりっとしたまゆ
    const brow = box(0.035, 0.05, 0.15, BROW, R * 0.84, 0.175, z);
    brow.rotation.x = -side * 0.45;
    brow.userData.brow = true;
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
    // 赤い野球帽（2026-10-15 のユーザー依頼「髪の毛が不自然なので、赤い野球帽をかぶせて」）
    const HC = look.hairColor || HAIR;
    const CAP = look.capColor || 0xd7261b;
    // 帽子の下からのぞく髪: 後ろと横を、耳の下の高さまで
    // （球の向き: phi が -90°〜90° のところが頭の後ろ（-x）。theta は真上 0 から真下 180°）
    const back = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 16, 8, -Math.PI * 0.6, Math.PI * 1.2, Math.PI * 0.4, Math.PI * 0.37), mat(HC));
    back.position.set(-0.02, 0.06, 0);
    g.add(back);
    // 帽子の上（頭の上半分より少し深くかぶる）
    const crown = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.46), mat(CAP));
    crown.position.set(-0.02, 0.06, 0);
    crown.userData.cap = 'crown';
    g.add(crown);
    // つば: 前（+x）に突き出した半円の板。少し下を向く
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.035, 20, 1, false, 0, Math.PI), mat(CAP));
    brim.position.set(R * 0.62, 0.13, 0);
    brim.rotation.z = -0.18;
    brim.userData.cap = 'brim';
    g.add(brim);
    // てっぺんのボタン
    g.add(ball(0.045, 0xa51b12, -0.02, 0.06 + R * 1.12, 0, 8));
    // 正面の白い文字「A」（2026-10-15 のユーザー依頼）: 左右のななめの線と、真ん中の横線
    // 文字は前（+x）を向いた面に書き、帽子の丸みに沿うよう少し上を向ける
    const LH = 0.16; // 文字の高さ
    const LW = 0.13; // 文字の幅（足元）
    const ST = 0.03; // 線の太さ
    const leg = Math.hypot(LH, LW / 2);
    const slant = Math.atan2(LW / 2, LH);
    const letter = new THREE.Group();
    for (const side of [-1, 1]) {
      const stroke = box(0.015, leg, ST, WHITE, 0, 0, (side * LW) / 4);
      stroke.rotation.x = -side * slant; // 足元が外へ広がり、上で合わさる
      letter.add(stroke);
    }
    letter.add(box(0.015, ST * 0.8, LW * 0.45, WHITE, 0, -LH * 0.12, 0));
    const UP = 0.54; // 帽子の前の面の傾き（約31°上向き）
    const CR = R * 1.12 + 0.012; // 帽子の面より少しだけ外
    letter.position.set(-0.02 + Math.cos(UP) * CR, 0.06 + Math.sin(UP) * CR, 0);
    letter.rotation.z = UP;
    letter.userData.capLetter = 'A';
    g.add(letter);
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
// ライト（2026-10-21 のユーザー依頼「夜なのにライトが付いていない」）: 前（+x）の2つの明るいライトと、前を照らすうすい光の筋。
// model.userData.lights（グループ）の見える・見えないで、点けたり消したりする
export function addHeadlights(model, front, half, y, beam = 14) {
  const lights = new THREE.Group();
  const lamp = new THREE.MeshBasicMaterial({ color: 0xfff4c8 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.16, depthWrite: false });
  for (const z of [-half, half]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.3), lamp);
    l.position.set(front, y, z);
    lights.add(l);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.min(1.1, beam * 0.08), beam, 12, 1, true), glow);
    cone.rotation.z = Math.PI / 2; // 先が後ろ、広がりが前
    cone.position.set(front + beam / 2, y - 0.2, z);
    lights.add(cone);
  }
  model.add(lights);
  model.userData.lights = lights;
  return lights;
}

export function createKartModel({ body = 0xc11f0a, character = 'kyugo', shirt } = {}) {
  const g = new THREE.Group();
  g.add(box(2.1, 0.18, 1.1, DARK, 0, 0.32, 0)); // 骨組み（低くて細い）
  g.add(box(0.7, 0.32, 1.2, body, 1.0, 0.45, 0)); // 前のカバー
  g.add(box(0.25, 0.2, 1.7, body, 1.35, 0.35, 0)); // 前のバンパー
  for (const z of [-0.62, 0.62]) g.add(box(1.0, 0.28, 0.22, body, -0.25, 0.42, z)); // 横のカバー
  g.add(box(0.25, 0.22, 1.6, DARK, -1.15, 0.45, 0)); // 後ろのバンパー
  g.add(box(0.7, 0.1, 0.9, DARK, -0.4, 0.5, 0)); // 座席
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
  }
  const d = driver(shirt === undefined ? CHARACTERS[character] : { ...CHARACTERS[character], shirt });
  d.scale.setScalar(DRIVER_SCALE);
  d.position.set(-0.45, 0.5, 0);
  g.add(d);
  // タイヤは無地の黒なので、回しても見た目は変わらない。車体と1つの形にまとめる（描く回数を 1台 4回へらす。2026-10-19 のユーザー依頼「重たい」）
  const stars = dizzyStars();
  g.add(stars);
  g.userData.stars = stars;
  g.rotation.order = 'YXZ'; // 向き（y）のあとに、車の前後の軸（x）で転がる
  g.userData.head = d.userData.head;
  addHeadlights(g, 1.5, 0.5, 0.45, 12).visible = false; // 夜のステージだけ点ける（main.js）
  return g;
}

export function syncKartModel(model, kart) {
  // ドリフトボタンで小さく跳ねる
  const hop = kart.hop > 0 ? Math.sin((1 - kart.hop / PHYS.HOP_TIME) * Math.PI) * PHYS.HOP_HEIGHT : 0;
  // バンプを乗り越える: 前が上がってから後ろが上がる（2026-10-15 のユーザー依頼）
  const u = kart.hump > 0 ? 1 - kart.hump / HUMP_TIME : 0;
  const lift = kart.hump > 0 ? Math.sin(u * Math.PI) * 0.4 : 0; // バンプの高さ（35cm）を越える
  // バンプで転がる: はじめは大きく跳ねて2回転がり、そのあとは目が回る（星が回る）
  const tumbling = kart.tumble > 0;
  const since = tumbling ? TUMBLE_TIME - kart.tumble : 0;
  const flying = tumbling && since < TUMBLE_FLY;
  const fly = flying ? Math.sin((since / TUMBLE_FLY) * Math.PI) * TUMBLE_HEIGHT : 0;
  model.position.set(kart.x, kart.y + hop + lift + fly, kart.z);
  model.rotation.y = -kart.heading;
  model.rotation.z = kart.hump > 0 ? Math.sin(u * Math.PI * 2) * 0.2 : 0;
  model.rotation.x = flying ? (since / TUMBLE_FLY) * Math.PI * 4 : 0;
  const stars = model.userData.stars;
  if (stars) {
    stars.visible = tumbling && !flying;
    if (stars.visible) stars.rotation.y = since * 5;
  }
  // ドリフト中は内側を向き、進む向きと車の向きのずれが見える
  model.visible = !kart.swallowed && (kart.respawn <= 0 || Math.floor(kart.respawn * 8) % 2 === 0); // 恐竜に食べられている間は見えない
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

// 牛（Kampar Town。2026-10-15 のユーザー依頼）: 白に黒のまだら（2頭目・4頭目は茶色）。前は +x
export function createCowModel(k = 0) {
  const g = new THREE.Group();
  const coat = k % 2 ? 0x8a5a33 : 0xf2f0ea;
  g.add(box(2.4, 1.0, 1.1, coat, 0, 1.25, 0)); // 体
  if (k % 2 === 0) {
    g.add(box(0.8, 0.7, 1.12, 0x222222, -0.4, 1.35, 0)); // 黒いまだら
    g.add(box(0.5, 0.5, 1.12, 0x222222, 0.6, 1.1, 0));
  }
  const head = new THREE.Group();
  head.add(box(0.7, 0.6, 0.6, coat, 0, 0, 0));
  head.add(box(0.25, 0.3, 0.5, 0xe8a0a0, 0.42, -0.12, 0)); // ピンクの鼻
  for (const z of [-0.22, 0.22]) head.add(box(0.12, 0.3, 0.1, 0xf6f2e0, -0.1, 0.42, z)); // 角
  head.position.set(1.45, 1.6, 0);
  g.add(head);
  const legs = [];
  for (const [x, z] of [[0.85, 0.38], [0.85, -0.38], [-0.85, 0.38], [-0.85, -0.38]]) {
    const leg = new THREE.Group();
    leg.add(box(0.25, 0.85, 0.25, coat, 0, -0.42, 0));
    leg.position.set(x, 0.8, z);
    g.add(leg);
    legs.push(leg);
  }
  g.add(box(0.1, 0.7, 0.1, coat, -1.25, 1.15, 0)); // しっぽ
  // 歩く: 足を前後に振る（時刻で決まる）
  g.userData.walk = (time) => {
    legs.forEach((leg, i) => {
      leg.rotation.z = Math.sin(time * 4 + (i % 2) * Math.PI + k) * 0.35;
    });
  };
  return g;
}

// 亀（Global City の海の底。2026-10-21 のユーザー依頼「ゆっくり歩く亀」）: 緑のこうらに六角のもよう、黄緑の頭と4本のひれ足。前は +x
export function createTurtleModel(k = 0) {
  const g = new THREE.Group();
  const shell = k % 2 ? 0x5fb04a : 0x3fa37a; // 暗い海の底でも見えるように明るい緑
  const skin = 0xc8e07a;
  g.add(box(2.6, 0.5, 2.0, shell, 0, 0.75, 0)); // こうら（下の段）
  g.add(box(2.0, 0.45, 1.5, shell, 0, 1.2, 0)); // こうら（まん中の段）
  g.add(box(1.2, 0.3, 0.9, 0xa8d860, 0, 1.55, 0)); // こうらのてっぺん（明るいもよう）
  for (const [x, z] of [[0.75, 0.55], [0.75, -0.55], [-0.75, 0.55], [-0.75, -0.55]]) g.add(box(0.5, 0.06, 0.5, 0xa8d860, x, 1.44, z)); // もよう
  g.add(box(2.7, 0.15, 2.1, 0xd8c27a, 0, 0.45, 0)); // おなか（黄色いふち）
  const head = new THREE.Group();
  head.add(box(0.8, 0.6, 0.7, skin, 0, 0, 0));
  for (const z of [-0.36, 0.36]) {
    head.add(box(0.2, 0.2, 0.05, 0xffffff, 0.2, 0.12, z)); // 白目
    head.add(box(0.1, 0.12, 0.06, 0x111111, 0.26, 0.12, z)); // 黒目
  }
  head.add(box(0.06, 0.06, 0.4, 0x3b2a1a, 0.41, -0.12, 0)); // 口
  head.position.set(1.65, 0.9, 0);
  g.add(head);
  const legs = [];
  for (const [x, z] of [[0.9, 1.1], [0.9, -1.1], [-0.9, 1.0], [-0.9, -1.0]]) {
    const leg = new THREE.Group();
    leg.add(box(0.7, 0.25, 0.55, skin, 0, -0.1, 0));
    leg.position.set(x, 0.5, z);
    g.add(leg);
    legs.push(leg);
  }
  g.add(box(0.4, 0.2, 0.25, skin, -1.45, 0.55, 0)); // しっぽ
  // ゆっくり歩く: ひれ足を前後に、頭を少し上下に
  g.userData.walk = (time) => {
    legs.forEach((leg, i) => {
      leg.rotation.y = Math.sin(time * 1.6 + (i % 2) * Math.PI + k) * 0.35;
    });
    head.position.y = 0.9 + Math.sin(time * 0.8 + k) * 0.06;
  };
  g.scale.setScalar(1.3); // 遠くからでも亀とわかる大きさ（長さ 約3.5m）
  return g;
}

// イノシシ（Soki Forest。2026-10-16 のユーザー依頼）: こげ茶の体、短い足4本、白い牙、小さな耳。前は +x
export function createBoarModel(k = 0, size = 1) {
  const g = new THREE.Group();
  const coat = k % 2 ? 0x3d3430 : 0x4a3d36; // 黒っぽい灰色の茶（茶色い土の道で見えるように）
  g.add(box(1.8, 0.9, 0.9, coat, 0, 0.85, 0)); // 体
  g.add(box(1.0, 0.25, 0.7, 0x221c19, -0.1, 1.4, 0)); // 背中のたてがみ
  const head = new THREE.Group();
  head.add(box(0.7, 0.6, 0.7, coat, 0, 0, 0));
  head.add(box(0.25, 0.3, 0.4, 0xc98f7a, 0.45, -0.1, 0)); // 鼻
  for (const z of [-0.22, 0.22]) {
    head.add(box(0.1, 0.25, 0.08, 0xf6f2e0, 0.4, -0.25, z)); // 白い牙
    head.add(box(0.12, 0.2, 0.15, 0x3e2a1a, -0.15, 0.38, z)); // 小さな耳
  }
  head.position.set(1.1, 0.95, 0);
  g.add(head);
  const legs = [];
  for (const [x, z] of [[0.6, 0.3], [0.6, -0.3], [-0.6, 0.3], [-0.6, -0.3]]) {
    const leg = new THREE.Group();
    leg.add(box(0.2, 0.5, 0.2, 0x3e2a1a, 0, -0.25, 0));
    leg.position.set(x, 0.5, z);
    g.add(leg);
    legs.push(leg);
  }
  // 走るとき（run）は足を速く振り、予告（warn）は体をゆらす
  g.userData.walk = (time, state) => {
    const fast = state === 'run';
    legs.forEach((leg, i) => {
      leg.rotation.z = fast ? Math.sin(time * 18 + (i % 2) * Math.PI) * 0.6 : 0;
    });
    g.rotation.x = state === 'warn' ? Math.sin(time * 30) * 0.08 : 0;
  };
  g.scale.setScalar(1.4 * size); // 少し大きく（2026-10-16 のブラウザ確認で小さく見えた）。子どもは size 0.7
  return g;
}

// 雪だるま（Kyugo Mountain。2026-10-18 のユーザー依頼）: 白い玉3つ（高さ 約2.4m）、炭の目、にんじんの鼻、黒い帽子、赤いマフラー。
// 前（+x）が顔。y = 0 が雪の玉の下
export function createSnowmanModel() {
  const g = new THREE.Group();
  const snow = 0xf7f9fc;
  g.add(ball(1.0, snow, 0, 0.9, 0));
  g.add(ball(0.75, snow, 0, 2.0, 0));
  g.add(ball(0.5, snow, 0, 2.85, 0));
  for (const z of [-0.17, 0.17]) g.add(ball(0.07, 0x111111, 0.45, 2.95, z, 6)); // 炭の目
  for (const y of [1.85, 2.15]) g.add(ball(0.08, 0x111111, 0.73, y, 0, 6)); // ボタン
  const nose = mesh(new THREE.ConeGeometry(0.08, 0.45, 8), 0xff7a1a, 0.68, 2.85, 0); // にんじんの鼻
  nose.rotation.z = -Math.PI / 2;
  g.add(nose);
  g.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 12), 0x1a1a1a, 0, 3.25, 0)); // 帽子のつば
  g.add(mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.55, 12), 0x1a1a1a, 0, 3.55, 0)); // 帽子
  const scarf = mesh(new THREE.TorusGeometry(0.5, 0.13, 6, 14), 0xd8262b, 0, 2.45, 0); // 赤いマフラー
  scarf.rotation.x = Math.PI / 2;
  g.add(scarf);
  g.add(box(0.2, 0.6, 0.25, 0xd8262b, 0.35, 2.15, 0.35)); // マフラーのはし
  g.scale.setScalar(1.2); // 高さ 約4.6m（src/game/hazards.js の SNOWMAN_HEIGHT。2026-10-18 のユーザー依頼「2倍の大きさ」で 0.6 から）
  return g;
}

// 恐竜の顔（Soki Forest。2026-10-16 のユーザー依頼「コースの横幅の 80% くらいの顔が、口を開けて下から」）
// 幅 19m。前（+x）が、走ってくる車の方。口を大きく上に開ける。y = 0 が下あごの下
export function createDinoModel() {
  const g = new THREE.Group();
  const skin = 0xf08a24; // オレンジ（2026-10-16 のユーザー依頼「ワニに見えるのでオレンジに」）
  const dark = 0xc4601a;
  const W = 26; // 道はば（24m）いっぱい（2026-10-17 のユーザー依頼「横をすり抜けられないように」）
  const lower = new THREE.Group(); // 下あご（前へのびる）
  lower.add(box(10, 2.2, W, skin, 1.5, 1.1, 0));
  lower.add(box(9, 0.3, W - 3, 0xc94a4a, 1.5, 2.25, 0)); // 口の中
  lower.add(box(4, 0.4, W - 6, 0xe06a7a, 2.5, 2.45, 0)); // 舌
  for (let z = -W / 2 + 1.2; z <= W / 2 - 1.2; z += 2.2) lower.add(box(0.6, 1.2, 0.6, 0xffffff, 6.2, 2.8, z)); // 下の歯（前）
  for (let x = -2; x <= 5; x += 2.2) for (const z of [-W / 2 + 0.8, W / 2 - 0.8]) lower.add(box(0.6, 1.1, 0.6, 0xffffff, x, 2.8, z));
  g.add(lower);
  const upper = new THREE.Group(); // 上あご（後ろのつけ根で、上に大きく開く）
  upper.add(box(10, 3, W, skin, 5, 1.5, 0));
  upper.add(box(9, 0.3, W - 3, 0xc94a4a, 5, -0.05, 0));
  for (let z = -W / 2 + 1.2; z <= W / 2 - 1.2; z += 2.2) upper.add(box(0.6, 1.3, 0.6, 0xffffff, 9.6, -0.6, z)); // 上の歯
  for (const z of [-3, 3]) upper.add(box(0.8, 0.8, 1.2, 0x2a4a20, 9.8, 2.2, z)); // 鼻の穴
  for (let x = 1; x <= 8; x += 3.5) upper.add(box(1.6, 1.2, W * 0.5, dark, x, 3.2, 0)); // 背中のでこぼこ
  upper.position.set(-3.5, 2.6, 0);
  upper.rotation.z = 0.8; // 口を大きく開ける
  g.userData.upper = upper; // 食べたときに口を閉じる（src/main.js）
  g.add(upper);
  // 頭の後ろ（首）と、頭のてっぺん
  g.add(box(6, 9, W - 2, dark, -5.5, 4.5, 0));
  g.add(box(5, 4, W - 4, skin, -4.5, 11, 0));
  // 大きな目（頭のてっぺんの、上あごより高い所に出っぱる。黄色い目に、たての黒いひとみ。2026-10-16 のユーザー依頼「大きな目で恐竜らしく」）
  for (const z of [-W / 2 + 3.6, W / 2 - 3.6]) {
    g.add(ball(3.4, 0xffffff, -3.2, 14, z, 14)); // 白目
    g.add(ball(2.3, 0xf2c21a, -1.4, 14, z, 12)); // 黄色い目
    g.add(box(0.8, 3, 0.8, 0x111111, 0.7, 14, z)); // たてのひとみ
    const brow = box(4.4, 1.3, 4.6, dark, -3, 17.3, z); // こわい顔のまゆ（目の上に、内がわを下げて）
    brow.rotation.x = z > 0 ? 0.25 : -0.25;
    g.add(brow);
  }
  return g;
}

// サル（Soki Forest。2026-10-16 のユーザー依頼）: 茶色の体、うすだいだいの顔、長いしっぽ。木の枝の上にすわる。前は +x
// throwAt(time): 投げてからしばらく、腕をふり上げる
export function createMonkeyModel() {
  const g = new THREE.Group();
  const fur = 0x7a4e2a;
  g.add(box(3.2, 0.35, 0.35, 0x6b4a2f, 0, -0.2, 0)); // すわっている枝
  g.add(box(0.7, 0.8, 0.6, fur, 0, 0.4, 0)); // 体
  const head = new THREE.Group();
  head.add(box(0.6, 0.55, 0.55, fur, 0, 0, 0));
  head.add(box(0.12, 0.4, 0.45, 0xf0c49a, 0.3, -0.03, 0)); // 顔
  for (const z of [-0.33, 0.33]) head.add(box(0.12, 0.22, 0.12, 0xf0c49a, 0, 0.05, z)); // 耳
  head.position.set(0.05, 1.05, 0);
  g.add(head);
  const arm = new THREE.Group();
  arm.add(box(0.18, 0.6, 0.18, fur, 0, 0.3, 0));
  arm.position.set(0.1, 0.65, 0.35);
  g.add(arm);
  g.add(box(0.18, 0.6, 0.18, fur, 0.1, 0.35, -0.35)); // もう片方の腕
  const tail = box(0.12, 1.4, 0.12, fur, -0.4, -0.5, 0); // 長いしっぽ（下へたれる）
  g.add(tail);
  g.userData.tail = tail; // 動かすので、まとめない
  g.userData.throwAt = (time, since) => {
    arm.rotation.z = since < 0.4 ? -2.2 * (1 - since / 0.4) : 0;
    tail.rotation.x = Math.sin(time * 2) * 0.25;
  };
  g.scale.setScalar(1.5); // 木の上でも見えるように（2026-10-16 のブラウザ確認）
  return g;
}

// 木の実（茶色の小さな丸）
export function createNutModel() {
  return ball(0.45, 0x8a5a2b, 0, 0, 0, 8);
}

// 木の実の影（黒い半透明の円の板）。落ちる所に、だんだん大きく濃く
export function createNutShadow() {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

// スクールバス（BAS SEKOLAH。写真のような、角の丸い黄色っぽいオレンジの小さなバス）。+x が前。2026-10-16 のユーザー依頼
let busText = null;
export function createBusModel() {
  const g = new THREE.Group();
  const orange = 0xf0a018;
  const L = 7.5;
  const W = 2.6;
  g.add(box(L, 1.6, W, orange, 0, 0.95, 0)); // 下の車体（box の y は真ん中）
  g.add(box(L - 0.2, 1.05, W - 0.1, orange, -0.05, 2.3, 0)); // 窓のある所（柱）
  g.add(box(L - 0.5, 0.35, W - 0.2, orange, -0.1, 2.98, 0)); // 丸い屋根
  g.add(box(L, 0.1, W + 0.02, 0x1a1a1a, 0, 1.78, 0)); // 窓の下の黒い線
  g.add(box(L - 0.6, 0.08, W + 0.02, 0x1a1a1a, 0.1, 0.9, 0)); // 下の黒い線
  // 横の窓（両側）と、前の大きな窓
  for (const z of [W / 2 + 0.01, -W / 2 - 0.01]) {
    for (const x of [-2.6, -1.3, 0, 1.5, 2.7]) {
      const win = box(1.05, 0.8, 0.02, 0x2b3a44, x, 2.3, z);
      g.add(win);
    }
  }
  g.add(box(0.04, 0.9, W - 0.4, 0x2b3a44, L / 2 + 0.01, 2.3, 0)); // 前の窓
  g.add(box(0.2, 0.3, W + 0.1, 0x222222, L / 2 + 0.05, 0.4, 0)); // 前のバンパー
  g.add(box(0.2, 0.3, W + 0.1, 0x222222, -L / 2 - 0.05, 0.4, 0)); // 後ろのバンパー
  // タイヤ
  for (const x of [2.3, -2.4]) for (const z of [W / 2 - 0.15, -W / 2 + 0.15]) g.add(box(1.0, 1.0, 0.4, 0x151515, x, 0.5, z));
  // 両側の「BAS SEKOLAH」の文字
  if (!busText) {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 96;
    const c = cv.getContext('2d');
    c.fillStyle = '#1a1a1a';
    c.font = 'bold 78px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('BAS SEKOLAH', 256, 50, 500);
    busText = new THREE.CanvasTexture(cv);
    busText.colorSpace = THREE.SRGBColorSpace;
  }
  for (const side of [1, -1]) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.85), new THREE.MeshBasicMaterial({ map: busText, transparent: true }));
    plate.position.set(-0.9, 1.33, side * (W / 2 + 0.03));
    if (side < 0) plate.rotation.y = Math.PI;
    g.add(plate);
  }
  addHeadlights(g, 3.6, 0.9, 0.9, 16);
  return g;
}

// 新幹線（Global City。2026-10-20）: 白い車体に青い帯、cars 両（1両 25m）。先頭はくさび形。+x が前
export function createShinkansenModel(cars = 16) {
  // 「のぞみ」（N700）の形（2026-10-21 のユーザー依頼「牛乳パックのように四角」）: 白い車体に丸い屋根、窓の上下に青い帯、
  // 先頭と最後尾に、低く長いカモノハシのような鼻。1両ずつのグループ（+x が前、真ん中が原点）。カーブでは1両ずつ線路にそって置く
  const g = new THREE.Group();
  const WHITE_BODY = 0xf4f6f8;
  const BLUE = 0x1f4aa8;
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const body = mat(WHITE_BODY);
  const L = 25;
  const add = (car, geo, m, x, y, z) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    car.add(o);
    return o;
  };
  // 鼻（dir = 1 は前、-1 は後ろ）: 低くのびるくちばしと、運転席の丸いふくらみ
  const nose = (car, dir) => {
    const beak = add(car, new THREE.SphereGeometry(1, 20, 12), body, dir * L / 2, 1.5, 0);
    beak.scale.set(11, 1.25, 1.7); // 長く低い鼻
    const cab = add(car, new THREE.SphereGeometry(1, 16, 10), body, dir * (L / 2 + 1.5), 2.3, 0);
    cab.scale.set(6, 1.4, 1.65);
    const glass = add(car, new THREE.SphereGeometry(1, 12, 8), mat(0x1a2230), dir * (L / 2 + 3.2), 2.9, 0);
    glass.scale.set(2.2, 0.55, 1.2); // 運転席の窓
    const line = add(car, new THREE.SphereGeometry(1, 16, 8), mat(BLUE), dir * (L / 2 + 0.5), 1.25, 0);
    line.scale.set(9.2, 0.18, 1.72); // 鼻の青い線
    for (const z of [-1, 1]) add(car, new THREE.BoxGeometry(0.6, 0.25, 0.1), mat(0xfff6dc), dir * (L / 2 + 7.5), 1.35, z * 0.9); // ライト
  };
  g.userData.cars = [];
  for (let k = 0; k < cars; k++) {
    const car = new THREE.Group();
    add(car, new THREE.BoxGeometry(L, 2.6, 3.4), body, 0, 1.6, 0); // 車体の下（四角）
    const roof = add(car, new THREE.CylinderGeometry(1.7, 1.7, L, 16, 1, false, 0, Math.PI), body, 0, 2.9, 0); // 丸い屋根
    roof.rotation.z = Math.PI / 2; // 円柱の向きを前後に、半分を上に
    roof.scale.set(0.55, 1, 1); // 低い丸み
    add(car, new THREE.BoxGeometry(L + 0.05, 0.35, 3.45), mat(BLUE), 0, 1.0, 0); // 下の太い青い帯
    add(car, new THREE.BoxGeometry(L + 0.05, 0.12, 3.45), mat(BLUE), 0, 1.45, 0); // 細い青い線
    for (let x = -L / 2 + 2; x <= L / 2 - 2; x += 1.6) add(car, new THREE.BoxGeometry(0.9, 0.55, 3.46), mat(0x2a3440), x, 2.45, 0); // 窓
    add(car, new THREE.BoxGeometry(0.6, 2.6, 2.6), mat(0x3a3f46), -L / 2 - 0.25, 1.9, 0); // 車両のつなぎめ
    if (k === 0) nose(car, 1);
    if (k === cars - 1) nose(car, -1);
    g.add(car);
    g.userData.cars.push(car);
  }
  return mergeStatic(g);
}

// 香港の2階建ての路面電車（Global City。2026-10-20）: 緑に白い帯、長さ 12m。+x が前（バスと同じ向き）
export function createTramModel() {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const add = (w, h, d, c, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z);
    g.add(m);
  };
  add(12, 4.2, 2.6, 0x2f7d4a, 0, 2.5, 0); // 車体
  add(12.05, 0.35, 2.65, 0xf4f4f0, 0, 2.4, 0); // 白い帯
  for (const y of [1.9, 3.7]) add(10.5, 0.9, 2.7, 0x2a3440, 0, y, 0); // 1階・2階の窓
  add(11.6, 0.3, 2.4, 0xf4f4f0, 0, 4.75, 0); // 屋根
  add(1.2, 0.6, 0.15, 0x333333, 0, 5.2, 0); // パンタグラフ
  for (const x of [-4, 4]) for (const z of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 10), mat(0x222222));
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.4, z * 1.2);
    g.add(w);
  }
  addHeadlights(g, 6.1, 0.9, 1.0, 18);
  return mergeStatic(g);
}

// ニューヨークの黄色いタクシー（Global City。2026-10-20）: 長さ 5m、屋根に「TAXI」の小さな箱。+x が前
export function createTaxiModel() {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const add = (w, h, d, c, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z);
    g.add(m);
  };
  add(5, 0.9, 2, 0xf2c200, 0, 0.75, 0); // 車体
  add(2.8, 0.7, 1.8, 0xf2c200, -0.3, 1.55, 0); // 屋根
  add(2.6, 0.55, 1.85, 0x2a3440, -0.3, 1.55, 0); // 窓
  add(0.8, 0.3, 0.5, 0xffffff, -0.3, 2.05, 0); // TAXI の箱
  add(0.1, 0.25, 1.6, 0x222222, 2.5, 0.8, 0); // 前のグリル
  for (const x of [-1.6, 1.6]) for (const z of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10), mat(0x222222));
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.38, z * 0.95);
    g.add(w);
  }
  g.scale.setScalar(1.8); // 大きく（2026-10-21 のユーザー依頼「タクシーが小さい」）
  return mergeStatic(g);
}
