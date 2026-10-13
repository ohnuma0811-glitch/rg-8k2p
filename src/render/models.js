// カートと運転するキャラの形（M1 は Kyugo の仮の形。M3 で8キャラにする）
import * as THREE from '../../vendor/three.module.min.js';

const mat = (color) => new THREE.MeshLambertMaterial({ color });

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
}

// 前は +x 向き。kart.heading に合わせて rotation.y = -heading にする
// 形と大きさは KENTA が別のチャットで作ったレースゲーム（Penguin GP）を参考にする:
// 車体は長さ2.8m・幅1.8m、鼻先と黒い後ろの羽。運転する人は小さく、車体から頭と肩が出る程度
export function createKartModel({ body = 0xc11f0a, shirt = 0xc11f0a } = {}) {
  const g = new THREE.Group();
  const dark = 0x1d2430;
  g.add(box(2.8, 0.6, 1.8, body, 0, 0.6, 0)); // 車体
  g.add(box(0.8, 0.4, 1.4, body, 1.6, 0.5, 0)); // 鼻先
  g.add(box(0.5, 0.15, 2, dark, -1.35, 1.15, 0)); // 後ろの羽
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.4, 10);
  wheelGeo.rotateX(Math.PI / 2);
  for (const [x, z] of [[0.95, 1], [0.95, -1], [-0.95, 1], [-0.95, -1]]) {
    const w = new THREE.Mesh(wheelGeo, mat(dark));
    w.position.set(x, 0.42, z);
    g.add(w);
    wheels.push(w);
  }
  // 運転する人（小さく。シャツの肩、顔、黒い髪）
  g.add(box(0.55, 0.35, 0.8, shirt, -0.25, 1.05, 0));
  g.add(box(0.7, 0.62, 0.7, 0xf2c9a0, -0.25, 1.5, 0));
  g.add(box(0.76, 0.22, 0.76, 0x1a1a1a, -0.28, 1.88, 0));
  g.userData.wheels = wheels;
  return g;
}

export function syncKartModel(model, kart) {
  model.position.set(kart.x, kart.y, kart.z);
  model.rotation.y = -kart.heading;
  // ドリフト中は少し横を向く
  model.rotation.y -= kart.drift.active ? kart.drift.dir * 0.35 : 0;
  model.visible = kart.respawn <= 0 || Math.floor(kart.respawn * 8) % 2 === 0;
  for (const w of model.userData.wheels) w.rotation.z -= kart.speed * 0.05;
}
