import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSE2 } from '../src/data/tracks.js';
import { jungleSpots, insideLoop } from '../src/render/town/jungle.js';

const t = buildTrack(COURSE2);

test('ジャングルはコースの外側だけ（コースの内側には置かない。2026-10-15 のユーザー依頼）', () => {
  const spots = jungleSpots(t, []);
  assert.ok(spots.length > 200, `${spots.length}`);
  for (const p of spots) assert.equal(insideLoop(t.samples, p.x, p.z), false);
});

test('ジャングルは道と、景色の建物のまわりにはかからない', () => {
  const avoid = [{ x: t.samples[300].x - 60, z: t.samples[300].z, radius: 30 }];
  const spots = jungleSpots(t, avoid);
  for (const p of spots) {
    for (const q of t.samples) assert.ok(Math.hypot(q.x - p.x, q.z - p.z) >= q.wall + 8, 'ジャングルが道にかかる');
    for (const a of avoid) assert.ok(Math.hypot(a.x - p.x, a.z - p.z) >= a.radius, 'ジャングルが建物にかかる');
  }
});

test('コースの内側の左半分は水（Westlake の湖。2026-10-15 のユーザー依頼）: 道と建物のまわりはあける', async () => {
  const { waterCells, WATER_CELL } = await import('../src/render/town/water.js');
  const xs = t.samples.map((p) => p.x);
  const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
  const avoid = [{ x: t.samples[1300].x + 60, z: t.samples[1300].z, radius: 20 }];
  const cells = waterCells(t, avoid);
  assert.ok(cells.length * WATER_CELL ** 2 > 40000, `水が ${cells.length} マスしかない`);
  for (const c of cells) {
    assert.ok(insideLoop(t.samples, c.x, c.z), '水がコースの外');
    assert.ok(c.x < mid, '水が右半分');
    for (const q of t.samples) assert.ok(Math.hypot(q.x - c.x, q.z - c.z) >= q.wall + 2, '水が道にかかる');
    for (const a of avoid) assert.ok(Math.hypot(a.x - c.x, a.z - c.z) >= a.radius, '水が建物にかかる');
  }
});
