import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSE1 } from '../src/data/tracks.js';
import { bankSides, BANK_FROM, BANK_WIDTH, grandstandSpot } from '../src/render/trackMesh.js';

const track = buildTrack(COURSE1);
const { samples } = track;
const n = samples.length;

test('土手は、ほかの道（ジャンプ台や交わる所を含む）にかからない', () => {
  const sides = bankSides(track);
  for (let i = 0; i < n; i++) {
    const p = samples[i];
    for (const side of [-1, 1]) {
      if (!sides[i][side]) continue;
      for (const off of [BANK_FROM, BANK_FROM + BANK_WIDTH / 2, BANK_FROM + BANK_WIDTH]) {
        const d = p.wall + off;
        const x = p.x - Math.sin(p.h) * side * d;
        const z = p.z + Math.cos(p.h) * side * d;
        for (let j = 0; j < n; j++) {
          const gap = Math.min(Math.abs(i - j), n - Math.abs(i - j));
          if (gap < 80) continue;
          const q = samples[j];
          assert.ok(Math.hypot(q.x - x, q.z - z) > q.wall + 1, `点${i}の土手が点${j}の道にかかる`);
        }
      }
    }
  }
});

test('コースに貼る板（スタートライン・加速板・ジャンプ台の矢印）は、上から見える向き', async () => {
  const THREE = await import('../vendor/three.module.min.js');
  const { strip } = await import('../src/render/trackMesh.js');
  const r = COURSE1.jump.ramp;
  const m = strip(track, track.cross.sA + r.from, track.cross.sA + r.to, (p) => p.y + 0.06, new THREE.MeshBasicMaterial());
  m.geometry.computeVertexNormals();
  const ny = m.geometry.attributes.normal.getY(0);
  assert.ok(ny > 0 || m.material.side === THREE.DoubleSide, `面の向き ${ny}`);
});

test('ジャンプの着地の所の道にも、両側に柵がある', async () => {
  const { fenceSides } = await import('../src/render/trackMesh.js');
  const sides = fenceSides(track);
  const j = COURSE1.jump;
  for (let d = j.gap.to + 8; d <= j.gap.to + 30; d += 2) {
    const i = Math.round(track.cross.sA + d);
    assert.ok(sides[i][-1] && sides[i][1], `交わる所から${d}m 先の点${i}に柵がない`);
  }
});

test('柵は、ほかの道の舗装の上には立たない（交わる所の下の道をふさがない）', async () => {
  const { fenceSides } = await import('../src/render/trackMesh.js');
  const sides = fenceSides(track);
  for (let i = 0; i < n; i++) {
    const p = samples[i];
    for (const side of [-1, 1]) {
      if (!sides[i][side]) continue;
      const x = p.x - Math.sin(p.h) * side * p.wall;
      const z = p.z + Math.cos(p.h) * side * p.wall;
      for (let j = 0; j < n; j++) {
        const gap = Math.min(Math.abs(i - j), n - Math.abs(i - j));
        const q = samples[j];
        if (gap < 60 || q.y === null) continue;
        assert.ok(Math.hypot(q.x - x, q.z - z) > COURSE1.roadHalf + 1, `点${i}の柵が点${j}の道の上`);
      }
    }
  }
});

test('観客席の真ん中は、スタートラインの横の柵の外（道の真ん中から20m〜40m）', () => {
  const spot = grandstandSpot(track);
  const p = track.samples[track.startIndex];
  const d = Math.hypot(spot.x - p.x, spot.z - p.z);
  assert.ok(d > 20 && d < 40, `${d.toFixed(1)}m`);
});

test('看板は、ほかの道（ジャンプ台・飛び越える所・横の道）の上や、その柵のすぐ外には立てない（2026-10-15 の実機確認「ジャンプ台の導線上に看板が2枚」）', async () => {
  const { signSpots } = await import('../src/render/trackMesh.js');
  const { samples } = track;
  const spots = signSpots(track);
  assert.ok(spots.length > 20, `看板 ${spots.length} 枚`);
  for (const s of spots) {
    samples.forEach((q, j) => {
      const dj = Math.min(Math.abs(j - s.i), samples.length - Math.abs(j - s.i));
      if (dj < 60) return; // 自分の道
      const d = Math.hypot(q.x - s.x, q.z - s.z);
      assert.ok(d >= q.wall + 3, `点 ${s.i} の看板が、点 ${j} の道から ${d.toFixed(1)}m（柵 ${q.wall}m）`);
    });
  }
});
