import { test } from 'node:test';
import assert from 'node:assert/strict';
import { faceSvg, TITLE_ART } from '../src/titleArt.js';

// 同じ id がいくつもあると、隠れている方（レース中の上位3人など）を使われて、歯が口からはみ出す（2026-10-14 の実機確認）
test('Soki の口の切り抜き（clipPath）の id は、絵ごとにちがい、自分の id を使う', () => {
  const svgs = [faceSvg('soki'), faceSvg('soki'), TITLE_ART];
  const ids = svgs.map((s) => s.match(/clipPath id="([^"]+)"/)[1]);
  assert.equal(new Set(ids).size, 3, ids.join(' '));
  svgs.forEach((s, i) => assert.ok(s.includes(`clip-path="url(#${ids[i]})"`), ids[i]));
});
