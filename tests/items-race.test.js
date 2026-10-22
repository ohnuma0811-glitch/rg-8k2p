import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSES } from '../src/data/tracks.js';
import { createKart, stepKart, PHYS } from '../src/game/kart.js';
import { kartParams } from '../src/game/stats.js';
import { createCpu, cpuControl, cpuParams, cpuItem } from '../src/game/cpu.js';
import { createRace, updateProgress, raceTick, ranking, gridSlot, progress } from '../src/game/race.js';
import { pushApart } from '../src/game/collide.js';
import { busContact, mudContact } from '../src/game/hazards.js';
import { charOf } from '../src/data/characters.js';
import { initItems, createItemWorld, itemFrame } from '../src/game/items.js';

const params = kartParams({ accel: 3, top: 3, handling: 3 });
const LINEUP = ['rabbit', 'tiger', 'cat', 'elephant'].map((id) => cpuParams(kartParams(charOf(id).stats), 1));

// かんたんな数のくり返し（テストの結果が毎回同じになるように）
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

for (const [c, limit] of [[0, 300], [1, 360], [2, 360], [3, 360], [4, 480]]) {
  test(`アイテムあり: ちがうタイプのキャラの CPU 4台が ${COURSES[c].name} を最後まで走る。アイテムを取って使う。動けなくならない`, () => {
    const t = buildTrack(COURSES[c]);
    const n = 4;
    const karts = [...Array(n)].map((_, k) => {
      const slot = gridSlot(t, k);
      const kart = createKart(t, slot.i, slot.lateral);
      initItems(kart);
      return kart;
    });
    const cpus = karts.map((_, k) => createCpu(k, 3));
    const race = createRace(n);
    race.t = 0;
    race.phase = 'racing';
    const world = createItemWorld(t);
    const rand = seeded(7);
    let contacts = new Set();
    let used = 0;
    const hist = karts.map(() => []);
    for (let f = 0; race.t < limit && !race.entries.every((e) => e.finished); f++) {
      karts.forEach((kart, k) => {
        if (race.entries[k].finished) return;
        stepKart(kart, cpuControl(cpus[k], kart, t, race.t, LINEUP[k].topSpeed), t, LINEUP[k], 1 / 60);
        busContact(kart, t, race.t, PHYS);
        mudContact(kart, t, 1 / 60);
      });
      karts.forEach((kart, k) => { kart.finished = race.entries[k].finished; });
      const fr = { me: -1, press: false, cpuPress: (k) => !race.entries[k].finished && cpuItem(cpus[k], karts[k], karts, t, race.t, rand), t: race.t, ranks: ranking(race, t), finished: race.entries.map((e) => e.finished), params, paramsOf: (k) => LINEUP[k], rand };
      used += itemFrame(world, karts, fr, 1 / 60).events.filter((e) => e.type === 'use').length;
      contacts = pushApart(karts, contacts);
      karts.forEach((kart, k) => updateProgress(race, k, t, kart.seg));
      raceTick(race, 1 / 60);
      if (f % 60) continue;
      karts.forEach((kart, k) => {
        if (race.entries[k].finished || kart.respawn > 0) return;
        const h = hist[k];
        h.push(progress(race, k, t));
        if (h.length < 11) return;
        assert.ok(h[h.length - 1] - h[h.length - 11] > 15, `CPU ${k} が10秒動けない（点 ${kart.seg}）`);
      });
    }
    race.entries.forEach((e, k) => assert.ok(e.finished, `CPU ${k} がゴールできない`));
    assert.ok(used >= n, `アイテムを使った数: ${used}`);
  });
}
