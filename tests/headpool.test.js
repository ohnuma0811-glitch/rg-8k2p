import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, locate } from '../src/game/track.js';
import { COURSES } from '../src/data/tracks.js';
import { headPoolPose, HEAD_POOL } from '../src/render/scene.js';

// 車のライト（道の上の明るい楕円）は、坂やカーブでも道の上にのる（2026-10-22 のユーザー依頼「Kyugo Mountain のトンネル内のらせんでライトが消える」）。
// 楕円が道より下にもぐると見えなくなり、カーブの外へまっすぐ出ると壁にかくれる
test('トンネルの中（らせんも）のどこでも、ライトの楕円は道にそって置く: 真ん中は道の高さ、前後のはしも道の幅の中', () => {
  for (const def of COURSES) {
    const t = buildTrack(def);
    let n = 0;
    for (let i = 0; i < t.samples.length; i++) {
      const p = t.samples[i];
      if (!p.tunnel || p.y === null) continue;
      for (const lat of [0, -(p.wall - 2), p.wall - 2]) {
        const kart = { x: p.x - Math.sin(p.h) * lat, z: p.z + Math.cos(p.h) * lat, y: p.y, move: p.h, seg: i };
        const pose = headPoolPose(kart, t);
        const dx = Math.cos(pose.yaw) * Math.cos(pose.pitch);
        const dz = Math.sin(pose.yaw) * Math.cos(pose.pitch);
        const dy = Math.sin(pose.pitch);
        for (const f of [-1, 0, 1]) {
          const x = pose.x + dx * HEAD_POOL[0] * f;
          const z = pose.z + dz * HEAD_POOL[0] * f;
          const y = pose.y + dy * HEAD_POOL[0] * f;
          const loc = locate(t, x, z, pose.i, 40, y);
          const q = t.samples[loc.i];
          if (q.y === null) continue; // 道の終わり（トンネルの出口の先）
          const off = Math.abs(-(x - q.x) * Math.sin(q.h) + (z - q.z) * Math.cos(q.h));
          // 真ん中は道にぴったり。前後のはしは、坂の曲がり目で少しずれる（道の真ん中を走るときは、もぐって 0.4m・浮いて 1m まで。もぐると見えない）
          const [down, up] = f === 0 ? [0.15, 0.15] : lat === 0 ? [0.4, 1] : [Infinity, Infinity];
          assert.ok(y - q.y > -down && y - q.y < up, `${def.name} ${i} 横 ${lat} 先 ${f}: 高さ ${(y - q.y).toFixed(2)}`);
          assert.ok(off < q.wall, `${def.name} ${i} 横 ${lat} 先 ${f}: 道の外 ${off.toFixed(1)}m`);
          n++;
        }
      }
    }
    if (def.name === 'Kyugo Mountain') assert.ok(n > 1000, 'らせんのトンネルを調べた');
  }
});
