import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSE1 } from '../src/data/tracks.js';
import { bankSides, BANK_FROM, BANK_WIDTH } from '../src/render/trackMesh.js';

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
