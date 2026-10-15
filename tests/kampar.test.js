import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, span } from '../src/game/track.js';
import { COURSE2, COURSES } from '../src/data/tracks.js';
import { createKart, stepKart, PHYS } from '../src/game/kart.js';
import { cowContact } from '../src/game/hazards.js';
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
