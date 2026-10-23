import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RACE_KARTS, START_DELAY_MS, KART_STALE_MS, END_AFTER_FIRST_MS, SPECTATE_HOLD, cpuCount, pickVsCpus, pickHost, makeRace, createVsRace, waitRace, raceLineup,
  kartGone, vsRanking, raceEnd, slowestHuman, nextSpectate, nextHost, takeHost, writeGoal, setFirstGoal, quitRace, vsResultRows, rubberRef,
} from '../src/net/race.js';
import { CHARS } from '../src/data/characters.js';
import { RESULTS_DELAY } from '../src/game/race.js';

// メモリのサーバー（パスで読み書き。transaction と watch も）
function fakeDb() {
  const data = {};
  const watchers = [];
  const at = (path) => {
    const keys = path.split('/').filter(Boolean);
    let o = data;
    for (const k of keys.slice(0, -1)) o = o[k] ??= {};
    return [o, keys[keys.length - 1]];
  };
  const read = (path) => path.split('/').filter(Boolean).reduce((o, k) => (o == null ? null : o[k] ?? null), data);
  const copy = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
  const notify = () => watchers.forEach((w) => w.cb(copy(read(w.path))));
  return {
    data,
    SERVER_TIME: 777,
    async get(path) { return copy(read(path)); },
    async set(path, v) { const [o, k] = at(path); o[k] = copy(v); notify(); },
    async remove(path) { const [o, k] = at(path); delete o[k]; notify(); },
    async transaction(path, fn) { const next = fn(copy(read(path))); if (next === undefined) return false; const [o, k] = at(path); o[k] = next; notify(); return true; },
    watch(path, cb) { const w = { path, cb }; watchers.push(w); cb(copy(read(path))); return () => watchers.splice(watchers.indexOf(w), 1); },
  };
}
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
const player = (uid, name, char, score) => ({ uid, name, char, score, ready: false, at: 1 });

test('台数: 5台に足りない分を CPU で（2人 → 3台、3人 → 2台、4人 → 1台、5人以上 → なし）', () => {
  assert.equal(RACE_KARTS, 5);
  assert.deepEqual([1, 2, 3, 4, 5, 8].map(cpuCount), [4, 3, 2, 1, 0, 0]);
});

test('CPU のキャラは、走る人が選んでいないキャラから。足りなければ重なってよい', () => {
  const taken = ['kyugo', 'cat'];
  const ids = pickVsCpus(taken, 3, seq(0.3, 0.9, 0.1, 0.5));
  assert.equal(ids.length, 3);
  assert.equal(new Set(ids).size, 3);
  for (const id of ids) assert.ok(!taken.includes(id));
  const seven = CHARS.map((c) => c.id).filter((id) => id !== 'tiger');
  const more = pickVsCpus(seven, 3, seq(0.5));
  assert.equal(more[0], 'tiger', '選ばれていないキャラが先');
  assert.ok(more.slice(1).every((id) => seven.includes(id)));
});

test('host は点数がいちばん高い端末（同じなら uid の小さい方）', () => {
  assert.equal(pickHost({ u2: 80, u1: 60 }), 'u2');
  assert.equal(pickHost({ u2: 70, u1: 70 }), 'u1');
  assert.equal(pickHost({}), null);
});

test('レースを作る: スタートは今のサーバーの時刻 + 8秒。人が前（ランダムな順）、CPU が後ろ。走る人でない人・待合室にいない人は入れない', () => {
  const room = { phase: 'decided', voteId: 'v1', course: 3, racers: { u1: true, u2: true, u3: true } };
  const players = [player('u1', 'KYUGO', 'kyugo', 50), player('u2', 'SOKI', 'soki', 90), player('u9', 'LATE', 'cat', 99)];
  const race = makeRace(room, players, 1000.4, seq(0.1, 0.7, 0.3, 0.5, 0.2));
  assert.equal(START_DELAY_MS, 8000);
  assert.equal(race.id, 'v1');
  assert.equal(race.course, 3);
  assert.equal(race.startAt, 9000);
  assert.deepEqual(Object.keys(race.racers).sort(), ['u1', 'u2']);
  assert.deepEqual(Object.values(race.racers).map((r) => r.slot).sort(), [0, 1]);
  assert.deepEqual(race.racers.u1, { name: 'KYUGO', char: 'kyugo', slot: race.racers.u1.slot });
  assert.deepEqual(Object.keys(race.cpus), ['c0', 'c1', 'c2']);
  assert.deepEqual(Object.values(race.cpus).map((c) => c.slot), [2, 3, 4]);
  for (const c of Object.values(race.cpus)) assert.ok(!['kyugo', 'soki'].includes(c.char));
  assert.deepEqual(race.scores, { u1: 50, u2: 90 });
  assert.equal(race.host, 'u2');
  assert.equal(makeRace({ ...room, racers: { u7: true } }, players, 0, Math.random), null, '走る人がいない');
  const noScore = makeRace(room, [player('u1', 'KYUGO', 'kyugo', undefined)], 0, Math.random);
  assert.deepEqual(noScore.scores, { u1: 0 });
});

test('作るのは1回だけ（2台が同時に見ても）。作った端末が走ったコースに足し、部屋を racing に', async () => {
  const db = fakeDb();
  db.data.room = { phase: 'decided', voteId: 'v1', endsAt: 1, seed: 1, course: 2, picks: 1, racers: { u1: true, u2: true } };
  const players = [player('u1', 'KYUGO', 'kyugo', 50), player('u2', 'SOKI', 'soki', 90)];
  assert.equal(await createVsRace(db, db.data.room, players, 1000, 5, Math.random), true);
  const startAt = db.data.race.startAt;
  assert.equal(await createVsRace(db, { ...db.data.room, phase: 'decided' }, players, 5000, 5, Math.random), false);
  assert.equal(db.data.race.startAt, startAt, 'スタートの時刻は変わらない');
  assert.deepEqual(db.data.played, { 2: true });
  assert.equal(db.data.room.phase, 'racing');
  // 次の投票（番号がちがう）なら作り直す
  db.data.room = { ...db.data.room, phase: 'decided', voteId: 'v2', course: 4 };
  assert.equal(await createVsRace(db, db.data.room, players, 9000, 5, Math.random), true);
  assert.equal(db.data.race.id, 'v2');
  assert.deepEqual(db.data.played, { 2: true, 4: true });
});

test('レースを待つ: その番号の /race が来たら返す。来なければ時間で null', async () => {
  const db = fakeDb();
  db.data.race = { id: 'v0', startAt: 1 };
  const got = waitRace(db, 'v1', 10000);
  await db.set('race', { id: 'v1', startAt: 9000, racers: {} });
  assert.deepEqual(await got, { id: 'v1', startAt: 9000, racers: {} });
  let fire = null;
  const none = waitRace(db, 'v9', 10000, { setTimeout: (fn) => { fire = fn; return 1; }, clearTimeout: () => {} });
  fire();
  assert.equal(await none, null);
});

test('並び: slot の順。CPU の名前はキャラの名前', () => {
  const lineup = raceLineup({ racers: { u2: { name: 'SOKI', char: 'soki', slot: 1 }, u1: { name: 'KYUGO', char: 'kyugo', slot: 0 } }, cpus: { c0: { char: 'tiger', slot: 2 } } });
  assert.deepEqual(lineup, [
    { id: 'u1', human: true, name: 'KYUGO', char: 'kyugo', slot: 0 },
    { id: 'u2', human: true, name: 'SOKI', char: 'soki', slot: 1 },
    { id: 'c0', human: false, name: 'Big Tiger', char: 'tiger', slot: 2 },
  ]);
  assert.equal(raceLineup({ racers: { u1: { name: 'A', char: 'cat', slot: 0 } } }).length, 1, 'CPU なし');
});

test('切れた車: 書いた時刻（サーバー）が3秒より古い。まだ来ていない車は、スタート + 3秒までは待つ', () => {
  assert.equal(KART_STALE_MS, 3000);
  assert.equal(kartGone({ t: 10000 }, 13000, 0), false);
  assert.equal(kartGone({ t: 10000 }, 13001, 0), true);
  assert.equal(kartGone(null, 5000, 4000), false);
  assert.equal(kartGone(null, 7001, 4000), true);
});

test('順位: ゴールのタイムの速い順 → 走っている車は進んだ距離の順 → QUIT と切れた車', () => {
  const e = (id, slot, human = true) => ({ id, slot, human });
  const lineup = [e('u1', 0), e('u2', 1), e('u3', 2), e('c0', 3, false), e('c1', 4, false)];
  const goals = { u3: 90.5, c0: 88.2, u2: 'quit' };
  const prog = { u1: 500, u2: 2000, u3: 3000, c0: 3000, c1: 700 };
  assert.deepEqual(vsRanking(lineup, goals, prog, new Set()), ['c0', 'u3', 'c1', 'u1', 'u2']);
  assert.deepEqual(vsRanking(lineup, goals, prog, new Set(['c1'])), ['c0', 'u3', 'u1', 'u2', 'c1'], '切れた車は後ろ（その中は進んだ距離の順）');
  assert.deepEqual(vsRanking(lineup, null, {}, new Set()), ['u1', 'u2', 'u3', 'c0', 'c1'], 'まだ何もなければ並びの順');
});

test('終わり: 人が全員ゴールしたら、いちばん遅い人のゴールの映像（12秒）のあと。CPU は待たない', () => {
  const race = { startAt: 0, firstGoalAt: null };
  const humans = ['u1', 'u2'];
  assert.deepEqual(raceEnd(race, humans, { u1: 80 }, new Set(), 100000), { over: false, countdown: null });
  const goals = { u1: 80, u2: 95 };
  assert.deepEqual(raceEnd(race, humans, goals, new Set(), (95 + RESULTS_DELAY) * 1000 - 1), { over: false, countdown: null });
  assert.deepEqual(raceEnd(race, humans, goals, new Set(), (95 + RESULTS_DELAY) * 1000), { over: true, countdown: null });
});

test('終わり: QUIT・切れた人は、ゴールしたのと同じに数える。人がだれもタイムでゴールしていなければ、すぐ', () => {
  const race = { startAt: 0, firstGoalAt: null };
  assert.equal(raceEnd(race, ['u1', 'u2'], { u1: 70, u2: 'quit' }, new Set(), (70 + RESULTS_DELAY) * 1000).over, true);
  assert.equal(raceEnd(race, ['u1', 'u2'], { u1: 70 }, new Set(['u2']), (70 + RESULTS_DELAY) * 1000).over, true);
  assert.equal(raceEnd(race, ['u1', 'u2'], { u1: 'quit' }, new Set(['u2']), 5000).over, true);
});

test('終わり: 人の1位のゴールから3分。最後の10秒は 10・9・…・1、0 で終わる', () => {
  assert.equal(END_AFTER_FIRST_MS, 180000);
  const race = { startAt: 1000, firstGoalAt: null };
  const humans = ['u1', 'u2'];
  const goals = { u1: 60, c0: 50 }; // CPU のゴールは数えない。人の1位は 1000 + 60000 = 61000
  const limit = 61000 + 180000;
  assert.deepEqual(raceEnd(race, humans, goals, new Set(), limit - 10001), { over: false, countdown: null });
  assert.deepEqual(raceEnd(race, humans, goals, new Set(), limit - 10000), { over: false, countdown: 10 });
  assert.deepEqual(raceEnd(race, humans, goals, new Set(), limit - 9999), { over: false, countdown: 10 });
  assert.deepEqual(raceEnd(race, humans, goals, new Set(), limit - 1), { over: false, countdown: 1 });
  assert.deepEqual(raceEnd(race, humans, goals, new Set(), limit), { over: true, countdown: null });
  // 書いてある firstGoalAt があれば、それを使う
  assert.deepEqual(raceEnd({ startAt: 1000, firstGoalAt: 50000 }, humans, goals, new Set(), 50000 + 175000), { over: false, countdown: 5 });
  // 全員ゴールの終わりが先なら、カウントは出さない
  assert.deepEqual(raceEnd(race, humans, { u1: 60, u2: 61 }, new Set(), 1000 + (61 + RESULTS_DELAY) * 1000 - 1), { over: false, countdown: null });
});

test('上空カメラが追う車: まだ走っている人（CPU は入れない）でいちばん遅い車', () => {
  const e = (id, human = true) => ({ id, human });
  const lineup = [e('u1'), e('u2'), e('u3'), e('c0', false)];
  const prog = { u1: 900, u2: 300, u3: 100, c0: 10 };
  assert.equal(slowestHuman(lineup, {}, new Set(), prog), 'u3');
  assert.equal(slowestHuman(lineup, { u3: 'quit' }, new Set(), prog), 'u2');
  assert.equal(slowestHuman(lineup, {}, new Set(['u3']), prog), 'u2');
  assert.equal(slowestHuman(lineup, { u1: 80, u2: 90, u3: 'quit' }, new Set(), prog), null);
});

test('上空カメラが移る: はじめはすぐ。いちばん遅い車が2秒続けて変わったら移る。追っている車がゴールしたらすぐ', () => {
  assert.equal(SPECTATE_HOLD, 2);
  let s = nextSpectate({ target: null, cand: null, wait: 0 }, 'u3', false, 0.5);
  assert.equal(s.target, 'u3');
  for (let i = 0; i < 3; i++) {
    s = nextSpectate(s, 'u2', true, 0.5);
    assert.equal(s.target, 'u3', `${(i + 1) * 0.5}秒`);
  }
  s = nextSpectate(s, 'u2', true, 0.5);
  assert.equal(s.target, 'u2', '2秒で移る');
  s = nextSpectate(s, 'u1', true, 1.5);
  s = nextSpectate(s, 'u2', true, 1.5);
  assert.equal(s.target, 'u2', '行ったり来たりでは移らない');
  assert.equal(s.wait, 0);
  s = nextSpectate(s, 'u1', false, 0.1);
  assert.equal(s.target, 'u1', '追っている車がもう走っていない');
  assert.equal(nextSpectate(s, null, false, 0.1).target, 'u1', 'だれも走っていなければ、そのまま');
});

test('host の引き継ぎ: host の車が3秒止まったら、残っている人で点数がいちばん高い人。QUIT・切れた人は入れない', () => {
  const race = { host: 'u1', startAt: 0, racers: { u1: {}, u2: {}, u3: {}, u4: {} }, scores: { u1: 99, u2: 50, u3: 80, u4: 90 } };
  const now = 100000;
  const fresh = { t: now - 100 };
  const old = { t: now - 5000 };
  assert.equal(nextHost(race, { u1: fresh, u2: fresh, u3: fresh, u4: fresh }, {}, now), null, 'host は動いている');
  assert.equal(nextHost(race, { u1: old, u2: fresh, u3: fresh, u4: old }, {}, now), 'u3');
  assert.equal(nextHost(race, { u1: old, u2: fresh, u3: fresh, u4: fresh }, { u4: 'quit' }, now), 'u3');
  assert.equal(nextHost(race, { u1: fresh, u2: fresh, u3: fresh, u4: fresh }, { u1: 'quit' }, now), 'u4', 'host が QUIT');
  assert.equal(nextHost(race, { u1: old }, {}, now), null, 'だれもいない');
});

test('host を変えるのは、まだ前の host のときだけ（2台が同時に引き継がない）', async () => {
  const db = fakeDb();
  db.data.race = { host: 'u1' };
  assert.equal(await takeHost(db, 'u1', 'u3'), true);
  assert.equal(await takeHost(db, 'u1', 'u2'), false);
  assert.equal(db.data.race.host, 'u3');
});

test('ゴール: 一度だけ書く。最初のゴールの時刻は小さい方だけ。QUIT は quit と書いて車を消す', async () => {
  const db = fakeDb();
  db.data.race = { karts: { u1: { x: 1 }, u2: { x: 2 } } };
  assert.equal(await writeGoal(db, 'u1', 80.25), true);
  assert.equal(await writeGoal(db, 'u1', 70), false);
  assert.equal(db.data.race.goals.u1, 80.25);
  assert.equal(await setFirstGoal(db, 90000), true);
  assert.equal(await setFirstGoal(db, 95000), false);
  assert.equal(await setFirstGoal(db, 85000), true);
  assert.equal(db.data.race.firstGoalAt, 85000);
  await quitRace(db, 'u2');
  assert.equal(db.data.race.goals.u2, 'quit');
  assert.equal(db.data.race.karts.u2, undefined);
});

test('結果の行: 順位・名前・タイム（ゴールしていなければ —）・顔。ポイントはない', () => {
  const lineup = [{ id: 'u1', name: 'KYUGO', char: 'kyugo', slot: 0 }, { id: 'c0', name: 'Big Tiger', char: 'tiger', slot: 1 }, { id: 'u2', name: 'SOKI', char: 'soki', slot: 2 }];
  const rows = vsResultRows(lineup, ['c0', 'u1', 'u2'], { c0: 75.5, u1: 80.25, u2: 'quit' }, 'u1');
  assert.deepEqual(rows.map((r) => [r.place, r.name, r.time, r.me]), [['1st', 'Big Tiger', '1:15.50', false], ['2nd', 'KYUGO', '1:20.25', true], ['3rd', 'SOKI', '—', false]]);
  assert.deepEqual(rows[0].face, { color: '#e67e22', character: 'tiger' });
  assert.ok(!('points' in rows[0]));
});

test('CPU の速さの直しのもと: まだ走っている人の進んだ距離の平均（いなければ NaN）', () => {
  assert.equal(rubberRef([100, 300]), 200);
  assert.ok(Number.isNaN(rubberRef([])));
});
