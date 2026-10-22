import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { buildTrack } from '../src/game/track.js';
import { COURSES } from '../src/data/tracks.js';
import { createItemWorld } from '../src/game/items.js';
import { createItemView } from '../src/render/items.js';

test('箱は1回で描く（InstancedMesh）。消えている箱は描かない。片づけるとシーンから消える', () => {
  const scene = new THREE.Scene();
  const world = createItemWorld(buildTrack(COURSES[0]));
  const view = createItemView(scene);
  view.update(world, [], 0);
  const boxes = scene.children.find((o) => o.isInstancedMesh && o.userData.kind === 'boxes');
  assert.equal(boxes.count, world.boxes.length);
  world.boxes[0].gone = 1;
  view.update(world, [], 0.1);
  assert.equal(boxes.count, world.boxes.length - 1);
  view.dispose();
  assert.equal(scene.children.length, 0);
});

test('Star の車は虹色の光に包まれる。最後の1秒は点滅する', () => {
  const scene = new THREE.Scene();
  const world = createItemWorld(buildTrack(COURSES[0]));
  const view = createItemView(scene);
  const kart = { x: 0, y: 0, z: 0, heading: 0, star: 3, orbit: [], zap: 0 };
  view.update(world, [kart], 0);
  const aura = scene.children.find((o) => o.userData.kind === 'aura');
  assert.equal(aura.visible, true);
  const c1 = aura.material.color.getHex();
  view.update(world, [kart], 0.2);
  assert.notEqual(aura.material.color.getHex(), c1, '色が変わる');
  const shown = [];
  for (let s = 0.99; s > 0; s -= 0.05) {
    kart.star = s;
    view.update(world, [kart], 1);
    shown.push(aura.visible);
  }
  assert.ok(shown.includes(true) && shown.includes(false), '点滅');
  kart.star = 0;
  view.update(world, [kart], 1);
  assert.equal(aura.visible, false);
});

test('稲妻が落ちた車の上に、稲妻が見える（zap の間だけ）', () => {
  const scene = new THREE.Scene();
  const world = createItemWorld(buildTrack(COURSES[0]));
  const view = createItemView(scene);
  const kart = { x: 5, y: 0, z: 7, heading: 0, star: 0, orbit: [], zap: 0.3 };
  view.update(world, [kart], 0);
  const bolt = scene.children.find((o) => o.userData.kind === 'bolt');
  assert.equal(bolt.visible, true);
  assert.equal(bolt.position.x, 5);
  kart.zap = 0;
  view.update(world, [kart], 0.1);
  assert.equal(bolt.visible, false);
});

test('M2: 稲妻は、幅 0.5m ほどの太いぎざぎざの帯で、高さ 30m（1px の線ではない）', () => {
  const scene = new THREE.Scene();
  const world = createItemWorld(buildTrack(COURSES[0]));
  const view = createItemView(scene);
  view.update(world, [{ x: 0, y: 0, z: 0, heading: 0, star: 0, orbit: [], zap: 0.3 }], 0);
  const bolt = scene.children.find((o) => o.userData.kind === 'bolt');
  assert.ok(bolt.isMesh && !bolt.isLine, 'メッシュ');
  assert.ok(bolt.material.isMeshBasicMaterial);
  assert.equal(bolt.material.color.getHex(), 0xfff27a);
  bolt.geometry.computeBoundingBox();
  const bb = bolt.geometry.boundingBox;
  assert.ok(bb.max.y - bb.min.y >= 29.9, '高さ');
  assert.ok(bb.max.x - bb.min.x >= 2, 'ぎざぎざ');
  const pos = bolt.geometry.attributes.position;
  assert.ok(pos.count >= 6 * 8, '帯の三角形');
  assert.ok(Math.abs(pos.getX(1) - pos.getX(0) - 0.5) < 1e-6, '幅 0.5m');
  view.dispose();
  assert.equal(scene.children.length, 0);
});

test('M4: 食べられている・走り直し中・hidden の車には、回る甲羅・バナナ・光・稲妻を出さない', () => {
  const scene = new THREE.Scene();
  const world = createItemWorld(buildTrack(COURSES[0]));
  const view = createItemView(scene);
  const base = { x: 0, y: 0, z: 0, heading: 0, star: 3, orbit: [0, 1, 2], orbitAngle: 0, trailing: 5, zap: 0.3 };
  const karts = [{ ...base }, { ...base, swallowed: true }, { ...base, respawn: 1 }, { ...base, hidden: true }];
  view.update(world, karts, 0);
  const find = (kind) => scene.children.find((o) => o.userData.kind === kind);
  assert.equal(find('greens').count, 3, '見えている1台の分だけ');
  assert.equal(find('bananas').count, 5, 'ぶら下げた5個（見えている1台の分だけ）');
  const auras = scene.children.filter((o) => o.userData.kind === 'aura');
  const bolts = scene.children.filter((o) => o.userData.kind === 'bolt');
  assert.equal(auras.filter((a) => a.visible).length, 1);
  assert.equal(bolts.filter((a) => a.visible).length, 1);
  view.dispose();
});

test('バナナは、皮だけを逆さにして立てた形: 上に茶色の軸、黄色い皮が下へ開いて地面に着く。白い実はない（2026-10-23 のユーザー依頼）', () => {
  const scene = new THREE.Scene();
  const view = createItemView(scene);
  const mesh = scene.children.find((o) => o.userData.kind === 'bananas');
  assert.ok(mesh.material.vertexColors, '色は形の点ごと');
  const pos = mesh.geometry.attributes.position;
  const col = mesh.geometry.attributes.color;
  let minY = Infinity; let maxY = -Infinity; let cream = 0; let brownTop = Infinity; let lowWide = 0;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    if (col.getZ(i) > 0.5) cream++;
    if (col.getX(i) < 0.5) brownTop = Math.min(brownTop, y);
    if (y < 0.15) lowWide = Math.max(lowWide, Math.hypot(pos.getX(i), pos.getZ(i)));
  }
  assert.equal(cream, 0, '白い実はない');
  assert.ok(minY > -0.01 && minY < 0.05, `地面に立つ（下 ${minY.toFixed(2)}）`);
  assert.ok(brownTop > maxY - 0.2, `茶色の軸はいちばん上（${brownTop.toFixed(2)} / ${maxY.toFixed(2)}）`);
  assert.ok(lowWide > 0.55, `皮の先は外へ開いて地面の近く（${lowWide.toFixed(2)}m）`);
  view.dispose();
});

test('甲羅は、半分の球の下に白いフチ（2026-10-22 のユーザー依頼「甲羅らしく」）。緑と赤の上は、その色', () => {
  const scene = new THREE.Scene();
  createItemView(scene);
  for (const [kind, hex] of [['greens', 0x2fb54a], ['reds', 0xe8312a]]) {
    const geo = scene.children.find((o) => o.userData.kind === kind).geometry;
    const pos = geo.attributes.position;
    const col = geo.attributes.color;
    const want = new THREE.Color(hex);
    let white = 0;
    let top = 0;
    let lowY = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const isWhite = col.getX(i) === 1 && col.getY(i) === 1 && col.getZ(i) === 1;
      if (isWhite) {
        white++;
        lowY = Math.min(lowY, pos.getY(i));
      }
      if (pos.getY(i) > 0.6) {
        top++;
        assert.ok(Math.abs(col.getX(i) - want.r) < 1e-6 && Math.abs(col.getY(i) - want.g) < 1e-6, kind);
      }
    }
    assert.ok(white > 0 && top > 0, kind);
    assert.ok(Math.abs(lowY) < 1e-6, '白いフチのいちばん下が地面');
  }
});
