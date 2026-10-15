import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSE2 } from '../src/data/tracks.js';
import { placeSpot, sceneryClear, buildScenery } from '../src/render/town/scenery.js';
import { createBuilder } from '../src/render/town/builder.js';
import { KAMPAR_SCENERY } from '../src/data/kampar.js';

const t = buildTrack(COURSE2);

test('部品は道を向いて置かれる（左に置けば右を、右に置けば左を向く）', () => {
  const s = 100;
  const p = t.samples[s];
  for (const side of [-1, 1]) {
    const spot = placeSpot(t, s, side, 5);
    const front = [Math.sin(spot.ry), Math.cos(spot.ry)]; // 部品の +z が向く方向
    const toRoad = [p.x - spot.x, p.z - spot.z];
    assert.ok(front[0] * toRoad[0] + front[1] * toRoad[1] > 0, `side ${side}`);
    assert.ok(Math.abs(Math.hypot(...toRoad) - (p.wall + 5)) < 1e-6);
  }
});

test('同じ色の箱はまとめて1つの形にする（描く回数を減らす）', () => {
  const b = createBuilder();
  for (let k = 0; k < 50; k++) b.box(1, 1, 1, 0xff0000, k, 0, 0);
  b.box(1, 1, 1, 0x00ff00, 0, 0, 0);
  const g = b.build();
  assert.equal(g.children.length, 1); // 色は頂点の色にして、1つの形
  assert.equal(g.children[0].geometry.attributes.position.count, 51 * 36);
});

test('景色は道・ほかの道・ロータリーの島にかからない（かかる物は置かない）。目印は必ず置ける', () => {
  const group = buildScenery(t, KAMPAR_SCENERY);
  assert.ok(group.userData.placed > 0);
  assert.deepEqual(group.userData.skippedLandmarks, []);
  for (const spot of group.userData.spots) assert.ok(sceneryClear(t, spot, spot.radius), JSON.stringify(spot));
});

test('どの区間にも景色がある（設計書 4 の表のとおり、区間ごとに何か置く）', () => {
  const group = buildScenery(t, KAMPAR_SCENERY);
  const marks = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  for (let k = 0; k < marks.length; k++) {
    const from = marks[k] === 'S' ? 0 : t.marks[marks[k]];
    const to = k + 1 < marks.length ? t.marks[marks[k + 1]] : t.length;
    const n = group.userData.spots.filter((s) => s.s >= from && s.s < to).length;
    assert.ok(n >= 5, `${marks[k]} の区間の景色が ${n} 個`);
  }
});

test('道の真ん中（side 0）に置く物は、分離帯のある所だけ（道の上に街灯や木が立たない）', () => {
  const group = buildScenery(t, [{ part: 'lamp', from: ['E', 'F', 0.1], to: ['E', 'F', 0.9], every: 30, side: 0, radius: 1 }, ...KAMPAR_SCENERY]);
  const n = t.samples.length;
  for (const spot of group.userData.spots.filter((s) => s.side === 0)) {
    assert.ok(t.samples[((Math.round(spot.s) % n) + n) % n].median > 0, `s=${spot.s}`);
  }
});
