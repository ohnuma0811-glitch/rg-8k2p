import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSE1, COURSES } from '../src/data/tracks.js';
import { createKart, stepKart, startDash } from '../src/game/kart.js';
import { kartParams } from '../src/game/stats.js';
import { createCpu, cpuControl, rubberFactor, cpuParams, CPU, cpuItem, CPU_ITEM } from '../src/game/cpu.js';
import { createRace, raceTick, updateProgress, gridSlot, ranking, progress, LAPS } from '../src/game/race.js';
import { pushApart } from '../src/game/collide.js';

const track = buildTrack(COURSE1);
const params = kartParams({ accel: 3, top: 3, handling: 3 });
const DT = 1 / 60;

// CPU 4台だけで、決まった周回（LAPS）のレースをする
function cpuRace(seconds = 220) {
  const race = createRace(4);
  race.t = 0;
  race.phase = 'racing';
  const karts = [0, 1, 2, 3].map((k) => {
    const s = gridSlot(track, k);
    return createKart(track, s.i, s.lateral);
  });
  const cpus = karts.map((_, k) => createCpu(k));
  let respawns = 0;
  let contacts = new Set();
  let wrong = 0;
  for (let t = 0; t < seconds && !race.entries.every((e) => e.finished); t += DT) {
    raceTick(race, DT);
    karts.forEach((kart, k) => {
      if (race.entries[k].finished) return;
      stepKart(kart, cpuControl(cpus[k], kart, track, race.t), track, cpuParams(params, 1), DT);
      if (kart.respawn > 0) respawns++;
      if (kart.wrongWay) wrong++;
    });
    contacts = pushApart(karts, contacts);
    karts.forEach((kart, k) => updateProgress(race, k, track, kart.seg));
  }
  return { race, respawns, wrong };
}

test(`CPU 4台が、押し合いながら${LAPS}周を走りきる（落ちない、逆走しない）。1周は30〜55秒`, () => {
  const { race, respawns, wrong } = cpuRace();
  assert.equal(respawns, 0);
  assert.equal(wrong, 0);
  for (const e of race.entries) {
    assert.ok(e.finished, 'ゴールしていない');
    const lap = e.time / LAPS;
    assert.ok(lap > 30 && lap < 55, `1周 ${lap.toFixed(1)}秒`);
  }
});

test('CPU どうしの差は大きすぎない（1位と4位の差が10秒以内）', () => {
  const { race } = cpuRace();
  const times = race.entries.map((e) => e.time);
  assert.ok(Math.max(...times) - Math.min(...times) < 10, times.join(' / '));
  assert.equal(ranking(race, track).length, 4);
});

test('プレイヤーより前の CPU は少し遅く、後ろの CPU は少し速く（12%まで）', () => {
  const L = track.length;
  assert.ok(rubberFactor(500, 0, L) < 1, '前にいる');
  assert.ok(rubberFactor(0, 500, L) > 1, '後ろにいる');
  assert.equal(rubberFactor(0, 5 * L, L), 1 + CPU.RUBBER_MAX);
  assert.equal(rubberFactor(5 * L, 0, L), 1 - CPU.RUBBER_MAX);
  assert.equal(rubberFactor(100, 100, L), 1);
});

test('CPU の最高速は、キャラの数字より少し遅い（プレイヤーが勝てるように）', () => {
  const p = cpuParams(params, 1);
  assert.ok(p.topSpeed < params.topSpeed);
  assert.equal(p.turnRate, params.turnRate);
  assert.ok(cpuParams(params, 1.08).topSpeed > p.topSpeed);
  assert.equal(CPU.RUBBER_MAX, 0.12);
});

test('CPU のうち2台は、スタートダッシュをする', () => {
  const dash = [0, 1, 2, 3].filter((k) => createCpu(k).dash);
  assert.equal(dash.length, 2);
});

// プレイヤーの代わりに、CPU と同じ運転で、キャラの数字そのまま＋スタートダッシュの車を走らせる
test('CPU が弱すぎない: CPU と同じ運転のプレイヤーが、スタートダッシュしても、ずっと1位のままにはならない（2026-10-14 の実機確認）', () => {
  const me = 4;
  const race = createRace(5);
  race.t = 0;
  race.phase = 'racing';
  const karts = [0, 1, 2, 3, 4].map((k) => {
    const s = gridSlot(track, k);
    return createKart(track, s.i, s.lateral);
  });
  const cpus = karts.map((_, k) => createCpu(k === me ? 7 : k));
  karts.forEach((kart, k) => {
    if (k === me || cpus[k].dash) startDash(kart, params, 3);
  });
  let contacts = new Set();
  let lead = 0;
  let t = 0;
  for (; t < 240 && !race.entries[me].finished; t += DT) {
    raceTick(race, DT);
    const mp = progress(race, me, track);
    karts.forEach((kart, k) => {
      if (race.entries[k].finished) return;
      const p = k === me ? params : cpuParams(params, rubberFactor(progress(race, k, track), mp, track.length));
      stepKart(kart, cpuControl(cpus[k], kart, track, race.t), track, p, DT);
    });
    contacts = pushApart(karts, contacts);
    karts.forEach((kart, k) => updateProgress(race, k, track, kart.seg));
    if (ranking(race, track)[0] === me) lead += DT;
  }
  assert.ok(race.entries[me].finished);
  assert.ok(lead < t * 0.7, `1位だった時間 ${lead.toFixed(1)} / ${t.toFixed(1)} 秒`);
});

test('レースの最初で、まだ進んだ距離が分からない（-Infinity）ときも、速さの倍率は 1（NaN にならない）', () => {
  const L = track.length;
  assert.equal(rubberFactor(-Infinity, -Infinity, L), 1);
  assert.equal(rubberFactor(-Infinity, 100, L), 1);
  assert.equal(rubberFactor(100, -Infinity, L), 1);
});

const OVAL_DEF = {
  points: [[0, 0], [200, 0], [400, 0], [600, 0], [800, 0], [1000, 100], [800, 200], [600, 200], [400, 200], [200, 200], [0, 200], [-200, 100]],
  length: 2400,
  roadHalf: 12,
  dirt: 4,
};

test('CPU はロータリーの島をよけて走る（近い側を回る）', () => {
  const t = buildTrack({ ...OVAL_DEF, theme: 'town', marks: { A: 2, B: 4 }, roundabouts: [{ at: ['A', 'B', 0.5], r: 7 }] });
  const isl = t.islands[0];
  for (const k of [0, 1, 2, 3]) {
    const cpu = createCpu(k);
    const kart = createKart(t, (Math.round(isl.s) - 80 + t.length) % t.length, 0);
    let minD = Infinity;
    for (let s = 0; s < 8; s += 1 / 60) {
      stepKart(kart, cpuControl(cpu, kart, t, s), t, params, 1 / 60);
      minD = Math.min(minD, Math.hypot(kart.x - isl.x, kart.z - isl.z));
    }
    assert.ok(minD > isl.r + 1.5, `CPU ${k} が島にぶつかった: ${minD.toFixed(2)}`);
  }
});

test('CPU の速さは3段階: Level 1 は今の 7割くらい、Level 2 は今のまま、Level 3 は大人に3周で 1/4周の差をつけさせない速さ（2026-10-17 のユーザー依頼）', async () => {
  const { cpuParams, CPU_LEVELS } = await import('../src/game/cpu.js');
  const base = { topSpeed: 40 };
  assert.equal(cpuParams(base, 1, 2).topSpeed, cpuParams(base, 1).topSpeed, '何も言わなければ Level 2');
  assert.ok(Math.abs(CPU_LEVELS[1] - 0.66) < 0.05);
  assert.equal(CPU_LEVELS[2], 1);
  assert.ok(CPU_LEVELS[3] >= 1.08 && CPU_LEVELS[3] <= 1.16);
  assert.ok(cpuParams(base, 1, 1).topSpeed < cpuParams(base, 1, 2).topSpeed && cpuParams(base, 1, 2).topSpeed < cpuParams(base, 1, 3).topSpeed);
});

test('CPU のアイテム: 取ってから0.5秒は使わない。Star・Lightning は1〜3秒で使う', () => {
  const t = buildTrack(COURSES[1]);
  const kart = createKart(t, 100);
  const cpu = createCpu(0, 1);
  kart.held = 'star';
  assert.equal(cpuItem(cpu, kart, [kart], t, 10, () => 0), false);
  assert.equal(cpuItem(cpu, kart, [kart], t, 10.4, () => 0), false);
  assert.equal(cpuItem(cpu, kart, [kart], t, 10.9, () => 0), false, 'rand 0 なら1秒');
  assert.equal(cpuItem(cpu, kart, [kart], t, 11.01, () => 0), true);
});

test('CPU のアイテム: Banana はぶら下げて、後ろ 20m 以内に車が来たら置く。来なければ8秒で置く', () => {
  const t = buildTrack(COURSES[1]);
  const kart = createKart(t, 300);
  const other = createKart(t, 200);
  const cpu = createCpu(0, 1);
  kart.held = 'banana';
  cpuItem(cpu, kart, [kart, other], t, 0);
  assert.equal(cpuItem(cpu, kart, [kart, other], t, 0.6), true, 'ぶら下げる');
  kart.held = null;
  kart.trailing = true;
  assert.equal(cpuItem(cpu, kart, [kart, other], t, 0.7), false);
  assert.equal(cpuItem(cpu, kart, [kart, other], t, 1.5), false, '後ろの車は 100m 先');
  Object.assign(other, createKart(t, 285));
  assert.equal(cpuItem(cpu, kart, [kart, other], t, 2), true, '後ろ 15m に来た');
  const c2 = createCpu(1, 1);
  const k2 = createKart(t, 600);
  k2.trailing = true;
  assert.equal(cpuItem(c2, k2, [k2], t, 0), false);
  assert.equal(cpuItem(c2, k2, [k2], t, 7.9), false);
  assert.equal(cpuItem(c2, k2, [k2], t, 8.1), true);
});

test('CPU のアイテム: Mushroom は、この先がまっすぐな所で使う（10秒持ったら使う）', () => {
  const OVAL = buildTrack({ points: [[0, 0], [200, 0], [400, 0], [600, 0], [800, 0], [1000, 100], [800, 200], [600, 200], [400, 200], [200, 200], [0, 200], [-200, 100]], length: 2400, roadHalf: 9, dirt: 4 });
  const L = OVAL.length;
  const turnOf = (a, b) => Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
  const bendAt = (i) => Math.max(...[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map((d) => turnOf(OVAL.samples[i].h, OVAL.samples[(i + d) % L].h)));
  const idx = [...Array(L).keys()];
  const straightI = idx.reduce((a, i) => (bendAt(i) < bendAt(a) ? i : a), 0);
  const bendI = idx.reduce((a, i) => (bendAt(i) > bendAt(a) ? i : a), 0);
  assert.ok(bendAt(straightI) < 0.05 && bendAt(bendI) > 0.5);
  const straight = createKart(OVAL, straightI);
  const cpu = createCpu(0, 1);
  straight.held = 'mushroom';
  cpuItem(cpu, straight, [straight], OVAL, 0);
  assert.equal(cpuItem(cpu, straight, [straight], OVAL, 0.6), true);
  const bend = createKart(OVAL, bendI);
  const c2 = createCpu(1, 1);
  bend.held = 'mushroom';
  cpuItem(c2, bend, [bend], OVAL, 0);
  assert.equal(cpuItem(c2, bend, [bend], OVAL, 0.6), false, 'カーブの手前');
  assert.equal(cpuItem(c2, bend, [bend], OVAL, 10.1), true, '10秒持ったら使う');
});

test('CPU のアイテム: ルーレットの間は押さない', () => {
  const t = buildTrack(COURSES[1]);
  const kart = createKart(t, 100);
  kart.roulette = 1;
  kart.held = null;
  assert.equal(cpuItem(createCpu(0, 1), kart, [kart], t, 5), false);
});
