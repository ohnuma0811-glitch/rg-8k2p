import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWarp, warpLook, suckPose, SUCK, PORTAL_Z } from '../src/render/world/warp.js';

// ワープの最後（2026-10-22 のユーザー依頼「最後は正面の円の中心にカートが小さくなりつつ勢いよく吸い込まれてフェードアウト」）
test('ワープの最後は、正面に光の円が出て、車がその真ん中へ吸いこまれ、そのあと白く消える', () => {
  assert.equal(warpLook(0.5).suck, 0, 'はじめは吸いこまない');
  assert.equal(warpLook(SUCK.from).suck, 0);
  assert.equal(warpLook(SUCK.to).suck, 1);
  assert.equal(warpLook(1).suck, 1);
  let last = 0;
  for (let p = SUCK.from; p <= SUCK.to; p += 0.01) {
    const k = warpLook(p).suck;
    assert.ok(k >= last - 1e-9, '吸いこみは進むだけ');
    last = k;
  }
  assert.ok(warpLook(SUCK.from).portal > 0.9, '吸いこむ前に、正面の円が見えている');
  assert.ok(warpLook(0.3).portal < 0.1, 'はじめは円はない');
  assert.ok(warpLook(SUCK.from).flash === 0, '吸いこみは白くなる前');
  assert.ok(warpLook(0.97).flash > 0.9, '吸いこまれたあと、白く消える');
});

test('吸いこまれる車: はじめはその場、だんだん速く（勢いよく）円の真ん中へ、小さくなって消える', () => {
  const start = { x: 0, y: -3.4, z: -6.3 }; // カメラから見た車の位置
  const a = suckPose(start, 0);
  assert.deepEqual([a.x, a.y, a.z, a.scale], [0, -3.4, -6.3, 1]);
  const end = suckPose(start, 1);
  assert.ok(Math.hypot(end.x, end.y, end.z + PORTAL_Z) < 1e-9, '円の真ん中');
  assert.ok(end.scale < 0.1, '小さくなる');
  const half = suckPose(start, 0.5);
  const moved = (start.z - half.z) / (start.z + PORTAL_Z);
  assert.ok(moved < 0.35, `はじめはゆっくり、最後に速く（半分の時間で ${moved.toFixed(2)}）`);
  assert.ok(half.scale < 1 && half.scale > end.scale);
});

test('光の円は、カメラの正面（真ん中）に、吸いこむ所の奥にある', () => {
  const g = buildWarp().children[0];
  const portal = g.userData.portal;
  assert.ok(portal, '円がある');
  assert.equal(portal.position.x, 0);
  assert.equal(portal.position.y, 0);
  assert.equal(portal.position.z, -PORTAL_Z);
});
