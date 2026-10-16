import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, markS, locate, ahead, behind } from '../src/game/track.js';
import { createNuts, stepNuts, nutContact, NUT_FALL, NUT_RADIUS } from '../src/game/hazards.js';
import { boarPose, boarContact, BOAR_RADIUS } from '../src/game/hazards.js';
import { COURSE3, COURSES } from '../src/data/tracks.js';

const t = buildTrack(COURSE3);

test('Soki Forest は3つ目のコース。大会は3レース（2026-10-16 のユーザー依頼）', () => {
  assert.equal(COURSES.length, 3);
  assert.equal(COURSES[2], COURSE3);
  assert.equal(COURSE3.name, 'Soki Forest');
  assert.equal(COURSE3.theme, 'forest');
});

test('本線の印は走る順: スタート → J1 → F1 → M1 → BR → M2 → HILL → J2', () => {
  const order = ['J1', 'F1', 'M1', 'BR', 'M2', 'HILL', 'J2'].map((m) => markS(t, [m, m, 0]));
  for (let k = 1; k < order.length; k++) assert.ok(order[k] > order[k - 1], `${k}`);
  assert.equal(t.length, 2500);
});

test('スタートは下の道で、西（左）へ向かう', () => {
  const p = t.samples[t.startIndex];
  assert.ok(Math.cos(p.h) < -0.8, `${p.h}`);
});

import { createKart, stepKart, PHYS } from '../src/game/kart.js';
import { createCpu, cpuControl, cpuParams, routeChoice } from '../src/game/cpu.js';
import { createRace, raceTick, updateProgress, progress, ranking, gridSlot } from '../src/game/race.js';
import { kartParams } from '../src/game/stats.js';
import { pushApart } from '../src/game/collide.js';

const params = kartParams({ accel: 3, top: 3, handling: 3 });
const L = t.length;

function sokiCpuRace(seed = 1, seconds = 300) {
  const karts = [0, 1, 2, 3].map((k) => {
    const slot = gridSlot(t, k);
    return createKart(t, slot.i, slot.lateral);
  });
  const cpus = [0, 1, 2, 3].map((k) => createCpu(k, seed));
  const race = createRace(4);
  race.t = 0;
  race.phase = 'racing';
  const used = karts.map(() => new Set());
  let contacts = new Set();
  for (let time = 0; time < seconds && !race.entries.every((e) => e.finished); time += 1 / 60) {
    karts.forEach((kart, k) => {
      stepKart(kart, cpuControl(cpus[k], kart, t, time), t, cpuParams(params, 1), 1 / 60);
      updateProgress(race, k, t, kart.seg);
      used[k].add(t.samples[kart.seg].path);
    });
    contacts = pushApart(karts, contacts);
    raceTick(race, 1 / 60);
  }
  return { race, used };
}

test('スタートの並びは本線の上（分かれ道の点に置かない）', () => {
  for (let k = 0; k < 8; k++) assert.equal(t.samples[gridSlot(t, k).i].path, 0);
});

test('CPU 4台が、分かれ道を通って3周を走りきる（1周 80秒より短い）', () => {
  const { race, used } = sokiCpuRace();
  race.entries.forEach((e, k) => {
    assert.ok(e.finished, `CPU ${k} が3周できない（${e.lap}周）`);
    assert.ok(e.time / 3 < 80, `CPU ${k} の1周 ${(e.time / 3).toFixed(1)}秒`);
  });
  const all = new Set(used.flatMap((u) => [...u]));
  assert.ok(all.has(1) || all.has(2), 'だれも分かれ道を通らない');
});

test('CPU は3本の道を、だいたい同じ確率で選ぶ（周ごとにランダム）', () => {
  const count = [0, 0, 0];
  const f1 = t.paths[1].fork;
  const f2 = t.paths[2].fork;
  for (let seed = 0; seed < 40; seed++) {
    for (let id = 0; id < 4; id++) {
      const cpu = createCpu(id, seed);
      for (let lap = 0; lap < 3; lap++) {
        const a = routeChoice(cpu, f1, t.forks[f1], lap, t);
        if (a === null) count[0]++;
        else count[routeChoice(cpu, f2, t.forks[f2], lap, t) === null ? 1 : 2]++;
      }
    }
  }
  const total = count[0] + count[1] + count[2];
  for (const c of count) assert.ok(Math.abs(c / total - 1 / 3) < 0.07, `${count}`);
});

test('同じ CPU・同じ周なら、同じ道を選ぶ（とちゅうで迷わない）', () => {
  const cpu = createCpu(2, 5);
  const f1 = t.paths[1].fork;
  assert.equal(routeChoice(cpu, f1, t.forks[f1], 1, t), routeChoice(cpu, f1, t.forks[f1], 1, t));
});

test('どの道を通っても、本線の上の同じ場所として順位を数える（近道で前に出れば順位が上がる）', () => {
  const race = createRace(2);
  const inner = t.paths[2];
  const nearJoin = inner.start + inner.count - 20; // 近道の合流の手前
  const mainBefore = Math.round(markS(t, ['BR', 'BR', 0])); // 本線の橋（合流②より手前）
  for (const [k, seg] of [[0, mainBefore], [1, nearJoin]]) {
    race.entries[k].rel = 0.5 * L;
    race.entries[k].checkpoint = true;
    updateProgress(race, k, t, seg);
  }
  assert.ok(progress(race, 1, t) > progress(race, 0, t));
  assert.deepEqual(ranking(race, t), [1, 0]);
});

test('ジャンプ①②: どの速さで飛び出しても、川の向こう岸に着く', () => {
  for (const m of ['J1', 'J2']) {
    const j = Math.round(markS(t, [m, m, 0]));
    for (const speed of [6, 20, 40]) {
      const kart = createKart(t, (j - 30 + t.length) % t.length, 0);
      kart.speed = speed;
      let flew = false;
      let landed = false; // 飛んだあと着地した（その先のでこぼこで速く走って浮くのは、ジャンプとは別）
      for (let k = 0; k < 60 * 6 && !landed; k++) {
        stepKart(kart, { steer: 0, drift: false }, t, params, 1 / 60);
        if (kart.airborne) flew = true;
        else if (flew) landed = true;
        assert.equal(kart.respawn, 0, `${m} ${speed}: 川に落ちた`);
      }
      assert.ok(flew, `${m} ${speed}: 飛ばない`);
      assert.ok(landed, `${m} ${speed}: 着地しない`);
    }
  }
});

test('川の上（地面のない所）は、ジャンプ①②の2か所だけ', () => {
  const gaps = [];
  for (let i = 0; i < t.length; i++) if (t.samples[i].y === null && t.samples[t.samples[i].prev].y !== null) gaps.push(t.samples[i].s);
  assert.equal(gaps.length, 2);
});

test('イノシシは3頭。ふだんは道の外のしげみにかくれ、ときどき約2秒で道を横切る。飛び出す前に予告がある', () => {
  assert.equal(t.boars.length, 3);
  for (const boar of t.boars) {
    const states = new Set();
    let crossings = 0;
    let prev = null;
    for (let time = 0; time < 60; time += 0.05) {
      const p = boarPose(t, boar, time);
      states.add(p.state);
      if (p.state === 'hide') assert.ok(Math.abs(p.lateral) > t.roadHalf + 1, 'かくれているのに道の上');
      if (prev === 'warn' && p.state === 'run') crossings++;
      if (p.state === 'run' && prev === 'hide') assert.fail('予告なしに飛び出した');
      prev = p.state;
    }
    assert.ok(crossings >= 4 && crossings <= 8, `60秒で ${crossings} 回`);
    assert.deepEqual([...states].sort(), ['hide', 'run', 'warn']);
  }
});

test('イノシシに、メーター150以上でぶつかるとスピン、遅いと跳ね返る。ドリフトは解除', () => {
  const boar = t.boars[0];
  let time = 0;
  while (boarPose(t, boar, time).state !== 'run' || Math.abs(boarPose(t, boar, time).lateral) > 2) time += 0.02;
  const p = boarPose(t, boar, time);
  for (const [speed, want] of [[30, 'spin'], [15, 'bounce']]) {
    const kart = createKart(t, 0, 0);
    kart.x = p.x - Math.cos(t.samples[locate(t, p.x, p.z).i].h) * (BOAR_RADIUS + 0.5);
    kart.z = p.z - Math.sin(t.samples[locate(t, p.x, p.z).i].h) * (BOAR_RADIUS + 0.5);
    kart.speed = speed;
    kart.drift = { active: true, dir: 1, stage: 2, counter: false, flicks: 0, time: 2 };
    assert.equal(boarContact(kart, t, time, PHYS), want);
    assert.equal(kart.drift.active, false);
  }
});

test('サルは内の道だけに3匹。40m 以内に車がいると、その車が少し先で通る所をねらって投げる', () => {
  assert.equal(t.monkeys.length, 3);
  for (const m of t.monkeys) assert.equal(t.samples[m.i].path, 2);
  const nuts = createNuts(t);
  const m = t.monkeys[0];
  const far = createKart(t, 0, 0);
  const thrown = stepNuts(nuts, t, [far], 0);
  assert.equal(thrown.length, 0, '遠い車にはなげない');
  const kart = createKart(t, behind(t, m.i, 20), 0);
  kart.speed = 25;
  assert.deepEqual(stepNuts(nuts, t, [kart], 1), [0]);
  const nut = nuts.list[0];
  // ねらう所は、車がいまの速さで NUT_FALL 秒後にいる所の近く（道の上）
  const target = t.samples[ahead(t, kart.seg, Math.round(25 * NUT_FALL))];
  assert.ok(Math.hypot(nut.x - target.x, nut.z - target.z) < 4);
  assert.equal(stepNuts(nuts, t, [kart], 1.5).length, 0, '3秒に1回');
});

test('木の実が落ちたとき、落ちる所の近く（1.6m）にいる車はスピン。外れた木の実は消える', () => {
  const nuts = createNuts(t);
  const kart = createKart(t, t.paths[2].start + 50, 0);
  nuts.list.push({ x: kart.x, z: kart.z, from: { x: kart.x, y: 20, z: kart.z }, t0: 0, monkey: 0 });
  assert.equal(nutContact(kart, nuts, NUT_FALL - 0.1, PHYS), null, 'まだ落ちていない');
  assert.equal(nutContact(kart, nuts, NUT_FALL, PHYS), 'spin');
  assert.ok(kart.spin > 0);
  assert.equal(nuts.list.length, 0);
  nuts.list.push({ x: kart.x + 10, z: kart.z, from: { x: 0, y: 20, z: 0 }, t0: 0, monkey: 0 });
  assert.equal(nutContact(kart, nuts, NUT_FALL + 0.1, PHYS), null);
  assert.equal(nuts.list.length, 0, '外れた木の実が残っている');
  assert.ok(NUT_RADIUS > 1);
});
