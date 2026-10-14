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
