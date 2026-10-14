import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../src/game/track.js';
import { COURSE1 } from '../src/data/tracks.js';
import {
  LAPS, COUNTDOWN, gridSlot, createRace, raceTick, countdownText, pressDash, takeDash,
  updateProgress, progress, ranking, ordinal, timeText,
} from '../src/game/race.js';
import { pushApart } from '../src/game/collide.js';

const track = buildTrack(COURSE1);
const n = track.samples.length;
const DT = 1 / 60;
const at = (rel) => (track.startIndex + Math.round(rel) + n) % n; // スタートラインから rel m の点

test('スタートの並びは、スタートラインの後ろに2列。前後左右に重ならない', () => {
  const slots = [0, 1, 2, 3, 4].map((k) => gridSlot(track, k));
  for (const s of slots) {
    const back = (track.startIndex - s.i + n) % n;
    assert.ok(back >= 5 && back <= 30, `${back}m 後ろ`);
  }
  assert.ok(slots[0].lateral !== slots[1].lateral);
  assert.notEqual(slots[0].i, slots[2].i);
});

test('カウントは 3 → 2 → 1 → GO!。GO になったときだけ知らせる', () => {
  const race = createRace(5);
  assert.equal(race.t, -COUNTDOWN);
  assert.equal(countdownText(race), '3');
  let goes = 0;
  const seen = new Set();
  for (let t = 0; t < 4; t += DT) {
    if (raceTick(race, DT)) goes++;
    seen.add(countdownText(race));
  }
  assert.equal(goes, 1);
  assert.equal(race.phase, 'racing');
  for (const s of ['3', '2', '1', 'GO!', '']) assert.ok(seen.has(s), s);
});

test('スタートダッシュ: GO の0.2秒前〜0.05秒後に押せば成功（2026-10-14 の実機確認「判定が甘い」）。早すぎ・遅すぎ・押さないは失敗。決まるのは1回だけ', () => {
  const tryAt = (pressT) => {
    const race = createRace(1);
    let result = null;
    for (let t = -COUNTDOWN; t < 1; t += DT) {
      raceTick(race, DT);
      if (pressT !== null && race.t >= pressT && race.entries[0].pressedAt === null) pressDash(race, 0);
      if (result === null && race.t >= 0) {
        const r = takeDash(race, 0);
        if (race.entries[0].dashDone) result = r;
      }
    }
    return result;
  };
  assert.equal(tryAt(-0.15), true);
  assert.equal(tryAt(0.03), true);
  assert.equal(tryAt(-0.27), false, '早すぎ');
  assert.equal(tryAt(0.1), false, '遅すぎ');
  assert.equal(tryAt(null), false, '押さない');
});

test('周回: スタート直後はスタートラインを越えても数えない。コースの反対側を通ってから越えると1周', () => {
  const race = createRace(1);
  race.t = 0;
  race.phase = 'racing';
  updateProgress(race, 0, track, at(-6));
  assert.ok(progress(race, 0, track) < 0, 'スタートラインの手前はマイナス');
  updateProgress(race, 0, track, at(5));
  assert.equal(race.entries[0].lap, 0);
  for (let s = 5; s < n + 5; s += 5) updateProgress(race, 0, track, at(s));
  assert.equal(race.entries[0].lap, 1);
});

test('反対側を通らずに、スタートラインを行ったり来たりしても周回は増えない', () => {
  const race = createRace(1);
  for (const s of [-6, 5, -5, 5, -5, 5]) updateProgress(race, 0, track, at(s));
  assert.equal(race.entries[0].lap, 0);
});

test(`${LAPS}周するとゴール。ゴールした時刻を覚える`, () => {
  const race = createRace(1);
  race.t = 42;
  updateProgress(race, 0, track, at(-6));
  for (let s = -5; s < LAPS * n + 5; s += 5) updateProgress(race, 0, track, at(s));
  assert.ok(race.entries[0].finished);
  assert.equal(race.entries[0].time, 42);
});

test('順位: ゴールした車はゴールした順、まだの車は進んだ距離の順', () => {
  const race = createRace(3);
  updateProgress(race, 0, track, at(100));
  updateProgress(race, 1, track, at(300));
  updateProgress(race, 2, track, at(200));
  assert.deepEqual(ranking(race, track), [1, 2, 0]);
  race.entries[0].finished = true;
  race.entries[0].time = 50;
  assert.deepEqual(ranking(race, track), [0, 1, 2]);
});

test('順位とタイムの表示', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 11, 21].map(ordinal), ['1st', '2nd', '3rd', '4th', '5th', '11th', '21st']);
  assert.equal(timeText(83.456), '1:23.46');
  assert.equal(timeText(5.1), '0:05.10');
});

test('車どうしが重なったら押し戻す。上を飛んでいる車とはぶつからない', () => {
  const a = { x: 0, y: 0, z: 0, speed: 30, respawn: 0 };
  const b = { x: 1, y: 0, z: 0, speed: 30, respawn: 0 };
  pushApart([a, b]);
  assert.ok(Math.hypot(b.x - a.x, b.z - a.z) >= 2.2 - 1e-9);
  assert.ok(a.speed < 30 && a.speed > 29);
  const c = { x: 0, y: 4, z: 0, speed: 30, respawn: 0 };
  const d = { x: 0.5, y: 0, z: 0, speed: 30, respawn: 0 };
  pushApart([c, d]);
  assert.equal(d.x, 0.5);
});

test('並んで走り続けても、スピードが落ちるのはぶつかった最初の1回だけ。空中では落ちない', () => {
  const a = { x: 0, y: 0, z: 0, speed: 30, respawn: 0, airborne: false };
  const b = { x: 1, y: 0, z: 0, speed: 30, respawn: 0, airborne: false };
  let contacts = new Set();
  for (let k = 0; k < 60; k++) {
    b.x = a.x + 1;
    contacts = pushApart([a, b], contacts);
  }
  assert.ok(a.speed > 29, `${a.speed}`);
  const c = { x: 0, y: 4, z: 0, speed: 30, respawn: 0, airborne: true };
  const d = { x: 1, y: 4, z: 0, speed: 30, respawn: 0, airborne: true };
  pushApart([c, d]);
  assert.equal(c.speed, 30);
});

test('レースの前に、コースを回って映し、コースの名前を3秒出す（2026-10-14 のユーザー依頼）。いまのコースは Kenta Circuit', async () => {
  const { COURSE_INTRO } = await import('../src/game/race.js');
  const { COURSE1 } = await import('../src/data/tracks.js');
  assert.equal(COURSE_INTRO, 3);
  assert.equal(COURSE1.name, 'Kenta Circuit');
});

test('ポイント: 1位から 10, 8, 6, 5, 4, 3, 2, 1。5台なら5位は4ポイント（2026-10-14 のユーザー依頼）', async () => {
  const { racePoints } = await import('../src/game/race.js');
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(racePoints), [10, 8, 6, 5, 4, 3, 2, 1]);
  assert.equal(racePoints(5), 4, '5台のレースの5位');
});

test('スタートから逆走して、コースの反対側（半分）まで戻っても、その周の半分を通ったことにしない（レビューの指摘）', () => {
  const race = createRace(1);
  race.t = 0;
  race.phase = 'racing';
  updateProgress(race, 0, track, at(-6));
  // 逆向きに、1周の45%ほど戻る
  for (let s = -6; s > -0.45 * track.length; s -= 5) updateProgress(race, 0, track, at(s));
  assert.equal(race.entries[0].checkpoint, false);
  assert.ok(progress(race, 0, track) < 0, `進んだ距離 ${progress(race, 0, track)}`);
});
