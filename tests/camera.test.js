import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { createKartModel, CHARACTERS } from '../src/render/models.js';
import { CAM_HEIGHT } from '../src/render/scene.js';

// 地平線はカメラの目の高さに見える。カメラが頭より高ければ、まっすぐな道でキャラは地平線より下に映る
test('カメラは、キャラの頭のてっぺんより0.5m以上高い（まっすぐな道で、キャラが地平線より下に映る）', () => {
  for (const character of ['kyugo', 'soki']) {
    const box = new THREE.Box3().setFromObject(createKartModel({ character }));
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
  assert.equal(hits[0].object.material.color.getHex(), CHARACTERS.soki.hairColor, `最初に当たったのが髪でない（${hits[0].object.material.color.getHexString()}）`);
});

test('Soki の髪は帽子に見えないように: こげ茶で、前髪は長さのちがう毛の束が並び、上につやがある（2026-10-15 の実機確認）', () => {
  const hair = CHARACTERS.soki.hairColor;
  assert.notEqual(hair, 0x1a1a1a, '真っ黒でない');
  const strands = [];
  let shine = 0;
  createKartModel({ character: 'soki' }).traverse((o) => {
    if (o.userData.strand === 'fringe') strands.push(o);
    if (o.userData.shine) shine++;
  });
  assert.ok(strands.length >= 7, `前髪の束 ${strands.length}`);
  assert.ok(new Set(strands.map((o) => o.scale.y.toFixed(2))).size >= 3, '長さがそろいすぎ');
  assert.ok(strands.every((o) => o.material.color.getHex() === hair));
  assert.ok(shine >= 1, 'つや');
});
