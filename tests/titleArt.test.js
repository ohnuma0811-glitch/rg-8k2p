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

test('Kyugo の目は、Soki と同じかわいい丸い目（タイトルの絵・顔のアイコン。2026-10-14 のユーザー依頼）', () => {
  const round = (svg) => (svg.match(/<ellipse cx="\d+" cy="124" rx="9" ry="12" fill="#1b1b22"\/>/g) || []).length;
  assert.equal(round(faceSvg('soki')), 2);
  assert.equal(round(faceSvg('kyugo')), 2, 'Kyugo の目が丸くない');
  assert.ok(!faceSvg('kyugo').includes('kyugo-eye'), '横長の目が残っている');
});

test('顔のアイコンは、丸の真ん中に顔（目と口のあたり）が来るように切り取る（2026-10-14 のユーザー依頼）', () => {
  for (const ch of ['kyugo', 'soki']) {
    const [x, y, w, h] = faceSvg(ch).match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
    // 顔の真ん中は (100, 118) あたり（目が 124、口が 150、頭のてっぺんが 46）
    assert.ok(Math.abs(x + w / 2 - 100) < 1, `${ch} 横 ${x + w / 2}`);
    assert.ok(Math.abs(y + h / 2 - 118) < 4, `${ch} 縦 ${y + h / 2}`);
    assert.equal(w, h, '正方形');
  }
});

test('Kyugo の舌と歯は、口の形で切り抜く（口からはみ出さない）。切り抜きの id は絵ごとにちがう（2026-10-14 の実機確認）', () => {
  const svgs = [faceSvg('kyugo'), faceSvg('kyugo'), TITLE_ART];
  const ids = svgs.map((s) => (s.match(/clipPath id="(kyugo-mouth[^"]*)"/) || [])[1]);
  assert.ok(ids.every(Boolean), 'Kyugo の口の切り抜きがない');
  assert.equal(new Set(ids).size, 3, ids.join(' '));
  svgs.forEach((s, i) => {
    const g = s.slice(s.indexOf(`clip-path="url(#${ids[i]})"`));
    assert.ok(g.indexOf('#e0605a') > 0 && g.indexOf('#e0605a') < g.indexOf('</g>'), '舌が切り抜きの中にない');
  });
});

test('タイトルの絵の Soki も、レース中と同じ赤い野球帽（白い文字「A」）をかぶる（2026-10-15 のユーザー依頼）', () => {
  for (const svg of [faceSvg('soki'), TITLE_ART.slice(TITLE_ART.indexOf('hero-kid soki'))]) {
    assert.ok(svg.includes('class="cap-crown"') && svg.includes('fill="#d7261b"'), '赤い帽子');
    assert.ok(svg.includes('class="cap-brim"'), 'つば');
    assert.ok(svg.includes('class="cap-letter"'), '白い文字 A');
  }
  assert.ok(!faceSvg('kyugo').includes('cap-crown'), 'Kyugo は帽子なし');
});

test('新しい6人の顔のアイコンがある（丸い枠いっぱいの、平らな絵）', async () => {
  const { CHARS } = await import('../src/data/characters.js');
  const seen = new Set();
  for (const c of CHARS) {
    const svg = faceSvg(c.id);
    assert.ok(svg.trim().startsWith('<svg') && svg.includes('class="face-svg"'), c.id);
    seen.add(svg);
  }
  assert.equal(seen.size, 8, '8人ともちがう絵');
  assert.ok(faceSvg('penguin').includes('#f5b400'), 'Penguin-man の黄色いくちばし');
  assert.ok(faceSvg('rabbit').includes('#e0202a'), 'Rabbit Girl の赤いリボン');
  assert.ok(faceSvg('cat').includes('#f5d020'), 'Lightning Cat の黄色い目');
});
