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
