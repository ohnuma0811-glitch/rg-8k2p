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

test('Kyugo の顔にはピンクのほっぺがない（タイトルの絵・顔のアイコン。2026-10-14 のユーザー依頼）。Soki はそのまま', () => {
  const kyugo = faceSvg('kyugo');
  assert.ok(!kyugo.includes('#ff8a8a'), 'Kyugo にほっぺがある');
  assert.ok(faceSvg('soki').includes('#ff8a8a'), 'Soki のほっぺがない');
  const hero = TITLE_ART.slice(0, TITLE_ART.indexOf('hero-kid soki'));
  assert.ok(!hero.includes('#ff8a8a'), 'タイトルの Kyugo にほっぺがある');
});

test('タイトルの Kyugo: 目は水平（両はしが同じ高さ）で、目の上の線はない（2026-10-14 のユーザー依頼。レース中の顔とそろえる）', () => {
  const svg = faceSvg('kyugo');
  const shapes = [...svg.matchAll(/<clipPath id="kyugo-eye[^"]*"><path d="M([\d.]+) ([\d.]+) Q[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)/g)];
  assert.equal(shapes.length, 2);
  for (const m of shapes) assert.equal(m[2], m[4], `目のはしの高さ ${m[2]} / ${m[4]}`);
  assert.ok(!svg.includes('stroke="#1b1b22"'), '目の上の線がある');
});

test('タイトルの Kyugo の目は、切れ長でない普通の目（縦が横の6割以上。2026-10-14 のユーザー依頼）', () => {
  const m = faceSvg('kyugo').match(/<clipPath id="kyugo-eye[^"]*"><path d="M([\d.]+) ([\d.]+) Q[\d.]+ ([\d.]+) ([\d.]+) [\d.]+ Q[\d.]+ ([\d.]+)/);
  const width = Math.abs(Number(m[4]) - Number(m[1]));
  const height = (Number(m[5]) - Number(m[3])) / 2; // 2次ベジェのふくらみは、制御点までの半分
  assert.ok(height / width >= 0.6, `縦 ${height} / 横 ${width}`);
});
