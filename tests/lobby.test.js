import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enterLobby, rejoinLobby, leaveLobby, setReady, playersOf } from '../src/net/lobby.js';
import { READY_WAIT_MS, VOTE_MS, allReady, tally, startVote, castVote, decideVote, racersLeft, resetRoom, roomStale, STALE_MS, markPlayed, startRacing, racingStale, RACE_MAX_MS } from '../src/net/room.js';

// メモリのサーバー（パスで読み書き。transaction も）
function fakeDb() {
  const data = {};
  const calls = [];
  const at = (path, make) => {
    const keys = path.split('/').filter(Boolean);
    let o = data;
    for (const k of keys.slice(0, -1)) o = o[k] ??= {};
    return [o, keys[keys.length - 1]];
  };
  const read = (path) => path.split('/').filter(Boolean).reduce((o, k) => (o == null ? null : o[k] ?? null), data);
  return {
    data, calls,
    SERVER_TIME: 777,
    async get(path) { return JSON.parse(JSON.stringify(read(path))); },
    async set(path, v) { const [o, k] = at(path); o[k] = JSON.parse(JSON.stringify(v)); calls.push(['set', path]); },
    async remove(path) { const [o, k] = at(path); delete o[k]; calls.push(['remove', path]); },
    async onDisconnectRemove(path) { calls.push(['onDisconnectRemove', path]); },
    async cancelOnDisconnect(path) { calls.push(['cancelOnDisconnect', path]); },
    async transaction(path, fn) { const next = fn(JSON.parse(JSON.stringify(read(path)))); if (next === undefined) return false; const [o, k] = at(path); o[k] = next; return true; },
  };
}
const me = (uid, name) => ({ uid, name, char: 'cat', codeId: 'c1' });

test('だれもいない待合室に入ると、チャットを消して部屋を lobby に戻してから入る。人がいれば消さない', async () => {
  const db = fakeDb();
  db.data.chat = { c1: { k: { text: 'old' } } };
  db.data.room = { phase: 'decided' };
  await enterLobby(db, me('u1', 'KYUGO'));
  assert.equal(db.data.chat.c1, undefined);
  assert.deepEqual(db.data.room, { phase: 'lobby' });
  assert.deepEqual(db.calls.slice(-2), [['onDisconnectRemove', 'lobby/u1'], ['set', 'lobby/u1']]);
  db.data.chat = { c1: { k: { text: 'hi' } } };
  await enterLobby(db, me('u2', 'SOKI'));
  assert.ok(db.data.chat.c1.k, '人がいるときは消さない');
  assert.deepEqual(playersOf(db.data.lobby).map((p) => p.name), ['KYUGO', 'SOKI']);
  await leaveLobby(db, 'u1');
  assert.deepEqual(playersOf(db.data.lobby).map((p) => p.name), ['SOKI']);
  assert.ok(db.calls.some((c) => c[0] === 'cancelOnDisconnect' && c[1] === 'lobby/u1'), '出たら、アプリを閉じたときの自動の削除も取り消す（あとで入り直した行を消さないように）');
});

test('全員 READY（2人以上）で投票が始まる。1人では始まらない', () => {
  const p = (ready) => ({ ready });
  assert.equal(allReady([p(true)]), false);
  assert.equal(allReady([p(true), p(false)]), false);
  assert.equal(allReady([p(true), p(true)]), true);
});

test('投票を始めるのは1回だけ（2台が同時に見ても）', async () => {
  const db = fakeDb();
  db.data.room = { phase: 'lobby' };
  const players = [{ uid: 'u1' }, { uid: 'u2' }];
  assert.equal(await startVote(db, players, 1000, () => 0.5), true);
  assert.equal(await startVote(db, players, 1001, () => 0.9), false);
  assert.equal(db.data.room.phase, 'voting');
  assert.equal(db.data.room.endsAt, 1000 + VOTE_MS);
  assert.deepEqual(db.data.room.racers, { u1: true, u2: true });
});

test('票の数え方: いちばん多い。同じ数ならその中から seed で。だれも選ばなければ全部から。前の投票の票は数えない', () => {
  const v = (voteId, course) => ({ voteId, course });
  assert.deepEqual(tally({ a: v('x', 1), b: v('x', 1), c: v('x', 3) }, 'x', 42, 5), { course: 1, count: 2 });
  const tie = tally({ a: v('x', 1), b: v('x', 3) }, 'x', 42, 5);
  assert.ok([1, 3].includes(tie.course));
  assert.equal(tie.count, 1);
  assert.deepEqual(tally({ a: v('x', 1), b: v('x', 3) }, 'x', 42, 5), tie, '同じ seed なら同じ');
  const none = tally({ a: v('old', 2) }, 'x', 7, 5);
  assert.ok(none.course >= 0 && none.course < 5);
  assert.equal(none.count, 0);
});

test('締め切りを過ぎたら、だれでも決められる（1回だけ）', async () => {
  const db = fakeDb();
  db.data.room = { phase: 'lobby' };
  await startVote(db, [{ uid: 'u1' }, { uid: 'u2' }], 1000, () => 0.25);
  const room = db.data.room;
  await castVote(db, 'u1', room.voteId, 2);
  await castVote(db, 'u2', room.voteId, 2);
  assert.equal(await decideVote(db, room, db.data.votes, 5), true);
  assert.equal(db.data.room.phase, 'decided');
  assert.equal(db.data.room.course, 2);
  assert.equal(db.data.room.picks, 2);
  assert.equal(await decideVote(db, room, db.data.votes, 5), false);
});

test('走る人で、待合室に残っている数（抜けた人は数えない）', () => {
  const room = { racers: { u1: true, u2: true, u3: true } };
  assert.equal(racersLeft(room, [{ uid: 'u1' }, { uid: 'u3' }, { uid: 'u9' }]), 2);
  assert.equal(racersLeft({}, []), 0);
});

test('部屋を戻すのは、decided か voting のときだけ（lobby や、別の投票は触らない）', async () => {
  const db = fakeDb();
  db.data.room = { phase: 'decided', voteId: 'v1', course: 1, picks: 1 };
  assert.equal(await resetRoom(db), true);
  assert.deepEqual(db.data.room, { phase: 'lobby' });
  assert.equal(await resetRoom(db), false, 'lobby はそのまま');
  db.data.room = { phase: 'voting', voteId: 'v2', endsAt: 5 };
  assert.equal(await resetRoom(db, 'v1'), false, 'voteId がちがう');
  assert.equal(await resetRoom(db, 'v2'), true);
  delete db.data.room;
  assert.equal(await resetRoom(db), false);
});

test('止まった部屋: decided・voting が締め切りの15秒あとを過ぎたら、だれでも戻してよい', () => {
  assert.equal(STALE_MS, 15000);
  assert.equal(roomStale({ phase: 'decided', endsAt: 1000 }, 1000 + STALE_MS), false);
  assert.equal(roomStale({ phase: 'decided', endsAt: 1000 }, 1001 + STALE_MS), true);
  assert.equal(roomStale({ phase: 'voting', endsAt: 1000 }, 1001 + STALE_MS), true);
  assert.equal(roomStale({ phase: 'voting', endsAt: 1000 }, 5000), false);
  assert.equal(roomStale({ phase: 'lobby' }, 1e12), false);
  assert.equal(roomStale(null, 1e12), false);
});

test('電波がもどったら入り直す: 消えた自分の行を書き直し、アプリを閉じたときの削除もかけ直す。チャットと部屋はそのまま（2026-10-22 READY が黄色にならなかった不具合）', async () => {
  const db = fakeDb();
  db.data.chat = { c1: { m1: { preset: 0 } } };
  db.data.room = { phase: 'voting' };
  await rejoinLobby(db, me('u1', 'KYUGO'));
  assert.deepEqual(db.data.lobby.u1, { name: 'KYUGO', char: 'cat', codeId: 'c1', ready: false, at: 777 });
  assert.deepEqual(db.data.chat, { c1: { m1: { preset: 0 } } });
  assert.deepEqual(db.data.room, { phase: 'voting' });
  assert.deepEqual(db.calls.slice(0, 1), [['onDisconnectRemove', 'lobby/u1']]);
});

test('同じ数のコースが並んだら、まだ走っていないコースを優先（2026-10-23 のユーザー依頼）', () => {
  const v = (course) => ({ voteId: 'x', course });
  const votes = { a: v(1), b: v(3) };
  for (let seed = 1; seed < 40; seed++) {
    assert.equal(tally(votes, 'x', seed, 5, { 1: true }).course, 3, `seed ${seed}`);
    assert.equal(tally(votes, 'x', seed, 5, [null, true]).course, 3, '配列で来ても同じ');
  }
  // 並んだのが全部走ったコースなら、並んだ中から
  const both = new Set();
  for (let seed = 1; seed < 40; seed++) both.add(tally(votes, 'x', seed, 5, { 1: true, 3: true }).course);
  assert.deepEqual([...both].sort(), [1, 3]);
  // だれも選ばなければ、まだ走っていない中から
  for (let seed = 1; seed < 40; seed++) assert.ok([2, 4].includes(tally({}, 'x', seed, 5, { 0: true, 1: true, 3: true }).course));
  // 多い票は、走ったコースでもそのまま
  assert.equal(tally({ a: v(1), b: v(1), c: v(3) }, 'x', 7, 5, { 1: true }).course, 1);
});

test('決めるときも、走ったコースを渡せる', async () => {
  const db = fakeDb();
  db.data.room = { phase: 'lobby' };
  await startVote(db, [{ uid: 'u1' }, { uid: 'u2' }], 1000, () => 0.25);
  const room = db.data.room;
  await castVote(db, 'u1', room.voteId, 0);
  await castVote(db, 'u2', room.voteId, 4);
  assert.equal(await decideVote(db, room, db.data.votes, 5, { 0: true }), true);
  assert.equal(db.data.room.course, 4);
});

test('走ったコース: レースが始まるときに足す。5コースそろったら空にする', async () => {
  const db = fakeDb();
  assert.equal(await markPlayed(db, 2, 5), true);
  assert.deepEqual(db.data.played, { 2: true });
  db.data.played = [true, null, true, true];
  await markPlayed(db, 1, 5);
  assert.deepEqual(db.data.played, { 0: true, 1: true, 2: true, 3: true });
  await markPlayed(db, 4, 5);
  assert.equal(db.data.played, null, '5つそろったら空');
});

test('部屋: decided → racing は同じ投票のときだけ。racing も lobby に戻せる', async () => {
  const db = fakeDb();
  db.data.room = { phase: 'decided', voteId: 'v1', endsAt: 5, racers: { u1: true }, seed: 1, course: 2, picks: 1 };
  assert.equal(await startRacing(db, 'v0'), false);
  assert.equal(await startRacing(db, 'v1'), true);
  assert.deepEqual(db.data.room, { phase: 'racing', voteId: 'v1', endsAt: 5, racers: { u1: true }, seed: 1, course: 2, picks: 1 });
  assert.equal(await startRacing(db, 'v1'), false, 'racing → racing はしない');
  assert.equal(await resetRoom(db, 'v0'), false);
  assert.equal(await resetRoom(db, 'v1'), true);
  assert.deepEqual(db.data.room, { phase: 'lobby' });
});

test('止まったレースの部屋: 走っている人が待合室にいなくなった・10分たった・レースができないまま15秒', () => {
  assert.equal(RACE_MAX_MS, 600000);
  const room = { phase: 'racing', voteId: 'v1', endsAt: 1000 };
  const race = { id: 'v1', startAt: 10000, racers: { u1: { slot: 0 }, u2: { slot: 1 } }, goals: null };
  const here = [{ uid: 'u1' }, { uid: 'u2' }, { uid: 'u9' }];
  assert.equal(racingStale(room, race, here, 20000), false, '2人とも走っている');
  assert.equal(racingStale(room, { ...race, goals: { u1: 80.5, u2: 'quit' } }, here, 20000), true, '全員ゴールか QUIT');
  assert.equal(racingStale(room, { ...race, goals: { u1: 80.5 } }, here, 20000), false, 'u2 がまだ走っている');
  assert.equal(racingStale(room, race, [{ uid: 'u9' }], 20000), true, '走る人がだれも待合室にいない（切れた）');
  assert.equal(racingStale(room, race, here, 10000 + RACE_MAX_MS + 1), true, '10分');
  assert.equal(racingStale(room, { ...race, racers: null }, [], 20000), false, 'まだ読みこんでいない');
  assert.equal(racingStale(room, { id: 'v0' }, here, 1000 + STALE_MS), false);
  assert.equal(racingStale(room, { id: 'v0' }, here, 1001 + STALE_MS), true, 'レースができないまま');
  // startAt がまだないレース（全員の読みこみを待っている）: createdAt + 20秒 を基準にする
  const waiting = { id: 'v1', createdAt: 10000, racers: race.racers, goals: null };
  assert.equal(racingStale(room, waiting, here, 20000), false, '待っている');
  assert.equal(racingStale(room, waiting, here, 10000 + READY_WAIT_MS + RACE_MAX_MS), false);
  assert.equal(racingStale(room, waiting, here, 10000 + READY_WAIT_MS + RACE_MAX_MS + 1), true, '10分たっても始まらない');
  assert.equal(racingStale(room, { id: 'v1', racers: race.racers }, here, 1e12), false, 'startAt も createdAt もまだ読めていない');
  assert.equal(racingStale({ phase: 'lobby' }, race, [], 1e12), false);
  assert.equal(racingStale(null, race, [], 1e12), false);
});

test('だれもいない待合室に入ると、走ったコース（/played）も消す', async () => {
  const db = fakeDb();
  db.data.played = { 1: true };
  await enterLobby(db, me('u1', 'KYUGO'));
  assert.equal(db.data.played, undefined);
  db.data.played = { 2: true };
  await enterLobby(db, me('u2', 'SOKI'));
  assert.deepEqual(db.data.played, { 2: true }, '人がいるときは消さない');
});
