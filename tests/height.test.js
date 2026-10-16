import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, markS, locate } from '../src/game/track.js';
import { COURSE3 } from '../src/data/tracks.js';
import { createKart, stepKart } from '../src/game/kart.js';
import { kartParams } from '../src/game/stats.js';

const t = buildTrack(COURSE3);
const params = kartParams({ accel: 3, top: 3, handling: 3 });
const STRAIGHT = { steer: 0, drift: false };

test('スタートの前後 100m は平ら。大きな丘は約8m', () => {
  for (let d = -100; d <= 100; d++) {
    const p = t.samples[((t.startIndex + d) % t.length + t.length) % t.length];
    assert.equal(p.y, 0, `${d}`);
  }
  const hill = t.samples[Math.round(markS(t, ['HILL', 'HILL', 0]))];
  assert.ok(hill.y > 7 && hill.y < 9, `${hill.y}`);
});

test('道の高さはなめらか（1m で 0.25m より急に変わらない。地面のない所の前後はのぞく）', () => {
  for (const p of t.samples) {
    const q = t.samples[p.next];
    if (p.y === null || q.y === null || p.ramp || q.ramp) continue;
    assert.ok(Math.abs(q.y - p.y) < 0.25, `点 ${p.s.toFixed(0)}（道 ${p.path}）: ${p.y.toFixed(2)} → ${q.y.toFixed(2)}`);
  }
});

test('分かれる所・合流する所で、道の高さがつながる（段差がない）', () => {
  for (const path of t.paths.slice(1)) {
    const first = t.samples[path.start];
    const last = t.samples[path.start + path.count - 1];
    assert.ok(Math.abs(first.y - t.samples[path.fork].y) < 0.25, `${path.id} の分かれる所`);
    assert.ok(Math.abs(last.y - t.samples[path.join].y) < 0.25, `${path.id} の合流する所`);
  }
});

test('外の道と真ん中の道はでこぼこ（1〜2m の上り下りが続く）', () => {
  for (const id of [0, 1]) {
    const ys = t.samples.filter((p) => p.path === id && p.bumpy).map((p) => p.y);
    assert.ok(ys.length > 100, `${id}`);
    assert.ok(Math.max(...ys) - Math.min(...ys) > 1.5, `${id}`);
  }
});

test('坂の頂上を速く越えると少し浮いて、着地して走り続ける。ゆっくりなら浮かない', () => {
  const hill = Math.round(markS(t, ['HILL', 'HILL', 0]));
  for (const [speed, flies] of [[40, true], [8, false]]) {
    const kart = createKart(t, hill - 60, 0);
    kart.speed = speed;
    let flew = false;
    for (let k = 0; k < 60 * 4; k++) {
      // ゆっくりのほうは、速さ 10 を超えたらブレーキ（自動のアクセルで速くなるので）
      stepKart(kart, speed < 20 && kart.speed > 10 ? { ...STRAIGHT, brake: true } : STRAIGHT, t, params, 1 / 60);
      if (kart.airborne) flew = true;
      if (!kart.airborne) {
        const loc = locate(t, kart.x, kart.z, kart.seg);
        assert.ok(Math.abs(kart.y - loc.ground) < 0.05, '地面からずれている');
      }
    }
    assert.equal(flew, flies, `${speed}`);
    assert.ok(!kart.airborne && kart.speed > 4, '着地して走り続ける');
  }
});

test('どの坂も、止まらずに上れる（自動のアクセルで、ハンドルを切らずに1周）', () => {
  const kart = createKart(t, t.startIndex, 0);
  let minSpeed = Infinity;
  for (let k = 0; k < 60 * 90; k++) {
    stepKart(kart, STRAIGHT, t, params, 1 / 60);
    if (k > 60 * 5) minSpeed = Math.min(minSpeed, kart.speed);
  }
  assert.ok(minSpeed > 8, `${minSpeed}`);
});

// 上の道（本線）と内の道が交わる所（橋）: 内の道の点で、本線の点にいちばん近い所
function crossing() {
  const inner = t.paths[2];
  let best = { d: Infinity };
  // 出口の合流（本線の横に並ぶ所）は、交わる所ではないので見ない
  for (let i = inner.start; i < inner.start + inner.count - 130; i++) {
    const q = t.samples[i];
    for (let j = 0; j < t.length; j++) {
      const p = t.samples[j];
      const d = Math.hypot(p.x - q.x, p.z - q.z);
      if (d < best.d) best = { d, top: j, under: i };
    }
  }
  return best;
}

test('橋: 上の道は内の道より 6m 以上高く、橋の点（p.bridge）になっている。内の道は橋の下で平ら', () => {
  const c = crossing();
  const top = t.samples[c.top];
  const under = t.samples[c.under];
  assert.ok(top.y - under.y > 6, `${top.y} ${under.y}`);
  assert.ok(top.bridge, '橋の点ではない');
  assert.ok(Math.abs(under.y) < 0.3, `${under.y}`);
});

test('橋の上を走る車は上の道、橋の下を走る車は下の道（内の道）にいると分かる', () => {
  const c = crossing();
  const top = t.samples[c.top];
  const under = t.samples[c.under];
  const onTop = locate(t, top.x, top.z, c.top, 40, top.y);
  assert.equal(t.samples[onTop.i].path, 0);
  const below = locate(t, under.x, under.z, c.under, 40, under.y);
  assert.equal(t.samples[below.i].path, 2);
});

test('橋の上と下を、車が続けて走っても、もう一方の道にワープしない', () => {
  const c = crossing();
  for (const [start, path] of [[c.top - 80, 0], [c.under - 80, 2]]) {
    const kart = createKart(t, start, 0);
    kart.speed = 30;
    let last = { x: kart.x, z: kart.z };
    for (let k = 0; k < 60 * 5; k++) {
      stepKart(kart, STRAIGHT, t, params, 1 / 60);
      assert.ok(Math.hypot(kart.x - last.x, kart.z - last.z) < 2, 'ワープした');
      if (k === 60 * 3) assert.equal(t.samples[kart.seg].path === 0 || path === 2, true);
      last = { x: kart.x, z: kart.z };
    }
    // 下の道を走った車は、橋の下を通って、内の道のまま（上の道に飛び乗らない）
    if (path === 2) assert.ok(kart.y < 3, `橋の下の車が高い: ${kart.y}`);
  }
});
