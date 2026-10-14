import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSE1 } from '../src/data/tracks.js';
import { createKart, stepKart } from '../src/game/kart.js';
import { kartParams } from '../src/game/stats.js';
import { createCpu, cpuControl, rubberFactor, cpuParams, CPU } from '../src/game/cpu.js';
import { createRace, raceTick, updateProgress, gridSlot, ranking, LAPS } from '../src/game/race.js';
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

test('プレイヤーより前の CPU は少し遅く、後ろの CPU は少し速く（8%まで）', () => {
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
});

test('レースの最初で、まだ進んだ距離が分からない（-Infinity）ときも、速さの倍率は 1（NaN にならない）', () => {
  const L = track.length;
  assert.equal(rubberFactor(-Infinity, -Infinity, L), 1);
  assert.equal(rubberFactor(-Infinity, 100, L), 1);
  assert.equal(rubberFactor(100, -Infinity, L), 1);
});
