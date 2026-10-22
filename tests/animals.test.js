import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { createKartModel, mergeStatic, CHARACTERS } from '../src/render/models.js';
import { CHARS } from '../src/data/characters.js';

const meshes = (o) => {
  let n = 0;
  o.traverse((m) => { if (m.isMesh) n++; });
  return n;
};

test('8人とも 3D の形がある（頭・夜のライト・転がったときの星）', () => {
  for (const c of CHARS) {
    assert.ok(CHARACTERS[c.id], c.id);
    const m = createKartModel({ body: c.body, character: c.id });
    assert.ok(m.userData.head, `${c.id} の頭`);
    assert.ok(m.userData.lights, `${c.id} のライト`);
    assert.ok(m.userData.stars, `${c.id} の星`);
    assert.ok(meshes(m.userData.head) >= 5, `${c.id} の頭の部品`);
  }
});

test('動かない部品をまとめたあとの描く数は、Kyugo と同じくらい（+3 まで）', () => {
  const base = meshes(mergeStatic(createKartModel({ body: 0xc11f0a, character: 'kyugo' })));
  for (const c of CHARS) {
    const n = meshes(mergeStatic(createKartModel({ body: c.body, character: c.id })));
    assert.ok(n <= base + 3, `${c.id}: ${n}（Kyugo ${base}）`);
  }
});

test('Rampage Elephant はほかより大きい（見た目だけ。乗っている体の大きさの倍率）', () => {
  const size = (id) => createKartModel({ body: 0, character: id }).userData.head.parent.scale.x;
  assert.ok(size('elephant') > size('kyugo') * 1.15);
  assert.equal(size('rabbit'), size('kyugo'));
});

test('それぞれの特徴: うさぎの長い耳（頭より上に高い）、ぞうの長い鼻（頭より前に長い）', () => {
  const head = (id) => new THREE.Box3().setFromObject(createKartModel({ body: 0, character: id }).userData.head);
  const k = head('kyugo');
  assert.ok(head('rabbit').max.y > k.max.y + 0.2, 'うさぎの耳');
  assert.ok(head('elephant').max.x > k.max.x + 0.12, 'ぞうの鼻');
});
