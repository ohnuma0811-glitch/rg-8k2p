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
