import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, locate } from '../src/game/track.js';
import { COURSE1 } from '../src/data/tracks.js';
import { createKart, stepKart, driftLevel, PHYS } from '../src/game/kart.js';
import { kartParams } from '../src/game/stats.js';

// 動きを確かめるための、長い直線がある楕円のコース（ジャンプなし）
const OVAL = buildTrack({
  points: [[0, 0], [200, 0], [400, 0], [600, 0], [800, 0], [1000, 100], [800, 200], [600, 200], [400, 200], [200, 200], [0, 200], [-200, 100]],
  length: 2400,
  roadHalf: 9,
  dirt: 4,
});
const course = buildTrack(COURSE1);
const params = kartParams({ accel: 3, top: 3, handling: 3 });
const DT = 1 / 60;
const J = COURSE1.jump;
const CROSS_S = course.cross.sA;
const indexAt = (track, s) => ((Math.ceil(s) % track.length) + track.length) % track.length; // s より先で一番近い点
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function run(track, kart, ctl, seconds, each) {
  for (let t = 0; t < seconds; t += DT) {
    const c = typeof ctl === 'function' ? ctl(kart) : ctl;
    stepKart(kart, c, track, params, DT);
    if (each) each(kart);
  }
}

// 道の真ん中を走る自動運転（テスト用）。少し先のカーブを見て曲がり、きついカーブの前ではブレーキ
function autopilot(track) {
  return (kart) => {
    const loc = locate(track, kart.x, kart.z, kart.seg);
    const err = wrap(kart.heading - loc.heading);
    const n = track.samples.length;
    const turn = wrap(track.samples[(loc.i + 12) % n].h - loc.heading);
    const bend = Math.abs(wrap(track.samples[(loc.i + 30) % n].h - loc.heading));
    return {
      steer: Math.max(-1, Math.min(1, -loc.lateral * 0.15 - err * 2 + turn * 3)),
      brake: bend > 0.9 && kart.speed > 22,
      drift: false,
    };
  };
}

const NONE = { steer: 0, brake: false, drift: false };
const START = OVAL.samples.findIndex((p) => p.h === 0); // 楕円のコースの、長い直線の始まり

test('アクセルは自動。直線で最高速まで上がり、それ以上は出ない', () => {
  const kart = createKart(OVAL, START);
  run(OVAL, kart, NONE, 2);
  assert.ok(kart.speed > 10 && kart.speed < params.topSpeed);
  run(OVAL, kart, NONE, 3);
  assert.equal(kart.speed, params.topSpeed);
});

test('ダートでは最高速が下がる', () => {
  const kart = createKart(OVAL, START, -11);
  run(OVAL, kart, NONE, 5);
  assert.equal(kart.surface, 'dirt');
  assert.ok(Math.abs(kart.speed - params.topSpeed * PHYS.DIRT_FACTOR) < 0.01, `${kart.speed}`);
});

test('ブレーキを押し続けると止まって、ゆっくりバックする', () => {
  const kart = createKart(OVAL, START);
  run(OVAL, kart, NONE, 3);
  run(OVAL, kart, { ...NONE, brake: true }, 3);
  assert.equal(kart.speed, -PHYS.REVERSE_MAX);
});

test('止まりかけではハンドルを切ってもほとんど曲がらない', () => {
  const slow = createKart(OVAL, START);
  const h0 = slow.heading;
  stepKart(slow, { ...NONE, steer: 1 }, OVAL, params, DT);
  const fast = createKart(OVAL, START);
  run(OVAL, fast, NONE, 3);
  const h1 = fast.heading;
  stepKart(fast, { ...NONE, steer: 1 }, OVAL, params, DT);
  assert.ok(slow.heading - h0 < (fast.heading - h1) / 10);
});

test('右にハンドルを切ると右（向きの角度が増える方）に曲がる', () => {
  const kart = createKart(OVAL, START);
  run(OVAL, kart, NONE, 2);
  const h = kart.heading;
  run(OVAL, kart, { ...NONE, steer: 1 }, 0.2);
  assert.ok(kart.heading > h);
});

// 曲がり方を測るための、柵がとても遠い（道幅600m）楕円のコース（ドリフトのテストもここで走る）
const WIDE = buildTrack({
  points: [[0, 0], [200, 0], [400, 0], [600, 0], [800, 0], [1000, 100], [800, 200], [600, 200], [400, 200], [200, 200], [0, 200], [-200, 100]],
  length: 2400,
  roadHalf: 300,
  dirt: 4,
});
const WIDE_START = WIDE.samples.findIndex((p) => p.h === 0);

// マリオカート64 のドリフト: ボタンで小さく跳ね、着地のときハンドルを切っている向きに滑り出す。
// 滑っている間に反対へ切ってすぐ戻すたびに、煙が 白(0) → 黄(1) → 赤(2)。赤で離すとミニターボ
const D = (steer) => ({ steer, brake: false, drift: true });
// 右ドリフト中に、左へ切ってすぐ戻す
function flick(kart) {
  run(WIDE, kart, D(-1), 0.12);
  run(WIDE, kart, D(1), 0.25);
}
function startRightDrift() {
  const kart = createKart(WIDE, WIDE_START);
  run(WIDE, kart, NONE, 3);
  run(WIDE, kart, D(1), PHYS.HOP_TIME + 0.05);
  return kart;
}

test('ドリフト: ボタンを押すと小さく跳ね、着地のときハンドルを切っている向きに滑り出す', () => {
  const kart = createKart(WIDE, WIDE_START);
  run(WIDE, kart, NONE, 3);
  stepKart(kart, D(1), WIDE, params, DT);
  assert.ok(kart.hop > 0, '跳ねている');
  assert.ok(!kart.drift.active, 'まだ滑っていない');
  run(WIDE, kart, D(1), PHYS.HOP_TIME);
  assert.ok(kart.drift.active);
  assert.equal(kart.drift.dir, 1);
  assert.equal(driftLevel(kart), 0);
});

test('ハンドルを切らずにドリフトを押すと、跳ねるだけでドリフトにならない', () => {
  const kart = createKart(WIDE, WIDE_START);
  run(WIDE, kart, NONE, 3);
  run(WIDE, kart, { steer: 0, brake: false, drift: true }, 1);
  assert.ok(!kart.drift.active);
});

test('ドリフト中に反対へ切って戻すたびに、煙が白 → 黄 → 赤。赤で離すと加速する', () => {
  const kart = startRightDrift();
  assert.equal(driftLevel(kart), 0);
  flick(kart);
  assert.equal(driftLevel(kart), 1);
  flick(kart);
  assert.equal(driftLevel(kart), 2);
  flick(kart);
  assert.equal(driftLevel(kart), 2, '赤より先はない');
  stepKart(kart, NONE, WIDE, params, DT);
  assert.ok(!kart.drift.active);
  assert.ok(kart.boost > PHYS.MT_BOOST - 0.05);
  assert.ok(kart.speed > params.topSpeed);
});

test('切り返さずに長くドリフトしても、煙は白のままで、離しても加速しない', () => {
  const kart = startRightDrift();
  run(WIDE, kart, D(0.3), 2);
  assert.equal(driftLevel(kart), 0);
  stepKart(kart, NONE, WIDE, params, DT);
  assert.equal(kart.boost, 0);
});

test('黄色で離しても加速しない（赤まで待つ）', () => {
  const kart = startRightDrift();
  flick(kart);
  assert.equal(driftLevel(kart), 1);
  stepKart(kart, NONE, WIDE, params, DT);
  assert.equal(kart.boost, 0);
});

test('ドリフト中は、車の向きより外側へ滑りながら進む', () => {
  const kart = startRightDrift();
  run(WIDE, kart, D(1), 0.5);
  const slip = Math.atan2(Math.sin(kart.move - kart.heading), Math.cos(kart.move - kart.heading));
  // 右へ曲がっているので、進む向きは車の向きより左（外側）
  assert.ok(slip < -0.08, `${slip}`);
});

// マリオカート64 くらいの曲がり方（Gemini に動画を見てもらった目安。2026-10-14）
// warm 秒まっすぐ走って速さを上げてから、ctl で90度曲がるまでの時間
function timeTo90(ctl, warm, before = []) {
  const kart = createKart(WIDE, WIDE_START);
  for (let t = 0; t < warm; t += DT) stepKart(kart, NONE, WIDE, params, DT);
  for (const [c, sec] of before) for (let t = 0; t < sec; t += DT) stepKart(kart, c, WIDE, params, DT);
  let turned = 0;
  let t = 0;
  while (Math.abs(turned) < Math.PI / 2 && t < 3) {
    const h = kart.heading;
    stepKart(kart, ctl, WIDE, params, DT);
    turned += Math.atan2(Math.sin(kart.heading - h), Math.cos(kart.heading - h));
    t += DT;
  }
  return { t, kart };
}

test('ふつうに曲がる: 最高速でいっぱいに切ると、90度を0.9〜1.3秒で曲がる', () => {
  const { t } = timeTo90({ ...NONE, steer: 1 }, 4);
  assert.ok(t >= 0.9 && t <= 1.3, `${t.toFixed(2)}秒`);
});

test('ドリフトで曲がる: 最高速でいっぱいに切ると、ふつうより少しきつく、90度を0.75〜1.1秒で曲がる', () => {
  const { t, kart } = timeTo90(D(1), 4, [[D(1), PHYS.HOP_TIME + 0.02]]);
  assert.ok(kart.drift.active);
  assert.ok(t >= 0.75 && t <= 1.1, `${t.toFixed(2)}秒`);
  assert.ok(t < timeTo90({ ...NONE, steer: 1 }, 4).t);
});

test('ドリフトでいっぱいに切っても、最高速では半径20m以上（道幅24mの中で円を描けない）', () => {
  const kart = createKart(WIDE, WIDE_START);
  run(WIDE, kart, NONE, 4);
  run(WIDE, kart, D(1), PHYS.HOP_TIME + 0.02);
  const h = kart.heading;
  stepKart(kart, D(1), WIDE, params, DT);
  const rate = Math.abs(kart.heading - h) / DT;
  const radius = kart.speed / rate;
  assert.ok(radius >= 20, `半径 ${radius.toFixed(1)}m`);
});

test('ドリフト中、車の向きは進む向きから30〜45度くらい内側を向く', () => {
  const kart = startRightDrift();
  run(WIDE, kart, D(0.5), 0.6);
  const slip = Math.abs(Math.atan2(Math.sin(kart.move - kart.heading), Math.cos(kart.move - kart.heading))) * 180 / Math.PI;
  assert.ok(slip >= 25 && slip <= 50, `${slip.toFixed(0)}度`);
});

test('速いときほど、ハンドルでの曲がり方がゆるい', () => {
  const turned = (warm) => {
    const kart = createKart(OVAL, START);
    run(OVAL, kart, NONE, warm);
    const v = kart.speed;
    const h = kart.heading;
    stepKart(kart, { ...NONE, steer: 1 }, OVAL, params, DT);
    return { rate: (kart.heading - h) / DT, v };
  };
  const slow = turned(1);
  const fast = turned(4);
  assert.ok(slow.v < fast.v);
  assert.ok(fast.rate < slow.rate * 0.9, `${slow.rate} / ${fast.rate}`);
});

test('柵より外には出ず、ぶつかるとスピードが落ちる', () => {
  const kart = createKart(OVAL, START);
  run(OVAL, kart, NONE, 3);
  let minSpeed = Infinity;
  run(OVAL, kart, { ...NONE, steer: 1 }, 3, (k) => {
    const loc = locate(OVAL, k.x, k.z, k.seg);
    assert.ok(Math.abs(loc.lateral) <= loc.wall + 1e-6);
    minSpeed = Math.min(minSpeed, k.speed);
  });
  assert.ok(minSpeed < params.topSpeed * 0.7);
});

test('ゆっくり近づいても、ジャンプ台から飛んで交わる所を越え、向こう側に着地する', () => {
  // 加速板のあと、ジャンプ台を時速10kmくらいでのぼる
  const kart = createKart(course, indexAt(course, CROSS_S + J.ramp.from + 3));
  let flew = false;
  let minYOverCrossing = Infinity;
  const ap = autopilot(course);
  run(course, kart, (k) => ({ ...ap(k), brake: k.speed > 3 }), 12, (k) => {
    if (k.airborne) flew = true;
    const s = course.samples[k.seg].s;
    if (Math.abs(s - CROSS_S) < 14) minYOverCrossing = Math.min(minYOverCrossing, k.y);
    assert.equal(k.respawn, 0);
  });
  assert.ok(flew);
  assert.ok(minYOverCrossing > 3, `${minYOverCrossing}`);
  assert.ok(!kart.airborne);
  assert.ok(course.samples[kart.seg].s > CROSS_S + J.gap.to);
});

test('加速中でも、ジャンプ台から飛び出す速さは同じで、着地は地面がない所のすぐ先', () => {
  const kart = createKart(course, indexAt(course, CROSS_S + J.boost.from - 5));
  let landS = null;
  let was = false;
  run(course, kart, autopilot(course), 5, (k) => {
    if (was && !k.airborne && landS === null) landS = course.samples[k.seg].s;
    was = k.airborne;
  });
  assert.ok(landS > CROSS_S + J.gap.to && landS < CROSS_S + J.gap.to + 25, `${landS}`);
});

test('地面がない所にバックで入ると落ちて、2秒後に加速板の手前に戻る', () => {
  const kart = createKart(course, indexAt(course, CROSS_S + J.gap.to + 3));
  let fell = false;
  run(course, kart, { ...NONE, brake: true }, 6, (k) => {
    if (k.respawn > 0) fell = true;
  });
  assert.ok(fell);
  assert.ok(kart.respawn <= 0);
  const d = (((course.samples[kart.seg].s - CROSS_S) % course.length) + course.length) % course.length - course.length;
  assert.ok(d < J.boost.from, `${d}`);
});

test('自動運転で2周しても、コースから落ちない。万能タイプの1周は30〜50秒', () => {
  const kart = createKart(course, course.startIndex);
  const ap = autopilot(course);
  let dist = 0;
  let time = 0;
  let prevS = course.samples[kart.seg].s;
  while (dist < course.length * 2) {
    stepKart(kart, ap(kart), course, params, DT);
    time += DT;
    assert.equal(kart.respawn, 0);
    const s = course.samples[kart.seg].s;
    let d = s - prevS;
    if (d < -course.length / 2) d += course.length;
    dist += d;
    prevS = s;
    assert.ok(time < 200, '2周が終わらない');
  }
  const lap = time / 2;
  assert.ok(lap > 30 && lap < 50, `1周 ${lap.toFixed(1)}秒`);
});

test('柵に向かってハンドルを切り続けても、止まらずに柵ぞいに走れる（スピードは半分より上）', () => {
  const kart = createKart(OVAL, START);
  run(OVAL, kart, NONE, 3);
  run(OVAL, kart, { ...NONE, steer: 1 }, 4);
  assert.ok(kart.speed > params.topSpeed * 0.5, `${kart.speed}`);
});

test('空中でハンドルを切り続けても、地面がない所に落ちず向こう側に着地する', () => {
  for (const handling of [1, 3, 5]) {
    for (const steer of [-1, 1]) {
      const p = kartParams({ accel: 3, top: 3, handling });
      const kart = createKart(course, indexAt(course, CROSS_S + J.boost.from - 5));
      const ap = autopilot(course);
      let landed = false;
      let wasAir = false;
      for (let t = 0; t < 6 && !landed; t += DT) {
        const c = kart.airborne ? { steer, brake: false, drift: false } : ap(kart);
        stepKart(kart, c, course, p, DT);
        assert.equal(kart.respawn, 0, `ハンドル${handling} steer${steer} で落ちた`);
        if (wasAir && !kart.airborne) landed = true;
        wasAir = kart.airborne;
      }
      assert.ok(landed, `ハンドル${handling} steer${steer}`);
      assert.ok(course.samples[kart.seg].s > CROSS_S + J.gap.to);
    }
  }
});
