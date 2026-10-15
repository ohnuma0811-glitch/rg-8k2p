import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, markS } from '../src/game/track.js';
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
    if (spot.anywhere) {
      // ロータリーの島の上の標識だけは、分離帯がなくてもよい（島の上にある）
      assert.ok(t.islands.some((isl) => Math.hypot(isl.x - spot.x, isl.z - spot.z) < isl.r), `島の上にない: s=${spot.s}`);
    } else assert.ok(t.samples[((Math.round(spot.s) % n) + n) % n].median > 0, `s=${spot.s}`);
  }
});

test('とくに大事な景色（設計書 4.1）は、どれも置かれている', () => {
  const group = buildScenery(t, KAMPAR_SCENERY);
  const names = KAMPAR_SCENERY.map((i) => i.part);
  for (const p of ['westlakeVillas', 'westlakeSchool', 'hospitalUtar', 'kamparSign', 'footbridge', 'pipeBridge']) assert.ok(names.includes(p), p);
  assert.deepEqual(group.userData.skippedLandmarks, []);
});

test('大きな目印は、自分の前の道（同じ区間）ではなく、ほかの区間の道にかかるときだけ置かない', () => {
  // F の手前の左（道のふちから10m）: 自分の道の25m先の点は近いが、それは同じ道なので置ける
  const spot = placeSpot(t, markS(t, ['E', 'F', 0.82]), -1, 10);
  assert.ok(sceneryClear(t, spot, 20));
  // 道の上（ほかの区間の道の真ん中）に置こうとしたら、置かない
  const other = placeSpot(t, markS(t, ['C', 'D', 0.5]), 0, 0);
  const far = { ...placeSpot(t, markS(t, ['H', 'I', 0.5]), -1, 2), x: other.x, z: other.z };
  assert.equal(sceneryClear(t, far, 5), false);
});

test('ロータリーの出口に、矢印の標識と矢羽根の板がある。コースでない道はふさぐ（2026-10-15 のユーザー依頼）', () => {
  const parts = KAMPAR_SCENERY.map((i) => i.part);
  assert.ok(parts.filter((p) => p === 'arrowSign').length >= 3);
  assert.ok(parts.filter((p) => p === 'chevronBoard').length >= 6);
  assert.ok(parts.filter((p) => p === 'stubRoad').length >= 3); // 少しだけ描いた道と、赤白の柵
  const group = buildScenery(t, KAMPAR_SCENERY);
  assert.deepEqual(group.userData.skippedLandmarks, []);
});

test('そのほかの目印（設計書 4 の表）も置かれている', () => {
  const parts = KAMPAR_SCENERY.map((i) => i.part);
  for (const p of ['curvedMall', 'museumSign', 'gBuilding', 'hotel', 'waterTowerBB', 'waterTowerUtar', 'utarHall', 'facultyBuilding', 'archGate']) assert.ok(parts.includes(p), p);
});

test('道の上の横断幕で場所が分かる: WestLake Villas、学校、病院、UTAR（2026-10-15 のユーザー依頼）', () => {
  const texts = KAMPAR_SCENERY.filter((i) => i.part === 'banner').map((i) => i.text).join(' | ');
  for (const w of ['WestLake Villas', 'Westlake International School', 'OPEN DAY', 'HOSPITAL UTAR', 'UTAR']) assert.ok(texts.includes(w), w);
});

test('直角の角の正面には通行止めの道が続く。町の横道の所には建物を置かない', async () => {
  const { aheadSpot } = await import('../src/render/town/scenery.js');
  const group = buildScenery(t, KAMPAR_SCENERY);
  const ahead = group.userData.spots.filter((s) => s.side === 2);
  assert.ok(ahead.length >= 7, `${ahead.length}`);
  // 正面の道は、角の外の柵より外にある（コースの上に出ない）
  for (const sp of ahead) {
    const n = t.samples.length;
    for (const q of t.samples) assert.ok(Math.hypot(q.x - sp.x, q.z - sp.z) >= q.wall - 1, `s=${sp.s.toFixed(0)} がコースの上`);
    assert.ok(n > 0);
  }
  // 横道のある所の、同じ側には建物を置かない
  const roads = KAMPAR_SCENERY.filter((i) => i.part === 'stubRoad' && !i.ahead).map((i) => ({ s: markS(t, i.at), side: i.side }));
  for (const sp of group.userData.spots) {
    if (sp.part !== 'shophouse') continue;
    for (const r of roads) assert.ok(!(r.side === sp.side && Math.abs(r.s - sp.s) < 9), `s=${sp.s} の横道に建物`);
  }
});

test('走ってくる車の方を向いた大きな看板: 学校・病院・Lotus\'s・Grand Kampar Hotel（WestLake Villas は角の看板と横断幕だけ。2026-10-15 のユーザー依頼）', () => {
  const texts = KAMPAR_SCENERY.filter((i) => i.part === 'driverBoard').map((i) => i.text).join(' | ');
  for (const w of ['WESTLAKE INTERNATIONAL SCHOOL', 'HOSPITAL UTAR', "Lotus's", 'Grand Kampar Hotel']) assert.ok(texts.includes(w), w);
  const group = buildScenery(t, KAMPAR_SCENERY);
  assert.equal(group.userData.spots.filter((s) => s.part === 'driverBoard').length, KAMPAR_SCENERY.filter((i) => i.part === 'driverBoard').length);
});

test('WestLake Villas・学校・病院は道の左のふちにくっつける（道のふちから2m 以内）', () => {
  for (const p of ['westlakeVillas', 'westlakeSchool', 'hospitalUtar']) {
    const it = KAMPAR_SCENERY.find((i) => i.part === p);
    assert.equal(it.side, -1, p);
    assert.ok(it.back <= 2, `${p}: ${it.back}`);
  }
});

test('A・B・F は交差点: 正面と反対側にも通行止めの道、横断歩道、信号機（いつも青）', () => {
  assert.deepEqual(COURSE2.intersections, ['A', 'B', 'F']);
  for (const m of ['A', 'B', 'F']) {
    const at = (i) => i.at && i.at[0] === m && i.at[1] === m;
    assert.ok(KAMPAR_SCENERY.some((i) => i.part === 'stubRoad' && i.ahead === true && at(i)), `${m} の正面`);
    assert.ok(KAMPAR_SCENERY.some((i) => i.part === 'stubRoad' && i.ahead === 'back' && at(i)), `${m} の反対側`);
    assert.ok(KAMPAR_SCENERY.filter((i) => i.part === 'trafficLight' && i.at[0] === m).length >= 2, `${m} の信号`);
  }
  const group = buildScenery(t, KAMPAR_SCENERY);
  for (const sp of group.userData.spots.filter((s) => s.side === 2)) {
    for (const q of t.samples) assert.ok(Math.hypot(q.x - sp.x, q.z - sp.z) >= q.wall - 1, `s=${sp.s.toFixed(0)} の道がコースの上`);
  }
});

test('UTAR の敷地の入口（H の手前）と I の門に、アーチと大きな UTAR の看板', () => {
  const arches = KAMPAR_SCENERY.filter((i) => i.part === 'archGate');
  assert.ok(arches.some((i) => i.at[1] === 'H'), 'H の手前のアーチ');
  assert.ok(arches.some((i) => i.at[1] === 'I' || i.at[0] === 'I'), 'I の門');
});
