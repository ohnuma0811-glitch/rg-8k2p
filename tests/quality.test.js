import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextQuality, pixelRatio, QUALITY_MIN, QUALITY_MAX } from '../src/render/quality.js';

test('重い（50fps未満。2026-10-19 に 45 から。47fps のままだった）と細かさを下げる。0.5より下げない', () => {
  assert.equal(nextQuality(1, 47), 0.85);
  assert.equal(nextQuality(1, 30), 0.85);
  assert.equal(nextQuality(0.55, 20), QUALITY_MIN);
});

test('なめらか（57fpsより上）なら少しずつ戻す。1より上げない', () => {
  assert.equal(nextQuality(0.85, 60), 0.9);
  assert.equal(nextQuality(1, 60), QUALITY_MAX);
});

test('その間なら変えない（行ったり来たりしない）', () => {
  assert.equal(nextQuality(0.7, 52), 0.7);
});

test('画素の細かさは端末の値（上限2）に細かさをかけたもの', () => {
  assert.equal(pixelRatio(3, 1), 2);
  assert.equal(pixelRatio(2, 0.5), 1);
  assert.equal(pixelRatio(1, 0.5), 1); // 画面の画素より粗くはしない（PC がぼやけないように）
  assert.equal(pixelRatio(undefined, 1), 1);
});
