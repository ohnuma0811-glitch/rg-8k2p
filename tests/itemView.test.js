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
