import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack, locate, sampleAt } from '../src/game/track.js';
import { createRace, updateProgress, progress, ranking, raceLaps, raceDistance, LAPS } from '../src/game/race.js';
import { COURSE5, COURSES } from '../src/data/tracks.js';

const t = buildTrack(COURSE5);
const L = t.length;
const at = (m) => t.samples[Math.round(t.marks[m]) % L];

test('Global City は5つ目・最後のコース。大会は5レース（2026-10-20 のユーザー依頼）', () => {
  assert.equal(COURSES.length, 5);
  assert.equal(COURSES[4], COURSE5);
  assert.equal(COURSE5.name, 'Global City');
});

test('点は m（全体を scale 倍）: 全長は点から自動。走る道は 12km まで（2026-10-20 のユーザー依頼「目安 12km・5〜6分まで」）。東京駅と東京タワーの間の距離が地図のとおり', () => {
  const m = t.marks;
  const autos = (m.FL - m.AJ) + (m.HL - m.LP) + (m.KL - m.R1); // 大ジャンプ・宇宙・ワープ（自動の区間）
  const drive = t.finish - autos;
  assert.ok(drive > 10000 && drive < 12000, `${drive}`);
  const a = at('TS');
  const b = at('TT');
  const k = COURSE5.scale ?? 1;
  assert.ok(Math.abs(Math.hypot(a.x - b.x, a.z - b.z) - k * Math.hypot(410 - 260, 60 - 420)) < 40);
});

test('片道: ゴールは FIN、END から GB までは無い道（描かない・通れない）。スタートの後ろ 50m には車が並べる', () => {
  assert.equal(t.open, true);
  assert.equal(t.finish, t.marks.FIN);
  assert.ok(!at('END').void);
  const mid = t.samples[Math.round((t.marks.END + t.marks.GB) / 2)];
  assert.equal(mid.void, true);
  assert.equal(mid.y, null);
  for (let d = 1; d <= 50; d++) assert.ok(!t.samples[(L - d) % L].void, `スタートの ${d}m 後ろ`);
});

test('片道の大会: 1回だけ走る。ゴールを越えたらゴール。進んだ距離はスタートからの m', () => {
  assert.equal(raceLaps(t), 1);
  assert.equal(raceDistance(t), t.finish);
  const race = createRace(2);
  updateProgress(race, 0, t, L - 20); // スタートの後ろ
  assert.ok(progress(race, 0, t) < 0);
  for (let s = 0; s <= t.finish + 5; s += 5) updateProgress(race, 0, t, Math.round(s) % L);
  assert.equal(race.entries[0].finished, true);
  updateProgress(race, 1, t, 100);
  assert.deepEqual(ranking(race, t), [0, 1]);
});

test('sampleAt は s の所の位置を、となりの点の間でなめらかに返す', () => {
  const a = sampleAt(t, 100);
  const b = sampleAt(t, 100.5);
  const c = sampleAt(t, 101);
  assert.ok(Math.abs(b.x - (a.x + c.x) / 2) < 0.05 && Math.abs(b.z - (a.z + c.z) / 2) < 0.05);
});

test('ほかのコースは今のまま（3周、無い道なし）', () => {
  for (const c of COURSES.slice(0, 4)) {
    const tr = buildTrack(c);
    assert.equal(raceLaps(tr), LAPS, c.name);
    assert.ok(!tr.samples.some((p) => p.void), c.name);
  }
});
