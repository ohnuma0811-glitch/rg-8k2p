import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blendPose } from '../src/render/interp.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('前の計算と今の計算のあいだを、割合 alpha でつなぐ（描く間隔がばらついても、なめらかに見える）', () => {
  const prev = { x: 0, y: 0, z: 0, heading: 0, move: 0 };
  const cur = { x: 10, y: 2, z: -4, heading: 0.4, move: 0.2 };
  const p = blendPose(prev, cur, 0.25);
  near(p.x, 2.5);
  near(p.y, 0.5);
  near(p.z, -1);
  near(p.heading, 0.1);
  near(p.move, 0.05);
});

test('alpha が 0 なら前の計算、1 なら今の計算', () => {
  const prev = { x: 1, y: 0, z: 1, heading: 1, move: 1 };
  const cur = { x: 3, y: 0, z: 5, heading: 2, move: 2 };
  assert.deepEqual(blendPose(prev, cur, 0), prev);
  assert.deepEqual(blendPose(prev, cur, 1), cur);
});

test('向きが -180度と180度をまたぐときは、近い方を回ってつなぐ', () => {
  const prev = { x: 0, y: 0, z: 0, heading: Math.PI - 0.1, move: Math.PI - 0.1 };
  const cur = { x: 0, y: 0, z: 0, heading: -Math.PI + 0.1, move: -Math.PI + 0.1 };
  const p = blendPose(prev, cur, 0.5);
  near(Math.cos(p.heading), -1);
  near(Math.abs(Math.sin(p.heading)), 0);
});
