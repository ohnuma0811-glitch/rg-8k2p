import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engineParams } from '../src/audio/mix.js';

test('エンジン音: 止まっていると 55Hz、最高速で 180Hz、加速中は +15Hz。速いほど大きい', () => {
  assert.equal(engineParams(0, 41, false).freq, 55);
  assert.equal(engineParams(41, 41, false).freq, 180);
  assert.equal(engineParams(41, 41, true).freq, 195);
  assert.ok(engineParams(30, 41, false).gain > engineParams(10, 41, false).gain);
  assert.equal(engineParams(-5, 41, false).freq, 55, 'バックでも低いまま');
  assert.equal(engineParams(80, 41, false).freq, 180, '最高速より速くても上がりすぎない');
});

import { crowdMix, CROWD_MAX } from '../src/audio/mix.js';

test('歓声: 観客席の近く（25m 以内）でいちばん大きく、遠いほど小さく、200m で聞こえない', () => {
  const spot = { x: 0, z: 0 };
  const at = (x) => crowdMix({ x, z: 0, heading: Math.PI / 2 }, spot).gain;
  assert.equal(at(10), CROWD_MAX);
  assert.ok(at(60) < CROWD_MAX && at(60) > at(150));
  assert.equal(at(250), 0);
});

test('歓声: 観客席がある側から聞こえる（右にあれば右、左にあれば左）', () => {
  // heading 0 は x の向き。右は +z
  const kart = { x: 0, z: 0, heading: 0 };
  assert.ok(crowdMix(kart, { x: 0, z: 40 }).pan > 0.9);
  assert.ok(crowdMix(kart, { x: 0, z: -40 }).pan < -0.9);
  assert.ok(Math.abs(crowdMix(kart, { x: 40, z: 0 }).pan) < 1e-9);
});
