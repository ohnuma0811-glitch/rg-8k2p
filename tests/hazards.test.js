import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSE2 } from '../src/data/tracks.js';
import { BUMP_LIMIT_KMH, TUMBLE_TIME, meterKmh, crossed } from '../src/game/hazards.js';
import { createKart, stepKart } from '../src/game/kart.js';
import { pushApart } from '../src/game/collide.js';
import { kartParams } from '../src/game/stats.js';

const t = buildTrack(COURSE2);
const params = kartParams({ accel: 3, top: 3, handling: 3 });
const go = { steer: 0, brake: false, drift: false };

test('「時速100km」はスピードメーターの数字（実際の速さの1.5倍）で決める（2026-10-15 のユーザーの判断）', () => {
  assert.equal(BUMP_LIMIT_KMH, 100);
  assert.ok(Math.abs(meterKmh(100 / 3.6 / 1.5) - 100) < 1e-9);
});

test('バンプを越えたか: 前へ越えたときだけ。逆向き・1周の切れ目・1フレームで大きく進んでも正しく', () => {
  assert.equal(crossed(t, 99, 101, 100), true);
  assert.equal(crossed(t, 101, 99, 100), false); // 逆向き（バック・逆走）
  assert.equal(crossed(t, 2499, 1, 0.5), true); // 1周の切れ目をまたぐ
  assert.equal(crossed(t, 95, 99, 100), false);
  assert.equal(crossed(t, 100, 100.4, 100), false); // ちょうど上にいるだけでは、もう一度は数えない
});

test('バンプは3つ: A〜B・B〜C・D〜E に1つずつ（2026-10-15 のユーザー依頼）', () => {
  assert.equal(t.bumps.length, 3);
  const [ab, bc, de] = t.bumps;
  assert.ok(ab > t.marks.A && ab < t.marks.B);
  assert.ok(bc > t.marks.B && bc < t.marks.C);
  assert.ok(de > t.marks.D && de < t.marks.E);
});

// バンプの少し手前（back m）に、speed で走っている車（遅いと速さが上がりやすいので、近くから）
function before(at, speed, back = 3) {
  const i = (Math.round(at) - back + t.length) % t.length;
  const kart = createKart(t, i, 5);
  kart.speed = speed;
  return kart;
}

test('メーター100を超えてバンプに乗ると、3秒転がって走れない。そのあと止まった状態から走り出す', () => {
  const kart = before(t.bumps[0], 30); // 30m/s = メーター162
  for (let k = 0; k < 20; k++) stepKart(kart, go, t, params, 1 / 60);
  assert.ok(kart.tumble > 0);
  const turned = kart.heading;
  for (let k = 0; k < 60; k++) stepKart(kart, { steer: 1, brake: false, drift: true }, t, params, 1 / 60);
  assert.equal(kart.drift.active, false); // ドリフトもハンドルも効かない
  let time = 0;
  while (kart.tumble > 0 && time < TUMBLE_TIME + 1) {
    stepKart(kart, go, t, params, 1 / 60);
    time += 1 / 60;
  }
  assert.equal(kart.tumble, 0);
  assert.ok(kart.speed < 3, `${kart.speed}`);
  const dh = kart.heading - turned;
  assert.ok(Math.abs(Math.atan2(Math.sin(dh), Math.cos(dh))) < 0.2); // 向きはコースのまま
  for (let k = 0; k < 60; k++) stepKart(kart, go, t, params, 1 / 60);
  assert.ok(kart.speed > 5, '走り出せない');
});

test('メーター100以下で乗ると、乗り越えるだけ（速さはそのまま）', () => {
  const kart = before(t.bumps[0], 16, 2); // 16m/s = メーター86（越えるまでに少し速くなっても100より下）
  let humped = false;
  for (let k = 0; k < 30; k++) {
    stepKart(kart, go, t, params, 1 / 60);
    humped ||= kart.hump > 0;
  }
  assert.equal(kart.tumble, 0);
  assert.ok(humped);
  assert.ok(kart.speed > 15);
});

test('転がっている車は、ほかの車と押し合わない', () => {
  const a = createKart(t, 10, 0);
  const b = createKart(t, 10, 0.5);
  a.tumble = 2;
  const ax = a.x;
  pushApart([a, b]);
  assert.equal(a.x, ax);
});
