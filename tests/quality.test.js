import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextQuality, pixelRatio, QUALITY_MIN, QUALITY_MAX } from '../src/render/quality.js';

test('重い（50fps未満。2026-10-19 に 45 から。47fps のままだった）と細かさを下げる。QUALITY_MIN より下げない', () => {
  assert.equal(nextQuality(1, 47), 0.85);
  assert.equal(nextQuality(1, 30), 0.85);
  assert.equal(nextQuality(0.45, 20), QUALITY_MIN);
  assert.equal(QUALITY_MIN, 0.375); // タブレット（画素の細かさ 2）で 0.75 まで（2026-10-22 のユーザー依頼「World Cities が 40fps」）
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
  assert.equal(pixelRatio(2, QUALITY_MIN), 1, 'PC は画面の画素まで');
  assert.equal(pixelRatio(2, QUALITY_MIN, 0.75), 0.75, 'タブレット・スマホは 0.75 まで下げてよい（重いときだけ）');
  assert.equal(pixelRatio(1, QUALITY_MIN, 0.75), 0.75);
  assert.equal(pixelRatio(undefined, 1), 1);
});
