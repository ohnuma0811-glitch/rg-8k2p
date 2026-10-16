import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSE3 } from '../src/data/tracks.js';
import { terrainHeight } from '../src/render/terrain.js';

const t = buildTrack(COURSE3);

test('道のすぐ外の地面は、道とほぼ同じ高さ（道が浮いたり埋まったりしない）', () => {
  for (let i = 0; i < t.samples.length; i += 7) {
    const p = t.samples[i];
    if (p.y === null || p.bridge || p.ramp) continue;
    for (const side of [-1, 1]) {
      const d = p.wall + 1;
      const y = terrainHeight(t, p.x - Math.sin(p.h) * side * d, p.z + Math.cos(p.h) * side * d);
      assert.ok(y <= p.y + 0.05 && y > p.y - 1.5, `点 ${i}: 地面 ${y.toFixed(2)} 道 ${p.y.toFixed(2)}`);
    }
  }
});

test('道の上の地面は、道より下（橋の下の道は、橋の高さに引っぱられない）', () => {
  for (let i = 0; i < t.samples.length; i += 5) {
    const p = t.samples[i];
    if (p.y === null || p.bridge) continue;
    assert.ok(terrainHeight(t, p.x, p.z) <= p.y + 0.01, `点 ${i}`);
  }
});

test('川の上は、まわりより低い（水が見える）', () => {
  for (const [x, z] of COURSE3.river.slice(1, -1)) {
    // データの座標を、コースの座標に直す（buildTrack と同じ倍率）
    const p = t.toWorld(x, z);
    assert.ok(terrainHeight(t, p.x, p.z) < -1, `${x},${z}`);
  }
});
