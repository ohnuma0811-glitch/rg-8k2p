import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, locate, span } from '../src/game/track.js';
import { COURSE1 } from '../src/data/tracks.js';
import { createKart, stepKart, driftLevel, startDash, PHYS, DASH_BASE, DASH_PER_ACCEL, useMushroom, startBlast, STAR, BLAST, MUSHROOM } from '../src/game/kart.js';
import { kartParams } from '../src/game/stats.js';

// 動きを確かめるための、長い直線がある楕円のコース（ジャンプなし）
const OVAL_DEF = {
  points: [[0, 0], [200, 0], [400, 0], [600, 0], [800, 0], [1000, 100], [800, 200], [600, 200], [400, 200], [200, 200], [0, 200], [-200, 100]],
  length: 2400,
  roadHalf: 9,
  dirt: 4,
};
const OVAL = buildTrack(OVAL_DEF);
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

test('アクセルは自動。直線で最高速の近くまで上がり、最高速を少し（でこぼこの分）しか超えない', () => {
  const kart = createKart(OVAL, START);
  run(OVAL, kart, NONE, 2);
  assert.ok(kart.speed > 10 && kart.speed < params.topSpeed);
  let max = 0;
  run(OVAL, kart, NONE, 4, (k) => { max = Math.max(max, k.speed); });
  assert.ok(kart.speed > params.topSpeed * 0.96, `${kart.speed}`);
  assert.ok(max <= params.topSpeed * (1 + PHYS.BUMP_ROAD) + 1e-9, `${max}`);
});

test('ダートでは最高速が下がる', () => {
  const kart = createKart(OVAL, START, -11);
  run(OVAL, kart, NONE, 5);
  assert.equal(kart.surface, 'dirt');
  const want = params.topSpeed * PHYS.DIRT_FACTOR;
  assert.ok(Math.abs(kart.speed - want) < want * 0.08, `${kart.speed}`);
});

// スピード計の数字が細かく動くように、速さは一定にならない（2026-10-14 の実機確認）
function cruise(track, lateral, ctl, seconds) {
  const kart = createKart(track, track === OVAL ? START : WIDE_START, lateral);
  run(track, kart, NONE, 5);
  const speeds = [];
  run(track, kart, ctl, seconds, (k) => speeds.push(k.speed));
  return speeds;
}
const spread = (xs) => Math.max(...xs) - Math.min(...xs);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

test('まっすぐ走っていても、路面のでこぼこでスピードが少しずつ上下する（一定ではない）', () => {
  const xs = cruise(OVAL, 0, NONE, 3);
  assert.ok(spread(xs) > 0.2, `上下の幅 ${spread(xs).toFixed(2)} m/s`);
  assert.ok(spread(xs) < 2, `上下の幅 ${spread(xs).toFixed(2)} m/s`);
});

test('ダートでは、道よりも大きくスピードが上下する', () => {
  assert.ok(spread(cruise(OVAL, -11, NONE, 3)) > spread(cruise(OVAL, 0, NONE, 3)));
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

test('切り返さなくても、ドリフトを続けると煙が0.7秒で黄、1.4秒で赤になり、離すと加速する（大きなカーブで赤まで届く）', () => {
  const kart = startRightDrift();
  run(WIDE, kart, D(0.3), 0.6);
  assert.equal(driftLevel(kart), 0);
  run(WIDE, kart, D(0.3), 0.2);
  assert.equal(driftLevel(kart), 1);
  run(WIDE, kart, D(0.3), 0.7);
  assert.equal(driftLevel(kart), 2);
  stepKart(kart, NONE, WIDE, params, DT);
  assert.ok(kart.boost > PHYS.MT_BOOST - 0.05);
});

test('赤で離したミニターボは、加速板より弱い（最高速 MT_FACTOR 倍）。ミニターボ中に加速板に乗ると、さらに速くなる（2026-10-16 のユーザー依頼）', () => {
  assert.ok(PHYS.MT_FACTOR < PHYS.BOOST_FACTOR);
  const kart = startRightDrift();
  run(WIDE, kart, D(0.3), 1.5);
  assert.equal(driftLevel(kart), 2);
  stepKart(kart, NONE, WIDE, params, DT);
  assert.equal(kart.boostFactor, PHYS.MT_FACTOR);
  assert.ok(kart.speed <= params.topSpeed * PHYS.MT_FACTOR + 1e-6, `ミニターボが速すぎる: ${kart.speed}`);
  const before = kart.speed;
  // 加速板（強い加速）に乗る
  startDash(kart, params, 3);
  assert.equal(kart.boostFactor, PHYS.BOOST_FACTOR);
  assert.ok(kart.speed > before + 1, '加速板で速くならない');
});

test('反対のボタンを押して離すだけでも、切り返し1回と数える（同じ向きに押し直さなくてよい）', () => {
  const kart = startRightDrift();
  run(WIDE, kart, D(-1), 0.1);
  run(WIDE, kart, D(0), 0.05);
  assert.equal(driftLevel(kart), 1);
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

// マリオカート64 のように、ふつうのハンドルは大回りで、きついカーブはドリフトで曲がる（2026-10-14 の実機確認）
function radiusAtTop(ctl, before = []) {
  const kart = createKart(WIDE, WIDE_START);
  run(WIDE, kart, NONE, 4);
  for (const [c, sec] of before) run(WIDE, kart, c, sec);
  const h = kart.heading;
  stepKart(kart, ctl, WIDE, params, DT);
  return { radius: kart.speed / (Math.abs(kart.heading - h) / DT), kart };
}

test('ふつうに曲がる: 最高速でいっぱいに切ると、90度を1.4〜1.9秒（半径40m以上の大回り）', () => {
  const { t } = timeTo90({ ...NONE, steer: 1 }, 4);
  assert.ok(t >= 1.4 && t <= 1.9, `${t.toFixed(2)}秒`);
  const { radius } = radiusAtTop({ ...NONE, steer: 1 });
  assert.ok(radius >= 40, `半径 ${radius.toFixed(1)}m`);
});

test('ドリフトで曲がる: 最高速で同じ向きにいっぱいに切ると、90度を0.6〜0.95秒（半径20〜25m）', () => {
  const { t, kart } = timeTo90(D(1), 4, [[D(1), PHYS.HOP_TIME + 0.02]]);
  assert.ok(kart.drift.active);
  assert.ok(t >= 0.6 && t <= 0.95, `${t.toFixed(2)}秒`);
  const { radius } = radiusAtTop(D(1), [[D(1), PHYS.HOP_TIME + 0.02]]);
  assert.ok(radius >= 20 && radius <= 25, `半径 ${radius.toFixed(1)}m`);
});

test('ドリフト中、反対に切るとほとんど曲がらず、ほぼまっすぐ進む。切らなければその間', () => {
  const r = (steer) => radiusAtTop(D(steer), [[D(1), PHYS.HOP_TIME + 0.02]]).radius;
  const tight = r(1);
  const mid = r(0);
  const straight = r(-1);
  assert.ok(tight < mid && mid < straight, `${tight} / ${mid} / ${straight}`);
  assert.ok(straight >= 200, `反対に切ったときの半径 ${straight.toFixed(0)}m`);
});

test('遅いときも、ふつうのハンドルは最高速のときの1.5倍までしか速く曲がらない（小回りしすぎない）', () => {
  const rate = (warm) => {
    const kart = createKart(WIDE, WIDE_START);
    run(WIDE, kart, NONE, warm);
    const h = kart.heading;
    stepKart(kart, { ...NONE, steer: 1 }, WIDE, params, DT);
    return (kart.heading - h) / DT;
  };
  assert.ok(rate(0.8) <= rate(4) * 1.5 + 1e-9, `${rate(0.8)} / ${rate(4)}`);
});

test('ハンドルを切って曲がっていると、まっすぐより少し（3〜8%）スピードが落ちる', () => {
  const straight = mean(cruise(WIDE, 0, NONE, 2));
  const turning = mean(cruise(WIDE, 0, { ...NONE, steer: 1 }, 2));
  const drop = 1 - turning / straight;
  assert.ok(drop >= 0.03 && drop <= 0.08, `${(drop * 100).toFixed(1)}%`);
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

test('柵に向かってハンドルを切り続けても、止まらずに柵ぞいに走れる（ダートの上でも、スピードは最高速の40%より上）', () => {
  const kart = createKart(OVAL, START);
  run(OVAL, kart, NONE, 3);
  run(OVAL, kart, { ...NONE, steer: 1 }, 4);
  assert.ok(kart.speed > params.topSpeed * 0.4, `${kart.speed}`);
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

test('ジャンプ中にドリフトボタンを押してハンドルを切っていれば、着地するとすぐドリフトになる', () => {
  const kart = createKart(course, indexAt(course, CROSS_S + J.boost.from - 5));
  const ap = autopilot(course);
  let landedAt = null;
  let t = 0;
  let was = false;
  while (t < 5 && landedAt === null) {
    const c = kart.airborne ? { steer: 1, brake: false, drift: true } : ap(kart);
    stepKart(kart, c, course, params, DT);
    if (was && !kart.airborne) landedAt = t;
    was = kart.airborne;
    t += DT;
  }
  assert.ok(landedAt !== null, '着地しない');
  assert.ok(kart.drift.active, '着地してもドリフトにならない');
});

test('ジャンプ台の直前で跳ねても、飛んでいる間は跳ねた分が残らない', () => {
  const kart = createKart(course, indexAt(course, CROSS_S + J.ramp.to - 3));
  kart.speed = 30;
  stepKart(kart, { steer: 0, brake: false, drift: true }, course, params, DT);
  run(course, kart, { steer: 0, brake: false, drift: true }, 0.3);
  assert.ok(kart.airborne);
  assert.equal(kart.hop, 0);
});

test('逆走して柵にこすっても、車がくるっと前向きに戻されない', () => {
  const kart = createKart(OVAL, START + 200);
  run(OVAL, kart, NONE, 0.01);
  const p = OVAL.samples[kart.seg];
  kart.heading = p.h + Math.PI - 0.3; // ほぼ逆向きで、少し柵の方を向く
  kart.move = kart.heading;
  kart.speed = 20;
  const h0 = kart.heading;
  let touched = false;
  run(OVAL, kart, NONE, 3, (k) => { if (k.onWall) touched = true; });
  assert.ok(touched, '柵に当たっていない');
  const diff = Math.abs(Math.atan2(Math.sin(kart.heading - h0), Math.cos(kart.heading - h0)));
  assert.ok(diff < Math.PI / 2, `向きが ${(diff * 180 / Math.PI).toFixed(0)}度 変わった`);
});

// 逆走: コースと逆向きに走っているかを調べ、警告を出す。10秒続いたら、スピンして正しい向きに戻す
function reverseAutopilot(track) {
  return (kart) => {
    const loc = locate(track, kart.x, kart.z, kart.seg);
    const back = loc.heading + Math.PI;
    const err = wrap(kart.heading - back);
    return { steer: Math.max(-1, Math.min(1, loc.lateral * 0.15 - err * 2)), brake: false, drift: false };
  };
}
function turnAround(track, i) {
  const kart = createKart(track, i);
  kart.heading = wrap(kart.heading + Math.PI);
  kart.move = kart.heading;
  return kart;
}

test('コースと逆向きに1秒以上走ると、逆走の警告が出る。前向きに戻ると消える', () => {
  const kart = turnAround(OVAL, START + 300);
  const ap = reverseAutopilot(OVAL);
  run(OVAL, kart, ap, 0.5);
  assert.equal(kart.wrongWay, false, '0.5秒ではまだ出ない');
  run(OVAL, kart, ap, 1.5);
  assert.equal(kart.wrongWay, true);
  // 前向きに戻す
  kart.heading = wrap(kart.heading + Math.PI);
  kart.move = kart.heading;
  run(OVAL, kart, autopilot(OVAL), 1.5);
  assert.equal(kart.wrongWay, false);
});

test('逆走が10秒続くと、スピンして正しい向きに戻る（スピン中はハンドルが効かない。2026-10-14 のユーザー依頼で30秒から短く）', () => {
  const kart = turnAround(OVAL, START + 300);
  const ap = reverseAutopilot(OVAL);
  let spun = false;
  let t = 0;
  while (t < 12 && !spun) {
    stepKart(kart, ap(kart), OVAL, params, DT);
    if (kart.spin > 0) spun = true;
    t += DT;
  }
  assert.ok(spun, 'スピンしない');
  assert.ok(t > 9.9 && t < 10.5, `${t.toFixed(1)}秒でスピン`);
  const h0 = kart.heading;
  stepKart(kart, { steer: 1, brake: false, drift: false }, OVAL, params, DT);
  run(OVAL, kart, { steer: 1, brake: false, drift: false }, PHYS.SPIN_TIME);
  const loc = locate(OVAL, kart.x, kart.z, kart.seg);
  assert.ok(Math.cos(kart.heading - loc.heading) > 0.95, '正しい向きに戻っていない');
  assert.equal(kart.wrongWay, false);
  assert.ok(Math.abs(h0) >= 0);
});

// ジャンプ台のない側（着地する側）から、逆向きに地面のない所へ入ったとき（2026-10-14 の実機確認で、飛び越えてしまった）
for (const [how, speed] of [['逆走して', 1], ['前を向いたままバックで', -1]]) {
  test(`ジャンプの着地する側から、${how}地面のない所へ入っても、飛ばずにふちで止まる`, () => {
    const i = indexAt(course, CROSS_S + J.gap.to + 25);
    const kart = speed > 0 ? turnAround(course, i) : createKart(course, i);
    const ctl = speed > 0 ? { steer: 0, brake: false, drift: false } : { steer: 0, brake: true, drift: false };
    if (speed > 0) kart.speed = 30;
    let flew = false;
    let minS = Infinity;
    run(course, kart, ctl, 5, (k) => {
      if (k.airborne || k.y !== 0) flew = true;
      const loc = locate(course, k.x, k.z, k.seg);
      minS = Math.min(minS, ((loc.s - CROSS_S) % course.length + course.length) % course.length);
    });
    assert.equal(flew, false, '飛んだ');
    assert.ok(minS >= J.gap.to - 1, `ふちを越えた（交わる所から ${minS.toFixed(1)}m）`);
  });
}

test('逆走して、着地する側のふちで止まったまま前に進もうとし続けても、10秒でスピンして正しい向きに戻る', () => {
  const kart = turnAround(course, indexAt(course, CROSS_S + J.gap.to + 10));
  let t = 0;
  while (t < 15 && kart.spin <= 0) {
    stepKart(kart, NONE, course, params, DT);
    t += DT;
  }
  assert.ok(kart.spin > 0, 'スピンしない');
  assert.ok(t < 11, `${t.toFixed(1)}秒`);
});

test('スタートダッシュ: 止まっていても一気に速くなる。加速の数字が大きいほど長く続く', () => {
  const a = createKart(OVAL, START);
  startDash(a, params, 1);
  assert.ok(a.speed > params.topSpeed);
  const b = createKart(OVAL, START);
  startDash(b, params, 5);
  assert.ok(b.boost > a.boost);
  assert.ok(Math.abs(a.boost - (DASH_BASE + DASH_PER_ACCEL)) < 1e-9);
});

test('ロータリーの島は通り抜けられない。まっすぐ当たっても止まらず、横へ抜けて先へ進める', () => {
  const t = buildTrack({ ...OVAL_DEF, theme: 'town', marks: { A: 2, B: 4 }, roundabouts: [{ at: ['A', 'B', 0.5], r: 7 }] });
  const isl = t.islands[0];
  const i = (Math.round(isl.s) - 40 + t.length) % t.length;
  const kart = createKart(t, i, 0.5); // 島の真ん中より少し右を、まっすぐ
  let minD = Infinity;
  run(t, kart, { steer: 0, brake: false, drift: false }, 6, (k) => {
    minD = Math.min(minD, Math.hypot(k.x - isl.x, k.z - isl.z));
  });
  assert.ok(minD >= isl.r, `島に入った: ${minD.toFixed(2)}`);
  const ahead = span(t, isl.s, t.samples[kart.seg].s);
  assert.ok(ahead > 20 && ahead < t.length / 2, `島の先へ進めなかった: ${ahead}`);
});

test('柵にぶつかると、車の端（中心ではなく）が柵の所で止まる。全コース（2026-10-19 のユーザー依頼「壁に食い込んでいる」）', async () => {
  const { COURSES } = await import('../src/data/tracks.js');
  const { wallReach } = await import('../src/game/kart.js');
  const params = kartParams({ accel: 3, top: 3, handling: 3 });
  // 道にそって走っているときは車の幅の半分。斜めのときは前の角の方が柵に近い
  assert.ok(wallReach(0) > 1);
  assert.ok(wallReach(Math.PI / 4) > wallReach(0));
  for (const def of COURSES) {
    const t = buildTrack(def);
    for (const side of [-1, 1]) {
      for (const angle of [0.3, 0.8]) {
        const kart = createKart(t, (t.startIndex + 200) % t.length, 0);
        kart.speed = 30;
        kart.heading += side * angle;
        kart.move = kart.heading;
        for (let f = 0; f < 90; f++) {
          stepKart(kart, { throttle: 1, brake: 0, steer: 0, drift: false }, t, params, 1 / 60);
          const loc = locate(t, kart.x, kart.z, kart.seg, 40, kart.y);
          if (kart.airborne || loc.ground === null) continue;
          const rel = kart.heading - loc.heading;
          assert.ok(Math.abs(loc.lateral) + wallReach(rel) <= loc.wall + 0.05, `${def.name} ${side} ${angle}: ${f}: 横 ${loc.lateral.toFixed(2)} 柵 ${loc.wall}`);
        }
      }
    }
  }
});

// --- アイテム（M3-A）---
const roadCtl = { steer: 0, brake: false, drift: false };

test('Mushroom: 1.5秒、最高速の 1.3倍。ダートでもおそくならない', () => {
  const k = createKart(OVAL, 100, 11); // 道の外（ダート）
  k.speed = params.topSpeed;
  useMushroom(k, params);
  assert.ok(k.speed >= params.topSpeed * 1.3 - 1e-9);
  assert.equal(k.mushroom, MUSHROOM.TIME);
  assert.equal(k.mushrooms, 1);
  run(OVAL, k, roadCtl, 1);
  assert.ok(k.speed > params.topSpeed * 1.25, `ダートでも速いまま: ${k.speed}`);
  // くらべる: キノコでない加速（加速板と同じ）は、ダートでおそくなる
  const d = createKart(OVAL, 100, 11);
  d.speed = params.topSpeed * 1.3;
  d.boost = 1.5;
  d.boostFactor = PHYS.BOOST_FACTOR;
  run(OVAL, d, roadCtl, 1);
  assert.ok(d.speed < params.topSpeed * 1.1, `ダートでおそくなる: ${d.speed}`);
  run(OVAL, k, roadCtl, 1);
  assert.equal(k.mushroom, 0, '1.5秒で終わる');
});

test('Star: 9秒（2026-10-22 のユーザー依頼で 6秒の 1.5倍）。最高速 1.4倍・加速2倍・よく曲がる。終わったらもとどおり', () => {
  assert.equal(STAR.TIME, 9);
  const s = createKart(OVAL, 100);
  const n = createKart(OVAL, 100);
  s.star = STAR.TIME;
  run(OVAL, s, roadCtl, 1);
  run(OVAL, n, roadCtl, 1);
  assert.ok(s.speed > n.speed * 1.6, `加速: ${s.speed} / ${n.speed}`);
  run(OVAL, s, roadCtl, 4.5);
  assert.ok(s.speed > params.topSpeed * 1.35, `最高速: ${s.speed}`); // 2026-10-22 のユーザー依頼で 1.2倍から 1.4倍
  assert.ok(Math.abs(s.star - (STAR.TIME - 5.5)) < 0.05);
  run(OVAL, s, roadCtl, STAR.TIME - 5.5 + 0.1);
  assert.equal(s.star, 0);
  // 曲がる速さ: 同じ速さでハンドルいっぱい
  const a = createKart(OVAL, 100);
  const b = createKart(OVAL, 100);
  a.speed = b.speed = 30;
  a.star = STAR.TIME;
  const h0 = a.heading;
  stepKart(a, { steer: 1, brake: false, drift: false }, OVAL, params, 0.1);
  stepKart(b, { steer: 1, brake: false, drift: false }, OVAL, params, 0.1);
  assert.ok(wrap(a.heading - h0) > wrap(b.heading - h0));
});

test('吹き飛ぶスピン: 1.5秒、その間は動かずハンドルも効かない。終わると道の向き・速さ 0 から', () => {
  const k = createKart(OVAL, 100);
  k.speed = 40;
  k.heading += 0.5;
  k.move = k.heading;
  assert.equal(startBlast(k, OVAL), true);
  assert.equal(startBlast(k, OVAL), false, '吹き飛んでいる間は、もう一度は起きない');
  assert.equal(k.speed, 0);
  assert.equal(k.blasts, 1);
  const x = k.x;
  const z = k.z;
  run(OVAL, k, { steer: 1, brake: false, drift: true }, BLAST.TIME - 0.05);
  assert.ok(k.blast > 0);
  assert.equal(k.x, x);
  assert.equal(k.z, z);
  run(OVAL, k, roadCtl, 0.1);
  assert.equal(k.blast, 0);
  assert.ok(Math.abs(wrap(k.heading - OVAL.samples[k.seg].h)) < 1e-9);
  assert.ok(k.speed < 3, `止まった所から走り出す: ${k.speed}`);
});

test('Star の車は、バンプに速く乗っても転がらない（Kampar Town）', async () => {
  const { COURSES } = await import('../src/data/tracks.js');
  const t2 = buildTrack(COURSES[1]);
  const bs = t2.bumps[0];
  for (const star of [0, STAR.TIME]) {
    const k = createKart(t2, Math.round(bs - 20 + t2.length) % t2.length);
    k.speed = 45;
    k.star = star;
    let rolled = false;
    for (let f = 0; f < 60; f++) {
      if (k.star > 0) k.star = STAR.TIME;
      k.speed = Math.max(k.speed, 45);
      stepKart(k, roadCtl, t2, params, DT);
      if (k.tumble > 0) rolled = true;
    }
    assert.equal(rolled, star === 0, `star ${star}`);
  }
});
