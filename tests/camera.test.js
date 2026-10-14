import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { createKartModel } from '../src/render/models.js';
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
