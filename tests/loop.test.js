import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, STEP } from '../src/loop.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('1/60秒たてば1回更新', () => {
  const r = advance(0, STEP, STEP);
  assert.equal(r.steps, 1);
  close(r.acc, 0);
});

test('120Hz の画面では2フレームに1回更新', () => {
  const a = advance(0, STEP / 2, STEP);
  assert.equal(a.steps, 0);
  const b = advance(a.acc, STEP / 2, STEP);
  assert.equal(b.steps, 1);
  close(b.acc, 0);
});

test('重くて30fpsしか出ないときは1フレームで2回更新（ゲーム速度は同じ）', () => {
  const r = advance(0, STEP * 2, STEP);
  assert.equal(r.steps, 2);
});

test('バックグラウンドから戻って大きな時間がたっても、更新は最大5回（ワープしない）', () => {
  const r = advance(0, 10, STEP);
  assert.equal(r.steps, 5);
  close(r.acc, 0);
});

test('経過時間0なら更新しない', () => {
  const r = advance(0, 0, STEP);
  assert.equal(r.steps, 0);
  close(r.acc, 0);
});

test('端数は次のフレームに持ち越す', () => {
  const r = advance(0, STEP * 1.5, STEP);
  assert.equal(r.steps, 1);
  close(r.acc, STEP * 0.5);
});
