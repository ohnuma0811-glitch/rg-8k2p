import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSES } from '../src/data/tracks.js';
import { createKart, stepKart } from '../src/game/kart.js';
import { kartParams } from '../src/game/stats.js';
import { createCpu, cpuControl, cpuParams } from '../src/game/cpu.js';
import { createRace, updateProgress, raceTick, gridSlot } from '../src/game/race.js';
import { charOf } from '../src/data/characters.js';

// CPU 1台が、スタートから1周する時間（秒）。Level 2、プレイヤーとの差の倍率なし
function lapTime(t, stats, seed) {
  const slot = gridSlot(t, 0);
  const kart = createKart(t, slot.i, slot.lateral);
  const cpu = createCpu(1, seed);
  const race = createRace(1);
  race.t = 0;
  race.phase = 'racing';
  const p = cpuParams(kartParams(stats), 1, 2);
  for (let f = 0; f < 60 * 240; f++) {
    stepKart(kart, cpuControl(cpu, kart, t, race.t, p.topSpeed), t, p, 1 / 60);
    updateProgress(race, 0, t, kart.seg);
    raceTick(race, 1 / 60);
    if (race.entries[0].lap >= 1) return race.t;
  }
  return Infinity;
}

for (const c of [0, 1]) {
  test(`Level 2 の CPU は、どのタイプでも、3・3・3 の車と1周の時間が ±8% 以内（${COURSES[c].name}）`, () => {
    const t = buildTrack(COURSES[c]);
    const avg = (stats) => (lapTime(t, stats, 0) + lapTime(t, stats, 1)) / 2;
    const t0 = avg(charOf('kyugo').stats);
    for (const id of ['rabbit', 'tiger', 'cat']) {
      const r = avg(charOf(id).stats) / t0;
      assert.ok(Math.abs(r - 1) <= 0.08, `${id}: ${r.toFixed(3)}（${t0.toFixed(1)}秒にくらべて）`);
    }
  });
}

test('最高速5のキャラは、まっすぐな道で最高速3より速い。加速5は、スタートの2秒で加速2より前にいる', () => {
  const OVAL = buildTrack({ points: [[0, 0], [200, 0], [400, 0], [600, 0], [800, 0], [1000, 100], [800, 200], [600, 200], [400, 200], [200, 200], [0, 200], [-200, 100]], length: 2400, roadHalf: 9, dirt: 4 });
  const run = (stats, sec) => {
    const k = createKart(OVAL, 0);
    for (let f = 0; f < sec * 60; f++) stepKart(k, { steer: 0, brake: false, drift: false }, OVAL, kartParams(stats), 1 / 60);
    return k;
  };
  assert.ok(run(charOf('tiger').stats, 8).speed > run(charOf('kyugo').stats, 8).speed + 3);
  assert.ok(run(charOf('rabbit').stats, 2).seg > run(charOf('tiger').stats, 2).seg);
});
