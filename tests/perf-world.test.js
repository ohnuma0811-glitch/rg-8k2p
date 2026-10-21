import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSE5 } from '../src/data/tracks.js';
import { createTurtleModel, mergeStatic } from '../src/render/models.js';
import { buildSea } from '../src/render/world/sea.js';

// World Cities がタブレットで 40fps（香港は 30fps）になった（2026-10-22 のユーザー依頼）: 描く回数を減らす
const t = buildTrack(COURSE5);
const meshes = (o) => { let n = 0; o.traverse((x) => { if (x.isMesh) n++; }); return n; };

test('海の底の亀は、1匹を1つの形で描く（足と頭を別に動かさない）', () => {
  for (let k = 0; k < 7; k++) assert.equal(meshes(mergeStatic(createTurtleModel(k))), 1, `亀 ${k}`);
});

test('海の底の泳ぐ生き物と怪獣は、1匹（1つの群れ）を材質ごとにまとめて描く', () => {
  const g = buildSea(t).children.find((c) => c.userData.swimmers);
  const swimmers = g.children.filter((c) => c.userData.swim || c.userData.watch);
  for (const s of swimmers) assert.ok(meshes(s) <= 6, `${s.userData.watch ? '怪獣' : '泳ぐ生き物'}: ${meshes(s)} 個の形`);
});

import * as THREE from '../vendor/three.module.min.js';
import { createCowModel, createCowLegs, setCowLegs } from '../src/render/models.js';
import { COURSES } from '../src/data/tracks.js';

// Kampar Town の UTAR のあたりが 45〜50fps（2026-10-22 のユーザー依頼）: 牛9頭を 54 回に分けて描いていた
test('牛は、体と頭を1つの形で描き、足は全部の牛の分をまとめて1回で描く（足は歩くように動く）', () => {
  const cow = mergeStatic(createCowModel(0, { legs: false }));
  assert.equal(meshes(cow), 1);
  const legs = createCowLegs([0, 1, 2]);
  assert.ok(legs.isInstancedMesh);
  assert.equal(legs.count, 12);
  cow.position.set(10, 0, 20);
  cow.rotation.y = 0.7;
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const ys = [];
  for (const time of [0, 0.4]) {
    setCowLegs(legs, 1, cow, time);
    for (let i = 4; i < 8; i++) {
      legs.getMatrixAt(i, m);
      p.setFromMatrixPosition(m);
      assert.ok(Math.hypot(p.x - 10, p.z - 20) < 1.3, `足 ${i} は牛の下`);
      assert.ok(Math.abs(p.y - 0.8) < 0.01);
      ys.push(new THREE.Quaternion().setFromRotationMatrix(m).z);
    }
  }
  assert.ok(Math.abs(ys[0] - ys[4]) > 0.01, '時刻で足を振る');
});

test('トンネルの中の前を照らす明かりは、光の計算を使わない（道の上の明るい楕円）。富士山のトンネルが 40fps（2026-10-22）', async () => {
  const { createWorld, setDarkness } = await import('../src/render/scene.js');
  const { tunnelLook } = await import('../src/render/snow/tunnel.js');
  const { scene } = createWorld();
  let spots = 0;
  scene.traverse((o) => { if (o.isSpotLight || o.isPointLight) spots++; });
  assert.equal(spots, 0, '前を照らす光（SpotLight）はない');
  const pool = scene.userData.light.headPool;
  const kart = { x: 10, z: 20, y: 3, move: 0 };
  setDarkness(scene, 1, tunnelLook(true), kart);
  assert.ok(pool.visible && pool.material.opacity > 0.2, '暗いトンネルの中では見える');
  pool.geometry.computeBoundingBox();
  const c = pool.geometry.boundingBox.getCenter(pool.position.clone());
  assert.ok(c.x > 9 && Math.abs(c.z - 20) < 0.01 && c.y > 3, '車の前の道の上');
  setDarkness(scene, 0, tunnelLook(true), kart);
  assert.equal(pool.visible, false, 'トンネルの外では消す');
});
