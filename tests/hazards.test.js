import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, locate } from '../src/game/track.js';
import { COURSE2 } from '../src/data/tracks.js';
import { BUMP_LIMIT_KMH, TUMBLE_TIME, meterKmh, crossed, cowPose, cowContact, COW_RADIUS } from '../src/game/hazards.js';
import { createKart, stepKart, PHYS } from '../src/game/kart.js';
import { pushApart } from '../src/game/collide.js';
import { kartParams } from '../src/game/stats.js';

const t = buildTrack(COURSE2);
const params = kartParams({ accel: 3, top: 3, handling: 3 });
const go = { steer: 0, brake: false, drift: false };

test('バンプで転がる速さはスピードメーターの数字の150（実際の速さの1.5倍を出している。2026-10-15 に100から変更）', () => {
  assert.equal(BUMP_LIMIT_KMH, 150);
  assert.ok(Math.abs(meterKmh(150 / 3.6 / 1.5) - 150) < 1e-9);
  assert.equal(TUMBLE_TIME, 1); // 転がって走れないのは1秒（2026-10-15 のユーザー依頼で3秒から短く）
});

test('バンプを越えたか: 前へ越えたときだけ。逆向き・1周の切れ目・1フレームで大きく進んでも正しく', () => {
  assert.equal(crossed(t, 99, 101, 100), true);
  assert.equal(crossed(t, 101, 99, 100), false); // 逆向き（バック・逆走）
  assert.equal(crossed(t, 2499, 1, 0.5), true); // 1周の切れ目をまたぐ
  assert.equal(crossed(t, 95, 99, 100), false);
  assert.equal(crossed(t, 100, 100.4, 100), false); // ちょうど上にいるだけでは、もう一度は数えない
});

test('バンプは2つ: A〜B と D〜E に1つずつ（2026-10-15 のユーザー依頼で3つから減らした）', () => {
  assert.equal(t.bumps.length, 2);
  const [ab, de] = t.bumps;
  assert.ok(ab > t.marks.A && ab < t.marks.B);
  assert.ok(de > t.marks.D && de < t.marks.E);
});

// バンプの少し手前（back m）に、speed で走っている車（遅いと速さが上がりやすいので、近くから）
function before(at, speed, back = 3) {
  const i = (Math.round(at) - back + t.length) % t.length;
  const kart = createKart(t, i, 5);
  kart.speed = speed;
  return kart;
}

test('メーター150を超えてバンプに乗ると、1秒転がって走れない。そのあと止まった状態から走り出す', () => {
  const kart = before(t.bumps[0], 30); // 30m/s = メーター162
  for (let k = 0; k < 20; k++) stepKart(kart, go, t, params, 1 / 60);
  assert.ok(kart.tumble > 0);
  const turned = kart.heading;
  for (let k = 0; k < 30; k++) stepKart(kart, { steer: 1, brake: false, drift: true }, t, params, 1 / 60);
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

test('メーター150以下で乗ると、乗り越えるだけ（速さはそのまま）', () => {
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

test('牛は I〜J の J の近くに4頭。時刻で場所が決まり、道の中をゆっくり左右に動く', () => {
  assert.equal(t.cows.length, 4);
  for (const cow of t.cows) {
    assert.ok(cow.s > t.marks.I && cow.s < t.marks.J);
    const a = cowPose(t, cow, 10);
    assert.deepEqual(cowPose(t, cow, 10), a); // 同じ時刻なら同じ場所（対戦でそろえられる）
    let maxStep = 0;
    for (let time = 0; time < 60; time += 0.5) {
      const p = cowPose(t, cow, time);
      const q = cowPose(t, cow, time + 0.5);
      assert.ok(Math.abs(p.lateral) <= t.roadHalf - 1.5, `${p.lateral}`);
      maxStep = Math.max(maxStep, Math.abs(q.lateral - p.lateral));
    }
    assert.ok(maxStep < 2, `速すぎる: ${maxStep}`); // 0.5秒で2m より遅い
  }
});

function atCow(cow, time, speed) {
  const p = cowPose(t, cow, time);
  const i = Math.round(cow.s) - 1;
  const kart = createKart(t, (i + t.length) % t.length, p.lateral);
  kart.x = p.x - Math.cos(kart.heading) * (COW_RADIUS + 0.5);
  kart.z = p.z - Math.sin(kart.heading) * (COW_RADIUS + 0.5);
  kart.speed = speed;
  return kart;
}

test('メーター150以上で牛にぶつかるとスピン（2026-10-15 のユーザー依頼）', () => {
  const kart = atCow(t.cows[0], 5, 30); // メーター162
  assert.equal(cowContact(kart, t, 5, PHYS), 'spin');
  assert.ok(kart.spin > 0);
});

test('メーター150より遅いと、壁と同じで跳ね返る（スピンしない）。こすっている間はもう一度は数えない', () => {
  const kart = atCow(t.cows[0], 5, 15); // メーター81
  assert.equal(cowContact(kart, t, 5, PHYS), 'bounce');
  assert.equal(kart.spin, 0);
  assert.ok(kart.speed < 15);
  const p = cowPose(t, t.cows[0], 5);
  assert.ok(Math.hypot(kart.x - p.x, kart.z - p.z) >= COW_RADIUS + 1.1 - 1e-6); // 牛の外へ押し出す
  assert.equal(cowContact(kart, t, 5, PHYS), null);
});

test('牛にぶつかったあとも、車は道の中にいる（柵の外に押し出されない）', () => {
  for (const cow of t.cows) {
    for (let time = 0; time < 30; time += 1.7) {
      const p = cowPose(t, cow, time);
      const kart = atCow(cow, time, 15);
      kart.x = p.x - Math.sin(p.heading) * 0.5;
      kart.z = p.z + Math.cos(p.heading) * 0.5;
      cowContact(kart, t, time, PHYS);
      stepKart(kart, go, t, params, 1 / 60);
      const loc = locate(t, kart.x, kart.z, kart.seg);
      assert.ok(Math.abs(loc.lateral) <= loc.wall + 1e-6);
    }
  }
});

test('CPU がバンプで減速を忘れるのは2割くらい。どの CPU も、ときどき忘れる。レースごとにちがう', async () => {
  const { bumpMiss } = await import('../src/game/cpu.js');
  const { createCpu } = await import('../src/game/cpu.js');
  let miss = 0;
  let all = 0;
  const perCpu = [0, 0, 0, 0];
  for (let seed = 0; seed < 50; seed++) {
    for (let id = 0; id < 4; id++) {
      const cpu = createCpu(id, seed);
      for (let b = 0; b < 3; b++) {
        for (let lap = 0; lap < 3; lap++) {
          all++;
          if (bumpMiss(cpu, b, lap)) {
            miss++;
            perCpu[id]++;
          }
        }
      }
    }
  }
  assert.ok(miss / all > 0.12 && miss / all < 0.28, `${miss}/${all}`);
  for (const n of perCpu) assert.ok(n > 0, `${perCpu}`);
  // 同じ CPU でも、レース（seed）がちがえば、忘れる所がちがう
  const pattern = (seed) => [0, 1, 2].map((b) => bumpMiss(createCpu(0, seed), b, 0)).join();
  assert.ok(new Set([0, 1, 2, 3, 4, 5, 6, 7].map(pattern)).size > 1);
});

test('バンプで転がって滑っても、柵の外に出ない（その場で転がる）', () => {
  for (const angle of [0.4, 0.6, -0.6]) {
    const kart = before(t.bumps[0], 38, 3);
    kart.x = kart.x - Math.sin(kart.heading) * 7;
    kart.z = kart.z + Math.cos(kart.heading) * 7;
    kart.heading += angle;
    kart.move = kart.heading;
    for (let k = 0; k < 60 * 4; k++) {
      stepKart(kart, go, t, params, 1 / 60);
      const loc = locate(t, kart.x, kart.z, kart.seg);
      assert.ok(Math.abs(loc.lateral) <= loc.wall + 1e-6, `${angle}: ${Math.abs(loc.lateral).toFixed(1)} > ${loc.wall}`);
    }
  }
});

test('バンプの警告: 今の速さで3秒以内にバンプに着くときだけ出す。越えたら消える（2026-10-15 のユーザー依頼）', async () => {
  const { bumpWarning, BUMP_WARN_SEC } = await import('../src/game/hazards.js');
  assert.equal(BUMP_WARN_SEC, 3);
  const b = t.bumps[0];
  const at = (dist, speed) => {
    const i = (Math.round(b - dist) + t.length) % t.length;
    const kart = createKart(t, i, 3);
    kart.speed = speed;
    return kart;
  };
  assert.equal(bumpWarning(t, at(80, 40)), true); // 2秒で着く
  assert.equal(bumpWarning(t, at(150, 40)), false); // 3.75秒かかる
  assert.equal(bumpWarning(t, at(20, 5)), false); // 4秒かかる（ゆっくり）
  assert.equal(bumpWarning(t, at(-3, 40)), false); // 越えたあと
  assert.equal(bumpWarning(t, { ...at(50, 40), tumble: 2 }), false); // 転がっている間は出さない
});
