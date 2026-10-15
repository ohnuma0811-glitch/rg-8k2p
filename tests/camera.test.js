import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { createKartModel, CHARACTERS } from '../src/render/models.js';
import { CAM_HEIGHT } from '../src/render/scene.js';
import { buildTrack } from '../src/game/track.js';
import { COURSE1 } from '../src/data/tracks.js';

// 地平線はカメラの目の高さに見える。カメラが頭より高ければ、まっすぐな道でキャラは地平線より下に映る
test('カメラは、キャラの頭のてっぺんより0.5m以上高い（まっすぐな道で、キャラが地平線より下に映る）', () => {
  for (const character of ['kyugo', 'soki']) {
    const model = createKartModel({ character });
    model.remove(model.userData.stars); // 頭の上の星（バンプで転がっている間だけ見える）は、キャラの高さに入れない
    const box = new THREE.Box3().setFromObject(model);
    assert.ok(CAM_HEIGHT >= box.max.y + 0.5, `${character}: 頭 ${box.max.y.toFixed(2)}m / カメラ ${CAM_HEIGHT}m`);
  }
});

test('ゴールのあと: カメラは後ろから、ゆっくり横を回って前へ。前に着いたら止まり、顔を見る', async () => {
  const { finishOrbit, FINISH_ORBIT_TIME, CAM_BACK } = await import('../src/render/scene.js');
  const s = finishOrbit(0);
  assert.equal(s.angle, 0, '最初は真後ろ（走っているときと同じ）');
  assert.equal(s.dist, CAM_BACK);
  assert.equal(s.height, CAM_HEIGHT);
  assert.ok(FINISH_ORBIT_TIME >= 3, 'ゆっくり回る');
  let prev = -1;
  for (let t = 0; t <= FINISH_ORBIT_TIME; t += 0.1) {
    const a = finishOrbit(t).angle;
    assert.ok(a >= prev, '戻らずに回る');
    prev = a;
  }
  const end = finishOrbit(FINISH_ORBIT_TIME);
  assert.ok(Math.abs(end.angle - Math.PI) < 1e-9, '真正面');
  assert.deepEqual(finishOrbit(FINISH_ORBIT_TIME + 10), end, '前で止まる');
  assert.equal(end.ahead, 0, '車（キャラの顔）を見る');
  const mid = finishOrbit(FINISH_ORBIT_TIME / 2);
  assert.ok(mid.angle > 0.5 && mid.angle < Math.PI - 0.5, '途中は横から');
  assert.equal(mid.ahead, 0, '横から見るときは、車を真ん中に');
  for (let t = 0; t <= FINISH_ORBIT_TIME; t += 0.1) assert.ok(finishOrbit(t).dist >= 5, '頭にぶつかるほど近づかない');
});

test('スタートの前: カメラはコースの前から、正面を向いた車たちの上を通って回り、走るときのカメラの位置で止まる（2026-10-14 のユーザー依頼）', async () => {
  const { startFly, START_FLY_TIME, CAM_BACK } = await import('../src/render/scene.js');
  const first = startFly(0);
  assert.ok(first.d > 20, '最初は車たちの前');
  assert.ok(first.td < first.d, '最初は後ろ（車たちの顔）を見る');
  let over = false;
  for (let t = 0; t <= START_FLY_TIME; t += 0.02) {
    const f = startFly(t);
    if (Math.abs(f.d) < 3 && f.y > 5) over = true;
    // 真下を見ない（向きが急に変わらない）: カメラと見る所は、横から見て3m以上はなれている
    assert.ok(Math.hypot(f.td - f.d, f.lat) > 3, `t=${t.toFixed(2)}`);
  }
  assert.ok(over, '自分の車の上を通る');
  const end = startFly(START_FLY_TIME);
  assert.ok(START_FLY_TIME >= 3 && START_FLY_TIME <= 5);
  assert.ok(Math.abs(end.d + CAM_BACK) < 1e-9 && Math.abs(end.lat) < 1e-9 && Math.abs(end.y - CAM_HEIGHT) < 1e-9, '走るときのカメラの位置');
  assert.deepEqual(startFly(START_FLY_TIME + 5), end, '止まる');
});

test('レース中の Kyugo の顔にはピンクのほっぺがない。まゆは外側が上がった、きりっとした向き（2026-10-14 のユーザー依頼）', () => {
  const colors = new Set();
  const brows = [];
  createKartModel({ character: 'kyugo' }).traverse((o) => {
    if (o.material && o.material.color) colors.add(o.material.color.getHex());
    if (o.userData.brow) brows.push(o);
  });
  assert.ok(!colors.has(0xf3a0a0), 'ほっぺがある');
  assert.equal(brows.length, 2);
  for (const b of brows) {
    // まゆの外側の端（顔の中心から遠い方）が、内側の端より高い
    b.updateWorldMatrix(true, false);
    const side = Math.sign(b.position.z);
    const outer = new THREE.Vector3(0, 0, side * 0.07).applyMatrix4(b.matrixWorld);
    const inner = new THREE.Vector3(0, 0, -side * 0.07).applyMatrix4(b.matrixWorld);
    assert.ok(outer.y > inner.y + 0.02, `外 ${outer.y.toFixed(3)} / 内 ${inner.y.toFixed(3)}`);
  }
});

test('レース中の Kyugo: 目の上の黒い線（2本目のまゆに見える）はなく、目は Soki と同じかわいい丸い目（たて長の黒い目。2026-10-14 のユーザー依頼）', () => {
  const lids = [];
  const eyes = [];
  createKartModel({ character: 'kyugo' }).traverse((o) => {
    if (o.isMesh && o.geometry.type === 'BoxGeometry' && o.material.color.getHex() === 0x1a1a1a) lids.push(o);
    if (o.userData.eye) eyes.push(o);
  });
  assert.equal(lids.length, 0, '目の上の線がある');
  assert.equal(eyes.length, 2);
  for (const e of eyes) {
    assert.equal(e.material.color.getHex(), 0x1a1a1a, '黒い目');
    assert.ok(e.scale.y > e.scale.z, 'たて長でない');
    assert.equal(e.rotation.x, 0, '傾いている');
  }
});

test('Soki の髪は、頭の後ろの下（耳より下）までおおう（2026-10-15 の実機確認「後ろの髪の毛が頭の下の方がない」）', () => {
  const model = createKartModel({ character: 'soki' });
  model.remove(model.userData.stars); // 頭の上の星（いつもこちらを向く板）は、線を当てて調べるのに使えない
  model.updateMatrixWorld(true);
  let head = null;
  model.traverse((o) => {
    if (o.isMesh && o.geometry.type === 'SphereGeometry' && Math.abs(o.geometry.parameters.radius - 0.42) < 1e-6) head = o;
  });
  const center = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld);
  // 頭の真後ろ（前は +x）の、耳より少し下の点に、髪があるか（そこから後ろへ線をのばして、髪に当たるか）
  const ray = new THREE.Raycaster(center.clone().add(new THREE.Vector3(-3, -0.25, 0)), new THREE.Vector3(1, 0, 0));
  const hits = ray.intersectObject(model, true);
  assert.ok(hits.length > 0, '何にも当たらない');
  const c = hits[0].object.material.color.getHex();
  assert.ok(c === CHARACTERS.soki.hairColor || c === CHARACTERS.soki.capColor, `最初に当たったのが髪か帽子でない（${hits[0].object.material.color.getHexString()}）`);
});

test('Soki は赤い野球帽をかぶる: 頭をおおう赤い帽子と、顔より前に出るつば（2026-10-15 のユーザー依頼「髪の毛が不自然なので、赤い野球帽をかぶせて」）', () => {
  const model = createKartModel({ character: 'soki' });
  model.updateMatrixWorld(true);
  const parts = { crown: null, brim: null, face: null };
  model.traverse((o) => {
    if (o.userData.cap) parts[o.userData.cap] = o;
    if (o.isMesh && o.geometry.type === 'SphereGeometry' && Math.abs(o.geometry.parameters.radius - 0.42) < 1e-6) parts.face = o;
  });
  assert.ok(parts.crown && parts.brim, '帽子とつば');
  assert.equal(parts.crown.material.color.getHex(), CHARACTERS.soki.capColor);
  const red = new THREE.Color(CHARACTERS.soki.capColor);
  assert.ok(red.r > 0.6 && red.g < 0.3 && red.b < 0.3, '赤');
  const brim = new THREE.Box3().setFromObject(parts.brim);
  const face = new THREE.Box3().setFromObject(parts.face);
  assert.ok(brim.max.x > face.max.x + 0.1, `つばが顔より前に出る（${brim.max.x.toFixed(2)} / ${face.max.x.toFixed(2)}）`);
  let strands = 0;
  model.traverse((o) => {
    if (o.userData.strand) strands++;
  });
  assert.equal(strands, 0, '毛の束はやめた');
});

test('Soki の帽子の正面は、白い丸ではなく白い文字「A」（2026-10-15 のユーザー依頼）', () => {
  const model = createKartModel({ character: 'soki' });
  model.updateMatrixWorld(true);
  let letter = null;
  let whiteDisc = 0;
  let head = null;
  model.traverse((o) => {
    if (o.userData.capLetter) letter = o;
    if (o.isMesh && o.geometry.type === 'CylinderGeometry' && o.material.color.getHex() === 0xffffff) whiteDisc++;
    if (o.isMesh && o.geometry.type === 'SphereGeometry' && Math.abs(o.geometry.parameters.radius - 0.42) < 1e-6) head = o;
  });
  assert.equal(letter && letter.userData.capLetter, 'A');
  assert.equal(whiteDisc, 0, '白い丸はやめた');
  const strokes = letter.children.filter((c) => c.isMesh);
  assert.equal(strokes.length, 3, '「A」は線3本');
  assert.ok(strokes.every((c) => c.material.color.getHex() === 0xffffff), '白');
  // 帽子の前（顔の上）にある
  const a = new THREE.Box3().setFromObject(letter).getCenter(new THREE.Vector3());
  const h = new THREE.Box3().setFromObject(head);
  assert.ok(a.x > (h.min.x + h.max.x) / 2 && a.y > (h.min.y + h.max.y) / 2, '帽子の前の上の方');
});

const tumbleTrack = buildTrack(COURSE1);

test('転がっている間は、頭の上で黄色い星が回る。転がっていないときは見えない（2026-10-15 のユーザー依頼）', async () => {
  const { syncKartModel } = await import('../src/render/models.js');
  const { createKart } = await import('../src/game/kart.js');
  const m = createKartModel({ character: 'kyugo' });
  const kart = createKart(tumbleTrack, 0, 0);
  syncKartModel(m, kart);
  assert.equal(m.userData.stars.visible, false);
  kart.tumble = 0.3; // 落ちたあと（目が回っている）
  syncKartModel(m, kart);
  assert.equal(m.userData.stars.visible, true);
  assert.ok(m.userData.stars.children.length >= 4);
  for (const s of m.userData.stars.children) assert.equal(s.material.color.getHex(), 0xffd400);
});

test('「バーン」のとき、車は大きく跳ね上がり、くるっと転がってから落ちる', async () => {
  const { syncKartModel } = await import('../src/render/models.js');
  const { createKart } = await import('../src/game/kart.js');
  const { TUMBLE_TIME } = await import('../src/game/hazards.js');
  const m = createKartModel({ character: 'soki' });
  const kart = createKart(tumbleTrack, 0, 0);
  kart.tumble = TUMBLE_TIME - 0.3; // 跳ねている途中
  syncKartModel(m, kart);
  assert.ok(m.position.y - kart.y > 1.5, `${m.position.y}`);
  kart.tumble = TUMBLE_TIME * 0.25; // もう落ちて、目が回っている
  syncKartModel(m, kart);
  assert.ok(Math.abs(m.position.y - kart.y) < 0.01);
  assert.ok(Math.abs(m.rotation.x) < 0.01);
});
