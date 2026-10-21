import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, locate, span } from '../src/game/track.js';
import { COURSE1, COURSE2 } from '../src/data/tracks.js';
import { createKart, stepKart, PHYS } from '../src/game/kart.js';
import { busPose, busContact, busNear, BUS_SPEED, BUS_LANE, BUS_LENGTH } from '../src/game/hazards.js';

const t = buildTrack(COURSE2);

test('スクールバスは Kampar Town に5台。コース1にはいない（2026-10-16 のユーザー依頼）', () => {
  assert.equal(t.buses.length, 5);
  assert.equal(buildTrack(COURSE1).buses.length, 0);
});

test('バスはいつも、レースの進む向きの右側の車線を、逆向きに走ってくる', () => {
  for (const bus of t.buses) {
    const a = busPose(t, bus, 10);
    const b = busPose(t, bus, 11);
    // 1秒で BUS_SPEED m ほど、コースを逆に進む
    const back = span(t, b.s, a.s);
    assert.ok(Math.abs(back - BUS_SPEED) < 1, `${back}`);
    const loc = locate(t, a.x, a.z);
    assert.ok(loc.lateral > BUS_LANE - 1, `右の車線にいない: ${loc.lateral.toFixed(1)}`);
    assert.ok(loc.lateral < loc.half - 1, '道からはみ出す');
    // 向きはコースの逆
    const d = Math.atan2(Math.sin(a.heading - (t.samples[loc.i].h + Math.PI)), Math.cos(a.heading - (t.samples[loc.i].h + Math.PI)));
    assert.ok(Math.abs(d) < 0.5, `向きが逆でない: ${d}`);
  }
});

test('バスはロータリーの島にぶつからず、島の右側を回る', () => {
  for (let time = 0; time < 200; time += 0.25) {
    for (const bus of t.buses) {
      const p = busPose(t, bus, time);
      for (const isl of t.islands) assert.ok(Math.hypot(p.x - isl.x, p.z - isl.z) > isl.r + 2, '島にぶつかる');
    }
  }
});

test('カートがバスに触れると、速さに関係なくスピンする（1回だけ数える）', () => {
  const bus = t.buses[0];
  const p = busPose(t, bus, 5);
  for (const speed of [8, 40]) {
    const kart = createKart(t, 0, 0);
    kart.x = p.x;
    kart.z = p.z;
    kart.speed = speed;
    assert.equal(busContact(kart, t, 5, PHYS), 'spin');
    assert.ok(kart.spin > 0);
    assert.equal(kart.busHits, 1);
    assert.equal(busContact(kart, t, 5, PHYS), null, '触れている間は1回だけ');
  }
  // 離れていれば何もない
  const far = createKart(t, 0, 0);
  far.x = p.x + 40;
  assert.equal(busContact(far, t, 5, PHYS), null);
});

test('すれちがいの音: バスが近い（20m 以内）ときだけ busNear', () => {
  const p = busPose(t, t.buses[0], 3);
  assert.ok(busNear(t, { x: p.x + 5, z: p.z }, 3));
  assert.equal(busNear(t, { x: p.x + 60, z: p.z }, 3), false);
  assert.ok(BUS_LENGTH > 5);
});

test('すれちがいの音の種類: 近くの乗り物の種類（香港の路面電車は tram）。遠ければ false（2026-10-22 のユーザー依頼）', async () => {
  const { COURSES } = await import('../src/data/tracks.js');
  const w = buildTrack(COURSES.find((c) => c.theme === 'world'));
  const tram = w.buses.find((b) => b.kind === 'tram');
  const time = 5;
  const p = busPose(w, tram, time);
  assert.equal(busNear(w, { x: p.x + 1, z: p.z }, time), 'tram');
  assert.equal(busNear(w, { x: p.x + 5000, z: p.z }, time), false);
  const q = busPose(t, t.buses[0], 3);
  assert.equal(busNear(t, { x: q.x + 5, z: q.z }, 3), 'bus', 'スクールバス');
});

test('スタートの前後（うしろ 200m〜前 300m）には、スタートの前からスタートして3秒まで、バスがいない（2026-10-16 のユーザー依頼）', async () => {
  const { BUS_HIDE_AHEAD, BUS_HIDE_BACK } = await import('../src/game/track.js');
  const { COUNTDOWN } = await import('../src/game/race.js');
  for (let time = -COUNTDOWN; time <= 3; time += 0.1) {
    for (const bus of t.buses) {
      const s = busPose(t, bus, time).s;
      assert.ok(s > BUS_HIDE_AHEAD && s < t.length - BUS_HIDE_BACK, `t=${time.toFixed(1)} にスタートの近く（s=${s.toFixed(0)}）`);
    }
  }
});

test('ドリフト中にバスに触れると、ドリフトが解除される（ミニターボはしない。2026-10-16 のユーザー依頼）', () => {
  const p = busPose(t, t.buses[0], 5);
  const kart = createKart(t, 0, 0);
  kart.x = p.x;
  kart.z = p.z;
  kart.speed = 30;
  kart.drift = { active: true, dir: -1, stage: 2, counter: false, flicks: 0, time: 2 };
  assert.equal(busContact(kart, t, 5, PHYS), 'spin');
  assert.equal(kart.drift.active, false);
  assert.equal(kart.boost, 0);
});

test('坂を走るタクシーは、坂にそって傾く: 前と後ろの車輪が、どちらも道の上にのる（ジョージ・ワシントン・ブリッジ。2026-10-22 のユーザー依頼「地面にめり込んでいる」）', async () => {
  const { COURSES } = await import('../src/data/tracks.js');
  const { WHEEL_HALF } = await import('../src/game/hazards.js');
  const w = buildTrack(COURSES.find((c) => c.theme === 'world'));
  const roadY = (x, z, hint, y) => w.samples[locate(w, x, z, hint, 40, y).i].y;
  let sloped = 0;
  for (const taxi of w.buses.filter((b) => b.kind === 'taxi')) {
    for (let time = 0; time < 60; time += 0.7) {
      const p = busPose(w, taxi, time);
      const half = WHEEL_HALF.taxi;
      const fx = Math.cos(p.heading) * Math.cos(p.pitch);
      const fz = Math.sin(p.heading) * Math.cos(p.pitch);
      const i = Math.floor(p.s);
      for (const k of [-1, 1]) {
        const x = p.x + fx * half * k;
        const z = p.z + fz * half * k;
        const y = p.y + Math.sin(p.pitch) * half * k;
        const ry = roadY(x, z, i, y);
        if (ry === null) continue;
        assert.ok(Math.abs(y - ry) < 0.25, `タクシーの${k > 0 ? '前' : '後ろ'}の車輪 ${(y - ry).toFixed(2)}m（s ${p.s.toFixed(0)}）`);
      }
      if (Math.abs(p.pitch) > 0.03) sloped++;
    }
  }
  assert.ok(sloped > 5, '坂の上のタクシーを調べた');
});
