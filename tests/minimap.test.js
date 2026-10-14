import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSE1 } from '../src/data/tracks.js';
import { mapFit } from '../src/render/minimap.js';

const track = buildTrack(COURSE1);

test('コースマップ: コース全体が、地図の枠（余白の内側）に収まり、縦横の比は変えない', () => {
  const W = 140;
  const H = 110;
  const PAD = 8;
  const fit = mapFit(track.samples, W, H, PAD);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of track.samples) {
    const q = fit(p.x, p.z);
    minX = Math.min(minX, q.x);
    maxX = Math.max(maxX, q.x);
    minY = Math.min(minY, q.y);
    maxY = Math.max(maxY, q.y);
  }
  assert.ok(minX >= PAD - 1e-9 && maxX <= W - PAD + 1e-9, `x ${minX}..${maxX}`);
  assert.ok(minY >= PAD - 1e-9 && maxY <= H - PAD + 1e-9, `y ${minY}..${maxY}`);
  // 縦か横のどちらかは、枠いっぱい
  assert.ok(Math.abs(maxX - minX - (W - 2 * PAD)) < 1e-6 || Math.abs(maxY - minY - (H - 2 * PAD)) < 1e-6);
  // 同じ長さは、縦でも横でも同じ長さに映る
  const a = fit(0, 0);
  const b = fit(100, 0);
  const c = fit(0, 100);
  assert.ok(Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - Math.hypot(c.x - a.x, c.y - a.y)) < 1e-9);
});
