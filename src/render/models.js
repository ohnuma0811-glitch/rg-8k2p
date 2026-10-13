// カートと運転するキャラの形（M1 は Kyugo の仮の形。M3 で8キャラにする）
import * as THREE from 'three';

const mat = (color) => new THREE.MeshLambertMaterial({ color });

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
}

// 前は +x 向き。kart.heading に合わせて rotation.y = -heading にする
export function createKartModel({ body = 0xc11f0a, shirt = 0xc11f0a } = {}) {
  const g = new THREE.Group();
  g.add(box(2.4, 0.45, 1.5, body, 0, 0.55, 0));
  g.add(box(0.6, 0.3, 1.3, 0x222222, 1.1, 0.5, 0));
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.35, 10);
  wheelGeo.rotateX(Math.PI / 2);
  for (const [x, z] of [[0.8, 0.8], [0.8, -0.8], [-0.8, 0.8], [-0.8, -0.8]]) {
    const w = new THREE.Mesh(wheelGeo, mat(0x111111));
    w.position.set(x, 0.38, z);
    g.add(w);
    wheels.push(w);
  }
  // 運転する人（シャツ、顔、黒い髪）
  g.add(box(0.7, 0.8, 0.9, shirt, -0.3, 1.15, 0));
  g.add(box(0.75, 0.7, 0.75, 0xf2c9a0, -0.25, 1.9, 0));
  g.add(box(0.8, 0.25, 0.8, 0x1a1a1a, -0.3, 2.3, 0));
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
