import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, markS, locate, ahead, behind, span } from '../src/game/track.js';
import { createNuts, stepNuts, nutContact, NUT_FALL, NUT_RADIUS, dinoPose, dinoContact, DINO_BLACK, mudContact, MUD_TIME } from '../src/game/hazards.js';
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

// 2026-10-16 のユーザー依頼「最初の分岐で CPU は左右に 50% ずつ」: 外の道 1/2、真ん中の道 1/4、近道 1/4
test('CPU は最初の分かれる所で半分ずつ、真ん中の道に入ったら近道と半分ずつ（周ごとにランダム）', () => {
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
  [1 / 2, 1 / 4, 1 / 4].forEach((want, k) => assert.ok(Math.abs(count[k] / total - want) < 0.07, `${count}`));
});

test('近道を通る CPU は、1回通るうち 3割くらい、わな（ぬかるみ）にかかる（2026-10-16 のユーザー依頼）', async () => {
  const { trapLap } = await import('../src/game/cpu.js');
  let traps = 0;
  let n = 0;
  for (let seed = 0; seed < 50; seed++) for (let id = 0; id < 4; id++) for (let lap = 0; lap < 3; lap++) {
    n++;
    if (trapLap(createCpu(id, seed), lap)) traps++;
  }
  assert.ok(Math.abs(traps / n - 0.3) < 0.07, `${traps}/${n}`);
  // わなにかかる周の CPU は、近道を走ると、本当にぬかるみに入る
  let cpu = null;
  for (let seed = 0; !cpu; seed++) {
    const c = createCpu(1, seed);
    if (trapLap(c, 0)) cpu = c;
  }
  const inner = t.paths[2];
  const kart = createKart(t, inner.start + 5, 0);
  kart.speed = 20;
  cpu.lap = 0;
  cpu.lastS = t.samples[kart.seg].s;
  for (let k = 0; k < 60 * 30 && !kart.mudHits; k++) {
    stepKart(kart, cpuControl(cpu, kart, t, k / 60), t, cpuParams(params, 1), 1 / 60);
    mudContact(kart, t, 1 / 60);
  }
  assert.ok(kart.mudHits >= 1, 'ぬかるみに入らない');
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

test('イノシシは3頭の親子が5か所。いつも道を左右に突進して行ったり来たり（はしで一瞬止まって向きを変える）', () => {
  // 3頭の親子（横一列に並んで同時に渡る）が、5か所（2026-10-16 のユーザー依頼「全然当たらない」）
  assert.equal(t.boars.length, 15);
  const fams = new Map();
  for (const b of t.boars) (fams.get(b.family) ?? fams.set(b.family, []).get(b.family)).push(b);
  assert.equal(fams.size, 5);
  for (const f of fams.values()) {
    assert.equal(f.length, 3);
    for (let time = 0; time < 30; time += 0.5) {
      const ls = f.map((b) => boarPose(t, b, time));
      assert.ok(ls.every((l) => l.state === ls[0].state), '同時に渡る');
    }
    // 走ってくる車から見て横に3頭（同じ所で、道の横に並ぶ。2026-10-16 のユーザー依頼「縦ではなく横に3匹」）
    assert.ok(f.every((b) => b.s === f[0].s), '同じ所');
    const ls = f.map((b) => boarPose(t, b, 1).lateral).sort((a, b) => a - b);
    assert.ok(ls[1] - ls[0] > 2.5 && ls[2] - ls[1] > 2.5, `横にならぶ ${ls}`);
  }
  // 2026-10-16 のユーザー依頼「常に道を左右に突進するように。接触が少なすぎる」
  for (const boar of t.boars) {
    const states = new Set();
    let crossings = 0;
    let prev = null;
    let onRoad = 0;
    let n = 0;
    for (let time = 0; time < 60; time += 0.05) {
      const p = boarPose(t, boar, time);
      states.add(p.state);
      if (prev === 'warn' && p.state === 'run') crossings++;
      if (Math.abs(p.lateral) < t.roadHalf) onRoad++;
      n++;
      prev = p.state;
    }
    assert.ok(crossings >= 20, `60秒で ${crossings} 回`);
    assert.ok(onRoad / n > 0.6, `道の上にいる割合 ${(onRoad / n).toFixed(2)}`);
    assert.ok(!states.has('hide'), 'かくれない');
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

test('サルは内の道だけに5匹。40m 以内に車がいると、その車が少し先で通る所をねらって投げる', () => {
  assert.equal(t.monkeys.length, 5);
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
  // 1回に3つ、道に沿って続けて落とす（当たる所が3倍。2026-10-16 のユーザー依頼）
  assert.equal(nuts.list.length, 3);
  const ds = nuts.list.map((n) => Math.hypot(n.x - target.x, n.z - target.z)).sort((a, b) => a - b);
  assert.ok(ds[1] > NUT_RADIUS * 1.5 && ds[2] < NUT_RADIUS * 6, ds.join(' '));
  assert.equal(stepNuts(nuts, t, [kart], 2.5).length, 0, '2.5秒に1回');
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

test('近道の分かれる所の手前（真ん中の道）は、でこぼこがない（2026-10-16 のユーザー依頼）', () => {
  const mid = t.paths.find((p) => p.id === 'middle');
  const inner = t.paths.find((p) => p.id === 'inner');
  const fork = inner.fork; // 真ん中の道の上の点
  for (let k = 0; k < 120; k++) {
    let i = fork;
    for (let c = 0; c < k; c++) i = t.samples[i].prev;
    assert.ok(!t.samples[i].bumpy, `分かれる所の ${k}m 手前がでこぼこ`);
  }
  assert.ok(t.samples.slice(mid.start, mid.start + mid.count).some((p) => p.bumpy), '真ん中の道のほかの所はでこぼこ');
});

test('でこぼこは、ハンドルが効くように大きな波（1つの波が 50m 以上）', () => {
  for (const b of COURSE3.bumpy) assert.ok(b.wave >= 50, `${b.path} ${b.wave}`);
});

test('右上の丘のあたり（M2〜J2）は、左右にくねくね曲がる', () => {
  const a = Math.round(t.marks.M2), b = Math.round(t.marks.J2);
  let turns = 0;
  let prev = 0;
  for (let i = a; i < b; i += 10) {
    const d = Math.atan2(Math.sin(t.samples[i + 10].h - t.samples[i].h), Math.cos(t.samples[i + 10].h - t.samples[i].h));
    const sign = Math.abs(d) < 0.02 ? 0 : Math.sign(d);
    if (sign && prev && sign !== prev) turns++;
    if (sign) prev = sign;
  }
  assert.ok(turns >= 4, `左右の切りかえ ${turns} 回`);
});

test('近道の手前に、杭の案内板「Main ↑」「Shortcut (Danger) →」がある', async () => {
  const { SOKI_SCENERY } = await import('../src/data/soki.js');
  const sign = SOKI_SCENERY.find((i) => i.part === 'forkSign');
  assert.ok(sign && sign.path === 'middle');
  // 英語で（2026-10-16 のユーザー依頼）
  assert.equal(sign.main, 'Main ↑');
  assert.equal(sign.short, 'Shortcut (Danger) →');
  const inner = t.paths.find((p) => p.id === 'inner');
  const mid = t.paths.find((p) => p.id === 'middle');
  const at = mid.start + Math.round(sign.at * (mid.count - 1));
  const before = inner.fork - at;
  assert.ok(before > 20 && before < 70, `分かれる所の ${before}m 手前`);
});

test('恐竜: ジャンプ②の川から、ときどき口を開けて顔を出す（出る前に少しずつ上がってくる）', () => {
  assert.ok(t.dino);
  const states = new Set();
  let prev = null;
  let ups = 0;
  for (let time = 0; time < 60; time += 0.05) {
    const d = dinoPose(t, time);
    states.add(d.state);
    if (prev === 'hide' && d.state === 'up') assert.fail('いきなり出た');
    if (prev !== 'up' && d.state === 'up') ups++;
    prev = d.state;
  }
  assert.deepEqual([...states].sort(), ['hide', 'rise', 'sink', 'up']);
  assert.ok(ups >= 3 && ups <= 8, `60秒で ${ups} 回`);
});

// ジャンプ②で飛び出してすぐの車（時刻 time）
function flyingAtJ2(time) {
  const j = Math.round(markS(t, ['J2', 'J2', 0]));
  const kart = createKart(t, j - 40, 0);
  kart.speed = 30;
  for (let k = 0; k < 600 && !kart.airborne; k++) stepKart(kart, { steer: 0, drift: false }, t, params, 1 / 60);
  for (let k = 0; k < 10; k++) stepKart(kart, { steer: 0, drift: false }, t, params, 1 / 60);
  assert.ok(kart.airborne);
  return kart;
}

test('恐竜が顔を出しているときにジャンプ②を飛ぶと食べられる: 3秒真っ暗で、ジャンプ台の 90m 手前から走り直し', () => {
  let up = 0;
  while (dinoPose(t, up).state !== 'up') up += 0.05;
  const kart = flyingAtJ2(up);
  // 飛んでいくあいだ、毎フレーム見る（顔の形か口の中に入ったときに食べられる）
  let got = null;
  for (let k = 0; k < 60 && !got; k++) {
    got = dinoContact(kart, t, up + 0.2 + k / 60);
    if (!got) stepKart(kart, { steer: 0, drift: false }, t, params, 1 / 60);
  }
  assert.equal(got, 'eaten');
  assert.equal(kart.eaten, 1);
  assert.ok(kart.swallowed);
  assert.ok(Math.abs(kart.respawn - DINO_BLACK) < 0.01 && DINO_BLACK >= 2.5 && DINO_BLACK <= 3.5);
  for (let k = 0; k < 60 * DINO_BLACK + 5; k++) stepKart(kart, { steer: 0, drift: false }, t, params, 1 / 60);
  assert.ok(!kart.swallowed && kart.respawn <= 0);
  const back = span(t, t.samples[kart.seg].s, markS(t, ['J2', 'J2', 0]));
  assert.ok(Math.abs(back - 90) < 2, `${back}m 手前`);
});

test('恐竜: ジャンプ②に来る時刻をずらすと、6割くらいが食べられる（2026-10-16 のユーザー依頼）', () => {
  const j = Math.round(markS(t, ['J2', 'J2', 0]));
  let eaten = 0;
  let n = 0;
  for (let t0 = 0; t0 < t.dino.period; t0 += 0.25) {
    const k = createKart(t, j - 60, 0);
    k.speed = 35;
    let time = t0;
    let got = false;
    for (let s = 0; s < 60 * 5 && !got; s++) {
      stepKart(k, { steer: 0, drift: false }, t, params, 1 / 60);
      time += 1 / 60;
      got = !!dinoContact(k, t, time);
    }
    n++;
    if (got) eaten++;
  }
  assert.ok(eaten / n > 0.4 && eaten / n < 0.68, `${(eaten / n).toFixed(2)}`);
});

test('いちばん遠い外の道に、加速板が2つ（2026-10-16 のユーザー依頼）', () => {
  const a = markS(t, ['F1', 'F1', 0]);
  const b = markS(t, ['M1', 'M1', 0]);
  let pads = 0;
  for (let i = Math.round(a); i < Math.round(b); i++) {
    if (!t.samples[i].boost || t.samples[i - 1].boost) continue;
    pads++;
    // でこぼこの頂上（前後 15m より高い所）にある（2026-10-16 のユーザー依頼）
    const mid = t.samples[i + 3];
    for (const d of [-15, 15]) assert.ok(mid.y >= t.samples[i + 3 + d].y, `加速板 ${i} は頂上ではない`);
  }
  assert.equal(pads, 2);
});

test('川に落ちたら（川の上で止まって落ちる）、ジャンプ台の少し手前の道にもどる', () => {
  for (const m of ['J1', 'J2']) {
    const j = Math.round(markS(t, [m, m, 0]));
    // 川の上（地面のない所）で止まってしまった（ほかの車に押された、など）
    const kart = createKart(t, j, 0);
    kart.speed = 0;
    let fell = false;
    for (let k = 0; k < 60 * 8; k++) {
      stepKart(kart, { steer: 0, drift: false, brake: true }, t, params, 1 / 60);
      if (kart.respawn > 0) fell = true;
      if (fell && kart.respawn <= 0) break;
    }
    assert.ok(fell, `${m}: 落ちない`);
    const p = t.samples[kart.seg];
    const back = span(t, p.s, j);
    assert.ok(back > 30 && back < 90, `${m}: ${back.toFixed(0)}m 手前にもどった`);
    assert.ok(p.y !== null && !p.ramp && Math.abs(kart.y - p.y) < 0.01, `${m}: 道の上`);
  }
});

test('恐竜の顔より高く飛んでいる車は食べられない（画面で、ぶつかって見えるときだけ）', () => {
  let up = 0;
  while (dinoPose(t, up).state !== 'up') up += 0.05;
  const kart = flyingAtJ2(up);
  for (let k = 0; k < 60; k++) {
    const high = { ...kart, y: kart.y + 15 };
    assert.equal(dinoContact(high, t, up + k / 60), null);
    stepKart(kart, { steer: 0, drift: false }, t, params, 1 / 60);
  }
});

test('恐竜がかくれているときは、ジャンプ②を飛んでも食べられない。道を走っているだけでも食べられない', () => {
  let hide = 0;
  while (dinoPose(t, hide).state !== 'hide') hide += 0.05;
  hide += 0.1;
  const kart = flyingAtJ2(hide);
  for (let k = 0; k < 60; k++) {
    assert.equal(dinoContact(kart, t, hide + k / 60), null);
    stepKart(kart, { steer: 0, drift: false }, t, params, 1 / 60);
  }
  let up = 0;
  while (dinoPose(t, up).state !== 'up') up += 0.05;
  const ground = createKart(t, Math.round(markS(t, ['J2', 'J2', 0])) + 40, 0);
  assert.equal(dinoContact(ground, t, up + 0.2), null);
});

test('近道に大きめのぬかるみが3つ。入ると4秒、ハンドルが左右逆になる（2026-10-16 のユーザー依頼）', () => {
  assert.equal(t.muds.length, 3);
  for (const m of t.muds) {
    assert.equal(t.samples[m.i].path, 2, '近道の上');
    assert.ok(m.r >= 5, '大きめ');
  }
  assert.equal(MUD_TIME, 4);
  const m = t.muds[0];
  const kart = createKart(t, m.i, 0);
  kart.x = m.x;
  kart.z = m.z;
  kart.speed = 15;
  mudContact(kart, t, 1 / 60);
  assert.ok(Math.abs(kart.muddy - MUD_TIME) < 0.05);
  assert.equal(kart.mudHits, 1);
  mudContact(kart, t, 1 / 60);
  assert.equal(kart.mudHits, 1, '中にいる間は1回');
  // 右にハンドルを切ると、左へ曲がる
  const h0 = kart.heading;
  for (let k = 0; k < 20; k++) stepKart(kart, { steer: 1, drift: false }, t, params, 1 / 60);
  const turned = Math.atan2(Math.sin(kart.heading - h0), Math.cos(kart.heading - h0));
  const normal = createKart(t, m.i, 0);
  normal.speed = 15;
  const n0 = normal.heading;
  for (let k = 0; k < 20; k++) stepKart(normal, { steer: 1, drift: false }, t, params, 1 / 60);
  const nTurn = Math.atan2(Math.sin(normal.heading - n0), Math.cos(normal.heading - n0));
  assert.ok(Math.sign(turned) === -Math.sign(nTurn) && nTurn !== 0, `${turned} ${nTurn}`);
  // 4秒たつと元にもどる
  const far = createKart(t, 0, 0);
  far.muddy = MUD_TIME;
  for (let k = 0; k < 60 * MUD_TIME + 2; k++) mudContact(far, t, 1 / 60);
  assert.ok(far.muddy <= 0);
});

test('一度食べられた CPU は、恐竜がもぐってから飛べるように待って、二回続けて食べられない（2026-10-16 のユーザー依頼）', () => {
  const j = Math.round(markS(t, ['J2', 'J2', 0]));
  for (let t0 = 0; t0 < t.dino.period; t0 += 0.1) { // 細かく（最終レビュー: 待つ間に少しずつ進んで加速板に乗り、また食べられた）
    const cpu = createCpu(1, 7);
    const kart = createKart(t, (j - 90 + t.length) % t.length, 0);
    kart.eaten = 1;
    cpu.lap = 0;
    cpu.lastS = t.samples[kart.seg].s;
    let time = t0;
    let passed = false;
    for (let k = 0; k < 60 * 25 && !passed; k++) {
      stepKart(kart, cpuControl(cpu, kart, t, time), t, cpuParams(params, 1), 1 / 60);
      time += 1 / 60;
      assert.equal(dinoContact(kart, t, time), null, `t0=${t0}: また食べられた`);
      const p = t.samples[kart.seg];
      passed = p.path === 0 && span(t, j, p.s) > 40 && span(t, j, p.s) < 200 && !kart.airborne;
    }
    assert.ok(passed, `t0=${t0}: ジャンプ②を通れない`);
  }
});

test('大きな丘のあと（滝のあたり）: 少し急な左カーブのあと、大きな右カーブ（2026-10-16 のユーザー依頼）', () => {
  const a = Math.round(t.marks.HILL);
  const b = Math.round(t.marks.J2);
  const turn = (i, len) => Math.atan2(Math.sin(t.samples[i + len].h - t.samples[i].h), Math.cos(t.samples[i + len].h - t.samples[i].h));
  let left = null;
  for (let i = a; i < b - 50; i += 2) if (turn(i, 50) < -0.6) { left = i; break; }
  assert.ok(left !== null, '急な左カーブがない');
  let right = false;
  for (let i = left; i < b - 120; i += 2) if (turn(i, 120) > 1.2) right = true;
  assert.ok(right, '大きな右カーブがない');
});

test('滝は大きい（はば 18m 以上、高さ 14m 以上）', () => {
  assert.ok(COURSE3.waterfall.width >= 18 && COURSE3.waterfall.height >= 14);
});

test('イノシシにぶつかっても、CPU がはまって動けなくならない（2026-10-16 のユーザー依頼）', () => {
  for (let seed = 0; seed < 4; seed++) {
    const karts = [0, 1, 2, 3].map((k) => createKart(t, (t.startIndex - k * 8 + t.length) % t.length, k % 2 ? 4 : -4));
    const cpus = karts.map((_, k) => createCpu(k, seed));
    const hist = karts.map(() => []);
    let time = seed * 0.37;
    for (let f = 0; f < 60 * 60; f++) {
      karts.forEach((kart, k) => stepKart(kart, cpuControl(cpus[k], kart, t, time), t, cpuParams(params, 1), 1 / 60));
      karts.forEach((kart) => boarContact(kart, t, time, PHYS));
      time += 1 / 60;
      if (f % 30) continue;
      karts.forEach((kart, k) => {
        const h = hist[k];
        h.push({ x: kart.x, z: kart.z });
        if (h.length < 13) return;
        const a = h[h.length - 13];
        assert.ok(Math.hypot(a.x - kart.x, a.z - kart.z) > 15, `seed ${seed} の CPU ${k} が 6秒動けない（点 ${kart.seg}）`);
      });
    }
  }
});

test('イノシシにぶつかったあと少しのあいだは、イノシシに押されずに通りぬけられる', () => {
  const boar = t.boars[0];
  let time = 0;
  while (boarPose(t, boar, time).state !== 'run' || Math.abs(boarPose(t, boar, time).lateral) > 2) time += 0.02;
  const p = boarPose(t, boar, time);
  const kart = createKart(t, 0, 0);
  kart.x = p.x;
  kart.z = p.z + 0.5;
  kart.speed = 15;
  assert.equal(boarContact(kart, t, time, PHYS), 'bounce');
  const x = kart.x;
  const z = kart.z;
  assert.equal(boarContact(kart, t, time + 0.5, PHYS), null);
  assert.ok(kart.x === x && kart.z === z, '押された');
});

test('橋の下（内の道の上）にも橋脚が並ぶ。すき間は車が通れるはば（2026-10-17 のユーザー依頼「下を通りにくく」）', () => {
  assert.ok(t.bridgePiers.length >= 3);
  const ss = t.bridgePiers.map((p) => p.s).sort((a, b) => a - b);
  for (let k = 1; k < ss.length; k++) {
    const gap = ss[k] - ss[k - 1] - 2 * t.bridgePiers[0].halfThick;
    assert.ok(gap >= 4 && gap <= 7, `すき間 ${gap}`);
  }
});

test('橋の下で橋脚にぶつかるとスピン。すぐあとは続けてスピンしないが、橋脚は通りぬけられない', async () => {
  const { pierContact } = await import('../src/game/hazards.js');
  const pier = t.bridgePiers[1];
  const kart = createKart(t, t.bridges[0].under, 0);
  kart.x = pier.x + Math.cos(pier.h) * 0.5;
  kart.z = pier.z + Math.sin(pier.h) * 0.5;
  kart.y = 0;
  kart.speed = 15;
  assert.equal(pierContact(kart, t, 1, PHYS), 'spin');
  assert.ok(kart.spin > 0);
  const a = (kart.x - pier.x) * Math.cos(pier.h) + (kart.z - pier.z) * Math.sin(pier.h);
  assert.ok(Math.abs(a) >= pier.halfThick, '橋脚の中にいる');
  kart.spin = 0;
  kart.x = pier.x;
  kart.z = pier.z;
  assert.equal(pierContact(kart, t, 1.5, PHYS), null, '続けてスピン');
  const a2 = (kart.x - pier.x) * Math.cos(pier.h) + (kart.z - pier.z) * Math.sin(pier.h);
  assert.ok(Math.abs(a2) >= pier.halfThick, '押し出されない');
  // 橋の上を走る車は、橋脚にぶつからない
  const top = createKart(t, pier.i, 0);
  top.y = t.samples[pier.i].y;
  assert.equal(pierContact(top, t, 5, PHYS), null);
});

test('近道を走る CPU は、橋脚のすき間を通りぬける（ほとんどぶつからない）', async () => {
  const { pierContact } = await import('../src/game/hazards.js');
  let hits = 0;
  let runs = 0;
  for (let seed = 0; seed < 8; seed++) {
    const cpu = createCpu(seed % 4, seed);
    const kart = createKart(t, t.bridges[0].under - 120, (seed % 3) * 4 - 4);
    kart.speed = 25;
    cpu.lap = 0;
    cpu.lastS = t.samples[kart.seg].s;
    for (let k = 0; k < 60 * 8; k++) {
      stepKart(kart, cpuControl(cpu, kart, t, k / 60), t, cpuParams(params, 1), 1 / 60);
      if (pierContact(kart, t, k / 60, PHYS)) hits++;
    }
    runs++;
  }
  assert.ok(hits <= 1, `${hits} / ${runs} 回ぶつかった`);
});

test('恐竜の顔は道はばいっぱい。道の端を飛んでも、まん中と同じように食べられる（2026-10-17 のユーザー依頼）', () => {
  let up = 0;
  while (dinoPose(t, up).state !== 'up') up += 0.05;
  for (const lane of [-10, 0, 10]) {
    const j = Math.round(markS(t, ['J2', 'J2', 0]));
    const kart = createKart(t, j - 40, lane);
    kart.speed = 30;
    let time = up - 1.2;
    let got = null;
    for (let k = 0; k < 60 * 3 && !got; k++) {
      stepKart(kart, { steer: 0, drift: false }, t, params, 1 / 60);
      time += 1 / 60;
      got = dinoContact(kart, t, time);
    }
    assert.equal(got, 'eaten', `lane ${lane}`);
  }
});

test('恐竜に食べられて走り直すとき、着地の音は鳴らさない（2026-10-17 のユーザー依頼）', async () => {
  const { soundState, soundEvents } = await import('../src/audio/events.js');
  let up = 0;
  while (dinoPose(t, up).state !== 'up') up += 0.05;
  const j = Math.round(markS(t, ['J2', 'J2', 0]));
  const kart = createKart(t, j - 40, 0);
  kart.speed = 30;
  let time = up - 1.2;
  const sound = () => soundState({ count: '', lap: 0, finished: false, kart, bumps: 0 });
  let prev = sound();
  const events = [];
  let eaten = false;
  for (let k = 0; k < 60 * 6; k++) {
    stepKart(kart, { steer: 0, drift: false }, t, params, 1 / 60);
    time += 1 / 60;
    if (dinoContact(kart, t, time)) eaten = true;
    const cur = sound();
    if (eaten) events.push(...soundEvents(prev, cur, 3));
    prev = cur;
  }
  assert.ok(eaten);
  assert.ok(!events.includes('land'), events.join(','));
});

test('一度食べられた CPU が恐竜を待つ間は、止まったまま。ジャンプ台の手前の加速板に乗らない（最終レビュー）', () => {
  const j = Math.round(markS(t, ['J2', 'J2', 0]));
  let up = 0;
  while (dinoPose(t, up).state !== 'rise') up += 0.02;
  const cpu = createCpu(1, 7);
  const kart = createKart(t, (j - 70 + t.length) % t.length, 0);
  kart.eaten = 1;
  kart.speed = 10;
  cpu.lap = 0;
  cpu.lastS = t.samples[kart.seg].s;
  let time = up - 1;
  for (let k = 0; k < 60 * 6; k++) {
    stepKart(kart, cpuControl(cpu, kart, t, time), t, cpuParams(params, 1), 1 / 60);
    time += 1 / 60;
    if (dinoPose(t, time).rise > 0.2) assert.ok(!t.samples[kart.seg].boost && kart.boost <= 0, `恐竜が出ているのに加速板に乗った（${time.toFixed(2)}）`);
  }
});

test('車8台・全部の仕掛けで走っても、一度食べられた CPU が続けて食べられない（最終レビュー: 待つ間に加速板に乗った）', async () => {
  const { pushApart } = await import('../src/game/collide.js');
  const H = await import('../src/game/hazards.js');
  for (const [level, seed, secs] of [[3, 2, 80], [2, 2, 90]]) {
    const karts = [...Array(8).keys()].map((k) => {
      const s = gridSlot(t, k);
      return createKart(t, s.i, s.lateral);
    });
    const cpus = karts.map((_, k) => createCpu(k, seed));
    const nuts = H.createNuts(t);
    t.nuts = nuts;
    let contacts = new Set();
    let time = -3;
    const lastEat = karts.map(() => -1e9);
    for (let f = 0; f < 60 * secs; f++) {
      karts.forEach((kart, k) => stepKart(kart, time < 0 ? { steer: 0, brake: true, drift: false } : cpuControl(cpus[k], kart, t, time), t, cpuParams(params, 1, level), 1 / 60));
      karts.forEach((kart) => H.boarContact(kart, t, time, PHYS));
      karts.forEach((kart) => H.pierContact(kart, t, time, PHYS));
      karts.forEach((kart) => H.mudContact(kart, t, 1 / 60));
      karts.forEach((kart, k) => {
        if (!H.dinoContact(kart, t, time)) return;
        assert.ok(time - lastEat[k] > 25, `Level ${level} seed ${seed} の CPU ${k} が ${time.toFixed(1)} 秒にまた食べられた`);
        lastEat[k] = time;
      });
      H.stepNuts(nuts, t, karts, time);
      karts.forEach((kart) => H.nutContact(kart, nuts, time, PHYS, { keep: true }));
      H.dropFallen(nuts, time);
      contacts = pushApart(karts, contacts);
      time += 1 / 60;
    }
  }
  t.nuts = null;
});
