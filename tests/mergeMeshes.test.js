import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { mergeMeshes } from '../src/render/mergeMeshes.js';

test('同じ材質の動かない形は、区画ごとに1つにまとめる。場所と三角の数はそのまま、動く形（onBeforeRender）はまとめない', () => {
  const root = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
  const other = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
  const sub = new THREE.Group();
  sub.position.set(10, 0, 0);
  root.add(sub);
  for (let k = 0; k < 5; k++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    m.position.set(k * 2, 0, 0);
    (k % 2 ? sub : root).add(m);
  }
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), other));
  const far = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
  far.position.set(1000, 0, 0);
  root.add(far);
  const moving = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
  moving.onBeforeRender = () => {};
  root.add(moving);
  const r = mergeMeshes(root, 250);
  assert.equal(r.before, 7);
  const meshes = [];
  root.traverse((m) => m.isMesh && meshes.push(m));
  // 赤 5つ（近い区画）→ 1、遠い赤 1、緑 1、動く 1
  assert.equal(meshes.length, 4);
  const merged = meshes.find((m) => m.geometry.attributes.position.count === 5 * 36);
  assert.ok(merged, 'まとまっていない');
  merged.geometry.computeBoundingBox();
  // いちばん右の箱は sub の中の k=3（10 + 6 = 16）の右はし 16.5
  assert.ok(Math.abs(merged.geometry.boundingBox.max.x - 16.5) < 1e-6, `${merged.geometry.boundingBox.max.x}`);
  assert.ok(meshes.includes(moving));
});
