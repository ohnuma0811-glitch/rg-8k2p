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
