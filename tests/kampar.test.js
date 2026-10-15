import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, span, markS } from '../src/game/track.js';
import { COURSE2, COURSES } from '../src/data/tracks.js';
import { createKart, stepKart, PHYS } from '../src/game/kart.js';
import { cowContact, busContact } from '../src/game/hazards.js';
import { createCpu, cpuControl } from '../src/game/cpu.js';
import { kartParams } from '../src/game/stats.js';

const t = buildTrack(COURSE2);
const params = kartParams({ accel: 3, top: 3, handling: 3 });

test('Kampar Town は大会の2レース目。1周 2500m、街の見た目、専用の名前', () => {
  assert.equal(COURSES[1], COURSE2);
  assert.equal(COURSE2.name, 'Kampar Town');
  assert.equal(COURSE2.theme, 'town');
  assert.equal(t.length, 2500);
});

test('区間の印 A〜J は、スタートから走る順に並ぶ', () => {
  const order = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].map((m) => t.marks[m]);
  for (let k = 1; k < order.length; k++) assert.ok(order[k] > order[k - 1], `${order}`);
});

test('道は自分と交わらない（立体交差なし）。ロータリーは3つ', () => {
  assert.equal(t.cross, null);
  assert.equal(t.islands.length, 3);
});

test('きついカーブ（20m で52度以上）は8か所まで（町の角を曲がる所だけ）', () => {
  const n = t.samples.length;
  let count = 0;
  let prev = false;
  for (let i = 0; i < n; i++) {
    const a = t.samples[i].h;
    const b = t.samples[(i + 20) % n].h;
    const sharp = Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))) > (52 * Math.PI) / 180;
    if (sharp && !prev) count++;
    prev = sharp;
  }
  assert.ok(count <= 8, `${count}`);
});

test('CPU は3周を止まらずに走りきる。1周は約1分（45〜80秒）', () => {
  const cpu = createCpu(0);
  const kart = createKart(t, t.startIndex, 0);
  let dist = 0;
  let last = t.samples[kart.seg].s;
  let firstLap = null;
  let stuck = 0;
  for (let time = 0; time < 300 && dist < 3 * t.length; time += 1 / 60) {
    stepKart(kart, cpuControl(cpu, kart, t, time), t, params, 1 / 60);
    cowContact(kart, t, time, PHYS);
    const s = t.samples[kart.seg].s;
    const d = span(t, last, s);
    if (d < t.length / 2) dist += d;
    last = s;
    if (firstLap === null && dist >= t.length) firstLap = time;
    stuck = kart.speed < 3 ? stuck + 1 / 60 : 0;
    assert.ok(stuck < 5, `${time.toFixed(1)}秒で止まった（${dist.toFixed(0)}m）`);
  }
  assert.ok(dist >= 3 * t.length, `3周走れなかった: ${dist.toFixed(0)}m`);
  assert.ok(firstLap > 45 && firstLap < 80, `1周 ${firstLap?.toFixed(1)}秒`);
});

// CPU 4台で Kampar Town を3周（ゲームと同じ: 並び・CPU の速さ・牛・車どうしの押し合い）
import { gridSlot } from '../src/game/race.js';
import { cpuParams } from '../src/game/cpu.js';
import { pushApart } from '../src/game/collide.js';
import { locate } from '../src/game/track.js';
function kamparCpuRace(seed = 1) {
  const karts = [0, 1, 2, 3].map((k) => {
    const slot = gridSlot(t, k);
    return createKart(t, slot.i, slot.lateral);
  });
  const cpus = [0, 1, 2, 3].map((k) => createCpu(k, seed));
  const stats = karts.map(() => ({ dist: 0, last: null, median: 0, spins: 0, tumbles: 0, busHits: 0, finish: null }));
  let contacts = new Set();
  for (let time = 0; time < 300 && stats.some((s) => s.finish === null); time += 1 / 60) {
    karts.forEach((kart, k) => {
      const st = stats[k];
      const wasSpin = kart.spin > 0;
      const wasTumble = kart.tumble > 0;
      stepKart(kart, cpuControl(cpus[k], kart, t, time), t, cpuParams(params, 1), 1 / 60);
      cowContact(kart, t, time, PHYS);
      if (busContact(kart, t, time, PHYS)) st.busHits++;
      if (kart.spin > 0 && !wasSpin) st.spins++;
      if (kart.tumble > 0 && !wasTumble) st.tumbles++;
      const loc = locate(t, kart.x, kart.z, kart.seg);
      if (loc.surface === 'dirt' && Math.abs(loc.lateral) < 2 && t.samples[loc.i].median > 0) st.median += 1 / 60;
      const s = t.samples[kart.seg].s;
      if (st.last !== null) {
        const d = span(t, st.last, s);
        if (d < t.length / 2) st.dist += d;
      }
      st.last = s;
      if (st.finish === null && st.dist >= 3 * t.length) st.finish = time;
    });
    contacts = pushApart(karts, contacts);
  }
  return stats;
}

test('CPU 4台が Kampar Town を3周走りきる（バンプ・牛・ロータリーで止まったままにならない。1周は平均80秒まで）', () => {
  const stats = kamparCpuRace();
  stats.forEach((s, k) => {
    assert.ok(s.finish !== null, `CPU ${k} が3周できない（${s.dist.toFixed(0)}m）`);
    assert.ok(s.finish / 3 < 80, `CPU ${k} の1周 ${(s.finish / 3).toFixed(1)}秒`);
  });
});

test('CPU は分離帯の芝生の上を走らない（走る線が分離帯にかかる CPU も、分離帯をよける）', () => {
  for (const [k, s] of kamparCpuRace().entries()) assert.ok(s.median < 3, `CPU ${k} が分離帯の上を ${s.median.toFixed(1)}秒`);
});

test('CPU は牛をよける（ぶつかってスピンするのは、ときどきだけ）', () => {
  // 牛の横を通る回数（4台×3周×頭数）の 7% 以下（9頭で 7 回まで）
  const spins = kamparCpuRace().reduce((n, s) => n + s.spins - s.busHits, 0); // バスでのスピンは別に数える
  const passes = 4 * 3 * t.cows.length;
  assert.ok(spins <= passes * 0.07, `4台×3周（牛 ${t.cows.length} 頭）で ${spins} 回スピン`);
});

const turnDeg = (a, b) => {
  const n = t.samples.length;
  const h1 = t.samples[((Math.round(a) % n) + n) % n].h;
  const h2 = t.samples[((Math.round(b) % n) + n) % n].h;
  return (Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1))) * 180) / Math.PI;
};

test('町の角（A・B・C・D・F・J）は直角（角の前後25mで70度以上曲がる。2026-10-15 のユーザー依頼）', () => {
  const prev = { A: 0, B: t.marks.A, C: t.marks.B, D: t.marks.C, F: t.marks.E, J: t.marks.I };
  for (const m of ['A', 'B', 'C', 'D', 'F', 'J']) {
    const s = t.marks[m];
    assert.ok(turnDeg(s - 25, s + 25) > 70, `${m}: ${turnDeg(s - 25, s + 25).toFixed(0)}度`);
    // 角の手前（前の角から30m あと〜角の40m 手前）は、まっすぐ（C と D のように近い角は調べない）
    const from = Math.max(prev[m] + 30, s - 70);
    if (from < s - 40) assert.ok(turnDeg(from, s - 40) < 15, `${m} の手前: ${turnDeg(from, s - 40).toFixed(0)}度`);
  }
});

test('中央分離帯は G の直線（F〜H）だけ。ほかは1本の道（2026-10-15 のユーザー依頼）。ロータリーの島は半径12m', () => {
  for (const p of t.samples) {
    if (p.median > 0) assert.ok(p.s > t.marks.F && p.s < t.marks.H, `s=${p.s}`);
  }
  assert.ok(t.samples.some((p) => p.median > 0));
  for (const isl of t.islands) assert.equal(isl.r, 12);
});

test('F〜H の小さな加速板は、片側だけ: 右・左・右の順（2026-10-15 のユーザー依頼）', async () => {
  const { locate } = await import('../src/game/track.js');
  const pads = COURSE2.pads.filter((p) => p.side);
  assert.deepEqual(pads.map((p) => p.side), [1, -1, 1]);
  for (const pad of pads) {
    const s = markS(t, pad.at) + 1;
    const p = t.samples[Math.round(s)];
    const at = (d) => locate(t, p.x - Math.sin(p.h) * d, p.z + Math.cos(p.h) * d, null);
    assert.equal(at(pad.side * 6).boost, true, `${pad.at} の加速板の側`);
    assert.equal(at(-pad.side * 6).boost, false, `${pad.at} の反対側`);
  }
});

test('バンプは、ひとつ前の角やロータリーの出口から 70m 以上あとにある（見えてからバンプまでが長い）', () => {
  const isl09 = t.islands[0];
  const exit09 = isl09.s + isl09.r + t.roadHalf + 12;
  assert.ok(t.bumps[0] - exit09 >= 70, `ロータリー 09 の出口からバンプまで ${(t.bumps[0] - exit09).toFixed(0)}m`);
  assert.ok(t.bumps[1] - t.marks.D >= 70, `D からバンプまで ${(t.bumps[1] - t.marks.D).toFixed(0)}m`);
});

test('町の直角の角は、外側が四角い（角のすみまで走れて、壁は2本のまっすぐな線。2026-10-15 のユーザー依頼）', async () => {
  const { locate } = await import('../src/game/track.js');
  assert.deepEqual(COURSE2.squareCorners.map((c) => JSON.stringify(c)).sort(), [['A', 'A', 0], ['B', 'B', 0], ['C', 'C', 0], ['D', 'D', 0], ['D', 'E', 0.7], ['F', 'F', 0], ['J', 'J', 0]].map((c) => JSON.stringify(c)).sort());
  assert.equal(t.corners.length, 7);
  const W = COURSE2.roadHalf + COURSE2.dirt;
  for (const c of t.corners) {
    // 四角のすみ（外側。入ってくる向きの先、曲がる向きと反対）の少し内側は、壁の中
    const x = c.x + c.ux * (W - 1.5) - c.vx * (W - 1.5);
    const z = c.z + c.uz * (W - 1.5) - c.vz * (W - 1.5);
    const loc = locate(t, x, z);
    assert.ok(Math.abs(loc.lateral) <= loc.wall, `s=${c.s.toFixed(0)}: すみが壁の外 (${Math.abs(loc.lateral).toFixed(1)} > ${loc.wall.toFixed(1)})`);
    // 四角の壁の外は、壁の外
    const x2 = c.x + c.ux * (W + 2), z2 = c.z + c.uz * (W + 2);
    const loc2 = locate(t, x2, z2);
    assert.ok(Math.abs(loc2.lateral) > loc2.wall - 0.01, `s=${c.s.toFixed(0)}: 正面の壁の外に出られる`);
  }
});

test('CPU は、逆向きに走ってくるスクールバスをよける（ぶつかるのは、ときどきだけ。2026-10-16 のユーザー依頼）', () => {
  const hits = kamparCpuRace().reduce((n, s) => n + s.busHits, 0);
  assert.ok(hits <= 2, `4台×3周でバスに ${hits} 回ぶつかった`);
});
