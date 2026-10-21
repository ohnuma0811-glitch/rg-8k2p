import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, locate } from '../src/game/track.js';
import { COURSES } from '../src/data/tracks.js';
import { headPoolRows, HEAD_POOL } from '../src/render/scene.js';

// 車のライト（道の上の明るい楕円）は、道の形にそって曲げる（2026-10-22 のユーザー依頼）:
// 平らな板だと、らせんの上り坂では道の下にもぐって消え（Kyugo Mountain）、富士山のトンネルの山と谷では、はしがもぐったり浮いたりして変だった
test('トンネルの中（らせん・山と谷も）のどこでも、ライトの楕円は道の上にぴったりのる（高さ ±0.3m。急カーブの内がわのはしで少しずれる。幅の中）', () => {
  for (const def of COURSES) {
    const t = buildTrack(def);
    let n = 0;
    for (let i = 0; i < t.samples.length; i++) {
      const p = t.samples[i];
      if (!p.tunnel || p.y === null) continue;
      for (const lat of [0, -(p.wall - 2), p.wall - 2]) {
        const kart = { x: p.x - Math.sin(p.h) * lat, z: p.z + Math.cos(p.h) * lat, y: p.y, move: p.h, seg: i };
        const rows = headPoolRows(kart, t);
        assert.ok(rows.length >= 9, '前後に何列も');
        for (const r of rows) {
          for (const side of [-1, 1]) {
            const x = r.x - Math.sin(r.h) * side * HEAD_POOL[1];
            const z = r.z + Math.cos(r.h) * side * HEAD_POOL[1];
            const loc = locate(t, x, z, r.i, 40, r.y);
            const q = t.samples[loc.i];
            if (q.y === null) continue; // 道の終わり
            const off = Math.abs(-(x - q.x) * Math.sin(q.h) + (z - q.z) * Math.cos(q.h));
            assert.ok(Math.abs(r.y - q.y) < 0.3, `${def.name} ${i} 横 ${lat}: 高さ ${(r.y - q.y).toFixed(2)}`);
            assert.ok(off < q.wall + 0.5, `${def.name} ${i} 横 ${lat}: 道の外 ${off.toFixed(1)}m`);
            n++;
          }
        }
      }
    }
    if (def.name === 'Kyugo Mountain') assert.ok(n > 1000, 'らせんのトンネルを調べた');
  }
});

test('前の列ほど遠い: 車のすぐ前から、道にそって 2×HEAD_POOL[0] m 先まで', () => {
  const t = buildTrack(COURSES.find((c) => c.theme === 'world'));
  const i = t.samples.findIndex((p) => p.tunnel && p.y !== null);
  const p = t.samples[i];
  const rows = headPoolRows({ x: p.x, z: p.z, y: p.y, move: p.h, seg: i }, t);
  const d = rows.map((r) => Math.hypot(r.x - p.x, r.z - p.z));
  for (let k = 1; k < d.length; k++) assert.ok(d[k] > d[k - 1]);
  assert.ok(d[0] < 1.5 && Math.abs(d[d.length - 1] - 2 * HEAD_POOL[0]) < 2);
});
