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
