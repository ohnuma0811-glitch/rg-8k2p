import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSES } from '../src/data/tracks.js';
import { createKart, stepKart, PHYS } from '../src/game/kart.js';
import { oneWayContact, GATE_MIN } from '../src/game/hazards.js';
import { kartParams } from '../src/game/stats.js';

// 逆走できないように、ジャンプの着地側をふさぐ（2026-10-22 のユーザー依頼「特にジャンプ台の後に逆走できないように道をふさいで」）
const built = COURSES.map((c) => buildTrack(c));
const params = kartParams({ accel: 3, top: 3, handling: 3 });

test('ジャンプの穴の向こう側と、自動の区間の着地点には、逆走を止める柵がある', () => {
  for (const t of built) {
    const ends = [];
    for (let i = 0; i < t.samples.length; i++) {
      const p = t.samples[i];
      if (p.y !== null && t.samples[p.prev]?.y === null) ends.push(i);
    }
    for (const i of ends) assert.ok(t.oneWays.some((g) => g.i === i), `${t.def.name}: 穴の向こう ${i}`);
    for (const a of t.autos ?? []) {
      const land = Math.round(a.legs[a.legs.length - 1].to) % t.length;
      assert.ok(t.oneWays.some((g) => Math.abs(g.i - land) <= 1), `${t.def.name}: ${a.id} の着地`);
    }
  }
  assert.equal(built[1].oneWays.length, 0, 'Kampar Town はジャンプがない');
  assert.ok(built[0].oneWays.length >= 1 && built[2].oneWays.length >= 2 && built[3].oneWays.length >= 1);
});

// 柵 g の前 fwd m・横 0 に、向き heading で置いた車
function kartAt(t, g, fwd, back) {
  const kart = createKart(t, g.i, 0);
  kart.x = g.x + Math.cos(g.h) * fwd;
  kart.z = g.z + Math.sin(g.h) * fwd;
  kart.y = g.y;
  kart.heading = back ? g.h + Math.PI : g.h;
  kart.move = kart.heading;
  kart.speed = 20;
  return kart;
}

test('逆向きに走ってきた車は柵で止まる。前向きの車は柵に当たらない（着地が手前でも）', () => {
  for (const t of built) {
    for (const g of t.oneWays) {
      const back = kartAt(t, g, 0.3, true);
      assert.equal(oneWayContact(back, t), 'stop', `${t.def.name} ${g.i}`);
      const fwd = (back.x - g.x) * Math.cos(g.h) + (back.z - g.z) * Math.sin(g.h);
      assert.ok(fwd >= GATE_MIN - 1e-6, `押し戻す ${fwd}`);
      assert.equal(back.speed, 0);
      const ahead = kartAt(t, g, 0.3, false);
      const x = ahead.x;
      assert.equal(oneWayContact(ahead, t), null);
      assert.equal(ahead.x, x);
    }
  }
});

test('着地したあとに向きを変えて逆走しても、柵の向こう（ジャンプ台・自動の区間）へは戻れない', () => {
  const t = built[4];
  for (const g of t.oneWays) {
    const kart = kartAt(t, g, 15, true);
    let behind = 0;
    let fwd = Infinity;
    for (let f = 0; f < 60 * 4; f++) {
      stepKart(kart, { throttle: 1, brake: 0, steer: 0, drift: false }, t, params, 1 / 60);
      oneWayContact(kart, t);
      fwd = (kart.x - g.x) * Math.cos(g.h) + (kart.z - g.z) * Math.sin(g.h);
      const lat = -(kart.x - g.x) * Math.sin(g.h) + (kart.z - g.z) * Math.cos(g.h);
      if (fwd < -1 && Math.abs(lat) < g.wall) behind++;
      assert.ok(!kart.auto, `自動の区間に入らない ${g.i}`);
    }
    assert.equal(behind, 0, `柵 ${g.i} のうしろへ ${behind} フレーム`);
    assert.ok(fwd < 3 && Math.abs(kart.speed) < 1, `柵 ${g.i} の手前で止まる（前 ${fwd.toFixed(1)}m、速さ ${kart.speed.toFixed(1)}）`); // 穴のふちは、もとから止まる
  }
});

import { oneWayFences } from '../src/render/trackMesh.js';
import { Box3 } from '../vendor/three.module.min.js';

test('柵は見える: 道の幅いっぱいの低い板が、柵の所の地面に立つ（高さ 1.2m まで）', () => {
  for (const t of built.filter((x) => x.oneWays.length)) {
    const fence = oneWayFences(t);
    const box = new Box3();
    for (const g of t.oneWays) {
      let near = false;
      fence.traverse((o) => {
        if (!o.isMesh) return;
        const pos = o.geometry.attributes.position;
        for (let k = 0; k < pos.count; k++) {
          const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
          if (Math.hypot(x - g.vx, z - g.vz) < g.vwall + 0.5) {
            near = true;
            assert.ok(y >= g.y - 0.01 && y <= g.y + 1.21, `${t.def.name} ${g.i}: 高さ ${y - g.y}`);
          }
        }
      });
      assert.ok(near, `${t.def.name} ${g.i}: 柵の形がある`);
    }
    box.setFromObject(fence);
    assert.ok(!box.isEmpty());
  }
});

test('柵のそばを横切るほかの道（Kenta Circuit の交わる道）の壁ぎわを走る車は、柵に引っかからない（2026-10-22 のユーザー依頼）', () => {
  let tried = 0;
  for (const t of built) {
    for (const g of t.oneWays) {
      for (let j = 0; j < t.samples.length; j++) {
        const q = t.samples[j];
        const d = Math.min(Math.abs(j - g.i), t.length - Math.abs(j - g.i));
        if (q.y === null || d < 30) continue;
        for (const side of [-1, 1]) {
          const lat0 = side * (q.wall - 1.2);
          const x = q.x - Math.sin(q.h) * lat0;
          const z = q.z + Math.cos(q.h) * lat0;
          const dx = x - g.x;
          const dz = z - g.z;
          const fwd = dx * Math.cos(g.h) + dz * Math.sin(g.h);
          const lat = -dx * Math.sin(g.h) + dz * Math.cos(g.h);
          if (fwd >= 0.8 || fwd < -4 || Math.abs(lat) > g.wall + 1 || Math.abs(q.y - g.y) > 4) continue;
          for (const turn of [-0.4, 0, 0.4]) {
            const kart = createKart(t, j, lat0);
            kart.x = x;
            kart.z = z;
            kart.y = q.y;
            kart.heading = q.h + turn;
            kart.move = kart.heading;
            kart.speed = 25;
            tried++;
            assert.equal(oneWayContact(kart, t), null, `${t.def.name}: 柵 ${g.i} のそばの道 ${j}`);
          }
        }
      }
    }
  }
  assert.ok(tried > 0, 'Kenta Circuit の交わる道を調べた');
});

import { Raycaster, Vector3 } from '../vendor/three.module.min.js';

test('柵は下まで板でふさぐ: 逆走する側から見て、道の幅のどこにも、地面すれすれから 0.8m まですき間がない（2026-10-22 のユーザー依頼「通れるような隙間が見える」）', () => {
  for (const t of built.filter((x) => x.oneWays.length)) {
    const fence = oneWayFences(t);
    fence.updateMatrixWorld(true);
    for (const g of t.oneWays) {
      const fx = Math.cos(g.vh), fz = Math.sin(g.vh);
      for (let lat = -g.vwall + 0.5; lat <= g.vwall - 0.5; lat += 0.5) {
        for (const up of [0.1, 0.3, 0.6, 0.8]) {
          const o = new Vector3(g.vx - fz * lat + fx * 3, g.y + up, g.vz + fx * lat + fz * 3);
          const ray = new Raycaster(o, new Vector3(-fx, 0, -fz), 0, 6);
          assert.ok(ray.intersectObject(fence, true).length, `${t.def.name} ${g.i}: 横 ${lat} 高さ ${up} にすき間`);
        }
      }
    }
  }
});
